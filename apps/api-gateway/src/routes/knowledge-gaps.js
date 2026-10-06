import express from 'express';

import { getKnowledgeGap, listKnowledgeGaps, updateKnowledgeGap } from '../services/knowledge-gaps.js';

const router = express.Router();
const states = new Set(['active', 'all', 'open', 'reopened', 'triaged', 'planned', 'out_of_scope', 'resolved']);

router.get('/', (req, res) => {
  const status = String(req.query.status || 'active');
  const limit = Number(req.query.limit ?? 50);
  const offset = Number(req.query.offset ?? 0);
  if (!states.has(status)) return res.status(400).json({ error: 'Invalid knowledge-gap status' });
  if (!Number.isInteger(limit) || limit < 1 || limit > 100 || !Number.isInteger(offset) || offset < 0) {
    return res.status(400).json({ error: 'limit must be 1-100 and offset must be a nonnegative integer' });
  }
  res.json(listKnowledgeGaps({ status, limit, offset }));
});

router.get('/:id', (req, res) => {
  const gap = getKnowledgeGap(req.params.id);
  if (!gap) return res.status(404).json({ error: 'Knowledge gap not found' });
  res.json(gap);
});

router.post('/:id/actions', (req, res) => {
  const status = typeof req.body?.status === 'string' ? req.body.status : '';
  const note = typeof req.body?.note === 'string' ? req.body.note.trim() : '';
  const documentId = typeof req.body?.document_id === 'string' ? req.body.document_id : '';
  if (note.length > 1000 || documentId.length > 200) return res.status(400).json({ error: 'Invalid knowledge-gap update' });
  const gap = updateKnowledgeGap(req.params.id, { status, note, documentId }, req.session.userId);
  if (!gap) return res.status(404).json({ error: 'Knowledge gap not found' });
  res.json(gap);
});

export default router;
