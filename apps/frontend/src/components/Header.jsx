import React from 'react';
import { Radio, Database, Globe, Zap, ShieldCheck, Sparkles, CheckCircle2 } from 'lucide-react';

export default function Header({ activeTab, setActiveTab }) {
  const tabs = [
    { id: 'voice-console', label: 'Live Voice Agent', icon: Radio, badge: 'Interactive' },
    { id: 'knowledge-base', label: 'Knowledge Base & RAG', icon: Database, badge: '84 Chunks' },
    { id: 'native-bots', label: 'Multi-Lingual Matrix', icon: Globe, badge: 'PH & ID' },
    { id: 'live-insights', label: 'Signals & CRM', icon: Zap, badge: 'Live ML' },
    { id: 'eval-suite', label: 'Evaluation Suite', icon: ShieldCheck, badge: 'Tests' },
  ];

  return (
    <header className="sticky top-0 z-50 bg-slate-900 text-white border-b border-slate-800 shadow-lg">
      {/* Top Operational Metrics Bar */}
      <div className="bg-darwix-900/90 border-b border-darwix-800/60 px-4 py-1.5 text-xs">
        <div className="max-w-7xl mx-auto flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center space-x-2">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping"></span>
            <span className="font-extrabold text-emerald-400 tracking-wider">VEYRA VOICE SLM ENGINE</span>
            <span className="text-slate-400 hidden sm:inline">| FAISS 3072d + Gemini 2.5 Flash</span>
          </div>

          <div className="flex items-center space-x-4 text-[11px]">
            <span className="flex items-center space-x-1">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400"></span>
              <strong className="text-white">45 Live Calls</strong>
            </span>
            <span className="hidden md:inline text-slate-400">1,398 actions/hr</span>
            <span className="hidden lg:inline text-slate-400">22 Regional Languages</span>
            <span className="text-emerald-400 font-bold">&lt; 350ms SLM</span>
          </div>
        </div>
      </div>

      {/* Main App Navigation Bar */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          
          {/* Logo */}
          <div className="flex items-center space-x-3 cursor-pointer" onClick={() => setActiveTab('voice-console')}>
            <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-darwix-500 to-darwix-glow p-0.5 shadow-darwix-glow flex items-center justify-center">
              <div className="w-full h-full bg-darwix-900 rounded-[10px] flex items-center justify-center">
                <svg className="w-5 h-5 text-darwix-300 animate-spin-slow" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <path d="M12 2v4m0 12v4M4.93 4.93l2.83 2.83m8.48 8.48l2.83 2.83M2 12h4m12 0h4M4.93 19.07l2.83-2.83m8.48-8.48l2.83-2.83" strokeLinecap="round" />
                </svg>
              </div>
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <span className="text-lg font-extrabold tracking-tight text-white">Veyra</span>
                <span className="px-2 py-0.5 text-[9px] font-extrabold uppercase tracking-widest rounded-md bg-darwix-500/20 text-darwix-300 border border-darwix-500/30">
                  Voice Agent Studio
                </span>
              </div>
            </div>
          </div>

          {/* Nav Tabs */}
          <nav className="hidden md:flex items-center space-x-1.5">
            {tabs.map((tab) => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all flex items-center space-x-2 ${
                    isActive
                      ? 'bg-darwix-500 text-white shadow-lg shadow-darwix-500/30 scale-105'
                      : 'text-slate-300 hover:text-white hover:bg-slate-800'
                  }`}
                >
                  <Icon className={`w-3.5 h-3.5 ${isActive ? 'text-white' : 'text-slate-400'}`} />
                  <span>{tab.label}</span>
                </button>
              );
            })}
          </nav>

          {/* Right Status */}
          <div className="flex items-center space-x-3">
            <div className="flex items-center space-x-2 px-3 py-1.5 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs font-bold">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
              <span className="hidden sm:inline">RAG Backend Connected</span>
            </div>
          </div>

        </div>

        {/* Mobile Navigation */}
        <div className="flex md:hidden overflow-x-auto py-2 space-x-2 border-t border-slate-800">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold whitespace-nowrap flex items-center space-x-1.5 ${
                  isActive ? 'bg-darwix-500 text-white' : 'bg-slate-800 text-slate-300'
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>
      </div>
    </header>
  );
}
