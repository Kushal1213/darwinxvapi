import React, { useState, useEffect } from 'react';
import { Sun, Moon, Settings, BookOpen, Github } from 'lucide-react';

export default function AppLayout({ activeTab, setActiveTab, children }) {
  const [theme, setTheme] = useState('dark');

  useEffect(() => {
    if (theme === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [theme]);

  const navItems = [
    { id: 'dashboard', label: 'Dashboard' },
    { id: 'knowledge', label: 'Knowledge Base' },
    { id: 'agents', label: 'Voice Agents' },
    { id: 'insights', label: 'Live Insights' },
    { id: 'analytics', label: 'Analytics' },
    { id: 'architecture', label: 'Architecture' },
  ];

  return (
    <div className={`min-h-screen transition-colors duration-300 font-sans antialiased flex flex-col ${
      theme === 'dark' ? 'bg-[#090A0F] text-[#F8FAFC]' : 'bg-[#F8F9FE] text-[#0F172A]'
    }`}>
      
      {/* ─────────────────────────────────────────────────────────────
          HEADER NAVBAR — MATCHING MOCKUP EXACTLY
      ───────────────────────────────────────────────────────────── */}
      <header className={`h-16 border-b sticky top-0 z-50 transition-colors duration-300 ${
        theme === 'dark' 
          ? 'bg-[#090A0F]/95 border-white/10' 
          : 'bg-white/95 border-slate-200 shadow-sm'
      } backdrop-blur-md`}>
        <div className="max-w-[1440px] h-full mx-auto px-6 flex items-center justify-between">
          
          {/* Brand Logo */}
          <div 
            onClick={() => setActiveTab('dashboard')}
            className="flex items-center space-x-3 cursor-pointer group"
          >
            <span className={`text-xl font-bold tracking-tight ${
              theme === 'dark' ? 'text-white' : 'text-[#0F172A]'
            }`}>
              Veyra
            </span>
          </div>

          {/* Navigation Links */}
          <nav className="hidden lg:flex items-center space-x-1 sm:space-x-2">
            {navItems.map((item) => {
              const isActive = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => setActiveTab(item.id)}
                  className={`relative px-3.5 py-1.5 text-sm font-medium transition-all duration-200 rounded-md ${
                    isActive
                      ? 'text-white border-b-2 border-blue-500 font-semibold'
                      : theme === 'dark'
                        ? 'text-slate-400 hover:text-white'
                        : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  <span>{item.label}</span>
                </button>
              );
            })}
          </nav>

          {/* Right Action Buttons */}
          <div className="flex items-center space-x-3">
            <a 
              href="#docs" 
              className={`hidden sm:inline-flex items-center space-x-1.5 px-3 py-1.5 rounded-lg border text-xs font-semibold transition-all ${
                theme === 'dark' 
                  ? 'border-white/15 bg-white/5 text-white hover:bg-white/10' 
                  : 'border-slate-300 bg-slate-100 text-slate-700 hover:bg-slate-200'
              }`}
            >
              <span>Documentation</span>
            </a>

            <a 
              href="https://github.com/Kushal1213"
              target="_blank" 
              rel="noreferrer"
              className={`hidden sm:inline-flex items-center space-x-1.5 px-3 py-1.5 rounded-lg border text-xs font-semibold transition-all ${
                theme === 'dark' 
                  ? 'border-white/15 bg-white/5 text-white hover:bg-white/10' 
                  : 'border-slate-300 bg-slate-100 text-slate-700 hover:bg-slate-200'
              }`}
            >
              <span>GitHub</span>
            </a>

            {/* Dark / Light Mode Switcher */}
            <button
              onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
              className={`p-2 rounded-lg border transition-all ${
                theme === 'dark'
                  ? 'bg-white/5 border-white/10 text-slate-300 hover:text-white hover:bg-white/10'
                  : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-100'
              }`}
              title={`Switch to ${theme === 'dark' ? 'Light' : 'Dark'} Mode`}
            >
              {theme === 'dark' ? <Moon className="w-4 h-4" /> : <Sun className="w-4 h-4" />}
            </button>

            {/* Settings Icon */}
            <button
              className={`p-2 rounded-lg border transition-all ${
                theme === 'dark'
                  ? 'bg-white/5 border-white/10 text-slate-300 hover:text-white hover:bg-white/10'
                  : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-100'
              }`}
              title="Settings"
            >
              <Settings className="w-4 h-4" />
            </button>
          </div>

        </div>

        {/* Mobile Nav Drawer / Horizontal Scroll */}
        <div className="flex lg:hidden overflow-x-auto px-4 py-2 space-x-2 border-t border-white/10 bg-[#090A0F]/90">
          {navItems.map((item) => (
            <button
              key={item.id}
              onClick={() => setActiveTab(item.id)}
              className={`px-3 py-1 text-xs rounded-md whitespace-nowrap ${
                activeTab === item.id ? 'bg-blue-600 text-white' : 'text-slate-400 bg-white/5'
              }`}
            >
              {item.label}
            </button>
          ))}
        </div>
      </header>

      {/* Main Workspace Container */}
      <main className="flex-1 w-full">
        {children}
      </main>

      {/* ─────────────────────────────────────────────────────────────
          FOOTER — MATCHING MOCKUP IMAGE 2 EXACTLY
      ───────────────────────────────────────────────────────────── */}
      <footer className={`border-t py-12 px-6 transition-colors duration-300 ${
        theme === 'dark'
          ? 'bg-[#0E0F14] border-white/10 text-slate-400'
          : 'bg-white border-slate-200 text-slate-600'
      }`}>
        <div className="max-w-[1440px] mx-auto space-y-6">
          <div className="space-y-2">
            <h3 className="text-xl font-bold text-white tracking-tight">Veyra</h3>
            <p className="text-sm text-slate-400">
              © 2024 Veyra. AI agents that understand every customer conversation.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-6 pt-4 text-sm text-slate-400">
            <a href="#" className="hover:text-white transition-colors">Documentation</a>
            <a href="#" className="hover:text-white transition-colors">Privacy Policy</a>
            <a href="#" className="hover:text-white transition-colors">Terms of Service</a>
            <a href="#" className="hover:text-white transition-colors">API Reference</a>
            <a href="#" className="hover:text-white transition-colors">Status</a>
            <a href="#" className="hover:text-white transition-colors">Support</a>
          </div>
        </div>
      </footer>

    </div>
  );
}
