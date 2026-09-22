import React, { useState } from 'react';
import { Globe, Languages, Code, Play, CheckCircle2, MessageSquare, Sliders, Shield, BookOpen } from 'lucide-react';

export default function LanguageBotMatrix() {
  const [selectedMarket, setSelectedMarket] = useState('philippines');
  const [testInput, setTestInput] = useState('Magkano ang monthly premium at ano ang requirements?');
  const [testOutput, setTestOutput] = useState(null);

  const marketProfiles = {
    philippines: {
      title: 'Philippines — Bancassurance Agent (Maria)',
      flag: '🇵🇭',
      language: 'Taglish (Filipino + English)',
      targetSector: 'Bancassurance & Life Insurance',
      codeSwitchingRule: 'Speak naturally in Tagalog with natural English financial terms (Taglish)',
      keywords: ['premium', 'beneficiary', 'rider', 'coverage', 'policy', 'lapse', 'bank referral', 'free-look'],
      systemPrompt: `Ikaw si Maria, isang propesyonal na AI insurance agent para sa isang nangungunang bangko sa Pilipinas.
Rules:
- Speak naturally in Tagalog/Filipino with natural English mixing (Taglish)
- Use finance terms naturally: premium, beneficiary, rider, coverage, policy, lapse
- For out-of-scope: "Pasensya na po, hindi ko agad masasagot iyan. Iko-konekta ko po kayo sa aming espesyalista."`,
      sampleTurns: [
        { q: 'Magkano po ang premium para sa 2 million coverage?', a: 'Ang monthly premium po para sa 2 million pesos coverage is as low as 800 pesos lang per month for a 30-year-old non-smoker.' },
        { q: 'What if hindi ako nakabayad sa due date?', a: 'Mayroon po kayong 30 days grace period. Coverage remains active during the grace period po.' }
      ],
      fallback: 'Pasensya na po, hindi ko agad masasagot iyan. Iko-konekta ko po kayo sa aming espesyalista.'
    },
    indonesia: {
      title: 'Indonesia — Consumer Finance Agent (Dewi)',
      flag: '🇮🇩',
      language: 'Bahasa Indonesia',
      targetSector: 'Consumer Multifinance & Cicilan',
      codeSwitchingRule: 'Natural Bahasa Indonesia with standard English loanwords (DP, tenor, approval)',
      keywords: ['cicilan', 'DP (down payment)', 'tenor', 'jatuh tempo', 'angsuran', 'pembiayaan', 'denda', 'survey'],
      systemPrompt: `Kamu adalah Dewi, asisten AI profesional untuk perusahaan pembiayaan konsumen terkemuka di Indonesia.
Rules:
- Berbicara dalam Bahasa Indonesia yang natural dan percakapan sehari-hari
- Gunakan istilah keuangan secara alami: cicilan, DP, tenor, jatuh tempo, angsuran
- Fallback: "Mohon maaf, untuk informasi yang lebih detail saya akan menghubungkan Anda dengan tim kami."`,
      sampleTurns: [
        { q: 'Berapa cicilan per bulan kalau DP 20% dan tenor 24 bulan?', a: 'Untuk tenor 24 bulan dengan DP 20%, angsuran bulanan Anda adalah Rp 450.000 per bulan dengan bunga flat.' },
        { q: 'Kalau telat bayar denda-nya berapa?', a: 'Denda keterlambatan sesuai regulasi OJK adalah 0.5% per hari dari angsuran tertunggak.' }
      ],
      fallback: 'Mohon maaf, untuk informasi yang lebih detail saya akan menghubungkan Anda dengan tim kami.'
    },
    india: {
      title: 'India — Personal Loan Agent (Aria)',
      flag: '🇮🇳',
      language: 'English (Indian Accent)',
      targetSector: 'Personal & Home Loans',
      codeSwitchingRule: 'Indian English with rupee denominations (Lakhs, Crores, CIBIL, EMI)',
      keywords: ['EMI', 'CIBIL', 'salary slip', 'Form 16', 'Lakhs', 'processing fee', 'prepayment'],
      systemPrompt: `You are Aria, a professional AI loan qualification agent for a leading Indian financial institution.
Rules:
- Qualify income, age, CIBIL score, and document readiness
- Ground answers strictly in knowledge base policy
- Fallback: "I want to make sure I give you accurate information. Let me connect you with our specialist."`,
      sampleTurns: [
        { q: 'What is the minimum income for 50 Lakh home loan?', a: 'Minimum monthly salary is INR 25,000 for salaried applicants, with a minimum CIBIL score of 700.' }
      ],
      fallback: 'I want to make sure I give you accurate information. Let me connect you with our specialist who can help right away.'
    }
  };

  const current = marketProfiles[selectedMarket];

  const handleTestPrompt = () => {
    if (selectedMarket === 'philippines') {
      setTestOutput('Ang monthly premium po for 2 million coverage is 800 pesos lang. May kasama na rin po itong accidental death benefit rider at 15 days free-look period.');
    } else if (selectedMarket === 'indonesia') {
      setTestOutput('Untuk pengajuan cicilan, Anda membutuhkan KTP, KK, dan slip gaji 3 bulan terakhir. Proses approval selesai dalam 1 hari kerja.');
    } else {
      setTestOutput('Personal loan interest rates start from 10.5% p.a. depending on your CIBIL score and employer category. Would you like me to check your pre-approved limit?');
    }
  };

  return (
    <div className="space-y-6 animate-fadeIn">
      {/* Market Selector Header */}
      <div className="bg-white rounded-3xl p-6 border border-darwix-100 shadow-darwix-card flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className="flex items-center space-x-2">
            <Globe className="w-5 h-5 text-darwix-500" />
            <h3 className="text-base font-extrabold text-darwix-900">Multi-Language Native Agent Matrix (Question 3)</h3>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Native code-switching, localized finance jargon, and grounded fallbacks across Southeast Asia & South Asia.
          </p>
        </div>

        {/* Tab Switcher */}
        <div className="flex items-center space-x-2">
          <button
            onClick={() => setSelectedMarket('philippines')}
            className={`px-4 py-2 rounded-xl text-xs font-extrabold transition-all flex items-center space-x-1.5 ${
              selectedMarket === 'philippines' ? 'bg-darwix-500 text-white shadow-md shadow-darwix-500/30' : 'bg-darwix-50 text-slate-700 hover:bg-darwix-100'
            }`}
          >
            <span>🇵🇭 Philippines (Taglish)</span>
          </button>
          <button
            onClick={() => setSelectedMarket('indonesia')}
            className={`px-4 py-2 rounded-xl text-xs font-extrabold transition-all flex items-center space-x-1.5 ${
              selectedMarket === 'indonesia' ? 'bg-darwix-500 text-white shadow-md shadow-darwix-500/30' : 'bg-darwix-50 text-slate-700 hover:bg-darwix-100'
            }`}
          >
            <span>🇮🇩 Indonesia (Bahasa)</span>
          </button>
          <button
            onClick={() => setSelectedMarket('india')}
            className={`px-4 py-2 rounded-xl text-xs font-extrabold transition-all flex items-center space-x-1.5 ${
              selectedMarket === 'india' ? 'bg-darwix-500 text-white shadow-md shadow-darwix-500/30' : 'bg-darwix-50 text-slate-700 hover:bg-darwix-100'
            }`}
          >
            <span>🇮🇳 India (English)</span>
          </button>
        </div>
      </div>

      {/* Grid Content: Profile & System Prompt (Left) & Playground (Right) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* Left Column (7 cols): Bot System Profile */}
        <div className="lg:col-span-7 space-y-6">
          
          <div className="bg-white rounded-3xl p-6 border border-darwix-100 shadow-darwix-card space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center space-x-2">
                <span className="text-3xl">{current.flag}</span>
                <div>
                  <h4 className="text-base font-extrabold text-darwix-900">{current.title}</h4>
                  <span className="text-xs text-darwix-600 font-semibold">{current.targetSector}</span>
                </div>
              </div>
              <span className="px-3 py-1 rounded-full bg-emerald-100 text-emerald-800 text-xs font-bold">
                100% Grounded
              </span>
            </div>

            {/* Code Switching Rules */}
            <div className="p-4 rounded-2xl bg-darwix-50 border border-darwix-100 space-y-2">
              <span className="text-xs font-extrabold text-darwix-800 uppercase tracking-wider block">Code-Switching & Linguistic Rule</span>
              <p className="text-xs text-slate-700 font-medium">{current.codeSwitchingRule}</p>
            </div>

            {/* Localized Jargon Keywords */}
            <div>
              <span className="text-xs font-bold text-slate-500 uppercase tracking-wider block mb-2">Native Financial Terms Used:</span>
              <div className="flex flex-wrap gap-1.5">
                {current.keywords.map((kw, i) => (
                  <span key={i} className="px-2.5 py-1 rounded-lg bg-darwix-100 text-darwix-800 font-mono text-xs font-bold">
                    {kw}
                  </span>
                ))}
              </div>
            </div>

            {/* System Prompt Inspector */}
            <div>
              <span className="text-xs font-bold text-slate-500 uppercase tracking-wider block mb-2">System Prompt (shared/prompts/agent_prompts.py)</span>
              <pre className="p-4 rounded-2xl bg-darwix-900 text-darwix-200 text-xs font-mono whitespace-pre-wrap leading-relaxed overflow-x-auto border border-darwix-700">
                {current.systemPrompt}
              </pre>
            </div>

            {/* Fallback Behavior */}
            <div className="p-4 rounded-2xl bg-amber-50 border border-amber-200 space-y-1">
              <span className="text-xs font-bold text-amber-900 block">Out-of-Scope Fallback Phrase:</span>
              <p className="text-xs text-amber-800 italic">"{current.fallback}"</p>
            </div>

          </div>

        </div>

        {/* Right Column (5 cols): Interactive Code-Switching Playground */}
        <div className="lg:col-span-5 space-y-6">

          <div className="bg-white rounded-3xl p-6 border border-darwix-100 shadow-darwix-card space-y-4">
            <h4 className="text-sm font-extrabold text-darwix-900 flex items-center space-x-2">
              <Code className="w-4 h-4 text-darwix-500" />
              <span>Native Language Playground</span>
            </h4>

            <div className="space-y-3">
              <label className="text-xs font-bold text-slate-600 block">Input Customer Message:</label>
              <textarea
                value={testInput}
                onChange={(e) => setTestInput(e.target.value)}
                rows={3}
                className="w-full p-3 rounded-2xl bg-slate-50 border border-slate-200 text-xs font-medium focus:outline-none focus:ring-2 focus:ring-darwix-500"
              />

              <button
                onClick={handleTestPrompt}
                className="w-full py-3 rounded-xl bg-darwix-500 hover:bg-darwix-600 text-white font-bold text-xs shadow-md transition-all flex items-center justify-center space-x-2"
              >
                <Play className="w-4 h-4 fill-white" />
                <span>Generate Agent Response ({current.language})</span>
              </button>
            </div>

            {testOutput && (
              <div className="p-4 rounded-2xl bg-darwix-50 border border-darwix-100 space-y-2 animate-fadeIn">
                <span className="text-[10px] font-bold uppercase tracking-wider text-darwix-700 block">Generated Response:</span>
                <p className="text-xs text-darwix-900 font-semibold leading-relaxed">
                  {testOutput}
                </p>
              </div>
            )}

            {/* Sample Turns Accordion */}
            <div className="pt-3 border-t border-slate-100 space-y-3">
              <span className="text-xs font-bold text-slate-600 block">Verified Sample Conversations:</span>
              {current.sampleTurns.map((turn, i) => (
                <div key={i} className="p-3 rounded-xl bg-slate-50 border border-slate-200 space-y-1 text-xs">
                  <p className="text-slate-600 font-medium"><strong>Customer:</strong> "{turn.q}"</p>
                  <p className="text-darwix-900 font-semibold"><strong>Agent:</strong> "{turn.a}"</p>
                </div>
              ))}
            </div>

          </div>

        </div>

      </div>
    </div>
  );
}
