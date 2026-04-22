import { useEffect, useState, useCallback } from 'react';
import { Terminal, ShieldAlert, Bug, Info, RefreshCw, Loader2 } from 'lucide-react';

interface LogEntry {
  time:  string;
  level: 'INFO' | 'DEBUG' | 'WARN' | 'ERROR';
  msg:   string;
}

export default function LogsPanel() {
  const [logs,       setLogs]       = useState<LogEntry[]>([]);
  const [loading,    setLoading]    = useState(false);
  const [autoRefresh, setAutoRefresh] = useState(true);

  const fetchLogs = useCallback(async () => {
    setLoading(true);
    try {
      const res  = await fetch('/api/logs');
      const data = await res.json();
      if (data.logs?.length) setLogs(data.logs.slice().reverse());
    } catch {
      // Backend offline — show placeholder
      setLogs([{
        time:  new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
        level: 'WARN',
        msg:   'Backend not reachable. Start FastAPI with: cd backend && uvicorn main:app --reload --port 8000',
      }]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchLogs();
    if (!autoRefresh) return;
    const interval = setInterval(fetchLogs, 5_000);
    return () => clearInterval(interval);
  }, [fetchLogs, autoRefresh]);

  const levelColor = (level: string) =>
    level === 'ERROR' ? 'text-rose-500'   :
    level === 'WARN'  ? 'text-amber-500'  :
    level === 'DEBUG' ? 'text-indigo-400' :
    'text-emerald-500';

  return (
    <div className="bg-[#12161F] rounded-[2rem] p-10 border border-slate-800 shadow-xl space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-slate-800 rounded-xl flex items-center justify-center text-indigo-400">
            <Terminal className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-xl font-bold text-white tracking-tight">Real-time System Logs</h3>
            <p className="text-slate-500 font-medium text-sm">Box Agent pipeline events and health.</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setAutoRefresh(!autoRefresh)}
            className={`px-3 py-1.5 rounded-lg text-[10px] font-bold uppercase tracking-widest transition-colors ${
              autoRefresh ? 'bg-emerald-900 text-emerald-400 border border-emerald-800' : 'bg-slate-800 text-slate-400 border border-slate-700'
            }`}
          >
            {autoRefresh ? 'Live' : 'Paused'}
          </button>
          <button
            onClick={fetchLogs}
            className="p-3 bg-slate-800 text-slate-400 rounded-xl hover:text-white transition-colors"
          >
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
          </button>
        </div>
      </div>

      <div className="bg-black/50 rounded-2xl p-6 font-mono text-xs space-y-3 max-h-[400px] overflow-y-auto">
        {logs.length === 0 ? (
          <span className="text-slate-600">No logs yet. Run the ingestion pipeline to see activity.</span>
        ) : (
          logs.map((log, idx) => (
            <div key={idx} className="flex gap-4">
              <span className="text-slate-600 shrink-0">[{log.time}]</span>
              <span className={`font-bold shrink-0 w-12 ${levelColor(log.level)}`}>{log.level}</span>
              <span className="text-slate-300">{log.msg}</span>
            </div>
          ))
        )}
      </div>

      <div className="flex items-center gap-6 pt-4 border-t border-slate-800">
        <div className="flex items-center gap-2">
          <Info className="w-3 h-3 text-emerald-500" />
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
            {logs.filter(l => l.level === 'INFO').length} Info
          </span>
        </div>
        <div className="flex items-center gap-2">
          <ShieldAlert className="w-3 h-3 text-rose-500" />
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
            {logs.filter(l => l.level === 'ERROR').length} Error(s)
          </span>
        </div>
        <div className="flex items-center gap-2">
          <Bug className="w-3 h-3 text-indigo-500" />
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
            {logs.filter(l => l.level === 'DEBUG').length} Debug
          </span>
        </div>
      </div>
    </div>
  );
}
