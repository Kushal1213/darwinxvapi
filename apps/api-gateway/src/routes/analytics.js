import { Router } from 'express';
import { getDatabase } from '../services/database.js';
import { ANALYTICS_MARKETS, analyticsCsv, getAnalytics } from '../services/analytics.js';

const router = Router();
router.get('/', (req, res) => {
  const db = getDatabase();
  const user = db.prepare("SELECT workspace_id FROM users WHERE id = ? AND role IN ('admin', 'operator')")
    .get(req.session?.userId || '');
  if (!user) return res.status(401).json({ error: 'Sign in to your workspace' });
  const { days = '7', market = 'all', format = 'json' } = req.query;
  if (Object.keys(req.query).some((key) => !['days', 'market', 'format'].includes(key))
    || typeof days !== 'string' || !['7', '30', '90'].includes(days)
    || typeof market !== 'string' || !['all', ...ANALYTICS_MARKETS].includes(market)
    || typeof format !== 'string' || !['json', 'csv'].includes(format)) {
    return res.status(400).json({ error: 'Use days=7, 30, or 90; a supported market or all; and format=json or csv.' });
  }
  const report = getAnalytics({ workspaceId: user.workspace_id, days: Number(days), market, db });
  res.set('Cache-Control', 'no-store');
  if (format === 'csv') {
    res.set('Content-Disposition', `attachment; filename="veyra-analytics-${market}-${days}d-${report.generated_at.slice(0, 10)}.csv"`);
    return res.type('text/csv').send(analyticsCsv(report));
  }
  return res.json(report);
});

export default router;
