import React, { useState, useEffect, useRef } from 'react';
import { 
  CheckCircle2, 
  Zap, 
  ShieldCheck, 
  Search, 
  Terminal, 
  FileText, 
  Smile, 
  AlertTriangle, 
  ShoppingCart, 
  ChevronDown, 
  Play, 
  Pause,
  ArrowUpRight,
  Database,
  Cpu,
  Layers,
  Radio
} from 'lucide-react';

export default function DashboardPage({ activeTab, setActiveTab }) {
  const [isPlayingAudio, setIsPlayingAudio] = useState(true);
  const [selectedDoc, setSelectedDoc] = useState('Policy_42.pdf');
  const [searchQuery, setSearchQuery] = useState('loan early repayment penalty');
  const [timeFilter, setTimeFilter] = useState('Last 24 Hours');
  const [activeCallTimer, setActiveCallTimer] = useState('02:45');

  // Auto scroll to section if triggered by navigation
  const knowledgeRef = useRef(null);
  const architectureRef = useRef(null);
  const analyticsRef = useRef(null);
  const insightsRef = useRef(null);

  useEffect(() => {
    if (activeTab === 'knowledge' && knowledgeRef.current) {
      knowledgeRef.current.scrollIntoView({ behavior: 'smooth' });
    } else if (activeTab === 'architecture' && architectureRef.current) {
      architectureRef.current.scrollIntoView({ behavior: 'smooth' });
    } else if (activeTab === 'analytics' && analyticsRef.current) {
      analyticsRef.current.scrollIntoView({ behavior: 'smooth' });
    } else if (activeTab === 'insights' && insightsRef.current) {
      insightsRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [activeTab]);

  return (
    <div className="min-h-screen bg-[#090A0F] text-slate-100 py-10 px-4 sm:px-6 lg:px-12 space-y-16 max-w-[1440px] mx-auto">
      
      {/* ─────────────────────────────────────────────────────────────
          SECTION 1: HERO LANDING & AI OPERATIONS CENTER (MOCKUP IMAGE 1)
      ───────────────────────────────────────────────────────────── */}
      <section className="grid grid-cols-1 lg:grid-cols-12 gap-10 items-center">
        
        {/* Left Hero Text & CTA */}
        <div className="lg:col-span-7 space-y-8">
          <div className="space-y-4">
            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-extrabold tracking-tight text-white leading-[1.1]">
              Production-Ready AI <br />
              Voice Systems. <br />
              <span className="text-blue-500 inline-block mt-1">Grounded. Real-Time.</span> <br />
              <span className="text-blue-500 inline-block">Enterprise-Grade.</span>
            </h1>
            
            <p className="text-base sm:text-lg text-slate-400 max-w-xl leading-relaxed pt-2">
              Deploy intelligent, latency-optimized voice agents that seamlessly connect to your enterprise data. Built for scale, security, and precision.
            </p>
          </div>

          {/* Action Buttons */}
          <div className="flex flex-wrap items-center gap-4 pt-2">
            <button 
              onClick={() => {
                if (architectureRef.current) {
                  architectureRef.current.scrollIntoView({ behavior: 'smooth' });
                }
              }}
              className="px-6 py-3.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-semibold text-sm transition-all shadow-lg shadow-blue-600/25 active:scale-95"
            >
              Launch Dashboard
            </button>
            <a 
              href="https://github.com" 
              target="_blank" 
              rel="noreferrer"
              className="px-6 py-3.5 rounded-xl border border-white/15 bg-white/5 hover:bg-white/10 text-white font-semibold text-sm transition-all active:scale-95"
            >
              View GitHub
            </a>
          </div>

          {/* Value Proposition Badges */}
          <div className="flex flex-wrap items-center gap-6 pt-4 text-xs sm:text-sm font-medium text-slate-300">
            <div className="flex items-center space-x-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-400" />
              <span>Production Ready</span>
            </div>
            <div className="flex items-center space-x-2">
              <Zap className="w-4 h-4 text-emerald-400" />
              <span>Low Latency</span>
            </div>
            <div className="flex items-center space-x-2">
              <ShieldCheck className="w-4 h-4 text-emerald-400" />
              <span>Enterprise Security</span>
            </div>
          </div>
        </div>

        {/* Right Hero Card: AI Operations Center */}
        <div className="lg:col-span-5">
          <div className="bg-[#12141C] border border-white/10 rounded-2xl p-6 shadow-2xl space-y-6 relative overflow-hidden">
            
            {/* Header with Live Badge */}
            <div className="flex items-center justify-between pb-2">
              <h2 className="text-lg font-bold text-white tracking-tight">AI Operations Center</h2>
              <div className="flex items-center space-x-1.5 px-2.5 py-1 rounded-full bg-blue-500/10 text-blue-400 border border-blue-500/30 text-xs font-semibold">
                <span className="w-1.5 h-1.5 rounded-full bg-blue-400 animate-ping"></span>
                <span>● Live</span>
              </div>
            </div>

            {/* Active Call Status Box */}
            <div className="bg-[#181B26] border border-white/5 rounded-xl p-4 space-y-2">
              <div className="flex items-center justify-between text-xs text-slate-400">
                <span className="font-semibold uppercase tracking-wider">Active Call</span>
                <span className="font-mono text-slate-300">{activeCallTimer}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-base font-bold text-white">Alex Johnson</span>
                <span className="text-xs font-bold text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20">
                  98% Confidence
                </span>
              </div>
            </div>

            {/* Live Call Transcript Bubble */}
            <div className="bg-[#0B0C10] border border-white/5 rounded-xl p-4 space-y-3 text-xs sm:text-sm">
              {/* User Message */}
              <div className="bg-white/5 border border-white/10 rounded-xl p-3 text-slate-200">
                <p>I need to check the loan policy for early repayment.</p>
              </div>

              {/* AI Response Message */}
              <div className="bg-blue-950/40 border border-blue-500/40 rounded-xl p-3 text-blue-100 shadow-sm shadow-blue-500/10">
                <p>Certainly. Based on Policy_42, there is no penalty for early repayment.</p>
              </div>
            </div>

            {/* Audio Waveform Animation */}
            <div className="flex items-center justify-center space-x-1.5 py-3">
              <span className="w-1 bg-blue-400 rounded-full h-4 animate-bounce" style={{ animationDelay: '0ms' }}></span>
              <span className="w-1 bg-blue-500 rounded-full h-8 animate-bounce" style={{ animationDelay: '150ms' }}></span>
              <span className="w-1 bg-white rounded-full h-6 animate-bounce" style={{ animationDelay: '300ms' }}></span>
              <span className="w-1 bg-blue-400 rounded-full h-10 animate-bounce" style={{ animationDelay: '450ms' }}></span>
              <span className="w-1 bg-blue-500 rounded-full h-5 animate-bounce" style={{ animationDelay: '200ms' }}></span>
              <span className="w-1 bg-white rounded-full h-7 animate-bounce" style={{ animationDelay: '350ms' }}></span>
            </div>

          </div>
        </div>

      </section>

      {/* ─────────────────────────────────────────────────────────────
          SECTION 2: SYSTEM ANALYTICS (MOCKUP IMAGE 2)
      ───────────────────────────────────────────────────────────── */}
      <section ref={analyticsRef} className="space-y-6">
        <div className="bg-[#12141C] border border-white/10 rounded-2xl p-6 sm:p-8 shadow-2xl space-y-6">
          
          {/* Header & Filter */}
          <div className="flex items-center justify-between border-b border-white/5 pb-4">
            <h2 className="text-2xl font-bold text-white tracking-tight">System Analytics</h2>
            <div className="flex items-center space-x-2 text-xs text-slate-400 bg-white/5 px-3 py-1.5 rounded-lg border border-white/10 cursor-pointer">
              <span>{timeFilter}</span>
              <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
            </div>
          </div>

          {/* Top 3 Stat Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Metric 1 */}
            <div className="bg-[#171A24] border border-white/5 rounded-xl p-5 space-y-2">
              <span className="text-xs font-medium text-slate-400">Calls Handled</span>
              <div className="text-3xl font-extrabold text-white">124k</div>
            </div>

            {/* Metric 2 */}
            <div className="bg-[#171A24] border border-white/5 rounded-xl p-5 space-y-2">
              <span className="text-xs font-medium text-slate-400">Success Rate</span>
              <div className="text-3xl font-extrabold text-emerald-400">99.4%</div>
            </div>

            {/* Metric 3 */}
            <div className="bg-[#171A24] border border-white/5 rounded-xl p-5 space-y-2">
              <span className="text-xs font-medium text-slate-400">Avg Latency (ms)</span>
              <div className="text-3xl font-extrabold text-white">140</div>
            </div>
          </div>

          {/* Dual Chart Visualizations */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 pt-2">
            
            {/* Chart Panel 1: Call Volume */}
            <div className="bg-[#171A24] border border-white/5 rounded-xl p-6 space-y-4">
              <h3 className="text-sm font-semibold text-slate-300">Call Volume</h3>
              <div className="h-44 flex items-end justify-between gap-2 pt-4 px-2">
                {[35, 45, 60, 50, 75, 90, 85, 100, 115, 110, 124].map((val, idx) => (
                  <div key={idx} className="flex-1 flex flex-col items-center gap-2 group">
                    <div 
                      className="w-full bg-blue-600/60 group-hover:bg-blue-500 rounded-t-sm transition-all duration-300"
                      style={{ height: `${(val / 124) * 100}%` }}
                    ></div>
                  </div>
                ))}
              </div>
            </div>

            {/* Chart Panel 2: Latency Trends */}
            <div className="bg-[#171A24] border border-white/5 rounded-xl p-6 space-y-4">
              <h3 className="text-sm font-semibold text-slate-300">Latency Trends (ms)</h3>
              <div className="h-44 relative flex items-center justify-center pt-4">
                <svg className="w-full h-full overflow-visible" viewBox="0 0 400 150">
                  <path 
                    d="M 0 110 Q 50 90, 100 85 T 200 60 T 300 45 T 400 40" 
                    fill="none" 
                    stroke="#3B82F6" 
                    strokeWidth="3"
                  />
                  <path 
                    d="M 0 110 Q 50 90, 100 85 T 200 60 T 300 45 T 400 40 L 400 150 L 0 150 Z" 
                    fill="url(#blueGradient)" 
                    opacity="0.2"
                  />
                  <defs>
                    <linearGradient id="blueGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#3B82F6" />
                      <stop offset="100%" stopColor="#3B82F6" stopOpacity="0" />
                    </linearGradient>
                  </defs>
                </svg>
              </div>
            </div>

          </div>

        </div>
      </section>

      {/* ─────────────────────────────────────────────────────────────
          SECTION 3: ENTERPRISE KNOWLEDGE RETRIEVAL (MOCKUP IMAGE 3 - TOP)
      ───────────────────────────────────────────────────────────── */}
      <section ref={knowledgeRef} className="space-y-6">
        <div className="space-y-2">
          <h2 className="text-2xl font-bold text-white tracking-tight">Enterprise Knowledge Retrieval</h2>
          <p className="text-sm text-slate-400 max-w-2xl">
            Securely index and retrieve complex enterprise documents with robust access controls and semantic understanding.
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          
          {/* Left Panel: Search & Document Match Selector */}
          <div className="lg:col-span-4 bg-[#12141C] border border-white/10 rounded-2xl p-5 space-y-4">
            
            {/* Search Input Bar */}
            <div className="relative">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
              <input 
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-[#0B0C10] border border-white/10 rounded-xl pl-9 pr-3 py-2 text-xs sm:text-sm text-white focus:outline-none focus:border-blue-500 transition-colors"
                placeholder="Search knowledge base..."
              />
            </div>

            {/* Document Match Cards */}
            <div className="space-y-3 pt-2">
              
              {/* Doc 1 */}
              <div 
                onClick={() => setSelectedDoc('Policy_42.pdf')}
                className={`p-3.5 rounded-xl border transition-all cursor-pointer space-y-1.5 ${
                  selectedDoc === 'Policy_42.pdf'
                    ? 'bg-[#1A1D2A] border-blue-500/50 shadow-md'
                    : 'bg-[#171A24] border-white/5 hover:border-white/20'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-sm text-white">Policy_42.pdf</span>
                  <span className="text-[11px] font-bold text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20">
                    98% Match
                  </span>
                </div>
                <p className="text-xs text-slate-400 line-clamp-1">
                  Section 4.7 Early Repayment Conditions...
                </p>
              </div>

              {/* Doc 2 */}
              <div 
                onClick={() => setSelectedDoc('Terms_2023.docx')}
                className={`p-3.5 rounded-xl border transition-all cursor-pointer space-y-1.5 ${
                  selectedDoc === 'Terms_2023.docx'
                    ? 'bg-[#1A1D2A] border-blue-500/50 shadow-md'
                    : 'bg-[#171A24] border-white/5 hover:border-white/20'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-sm text-slate-300">Terms_2023.docx</span>
                  <span className="text-[11px] font-bold text-slate-400 bg-white/5 px-2 py-0.5 rounded border border-white/10">
                    76% Match
                  </span>
                </div>
                <p className="text-xs text-slate-500 line-clamp-1">
                  General terms and conditions regarding...
                </p>
              </div>

            </div>

          </div>

          {/* Right Panel: Selected Document Insight View */}
          <div className="lg:col-span-8 bg-[#12141C] border border-white/10 rounded-2xl p-6 space-y-6">
            
            {/* Header & Badges */}
            <div className="flex flex-wrap items-center justify-between gap-4 border-b border-white/5 pb-4">
              <div className="space-y-1">
                <div className="flex items-center space-x-2">
                  <FileText className="w-4 h-4 text-blue-400" />
                  <h3 className="text-lg font-bold text-white">{selectedDoc}</h3>
                </div>
                <p className="text-xs text-slate-400">
                  Last indexed: 2 hours ago • Size: 2.4 MB
                </p>
              </div>

              <div className="px-3 py-1 rounded-full bg-amber-500/10 text-amber-400 border border-amber-500/30 text-xs font-semibold flex items-center space-x-1.5">
                <ShieldCheck className="w-3.5 h-3.5" />
                <span>PII Redacted</span>
              </div>
            </div>

            {/* Metadata Stats Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="bg-[#171A24] border border-white/5 rounded-xl p-3.5 space-y-1">
                <span className="text-xs text-slate-400">Total Chunks</span>
                <div className="text-lg font-bold text-white">1,248</div>
              </div>

              <div className="bg-[#171A24] border border-white/5 rounded-xl p-3.5 space-y-1">
                <span className="text-xs text-slate-400">Avg Chunk Size</span>
                <div className="text-lg font-bold text-white">512 tokens</div>
              </div>

              <div className="bg-[#171A24] border border-white/5 rounded-xl p-3.5 space-y-1">
                <span className="text-xs text-slate-400">Embeddings Model</span>
                <div className="text-sm font-bold text-blue-400 truncate">text-embedding-3-large</div>
              </div>
            </div>

            {/* Grounded Excerpt Box */}
            <div className="bg-[#0B0C10] border border-white/10 rounded-xl p-4 sm:p-5 space-y-2">
              <p className="text-xs sm:text-sm text-slate-300 font-mono italic leading-relaxed">
                "...In the event that the borrower wishes to settle the outstanding balance prior to the maturity date, no prepayment penalties or fees shall be applied, provided that notice is given at least 30 days in advance. This applies to all Class A and Class B loans originated after January 1, 2023..."
              </p>
            </div>

          </div>

        </div>
      </section>

      {/* ─────────────────────────────────────────────────────────────
          SECTION 4: VOICE AGENT ARCHITECTURE & TERMINAL LOGS (MOCKUP IMAGE 3 - MIDDLE)
      ───────────────────────────────────────────────────────────── */}
      <section ref={architectureRef} className="space-y-6">
        <h2 className="text-2xl font-bold text-white tracking-tight">Voice Agent Architecture</h2>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          
          {/* Left Panel: 3-Stage Pipeline Flow */}
          <div className="lg:col-span-5 bg-[#12141C] border border-white/10 rounded-2xl p-6 space-y-8 flex flex-col justify-center">
            
            {/* Step 1 */}
            <div className="flex items-start space-x-4">
              <div className="w-9 h-9 rounded-full bg-blue-500/10 border border-blue-500/30 flex items-center justify-center text-blue-400 shrink-0 mt-0.5">
                <Radio className="w-4 h-4" />
              </div>
              <div className="space-y-1">
                <h4 className="text-base font-bold text-white">1. Ingestion & STT</h4>
                <p className="text-xs text-slate-400 leading-relaxed">
                  Ultra-low latency streaming Speech-to-Text via WebRTC.
                </p>
              </div>
            </div>

            {/* Step 2 */}
            <div className="flex items-start space-x-4">
              <div className="w-9 h-9 rounded-full bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400 shrink-0 mt-0.5">
                <Database className="w-4 h-4" />
              </div>
              <div className="space-y-1">
                <h4 className="text-base font-bold text-white">2. Semantic Router & RAG</h4>
                <p className="text-xs text-slate-400 leading-relaxed">
                  Intent classification and vector search across Knowledge Base.
                </p>
              </div>
            </div>

            {/* Step 3 */}
            <div className="flex items-start space-x-4">
              <div className="w-9 h-9 rounded-full bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400 shrink-0 mt-0.5">
                <Cpu className="w-4 h-4" />
              </div>
              <div className="space-y-1">
                <h4 className="text-base font-bold text-white">3. Generation & TTS</h4>
                <p className="text-xs text-slate-400 leading-relaxed">
                  Context-aware response synthesis and natural voice generation.
                </p>
              </div>
            </div>

          </div>

          {/* Right Panel: Terminal Window agent_execution_log.sh */}
          <div className="lg:col-span-7 bg-[#0B0C10] border border-white/10 rounded-2xl overflow-hidden shadow-2xl font-mono text-xs">
            
            {/* Terminal Header */}
            <div className="bg-[#171922] px-4 py-3 border-b border-white/10 flex items-center space-x-2">
              <span className="w-3 h-3 rounded-full bg-red-500/80 inline-block"></span>
              <span className="w-3 h-3 rounded-full bg-amber-500/80 inline-block"></span>
              <span className="w-3 h-3 rounded-full bg-emerald-500/80 inline-block"></span>
              <span className="text-slate-400 font-semibold pl-2 text-[11px]">agent_execution_log.sh</span>
            </div>

            {/* Terminal Log Stream */}
            <div className="p-5 space-y-3 text-slate-300 overflow-x-auto">
              <div>
                <span className="text-emerald-400">[09:42:10.712]</span> <span className="text-white font-semibold">Event: STT_Final_Transcript</span>
              </div>
              <div className="pl-4 text-slate-400">
                └ Payload: "What is the penalty for early repayment?"
              </div>

              <div>
                <span className="text-amber-400">[09:42:10.145]</span> <span className="text-white font-semibold">Action: Semantic_Search (Query: 'early repayment penalty')</span>
              </div>
              <div className="pl-4 text-slate-400">
                └ Result: Found 3 chunks (Top match: Policy_42.pdf, 98%)
              </div>

              <div>
                <span className="text-amber-400">[09:42:10.280]</span> <span className="text-white font-semibold">Action: LLM_Synthesis (Context: Policy_42)</span>
              </div>

              <div>
                <span className="text-amber-400">[09:42:10.850]</span> <span className="text-white font-semibold">Event: TTS_Stream_Start</span>
              </div>
              <div className="pl-4 text-slate-400">
                └ Latency: 738ms (TTFB)
              </div>

              {/* Waiting Cursor */}
              <div className="pt-2">
                <div className="inline-block bg-red-950/30 border border-red-500/40 text-red-300 px-3 py-1 rounded text-[11px] animate-pulse">
                  Waiting for next user utterance...
                </div>
              </div>
            </div>

          </div>

        </div>
      </section>

      {/* ─────────────────────────────────────────────────────────────
          SECTION 5: LIVE INTELLIGENCE FEED (MOCKUP IMAGE 3 - BOTTOM)
      ───────────────────────────────────────────────────────────── */}
      <section ref={insightsRef} className="space-y-6">
        <h2 className="text-2xl font-bold text-white tracking-tight">Live Intelligence Feed</h2>

        <div className="space-y-3">
          
          {/* Feed Card 1 */}
          <div className="bg-[#12141C] border border-white/10 rounded-xl p-4 flex items-center justify-between transition-all hover:border-white/20">
            <div className="flex items-center space-x-3.5">
              <Smile className="w-5 h-5 text-slate-400" />
              <div>
                <h4 className="text-sm font-bold text-white">Positive Sentiment Shift</h4>
                <p className="text-xs text-slate-400">Caller sentiment increased from Neutral to Positive</p>
              </div>
            </div>
            <span className="text-xs text-slate-500 font-mono">3m ago</span>
          </div>

          {/* Feed Card 2: Highlighted */}
          <div className="bg-[#12141C] border border-emerald-500/40 rounded-xl p-4 flex items-center justify-between shadow-lg shadow-emerald-500/5">
            <div className="flex items-center space-x-3.5">
              <ShoppingCart className="w-5 h-5 text-emerald-400" />
              <div>
                <h4 className="text-sm font-bold text-white">Strong Buying Signal Detected</h4>
                <p className="text-xs text-slate-400">Session: ID986212 • Product: Premium Tier</p>
              </div>
            </div>
            <span className="text-xs text-emerald-400 font-semibold">Just now</span>
          </div>

          {/* Feed Card 3 */}
          <div className="bg-[#12141C] border border-white/10 rounded-xl p-4 flex items-center justify-between transition-all hover:border-white/20">
            <div className="flex items-center space-x-3.5">
              <AlertTriangle className="w-5 h-5 text-amber-400" />
              <div>
                <h4 className="text-sm font-bold text-white">Compliance Review Suggested</h4>
                <p className="text-xs text-slate-400">Agent deviated from standard script in Section 4</p>
              </div>
            </div>
            <span className="text-xs text-slate-500 font-mono">9m ago</span>
          </div>

          {/* Feed Card 4 */}
          <div className="bg-[#12141C] border border-white/10 rounded-xl p-4 flex items-center justify-between transition-all hover:border-white/20">
            <div className="flex items-center space-x-3.5">
              <Smile className="w-5 h-5 text-slate-400" />
              <div>
                <h4 className="text-sm font-bold text-white">Positive Sentiment Shift</h4>
                <p className="text-xs text-slate-400">Caller sentiment increased from Neutral to Positive</p>
              </div>
            </div>
            <span className="text-xs text-slate-500 font-mono">1h ago</span>
          </div>

        </div>
      </section>

    </div>
  );
}
