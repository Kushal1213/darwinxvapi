import { logger } from '../index.js';

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
    socket.on('nudge:dismiss', (data) => {
      const { nudge_id } = data;
      io.emit('nudge:dismissed', { nudge_id, dismissed_by: socket.id });
    });

    socket.on('disconnect', () => {
      logger.info({ socketId: socket.id }, '❌ Dashboard client disconnected');
    });
  });
}
