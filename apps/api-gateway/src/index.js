import 'express-async-errors';
import express from 'express';
import { createServer } from 'http';
import cors from 'cors';
import morgan from 'morgan';
import dotenv from 'dotenv';
import { Server } from 'socket.io';
import pino from 'pino';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Route imports
import ragRoutes from './routes/rag.js';
import voiceRoutes from './routes/voice.js';
import vapiConfigRoutes from './routes/vapi-config.js';
import transcriptRoutes from './routes/transcript.js';
import crmRoutes from './routes/crm.js';
import healthRoutes from './routes/health.js';
import nudgeRoutes from './routes/nudges.js';
import knowledgeRoutes, { startKnowledgeWorker } from './routes/knowledge.js';
import analyticsRoutes from './routes/analytics.js';
import handoffRoutes from './routes/handoffs.js';
import knowledgeGapRoutes from './routes/knowledge-gaps.js';
import disclosureChecklistRoutes from './routes/disclosure-checklists.js';
import { createAuthentication } from './services/auth.js';

// Socket handler
import { initSocketHandlers } from './socket/handlers.js';

dotenv.config({ path: process.env.VEYRA_ENV_FILE || resolve(__dirname, '../../../.env') });

export const logger = pino({
  transport: {
    target: 'pino-pretty',
    options: { colorize: true, translateTime: 'SYS:standard' },
  },
  level: process.env.LOG_LEVEL || 'info',
});

const app = express();
const httpServer = createServer(app);
const allowedOrigins = process.env.NODE_ENV === 'production' || process.env.VEYRA_TENANT_ID
  ? [process.env.FRONTEND_URL].filter(Boolean)
  : ['http://localhost:3000', 'http://localhost:5173', process.env.FRONTEND_URL].filter(Boolean);
if (process.env.TRUST_PROXY === '1') app.set('trust proxy', 1);

// ── Socket.IO ────────────────────────────────────────────────
export const io = new Server(httpServer, {
  cors: {
    origin: allowedOrigins,
    methods: ['GET', 'POST'],
  },
});
const auth = createAuthentication(io, allowedOrigins);
initSocketHandlers(io);

// ── Middleware ────────────────────────────────────────────────
app.use(cors({ origin: allowedOrigins, credentials: true }));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(morgan('dev'));

// ── Routes ────────────────────────────────────────────────────
app.use('/api', (_req, res, next) => { res.set('Cache-Control', 'no-store'); next(); });
app.use('/api', auth.middleware, auth.originGuard);
app.use('/api/auth', auth.router);
app.use('/api', auth.requireAuth);
app.use('/api/team', auth.teamRouter);
app.use('/api/knowledge', (req, res, next) => ['GET', 'HEAD', 'OPTIONS'].includes(req.method) ? next() : auth.requireAdmin(req, res, next));
app.use('/api/knowledge/gaps', knowledgeGapRoutes);
app.use('/api/disclosure-checklists', (req, res, next) => ['GET', 'HEAD', 'OPTIONS'].includes(req.method) ? next() : auth.requireAdmin(req, res, next));
app.use('/api/disclosure-checklists', disclosureChecklistRoutes);
app.use('/api/health', healthRoutes);
app.use('/api/analytics', analyticsRoutes);
app.use('/api/rag', ragRoutes);
app.use('/api/voice', voiceRoutes);
app.use('/api/nudges', nudgeRoutes);
app.use('/api/handoffs', handoffRoutes);
app.use('/api/knowledge', knowledgeRoutes);
app.use('/api/vapi', vapiConfigRoutes);
app.use('/api/transcript', transcriptRoutes);
app.use('/api/crm', crmRoutes);

// ── 404 ───────────────────────────────────────────────────────
app.use((req, res) => {
  res.status(404).json({ error: 'Route not found', path: req.path });
});

// ── Error handler ─────────────────────────────────────────────
app.use((err, req, res, _next) => {
  logger.error(err, 'Unhandled error');
  res.status(err.status || 500).json({
    error: err.message || 'Internal server error',
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack }),
  });
});

// ── Start ─────────────────────────────────────────────────────
const PORT = process.env.PORT || 3001;
httpServer.listen(PORT, process.env.VEYRA_TENANT_ID ? '127.0.0.1' : undefined, () => {
  startKnowledgeWorker(error => logger.error(error, 'Knowledge worker failed'));
  logger.info(`🚀 API Gateway running on http://localhost:${PORT}`);
  logger.info(`📡 Socket.IO ready`);
});

export default app;
