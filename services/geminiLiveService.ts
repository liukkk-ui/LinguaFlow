import { GoogleGenAI, LiveServerMessage, Modality } from "@google/genai";
import { MODEL_NAME, SYSTEM_INSTRUCTION } from "../constants";
import { createPcmBlob, decodeAudioData, base64ToUint8Array } from "./audioUtils";

interface GeminiLiveConfig {
  apiKey: string;
  voiceName: string;
  onOpen: () => void;
  onClose: (event: CloseEvent) => void;
  onError: (error: Error | ErrorEvent) => void;
  onAudioData: (audioBuffer: AudioBuffer) => void;
  onTranscription: (text: string, isFinal: boolean) => void;
  onVolumeChange: (volume: number) => void;
}

export class GeminiLiveService {
  private ai: GoogleGenAI;
  private sessionPromise: Promise<any> | null = null;
  private inputAudioContext: AudioContext | null = null;
  private outputAudioContext: AudioContext | null = null;
  private mediaStream: MediaStream | null = null;
  private processor: ScriptProcessorNode | null = null;
  private source: MediaStreamAudioSourceNode | null = null;
  private nextStartTime: number = 0;
  private config: GeminiLiveConfig;
  private isConnected: boolean = false;

  constructor(config: GeminiLiveConfig) {
    this.config = config;
    this.ai = new GoogleGenAI({ apiKey: config.apiKey });
  }

  public async connect() {
    if (this.isConnected) return;

    try {
      // 1. Setup Audio Contexts
      // Input: 16kHz for speech recognition optimization
      this.inputAudioContext = new (window.AudioContext || (window as any).webkitAudioContext)({
        sampleRate: 16000,
      });
      // Output: 24kHz for high quality TTS
      this.outputAudioContext = new (window.AudioContext || (window as any).webkitAudioContext)({
        sampleRate: 24000,
      });

      // 2. Get Microphone Stream
      this.mediaStream = await navigator.mediaDevices.getUserMedia({ 
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true
        } 
      });

      // 3. Initialize Gemini Live Session
      this.sessionPromise = this.ai.live.connect({
        model: MODEL_NAME,
        config: {
          responseModalities: [Modality.AUDIO],
          speechConfig: {
            voiceConfig: { prebuiltVoiceConfig: { voiceName: this.config.voiceName } },
          },
          systemInstruction: SYSTEM_INSTRUCTION,
          inputAudioTranscription: {}, // Request transcription of user speech
          outputAudioTranscription: {}, // Request transcription of model speech
        },
        callbacks: {
          onopen: () => {
            console.log("Gemini Live Connected");
            this.isConnected = true;
            this.config.onOpen();
            this.startAudioProcessing();
          },
          onmessage: this.handleMessage.bind(this),
          onclose: (e) => {
            console.log("Gemini Live Closed", e);
            this.isConnected = false;
            this.cleanup();
            this.config.onClose(e);
          },
          onerror: (e) => {
            console.error("Gemini Live Error", e);
            this.isConnected = false;
            this.cleanup();
            this.config.onError(e);
          },
        },
      });

    } catch (error) {
      console.error("Failed to connect to Gemini Live:", error);
      this.cleanup();
      throw error;
    }
  }

  private startAudioProcessing() {
    if (!this.inputAudioContext || !this.mediaStream) return;

    this.source = this.inputAudioContext.createMediaStreamSource(this.mediaStream);
    // Buffer size 4096 provides a balance between latency and performance
    this.processor = this.inputAudioContext.createScriptProcessor(4096, 1, 1);

    this.processor.onaudioprocess = (e) => {
      const inputData = e.inputBuffer.getChannelData(0);
      
      // Calculate volume for visualizer
      let sum = 0;
      for (let i = 0; i < inputData.length; i++) {
        sum += inputData[i] * inputData[i];
      }
      const rms = Math.sqrt(sum / inputData.length);
      this.config.onVolumeChange(rms);

      // Create blob and send to API
      const pcmBlob = createPcmBlob(inputData, 16000);
      
      if (this.sessionPromise) {
        this.sessionPromise.then((session) => {
           session.sendRealtimeInput({ media: pcmBlob });
        });
      }
    };

    this.source.connect(this.processor);
    this.processor.connect(this.inputAudioContext.destination);
  }

  private async handleMessage(message: LiveServerMessage) {
    if (!this.outputAudioContext) return;

    // 1. Handle Transcriptions
    // Input Transcription (User)
    if (message.serverContent?.inputTranscription?.text) {
        // We only get partials usually, waiting for turnComplete for final logic in UI if needed
        // But for visual feedback we send it up
        this.config.onTranscription(message.serverContent.inputTranscription.text, false);
    }
    // Output Transcription (Model)
    if (message.serverContent?.outputTranscription?.text) {
        this.config.onTranscription(message.serverContent.outputTranscription.text, true);
    }

    // 2. Handle Audio Output
    const base64Audio = message.serverContent?.modelTurn?.parts?.[0]?.inlineData?.data;
    if (base64Audio) {
      try {
        const audioData = base64ToUint8Array(base64Audio);
        const audioBuffer = await decodeAudioData(audioData, this.outputAudioContext);

        // Schedule playback
        this.nextStartTime = Math.max(this.nextStartTime, this.outputAudioContext.currentTime);
        
        const source = this.outputAudioContext.createBufferSource();
        source.buffer = audioBuffer;
        source.connect(this.outputAudioContext.destination);
        source.start(this.nextStartTime);
        
        this.nextStartTime += audioBuffer.duration;

        // Send buffer to UI for replay capability if needed
        this.config.onAudioData(audioBuffer);

      } catch (err) {
        console.error("Error decoding audio response:", err);
      }
    }

    // 3. Handle Interruption
    if (message.serverContent?.interrupted) {
      console.log("Model interrupted");
      // In a real app, we would stop current playing nodes here.
      // For simplicity, we just reset the time cursor.
      this.nextStartTime = this.outputAudioContext.currentTime;
    }
  }

  public async disconnect() {
    this.isConnected = false;
    if (this.sessionPromise) {
        const session = await this.sessionPromise;
        // There isn't an explicit close method on the session object in all versions, 
        // but stopping the stream works.
    }
    this.cleanup();
  }

  private cleanup() {
    if (this.processor) {
      this.processor.disconnect();
      this.processor = null;
    }
    if (this.source) {
      this.source.disconnect();
      this.source = null;
    }
    if (this.mediaStream) {
        this.mediaStream.getTracks().forEach(track => track.stop());
        this.mediaStream = null;
    }
    if (this.inputAudioContext) {
        this.inputAudioContext.close();
        this.inputAudioContext = null;
    }
    if (this.outputAudioContext) {
        this.outputAudioContext.close();
        this.outputAudioContext = null;
    }
  }
}