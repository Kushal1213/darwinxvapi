import React from 'react';
import { ResponsiveContainer, AreaChart, Area, BarChart, Bar, XAxis, YAxis, Tooltip, PieChart, Pie, Cell } from 'recharts';
import { BarChart3, TrendingUp, Clock, ShieldCheck, Activity, Globe, Database } from 'lucide-react';

export default function AnalyticsPage() {
  
  // Recharts Data Series
  const callsData = [
    { time: '08:00', calls: 120, latency: 310 },
    { time: '10:00', calls: 340, latency: 325 },
    { time: '12:00', calls: 480, latency: 340 },
    { time: '14:00', calls: 620, latency: 335 },
    { time: '16:00', calls: 510, latency: 320 },
    { time: '18:00', calls: 390, latency: 315 },
  ];

  const languageData = [
    { name: 'India English / Hindi', value: 42, color: '#5B5FFF' },
    { name: 'PH Taglish Bancassurance', value: 38, color: '#7C6CFF' },
    { name: 'ID Bahasa Multifinance', value: 20, color: '#22C55E' },
  ];

  const accuracyData = [
    { metric: 'Grounded Accuracy', score: 98.4 },
    { metric: 'PII Protection Rate', score: 100.0 },
    { metric: 'Out-of-Scope Fallback', score: 100.0 },
    { metric: 'ASR Accuracy (Nova-2)', score: 96.8 },
  ];

  return (
    <div className="max-w-[1400px] mx-auto space-y-10 animate-fadeIn">
      
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4 border-b dark:border-[rgba(255,255,255,0.06)] border-slate-200 pb-6">
        <div>
          <h1 className="text-h2 font-extrabold tracking-tight">System Analytics & Benchmarks</h1>
          <p className="text-body text-slate-400 mt-1">
            Real-time SLM performance metrics, grounded retrieval accuracy, and latency telemetry
          </p>
        </div>

        <div className="flex items-center space-x-3 text-small font-mono">
          <span className="px-3 py-1 rounded-full dark:bg-[#151D30] bg-slate-100 text-[#22C55E] font-bold border dark:border-[rgba(255,255,255,0.06)] border-slate-200">
            98.4% Grounded Accuracy
          </span>
          <span className="px-3 py-1 rounded-full dark:bg-[#151D30] bg-slate-100 text-[#5B5FFF] font-bold border dark:border-[rgba(255,255,255,0.06)] border-slate-200">
            335ms Avg Latency
          </span>
        </div>
      </div>

      {/* ─────────────────────────────────────────────────────────────
          CHARTS GRID (2 COLUMNS)
      ───────────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        
        {/* Call Volume & Latency Timeline Chart (7 cols) */}
        <div className="lg:col-span-7 rounded-3xl dark:bg-[#0F172A] bg-white border dark:border-[rgba(255,255,255,0.06)] border-slate-200 p-6 space-y-4 shadow-xl">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-h3 font-bold">Call Throughput & Latency</h3>
              <p className="text-small text-slate-400">Actions orchestrated per hour vs SLM roundtrip (ms)</p>
            </div>
            <span className="text-small font-mono text-[#5B5FFF] font-bold">1,398 actions/hr</span>
          </div>

          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={callsData}>
                <defs>
                  <linearGradient id="callGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#5B5FFF" stopOpacity={0.4}/>
                    <stop offset="95%" stopColor="#5B5FFF" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <XAxis dataKey="time" stroke="#64748B" fontSize={12} />
                <YAxis stroke="#64748B" fontSize={12} />
                <Tooltip contentStyle={{ backgroundColor: '#0F172A', borderColor: 'rgba(255,255,255,0.1)', borderRadius: '12px', color: '#fff' }} />
                <Area type="monotone" dataKey="calls" stroke="#5B5FFF" strokeWidth={3} fillOpacity={1} fill="url(#callGrad)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Regional Language Breakdown Chart (5 cols) */}
        <div className="lg:col-span-5 rounded-3xl dark:bg-[#0F172A] bg-white border dark:border-[rgba(255,255,255,0.06)] border-slate-200 p-6 space-y-4 shadow-xl">
          <div>
            <h3 className="text-h3 font-bold">Regional Market Distribution</h3>
            <p className="text-small text-slate-400">Call share by language & territory</p>
          </div>

          <div className="h-48 w-full flex items-center justify-center">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={languageData}
                  cx="50%"
                  cy="50%"
                  innerRadius={50}
                  outerRadius={75}
                  paddingAngle={5}
                  dataKey="value"
                >
                  {languageData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip contentStyle={{ backgroundColor: '#0F172A', borderColor: 'rgba(255,255,255,0.1)', borderRadius: '12px', color: '#fff' }} />
              </PieChart>
            </ResponsiveContainer>
          </div>

          <div className="space-y-2 text-small">
            {languageData.map((item, idx) => (
              <div key={idx} className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <span className="w-3 h-3 rounded-full" style={{ backgroundColor: item.color }}></span>
                  <span className="text-slate-300 font-medium">{item.name}</span>
                </div>
                <strong className="font-mono text-white">{item.value}%</strong>
              </div>
            ))}
          </div>
        </div>

      </div>

      {/* Accuracy & Benchmarks Bar Chart */}
      <div className="rounded-3xl dark:bg-[#0F172A] bg-white border dark:border-[rgba(255,255,255,0.06)] border-slate-200 p-6 space-y-4 shadow-xl">
        <div>
          <h3 className="text-h3 font-bold">Quality & Safety Benchmarks</h3>
          <p className="text-small text-slate-400">Evaluated over 500 automated test scenarios</p>
        </div>

        <div className="h-56 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={accuracyData} layout="vertical">
              <XAxis type="number" domain={[0, 100]} stroke="#64748B" fontSize={12} />
              <YAxis dataKey="metric" type="category" stroke="#64748B" fontSize={12} width={180} />
              <Tooltip contentStyle={{ backgroundColor: '#0F172A', borderColor: 'rgba(255,255,255,0.1)', borderRadius: '12px', color: '#fff' }} />
              <Bar dataKey="score" fill="#22C55E" radius={[0, 8, 8, 0]} barSize={20} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

    </div>
  );
}
