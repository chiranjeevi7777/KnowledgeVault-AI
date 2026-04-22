import { CheckCircle2, AlertCircle, HelpCircle, ChevronDown, ChevronUp } from 'lucide-react';
import { useState, useEffect, useCallback } from 'react';

interface QueryItem {
  id:      string;
  query:   string;
  mode:    string;
  score:   number;
  sources: number;
  result:  string;
  time:    string;
}

export default function QueryHistory() {
  const [history,    setHistory]    = useState<QueryItem[]>([]);
  const [showAll,    setShowAll]    = useState(false);
  const [loading,    setLoading]    = useState(true);

  const fetchHistory = useCallback(async () => {
    try {
      const res  = await fetch('/api/history/queries');
      const data = await res.json();
      if (data.history) setHistory(data.history);
    } catch (err) {
      console.error('Failed to load query history:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchHistory();
    const interval = setInterval(fetchHistory, 15_000);
    return () => clearInterval(interval);
  }, [fetchHistory]);

  const displayed = showAll ? history : history.slice(0, 10);

  return (
    <div className="bg-white rounded-[2rem] p-10 border border-slate-100 shadow-sm space-y-8">
      <div className="flex items-center justify-between">
        <div className="space-y-1">
          <h3 className="text-2xl font-bold text-slate-800 tracking-tight">Recent Queries &amp; Retrieval Performance</h3>
          <p className="text-slate-400 font-medium">Analyze how the agent interprets and sources information.</p>
        </div>
        <button
          id="toggle-all-sessions-btn"
          onClick={() => setShowAll(!showAll)}
          className="flex items-center gap-2 text-indigo-600 text-sm font-bold hover:underline transition-colors"
        >
          {showAll ? (
            <><ChevronUp className="w-4 h-4" /> Show Less</>
          ) : (
            <><ChevronDown className="w-4 h-4" /> View All Sessions ({history.length})</>
          )}
        </button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-12 text-slate-400">
          <span className="text-sm font-medium">Loading query history…</span>
        </div>
      ) : history.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-12 text-slate-300 space-y-2">
          <HelpCircle className="w-8 h-8" />
          <p className="text-sm font-semibold">No queries yet. Ask the agent something!</p>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="text-left border-b border-slate-50">
                <th className="pb-6 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] px-4">User Query</th>
                <th className="pb-6 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] px-4">Mode</th>
                <th className="pb-6 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] px-4">Confidence</th>
                <th className="pb-6 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] px-4">Result</th>
                <th className="pb-6 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] px-4 text-right">Time</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {displayed.map((item) => (
                <tr key={item.id} className="group hover:bg-slate-50/50 transition-colors">
                  <td className="py-6 px-4 max-w-sm">
                    <div className="space-y-1">
                      <p className="font-bold text-slate-800 line-clamp-1">{item.query}</p>
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] text-slate-400">{item.sources} source{item.sources !== 1 ? 's' : ''} identified</span>
                      </div>
                    </div>
                  </td>
                  <td className="py-6 px-4">
                    <span className={`px-2 py-0.5 rounded text-[10px] font-black ${item.mode === 'RAG' ? 'bg-indigo-100 text-indigo-700' : 'bg-slate-200 text-slate-600'}`}>
                      {item.mode}
                    </span>
                  </td>
                  <td className="py-6 px-4">
                    <div className="flex items-center gap-3">
                      <div className="flex-1 w-24 bg-slate-100 h-2 rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full ${item.score > 0.8 ? 'bg-emerald-400' : item.score > 0.6 ? 'bg-amber-400' : 'bg-rose-400'}`}
                          style={{ width: `${Math.min(item.score * 100, 100)}%` }}
                        />
                      </div>
                      <span className="text-xs font-bold text-slate-600">{Math.round(item.score * 100)}%</span>
                    </div>
                  </td>
                  <td className="py-6 px-4">
                    <div className="flex items-center gap-2">
                      {item.result === 'Success' ? (
                        <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                      ) : item.result === 'Fallback' ? (
                        <HelpCircle className="w-4 h-4 text-amber-500" />
                      ) : (
                        <AlertCircle className="w-4 h-4 text-slate-400" />
                      )}
                      <span className="text-sm font-semibold text-slate-600">{item.result}</span>
                    </div>
                  </td>
                  <td className="py-6 px-4 text-right">
                    <p className="text-xs font-bold text-slate-400 uppercase">{item.time}</p>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {!showAll && history.length > 10 && (
            <div className="pt-4 text-center">
              <button
                onClick={() => setShowAll(true)}
                className="text-sm text-indigo-600 font-bold hover:underline"
              >
                + {history.length - 10} more sessions
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
