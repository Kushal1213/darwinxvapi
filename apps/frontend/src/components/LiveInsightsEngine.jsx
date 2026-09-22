import React, { useState } from 'react';
import { Zap, AlertTriangle, ShieldCheck, TrendingUp, Users, PhoneCall, ArrowUpRight, CheckCircle2, Clock, Activity, MessageSquare } from 'lucide-react';

export default function LiveInsightsEngine() {
  const [activeCalls, setActiveCalls] = useState([
    { id: 'call-101', market: '🇮🇳 India', agent: 'Aria', customer: 'Rahul Sharma', topic: '50L Home Loan', intent: 'loan_inquiry', sentiment: 'Positive (88%)', frustration: 0.1, status: 'Active', buying: true, duration: '02:14' },
    { id: 'call-102', market: '🇵🇭 Philippines', agent: 'Maria', customer: 'Juan Dela Cruz', topic: 'Bancassurance VUL', intent: 'insurance_inquiry', sentiment: 'Neutral (52%)', frustration: 0.3, status: 'Active', buying: true, duration: '01:45' },
    { id: 'call-103', market: '🇮🇩 Indonesia', agent: 'Dewi', customer: 'Budi Santoso', topic: 'Motor Cicilan 24m', intent: 'payment', sentiment: 'Positive (91%)', frustration: 0.05, status: 'Active', buying: false, duration: '03:10' },
    { id: 'call-104', market: '🇮🇳 India', agent: 'Priya', customer: 'Vikram Mehta', topic: 'Health Claim Escalation', intent: 'complaint', sentiment: 'Negative (22%)', frustration: 0.85, status: 'Flagged', buying: false, duration: '04:22' },
  ]);

  const [alerts, setAlerts] = useState([
    { id: 1, type: 'Frustration Spike', callId: 'call-104', customer: 'Vikram Mehta', detail: 'Frustration level reached 85% — customer requested manager escalation for delayed health claim', time: 'Just now', severity: 'high' },
    { id: 2, type: 'Compliance Alert', callId: 'call-102', customer: 'Juan Dela Cruz', detail: 'Agent verified 15-day free-look period disclosure as required by Insurance Commission PH', time: '2m ago', severity: 'low' },
  ]);

  const [crmLeads, setCrmLeads] = useState([
    { id: 'CRM-901', name: 'Rahul Sharma', phone: '+91 98765 43210', product: 'Home Loan (50 Lakhs)', score: 94, status: 'Qualified Lead', agent: 'Aria' },
    { id: 'CRM-902', name: 'Juan Dela Cruz', phone: '+63 917 123 4567', product: 'Life Insurance (₱2M)', score: 82, status: 'Callback Scheduled', agent: 'Maria' },
    { id: 'CRM-903', name: 'Budi Santoso', phone: '+62 812 3456 7890', product: 'Multifinance Cicilan', score: 88, status: 'Approved', agent: 'Dewi' },
  ]);

  return (
    <div className="space-y-6 animate-fadeIn">
      {/* Metrics Banner */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white rounded-2xl p-5 border border-darwix-100 shadow-darwix-card flex items-center space-x-4">
          <div className="w-12 h-12 rounded-xl bg-darwix-50 flex items-center justify-center text-darwix-500 border border-darwix-100">
            <PhoneCall className="w-6 h-6" />
          </div>
          <div>
            <span className="text-2xl font-extrabold text-darwix-900">4 Active</span>
            <span className="text-xs text-slate-500 block font-medium">Concurrent Calls Monitored</span>
          </div>
        </div>

        <div className="bg-white rounded-2xl p-5 border border-darwix-100 shadow-darwix-card flex items-center space-x-4">
          <div className="w-12 h-12 rounded-xl bg-emerald-50 flex items-center justify-center text-emerald-600 border border-emerald-100">
            <TrendingUp className="w-6 h-6" />
          </div>
          <div>
            <span className="text-2xl font-extrabold text-darwix-900">78.4%</span>
            <span className="text-xs text-slate-500 block font-medium">Buying Signal Conversion</span>
          </div>
        </div>

        <div className="bg-white rounded-2xl p-5 border border-darwix-100 shadow-darwix-card flex items-center space-x-4">
          <div className="w-12 h-12 rounded-xl bg-rose-50 flex items-center justify-center text-rose-600 border border-rose-100">
            <AlertTriangle className="w-6 h-6" />
          </div>
          <div>
            <span className="text-2xl font-extrabold text-darwix-900">1 Flagged</span>
            <span className="text-xs text-slate-500 block font-medium">Frustration Escalation</span>
          </div>
        </div>

        <div className="bg-white rounded-2xl p-5 border border-darwix-100 shadow-darwix-card flex items-center space-x-4">
          <div className="w-12 h-12 rounded-xl bg-indigo-50 flex items-center justify-center text-indigo-600 border border-indigo-100">
            <Users className="w-6 h-6" />
          </div>
          <div>
            <span className="text-2xl font-extrabold text-darwix-900">34 Leads</span>
            <span className="text-xs text-slate-500 block font-medium">Auto-Created in CRM Today</span>
          </div>
        </div>
      </div>

      {/* Main Grid: Concurrent Call Feed (Left) & Real-time Alerts / CRM (Right) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* Left Column (7 cols): Live Concurrent Calls Monitor */}
        <div className="lg:col-span-7 space-y-6">
          
          <div className="bg-white rounded-3xl p-6 border border-darwix-100 shadow-darwix-card space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center space-x-2">
                <Activity className="w-5 h-5 text-darwix-500" />
                <h3 className="text-base font-extrabold text-darwix-900">Live Call Signal Monitor Stream</h3>
              </div>
              <span className="text-xs font-bold text-emerald-600 px-2.5 py-1 rounded-full bg-emerald-50 border border-emerald-200">
                ● Live Streaming
              </span>
            </div>

            <div className="space-y-3">
              {activeCalls.map((call) => (
                <div key={call.id} className="p-4 rounded-2xl bg-darwix-50/60 border border-darwix-100 space-y-3 hover:border-darwix-300 transition-all">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-2">
                      <span className="text-base">{call.market.split(' ')[0]}</span>
                      <div>
                        <span className="text-xs font-extrabold text-darwix-900 block">{call.customer}</span>
                        <span className="text-[11px] text-slate-500">{call.topic} · {call.agent} (Agent)</span>
                      </div>
                    </div>

                    <div className="flex items-center space-x-2">
                      <span className="text-xs font-mono font-bold text-slate-500 bg-white px-2 py-0.5 rounded-md border border-slate-200">
                        {call.duration}
                      </span>
                      {call.buying && (
                        <span className="text-[10px] font-bold uppercase bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded-full">
                          High Intent
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Signal Meters */}
                  <div className="grid grid-cols-3 gap-2 text-xs pt-2 border-t border-slate-100">
                    <div>
                      <span className="text-[10px] font-bold text-slate-400 block uppercase">Sentiment</span>
                      <span className="font-bold text-emerald-600 text-xs">{call.sentiment}</span>
                    </div>
                    <div>
                      <span className="text-[10px] font-bold text-slate-400 block uppercase">Frustration</span>
                      <div className="w-full h-1.5 rounded-full bg-slate-200 mt-1 overflow-hidden">
                        <div
                          className="h-full bg-rose-500 rounded-full"
                          style={{ width: `${call.frustration * 100}%` }}
                        ></div>
                      </div>
                    </div>
                    <div>
                      <span className="text-[10px] font-bold text-slate-400 block uppercase">Intent</span>
                      <span className="font-bold text-darwix-900 capitalize text-xs">{call.intent}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>

          </div>

        </div>

        {/* Right Column (5 cols): Automated Compliance & CRM Pipeline */}
        <div className="lg:col-span-5 space-y-6">

          {/* Compliance & Risk Alerts */}
          <div className="bg-white rounded-3xl p-6 border border-darwix-100 shadow-darwix-card space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-slate-100">
              <div className="flex items-center space-x-2">
                <ShieldCheck className="w-5 h-5 text-darwix-500" />
                <h4 className="text-sm font-extrabold text-darwix-900">Real-time Compliance & Risk Alerts</h4>
              </div>
            </div>

            <div className="space-y-3">
              {alerts.map((alert) => (
                <div key={alert.id} className={`p-3.5 rounded-2xl border text-xs space-y-1.5 ${
                  alert.severity === 'high' ? 'bg-rose-50 border-rose-200 text-rose-900' : 'bg-emerald-50/60 border-emerald-100 text-emerald-900'
                }`}>
                  <div className="flex items-center justify-between font-bold">
                    <span className="flex items-center space-x-1.5">
                      {alert.severity === 'high' ? <AlertTriangle className="w-4 h-4 text-rose-500" /> : <ShieldCheck className="w-4 h-4 text-emerald-500" />}
                      <span>{alert.type} ({alert.customer})</span>
                    </span>
                    <span className="text-[10px] text-slate-400 font-normal">{alert.time}</span>
                  </div>
                  <p className="text-[11px] leading-relaxed text-slate-700">
                    {alert.detail}
                  </p>
                </div>
              ))}
            </div>
          </div>

          {/* Lead Creation CRM Pipeline */}
          <div className="bg-white rounded-3xl p-6 border border-darwix-100 shadow-darwix-card space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-slate-100">
              <div className="flex items-center space-x-2">
                <Users className="w-5 h-5 text-darwix-500" />
                <h4 className="text-sm font-extrabold text-darwix-900">Auto-Qualified CRM Leads</h4>
              </div>
            </div>

            <div className="space-y-2.5">
              {crmLeads.map((lead) => (
                <div key={lead.id} className="p-3 rounded-xl bg-darwix-50/60 border border-darwix-100 flex items-center justify-between text-xs">
                  <div>
                    <span className="font-extrabold text-darwix-900 block">{lead.name}</span>
                    <span className="text-[11px] text-slate-500">{lead.product}</span>
                  </div>
                  <div className="text-right">
                    <span className="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 font-bold text-[10px] block mb-0.5">
                      {lead.status}
                    </span>
                    <span className="text-[10px] text-slate-400 font-mono">Score: {lead.score}/100</span>
                  </div>
                </div>
              ))}
            </div>
          </div>

        </div>

      </div>
    </div>
  );
}
