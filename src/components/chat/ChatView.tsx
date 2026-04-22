import { useEffect, useRef } from 'react';
import { motion } from 'motion/react';
import { Bot } from 'lucide-react';
import ChatMessage, { Message } from './ChatMessage';

interface ChatViewProps {
  messages:  Message[];
  isLoading: boolean;
}

function TypingIndicator() {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="flex gap-4 items-start"
    >
      <div className="w-9 h-9 rounded-2xl bg-box-blue flex items-center justify-center shrink-0 shadow-sm">
        <Bot className="w-4 h-4 text-white" />
      </div>
      <div className="bg-white border border-slate-100 shadow-sm px-5 py-4 rounded-3xl rounded-tl-md flex items-center gap-1.5">
        {[0, 1, 2].map((i) => (
          <motion.div
            key={i}
            className="w-2 h-2 bg-slate-300 rounded-full"
            animate={{ y: [0, -6, 0] }}
            transition={{
              duration: 0.8,
              repeat: Infinity,
              delay: i * 0.15,
              ease: 'easeInOut',
            }}
          />
        ))}
      </div>
    </motion.div>
  );
}

export default function ChatView({ messages, isLoading }: ChatViewProps) {
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isLoading]);

  return (
    <div className="flex-1 overflow-y-auto px-12 py-8 space-y-6 scroll-smooth">
      <div className="max-w-4xl mx-auto space-y-6">
        {messages.map((msg) => (
          <div key={msg.id}>
            <ChatMessage message={msg} />
          </div>
        ))}
        {isLoading && <TypingIndicator />}
        <div ref={bottomRef} />
      </div>
    </div>
  );
}
