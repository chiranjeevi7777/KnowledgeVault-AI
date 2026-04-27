import { useEffect } from 'react';
import StatCards from './StatCards';
import SystemControlPanel from './SystemControlPanel';
import ChartsPanel from './ChartsPanel';
import EnvironmentPanel from './EnvironmentPanel';
import QueryHistory from './QueryHistoryPanel';
import LogsPanel from './LogsPanel';

export default function AdminDashboard() {
  // Trigger dynamic ingestion whenever developer opens the console
  useEffect(() => {
    fetch('/api/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password: '' }),
    }).catch(console.error);
  }, []);

  return (
    <div className="flex-1 flex flex-col h-screen bg-slate-50 relative overflow-y-auto p-12 space-y-12">
      {/* Page Header */}
      <div className="flex flex-col space-y-2">
        <div className="flex items-center gap-3">
           <h1 className="text-4xl font-bold text-slate-900 tracking-tight">Ellucian Agent Dashboard</h1>
           <span className="px-3 py-1 bg-blue-100 text-ellucian-purple rounded-lg text-[10px] font-black uppercase tracking-widest mt-1">Admin</span>
        </div>
        <p className="text-lg text-slate-500 font-medium max-w-4xl">
           Complete observability into retrieval patterns, folder mapping, and agent performance across the Ellucian Box instance.
        </p>
      </div>

      {/* Top Level Metrics */}
      <section className="space-y-6">
        <div className="flex items-center justify-between px-2">
           <h2 className="text-xs font-bold text-slate-400 uppercase tracking-[0.2em]">Real-time Performance Metrics</h2>
        </div>
        <StatCards />
      </section>

      {/* System Controls & Strategy */}
      <section className="space-y-6">
        <div className="flex items-center justify-between px-2">
           <h2 className="text-xs font-bold text-slate-400 uppercase tracking-[0.2em]">Retrieval Strategy & System Integrity</h2>
        </div>
        <SystemControlPanel />
      </section>

      {/* Analytics & Trends */}
      <section className="space-y-6">
        <div className="flex items-center justify-between px-2">
           <h2 className="text-xs font-bold text-slate-400 uppercase tracking-[0.2em]">Usage Analytics & Historical Trends</h2>
        </div>
        <ChartsPanel />
      </section>

      {/* Environment Control & Permissions */}
      <section>
        <EnvironmentPanel />
      </section>

      {/* Query History & Performance Review */}
      <section>
        <QueryHistory />
      </section>

      {/* System Logs & Debugging */}
      <section className="pb-12">
        <LogsPanel />
      </section>
    </div>
  );
}


