import React, { useState, useRef, useEffect } from 'react';

interface InputBarProps {
  onSend: (text: string) => void;
  disabled: boolean;
  isLiveActive: boolean;
}

const InputBar: React.FC<InputBarProps> = ({ onSend, disabled, isLiveActive }) => {
  const [text, setText] = useState('');
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const handleSubmit = (e?: React.FormEvent) => {
    e?.preventDefault();
    if (text.trim() && !disabled) {
      onSend(text.trim());
      setText('');
      if (textareaRef.current) {
        textareaRef.current.style.height = 'auto';
      }
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  // Auto-resize textarea
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 100)}px`;
    }
  }, [text]);

  return (
    <div className={`w-full transition-all duration-300 ${isLiveActive ? 'opacity-50 pointer-events-none' : 'opacity-100'}`}>
      <form 
        onSubmit={handleSubmit}
        className="relative flex items-end gap-2 bg-gray-100/80 backdrop-blur-sm border border-gray-200 rounded-[24px] px-2 py-2 shadow-inner focus-within:ring-2 focus-within:ring-blue-500/20 focus-within:border-blue-400 transition-all"
      >
        <textarea
          ref={textareaRef}
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Type to translate..."
          rows={1}
          disabled={disabled || isLiveActive}
          className="flex-1 bg-transparent border-0 focus:ring-0 resize-none py-3 px-3 min-h-[44px] max-h-[100px] text-[15px] leading-relaxed placeholder-gray-400 text-gray-900 disabled:cursor-not-allowed"
          style={{ scrollbarWidth: 'none' }}
        />
        
        <button
          type="submit"
          disabled={!text.trim() || disabled || isLiveActive}
          className="mb-1 p-2.5 rounded-full bg-blue-600 text-white shadow-md disabled:opacity-50 disabled:shadow-none disabled:bg-gray-300 transition-all hover:scale-105 active:scale-95 flex-none"
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="m22 2-7 20-4-9-9-4Z"/><path d="M22 2 11 13"/></svg>
        </button>
      </form>
      {isLiveActive && (
        <div className="absolute inset-0 flex items-center justify-center bg-white/10 backdrop-blur-[1px] rounded-2xl">
          <span className="text-xs font-medium text-gray-500 bg-white/90 px-3 py-1 rounded-full shadow-sm">
            Pause Live to type
          </span>
        </div>
      )}
    </div>
  );
};

export default InputBar;
