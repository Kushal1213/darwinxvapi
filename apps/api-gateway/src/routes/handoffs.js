import express from 'express';

import { io } from '../index.js';
import {
  getHandoff,
  listHandoffs,
  reconcileHandoffDeliveries,
  transitionHandoff,
} from '../services/handoff-deliveries.js';

const router = express.Router();
let reconciled = false;
router.use((_req, _res, next) => {
  if (!reconciled) {
    reconcileHandoffDeliveries();
    reconciled = true;
  }
  next();
});

router.get('/', (req, res) => {
  const state = String(req.query.state || 'open');
  const limit = Number(req.query.limit ?? 50);
  const offset = Number(req.query.offset ?? 0);
  if (!['open', 'delivered', 'acknowledged', 'resolved', 'all'].includes(state)) {
    return res.status(400).json({ error: 'Invalid handoff state' });
  }
  if (!Number.isInteger(limit) || limit < 1 || limit > 100 || !Number.isInteger(offset) || offset < 0) {
    return res.status(400).json({ error: 'limit must be 1-100 and offset must be a nonnegative integer' });
  }
  res.json(listHandoffs({ state, limit, offset }));
});

router.get('/:id', (req, res) => {
  const handoff = getHandoff(req.params.id);
  if (!handoff) return res.status(404).json({ error: 'Handoff not found' });
  res.json(handoff);
});

router.post('/:id/acknowledge', (req, res) => {
  const handoff = transitionHandoff(req.params.id, 'acknowledge', req.session.userId);
  if (!handoff) return res.status(404).json({ error: 'Handoff not found' });
  io.emit('handoff:updated', { handoff });
  res.json(handoff);
});

router.post('/:id/resolve', (req, res) => {
  const resolution = typeof req.body?.resolution === 'string' ? req.body.resolution.trim() : '';
  if (!resolution || resolution.length > 1000) {
    return res.status(400).json({ error: 'Resolution is required and must be at most 1000 characters' });
  }
  const handoff = transitionHandoff(req.params.id, 'resolve', req.session.userId, resolution);
  if (!handoff) return res.status(404).json({ error: 'Handoff not found' });
  io.emit('handoff:updated', { handoff });
  res.json(handoff);
});

export default router;
