import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Mail, Lock, ArrowRight, ShieldCheck, User, Loader2, CheckCircle2 } from 'lucide-react';

interface AuthScreenProps {
  onUserAuth: () => void;
  onDevAuth:  () => void;
}

export default function AuthScreen({ onUserAuth, onDevAuth }: AuthScreenProps) {
  const [role, setRole] = useState<'user' | 'developer'>('user');
  const [password, setPassword] = useState('');
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      // In a real app, we might check email too, but here we use the admin password logic for the trigger
      const response = await fetch('/api/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password }),
      });

      if (response.ok) {
        setSuccess(true);
        // Simulate a short delay to show "Ingestion Triggered" feel
        setTimeout(() => {
          if (role === 'user') onUserAuth();
          else onDevAuth();
        }, 1500);
      } else {
        const data = await response.json();
        setError(data.detail || 'Invalid credentials');
        setLoading(false);
      }
    } catch (err) {
      setError('Could not connect to authentication server.');
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen bg-[#FDFCFE]">
      {/* Decorative Brand Rail */}
      <div className="flex w-24 flex-col items-center py-12 border-r border-slate-100 shrink-0 bg-white shadow-[inset_-1px_0_0_rgba(0,0,0,0.02)]">
        <div className="flex flex-col items-center gap-2">
           <div className="w-12 h-12 bg-brand-primary rounded-2xl flex items-center justify-center text-white font-black text-2xl shadow-xl shadow-brand-primary/20 rotate-3">E</div>
           <span className="text-brand-primary font-black text-[10px] uppercase tracking-widest mt-2">v1.2</span>
        </div>
      </div>

      {/* Main area */}
      <div className="flex flex-1 items-center justify-center bg-gradient-to-br from-[#F5F1FF] to-white p-6 lg:p-24 relative overflow-hidden">
        {/* Dynamic Background Elements */}
        <div className="absolute top-[-20%] right-[-10%] w-[800px] h-[800px] rounded-full bg-brand-primary/5 blur-[120px] pointer-events-none" />
        <div className="absolute bottom-[-10%] left-[-10%] w-[600px] h-[600px] rounded-full bg-brand-secondary/5 blur-[100px] pointer-events-none" />

        <motion.div
          initial={{ opacity: 0, y: 40 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, ease: "easeOut" }}
          className="flex w-full max-w-6xl bg-white/80 backdrop-blur-xl rounded-[3rem] overflow-hidden shadow-[0_32px_64px_-16px_rgba(84,36,131,0.15)] h-[740px] border border-white"
        >
          {/* Left Side: Visual Experience */}
          <div className="hidden lg:block w-5/12 relative overflow-hidden">
            <div className="absolute inset-0 bg-slate-900">
               <img
                src="https://images.unsplash.com/photo-1522071820081-009f0129c71c?auto=format&fit=crop&q=80&w=2000"
                alt="collaboration"
                className="w-full h-full object-cover opacity-60 scale-110"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-[#120524] via-[#120524]/60 to-transparent" />
            </div>
            
            <div className="absolute inset-0 p-16 flex flex-col justify-end">
              <motion.div 
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.4 }}
                className="space-y-6"
              >
                <div className="inline-flex items-center gap-3 px-4 py-2 bg-white/10 backdrop-blur-md rounded-2xl border border-white/20">
                  <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                  <span className="text-white text-xs font-bold uppercase tracking-widest">System Operational</span>
                </div>
                <h1 className="text-5xl font-black text-white leading-[1.1] tracking-tight">
                  Intelligence for <br/>
                  <span className="text-brand-accent">Ellucian</span> Enterprise.
                </h1>
                <p className="text-slate-300 text-lg leading-relaxed max-w-sm font-medium">
                  Dynamic vector ingestion & multimedia processing across your entire document ecosystem.
                </p>
                <div className="flex items-center gap-6 pt-4 text-white/40">
                   <div className="flex flex-col">
                      <span className="text-2xl font-bold text-white">Gemini</span>
                      <span className="text-[10px] uppercase font-black tracking-tighter">Model LLM</span>
                   </div>
                   <div className="w-px h-8 bg-white/10" />
                   <div className="flex flex-col">
                      <span className="text-2xl font-bold text-white">Chroma</span>
                      <span className="text-[10px] uppercase font-black tracking-tighter">Vector DB</span>
                   </div>
                </div>
              </motion.div>
            </div>
          </div>

          {/* Right Side: Identity Portal */}
          <div className="w-full lg:w-7/12 p-12 lg:p-24 flex flex-col justify-center bg-white relative">
            <AnimatePresence mode="wait">
              {success ? (
                <motion.div
                  key="success"
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className="text-center space-y-6"
                >
                  <div className="w-24 h-24 bg-emerald-100 text-emerald-600 rounded-[2rem] flex items-center justify-center mx-auto shadow-xl shadow-emerald-100">
                    <CheckCircle2 className="w-12 h-12" />
                  </div>
                  <h2 className="text-4xl font-black text-slate-800 tracking-tight">Access Granted</h2>
                  <div className="space-y-2">
                    <p className="text-slate-500 font-medium">Triggering dynamic ingestion pipeline...</p>
                    <div className="w-48 h-1.5 bg-slate-100 rounded-full mx-auto overflow-hidden">
                      <motion.div 
                        initial={{ width: 0 }}
                        animate={{ width: "100%" }}
                        transition={{ duration: 1.5 }}
                        className="h-full bg-emerald-500"
                      />
                    </div>
                  </div>
                </motion.div>
              ) : (
                <motion.div key="form" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-12">
                  <div className="space-y-2">
                    <div className="flex items-center gap-2 mb-2">
                       <span className="text-brand-primary p-1 rounded-lg bg-brand-primary/5">
                          <CheckCircle2 className="w-5 h-5" />
                       </span>
                       <span className="text-[10px] font-black tracking-[0.4em] text-slate-400 uppercase">Secure Identity Portal</span>
                    </div>
                    <h2 className="text-5xl font-black text-slate-900 tracking-tight leading-none">
                      Ellucian <span className="text-brand-primary font-medium tracking-tighter">Agent</span>
                    </h2>
                  </div>

                  {/* Role Switcher */}
                  <div className="flex bg-slate-50 p-1.5 rounded-3xl border border-slate-100 max-w-xs shadow-sm">
                    <button
                      onClick={() => setRole('user')}
                      className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-[1.25rem] transition-all text-sm font-bold ${
                        role === 'user' ? 'bg-white shadow-md text-brand-primary' : 'text-slate-400'
                      }`}
                    >
                      <User className="w-4 h-4" />
                      Employee
                    </button>
                    <button
                      onClick={() => setRole('developer')}
                      className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-[1.25rem] transition-all text-sm font-bold ${
                        role === 'developer' ? 'bg-white shadow-md text-brand-primary' : 'text-slate-400'
                      }`}
                    >
                      <ShieldCheck className="w-4 h-4" />
                      Admin
                    </button>
                  </div>

                  <form className="space-y-6" onSubmit={handleLogin}>
                    <div className="space-y-3">
                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] ml-1">Work Email</label>
                      <div className="relative group">
                        <Mail className="absolute left-6 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-300 group-focus-within:text-brand-primary transition-colors" />
                        <input
                          type="email"
                          value={email}
                          onChange={(e) => setEmail(e.target.value)}
                          placeholder="j.smith@ellucian.edu"
                          required
                          className="w-full pl-16 pr-6 py-5 bg-slate-50 border border-slate-100 rounded-2xl focus:bg-white focus:ring-[6px] focus:ring-brand-primary/5 focus:border-brand-primary outline-none transition-all font-medium text-slate-700 placeholder:text-slate-300"
                        />
                      </div>
                    </div>

                    <div className="space-y-3">
                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] ml-1">Access Token</label>
                      <div className="relative group">
                        <Lock className="absolute left-6 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-300 group-focus-within:text-brand-primary transition-colors" />
                        <input
                          type="password"
                          value={password}
                          onChange={(e) => setPassword(e.target.value)}
                          placeholder="••••••••••••"
                          required
                          className="w-full pl-16 pr-6 py-5 bg-slate-50 border border-slate-100 rounded-2xl focus:bg-white focus:ring-[6px] focus:ring-brand-primary/5 focus:border-brand-primary outline-none transition-all font-medium text-slate-700 placeholder:text-slate-300"
                        />
                      </div>
                    </div>

                    {error && (
                      <motion.div initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} className="p-4 bg-rose-50 text-rose-600 rounded-2xl text-xs font-bold border border-rose-100">
                        {error}
                      </motion.div>
                    )}

                    <button
                      type="submit"
                      disabled={loading}
                      className="w-full bg-brand-primary text-white py-6 rounded-[1.5rem] flex items-center justify-center gap-3 font-bold shadow-2xl shadow-brand-primary/30 hover:bg-brand-secondary transition-all active:scale-[0.98] group relative overflow-hidden"
                    >
                      {loading ? (
                        <Loader2 className="w-6 h-6 animate-spin" />
                      ) : (
                        <>
                          <span className="text-lg">Authorize Access</span>
                          <ArrowRight className="w-5 h-5 group-hover:translate-x-2 transition-transform" />
                        </>
                      )}
                    </button>
                  </form>

                  <div className="pt-4 text-center">
                    <span className="text-[9px] font-black tracking-[0.3em] text-slate-300 uppercase">
                      Enterprise Grade Retrieval · Verified Ellucian Environment
                    </span>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </motion.div>
      </div>
    </div>
  );
}
