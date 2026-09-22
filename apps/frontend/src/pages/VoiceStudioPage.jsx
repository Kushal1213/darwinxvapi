import React, { useState, useRef, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Mic, MicOff, PhoneOff, Phone, Sparkles, FileText, Database,
  Send, Volume2, Activity, Zap, CheckCircle2, AlertCircle, Globe,
  ArrowRight, Signal, Timer, ChevronDown
} from 'lucide-react';
import { io as socketIO } from 'socket.io-client';

// ─── Market Profiles ──────────────────────────────────────────
const MARKETS = {
  'india-loan':       { flag: '🇮🇳', name: 'India Loans',      agent: 'Aria',  lang: 'en-IN', color: '#5B5FFF' },
  'india-insurance':  { flag: '🇮🇳', name: 'India Insurance',   agent: 'Priya', lang: 'en-IN', color: '#7C6CFF' },
  'ph-bancassurance': { flag: '🇵🇭', name: 'Philippines',       agent: 'Maria', lang: 'en-PH', color: '#06B6D4' },
  'id-finance':       { flag: '🇮🇩', name: 'Indonesia',         agent: 'Dewi',  lang: 'id',    color: '#10B981' },
};

// ─── Pipeline Stage Labels ────────────────────────────────────
const PIPELINE_STAGES = [
  { id: 'asr',     label: 'Streaming ASR',    icon: Mic },
  { id: 'gateway', label: 'API Gateway',       icon: Signal },
  { id: 'rag',     label: 'FastAPI RAG',       icon: Database },
  { id: 'llm',     label: 'Gemini LLM',        icon: Sparkles },
  { id: 'tts',     label: 'TTS Synthesis',     icon: Volume2 },
];

// ─── Voice Waveform Visualizer ────────────────────────────────
function VoiceOrb({ isActive, isSpeaking, volumeLevel = 0 }) {
  const bars = 32;
  return (
    <div className="relative flex items-center justify-center w-40 h-40">
      {/* Outer pulse rings */}
      {isActive && (
        <>
          <motion.div
            className="absolute inset-0 rounded-full border border-[#5B5FFF]/30"
            animate={{ scale: [1, 1.25, 1], opacity: [0.4, 0, 0.4] }}
            transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
          />
          <motion.div
            className="absolute inset-0 rounded-full border border-[#5B5FFF]/20"
            animate={{ scale: [1, 1.5, 1], opacity: [0.3, 0, 0.3] }}
            transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut', delay: 0.4 }}
          />
        </>
      )}

      {/* Waveform ring */}
      <svg className="absolute inset-0 w-full h-full" viewBox="0 0 160 160">
        {Array.from({ length: bars }).map((_, i) => {
          const angle = (i / bars) * Math.PI * 2 - Math.PI / 2;
          const r = 60;
          const cx = 80 + Math.cos(angle) * r;
          const cy = 80 + Math.sin(angle) * r;
          const barH = isActive ? 4 + Math.random() * volumeLevel * 20 : 2;
          return (
            <motion.rect
              key={i}
              x={cx - 1}
              y={cy - barH / 2}
              width={2}
              height={barH}
              rx={1}
              fill={isActive ? '#5B5FFF' : '#334155'}
              animate={{ height: isActive ? [barH, barH * 1.5, barH] : 2 }}
              transition={{ duration: 0.3 + Math.random() * 0.4, repeat: Infinity, delay: i * 0.02 }}
              transform={`rotate(${(i / bars) * 360}, ${cx}, ${cy})`}
            />
          );
        })}
      </svg>

      {/* Core orb */}
      <motion.div
        animate={{
          scale: isActive ? (isSpeaking ? [1, 1.08, 1] : [1, 1.03, 1]) : 1,
          boxShadow: isActive
            ? ['0 0 30px rgba(91,95,255,0.5)', '0 0 60px rgba(91,95,255,0.8)', '0 0 30px rgba(91,95,255,0.5)']
            : '0 0 0px rgba(91,95,255,0)',
        }}
        transition={{ duration: 1.5, repeat: Infinity }}
        className={`relative z-10 w-20 h-20 rounded-full flex items-center justify-center transition-all duration-500 ${
          isActive
            ? 'bg-gradient-to-tr from-[#5B5FFF] via-[#7C6CFF] to-[#A78BFA]'
            : 'dark:bg-slate-800 bg-slate-200'
        }`}
      >
        {isActive ? (
          <motion.div
            animate={{ scale: [1, 1.1, 1] }}
            transition={{ duration: 0.8, repeat: Infinity }}
          >
            <Volume2 className="w-8 h-8 text-white" />
          </motion.div>
        ) : (
          <Mic className="w-8 h-8 dark:text-slate-400 text-slate-500" />
        )}
      </motion.div>
    </div>
  );
}

// ─── Pipeline Flow Indicator ──────────────────────────────────
function PipelineFlow({ activeStage, latencies }) {
  return (
    <div className="flex items-center gap-1 flex-wrap justify-center">
      {PIPELINE_STAGES.map((stage, i) => {
        const Icon = stage.icon;
        const isActive = activeStage === stage.id;
        const isDone = PIPELINE_STAGES.findIndex(s => s.id === activeStage) > i;
        return (
          <React.Fragment key={stage.id}>
            <div className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[11px] font-semibold transition-all duration-300 ${
              isActive
                ? 'bg-[#5B5FFF] text-white shadow-[0_0_12px_rgba(91,95,255,0.4)]'
                : isDone
                ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                : 'dark:bg-slate-800/60 bg-slate-100 dark:text-slate-500 text-slate-400'
            }`}>
              <Icon className="w-3 h-3" />
              <span>{stage.label}</span>
              {isDone && latencies?.[stage.id] && (
                <span className="font-mono text-[10px] opacity-70">{latencies[stage.id]}ms</span>
              )}
            </div>
            {i < PIPELINE_STAGES.length - 1 && (
              <ArrowRight className={`w-3 h-3 flex-shrink-0 ${isDone || isActive ? 'text-[#5B5FFF]' : 'dark:text-slate-700 text-slate-300'}`} />
            )}
          </React.Fragment>
        );
      })}
    </div>
  );
}

// ─── Message Bubble ───────────────────────────────────────────
function MessageBubble({ msg }) {
  const isUser = msg.role === 'user';
  return (
    <motion.div
      initial={{ opacity: 0, y: 10, scale: 0.97 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ duration: 0.25, ease: 'easeOut' }}
      className={`flex flex-col ${isUser ? 'items-end' : 'items-start'}`}
    >
      <div className="flex items-center gap-2 mb-1 px-1">
        <span className="text-[11px] font-semibold dark:text-slate-500 text-slate-400">
          {isUser ? 'Customer' : 'Aria (Darwix AI)'}
        </span>
        {msg.latency_ms && (
          <span className="text-[10px] font-mono text-emerald-500 flex items-center gap-0.5">
            <Zap className="w-2.5 h-2.5" />{msg.latency_ms}ms
          </span>
        )}
        {msg.isPartial && (
          <span className="text-[10px] text-amber-400 italic">transcribing…</span>
        )}
      </div>

      <div className={`max-w-[85%] px-4 py-3 rounded-2xl text-[14px] leading-relaxed ${
        isUser
          ? 'bg-[#5B5FFF] text-white rounded-tr-sm'
          : 'dark:bg-[#151D30] bg-slate-100 dark:text-white text-slate-900 rounded-tl-sm border dark:border-white/5 border-slate-200'
      }`}>
        {msg.content}
        {msg.isPartial && <span className="animate-pulse ml-1">▌</span>}
      </div>

      {/* RAG Citation */}
      {!isUser && msg.sources && msg.sources.length > 0 && (
        <motion.div
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: 'auto' }}
          transition={{ delay: 0.2 }}
          className="mt-2 max-w-[85%] w-full rounded-xl border dark:border-white/5 border-slate-200 dark:bg-[#070B14] bg-slate-50 overflow-hidden"
        >
          <div className="flex items-center justify-between px-3 py-2 border-b dark:border-white/5 border-slate-200">
            <span className="flex items-center gap-1.5 text-[11px] font-bold text-emerald-400">
              <Database className="w-3 h-3" />
              RAG Knowledge Citation
            </span>
            <span className="text-[10px] font-mono text-emerald-300">
              {((msg.sources[0]?.score || 0.9) * 100).toFixed(1)}% match
            </span>
          </div>
          <div className="px-3 py-2 space-y-1">
            <div className="flex items-center gap-1.5">
              <FileText className="w-3 h-3 text-[#5B5FFF] flex-shrink-0" />
              <span className="text-[11px] font-semibold dark:text-white text-slate-700 truncate">
                {msg.sources[0]?.source || 'loan_qualification_rules.txt'}
              </span>
            </div>
            {msg.sources[0]?.content && (
              <p className="text-[11px] font-mono dark:text-slate-400 text-slate-500 dark:bg-black/30 bg-slate-200 px-2 py-1.5 rounded-lg line-clamp-2">
                "{msg.sources[0].content}"
              </p>
            )}
          </div>
        </motion.div>
      )}
    </motion.div>
  );
}

// ─── Main Page ────────────────────────────────────────────────
export default function VoiceStudioPage() {
  const [market, setMarket] = useState('india-loan');
  const [callState, setCallState] = useState('idle'); // idle | connecting | active | ending
  const [isSpeaking, setIsSpeaking] = useState(false); // agent speaking
  const [volumeLevel, setVolumeLevel] = useState(0);
  const [messages, setMessages] = useState([]);
  const [partialTranscript, setPartialTranscript] = useState('');
  const [activeStage, setActiveStage] = useState(null);
  const [latencies, setLatencies] = useState({});
  const [totalCallLatency, setTotalCallLatency] = useState(null);
  const [error, setError] = useState(null);
  const [rawError, setRawError] = useState(null);
  const [inputText, setInputText] = useState('');
  const [isTextProcessing, setIsTextProcessing] = useState(false);
  const [micStatus, setMicStatus] = useState('unknown');
  const [useTextMode, setUseTextMode] = useState(false);
  const [isListening, setIsListening] = useState(false); // mic capturing

  const recognitionRef = useRef(null);
  const audioCtxRef = useRef(null);
  const analyserRef = useRef(null);
  const animFrameRef = useRef(null);
  const micStreamRef = useRef(null);
  const isProcessingRef = useRef(false);
  const callStateRef = useRef('idle'); // mirror of callState for event handlers
  const isSpeakingRef = useRef(false);  // mirror of isSpeaking
  const socketRef = useRef(null);
  const chatEndRef = useRef(null);

  const current = MARKETS[market];

  // ── Scroll to bottom on new messages ──
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, partialTranscript]);

  // ── Socket.IO for server-side pipeline events ──
  useEffect(() => {
    const socket = socketIO('http://localhost:3001', { transports: ['websocket'] });
    socketRef.current = socket;
    socket.on('pipeline:latency', (data) => {
      setLatencies(prev => ({ ...prev, rag: data.rag_ms, gateway: data.total_ms - data.rag_ms }));
      setTotalCallLatency(data.total_ms);
    });
    return () => socket.disconnect();
  }, []);

  // ── Web Speech API: initialize SpeechRecognition with Silence Debouncing ──
  const silenceTimerRef = useRef(null);
  const accumulatedSpeechRef = useRef('');

  useEffect(() => {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) {
      setError('Voice input requires Chrome or Edge browser. Use Text Mode on other browsers.');
      setUseTextMode(true);
      return;
    }

    const recognition = new SR();
    recognition.continuous = true;   // Listen continuously without stopping at short pauses
    recognition.interimResults = true;
    recognition.lang = MARKETS[market]?.lang || 'en-IN';
    recognition.maxAlternatives = 1;

    recognition.onstart = () => {
      setIsListening(true);
      if (!isSpeakingRef.current && !isProcessingRef.current) {
        setActiveStage('asr');
      }
    };

    recognition.onresult = (event) => {
      // Ignore incoming speech audio while agent is speaking or processing RAG query
      if (isSpeakingRef.current || isProcessingRef.current) return;

      let fullTranscript = '';
      for (let i = 0; i < event.results.length; i++) {
        fullTranscript += event.results[i][0].transcript + ' ';
      }
      fullTranscript = fullTranscript.trim();

      if (!fullTranscript) return;

      // Append to accumulated speech for this turn
      if (!accumulatedSpeechRef.current || fullTranscript.length > accumulatedSpeechRef.current.length) {
        accumulatedSpeechRef.current = fullTranscript;
      }
      
      setPartialTranscript(accumulatedSpeechRef.current);

      // Reset silence debounce timer: submit query 1400ms after user finishes sentence
      if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current);

      silenceTimerRef.current = setTimeout(() => {
        const finalQuery = accumulatedSpeechRef.current.trim();
        if (finalQuery && finalQuery.length > 2 && !isProcessingRef.current && !isSpeakingRef.current) {
          isProcessingRef.current = true;
          setPartialTranscript('');
          processVoiceQuery(finalQuery);
        }
      }, 1400);
    };

    recognition.onend = () => {
      setIsListening(false);
      // Auto-restart recognition if call is active and agent is done speaking
      if (callStateRef.current === 'active' && !isProcessingRef.current && !isSpeakingRef.current) {
        setTimeout(() => {
          try { recognition.start(); } catch (_) {}
        }, 300);
      }
    };

    recognition.onerror = (event) => {
      if (event.error === 'no-speech' || event.error === 'aborted') return;
      console.warn('SpeechRecognition notice:', event.error);
      if (event.error === 'not-allowed') {
        setError('🎤 Microphone access denied. Click the lock icon in the address bar → allow microphone.');
        setCallState('idle');
        callStateRef.current = 'idle';
      }
    };

    recognitionRef.current = recognition;
    return () => {
      if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current);
      try { recognition.abort(); } catch (_) {}
    };
  }, [market]);

  // ── Mic AudioContext: real volume visualization ──
  const startMicVisualization = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
      micStreamRef.current = stream;
      const ctx = new (window.AudioContext || window.webkitAudioContext)();
      const source = ctx.createMediaStreamSource(stream);
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 256;
      source.connect(analyser);
      audioCtxRef.current = ctx;
      analyserRef.current = analyser;

      const data = new Uint8Array(analyser.frequencyBinCount);
      const tick = () => {
        analyser.getByteFrequencyData(data);
        const avg = data.reduce((a, b) => a + b, 0) / data.length;
        setVolumeLevel(Math.min(avg / 80, 1));
        animFrameRef.current = requestAnimationFrame(tick);
      };
      tick();
    } catch (_) {
      // Visualization optional — silently skip if blocked
    }
  }, []);

  const stopMicVisualization = useCallback(() => {
    cancelAnimationFrame(animFrameRef.current);
    micStreamRef.current?.getTracks().forEach(t => t.stop());
    audioCtxRef.current?.close();
    audioCtxRef.current = null;
    analyserRef.current = null;
    micStreamRef.current = null;
    setVolumeLevel(0);
  }, []);

  // ── Core: send query to RAG, stream TTS back ──
  const processVoiceQuery = useCallback(async (query) => {
    setMessages(prev => [...prev, { id: `usr-${Date.now()}`, role: 'user', content: query, ts: new Date().toISOString() }]);
    setActiveStage('gateway');
    setTimeout(() => setActiveStage('rag'), 100);

    try {
      const t0 = Date.now();
      const res = await fetch('/api/rag/query', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query, top_k: 2 }),
      });
      if (!res.ok) throw new Error(`RAG HTTP ${res.status}`);
      const data = await res.json();
      const ragMs = Date.now() - t0;

      setActiveStage('llm');
      setTotalCallLatency(data.latency_ms || ragMs);
      setLatencies(prev => ({ ...prev, rag: data.retrieval_latency_ms, llm: data.llm_latency_ms, gateway: ragMs - (data.latency_ms || 0) }));

      const answer = data.answer || 'I could not find that information in the knowledge base.';
      setMessages(prev => [...prev, {
        id: `agt-${Date.now()}`,
        role: 'assistant',
        content: answer,
        sources: data.sources || [],
        latency_ms: data.latency_ms || ragMs,
        ts: new Date().toISOString(),
      }]);

      // ── TTS: speak the answer ──
      setActiveStage('tts');
      setIsSpeaking(true);
      isSpeakingRef.current = true;
      speechSynthesis.cancel(); // clear any queued speech

      const cleanAnswerForSpeech = answer
        .replace(/\|/g, ', ')
        .replace(/[\*\#\`\_]/g, '')
        .replace(/\bINR\b/g, 'Rupees')
        .replace(/\s+/g, ' ')
        .trim();

      const utterance = new SpeechSynthesisUtterance(cleanAnswerForSpeech);
      utterance.lang = MARKETS[market]?.lang || 'en-IN';
      utterance.rate = 1.05;
      utterance.pitch = 1.0;
      // Pick a clear female voice if available
      const voices = speechSynthesis.getVoices();
      const preferred = voices.find(v => v.lang.startsWith('en') && v.name.toLowerCase().includes('female'))
        || voices.find(v => v.lang.startsWith('en') && !v.name.toLowerCase().includes('male'))
        || voices[0];
      if (preferred) utterance.voice = preferred;

      utterance.onend = () => {
        setIsSpeaking(false);
        isSpeakingRef.current = false;
        setActiveStage(null);
        isProcessingRef.current = false;
        accumulatedSpeechRef.current = '';
        if (callStateRef.current === 'active') {
          setTimeout(() => { try { recognitionRef.current?.start(); } catch (_) {} }, 200);
        }
      };
      utterance.onerror = (e) => {
        console.warn('TTS error:', e);
        setIsSpeaking(false);
        isSpeakingRef.current = false;
        setActiveStage(null);
        isProcessingRef.current = false;
        accumulatedSpeechRef.current = '';
        if (callStateRef.current === 'active') {
          setTimeout(() => { try { recognitionRef.current?.start(); } catch (_) {} }, 200);
        }
      };

      speechSynthesis.speak(utterance);

    } catch (err) {
      console.error('RAG query error:', err);
      setMessages(prev => [...prev, {
        id: `err-${Date.now()}`,
        role: 'assistant',
        content: `Sorry, I encountered an error: ${err.message}`,
        sources: [],
        ts: new Date().toISOString(),
      }]);
      setActiveStage(null);
      setIsSpeaking(false);
      isSpeakingRef.current = false;
      isProcessingRef.current = false;
      // Resume listening even on error
      if (callStateRef.current === 'active') {
        setTimeout(() => { try { recognitionRef.current?.start(); } catch (_) {} }, 800);
      }
    }
  }, [market]);

  // ── Start Voice Call ──
  const startCall = useCallback(async () => {
    setError(null);
    setRawError(null);
    setCallState('connecting');
    callStateRef.current = 'connecting';
    setMessages([]);
    setLatencies({});
    accumulatedSpeechRef.current = '';
    setPartialTranscript('');
    isProcessingRef.current = false;
    isSpeakingRef.current = false;

    // Pre-check mic
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      stream.getTracks().forEach(t => t.stop());
      setMicStatus('granted');
    } catch (micErr) {
      setMicStatus('denied');
      setError(`🎤 Microphone blocked: ${micErr.message}. Click the lock icon → allow microphone → try again.`);
      setCallState('idle');
      callStateRef.current = 'idle';
      return;
    }

    setCallState('active');
    callStateRef.current = 'active';
    await startMicVisualization();
    try { recognitionRef.current?.start(); } catch (_) {}
  }, [startMicVisualization]);

  // ── End Voice Call ──
  const endCall = useCallback(() => {
    callStateRef.current = 'idle';
    try { recognitionRef.current?.abort(); } catch (_) {}
    speechSynthesis.cancel();
    stopMicVisualization();
    isProcessingRef.current = false;
    isSpeakingRef.current = false;
    setCallState('idle');
    setActiveStage(null);
    setIsSpeaking(false);
    setIsListening(false);
    setPartialTranscript('');
  }, [stopMicVisualization]);

  // ── Text-mode query (fallback) ──
  const handleTextQuery = useCallback(async (text) => {
    const query = text || inputText;
    if (!query.trim() || isTextProcessing) return;
    setInputText('');
    setIsTextProcessing(true);
    setMessages(prev => [...prev, {
      id: `usr-${Date.now()}`, role: 'user', content: query, ts: new Date().toISOString()
    }]);

    setActiveStage('gateway');
    setTimeout(() => setActiveStage('rag'), 80);

    try {
      const res = await fetch('/api/rag/query', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query, top_k: 2 }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      setActiveStage('llm');
      setTotalCallLatency(data.latency_ms);
      setMessages(prev => [...prev, {
        id: `agt-${Date.now()}`,
        role: 'assistant',
        content: data.answer,
        sources: data.sources || [],
        latency_ms: data.latency_ms,
        ts: new Date().toISOString(),
      }]);
      setActiveStage(null);
    } catch (err) {
      console.error('RAG query error:', err);
      setMessages(prev => [...prev, {
        id: `err-${Date.now()}`,
        role: 'assistant',
        content: `RAG service error: ${err.message}. Make sure the API Gateway (:3001) and FastAPI RAG (:8001) are both running.`,
        sources: [],
        ts: new Date().toISOString(),
      }]);
      setActiveStage(null);
    } finally {
      setIsTextProcessing(false);
    }
  }, [inputText, isTextProcessing]);

  const isCallActive = callState === 'active';
  const isConnecting = callState === 'connecting' || callState === 'ending';

  return (
    <div className="max-w-[1100px] mx-auto space-y-8 animate-fadeIn">

      {/* ── Page Header ─────────────────────────────────────── */}
      <div className="flex flex-wrap items-end justify-between gap-4 pb-6 border-b dark:border-white/[0.06] border-slate-200">
        <div>
          <h1 className="text-h2 font-extrabold tracking-tight">Voice Studio</h1>
          <p className="text-body dark:text-slate-400 text-slate-500 mt-1">
            Real-time speech-to-speech AI agent · Grounded by FastAPI RAG
          </p>
        </div>

        {/* Market Switcher */}
        <div className="flex flex-wrap gap-2">
          {Object.entries(MARKETS).map(([key, m]) => (
            <button
              key={key}
              onClick={() => { if (!isCallActive) { setMarket(key); setMessages([]); } }}
              disabled={isCallActive}
              className={`px-3.5 py-2 rounded-xl text-[13px] font-bold transition-all flex items-center gap-1.5 ${
                market === key
                  ? 'bg-[#5B5FFF] text-white shadow-lg shadow-[#5B5FFF]/25'
                  : 'dark:bg-slate-800/60 bg-slate-100 dark:text-slate-300 text-slate-600 hover:dark:bg-slate-800 hover:bg-slate-200 disabled:opacity-40'
              }`}
            >
              <span>{m.flag}</span>
              <span>{m.name}</span>
            </button>
          ))}
        </div>
      </div>

      {/* ── Voice Orb + Controls ─────────────────────────────── */}
      <div className="relative rounded-3xl dark:bg-[#0F172A] bg-white border dark:border-white/[0.06] border-slate-200 shadow-xl overflow-hidden">
        {/* Background gradient when active */}
        <AnimatePresence>
          {isCallActive && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-gradient-to-br from-[#5B5FFF]/5 via-transparent to-[#7C6CFF]/5 pointer-events-none"
            />
          )}
        </AnimatePresence>

        <div className="relative z-10 p-8 flex flex-col lg:flex-row items-center gap-8">
          {/* Orb */}
          <div className="flex flex-col items-center gap-4 flex-shrink-0">
            <VoiceOrb isActive={isCallActive} isSpeaking={isSpeaking} volumeLevel={volumeLevel} />

            {/* Status Badge */}
            <div className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-[12px] font-bold border transition-all ${
              isCallActive
                ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400'
                : isConnecting
                ? 'bg-amber-500/10 border-amber-500/30 text-amber-400'
                : 'dark:bg-slate-800/60 bg-slate-100 dark:border-white/10 border-slate-200 dark:text-slate-400 text-slate-500'
            }`}>
              <span className={`w-2 h-2 rounded-full ${
                isCallActive ? 'bg-emerald-400 animate-pulse' : isConnecting ? 'bg-amber-400 animate-pulse' : 'dark:bg-slate-600 bg-slate-400'
              }`} />
              {isCallActive ? 'Live · Mic Active' : isConnecting ? callState === 'connecting' ? 'Connecting…' : 'Ending call…' : 'Ready'}
            </div>
          </div>

          {/* Info + Controls */}
          <div className="flex-1 space-y-5 text-center lg:text-left">
            <div>
              <h2 className="text-[22px] font-bold dark:text-white text-slate-900">
                {isCallActive
                  ? isSpeaking ? `${current.agent} is responding…` : 'Listening — speak now'
                  : `${current.agent} · ${current.name} Agent`}
              </h2>
              <p className="dark:text-slate-400 text-slate-500 mt-1 text-[14px]">
                {isCallActive
                  ? 'Your voice is being processed through the full RAG pipeline in real time.'
                  : `Click "Start Voice Call" to begin a live session. ${current.agent} will answer using knowledge grounded in your document store.`}
              </p>
            </div>

            {/* Live latency badge */}
            {totalCallLatency && (
              <motion.div
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg dark:bg-[#070B14] bg-slate-100 border dark:border-white/5 border-slate-200 text-[12px] font-mono"
              >
                <Timer className="w-3.5 h-3.5 text-[#5B5FFF]" />
                <span className="dark:text-slate-300 text-slate-600">Last turn:</span>
                <span className={`font-bold ${totalCallLatency < 1500 ? 'text-emerald-400' : totalCallLatency < 2500 ? 'text-amber-400' : 'text-rose-400'}`}>
                  {totalCallLatency}ms
                </span>
                <span className="dark:text-slate-600 text-slate-400">
                  {totalCallLatency < 1500 ? '✓ sub-1.5s target' : totalCallLatency < 2500 ? '~ near target' : '⚠ above target'}
                </span>
              </motion.div>
            )}

            {/* Error */}
            <AnimatePresence>
              {error && (
                <motion.div
                  initial={{ opacity: 0, y: -5 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  className="space-y-2"
                >
                  <div className="flex items-start gap-2 p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-[13px] text-rose-400">
                    <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
                    <span>{error}</span>
                  </div>
                  {rawError && (
                    <details className="text-[11px] font-mono dark:bg-black/40 bg-slate-100 rounded-lg border dark:border-white/5 border-slate-200 overflow-hidden">
                      <summary className="px-3 py-2 cursor-pointer dark:text-slate-400 text-slate-500 select-none">
                        🔍 Raw Vapi error (click to expand)
                      </summary>
                      <pre className="px-3 pb-3 dark:text-rose-300 text-rose-600 overflow-x-auto whitespace-pre-wrap break-all">
                        {JSON.stringify(rawError, null, 2)}
                      </pre>
                    </details>
                  )}
                  <p className="text-[11px] dark:text-slate-500 text-slate-400">
                    💡 Open DevTools (F12) → Console for full Vapi SDK logs.
                  </p>
                </motion.div>
              )}
            </AnimatePresence>


            {/* CTA Buttons */}
            <div className="flex flex-wrap items-center gap-3">
              {!isCallActive ? (
                <>
                  <button
                    onClick={startCall}
                    disabled={isConnecting}
                    className="flex items-center gap-2.5 px-6 py-3 rounded-2xl bg-[#5B5FFF] hover:bg-[#4A4EE0] text-white font-bold text-[14px] shadow-lg shadow-[#5B5FFF]/30 transition-all hover:scale-[1.02] active:scale-95 disabled:opacity-60 disabled:cursor-wait"
                  >
                    {isConnecting ? (
                      <motion.div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full" animate={{ rotate: 360 }} transition={{ duration: 0.8, repeat: Infinity, ease: 'linear' }} />
                    ) : (
                      <Phone className="w-4 h-4" />
                    )}
                    {isConnecting ? 'Connecting…' : 'Start Voice Call'}
                  </button>
                  <button
                    onClick={() => setUseTextMode(p => !p)}
                    className={`flex items-center gap-2 px-4 py-3 rounded-2xl text-[13px] font-semibold border transition-all ${
                      useTextMode
                        ? 'bg-[#5B5FFF]/10 border-[#5B5FFF]/40 text-[#7C6CFF]'
                        : 'dark:border-white/10 border-slate-200 dark:text-slate-400 text-slate-500 hover:dark:border-white/20'
                    }`}
                  >
                    <Send className="w-3.5 h-3.5" />
                    Text Mode
                  </button>
                </>
              ) : (
                <button
                  onClick={endCall}
                  className="flex items-center gap-2.5 px-6 py-3 rounded-2xl bg-rose-500 hover:bg-rose-600 text-white font-bold text-[14px] shadow-lg shadow-rose-500/30 transition-all hover:scale-[1.02] active:scale-95"
                >
                  <PhoneOff className="w-4 h-4" />
                  End Call
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Pipeline flow bar (shown during active call) */}
        <AnimatePresence>
          {(isCallActive || activeStage) && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="px-8 pb-6"
            >
              <PipelineFlow activeStage={activeStage} latencies={latencies} />
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* ── Conversation Transcript ──────────────────────────── */}
      <div className="rounded-3xl dark:bg-[#0F172A] bg-white border dark:border-white/[0.06] border-slate-200 shadow-xl overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b dark:border-white/[0.06] border-slate-200">
          <h3 className="font-bold dark:text-white text-slate-900">Live Transcript · RAG Citations</h3>
          <div className="flex items-center gap-2">
            {isCallActive && (
              <span className="flex items-center gap-1.5 text-[12px] font-bold text-emerald-400">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                Recording
              </span>
            )}
            <span className="text-[12px] font-mono dark:text-slate-500 text-slate-400">
              {messages.length} turns
            </span>
          </div>
        </div>

        <div className="p-6 space-y-5 min-h-[300px] max-h-[480px] overflow-y-auto">
          {messages.length === 0 && !partialTranscript && (
            <div className="flex flex-col items-center justify-center py-16 space-y-3">
              <div className="w-12 h-12 rounded-2xl dark:bg-slate-800 bg-slate-100 flex items-center justify-center">
                <Mic className="w-5 h-5 dark:text-slate-600 text-slate-400" />
              </div>
              <p className="dark:text-slate-500 text-slate-400 text-[14px] text-center">
                {useTextMode ? 'Type a question below to test the RAG pipeline' : 'Start a voice call to see the live transcript here'}
              </p>
            </div>
          )}

          {messages.map(msg => (
            <MessageBubble key={msg.id} msg={msg} />
          ))}

          {/* Partial transcript (user speaking) */}
          <AnimatePresence>
            {partialTranscript && (
              <motion.div
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                className="flex flex-col items-end"
              >
                <div className="max-w-[85%] px-4 py-3 rounded-2xl rounded-tr-sm text-[14px] bg-[#5B5FFF]/70 text-white italic">
                  {partialTranscript}
                  <span className="animate-pulse ml-1">▌</span>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Processing indicator */}
          <AnimatePresence>
            {(isTextProcessing || (isCallActive && activeStage && activeStage !== 'asr' && activeStage !== 'tts')) && (
              <motion.div
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                className="flex items-start gap-3"
              >
                <div className="flex items-center gap-2 px-4 py-3 rounded-2xl rounded-tl-sm dark:bg-[#151D30] bg-slate-100 border dark:border-white/5 border-slate-200 text-[13px] dark:text-slate-400 text-slate-500">
                  <motion.div className="flex gap-1">
                    {[0, 1, 2].map(i => (
                      <motion.span
                        key={i}
                        className="w-1.5 h-1.5 rounded-full bg-[#5B5FFF]"
                        animate={{ y: [0, -4, 0] }}
                        transition={{ duration: 0.6, repeat: Infinity, delay: i * 0.15 }}
                      />
                    ))}
                  </motion.div>
                  <span>Searching knowledge base…</span>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          <div ref={chatEndRef} />
        </div>

        {/* Text mode input */}
        <AnimatePresence>
          {useTextMode && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="border-t dark:border-white/[0.06] border-slate-200 p-4 flex items-center gap-3"
            >
              <input
                type="text"
                value={inputText}
                onChange={e => setInputText(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && !isTextProcessing && handleTextQuery()}
                placeholder={`Ask ${current.agent} about ${current.name.toLowerCase()} policies…`}
                className="flex-1 px-4 py-3 rounded-xl dark:bg-[#151D30] bg-slate-100 border dark:border-white/[0.08] border-slate-200 text-[14px] dark:text-white text-slate-900 placeholder:dark:text-slate-600 placeholder:text-slate-400 focus:outline-none focus:border-[#5B5FFF] transition-colors"
              />
              <button
                onClick={() => handleTextQuery()}
                disabled={isTextProcessing || !inputText.trim()}
                className="px-5 py-3 rounded-xl bg-[#5B5FFF] hover:bg-[#4A4EE0] text-white font-bold text-[13px] flex items-center gap-2 shadow-md transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Send className="w-4 h-4" />
                Ask
              </button>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* ── Pipeline Architecture Diagram ────────────────────── */}
      <div className="rounded-3xl dark:bg-[#0F172A] bg-white border dark:border-white/[0.06] border-slate-200 p-6 shadow-xl">
        <h3 className="font-bold dark:text-white text-slate-900 mb-5">Voice Pipeline Architecture</h3>
        <div className="flex flex-wrap items-center justify-center gap-2 text-[12px]">
          {[
            { label: 'Browser Mic', sub: 'WebRTC Audio', color: 'slate' },
            { label: 'Vapi Cloud', sub: 'Streaming ASR · VAD', color: 'violet' },
            { label: 'Express :3001', sub: 'API Gateway · SSE', color: 'indigo' },
            { label: 'FastAPI :8001', sub: 'FAISS 3072d · RAG', color: 'blue' },
            { label: 'Gemini Flash', sub: 'LLM · Grounding', color: 'purple' },
            { label: 'Vapi TTS', sub: 'Deepgram Aura', color: 'cyan' },
            { label: 'Customer Hears', sub: '< 2s Voice Turn', color: 'emerald' },
          ].map((node, i, arr) => (
            <React.Fragment key={node.label}>
              <div className={`flex flex-col items-center px-3 py-2 rounded-xl border text-center ${
                node.color === 'slate' ? 'dark:border-slate-700 border-slate-200 dark:bg-slate-800/50 bg-slate-100' :
                node.color === 'violet' ? 'border-violet-500/30 bg-violet-500/5 text-violet-400' :
                node.color === 'indigo' ? 'border-[#5B5FFF]/30 bg-[#5B5FFF]/5 text-[#7C6CFF]' :
                node.color === 'blue' ? 'border-blue-500/30 bg-blue-500/5 text-blue-400' :
                node.color === 'purple' ? 'border-purple-500/30 bg-purple-500/5 text-purple-400' :
                node.color === 'cyan' ? 'border-cyan-500/30 bg-cyan-500/5 text-cyan-400' :
                'border-emerald-500/30 bg-emerald-500/5 text-emerald-400'
              }`}>
                <span className="font-bold">{node.label}</span>
                <span className="dark:text-slate-500 text-slate-400 text-[10px] mt-0.5">{node.sub}</span>
              </div>
              {i < arr.length - 1 && (
                <ArrowRight className="w-3.5 h-3.5 dark:text-slate-600 text-slate-400 flex-shrink-0" />
              )}
            </React.Fragment>
          ))}
        </div>
      </div>

    </div>
  );
}
