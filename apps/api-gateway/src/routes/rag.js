import express from 'express';
import axios from 'axios';
import { logger } from '../index.js';

const router = express.Router();
const RAG_URL = process.env.RAG_SERVICE_URL || 'http://localhost:8001';

/**
 * POST /api/rag/query
 * Body: { query: string, session_id?: string, top_k?: number }
 * Returns: { answer, sources, chunks, latency_ms }
 */
router.post('/query', async (req, res) => {
  const { query, session_id, top_k = 2 } = req.body;

  if (!query || typeof query !== 'string') {
    return res.status(400).json({ error: 'query is required and must be a string' });
  }

  const start = Date.now();
  logger.info({ query, session_id }, 'RAG query received');

  const response = await axios.post(`${RAG_URL}/retrieve`, {
    query,
    top_k,
    session_id,
  });

  const latency_ms = Date.now() - start;
  logger.info({ latency_ms, session_id }, 'RAG query completed');

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
  const response = await axios.get(`${RAG_URL}/health`);
  res.json(response.data);
});

/**
 * GET /api/rag/stats
 * Returns KB stats: total chunks, sources, last updated
 */
router.get('/stats', async (req, res) => {
  const response = await axios.get(`${RAG_URL}/stats`);
  res.json(response.data);
});

export default router;
