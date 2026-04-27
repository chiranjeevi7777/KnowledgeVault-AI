import { useState, useEffect, useCallback } from 'react';
import {
  ToggleLeft, ToggleRight, Heart, ShieldCheck, Activity, Clock,
  PlayCircle, Loader2, CheckCircle2, AlertCircle, Trash2, RefreshCw, XCircle, Key, Server
} from 'lucide-react';

interface IngestionStatus {
  status:          string;
  progress:        number;
  message:         string;
  files_processed: number;
  total_files:     number;
  total_chunks:    number;
  started_at:      string | null;
  completed_at:    string | null;
  error:           string | null;
}

interface EnvStatus {
  box_auth:      boolean;
  box_folder:    string | null;
  bedrock_auth:  boolean;
  bedrock_model: string;
  aws_region:    string;
  whisper:       string;
  chroma:        string;
}

export default function SystemControlPanel() {
  const [ragMode,    setRagMode]    = useState(true);
  const [apiMode,    setApiMode]    = useState(false);
  const [status,     setStatus]     = useState<IngestionStatus | null>(null);
  const [env,        setEnv]        = useState<EnvStatus | null>(null);
  const [triggering, setTriggering] = useState(false);
  const [clearing,   setClearing]   = useState(false);
  const [clearMsg,   setClearMsg]   = useState<string | null>(null);

  const fetchStatus = useCallback(async () => {
    try {
      const res  = await fetch('/api/ingest/status');
      const data = await res.json();
      setStatus(data);
    } catch { /* Backend offline */ }
  }, []);

  const fetchEnv = useCallback(async () => {
    try {
      const res  = await fetch('/api/health/env');
      const data = await res.json();
      setEnv(data);
    } catch { /* Backend offline */ }
  }, []);

  useEffect(() => {
    fetchStatus();
    fetchEnv();
    const interval = setInterval(fetchStatus, 3_000);
    return () => clearInterval(interval);
  }, [fetchStatus, fetchEnv]);

  const triggerIngest = async () => {
    setTriggering(true);
    setClearMsg(null);
    try {
      await fetch('/api/ingest', { method: 'POST' });
      await fetchStatus();
    } catch {
      alert('Could not reach the backend. Make sure FastAPI is running on port 8000.');
    } finally {
      setTriggering(false);
    }
  };

  const clearAndReingest = async () => {
    if (!window.confirm('This will DELETE all indexed embeddings and re-ingest everything from Box. Continue?')) return;
    setClearing(true);
    setClearMsg(null);
    try {
      const res  = await fetch('/api/ingest/clear', { method: 'POST' });
      const data = await res.json();
      setClearMsg(data.message || 'Re-ingestion started.');
      await fetchStatus();
    } catch {
      setClearMsg('Could not clear collection — is the backend running?');
    } finally {
      setClearing(false);
    }
  };

  const isRunning  = status?.status === 'running';
  const isBusy     = isRunning || triggering || clearing;

  // Derive real connectivity status from env
  const boxAuthOk  = env?.box_auth ?? false;
  const chromaOk   = !!(env?.chroma);
  const whisperModel = env?.whisper || 'base';

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
      {/* ── Retrieval Strategy Toggles ── */}
      <div className="lg:col-span-2 bg-white rounded-[2rem] p-8 border border-slate-100 shadow-sm space-y-8">
        <div className="flex items-center justify-between border-b border-slate-50 pb-6">
          <div className="space-y-1">
            <h3 className="text-xl font-bold text-slate-800">Retrieval Strategies</h3>
            <p className="text-sm text-slate-400 font-medium">Toggle between RAG and direct API access fallback.</p>
          </div>
          <div className="flex items-center gap-2 px-4 py-2 bg-emerald-50 text-emerald-600 rounded-xl border border-emerald-100">
            <ShieldCheck className="w-4 h-4" />
            <span className="text-[10px] font-bold uppercase tracking-tight">
              Active: {ragMode ? 'RAG' : apiMode ? 'Direct API' : 'None'}
            </span>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          {/* RAG Toggle */}
          <div className={`p-6 rounded-[1.5rem] border transition-all ${ragMode ? 'bg-blue-50/50 border-blue-100' : 'bg-slate-50 border-slate-100'}`}>
            <div className="flex items-center justify-between mb-4">
              <div className={`p-3 rounded-xl ${ragMode ? 'bg-box-blue text-white shadow-lg shadow-blue-100' : 'bg-slate-200 text-slate-400'}`}>
                <Activity className="w-6 h-6" />
              </div>
              <button
                onClick={() => { setRagMode(!ragMode); }}
                className={`transition-colors ${ragMode ? 'text-box-blue' : 'text-slate-300'}`}
                title="Toggle RAG mode"
              >
                {ragMode ? <ToggleRight className="w-12 h-12" /> : <ToggleLeft className="w-12 h-12" />}
              </button>
            </div>
            <h4 className="font-bold text-slate-800 text-lg">RAG Approach</h4>
            <p className="text-sm text-slate-500 mt-1 leading-relaxed">
              Uses sentence-transformer embeddings + semantic ChromaDB search across indexed Box files.
            </p>
            <div className="mt-4 flex items-center gap-2">
              <span className={`w-2 h-2 rounded-full ${ragMode ? 'bg-emerald-500 animate-pulse' : 'bg-slate-300'}`} />
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{ragMode ? 'Active' : 'Disabled'}</span>
            </div>
          </div>

          {/* Direct API Toggle */}
          <div className={`p-6 rounded-[1.5rem] border transition-all ${apiMode ? 'bg-blue-50/50 border-blue-100' : 'bg-slate-50 border-slate-100'}`}>
            <div className="flex items-center justify-between mb-4">
              <div className={`p-3 rounded-xl ${apiMode ? 'bg-box-blue text-white shadow-lg shadow-blue-100' : 'bg-slate-200 text-slate-400'}`}>
                <ShieldCheck className="w-6 h-6" />
              </div>
              <button
                onClick={() => { setApiMode(!apiMode); }}
                className={`transition-colors ${apiMode ? 'text-box-blue' : 'text-slate-300'}`}
                title="Toggle direct Box API fallback"
              >
                {apiMode ? <ToggleRight className="w-12 h-12" /> : <ToggleLeft className="w-12 h-12" />}
              </button>
            </div>
            <h4 className="font-bold text-slate-800 text-lg">Direct API Fallback</h4>
            <p className="text-sm text-slate-500 mt-1 leading-relaxed">
              Direct keyword search via Box Content APIs for precise file and folder matching.
            </p>
            <div className="mt-4 flex items-center gap-2">
              <span className={`w-2 h-2 rounded-full ${apiMode ? 'bg-amber-500 animate-pulse' : 'bg-slate-300'}`} />
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{apiMode ? 'Standby' : 'Disabled'}</span>
            </div>
          </div>
        </div>

        {/* Environment status strip — real data from /api/health/env */}
        <div className="border-t border-slate-50 pt-6 grid grid-cols-1 sm:grid-cols-3 gap-4">
          {[
            {
              icon: boxAuthOk ? ShieldCheck : XCircle,
              label: 'Box Auth Token',
              value: boxAuthOk ? 'Active' : 'Missing / Expired',
              ok: boxAuthOk,
            },
            {
              icon: chromaOk ? Activity : XCircle,
              label: 'ChromaDB',
              value: chromaOk ? (env?.chroma ?? 'Local') : 'Unavailable',
              ok: chromaOk,
            },
            {
              icon: Clock,
              label: 'Whisper Model',
              value: env ? whisperModel : 'Loading…',
              ok: true,
            },
          ].map((item, i) => (
            <div key={i} className="flex items-center gap-3 p-4 bg-slate-50 rounded-2xl border border-slate-100">
              <div className={`p-2 rounded-xl ${item.ok ? 'bg-emerald-50 text-emerald-500' : 'bg-rose-50 text-rose-500'}`}>
                <item.icon className="w-4 h-4" />
              </div>
              <div className="min-w-0">
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">{item.label}</p>
                <p className={`text-xs font-bold truncate ${item.ok ? 'text-slate-700' : 'text-rose-500'}`}>{item.value}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* ── Ingestion Control Card ── */}
      <div className="bg-white rounded-[2rem] p-8 border border-slate-100 shadow-sm flex flex-col justify-between">
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="font-bold text-slate-800 text-lg">Ingestion Pipeline</h3>
            <Heart className="w-5 h-5 text-rose-500 fill-rose-500 animate-pulse" />
          </div>

          {/* Progress bar — only shown when pipeline has run */}
          {status && status.status !== 'idle' && (
            <div className="space-y-2 pt-2">
              <div className="flex justify-between items-center">
                <span className="text-[10px] text-slate-400 uppercase font-bold tracking-wide truncate max-w-[180px]">
                  {status.message}
                </span>
                <span className="text-[10px] font-bold text-slate-500">{status.progress}%</span>
              </div>
              <div className="w-full bg-slate-100 rounded-full h-2">
                <div
                  className={`h-2 rounded-full transition-all duration-500 ${
                    status.status === 'error'     ? 'bg-rose-400'    :
                    status.status === 'completed' ? 'bg-emerald-400' :
                    'bg-box-blue animate-pulse'
                  }`}
                  style={{ width: `${status.progress}%` }}
                />
              </div>
              <div className="flex items-center gap-2">
                {status.status === 'completed' && <CheckCircle2 className="w-3 h-3 text-emerald-500" />}
                {status.status === 'error'     && <AlertCircle  className="w-3 h-3 text-rose-500" />}
                {status.status === 'running'   && <Loader2      className="w-3 h-3 text-box-blue animate-spin" />}
                <span className="text-[10px] text-slate-400">
                  {status.files_processed}/{status.total_files || '?'} files
                  {status.total_chunks ? ` · ${status.total_chunks} chunks` : ''}
                </span>
              </div>
              {status.error && (
                <p className="text-[10px] text-rose-500 break-words">{status.error}</p>
              )}
            </div>
          )}

          {/* Idle placeholder */}
          {(!status || status.status === 'idle') && (
            <p className="text-sm text-slate-400 pt-2">
              No ingestion has run yet.
            </p>
          )}

          {/* Clear message */}
          {clearMsg && (
            <p className="text-[10px] text-emerald-600 font-bold bg-emerald-50 rounded-xl px-3 py-2">{clearMsg}</p>
          )}
        </div>

        <div className="space-y-6 mt-6">
          <div className="p-5 bg-brand-primary/5 border border-brand-primary/10 rounded-[1.5rem] space-y-3">
             <div className="flex items-center gap-2 text-brand-primary font-bold">
                <Activity className="w-5 h-5" />
                <span className="text-sm">Automated Pipeline</span>
             </div>
             <p className="text-xs text-slate-500 leading-relaxed">
               Dynamic ingestion is now <strong>active</strong>. The system automatically scans and indexes new Box files whenever an authorized user logs into the portal.
             </p>
          </div>

          <div className="p-5 bg-emerald-50 border border-emerald-100 rounded-[1.5rem] space-y-3">
             <div className="flex items-center gap-2 text-emerald-600 font-bold">
                <ShieldCheck className="w-5 h-5" />
                <span className="text-sm">Multimedia Processing</span>
             </div>
             <p className="text-xs text-slate-500 leading-relaxed">
               Whisper transcription is enabled for <code>.mp3</code> and <code>.mp4</code> files found in the source directory.
             </p>
          </div>

          {/* Refresh env */}
          <button
            onClick={() => { fetchEnv(); fetchStatus(); }}
            className="w-full py-4 bg-slate-900 text-white rounded-2xl font-bold hover:bg-brand-primary transition-all flex items-center justify-center gap-2 text-sm shadow-xl shadow-slate-100 shadow-brand-primary/5 active:scale-95"
          >
            <RefreshCw className="w-4 h-4" /> Refresh System Status
          </button>
        </div>
      </div>
    </div>
  );
}
