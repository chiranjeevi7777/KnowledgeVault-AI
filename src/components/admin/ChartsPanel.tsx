import { useState, useEffect } from 'react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar, Cell } from 'recharts';

export default function ChartsPanel() {
  const [timelineData, setTimelineData] = useState<any[]>([]);
  const [roleData, setRoleData] = useState<any[]>([]);

  useEffect(() => {
    fetch('/api/stats/charts')
      .then(res => res.json())
      .then(data => {
        if (data.timelineData) setTimelineData(data.timelineData);
        if (data.roleData) setRoleData(data.roleData);
      })
      .catch(err => console.error("Could not fetch chart data:", err));
  }, []);
  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
      {/* Activity Timeline */}
      <div className="lg:col-span-2 bg-white rounded-[2rem] p-8 border border-slate-100 shadow-sm space-y-6">
        <div className="flex items-center justify-between">
          <h3 className="text-xl font-bold text-slate-800">Traffic & Retrieval Accuracy</h3>
          <div className="flex items-center gap-4">
             <div className="flex items-center gap-2">
                <div className="w-3 h-3 bg-indigo-500 rounded-full" />
                <span className="text-xs font-bold text-slate-400 uppercase">Requests</span>
             </div>
             <div className="flex items-center gap-2">
                <div className="w-3 h-3 bg-emerald-500 rounded-full" />
                <span className="text-xs font-bold text-slate-400 uppercase">Accuracy %</span>
             </div>
          </div>
        </div>
        <div className="h-[300px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={timelineData}>
              <defs>
                <linearGradient id="colorReq" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#4f46e5" stopOpacity={0.1}/>
                  <stop offset="95%" stopColor="#4f46e5" stopOpacity={0}/>
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
              <XAxis dataKey="time" axisLine={false} tickLine={false} tick={{fill: '#94a3b8', fontSize: 10}} />
              <YAxis axisLine={false} tickLine={false} tick={{fill: '#94a3b8', fontSize: 10}} />
              <Tooltip 
                contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
              />
              <Area type="monotone" dataKey="requests" stroke="#4f46e5" fillOpacity={1} fill="url(#colorReq)" strokeWidth={3} />
              <Area type="monotone" dataKey="accuracy" stroke="#10b981" fill="transparent" strokeWidth={3} />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* User Roles Bar Chart */}
      <div className="bg-white rounded-[2rem] p-8 border border-slate-100 shadow-sm space-y-6">
        <h3 className="text-xl font-bold text-slate-800">Calls by User Role</h3>
        <div className="h-[300px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={roleData} layout="vertical">
              <XAxis type="number" hide />
              <YAxis dataKey="name" type="category" axisLine={false} tickLine={false} tick={{fill: '#64748b', fontSize: 12, fontWeight: 500}} width={80} />
              <Tooltip 
                cursor={{fill: 'transparent'}}
                contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
              />
              <Bar dataKey="value" radius={[0, 8, 8, 0]} barSize={24}>
                {roleData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.color} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}
