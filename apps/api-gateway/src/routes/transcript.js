import express from 'express';
import { io } from '../index.js';
import { logger } from '../index.js';
import { getNudgeStore } from '../services/nudges.js';

const router = express.Router();

/**
 * POST /api/transcript/chunk
 * Receives a Deepgram streaming transcript chunk and broadcasts via Socket.IO
 * Body: { call_id, transcript, is_final, speaker, confidence, timestamp_ms }
 */
router.post('/chunk', (req, res) => {
  const { call_id, transcript, is_final, speaker, confidence, timestamp_ms } = req.body;

  if (!call_id || !transcript) {
    return res.status(400).json({ error: 'call_id and transcript are required' });
  }

  const chunk = {
    call_id,
    transcript,
    is_final: is_final ?? false,
    speaker: speaker || 'unknown',
    confidence: confidence || 1.0,
    timestamp_ms: timestamp_ms || Date.now(),
    received_at: Date.now(),
  };

  // Broadcast to all connected dashboard clients
  io.emit('transcript:chunk', chunk);

  if (is_final) {
    logger.debug({ call_id, transcript: transcript.substring(0, 50) }, 'Final transcript chunk');
  }

  res.json({ status: 'ok', chunk_id: chunk.timestamp_ms });
});

/**
 * POST /api/transcript/signal
 * Receives extracted AI signals and broadcasts nudge to dashboard
 * Body: { call_id, signals: [], nudge?: {} }
 */
router.post('/signal', (req, res) => {
  const { call_id, signals, nudge } = req.body;

  let stored;
  if (nudge) {
    if (typeof call_id !== 'string') return res.status(400).json({ error: 'call_id is required' });
    stored = getNudgeStore().create(call_id, {
      type: nudge.type || nudge.signal_type, text: nudge.text, priority: nudge.priority,
      confidence: nudge.confidence, latency_ms: nudge.latency_ms || 0,
      expires_after_seconds: nudge.expires_after_seconds,
    });
  }

  io.emit('signal:update', { call_id, signals, nudge, timestamp: Date.now() });

  if (nudge) {
    if (stored.created) io.emit('nudge', stored.nudge);
    io.emit('nudge:new', { call_id, nudge: stored.nudge, timestamp: Date.now() });
    logger.info({ call_id, nudge_type: nudge.type }, 'Nudge dispatched');
  }

  res.json({ status: 'broadcast', signals_count: signals?.length || 0 });
});

export default router;
