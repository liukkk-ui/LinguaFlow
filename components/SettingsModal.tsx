import React from 'react';
import { VOICE_PERSONAS } from '../constants';
import { VoicePersona } from '../types';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  selectedVoiceId: string;
  onSelectVoice: (id: string) => void;
  onClearHistory: () => void;
}

const SettingsModal: React.FC<SettingsModalProps> = ({ isOpen, onClose, selectedVoiceId, onSelectVoice, onClearHistory }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 backdrop-blur-sm p-4 animate-in fade-in duration-200">
      <div className="bg-white w-full max-w-md rounded-3xl p-6 shadow-2xl slide-in-from-bottom-10 sm:slide-in-from-bottom-0 sm:zoom-in-95 duration-200">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-xl font-semibold text-gray-900">Translation Voice</h2>
          <button 
            onClick={onClose}
            className="p-2 bg-gray-100 hover:bg-gray-200 rounded-full text-gray-600 transition-colors"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>
          </button>
        </div>

        <div className="space-y-3">
          {VOICE_PERSONAS.map((voice: VoicePersona) => (
            <button
              key={voice.id}
              onClick={() => onSelectVoice(voice.id)}
              className={`w-full flex items-center justify-between p-4 rounded-xl border transition-all ${
                selectedVoiceId === voice.id 
                  ? 'border-blue-500 bg-blue-50 text-blue-900 ring-1 ring-blue-500' 
                  : 'border-gray-200 hover:border-gray-300 text-gray-700'
              }`}
            >
              <div className="text-left">
                <div className="font-medium">{voice.name}</div>
                <div className="text-xs text-gray-500 mt-1">{voice.description}</div>
              </div>
              {selectedVoiceId === voice.id && (
                <div className="text-blue-600">
                  <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
                </div>
              )}
            </button>
          ))}
        </div>

        <div className="mt-6 pt-6 border-t border-gray-100">
          <button 
            onClick={onClearHistory}
            className="w-full py-3 text-red-500 font-medium hover:bg-red-50 rounded-xl transition-colors flex items-center justify-center gap-2 group"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="group-hover:scale-110 transition-transform"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/><line x1="10" y1="11" x2="10" y2="17"/><line x1="14" y1="11" x2="14" y2="17"/></svg>
            Clear Conversation History
          </button>
        </div>

        <div className="mt-4 text-center text-xs text-gray-400">
          Powered by Gemini 2.5 Flash Native Audio
        </div>
      </div>
    </div>
  );
};

export default SettingsModal;