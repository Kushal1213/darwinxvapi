import { Router } from 'express';
import { z } from 'zod';

import { createQaReviewStore, qaReportCsv } from '../services/qa-reviews.js';

const router = Router();
const store = () => createQaReviewStore();
const markets = ['all', 'india-loan', 'india-insurance', 'ph-bancassurance', 'id-finance'];
const sampleQuery = z.object({
  days: z.coerce.number().int().refine((value) => [7, 30, 90].includes(value)).default(30),
  market: z.enum(markets).default('all'),
  outcome: z.enum(['all', 'completed', 'human_handoff_requested']).default('all'),
  handoff: z.enum(['all', 'yes', 'no']).default('all'),
  missing_citation: z.enum(['all', 'yes', 'no']).default('all'),
  review_state: z.enum(['all', 'unreviewed', 'completed']).default('all'),
  limit: z.coerce.number().int().min(1).max(100).default(25),
}).strict();
const reportQuery = z.object({
  days: z.coerce.number().int().refine((value) => [7, 30, 90].includes(value)).default(30),
  market: z.enum(markets).default('all'),
  format: z.enum(['json', 'csv']).default('json'),
}).strict();

router.get('/rubrics', (_req, res) => {
  res.json({ rubrics: store().listRubrics() });
});

router.post('/rubrics', (req, res) => {
  res.status(201).json({ rubric: store().createRubric(req.session.userId, req.body) });
});

router.post('/rubrics/:id/activate', (req, res) => {
  res.json({ rubric: store().activateRubric(req.params.id, req.session.userId) });
});

router.post('/rubrics/:id/retire', (req, res) => {
  res.json({ rubric: store().retireRubric(req.params.id, req.session.userId, req.body?.reason) });
});

router.get('/sample', (req, res) => {
  const parsed = sampleQuery.safeParse(req.query);
  if (!parsed.success) return res.status(400).json({ error: 'Use supported QA sample filters and a limit between 1 and 100.' });
  res.json(store().sample(parsed.data));
});

router.get('/calls/:id', (req, res) => {
  res.json(store().callBundle(req.params.id, req.session.userId));
});

router.post('/reviews', (req, res) => {
  const parsed = z.object({ call_id: z.string().trim().min(1).max(200), rubric_id: z.string().uuid().nullable().optional() }).strict().safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'A valid call ID and optional rubric ID are required.' });
  const review = store().startReview(parsed.data.call_id, req.session.userId, parsed.data.rubric_id);
  res.status(201).json({ review });
});

router.put('/reviews/:id', (req, res) => {
  res.json({ review: store().saveFindings(req.params.id, req.session.userId, req.body) });
});

router.post('/reviews/:id/complete', (req, res) => {
  res.json({ review: store().completeReview(req.params.id, req.session.userId) });
});

router.post('/reviews/:id/coaching', (req, res) => {
  res.status(201).json({ review: store().addCoaching(req.params.id, req.session.userId, req.body) });
});

router.get('/report', (req, res) => {
  const parsed = reportQuery.safeParse(req.query);
  if (!parsed.success) return res.status(400).json({ error: 'Use days=7, 30, or 90; a supported market or all; and format=json or csv.' });
  const report = store().report(parsed.data);
  res.set('Cache-Control', 'no-store');
  if (parsed.data.format === 'csv') {
    res.set('Content-Disposition', `attachment; filename="veyra-qa-${parsed.data.market}-${parsed.data.days}d.csv"`);
    return res.type('text/csv').send(qaReportCsv(report));
  }
  return res.json(report);
});

export default router;
