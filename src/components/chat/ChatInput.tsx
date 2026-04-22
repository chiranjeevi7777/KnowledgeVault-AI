import { useState, useRef, KeyboardEvent, useEffect } from 'react';
import { Search, Send, Loader2 } from 'lucide-react';

interface ChatInputProps {
  onSend:        (text: string) => void;
  isLoading:     boolean;
  prefillValue?: string; // populated when user clicks a history item
}

export default function ChatInput({ onSend, isLoading, prefillValue = '' }: ChatInputProps) {
  const [value, setValue] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  // When the sidebar injects a prefill query, load it into the input and focus
  useEffect(() => {
    if (prefillValue) {
      setValue(prefillValue);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [prefillValue]);

  const handleSubmit = () => {
    const text = value.trim();
    if (!text || isLoading) return;
    onSend(text);
    setValue('');
    inputRef.current?.focus();
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  return (
    <div className="p-12 pb-10 w-full max-w-4xl mx-auto shrink-0">
      <div className="relative group">
        <div className="absolute left-7 top-1/2 -translate-y-1/2 flex items-center gap-3">
          <Search className="w-5 h-5 text-slate-300 group-focus-within:text-box-blue transition-colors" />
          <div className="w-px h-6 bg-slate-100" />
        </div>

        <input
          id="chat-input"
          ref={inputRef}
          type="text"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={handleKeyDown}
          disabled={isLoading}
          placeholder={isLoading ? 'Searching Box files…' : 'Ask anything about your Box files…'}
          className="w-full pl-20 pr-20 py-7 bg-white border border-slate-100 rounded-[2.5rem] shadow-[0_20px_50px_rgb(0,0,0,0.03)] focus:outline-none focus:ring-4 focus:ring-box-blue/5 focus:border-box-blue/20 transition-all text-xl placeholder:text-slate-300 text-slate-700 disabled:opacity-60 disabled:cursor-not-allowed"
        />

        <div className="absolute right-4 top-1/2 -translate-y-1/2 flex items-center gap-2">
          <button
            id="chat-send-btn"
            onClick={handleSubmit}
            disabled={isLoading || !value.trim()}
            className="bg-slate-900 group-focus-within:bg-box-blue hover:scale-105 active:scale-95 disabled:opacity-50 disabled:scale-100 disabled:cursor-not-allowed p-4 rounded-2xl text-white shadow-xl shadow-slate-200 transition-all flex items-center justify-center"
          >
            {isLoading
              ? <Loader2 className="w-6 h-6 animate-spin" />
              : <Send className="w-6 h-6" />}
          </button>
        </div>
      </div>

      <div className="mt-8 flex items-center justify-center gap-3">
        <div className="w-8 h-px bg-slate-100" />
        <span className="text-[9px] font-black tracking-[0.4em] text-slate-300 uppercase">
          Box Secure Intelligence · Amazon Bedrock Claude
        </span>
        <div className="w-8 h-px bg-slate-100" />
      </div>
    </div>
  );
}
