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
  const checks = await Promise.allSettled([
    axios.get(`${process.env.RAG_SERVICE_URL}/health`, { timeout: 2000 }),
    axios.get(`${process.env.INGESTION_SERVICE_URL}/health`, { timeout: 2000 }),
    axios.get(`${process.env.REALTIME_AI_URL}/health`, { timeout: 2000 }),
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
