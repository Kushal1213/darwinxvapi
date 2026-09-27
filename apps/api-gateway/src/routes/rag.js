import express from 'express';
import axios from 'axios';
import { z } from 'zod';
import { logger } from '../index.js';

const router = express.Router();
const ragTimeout = () => Number(process.env.RAG_REQUEST_TIMEOUT_MS || 10000);
const querySchema = z.object({
  query: z.string().trim().min(1).max(4000),
  session_id: z.string().max(200).optional(),
  top_k: z.number().int().min(1).max(5).default(2),
  language: z.string().trim().min(1).max(20).default('en'),
  market: z.string().trim().min(1).max(60).default('india'),
  product: z.string().trim().min(1).max(100).optional(),
});

// Route modules are evaluated before index.js loads .env. Resolve this at request
// time so the gateway always honours RAG_SERVICE_URL from the root environment.
const getRagUrl = () => (process.env.RAG_SERVICE_URL || 'http://localhost:8001').replace(/\/+$/, '');

function sendRagUnavailable(res, err) {
  if ([400, 422].includes(err.response?.status)) return res.status(err.response.status).json({ error: 'Invalid retrieval scope or query. Check the market, product, and query.' });
  const timedOut = err.code === 'ECONNABORTED';
  logger.error({ err: err.message, code: err.code }, 'RAG service request failed');
  return res.status(503).json({
    error: timedOut ? 'RAG service timed out' : 'RAG service is unavailable',
    message: timedOut
      ? 'The RAG service did not respond in time. Please try again.'
      : 'Start the RAG service and verify RAG_SERVICE_URL, then try again.',
  });
}

/**
 * POST /api/rag/query
 * Body: { query: string, session_id?: string, top_k?: number }
 * Returns: { answer, sources, chunks, latency_ms }
 */
router.post(['/query', '/retrieve'], async (req, res) => {
  const parsed = querySchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'Provide a nonempty query (up to 4000 characters), top_k from 1 to 5, and a valid market/product.' });
  const start = Date.now();

  let response;
  try {
    response = await axios.post(`${getRagUrl()}/retrieve`, parsed.data, { timeout: ragTimeout() });
  } catch (err) {
    return sendRagUnavailable(res, err);
  }

  const latency_ms = Date.now() - start;
  logger.info({ latency_ms, session_id: parsed.data.session_id }, 'RAG query completed');

  res.json({
    ...response.data,
    latency_ms,
  });
});

/**
 * GET /api/rag/health
 * Proxies to FastAPI RAG health check
 */
router.get('/health', async (req, res) => {
  try {
    const response = await axios.get(`${getRagUrl()}/health`, { timeout: ragTimeout() });
    res.json(response.data);
  } catch (err) {
    return sendRagUnavailable(res, err);
  }
});

/**
 * GET /api/rag/stats
 * Returns KB stats: total chunks, sources, last updated
 */
router.get('/stats', async (req, res) => {
  try {
    const response = await axios.get(`${getRagUrl()}/stats`, { timeout: ragTimeout() });
    res.json(response.data);
  } catch (err) {
    return sendRagUnavailable(res, err);
  }
});

export default router;
