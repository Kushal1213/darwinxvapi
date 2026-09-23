import express from 'express';
import axios from 'axios';

const router = express.Router();

router.get('/', async (req, res) => {
  const services = {
    gateway: { status: 'ok', uptime: process.uptime() },
    rag: null,
    ingestion: null,
    realtime: null,
  };

  // Check all FastAPI services
  // Read config during the request. index.js loads the root .env after route
  // modules are imported, and deployments may use either insights variable.
  const ragUrl = process.env.RAG_SERVICE_URL || 'http://localhost:8001';
  const ingestionUrl = process.env.INGESTION_SERVICE_URL || 'http://localhost:8002';
  const realtimeUrl = process.env.INSIGHTS_SERVICE_URL || process.env.REALTIME_AI_URL || 'http://localhost:8003';
  const checks = await Promise.allSettled([
    axios.get(`${ragUrl.replace(/\/+$/, '')}/health`, { timeout: 2000 }),
    axios.get(`${ingestionUrl.replace(/\/+$/, '')}/health`, { timeout: 2000 }),
    axios.get(`${realtimeUrl.replace(/\/+$/, '')}/health`, { timeout: 2000 }),
  ]);

  const names = ['rag', 'ingestion', 'realtime'];
  checks.forEach((result, i) => {
    services[names[i]] =
      result.status === 'fulfilled'
        ? { status: 'ok', ...result.value.data }
        : { status: 'unavailable', error: result.reason?.message };
  });

  const allOk = Object.values(services).every((s) => s?.status === 'ok');
  res.status(allOk ? 200 : 207).json({
    status: allOk ? 'healthy' : 'degraded',
    timestamp: new Date().toISOString(),
    services,
  });
});

export default router;
