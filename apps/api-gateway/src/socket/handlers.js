import { logger } from '../index.js';
import { getNudgeStore } from '../services/nudges.js';

export function initSocketHandlers(io) {
  io.on('connection', (socket) => {
    logger.info({ socketId: socket.id }, '📡 Dashboard client connected');

    // Client identifies itself (e.g., which call_id it's monitoring)
    socket.on('monitor:call', (data) => {
      const { call_id } = data;
      if (call_id) {
        socket.join(`call:${call_id}`);
        logger.info({ socketId: socket.id, call_id }, 'Client monitoring call');
      }
    });

    // Client requests a nudge to be dismissed
    socket.on('nudge:dismiss', (data, callback) => {
      try {
        if (typeof data?.nudge_id !== 'string') throw new Error('Invalid nudge ID');
        const nudge = getNudgeStore().act(data.nudge_id, 'dismissed', socket.request.session.userId);
        io.emit('nudge:updated', { nudge });
        if (typeof callback === 'function') callback({ nudge });
      } catch (error) {
        if (typeof callback === 'function') callback({ error: error.message });
      }
    });

    socket.on('disconnect', () => {
      logger.info({ socketId: socket.id }, '❌ Dashboard client disconnected');
    });
  });
}
