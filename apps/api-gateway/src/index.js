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

// Socket handler
import { initSocketHandlers } from './socket/handlers.js';

dotenv.config({ path: resolve(__dirname, '../../../.env') });

export const logger = pino({
  transport: {
    target: 'pino-pretty',
    options: { colorize: true, translateTime: 'SYS:standard' },
  },
  level: process.env.LOG_LEVEL || 'info',
});

const app = express();
const httpServer = createServer(app);

// ── Socket.IO ────────────────────────────────────────────────
export const io = new Server(httpServer, {
  cors: {
    origin: ['http://localhost:3000', 'http://localhost:5173', process.env.FRONTEND_URL].filter(Boolean),
    methods: ['GET', 'POST'],
  },
});
initSocketHandlers(io);

// ── Middleware ────────────────────────────────────────────────
app.use(cors({ origin: ['http://localhost:3000', 'http://localhost:5173', process.env.FRONTEND_URL].filter(Boolean) }));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(morgan('dev'));

// ── Routes ────────────────────────────────────────────────────
app.use('/api/health', healthRoutes);
app.use('/api/rag', ragRoutes);
app.use('/api/voice', voiceRoutes);
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
httpServer.listen(PORT, () => {
  logger.info(`🚀 API Gateway running on http://localhost:${PORT}`);
  logger.info(`📡 Socket.IO ready`);
});

export default app;
