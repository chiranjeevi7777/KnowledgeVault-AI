import { useState, useEffect } from 'react';
import { Server, CheckCircle2, XCircle, Key } from 'lucide-react';

interface EnvStatus {
  box_auth: boolean;
  box_folder: string | null;
  bedrock_auth: boolean;
  bedrock_api_key: boolean;
  bedrock_model: string;
  aws_region: string;
  whisper: string;
  chroma: string;
}

export default function EnvironmentPanel() {
  const [env, setEnv] = useState<EnvStatus | null>(null);

  useEffect(() => {
    fetch('/api/health/env')
      .then(res => res.json())
      .then(data => setEnv(data))
      .catch(err => console.error("Could not fetch env status:", err));
  }, []);

  if (!env) return null;

  const items = [
    { name: 'Box Auth Token',       value: env.box_auth ? 'Active' : 'Missing',  active: env.box_auth,     type: 'Secret' },
    { name: 'Box Root Folder',      value: env.box_folder || 'None',              active: !!env.box_folder, type: 'Config' },
    { name: 'AWS Bedrock Auth',     value: env.bedrock_auth ? 'Active' : 'Missing', active: env.bedrock_auth, type: 'Secret' },
    { name: 'Bedrock API Key',      value: env.bedrock_api_key ? 'Configured' : 'Optional', active: env.bedrock_api_key, type: 'Secret' },
    { name: 'Bedrock Model',        value: env.bedrock_model,                     active: !!env.bedrock_model, type: 'Config' },
    { name: 'AWS Region',           value: env.aws_region,                        active: !!env.aws_region, type: 'Config' },
    { name: 'Whisper Transcriber',  value: env.whisper,                           active: !!env.whisper,    type: 'Local Model' },
    { name: 'Chroma Database',      value: env.chroma,                            active: !!env.chroma,     type: 'Local DB' },
  ];

  return (
    <div className="bg-white rounded-[2rem] p-10 border border-slate-100 shadow-sm space-y-8">
      <div className="flex items-center justify-between">
        <div className="space-y-1">
          <h3 className="text-2xl font-bold text-slate-800 tracking-tight">Environment & Connections</h3>
          <p className="text-slate-400 font-medium">Verify backend system health and API bindings.</p>
        </div>
        <div className="flex items-center gap-4">
           <div className="px-4 py-2.5 bg-slate-50 text-slate-600 rounded-xl border border-slate-100 text-sm font-bold flex items-center gap-2">
              <Server className="w-4 h-4" />
              Live Config
           </div>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="text-left border-b border-slate-50">
              <th className="pb-6 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] px-4">Connection</th>
              <th className="pb-6 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] px-4">Type</th>
              <th className="pb-6 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] px-4">Value</th>
              <th className="pb-6 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] px-4">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-50">
            {items.map((item, idx) => (
              <tr key={idx} className="group hover:bg-slate-50/50 transition-colors">
                <td className="py-6 px-4">
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center font-bold text-slate-500 text-xs">
                       {item.type === 'Secret' ? <Key className="w-4 h-4 text-slate-400" /> : <Server className="w-4 h-4 text-slate-400" />}
                    </div>
                    <div>
                      <p className="font-bold text-slate-800 leading-none mb-1">{item.name}</p>
                    </div>
                  </div>
                </td>
                <td className="py-6 px-4">
                  <span className="text-xs font-semibold text-slate-500">{item.type}</span>
                </td>
                <td className="py-6 px-4">
                   <p className="text-sm font-semibold text-slate-600">{item.value}</p>
                </td>
                <td className="py-6 px-4">
                  <div className="flex items-center justify-between gap-4">
                    <div className={`inline-flex items-center gap-2 px-3 py-1 rounded-lg border leading-none ${
                      item.active 
                        ? 'bg-emerald-50 text-emerald-600 border-emerald-100/50' 
                        : 'bg-rose-50 text-rose-600 border-rose-100/50'
                    }`}>
                      {item.active ? <CheckCircle2 className="w-3 h-3" /> : <XCircle className="w-3 h-3" />}
                      <span className="text-[10px] font-bold uppercase tracking-tight">{item.active ? 'Active' : 'Offline'}</span>
                    </div>

                    {item.name === 'Box Auth Token' && (
                      <button 
                        onClick={async () => {
                          const resp = await fetch('/api/auth/login');
                          const data = await resp.json();
                          if (data.url) window.open(data.url, '_blank', 'width=600,height=700');
                        }}
                        className="text-[10px] font-black uppercase text-brand-primary hover:underline"
                      >
                        {item.active ? 'Reconnect' : 'Link Account'}
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
