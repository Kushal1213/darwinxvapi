import React, { useCallback, useEffect, useState } from 'react';
import { Zap, AlertTriangle, CheckCircle2, Flame, TrendingUp, Activity, MessageSquare, RefreshCw } from 'lucide-react';
import { io } from 'socket.io-client';

function formatTimestamp(timestamp) {
  if (!timestamp) return 'Just now';
  const date = new Date(timestamp);
  return Number.isNaN(date.getTime()) ? timestamp : date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
}

export default function InsightsPage() {
  const [selectedStream, setSelectedStream] = useState(null);
  const [liveCalls, setLiveCalls] = useState({});
  const [nudges, setNudges] = useState([]);

  const refreshLiveCalls = useCallback(async () => {
    const response = await fetch('/api/voice/live');
    if (!response.ok) throw new Error(`Live calls request failed (${response.status})`);
    const data = await response.json();
    const calls = Array.isArray(data.calls) ? data.calls : [];
    const callsById = Object.fromEntries(calls.map((call) => [call.id, call]));
    setLiveCalls(callsById);
    setSelectedStream((selected) => (
      selected && callsById[selected] ? selected : calls[0]?.id || null
    ));
  }, []);

  useEffect(() => {
    // Load the server-owned snapshot first. Socket.IO only sends events that
    // happen while this page is open, so relying on it alone lost calls created
    // in Voice Studio before an operator switched to Mission Control.
    refreshLiveCalls().catch(() => {});

    const socket = io({ path: '/socket.io', transports: ['websocket', 'polling'] });

    socket.on('connect', () => {
      // Recover from gateway restarts and short network interruptions.
      refreshLiveCalls().catch(() => {});
    });

    socket.on('insights:call:update', ({ call }) => {
      if (!call?.id) return;
      setLiveCalls((previous) => ({ ...previous, [call.id]: call }));
      setSelectedStream((selected) => selected || call.id);
    });

    socket.on('insights:call:ended', ({ call_id: callId }) => {
      if (!callId) return;
      setLiveCalls((previous) => {
        const { [callId]: _endedCall, ...remaining } = previous;
        return remaining;
      });
      setSelectedStream((selected) => selected === callId ? null : selected);
    });

    socket.on('nudge', (data) => {
      setNudges(prev => [
        {
          id: `${data.call_id || 'nudge'}-${Date.now()}`,
          signal_type: data.type,
          priority: data.priority,
          text: data.text,
          latency_ms: data.latency_ms,
          ts: new Date().toLocaleTimeString(),
        },
        ...prev.slice(0, 9), // keep last 10 nudges
      ]);

      // Give the operator immediate visual feedback; the following server
      // snapshot is still authoritative and will reconcile this state.
      if (!data.call_id) return;
      setLiveCalls((previous) => {
        const call = previous[data.call_id];
        if (!call) return previous;
        const isEscalation = data.type === 'human_escalation';
        const isFrustration = data.type === 'rising_frustration';
        const isCompliance = data.type === 'compliance_gap';
        return {
          ...previous,
          [data.call_id]: {
            ...call,
            frustration: isFrustration || isEscalation ? Math.max(call.frustration || 0, 0.5) : call.frustration,
            sentiment: isFrustration || isEscalation ? 'Negative' : call.sentiment,
            complianceRisk: isEscalation || isCompliance || call.complianceRisk,
            complianceRule: isEscalation ? 'SUPERVISOR_ESCALATION_REQUESTED' : isCompliance ? 'DISCLOSURE_NOT_GIVEN' : call.complianceRule,
          },
        };
      });
    });

    return () => socket.disconnect();
  }, [refreshLiveCalls]);

  const activeStreams = Object.values(liveCalls)
    .sort((left, right) => new Date(right.timestamp) - new Date(left.timestamp));
  const currentCall = activeStreams.find((stream) => stream.id === selectedStream) || activeStreams[0] || {
    id: null,
    customer: 'Waiting for a live agent',
    agent: '—',
    market: 'Live data will appear here automatically',
    intent: 'No active call streams',
    sentiment: 'Neutral',
    frustration: 0,
    buyingSignal: false,
    complianceRisk: false,
    complianceRule: 'NONE',
    latency: '—',
    query: '',
    answer: '',
  };

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
            <span>{activeStreams.length} Live Stream{activeStreams.length === 1 ? '' : 's'} Monitored</span>
          </span>
          <button
            type="button"
            onClick={() => refreshLiveCalls().catch(() => {})}
            className="p-2 rounded-lg dark:bg-[#151D30] bg-slate-100 dark:text-slate-300 text-slate-500 hover:text-[#5B5FFF] transition-colors"
            title="Refresh live calls"
            aria-label="Refresh live calls"
          >
            <RefreshCw className="w-3.5 h-3.5" />
          </button>
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
                  <span className="text-[10px] font-mono text-slate-400">{formatTimestamp(st.timestamp)}</span>
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
            {activeStreams.length === 0 && (
              <div className="p-5 rounded-xl border border-dashed dark:border-slate-700 border-slate-300 text-center text-xs text-slate-400">
                No active calls yet. Start a Voice Studio call and this list will update automatically.
              </div>
            )}
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
                  <p className="text-white font-medium line-clamp-2">"{currentCall.query || 'Waiting for the customer transcript…'}"</p>
                </div>

                <div className="p-2.5 rounded-lg dark:bg-[#0F172A] bg-white border dark:border-[rgba(255,255,255,0.06)] border-slate-200">
                  <span className="text-[10px] font-mono text-[#22C55E] font-bold block mb-0.5">ARIA GROUNDED RESPONSE</span>
                  <p className="text-slate-300 font-medium line-clamp-2">"{currentCall.answer || 'Waiting for the agent response…'}"</p>
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
                <span>{currentCall.id ? 'Zero Compliance Violations Detected' : 'Waiting for live telemetry'}</span>
              </div>
            )}

            {/* Snapshot refresh is useful after a gateway restart; normal updates arrive by Socket.IO. */}
            <div className="pt-1 flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => refreshLiveCalls().catch(() => {})}
                className="py-2 px-4 rounded-lg bg-[#5B5FFF] hover:bg-[#7C6CFF] text-white font-bold text-xs shadow-md transition-all flex items-center justify-center space-x-1.5"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                <span>Refresh Live Calls</span>
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
