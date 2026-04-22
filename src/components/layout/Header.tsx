import { User, ShieldCheck } from 'lucide-react';

interface HeaderProps {
  mode: 'user' | 'developer';
  setMode: (mode: 'user' | 'developer') => void;
  isDevLocked: boolean;
}

export default function Header({ mode, setMode, isDevLocked }: HeaderProps) {
  return (
    <div className="absolute top-8 right-12 z-50 flex bg-white/80 backdrop-blur-md p-1 rounded-xl border border-slate-200/60 shadow-sm">
      <button 
        onClick={() => setMode('user')}
        className={`flex items-center gap-2 px-4 py-1.5 text-sm rounded-lg transition-all ${
          mode === 'user' 
            ? 'bg-white text-ellucian-purple shadow-sm font-semibold border border-slate-100' 
            : 'text-slate-500 hover:text-slate-800'
        }`}
      >
        <User className="w-4 h-4" />
        User Mode
      </button>
      <button 
        onClick={() => setMode('developer')}
        className={`flex items-center gap-2 px-4 py-1.5 text-sm rounded-lg transition-all relative ${
          mode === 'developer' 
            ? 'bg-white text-ellucian-purple shadow-sm font-semibold border border-slate-100' 
            : 'text-slate-500 hover:text-slate-800'
        }`}
      >
        <ShieldCheck className="w-4 h-4" />
        Developer
        {isDevLocked && <div className="absolute -top-1 -right-1 w-2 h-2 bg-rose-500 rounded-full border border-white" />}
      </button>
    </div>
  );
}
