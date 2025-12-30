import React, { useState, useEffect, useRef, useCallback } from 'react';
import { GeminiLiveService } from './services/geminiLiveService';
import { TextService } from './services/textService';
import { ChatMessage, MessageRole, AppState } from './types';
import { VOICE_PERSONAS } from './constants';
import { concatenateAudioBuffers } from './services/audioUtils';
import ChatBubble from './components/ChatBubble';
import SettingsModal from './components/SettingsModal';
import Visualizer from './components/Visualizer';
import InputBar from './components/InputBar';

const App: React.FC = () => {
  // Load initial state from localStorage if available
  const [messages, setMessages] = useState<ChatMessage[]>(() => {
    if (typeof window !== 'undefined') {
      try {
        const saved = localStorage.getItem('chat_history');
        if (saved) {
          return JSON.parse(saved);
        }
      } catch (e) {
        console.error("Failed to load chat history", e);
      }
    }
    return [];
  });

  const [appState, setAppState] = useState<AppState>(AppState.IDLE);
  const [volume, setVolume] = useState<number>(0);
  const [selectedVoiceId, setSelectedVoiceId] = useState<string>('1');
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isProcessingText, setIsProcessingText] = useState(false);
  
  const liveServiceRef = useRef<GeminiLiveService | null>(null);
  const chatContainerRef = useRef<HTMLDivElement>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  
  // Ref to accumulate transcriptions until a "turn" feels complete or generic timeout
  // Note: Live API streams text chunks. We need to append them.
  const currentTurnRef = useRef<{ id: string; role: MessageRole; text: string } | null>(null);

  // Persist messages to localStorage whenever they change
  useEffect(() => {
    try {
      // Create a version of messages without the AudioBuffer (which isn't serializable)
      const serializableMessages = messages.map(({ audioBuffer, ...msg }) => msg);
      localStorage.setItem('chat_history', JSON.stringify(serializableMessages));
    } catch (e) {
      console.error("Failed to save chat history", e);
    }
  }, [messages]);

  useEffect(() => {
    // Auto scroll to bottom
    if (chatContainerRef.current) {
      chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight;
    }
  }, [messages, isProcessingText]); // Scroll when loading state changes too

  // Initialize Audio Context for TTS playback
  useEffect(() => {
    audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)({
      sampleRate: 24000,
    });
    return () => {
      audioContextRef.current?.close();
    };
  }, []);

  const handleTranscription = useCallback((text: string, isModel: boolean) => {
    setMessages((prev) => {
      const role = isModel ? MessageRole.MODEL : MessageRole.USER;
      const lastMsg = prev[prev.length - 1];

      // Logic to append to existing message if it's the same turn (basic heuristic)
      // If the last message was from the same role and is recent (< 2 sec), append
      if (lastMsg && lastMsg.role === role && (Date.now() - lastMsg.timestamp < 3000)) {
         const newMessages = [...prev];
         newMessages[newMessages.length - 1] = {
           ...lastMsg,
           text: text, 
           timestamp: Date.now()
         };
         return newMessages;
      } else {
        return [...prev, {
          id: Date.now().toString(),
          role,
          text,
          timestamp: Date.now()
        }];
      }
    });
  }, []);

  const handleAudioData = useCallback((buffer: AudioBuffer) => {
    if (!audioContextRef.current) return;
    
    setMessages((prev) => {
      const newMessages = [...prev];
      const lastMsg = newMessages[newMessages.length - 1];
      
      // If the last message is from the model, append this audio chunk to it
      if (lastMsg && lastMsg.role === MessageRole.MODEL) {
        const mergedBuffer = concatenateAudioBuffers(
          [lastMsg.audioBuffer, buffer], 
          audioContextRef.current!
        );
        newMessages[newMessages.length - 1] = {
          ...lastMsg,
          audioBuffer: mergedBuffer
        };
        return newMessages;
      }
      return prev;
    });
  }, []);

  const handlePlayAudio = (buffer: AudioBuffer) => {
    if (!audioContextRef.current) return;
    
    if (audioContextRef.current.state === 'suspended') {
      audioContextRef.current.resume();
    }

    const source = audioContextRef.current.createBufferSource();
    source.buffer = buffer;
    source.connect(audioContextRef.current.destination);
    source.start();

    // Simulation of visualizer during playback
    const duration = buffer.duration * 1000;
    setVolume(0.5);
    const interval = setInterval(() => setVolume(Math.random() * 0.5 + 0.2), 100);
    setTimeout(() => {
      clearInterval(interval);
      setVolume(0);
    }, duration);
  };

  const handleClearHistory = () => {
    setMessages([]);
    localStorage.removeItem('chat_history');
    setIsSettingsOpen(false);
  };

  const handleTextSubmit = async (text: string) => {
    const apiKey = process.env.API_KEY;
    if (!apiKey) {
      setErrorMessage("API Key not found.");
      return;
    }

    // 1. Add User Message immediately
    const userMsg: ChatMessage = {
      id: Date.now().toString(),
      role: MessageRole.USER,
      text: text,
      timestamp: Date.now()
    };
    setMessages(prev => [...prev, userMsg]);
    setIsProcessingText(true);
    setErrorMessage(null);

    try {
      const voice = VOICE_PERSONAS.find(v => v.id === selectedVoiceId) || VOICE_PERSONAS[0];
      const textService = new TextService(apiKey);

      // 2. Translate Text
      const translatedText = await textService.translate(text);
      
      const modelMsgId = (Date.now() + 1).toString();

      // 3. Add Model Message (Text)
      const modelMsg: ChatMessage = {
        id: modelMsgId,
        role: MessageRole.MODEL,
        text: translatedText,
        timestamp: Date.now()
      };
      setMessages(prev => [...prev, modelMsg]);

      // 4. Generate Speech (TTS)
      if (audioContextRef.current) {
        // Resume context if suspended (browser autoplay policy)
        if (audioContextRef.current.state === 'suspended') {
          await audioContextRef.current.resume();
        }

        const audioBuffer = await textService.speak(translatedText, voice.voiceName, audioContextRef.current);
        
        if (audioBuffer) {
           // Do not play immediately, just store
           // Attach audio buffer to the message in state
           setMessages(prev => prev.map(msg => 
             msg.id === modelMsgId ? { ...msg, audioBuffer: audioBuffer } : msg
           ));
        }
      }

    } catch (err: any) {
      console.error("Text handling error:", err);
      setErrorMessage("Failed to translate text.");
    } finally {
      setIsProcessingText(false);
    }
  };

  const toggleConnection = async () => {
    if (appState === AppState.CONNECTING) return;

    if (appState === AppState.LISTENING) {
      // Stop
      if (liveServiceRef.current) {
        await liveServiceRef.current.disconnect();
        liveServiceRef.current = null;
      }
      setAppState(AppState.IDLE);
      setVolume(0);
    } else {
      // Start
      const apiKey = process.env.API_KEY;
      if (!apiKey) {
        setErrorMessage("API Key not found in environment variables.");
        return;
      }

      setErrorMessage(null);
      const voice = VOICE_PERSONAS.find(v => v.id === selectedVoiceId) || VOICE_PERSONAS[0];

      setAppState(AppState.CONNECTING);
      
      const service = new GeminiLiveService({
        apiKey,
        voiceName: voice.voiceName,
        onOpen: () => setAppState(AppState.LISTENING),
        onClose: () => setAppState(AppState.IDLE),
        onError: (err) => {
          console.error("Gemini Service Error:", err);
          setAppState(AppState.ERROR);
          let msg = "Connection error occurred.";
          if (err instanceof Error) {
            msg = err.message;
          } else if (err instanceof ErrorEvent) {
             msg = err.message || "WebSocket error";
          }
          setErrorMessage(msg);
        },
        onVolumeChange: (vol) => setVolume(vol),
        onAudioData: (buffer) => {
           handleAudioData(buffer);
        }, 
        onTranscription: (text, isModel) => {
            if (!text) return;
            handleTranscription(text, isModel);
        }
      });

      liveServiceRef.current = service;
      try {
        await service.connect();
      } catch (err: any) {
        setAppState(AppState.ERROR);
        setErrorMessage(err.message || "Failed to establish connection.");
      }
    }
  };

  return (
    <div className="flex flex-col h-full bg-gray-50 max-w-lg mx-auto shadow-2xl overflow-hidden relative font-sans">
      
      {/* Header */}
      <header className="flex-none px-6 py-5 bg-white/80 backdrop-blur-md sticky top-0 z-10 border-b border-gray-100 flex justify-between items-center">
        <div>
          <h1 className="text-xl font-bold text-gray-900 tracking-tight">LinguaFlow</h1>
          <p className="text-xs text-gray-500 font-medium">CN <span className="mx-1">↔</span> EN Live Translator</p>
        </div>
        <button 
          onClick={() => setIsSettingsOpen(true)}
          className="p-2 rounded-full hover:bg-gray-100 text-gray-600 transition-colors"
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>
        </button>
      </header>
      
      {/* Error Banner */}
      {errorMessage && (
        <div className="absolute top-[70px] left-4 right-4 z-20 bg-red-50 border border-red-200 text-red-600 px-4 py-3 rounded-xl flex items-start gap-3 shadow-md animate-in fade-in slide-in-from-top-2">
           <svg className="w-5 h-5 flex-shrink-0 mt-0.5" xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" x2="12" y1="8" y2="12"/><line x1="12" x2="12.01" y1="16" y2="16"/></svg>
           <div className="flex-1 text-sm">
             <p className="font-medium">Error</p>
             <p className="text-red-500 opacity-90">{errorMessage}</p>
           </div>
           <button onClick={() => setErrorMessage(null)} className="text-red-400 hover:text-red-600">
             <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
           </button>
        </div>
      )}

      {/* Chat Timeline */}
      <div 
        ref={chatContainerRef}
        className="flex-1 overflow-y-auto px-4 py-6 scroll-smooth"
      >
        {messages.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-gray-300 space-y-4 pb-20">
            <div className={`w-16 h-16 rounded-full flex items-center justify-center transition-colors ${errorMessage ? 'bg-red-50 text-red-300' : 'bg-gray-100'}`}>
              <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="m5 8 6 6"/><path d="m4 14 6-6 2-3"/><path d="M2 5h12"/><path d="M7 2h1"/><path d="m22 22-5-10-5 10"/><path d="M14 18h6"/></svg>
            </div>
            <p className="text-sm font-medium">{errorMessage ? "Connection failed" : "Tap mic or type to start"}</p>
          </div>
        ) : (
          <>
            {messages.map((msg) => (
              <ChatBubble 
                key={msg.id} 
                message={msg} 
                onPlayAudio={msg.audioBuffer ? () => handlePlayAudio(msg.audioBuffer!) : undefined}
              />
            ))}
            {isProcessingText && (
               <div className="flex w-full mb-6 justify-start">
                  <div className="bg-white border border-gray-100 text-gray-400 px-5 py-3.5 rounded-2xl rounded-bl-none shadow-sm text-sm">
                    <span className="animate-pulse">Translating...</span>
                  </div>
               </div>
            )}
          </>
        )}
      </div>

      {/* Floating Controls */}
      <div className="flex-none bg-white p-6 pb-8 rounded-t-[2.5rem] shadow-[0_-10px_40px_-15px_rgba(0,0,0,0.1)] z-20">
        
        {/* Top Row: Visualizer or Status */}
        <div className="h-8 w-full flex items-center justify-center mb-6">
            {appState === AppState.LISTENING ? (
              <Visualizer volume={volume} isActive={true} />
            ) : appState === AppState.CONNECTING ? (
              <span className="text-sm font-medium text-gray-400 animate-pulse">Connecting...</span>
            ) : appState === AppState.ERROR ? (
              <span className="text-sm font-medium text-red-500">Connection Failed</span>
            ) : volume > 0 ? (
               <Visualizer volume={volume} isActive={true} />
            ) : (
              <span className="text-sm font-medium text-gray-400">Ready</span>
            )}
        </div>

        {/* Control Row: Input + Mic */}
        <div className="flex items-end gap-4">
          <InputBar 
            onSend={handleTextSubmit} 
            disabled={isProcessingText} 
            isLiveActive={appState === AppState.LISTENING || appState === AppState.CONNECTING}
          />

          {/* Main Mic Button */}
          <button
            onClick={toggleConnection}
            disabled={appState === AppState.CONNECTING || isProcessingText}
            className={`
              relative w-14 h-14 flex-none rounded-full flex items-center justify-center transition-all duration-300
              ${appState === AppState.LISTENING 
                ? 'bg-red-500 shadow-[0_0_0_4px_rgba(239,68,68,0.2)]' 
                : appState === AppState.ERROR
                ? 'bg-red-500 hover:bg-red-600 shadow-lg'
                : 'bg-blue-600 hover:bg-blue-700 shadow-lg hover:shadow-xl'
              }
              ${(appState === AppState.CONNECTING || isProcessingText) ? 'opacity-70 cursor-wait' : ''}
            `}
          >
             {appState === AppState.LISTENING ? (
               /* Stop Icon */
               <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="white" stroke="white" strokeWidth="0" strokeLinecap="round" strokeLinejoin="round"><rect x="6" y="6" width="12" height="12" rx="2"/></svg>
             ) : appState === AppState.ERROR ? (
               /* Retry/Alert Icon */
               <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21.21 15.89A10 10 0 1 1 8 2.83"/><path d="M22 12A10 10 0 0 0 12 2v10z"/></svg>
             ) : (
               /* Mic Icon */
               <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z"/><path d="M19 10v2a7 7 0 0 1-14 0v-2"/><line x1="12" x2="12" y1="19" y2="22"/></svg>
             )}
          </button>
        </div>
      </div>

      <SettingsModal 
        isOpen={isSettingsOpen} 
        onClose={() => setIsSettingsOpen(false)}
        selectedVoiceId={selectedVoiceId}
        onSelectVoice={setSelectedVoiceId}
        onClearHistory={handleClearHistory}
      />
      
    </div>
  );
};

export default App;