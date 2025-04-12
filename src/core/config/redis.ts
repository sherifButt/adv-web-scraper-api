import { Redis } from 'ioredis';
import config from '../config/index.js';

export const redisConnection = new Redis({
  host: config.redis.host,
  port: config.redis.port,
  maxRetriesPerRequest: null, // For BullMQ compatibility
});

redisConnection.on('error', (err: Error) => {
  console.error('Redis connection error:', err);
});

export default redisConnection;
