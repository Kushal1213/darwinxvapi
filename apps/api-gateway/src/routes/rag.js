import express from 'express';
import axios from 'axios';
import { logger } from '../index.js';

const router = express.Router();
const RAG_TIMEOUT_MS = Number(process.env.RAG_REQUEST_TIMEOUT_MS || 10000);

// Route modules are evaluated before index.js loads .env. Resolve this at request
// time so the gateway always honours RAG_SERVICE_URL from the root environment.
const getRagUrl = () => (process.env.RAG_SERVICE_URL || 'http://localhost:8001').replace(/\/+$/, '');

function sendRagUnavailable(res, err) {
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
router.post('/query', async (req, res) => {
  const { query, session_id, top_k = 2, language = 'en', market = 'india' } = req.body;

  if (!query || typeof query !== 'string') {
    return res.status(400).json({ error: 'query is required and must be a string' });
  }

  const start = Date.now();
  logger.info({ query, session_id, language, market }, 'RAG query received');

  let response;
  try {
    response = await axios.post(`${getRagUrl()}/retrieve`, {
      query,
      top_k,
      session_id,
      language,
      market,
    }, { timeout: RAG_TIMEOUT_MS });
  } catch (err) {
    return sendRagUnavailable(res, err);
  }

  const latency_ms = Date.now() - start;
  logger.info({ latency_ms, session_id }, 'RAG query completed');

  res.json({
    ...response.data,
    latency_ms,
  });
});

/**
 * POST /api/rag/retrieve
 * Alias for /api/rag/query to match frontend expectations
 * Body: { query: string, session_id?: string, top_k?: number, language?: string, market?: string }
 * Returns: { answer, sources, chunks, latency_ms }
 */
router.post('/retrieve', async (req, res) => {
  const { query, session_id, top_k = 2, language = 'en', market = 'india' } = req.body;

  if (!query || typeof query !== 'string') {
    return res.status(400).json({ error: 'query is required and must be a string' });
  }

  const start = Date.now();
  logger.info({ query, session_id, language, market }, 'RAG retrieve received');

  let response;
  try {
    response = await axios.post(`${getRagUrl()}/retrieve`, {
      query,
      top_k,
      session_id,
      language,
      market,
    }, { timeout: RAG_TIMEOUT_MS });
  } catch (err) {
    return sendRagUnavailable(res, err);
  }

  const latency_ms = Date.now() - start;
  logger.info({ latency_ms, session_id }, 'RAG retrieve completed');

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
    const response = await axios.get(`${getRagUrl()}/health`, { timeout: RAG_TIMEOUT_MS });
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
    const response = await axios.get(`${getRagUrl()}/stats`, { timeout: RAG_TIMEOUT_MS });
    res.json(response.data);
  } catch (err) {
    return sendRagUnavailable(res, err);
  }
});

export default router;
