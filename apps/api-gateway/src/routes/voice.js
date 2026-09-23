import express from 'express';
import { v4 as uuidv4 } from 'uuid';
import axios from 'axios';
import { io, logger } from '../index.js';

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

const MAX_QUERY_LENGTH = 8_000;
const MARKET_LANGUAGES = {
  'india-loan': 'en-IN',
  'india-insurance': 'en-IN',
  'ph-bancassurance': 'en-PH',
  'id-finance': 'id-ID',
};

const MARKET_DETAILS = {
  'india-loan': { label: 'India Loans', flag: '🇮🇳', agent: 'Aria (India Loans & Insurance)' },
  'india-insurance': { label: 'India Insurance', flag: '🇮🇳', agent: 'Priya (India Insurance)' },
  'ph-bancassurance': { label: 'Philippines Bancassurance', flag: '🇵🇭', agent: 'Maria (Taglish Agent)' },
  'id-finance': { label: 'Indonesia Finance', flag: '🇮🇩', agent: 'Dewi (Bahasa Agent)' },
};

const getRagUrl = () => (process.env.RAG_SERVICE_URL || 'http://localhost:8001').replace(/\/+$/, '');

function getOrCreateSession(callId, overrides = {}) {
  if (!conversations.has(callId)) {
    conversations.set(callId, createSession(callId, overrides));
  }
  return conversations.get(callId);
}

function emitTurn(callId, turn) {
  const session = conversations.get(callId);
  if (session) {
    session.status = 'active';
    session.last_activity = turn.ts || new Date().toISOString();
  }
  io.emit('transcript:update', { call_id: callId, turn });
  if (session) emitLiveCallUpdate(session);
}

function getLatestTurn(session, role) {
  return [...session.turns].reverse().find((turn) => turn.role === role)?.content || '';
}

function intentLabel(intent) {
  if (intent === 'insurance_inquiry') return 'Insurance Inquiry';
  if (intent === 'loan_inquiry') return 'Loan Inquiry';
  return 'Listening for customer intent';
}

/**
 * Produce the small, browser-safe representation consumed by Mission Control.
 * Keeping it derived from the server-owned call session means Insights can load
 * after a call starts without depending on a previously-open Socket.IO tab.
 */
function buildLiveCall(session) {
  const market = MARKET_DETAILS[session.market] || MARKET_DETAILS['india-loan'];
  const customerTurn = getLatestTurn(session, 'user');
  const agentTurn = getLatestTurn(session, 'assistant');
  const conversationText = session.turns
    .filter((turn) => turn.role === 'user')
    .map((turn) => turn.content)
    .join(' ')
    .toLowerCase();
  const frustration = session.state.frustration_level || 0;
  const escalated = session.state.compliance_risk || frustration >= 0.5;
  const buyingSignal = /\b(apply|purchase|buy|eligible|eligibility|loan|premium|coverage|policy|amount)\b/i.test(conversationText) && !escalated;
  const latestNudge = session.state.last_nudge || null;
  const latestAssistantTurn = [...session.turns].reverse().find((turn) => turn.role === 'assistant');

  return {
    id: session.call_id,
    call_id: session.call_id,
    status: session.status || 'active',
    customer: session.state.customer_name || 'Live Customer',
    agent: market.agent,
    market: `${market.flag} ${market.label}`,
    intent: intentLabel(session.state.intent),
    sentiment: frustration >= 0.5 ? 'Negative' : frustration >= 0.2 ? 'Neutral' : 'Positive',
    sentimentScore: Number((1 - frustration).toFixed(2)),
    frustration,
    buyingSignal,
    complianceRisk: Boolean(session.state.compliance_risk),
    complianceRule: session.state.compliance_rule || 'NONE',
    timestamp: session.last_activity || session.created_at,
    latency: latestAssistantTurn?.latency_ms ? `${latestAssistantTurn.latency_ms.toLocaleString()}ms` : '—',
    query: customerTurn,
    answer: agentTurn,
    lastNudge: latestNudge,
  };
}

function emitLiveCallUpdate(session) {
  io.emit('insights:call:update', { call: buildLiveCall(session) });
}

function emitLiveCallEnd(callId) {
  io.emit('insights:call:ended', { call_id: callId });
}

function updateConversationState(session, text) {
  const normalized = text.toLowerCase();
  const name = text.match(/(?:my name is|i am|i'm)\s+([a-z][a-z .'-]{1,50})/i);
  if (name) session.state.customer_name = name[1].trim().replace(/[.,!?].*$/, '');

  if (/\b(claim|coverage|premium|policy|insurance|rider|beneficiary)\b/i.test(text)) {
    session.state.intent = 'insurance_inquiry';
  } else if (/\b(loan|emi|ltv|property|cibil|income|cicilan|dp|tenor)\b/i.test(text)) {
    session.state.intent = 'loan_inquiry';
  }

  const income = text.match(/(?:income|salary|earn)\D{0,20}([₹$₱]?\s?[\d,.]+\s*(?:k|lakh|lakhs|thousand)?)/i);
  if (income) session.state.income = income[1].trim();
  const amount = text.match(/(?:loan|amount|need|borrow)\D{0,20}([₹$₱]?\s?[\d,.]+\s*(?:k|lakh|lakhs|crore|million)?)/i);
  if (amount) session.state.loan_amount = amount[1].trim();

  const frustrationTerms = ['manager', 'supervisor', 'human', 'complaint', 'unacceptable', 'ridiculous', 'frustrated', 'angry'];
  const frustrationHits = frustrationTerms.filter((term) => normalized.includes(term)).length;
  if (frustrationHits) {
    session.state.frustration_level = Math.min(1, session.state.frustration_level + frustrationHits * 0.25);
  }
  session.state.current_stage = session.state.intent ? 'grounding' : 'intent_capture';
  session.state.missing_fields = ['customer_name', 'intent', 'income'].filter((field) => !session.state[field]);
}

function escalationFor(session, callId, text) {
  if (!/\b(manager|supervisor|human agent|representative|escalat|complaint|claim rejected)\b/i.test(text)) {
    return null;
  }
  const escalation = {
    escalation_id: uuidv4(),
    call_id: callId,
    reason: 'Customer requested human assistance or raised a complaint',
    missing_information: session.state.missing_fields,
    conversation_summary: buildSummary(session),
    confidence: session.state.confidence,
    timestamp: new Date().toISOString(),
    priority: session.state.frustration_level >= 0.5 ? 'HIGH' : 'NORMAL',
  };
  io.emit('call:escalated', escalation);
  return escalation;
}

async function runVoiceTurn({ callId, query, market, language, recordUser = true, emitUser = true }) {
  const startedAt = Date.now();
  const session = getOrCreateSession(callId, { market, language });
  const userTurn = { role: 'user', content: query, ts: new Date().toISOString() };

  if (recordUser) {
    session.turns.push(userTurn);
    updateConversationState(session, query);
  }
  if (emitUser) emitTurn(callId, userTurn);

  // Analysis is intentionally non-blocking. A temporary insights outage must
  // never prevent the customer from receiving a grounded answer.
  feedToInsightsEngine(callId, 'customer', query).catch((err) => {
    logger.warn({ callId, err: err.message }, 'Live insights feed failed');
  });

  const ragStartedAt = Date.now();
  const ragResponse = await axios.post(
    `${getRagUrl()}/retrieve`,
    { query, top_k: 2, session_id: callId, market: session.market, language: session.language },
    { timeout: Number(process.env.RAG_REQUEST_TIMEOUT_MS || 10_000) }
  );
  const ragMs = Date.now() - ragStartedAt;
  const totalMs = Date.now() - startedAt;
  const answer = ragResponse.data.answer || "I couldn't find that detail in the knowledge base. Let me connect you with a specialist.";
  const sources = ragResponse.data.sources || [];
  const assistantTurn = {
    role: 'assistant', content: answer, sources, latency_ms: totalMs, ts: new Date().toISOString(),
  };
  session.turns.push(assistantTurn);
  const escalation = escalationFor(session, callId, query);

  recordLatency({ call_id: callId, rag_ms: ragMs, total_ms: totalMs });
  emitTurn(callId, assistantTurn);
  feedToInsightsEngine(callId, 'assistant', answer).catch((err) => {
    logger.warn({ callId, err: err.message }, 'Live insights feed failed');
  });

  return {
    ...ragResponse.data,
    call_id: callId,
    latency_ms: totalMs,
    session,
    escalation,
  };
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
      emitLiveCallEnd(call_id);
      logger.info({ call_id, turns: session.turns.length }, '📞 Call ended');
    }
    closeInsightsCall(call_id).catch(() => {});
    return res.status(200).json({ status: 'acknowledged' });
  }

  // ── Transcript event (real-time streaming to dashboard + Q4 nudge engine) ──
  if (type === 'transcript') {
    const { role, transcript, transcriptType } = message;
    if (transcriptType === 'final' && transcript?.trim()) {
      // Vapi role names vary by transport (customer/user and
      // assistant/agent/bot). Normalize once so both the session snapshot and
      // the Python detector receive a role they understand.
      const normalizedRole = role === 'customer' || role === 'user' ? 'user' : 'assistant';
      const turn = { role: normalizedRole, content: transcript, ts: new Date().toISOString() };
      const session = getOrCreateSession(call_id);
      const previousTurn = session.turns.at(-1);
      const isDuplicate = previousTurn?.role === turn.role && previousTurn.content === turn.content;
      if (!isDuplicate) {
        session.turns.push(turn);
      }
      if (normalizedRole === 'user') {
        updateConversationState(session, transcript);
      }
      emitTurn(call_id, turn);

      // Both sides matter: customer turns drive buying/frustration cues and
      // agent turns allow the compliance detector to see quoted rates/fees.
      feedToInsightsEngine(call_id, normalizedRole, transcript).catch((err) => {
        logger.warn({ call_id, err: err.message }, 'Insights engine call failed');
      });
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
  const userMessages = messages?.filter((m) => m.role === 'user') || [];
  const lastUserMsg = String(userMessages[userMessages.length - 1]?.content || '').trim();
  const market = String(req.query.market || call?.metadata?.market || 'india-loan');
  const language = MARKET_LANGUAGES[market] || 'en-IN';

  logger.info({ call_id, query: lastUserMsg?.slice(0, 80) }, '🧠 Custom LLM query via RAG');

  if (!lastUserMsg || lastUserMsg.length > MAX_QUERY_LENGTH) {
    return writeSseResponse(res, 'I did not catch that. Could you please repeat your question?', true);
  }

  try {
    // Vapi normally emits a final transcript webhook first. Do not duplicate
    // that customer turn in the dashboard, but retain it when the webhook was
    // not configured (for example during an API-only test).
    const session = conversations.get(call_id);
    const alreadyRecorded = session?.turns.at(-1)?.role === 'user'
      && session.turns.at(-1)?.content === lastUserMsg;
    const result = await runVoiceTurn({
      callId: call_id,
      query: lastUserMsg,
      market,
      language,
      recordUser: !alreadyRecorded,
      emitUser: !alreadyRecorded,
    });
    logger.info({ call_id, latency_ms: result.latency_ms }, '✅ RAG response delivered');
    return writeSseResponse(res, result.answer);
  } catch (err) {
    logger.error({ call_id, err: err.message }, 'RAG call failed in vapi-llm');
    const fallback = "I'm sorry, I'm having trouble retrieving that information right now. Please ask a specialist for detailed assistance.";
    return writeSseResponse(res, fallback, true);
  }
});

function writeSseResponse(res, answer, finishImmediately = false) {
  res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
  res.setHeader('Cache-Control', 'no-cache, no-transform');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders?.();

  const words = String(answer).split(/\s+/).filter(Boolean);
  let buffer = '';
  for (let index = 0; index < words.length; index += 1) {
    buffer += `${buffer ? ' ' : ''}${words[index]}`;
    if (finishImmediately || (index + 1) % 5 === 0 || /[.,!?;]/.test(words[index]) || index === words.length - 1) {
      res.write(`data: ${JSON.stringify({
        id: `chatcmpl-${uuidv4()}`,
        object: 'chat.completion.chunk',
        choices: [{ delta: { content: buffer }, index: 0, finish_reason: null }],
      })}\n\n`);
      buffer = '';
    }
  }
  res.write(`data: ${JSON.stringify({
    id: `chatcmpl-${uuidv4()}`,
    object: 'chat.completion.chunk',
    choices: [{ delta: {}, index: 0, finish_reason: 'stop' }],
  })}\n\n`);
  res.write('data: [DONE]\n\n');
  res.end();
}

// ─── Session Management ──────────────────────────────────────

/**
 * POST /api/voice/query
 * Browser voice/text entry point. It owns a complete turn so the session,
 * RAG response, Socket.IO transcript, latency telemetry, and insight feed
 * cannot get out of sync.
 */
router.post('/query', async (req, res) => {
  const query = typeof req.body?.query === 'string' ? req.body.query.trim() : '';
  if (!query || query.length > MAX_QUERY_LENGTH) {
    return res.status(400).json({ error: `query is required and must be under ${MAX_QUERY_LENGTH} characters` });
  }

  const callId = typeof req.body.call_id === 'string' && req.body.call_id.trim()
    ? req.body.call_id.trim()
    : uuidv4();
  const market = typeof req.body.market === 'string' ? req.body.market : 'india-loan';
  const language = typeof req.body.language === 'string' ? req.body.language : (MARKET_LANGUAGES[market] || 'en-IN');

  try {
    const result = await runVoiceTurn({ callId, query, market, language });
    return res.json(result);
  } catch (err) {
    const status = err.code === 'ECONNABORTED' ? 504 : 503;
    logger.error({ callId, err: err.message, code: err.code }, 'Voice turn failed');
    return res.status(status).json({
      error: status === 504 ? 'RAG request timed out' : 'RAG service is unavailable',
      message: 'The voice service could not complete this turn. Check the RAG service health and try again.',
    });
  }
});

/**
 * POST /api/voice/session
 * Create a named call session
 */
router.post('/session', (req, res) => {
  const { call_id, language = 'en', market = 'india-loan' } = req.body;
  const id = call_id || uuidv4();
  const session = createSession(id, { language, market });
  conversations.set(id, session);
  emitLiveCallUpdate(session);
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
 * GET /api/voice/live
 * Current in-progress calls for the Insights page. This snapshot makes the
 * dashboard reliable when it is opened after Voice Studio has already emitted
 * transcript events, or after a temporary Socket.IO reconnect.
 */
router.get('/live', (_req, res) => {
  const calls = [...conversations.values()]
    .filter((session) => session.status !== 'ended')
    .sort((left, right) => new Date(right.last_activity) - new Date(left.last_activity))
    .map(buildLiveCall);
  res.json({ calls, timestamp: new Date().toISOString() });
});

/**
 * POST /api/voice/session/:id/end
 * End browser-owned sessions and release both conversation and insights state.
 */
router.post('/session/:id/end', (req, res) => {
  const session = conversations.get(req.params.id);
  if (session) {
    io.emit('call:ended', { call_id: req.params.id, session, summary: buildSummary(session) });
    conversations.delete(req.params.id);
    emitLiveCallEnd(req.params.id);
  }
  closeInsightsCall(req.params.id).catch(() => {});
  return res.json({ status: 'ended', call_id: req.params.id, existed: Boolean(session) });
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
  const insightsUrl = (process.env.INSIGHTS_SERVICE_URL || process.env.REALTIME_AI_URL || 'http://localhost:8003').replace(/\/+$/, '');
  try {
    const response = await axios.post(
      `${insightsUrl}/detect-signals`,
      { call_id, speaker, text },
      { timeout: 2000 }
    );
    if (response.data?.nudges && response.data.nudges.length > 0) {
      for (const nudge of response.data.nudges) {
        const session = conversations.get(call_id);
        if (session) {
          session.state.last_nudge = {
            type: nudge.signal_type,
            priority: nudge.priority,
            text: nudge.text,
            confidence: nudge.confidence,
          };
          if (nudge.signal_type === 'human_escalation') {
            session.state.compliance_risk = true;
            session.state.compliance_rule = 'SUPERVISOR_ESCALATION_REQUESTED';
            session.state.frustration_level = Math.max(session.state.frustration_level, 0.7);
          } else if (nudge.signal_type === 'compliance_gap') {
            session.state.compliance_risk = true;
            session.state.compliance_rule = 'DISCLOSURE_NOT_GIVEN';
          } else if (nudge.signal_type === 'rising_frustration') {
            session.state.frustration_level = Math.max(session.state.frustration_level, 0.5);
          }
          session.last_activity = new Date().toISOString();
          emitLiveCallUpdate(session);
        }
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

async function closeInsightsCall(callId) {
  const insightsUrl = (process.env.INSIGHTS_SERVICE_URL || process.env.REALTIME_AI_URL || 'http://localhost:8003').replace(/\/+$/, '');
  await axios.delete(`${insightsUrl}/calls/${encodeURIComponent(callId)}`, { timeout: 2_000 });
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
      compliance_risk: false,
      compliance_rule: 'NONE',
      last_nudge: null,
      missing_fields: [],
    },
    status: 'active',
    last_activity: new Date().toISOString(),
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
