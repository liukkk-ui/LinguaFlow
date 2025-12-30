import { GoogleGenAI, Modality } from "@google/genai";
import { SYSTEM_INSTRUCTION } from "../constants";
import { decodeAudioData, base64ToUint8Array } from "./audioUtils";

export class TextService {
  private ai: GoogleGenAI;
  
  constructor(apiKey: string) {
    this.ai = new GoogleGenAI({ apiKey });
  }

  async translate(text: string): Promise<string> {
    try {
      // Use the advanced text model for high-quality, idiomatic translation
      // 'gemini-3-pro-preview' offers better nuance for natural conversation
      const response = await this.ai.models.generateContent({
        model: 'gemini-3-pro-preview',
        contents: text,
        config: {
           systemInstruction: SYSTEM_INSTRUCTION,
           temperature: 0.7, // Natural conversation
        }
      });
      return response.text || "";
    } catch (error) {
      console.error("Translation error:", error);
      throw error;
    }
  }

  async speak(text: string, voiceName: string, audioContext: AudioContext): Promise<AudioBuffer | null> {
    if (!text || !text.trim()) return null;
    
    try {
       const response = await this.ai.models.generateContent({
          model: "gemini-2.5-flash-preview-tts",
          // contents must be an array of Content objects for the TTS model to parse correctly
          contents: [{ parts: [{ text }] }],
          config: {
              responseModalities: [Modality.AUDIO],
              speechConfig: {
                  voiceConfig: {
                      prebuiltVoiceConfig: { voiceName }
                  }
              }
          }
       });
       
       const base64 = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
       
       if (!base64) {
         console.warn("TTS service returned no audio data.");
         return null;
       }
       
       const audioData = base64ToUint8Array(base64);
       return await decodeAudioData(audioData, audioContext);
    } catch (error) {
      console.error("TTS error:", error);
      return null;
    }
  }
}