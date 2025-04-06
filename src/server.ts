import { createServer } from 'http';
import app from './app.js';
import { config } from './config/index.js';
import { logger } from './utils/logger.js';

const PORT = config.server.port;
const HOST = config.server.host;

const server = createServer(app);

server.listen(PORT, () => {
  logger.info(`Server running at http://${HOST}:${PORT}/`);
  logger.info(`Environment: ${config.environment}`);
});

// Handle graceful shutdown
process.on('SIGTERM', () => {
  logger.info('SIGTERM signal received: closing HTTP server');
  server.close(() => {
    logger.info('HTTP server closed');
    process.exit(0);
  });
});

export default server;
