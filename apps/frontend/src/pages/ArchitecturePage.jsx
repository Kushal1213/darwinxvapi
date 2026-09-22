import React, { useState } from 'react';
import { 
  Radio, 
  Database, 
  Cpu, 
  Terminal, 
  Layers, 
  CheckCircle2, 
  ShieldCheck, 
  Zap, 
  Activity, 
  Server,
  ArrowRight,
  RefreshCw
} from 'lucide-react';

export default function ArchitecturePage() {
  const [activeStep, setActiveStep] = useState(1);
  const [logs, setLogs] = useState([
    { time: '09:42:10.712', type: 'event', text: 'Event: STT_Final_Transcript', payload: '"What is the penalty for early repayment?"' },
    { time: '09:42:10.145', type: 'action', text: 'Action: Semantic_Search (Query: \'early repayment penalty\')', payload: 'Result: Found 3 chunks (Top match: Policy_42.pdf, 98%)' },
    { time: '09:42:10.280', type: 'action', text: 'Action: LLM_Synthesis (Context: Policy_42)', payload: 'Selected Prompt: Financial Policy Guidance' },
    { time: '09:42:10.850', type: 'event', text: 'Event: TTS_Stream_Start', payload: 'Latency: 738ms (TTFB)' },
  ]);

  return (
    <div className="min-h-screen bg-[#090A0F] text-slate-100 py-10 px-4 sm:px-6 lg:px-12 space-y-12 max-w-[1440px] mx-auto">
      
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-white/10 pb-6">
        <div>
          <h1 className="text-3xl font-extrabold text-white tracking-tight">Voice Agent Architecture</h1>
          <p className="text-sm text-slate-400 mt-1">
            Real-time streaming pipeline architecture powered by WebRTC, FAISS Vector Search, Gemini 2.5 Flash & Deepgram Nova-2
          </p>
        </div>

        <div className="flex items-center space-x-3">
          <div className="px-3 py-1 rounded-full bg-blue-500/10 text-blue-400 border border-blue-500/30 text-xs font-semibold flex items-center space-x-1.5">
            <Activity className="w-3.5 h-3.5" />
            <span>TTFB Latency: 320ms</span>
          </div>
          <div className="px-3 py-1 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 text-xs font-semibold flex items-center space-x-1.5">
            <CheckCircle2 className="w-3.5 h-3.5" />
            <span>SLM Active</span>
          </div>
        </div>
      </div>

      {/* ─────────────────────────────────────────────────────────────
          1. PIPELINE STAGE CARDS
      ───────────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        
        {/* Stage 1 */}
        <div 
          onClick={() => setActiveStep(1)}
          className={`p-6 rounded-2xl border transition-all cursor-pointer space-y-4 ${
            activeStep === 1 
              ? 'bg-[#141724] border-blue-500/50 shadow-lg shadow-blue-500/10 ring-1 ring-blue-500/30' 
              : 'bg-[#12141C] border-white/10 hover:border-white/20'
          }`}
        >
          <div className="flex items-center justify-between">
            <div className="w-10 h-10 rounded-xl bg-blue-500/10 border border-blue-500/30 flex items-center justify-center text-blue-400">
              <Radio className="w-5 h-5" />
            </div>
            <span className="text-xs font-mono font-bold text-slate-400">STAGE 01</span>
          </div>
          <div>
            <h3 className="text-lg font-bold text-white">1. Ingestion & STT</h3>
            <p className="text-xs text-slate-400 mt-1 leading-relaxed">
              Ultra-low latency streaming Speech-to-Text via WebRTC audio stream & Deepgram Nova-2 ASR engine.
            </p>
          </div>
          <div className="pt-2 text-xs font-semibold text-blue-400 flex items-center space-x-1">
            <span>Learn STT Spec</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </div>
        </div>

        {/* Stage 2 */}
        <div 
          onClick={() => setActiveStep(2)}
          className={`p-6 rounded-2xl border transition-all cursor-pointer space-y-4 ${
            activeStep === 2 
              ? 'bg-[#141724] border-emerald-500/50 shadow-lg shadow-emerald-500/10 ring-1 ring-emerald-500/30' 
              : 'bg-[#12141C] border-white/10 hover:border-white/20'
          }`}
        >
          <div className="flex items-center justify-between">
            <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
              <Database className="w-5 h-5" />
            </div>
            <span className="text-xs font-mono font-bold text-slate-400">STAGE 02</span>
          </div>
          <div>
            <h3 className="text-lg font-bold text-white">2. Semantic Router & RAG</h3>
            <p className="text-xs text-slate-400 mt-1 leading-relaxed">
              Intent classification and FAISS 3072d vector search across grounded enterprise documents.
            </p>
          </div>
          <div className="pt-2 text-xs font-semibold text-emerald-400 flex items-center space-x-1">
            <span>Inspect Vector Store</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </div>
        </div>

        {/* Stage 3 */}
        <div 
          onClick={() => setActiveStep(3)}
          className={`p-6 rounded-2xl border transition-all cursor-pointer space-y-4 ${
            activeStep === 3 
              ? 'bg-[#141724] border-amber-500/50 shadow-lg shadow-amber-500/10 ring-1 ring-amber-500/30' 
              : 'bg-[#12141C] border-white/10 hover:border-white/20'
          }`}
        >
          <div className="flex items-center justify-between">
            <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400">
              <Cpu className="w-5 h-5" />
            </div>
            <span className="text-xs font-mono font-bold text-slate-400">STAGE 03</span>
          </div>
          <div>
            <h3 className="text-lg font-bold text-white">3. Generation & TTS</h3>
            <p className="text-xs text-slate-400 mt-1 leading-relaxed">
              Context-aware LLM response synthesis and ultra-natural neural text-to-speech voice output.
            </p>
          </div>
          <div className="pt-2 text-xs font-semibold text-amber-400 flex items-center space-x-1">
            <span>View Synthesis Config</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </div>
        </div>

      </div>

      {/* ─────────────────────────────────────────────────────────────
          2. LIVE EXECUTION TERMINAL WINDOW (agent_execution_log.sh)
      ───────────────────────────────────────────────────────────── */}
      <div className="bg-[#12141C] border border-white/10 rounded-2xl overflow-hidden shadow-2xl space-y-0">
        <div className="bg-[#171922] px-6 py-4 border-b border-white/10 flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <span className="w-3.5 h-3.5 rounded-full bg-red-500 inline-block"></span>
            <span className="w-3.5 h-3.5 rounded-full bg-amber-500 inline-block"></span>
            <span className="w-3.5 h-3.5 rounded-full bg-emerald-500 inline-block"></span>
            <span className="text-slate-300 font-mono font-bold pl-3 text-xs">agent_execution_log.sh</span>
          </div>
          
          <button 
            onClick={() => {
              setLogs((prev) => [
                ...prev,
                { time: new Date().toLocaleTimeString(), type: 'event', text: 'Event: STT_Interim_Utterance', payload: '"Can I apply online?"' },
                { time: new Date().toLocaleTimeString(), type: 'action', text: 'Action: Semantic_Search (Query: \'online application process\')', payload: 'Result: Found 2 chunks (Top match: Terms_2023.docx, 84%)' }
              ]);
            }}
            className="px-3 py-1 rounded bg-white/5 border border-white/10 text-slate-300 text-xs font-mono flex items-center space-x-1.5 hover:bg-white/10"
          >
            <RefreshCw className="w-3 h-3 text-blue-400" />
            <span>Simulate Step</span>
          </button>
        </div>

        <div className="p-6 font-mono text-xs sm:text-sm space-y-4 bg-[#0B0C10] text-slate-200">
          {logs.map((log, index) => (
            <div key={index} className="space-y-1">
              <div>
                <span className={log.type === 'event' ? 'text-emerald-400' : 'text-amber-400'}>
                  [{log.time}]
                </span>{' '}
                <span className="font-bold text-white">{log.text}</span>
              </div>
              {log.payload && (
                <div className="pl-6 text-slate-400">
                  └ {log.payload}
                </div>
              )}
            </div>
          ))}

          <div className="pt-3">
            <div className="inline-block bg-red-950/30 border border-red-500/40 text-red-300 px-3 py-1.5 rounded text-xs font-mono animate-pulse">
              Waiting for next user utterance...
            </div>
          </div>
        </div>
      </div>

    </div>
  );
}
