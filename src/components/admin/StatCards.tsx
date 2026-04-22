import { useEffect, useState, useCallback } from 'react';
import { Activity, BarChart3, Users, FileStack, ShieldAlert, Zap } from 'lucide-react';

interface Stats {
  indexed_files:   number;
  total_chunks:    number;
  last_indexed:    string | null;
  pipeline_status: string;
  files_processed: number;
  total_queries:   number;
  llm_model:       string;
}

const DEFAULT_STATS: Stats = {
  indexed_files:   0,
  total_chunks:    0,
  last_indexed:    null,
  pipeline_status: 'idle',
  files_processed: 0,
  total_queries:   0,
  llm_model:       'Loading...',
};

export default function StatCards() {
  const [stats,   setStats]   = useState<Stats>(DEFAULT_STATS);
  const [loading, setLoading] = useState(true);

  const fetchStats = useCallback(async () => {
    try {
      const res  = await fetch('/api/stats');
      const data = await res.json();
      setStats(data);
    } catch {
      // Backend offline — keep defaults
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchStats();
    const interval = setInterval(fetchStats, 15_000); // refresh every 15s
    return () => clearInterval(interval);
  }, [fetchStats]);

  const cards = [
    {
      label:  'Indexed Files',
      value:  loading ? '—' : stats.indexed_files.toLocaleString(),
      change: stats.pipeline_status === 'completed' ? '✓ Indexed' : stats.pipeline_status,
      icon:   FileStack,
      color:  'text-blue-600',
      bg:     'bg-blue-50',
      positive: true,
    },
    {
      label:  'Total Chunks',
      value:  loading ? '—' : stats.total_chunks.toLocaleString(),
      change: 'Embeddings',
      icon:   Activity,
      color:  'text-indigo-600',
      bg:     'bg-indigo-50',
      positive: true,
    },
    {
      label:  'Vector DB',
      value:  'ChromaDB',
      change: 'Local',
      icon:   Zap,
      color:  'text-emerald-600',
      bg:     'bg-emerald-50',
      positive: true,
    },
    {
      label:  'LLM Model',
      value:  'Bedrock',
      change: stats.llm_model,
      icon:   BarChart3,
      color:  'text-purple-600',
      bg:     'bg-purple-50',
      positive: true,
    },
    {
      label:  'Total Queries',
      value:  loading ? '—' : stats.total_queries.toLocaleString(),
      change: 'SQLite',
      icon:   Users,
      color:  'text-amber-600',
      bg:     'bg-amber-50',
      positive: true,
    },
    {
      label:  'Pipeline Status',
      value:  loading ? '…' : stats.pipeline_status,
      change: stats.last_indexed
        ? new Date(stats.last_indexed).toLocaleDateString()
        : 'Never run',
      icon:   ShieldAlert,
      color:  stats.pipeline_status === 'error' ? 'text-rose-600' : 'text-emerald-600',
      bg:     stats.pipeline_status === 'error' ? 'bg-rose-50'   : 'bg-emerald-50',
      positive: stats.pipeline_status !== 'error',
    },
  ];

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-6">
      {cards.map((stat, idx) => (
        <div key={idx} className="bg-white p-6 rounded-[2rem] border border-slate-100 shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between mb-4">
            <div className={`w-10 h-10 ${stat.bg} ${stat.color} rounded-xl flex items-center justify-center`}>
              <stat.icon className="w-5 h-5" />
            </div>
            <span className={`text-xs font-bold ${stat.positive ? 'text-emerald-500' : 'text-rose-500'} capitalize`}>
              {stat.change}
            </span>
          </div>
          <div>
            <p className="text-2xl font-bold text-slate-800 tracking-tight capitalize">{stat.value}</p>
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">{stat.label}</p>
          </div>
        </div>
      ))}
    </div>
  );
}
