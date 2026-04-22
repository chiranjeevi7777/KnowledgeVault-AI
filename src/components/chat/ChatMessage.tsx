import { motion } from 'motion/react';
import { User, Bot, FileText, ExternalLink, AlertCircle } from 'lucide-react';

export interface Source {
  file:        string;
  path:        string;
  box_file_id: string;
  score:       number;
}

export interface Message {
  id:        string;
  role:      'user' | 'assistant';
  content:   string;
  sources?:  Source[];
  timestamp: Date;
  isError?:  boolean;
}

interface ChatMessageProps {
  message: Message;
}

export default function ChatMessage({ message }: ChatMessageProps) {
  const isUser = message.role === 'user';

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, ease: 'easeOut' }}
      className={`flex gap-4 ${isUser ? 'flex-row-reverse' : 'flex-row'}`}
    >
      {/* Avatar */}
      <div className={`w-9 h-9 rounded-2xl flex items-center justify-center shrink-0 mt-1 shadow-sm ${
        isUser
          ? 'bg-slate-900 text-white'
          : 'bg-box-blue text-white'
      }`}>
        {isUser ? <User className="w-4 h-4" /> : <Bot className="w-4 h-4" />}
      </div>

      {/* Bubble */}
      <div className={`max-w-[75%] space-y-3 ${isUser ? 'items-end flex flex-col' : ''}`}>
        <div className={`px-5 py-4 rounded-3xl text-sm leading-relaxed ${
          isUser
            ? 'bg-slate-900 text-white rounded-tr-md'
            : message.isError
            ? 'bg-rose-50 text-rose-800 border border-rose-100 rounded-tl-md'
            : 'bg-white border border-slate-100 shadow-sm text-slate-800 rounded-tl-md'
        }`}>
          {message.isError && (
            <div className="flex items-center gap-2 mb-2">
              <AlertCircle className="w-4 h-4 text-rose-500" />
              <span className="text-xs font-bold text-rose-500 uppercase tracking-wide">Error</span>
            </div>
          )}
          <p className="whitespace-pre-wrap">{message.content}</p>
        </div>

        {/* Sources */}
        {!isUser && message.sources && message.sources.length > 0 && (
          <div className="space-y-1.5 w-full">
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest pl-1">
              Sources
            </p>
            <div className="flex flex-wrap gap-2">
              {message.sources.map((src, i) => (
                <div
                  key={i}
                  className="flex items-center gap-2 px-3 py-1.5 bg-blue-50/80 border border-blue-100/60 rounded-xl group cursor-default"
                  title={`${src.path} — Relevance: ${Math.round(src.score * 100)}%`}
                >
                  <FileText className="w-3 h-3 text-box-blue shrink-0" />
                  <span className="text-[11px] font-semibold text-box-blue max-w-[180px] truncate">
                    {src.file}
                  </span>
                  <span className="text-[9px] font-bold text-box-blue/50 bg-white/70 px-1 py-0.5 rounded">
                    {Math.round(src.score * 100)}%
                  </span>
                  {src.box_file_id && (
                    <ExternalLink className="w-3 h-3 text-box-blue/40 group-hover:text-box-blue transition-colors" />
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Timestamp */}
        <p className="text-[9px] text-slate-300 font-medium px-1">
          {message.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
        </p>
      </div>
    </motion.div>
  );
}
