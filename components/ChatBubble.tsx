import React from 'react';
import { ChatMessage, MessageRole } from '../types';

interface ChatBubbleProps {
  message: ChatMessage;
  onPlayAudio?: () => void;
}

const ChatBubble: React.FC<ChatBubbleProps> = ({ message, onPlayAudio }) => {
  const isUser = message.role === MessageRole.USER;
  
  // Basic language detection heuristic for styling direction
  // (In a real app, the API would ideally tell us the language, or we detect unicode ranges)
  const hasChinese = /[\u4e00-\u9fa5]/.test(message.text);

  return (
    <div className={`flex w-full mb-6 ${isUser ? 'justify-end' : 'justify-start'}`}>
      <div 
        className={`relative max-w-[85%] px-5 py-3.5 rounded-2xl shadow-sm text-[15px] leading-relaxed
        ${isUser 
          ? 'bg-blue-600 text-white rounded-br-none' 
          : 'bg-white border border-gray-100 text-gray-800 rounded-bl-none'
        }`}
      >
        <div className="break-words">
          {message.text}
        </div>
        
        <div className="flex items-center justify-between mt-2 gap-3">
            <div className={`text-[10px] font-medium uppercase tracking-wider opacity-70 ${isUser ? 'text-blue-100' : 'text-gray-400'}`}>
            {isUser ? 'You' : 'Translator'}
            </div>

            {onPlayAudio && (
                <button 
                    onClick={onPlayAudio}
                    className={`p-1.5 rounded-full transition-colors flex-none
                        ${isUser 
                            ? 'text-blue-100 hover:bg-blue-500/50' 
                            : 'text-gray-400 hover:bg-gray-100 hover:text-blue-600'
                        }`}
                    aria-label="Play translation"
                >
                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="currentColor" stroke="none"><polygon points="5 3 19 12 5 21 5 3"></polygon></svg>
                </button>
            )}
        </div>
      </div>
    </div>
  );
};

export default ChatBubble;
