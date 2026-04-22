import { motion } from 'motion/react';

export default function WelcomeState() {
  return (
    <div className="flex-1 flex flex-col items-center justify-center p-8 text-center max-w-4xl mx-auto w-full relative">
       {/* Background Watermark */}
       <div className="absolute inset-0 flex items-center justify-center pointer-events-none select-none overflow-hidden opacity-40">
          <div className="relative">
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] border border-slate-100 rounded-[4rem] rotate-12" />
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[400px] h-[400px] border border-slate-100 rounded-[3.5rem] -rotate-6" />
            <span className="text-slate-100 font-black text-[140px] tracking-tighter opacity-50 block">BOX</span>
          </div>
       </div>

       <motion.div
         initial={{ opacity: 0, y: 15 }}
         animate={{ opacity: 1, y: 0 }}
         transition={{ duration: 0.8, ease: "easeOut" }}
         className="relative z-10 space-y-10"
       >
         <div className="flex items-center justify-center gap-6 mb-12">
             <div className="flex flex-col items-end">
                <span className="text-slate-200 font-bold text-3xl tracking-tighter leading-none">Secure</span>
                <span className="text-slate-400 text-[8px] font-black tracking-[0.3em] uppercase mt-1">Intelligence</span>
             </div>
             <div className="w-px h-12 bg-slate-100" />
             <div className="flex flex-col items-start px-4 py-2 bg-blue-50/50 rounded-2xl border border-blue-100/30">
                <span className="text-box-blue font-bold text-3xl tracking-tighter leading-none">Box</span>
                <span className="text-box-blue/60 text-[8px] font-black tracking-[0.3em] uppercase mt-1">Retrieval Agent</span>
             </div>
         </div>
         
         <div className="space-y-6 text-slate-800">
             <h1 className="text-6xl font-bold tracking-tight leading-[1.1] balance">
                 Search smarter across every Box folder.
             </h1>
             <p className="text-xl text-slate-500 max-w-2xl mx-auto balance leading-relaxed">
                 Unlock instant document intelligence. I retrieve files, transcripts, and media directly from your Box folder and answer your questions using AI.
             </p>
         </div>
       </motion.div>
    </div>
  );
}
