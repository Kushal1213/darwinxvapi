import express from 'express';
import { v4 as uuidv4 } from 'uuid';
import axios from 'axios';
import { logger } from '../index.js';
import { io } from '../index.js';

const router = express.Router();

// In-memory conversation state store
const conversations = new Map();

// ─── Latency Tracking ────────────────────────────────────────
const latencyHistory = [];
function recordLatency(entry) {
  latencyHistory.push({ ...entry, ts: Date.now() });
  if (latencyHistory.length > 200) latencyHistory.shift();
  io.emit('pipeline:latency', entry);
}

// ─── Vapi Standard Webhook ───────────────────────────────────
/**
 * POST /api/voice/webhook
 * Standard Vapi server URL handler.
 * Handles assistant-request, function-call, end-of-call-report
 */
router.post('/webhook', async (req, res) => {
  const body = req.body;
  const { message } = body;
  const type = message?.type || body.type;
  const call_id = message?.call?.id || body.call?.id || body.call_id || uuidv4();

  logger.info({ type, call_id }, '📞 Voice webhook received');

  // ── End-of-call report ──
  if (type === 'end-of-call-report') {
    const session = conversations.get(call_id);
    if (session) {
      io.emit('call:ended', { call_id, session, summary: body.summary || null });
      conversations.delete(call_id);
      logger.info({ call_id, turns: session.turns.length }, '📞 Call ended');
    }
    return res.status(200).json({ status: 'acknowledged' });
  }

  // ── Transcript event (real-time streaming to dashboard + Q4 nudge engine) ──
  if (type === 'transcript') {
    const { role, transcript, transcriptType } = message;
    if (transcriptType === 'final') {
      const turn = { role, content: transcript, ts: new Date().toISOString() };
      io.emit('transcript:update', { call_id, turn });

      // Feed transcript to Q4 real-time insights engine (if running on port 8003)
      // This is asynchronous — nudges are emitted back to the dashboard as they fire
      if (role === 'customer' || role === 'user') {
        feedToInsightsEngine(call_id, role, transcript).catch((err) => {
          logger.warn({ call_id, err: err.message }, 'Insights engine call failed (expected if port 8003 not running)');
        });
      }
    }
    return res.status(200).json({ status: 'ok' });
  }

  // ── Status update events ──
  if (type === 'status-update') {
    io.emit('call:status', { call_id, status: message?.status });
    return res.status(200).json({ status: 'ok' });
  }

  // ── speech-update ──
  if (type === 'speech-update') {
    return res.status(200).json({ status: 'ok' });
  }

  res.status(200).json({ status: 'ok' });
});

// ─── Vapi Custom LLM Endpoint ────────────────────────────────
/**
 * POST /api/voice/vapi-llm
 * This acts as a Custom LLM endpoint that Vapi calls to get responses.
 * Vapi sends OpenAI-compatible chat completion format.
 * We use the last user message as the RAG query.
 */
router.post('/vapi-llm', async (req, res) => {
  const { messages, call } = req.body;
  const call_id = call?.id || uuidv4();
  const t0 = Date.now();

  // Get last user message
  const userMessages = messages?.filter((m) => m.role === 'user') || [];
  const lastUserMsg = userMessages[userMessages.length - 1]?.content || '';

  logger.info({ call_id, query: lastUserMsg?.slice(0, 80) }, '🧠 Custom LLM query via RAG');

  // Ensure session exists
  if (!conversations.has(call_id)) {
    conversations.set(call_id, createSession(call_id));
  }
  const session = conversations.get(call_id);

  try {
    const t1 = Date.now();
    const ragResponse = await axios.post(
      `${process.env.RAG_SERVICE_URL || 'http://localhost:8001'}/retrieve`,
      { query: lastUserMsg, top_k: 2, session_id: call_id },
      { timeout: 8000 }
    );
    const ragLatency = Date.now() - t1;

    const answer = ragResponse.data.answer || "I'm sorry, I couldn't find information on that.";
    const sources = ragResponse.data.sources || [];
    const totalLatency = Date.now() - t0;

    // Update session
    session.turns.push({ role: 'user', content: lastUserMsg, ts: new Date().toISOString() });
    session.turns.push({ role: 'assistant', content: answer, sources, ts: new Date().toISOString() });

    // Record latency
    recordLatency({ call_id, rag_ms: ragLatency, total_ms: totalLatency });

    // Emit to dashboard
    io.emit('transcript:update', {
      call_id,
      turn: { role: 'user', content: lastUserMsg, ts: new Date().toISOString() },
    });
    io.emit('transcript:update', {
      call_id,
      turn: {
        role: 'assistant',
        content: answer,
        sources,
        latency_ms: totalLatency,
        ts: new Date().toISOString(),
      },
    });

    logger.info({ call_id, rag_ms: ragLatency, total_ms: totalLatency }, '✅ RAG response delivered');

    // Return OpenAI-compatible streaming response
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');

    // Stream the answer word by word for natural TTS pacing
    const words = answer.split(' ');
    let buffer = '';
    for (let i = 0; i < words.length; i++) {
      buffer += (i === 0 ? '' : ' ') + words[i];
      // Flush every 5 words or at punctuation
      if ((i + 1) % 5 === 0 || /[.,!?;]/.test(words[i]) || i === words.length - 1) {
        const chunk = {
          id: `chatcmpl-${uuidv4()}`,
          object: 'chat.completion.chunk',
          choices: [{ delta: { content: buffer }, index: 0, finish_reason: null }],
        };
        res.write(`data: ${JSON.stringify(chunk)}\n\n`);
        buffer = '';
      }
    }

    // Send finish signal
    const finishChunk = {
      id: `chatcmpl-${uuidv4()}`,
      object: 'chat.completion.chunk',
      choices: [{ delta: {}, index: 0, finish_reason: 'stop' }],
    };
    res.write(`data: ${JSON.stringify(finishChunk)}\n\n`);
    res.write('data: [DONE]\n\n');
    res.end();
  } catch (err) {
    logger.error(err, 'RAG call failed in vapi-llm');
    const fallback = "I'm sorry, I'm having trouble retrieving that information right now. Please ask a specialist for detailed assistance.";

    res.setHeader('Content-Type', 'text/event-stream');
    const chunk = {
      id: `chatcmpl-${uuidv4()}`,
      object: 'chat.completion.chunk',
      choices: [{ delta: { content: fallback }, index: 0, finish_reason: 'stop' }],
    };
    res.write(`data: ${JSON.stringify(chunk)}\n\n`);
    res.write('data: [DONE]\n\n');
    res.end();
  }
});

// ─── Session Management ──────────────────────────────────────

/**
 * POST /api/voice/session
 * Create a named call session
 */
router.post('/session', (req, res) => {
  const { call_id, language = 'en', market = 'india-loan' } = req.body;
  const id = call_id || uuidv4();
  const session = createSession(id, { language, market });
  conversations.set(id, session);
  logger.info({ call_id: id }, 'Session created');
  res.json({ call_id: id, session });
});

/**
 * GET /api/voice/session/:id
 */
router.get('/session/:id', (req, res) => {
  const session = conversations.get(req.params.id);
  if (!session) return res.status(404).json({ error: 'Session not found' });
  res.json(session);
});

/**
 * GET /api/voice/latency
 * Last 50 latency records
 */
router.get('/latency', (req, res) => {
  res.json(latencyHistory.slice(-50));
});

/**
 * POST /api/voice/escalate
 */
router.post('/escalate', (req, res) => {
  const { call_id, reason } = req.body;
  const session = conversations.get(call_id) || {};
  const escalation = {
    escalation_id: uuidv4(),
    call_id,
    reason: reason || 'Customer requested human agent',
    missing_information: session.state?.missing_fields || [],
    conversation_summary: buildSummary(session),
    confidence: session.state?.confidence || 0,
    timestamp: new Date().toISOString(),
    priority: session.state?.frustration_level > 0.7 ? 'HIGH' : 'NORMAL',
  };
  io.emit('call:escalated', escalation);
  logger.warn(escalation, 'Call escalated');
  res.json(escalation);
});

// ── Q4 Real-Time Insights Integration ────────────────────────
/**
 * feedToInsightsEngine — sends a transcript chunk to the Python
 * realtime-insights service (port 8003) for signal detection + nudge generation.
 * This is fire-and-forget with graceful degradation; nudges are emitted back
 * to the dashboard via Socket.IO once they're generated.
 */
async function feedToInsightsEngine(call_id, speaker, text) {
  const insightsUrl = process.env.INSIGHTS_SERVICE_URL || 'http://localhost:8003';
  try {
    const response = await axios.post(
      `${insightsUrl}/detect-signals`,
      { call_id, speaker, text },
      { timeout: 2000 }
    );
    if (response.data?.nudges && response.data.nudges.length > 0) {
      for (const nudge of response.data.nudges) {
        io.emit('nudge', {
          call_id,
          type: nudge.signal_type,
          priority: nudge.priority,
          text: nudge.text,
          confidence: nudge.confidence,
          latency_ms: nudge.end_to_end_latency_ms_excl_asr || 0,
          ts: new Date().toISOString(),
        });
      }
    }
  } catch (err) {
    // Silently degrade if port 8003 is not running — the system continues to work
    // for Q1–Q3, only Q4 real-time nudges are unavailable.
  }
}

// ── Helpers ──────────────────────────────────────────────────

function createSession(call_id, overrides = {}) {
  return {
    call_id,
    created_at: new Date().toISOString(),
    language: overrides.language || 'en',
    market: overrides.market || 'india-loan',
    turns: [],
    state: {
      customer_name: null,
      intent: null,
      qualification_status: 'unknown',
      income: null,
      loan_amount: null,
      current_stage: 'greeting',
      confidence: 1.0,
      frustration_level: 0,
      missing_fields: [],
    },
  };
}

function buildSummary(session) {
  if (!session.turns || session.turns.length === 0) return 'No conversation recorded.';
  return session.turns
    .slice(-4)
    .map((t) => `${t.role.toUpperCase()}: ${t.content}`)
    .join('\n');
}

export default router;
