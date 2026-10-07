import express from 'express';
import { z } from 'zod';
import { io } from '../index.js';
import {
  getOperationalControl,
  listOperationalControlEvents,
  listOperationalControls,
  updateOperationalControl,
} from '../services/operational-controls.js';

const router = express.Router();
const changeSchema = z.object({
  enabled: z.boolean(),
  reason: z.string().trim().min(8).max(1000),
});

router.get('/controls', (_req, res) => {
  res.json({ controls: listOperationalControls(), timestamp: new Date().toISOString() });
});

router.get('/events', (req, res) => {
  const limit = Number(req.query.limit ?? 50);
  if (!Number.isInteger(limit) || limit < 1 || limit > 100) return res.status(400).json({ error: 'limit must be between 1 and 100.' });
  res.json({ events: listOperationalControlEvents(limit) });
});

router.post('/controls/:key', (req, res) => {
  const parsed = changeSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'Choose a state and provide a reason between 8 and 1000 characters.' });
  getOperationalControl(req.params.key);
  const control = updateOperationalControl(req.params.key, parsed.data.enabled, parsed.data.reason, req.session.userId);
  io.emit('operations:control:update', { control });
  res.json({ control });
});

export default router;
