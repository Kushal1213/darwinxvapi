import express from 'express';
import { io } from '../index.js';
import { getNudgeStore, nudgeActionSchema } from '../services/nudges.js';

const router = express.Router();
router.get('/', (req, res) => {
  const callId = req.query.call_id;
  if (callId !== undefined && (typeof callId !== 'string' || !callId || callId.length > 200)) {
    return res.status(400).json({ error: 'Invalid call_id' });
  }
  res.json({ nudges: getNudgeStore().list(callId) });
});
router.post('/:id/actions', (req, res) => {
  const parsed = nudgeActionSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'Invalid nudge action' });
  const nudge = getNudgeStore().act(req.params.id, parsed.data.action, req.session.userId);
  io.emit('nudge:updated', { nudge });
  res.json({ nudge });
});
router.get('/:id/events', (req, res) => {
  res.json({ events: getNudgeStore().events(req.params.id) });
});
export default router;
