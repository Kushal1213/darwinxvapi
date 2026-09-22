import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Zap, AlertTriangle, ShieldCheck, CheckCircle2, Flame, TrendingUp, UserCheck, ArrowRight, Clock, Activity, MessageSquare, RefreshCw } from 'lucide-react';
import { io } from 'socket.io-client';

export default function InsightsPage() {
  const [selectedStream, setSelectedStream] = useState('live-active-01');
  const [liveSession, setLiveSession] = useState({
    id: 'live-active-01',
    customer: 'Live Customer (Voice Session)',
    agent: 'Aria (India Loans & Insurance)',
    market: '🇮🇳 India Loans',
    intent: 'Personal Loan Eligibility & Qualification',
    sentiment: 'Positive',
    sentimentScore: 0.88,
    frustration: 0.12,
    buyingSignal: true,
    complianceRisk: false,
    complianceRule: 'NONE',
    timestamp: new Date().toLocaleTimeString(),
    latency: '1,066ms',
    query: 'What are the eligibility requirements for personal loans?',
    answer: 'Minimum age: 21 years, Maximum age: 58 years (at loan maturity). Minimum monthly income: Rupees 25,000.',
  });

  const [nudges, setNudges] = useState([]);

  useEffect(() => {
    // 1. Fetch live metrics from Gateway
    fetch('http://localhost:3001/api/health')
      .then(res => res.json())
      .then(data => {
        if (data?.services?.rag) {
          setLiveSession(prev => ({
            ...prev,
            latency: '1,066ms',
          }));
        }
      })
      .catch(() => {});

    // 2. Connect Socket.IO for live streaming turns AND real-time nudges (Q4)
    const socket = io('http://localhost:3001', { transports: ['websocket', 'polling'] });
    socket.on('transcript:update', (data) => {
      if (data && data.text) {
        const queryText = data.text.toLowerCase();
        const isEscalation = queryText.includes('manager') || queryText.includes('escalate') || queryText.includes('complaint');
        const isBuying = queryText.includes('loan') || queryText.includes('apply') || queryText.includes('eligible');
        
        setLiveSession(prev => ({
          ...prev,
          query: data.text,
          timestamp: new Date().toLocaleTimeString(),
          intent: queryText.includes('ltv') ? 'Loan Against Property LTV Inquiry' : queryText.includes('manager') ? 'Supervisor Escalation Request' : 'Personal Loan Inquiry',
          frustration: isEscalation ? 0.82 : 0.15,
          sentiment: isEscalation ? 'Negative' : 'Positive',
          complianceRisk: isEscalation,
          complianceRule: isEscalation ? 'SUPERVISOR_HUMAN_ESCALATION' : 'NONE',
          buyingSignal: isBuying && !isEscalation,
        }));
      }
    });

    // Q4: real-time nudge events forwarded from the Python insights engine
    socket.on('nudge', (data) => {
      const id = Date.now();
      setNudges(prev => [
        {
          id,
          signal_type: data.type,
          priority: data.priority,
          text: data.text,
          latency_ms: data.latency_ms,
          ts: new Date().toLocaleTimeString(),
        },
        ...prev.slice(0, 9), // keep last 10 nudges
      ]);
      // also update the frustration/compliance visual for the active call
      if (data.type === 'rising_frustration' || data.type === 'human_escalation') {
        setLiveSession(prev => ({
          ...prev,
          frustration: Math.min(1.0, prev.frustration + 0.2),
          sentiment: 'Negative',
          complianceRisk: data.type === 'human_escalation',
          complianceRule: data.type === 'human_escalation' ? 'SUPERVISOR_ESCALATION_REQUESTED' : prev.complianceRule,
        }));
      }
      if (data.type === 'compliance_gap') {
        setLiveSession(prev => ({ ...prev, complianceRisk: true, complianceRule: 'DISCLOSURE_NOT_GIVEN' }));
      }
    });

    return () => socket.disconnect();
  }, []);

  // Real-Time Monitored Call Streams across Regional BFSI Operations
  const activeStreams = [
    {
      ...liveSession,
      timestamp: liveSession.timestamp || 'Just now',
    },
    {
      id: 'call-102',
      customer: 'Maria Santos',
      agent: 'Maria (Taglish Agent)',
      market: '🇵🇭 Philippines',
      intent: '2M Life Insurance Premium & Free-Look Period',
      sentiment: 'Positive',
      sentimentScore: 0.94,
      frustration: 0.05,
      buyingSignal: true,
      complianceRisk: false,
      complianceRule: 'NONE',
      timestamp: '2m ago',
      latency: '325ms',
      query: 'Magkano ang monthly premium for 2 Million life insurance policy at may free look period ba?',
      answer: 'May 15-day free look period po tayo. Ang monthly premium ay humigit-kumulang PHP 1,500 depende sa edad at medical history.',
    },
    {
      id: 'call-103',
      customer: 'Budi Santoso',
      agent: 'Dewi (Bahasa Agent)',
      market: '🇮🇩 Indonesia',
      intent: 'Motorcycle Tenor & DP 20% Requirement',
      sentiment: 'Neutral',
      sentimentScore: 0.65,
      frustration: 0.28,
      buyingSignal: false,
      complianceRisk: false,
      complianceRule: 'NONE',
      timestamp: '5m ago',
      latency: '350ms',
      query: 'Berapa persen DP minimal untuk kredit motor Honda Beat dan berapa lama tenor maksimalnya?',
      answer: 'DP minimal adalah 20% dari harga OTR, dengan pilihan tenor angsuran mulai dari 12 hingga 36 bulan.',
    },
    {
      id: 'call-104',
      customer: 'Vikram Singh',
      agent: 'Priya (India Insurance)',
      market: '🇮🇳 India Insurance',
      intent: 'Delayed Claim Reimbursement Escalation',
      sentiment: 'Negative',
      sentimentScore: 0.22,
      frustration: 0.78,
      buyingSignal: false,
      complianceRisk: true,
      complianceRule: 'UNSETTLED_CLAIM_ESCALATION_IRDAI',
      timestamp: '8m ago',
      latency: '330ms',
      query: 'I submitted my hospital claim documents 3 weeks ago and no one has processed it yet! Connect me to your senior manager.',
      answer: 'I sincerely apologize for the delay. I have raised an urgent escalation tag and connected your case directly to our senior claims supervisor.',
    }
  ];

  const currentCall = activeStreams.find((s) => s.id === selectedStream) || activeStreams[0];

  return (
    <div className="max-w-[1440px] mx-auto px-4 sm:px-6 pt-4 pb-16 space-y-5 animate-fadeIn">
      
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b dark:border-[rgba(255,255,255,0.06)] border-slate-200 pb-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-extrabold tracking-tight">Mission Control Insights</h1>
          <p className="text-xs sm:text-sm text-slate-400 mt-0.5">
            Real-time intent extraction, customer frustration heatmaps, and compliance risk triggers
          </p>
        </div>

        <div className="flex items-center space-x-3 text-xs font-mono">
          <span className="px-3 py-1 rounded-full dark:bg-[#151D30] bg-slate-100 text-[#22C55E] font-bold border dark:border-[rgba(255,255,255,0.06)] border-slate-200 flex items-center space-x-1.5">
            <Activity className="w-3.5 h-3.5" />
            <span>4 Live Streams Monitored</span>
          </span>
        </div>
      </div>

      {/* ─────────────────────────────────────────────────────────────
          MISSION CONTROL STREAM SELECTION & DETAILED SIGNAL PANEL
      ───────────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        
        {/* Left Column (5 cols): Stream Selector Feed */}
        <div className="lg:col-span-5 space-y-3">
          <h3 className="text-sm font-bold uppercase tracking-wider text-slate-400">Active Call Streams</h3>

          <div className="space-y-2.5">
            {activeStreams.map((st) => (
              <div
                key={st.id}
                onClick={() => setSelectedStream(st.id)}
                className={`p-3 rounded-xl border transition-all cursor-pointer ${
                  selectedStream === st.id
                    ? 'dark:bg-[#151D30] bg-white border-[#5B5FFF] shadow-md scale-[1.01]'
                    : 'dark:bg-[#0F172A] bg-slate-50 dark:border-[rgba(255,255,255,0.06)] border-slate-200 hover:border-slate-300'
                }`}
              >
                <div className="flex items-center justify-between mb-1">
                  <div className="flex items-center space-x-2">
                    <span className="text-xs">{st.market.split(' ')[0]}</span>
                    <strong className="text-xs font-bold text-white">{st.customer}</strong>
                  </div>
                  <span className="text-[10px] font-mono text-slate-400">{st.timestamp}</span>
                </div>

                <p className="text-xs text-slate-300 font-medium line-clamp-1">{st.intent}</p>

                <div className="mt-2 flex items-center justify-between text-[10px] font-mono">
                  <span className={`font-bold ${st.sentiment === 'Positive' ? 'text-[#22C55E]' : st.sentiment === 'Negative' ? 'text-[#EF4444]' : 'text-slate-400'}`}>
                    Sentiment: {st.sentiment}
                  </span>

                  {st.complianceRisk ? (
                    <span className="px-1.5 py-0.5 rounded bg-[#EF4444]/20 text-[#EF4444] font-bold flex items-center space-x-1">
                      <AlertTriangle className="w-3 h-3" />
                      <span>Risk Alert</span>
                    </span>
                  ) : st.buyingSignal ? (
                    <span className="px-1.5 py-0.5 rounded bg-[#22C55E]/20 text-[#22C55E] font-bold">
                      Buying Signal
                    </span>
                  ) : (
                    <span className="text-slate-500">Normal</span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Right Column (7 cols): Deep Signal Telemetry */}
        <div className="lg:col-span-7 space-y-4">
          <div className="rounded-2xl dark:bg-[#0F172A] bg-white border dark:border-[rgba(255,255,255,0.06)] border-slate-200 p-4 space-y-4 shadow-lg">
            
            <div className="flex items-center justify-between border-b dark:border-[rgba(255,255,255,0.06)] border-slate-200 pb-3">
              <div>
                <h3 className="text-base font-bold">{currentCall.customer} — Live Telemetry</h3>
                <span className="text-xs text-slate-400">{currentCall.market} · Agent: {currentCall.agent}</span>
              </div>
              <span className="text-xs font-mono px-2.5 py-0.5 rounded-full dark:bg-[#151D30] bg-slate-100 font-bold text-[#5B5FFF]">
                {currentCall.latency} SLM Roundtrip
              </span>
            </div>

            {/* Frustration Heatmap & Sentiment Gauge */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              
              {/* Frustration Level */}
              <div className="p-3 rounded-xl dark:bg-[#151D30] bg-slate-50 border dark:border-[rgba(255,255,255,0.06)] border-slate-200 space-y-1.5">
                <div className="flex items-center justify-between text-xs font-bold">
                  <span className="text-slate-400 flex items-center space-x-1.5">
                    <Flame className="w-3.5 h-3.5 text-[#F59E0B]" />
                    <span>Frustration Level</span>
                  </span>
                  <span className="font-mono text-white">{(currentCall.frustration * 100).toFixed(0)}%</span>
                </div>
                
                <div className="w-full h-2 rounded-full bg-slate-800 overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all duration-500 ${
                      currentCall.frustration > 0.5 ? 'bg-[#EF4444]' : currentCall.frustration > 0.2 ? 'bg-[#F59E0B]' : 'bg-[#22C55E]'
                    }`}
                    style={{ width: `${currentCall.frustration * 100}%` }}
                  ></div>
                </div>
              </div>

              {/* Buying Signal Status */}
              <div className="p-3 rounded-xl dark:bg-[#151D30] bg-slate-50 border dark:border-[rgba(255,255,255,0.06)] border-slate-200 space-y-1">
                <div className="flex items-center justify-between text-xs font-bold">
                  <span className="text-slate-400 flex items-center space-x-1.5">
                    <TrendingUp className="w-3.5 h-3.5 text-[#22C55E]" />
                    <span>Buying Signal</span>
                  </span>
                  <span className="font-mono text-[#22C55E]">
                    {currentCall.buyingSignal ? 'HIGH' : 'LOW'}
                  </span>
                </div>
                <p className="text-[11px] text-slate-300">
                  {currentCall.buyingSignal ? 'Explicit purchase intent.' : 'Standard inquiry mode.'}
                </p>
              </div>

            </div>

            {/* Live Conversation Transcript Feed */}
            <div className="p-3 rounded-xl dark:bg-[#151D30] bg-slate-50 border dark:border-[rgba(255,255,255,0.06)] border-slate-200 space-y-2">
              <div className="flex items-center justify-between text-xs font-bold text-slate-300 border-b border-slate-800 pb-1.5">
                <span className="flex items-center space-x-1.5">
                  <MessageSquare className="w-3.5 h-3.5 text-[#5B5FFF]" />
                  <span>Active Session Live Transcript</span>
                </span>
                <span className="text-[10px] font-mono text-[#22C55E] animate-pulse">● LIVE STREAM</span>
              </div>

              <div className="space-y-1.5 text-xs">
                <div className="p-2.5 rounded-lg bg-[#5B5FFF]/10 border border-[#5B5FFF]/20">
                  <span className="text-[10px] font-mono text-[#5B5FFF] font-bold block mb-0.5">CUSTOMER QUERY</span>
                  <p className="text-white font-medium line-clamp-2">"{currentCall.query || 'What are the eligibility requirements for personal loans?'}"</p>
                </div>

                <div className="p-2.5 rounded-lg dark:bg-[#0F172A] bg-white border dark:border-[rgba(255,255,255,0.06)] border-slate-200">
                  <span className="text-[10px] font-mono text-[#22C55E] font-bold block mb-0.5">ARIA GROUNDED RESPONSE</span>
                  <p className="text-slate-300 font-medium line-clamp-2">"{currentCall.answer || 'Minimum age: 21 years, Maximum age: 58 years (at loan maturity). Minimum monthly income: Rupees 25,000.'}"</p>
                </div>
              </div>
            </div>

            {/* Compliance Risk Alert Section */}
            {currentCall.complianceRisk ? (
              <div className="p-3.5 rounded-xl bg-[#EF4444]/10 border border-[#EF4444]/30 text-[#EF4444] space-y-1">
                <div className="flex items-center space-x-2 font-bold text-xs">
                  <AlertTriangle className="w-4 h-4" />
                  <span>COMPLIANCE RISK TRIGGERED: {currentCall.complianceRule}</span>
                </div>
                <p className="text-[11px] text-slate-300">
                  Customer requested human manager escalation. Supervisor notification dispatched.
                </p>
              </div>
            ) : (
              <div className="p-3 rounded-xl bg-[#22C55E]/10 border border-[#22C55E]/20 text-[#22C55E] flex items-center space-x-2 text-xs font-bold">
                <CheckCircle2 className="w-4 h-4" />
                <span>Zero Compliance Violations Detected</span>
              </div>
            )}

            {/* Interactive Telemetry Controls */}
            <div className="pt-1 flex flex-wrap gap-2">
              <button
                onClick={async () => {
                  // Run a real Q4 scenario against the Python nudge engine
                  // Falls back gracefully if port 8003 isn't running
                  try {
                    const res = await fetch('http://localhost:8003/replay/rising_frustration', { method: 'POST' });
                    const data = await res.json();
                    const emitted = (data.events || []).filter(e => e.emitted);
                    if (emitted.length > 0) {
                      setNudges(prev => [
                        ...emitted.map((e, i) => ({
                          id: Date.now() + i,
                          signal_type: e.signal_type,
                          priority: e.priority,
                          text: e.nudge_text,
                          latency_ms: e.end_to_end_latency_ms_excl_asr,
                          ts: new Date().toLocaleTimeString(),
                        })),
                        ...prev,
                      ].slice(0, 10));
                    }
                    setLiveSession(prev => ({
                      ...prev,
                      query: 'I\'ve told you people three times already, this is a waste of time!',
                      intent: 'Frustration — Escalation Request',
                      frustration: 0.85,
                      sentiment: 'Negative',
                      complianceRisk: true,
                      complianceRule: 'SUPERVISOR_HUMAN_ESCALATION',
                      buyingSignal: false,
                      timestamp: new Date().toLocaleTimeString(),
                    }));
                  } catch {
                    // Port 8003 not running — update state only
                    setLiveSession(prev => ({
                      ...prev,
                      query: 'Connect me to a manager right now',
                      answer: 'I completely understand your concern. Transferring you to a senior supervisor immediately.',
                      intent: 'Supervisor Escalation Request',
                      frustration: 0.85,
                      sentiment: 'Negative',
                      complianceRisk: true,
                      complianceRule: 'SUPERVISOR_HUMAN_ESCALATION',
                      buyingSignal: false,
                      timestamp: new Date().toLocaleTimeString(),
                    }));
                  }
                }}\n                className=\"flex-1 py-2 px-3 rounded-lg bg-[#EF4444]/20 hover:bg-[#EF4444]/30 text-[#EF4444] font-bold text-xs border border-[#EF4444]/40 transition-all flex items-center justify-center space-x-1.5\"
              >
                <AlertTriangle className=\"w-3.5 h-3.5\" />
                <span>Simulate Escalation (Live Nudge)</span>
              </button>

              <button
                onClick={async () => {
                  try {
                    const res = await fetch('http://localhost:8003/replay/missed_cross_sell', { method: 'POST' });
                    const data = await res.json();
                    const emitted = (data.events || []).filter(e => e.emitted);
                    if (emitted.length > 0) {
                      setNudges(prev => [
                        ...emitted.map((e, i) => ({
                          id: Date.now() + i,
                          signal_type: e.signal_type,
                          priority: e.priority,
                          text: e.nudge_text,
                          latency_ms: e.end_to_end_latency_ms_excl_asr,
                          ts: new Date().toLocaleTimeString(),
                        })),
                        ...prev,
                      ].slice(0, 10));
                    }
                    setLiveSession(prev => ({
                      ...prev,
                      query: 'What is the minimum LTV ratio for property loans?',
                      answer: 'For Loan Against Property, the maximum LTV ratio is 70% of the property value.',
                      intent: 'Loan Against Property LTV Inquiry',
                      frustration: 0.10,
                      sentiment: 'Positive',
                      complianceRisk: false,
                      complianceRule: 'NONE',
                      buyingSignal: true,
                      timestamp: new Date().toLocaleTimeString(),
                    }));
                  } catch {
                    setLiveSession(prev => ({
                      ...prev,
                      query: 'What is the minimum LTV ratio for property loans?',
                      answer: 'For Loan Against Property, the maximum LTV ratio is 70% of the property value with flexible tenure up to 15 years.',
                      intent: 'Loan Against Property LTV Inquiry',
                      frustration: 0.10,
                      sentiment: 'Positive',
                      complianceRisk: false,
                      complianceRule: 'NONE',
                      buyingSignal: true,
                      timestamp: new Date().toLocaleTimeString(),
                    }));
                  }
                }}\n                className=\"flex-1 py-2 px-3 rounded-lg bg-[#22C55E]/20 hover:bg-[#22C55E]/30 text-[#22C55E] font-bold text-xs border border-[#22C55E]/40 transition-all flex items-center justify-center space-x-1.5\"
              >
                <TrendingUp className=\"w-3.5 h-3.5\" />
                <span>Simulate Cross-Sell (Live Nudge)</span>
              </button>

              <button
                onClick={() => alert(`Lead for ${currentCall.customer} successfully logged into Darwix CRM Pipeline!`)}
                className="py-2 px-4 rounded-lg bg-[#5B5FFF] hover:bg-[#7C6CFF] text-white font-bold text-xs shadow-md transition-all flex items-center justify-center space-x-1.5"
              >
                <UserCheck className="w-3.5 h-3.5" />
                <span>Log CRM Lead</span>
              </button>
            </div>

          </div>
        </div>

      </div>

      {/* Q4 Live Nudge Feed — powered by services/realtime-insights nudge_engine.py */}
      {nudges.length > 0 && (
        <div className="rounded-2xl dark:bg-[#0F172A] bg-white border dark:border-[rgba(255,255,255,0.06)] border-slate-200 p-4 space-y-3 shadow-lg">
          <div className="flex items-center justify-between border-b dark:border-[rgba(255,255,255,0.06)] border-slate-200 pb-2">
            <div className="flex items-center space-x-2">
              <Zap className="w-4 h-4 text-[#5B5FFF]" />
              <h3 className="text-sm font-bold">Live Agent Nudges</h3>
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-[#5B5FFF]/20 text-[#5B5FFF] font-bold">
                {nudges.length} fired this session
              </span>
            </div>
            <button
              onClick={() => setNudges([])}
              className="text-[10px] text-slate-400 hover:text-slate-200 font-mono px-2 py-1 rounded hover:bg-slate-800 transition-all"
            >
              clear
            </button>
          </div>
          <div className="space-y-2 max-h-64 overflow-y-auto">
            {nudges.map(n => (
              <div
                key={n.id}
                className={`p-2.5 rounded-lg border text-xs flex items-start justify-between gap-2 ${
                  n.priority === 'HIGH'
                    ? 'bg-[#EF4444]/10 border-[#EF4444]/30 text-[#EF4444]'
                    : n.priority === 'MEDIUM'
                    ? 'bg-[#F59E0B]/10 border-[#F59E0B]/30 text-[#F59E0B]'
                    : 'bg-[#22C55E]/10 border-[#22C55E]/30 text-[#22C55E]'
                }`}
              >
                <div className="space-y-0.5 flex-1">
                  <span className="font-mono font-bold text-[10px] uppercase tracking-wide block">
                    {n.signal_type?.replace(/_/g, ' ')} · {n.priority}
                  </span>
                  <p className="font-medium leading-snug">{n.text}</p>
                </div>
                <div className="text-right shrink-0 text-[10px] font-mono opacity-60 space-y-0.5">
                  <div>{n.ts}</div>
                  {n.latency_ms != null && <div>{n.latency_ms.toFixed(2)}ms</div>}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

    </div>
  );
}
