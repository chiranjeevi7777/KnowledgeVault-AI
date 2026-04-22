import { useState } from 'react';
import { motion } from 'motion/react';
import { Mail, Lock, ArrowRight, ShieldCheck, User } from 'lucide-react';

interface AuthScreenProps {
  onUserAuth: () => void;
  onDevAuth:  () => void;
}

export default function AuthScreen({ onUserAuth, onDevAuth }: AuthScreenProps) {
  const [role, setRole] = useState<'user' | 'developer'>('user');

  return (
    <div className="flex min-h-screen bg-white">
      {/* Decorative Brand Rail */}
      <div className="flex w-24 flex-col items-center py-12 border-r border-slate-100 shrink-0 bg-slate-50/50">
        <div className="flex flex-col items-center gap-1 opacity-80">
          <span className="text-box-blue font-black text-xl tracking-tighter">Box</span>
        </div>
      </div>

      {/* Main area */}
      <div className="flex flex-1 items-center justify-center bg-[#E8F0FD] p-12 lg:p-24 relative overflow-hidden text-slate-800">
        {/* Decorative circles */}
        <div className="absolute top-[-10%] right-[-5%] w-[500px] h-[500px] rounded-full bg-box-blue/5 blur-3xl pointer-events-none" />
        <div className="absolute bottom-[-10%] left-[-5%] w-[400px] h-[400px] rounded-full bg-box-blue/10 blur-3xl pointer-events-none" />

        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex w-full max-w-6xl bg-white rounded-[2.5rem] overflow-hidden shadow-2xl h-[700px] border border-white/20"
        >
          {/* Left Visual */}
          <div className="hidden lg:block w-1/2 relative bg-slate-900 overflow-hidden">
            <img
              src="https://images.unsplash.com/photo-1497215728101-856f4ea42174?auto=format&fit=crop&q=80&w=1200"
              alt="workspace"
              className="w-full h-full object-cover opacity-50 scale-105"
              referrerPolicy="no-referrer"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-slate-900 via-slate-900/40 to-transparent flex flex-col justify-end p-16">
              <div className="flex items-center gap-3 mb-4">
                <div className="p-2 bg-box-blue rounded-xl">
                  {/* Box logo mark */}
                  <svg className="w-6 h-6 text-white" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M12 2C6.477 2 2 6.477 2 12s4.477 10 10 10 10-4.477 10-10S17.523 2 12 2zm0 3a7 7 0 110 14A7 7 0 0112 5zm0 2a5 5 0 100 10A5 5 0 0012 7zm0 2a3 3 0 110 6 3 3 0 010-6z"/>
                  </svg>
                </div>
                <span className="text-white font-bold text-2xl tracking-tighter">Box Agent</span>
              </div>
              <p className="text-slate-300 text-lg leading-relaxed max-w-sm font-medium">
                Enterprise intelligence across every Box folder and file — powered by Gemini AI.
              </p>
            </div>
          </div>

          {/* Login Form */}
          <div className="w-full lg:w-1/2 p-12 lg:p-20 flex flex-col justify-center bg-white">
            <div className="mb-14 space-y-8">
              <div className="flex flex-col gap-0 border-b border-slate-50 pb-6">
                <span className="text-box-blue font-black text-4xl tracking-tighter leading-none">Box</span>
                <span className="text-slate-400 text-[10px] font-black tracking-[0.4em] uppercase leading-none mt-2">
                  Identity Portal
                </span>
              </div>

              {/* Role switcher */}
              <div className="flex bg-slate-50 p-1.5 rounded-2xl border border-slate-100 max-w-sm">
                <button
                  onClick={() => setRole('user')}
                  className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-xl transition-all text-xs font-bold ${
                    role === 'user' ? 'bg-white shadow-sm text-box-blue' : 'text-slate-400'
                  }`}
                >
                  <User className="w-4 h-4" />
                  Employee
                </button>
                <button
                  onClick={() => setRole('developer')}
                  className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-xl transition-all text-xs font-bold ${
                    role === 'developer' ? 'bg-white shadow-sm text-box-blue' : 'text-slate-400'
                  }`}
                >
                  <ShieldCheck className="w-4 h-4" />
                  Developer
                </button>
              </div>

              <h2 className="text-2xl font-medium text-slate-700">
                {role === 'user' ? 'Direct Retrieval Access' : 'Admin Authorization'}
              </h2>
            </div>

            <form
              className="space-y-6"
              onSubmit={(e) => { e.preventDefault(); role === 'user' ? onUserAuth() : onDevAuth(); }}
            >
              <div className="space-y-2">
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest pl-1">
                  Corporate Email
                </label>
                <div className="relative group">
                  <Mail className="absolute left-5 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-300 group-focus-within:text-box-blue transition-colors" />
                  <input
                    type="email"
                    placeholder="name@yourcompany.com"
                    className="w-full pl-14 pr-6 py-4 bg-slate-50/50 border border-slate-100 rounded-2xl focus:bg-white focus:ring-4 focus:ring-box-blue/5 focus:border-box-blue outline-none transition-all placeholder:text-slate-300"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest pl-1">
                  Passkey
                </label>
                <div className="relative group">
                  <Lock className="absolute left-5 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-300 group-focus-within:text-box-blue transition-colors" />
                  <input
                    type="password"
                    placeholder="••••••••"
                    className="w-full pl-14 pr-6 py-4 bg-slate-50/50 border border-slate-100 rounded-2xl focus:bg-white focus:ring-4 focus:ring-box-blue/5 focus:border-box-blue outline-none transition-all placeholder:text-slate-300"
                  />
                </div>
              </div>

              <button
                type="submit"
                className="w-full bg-box-blue text-white py-5 rounded-2xl flex items-center justify-center gap-4 font-bold shadow-xl shadow-blue-100 hover:bg-blue-700 transition-all active:scale-[0.98] group mt-6 text-lg"
              >
                Access Box Agent
                <ArrowRight className="w-5 h-5 group-hover:translate-x-1.5 transition-transform" />
              </button>
            </form>

            <div className="mt-12 text-center">
              <span className="text-[9px] font-black tracking-[0.3em] text-slate-300 uppercase">
                Secured by Box Platform · Powered by Gemini AI
              </span>
            </div>
          </div>
        </motion.div>
      </div>
    </div>
  );
}
