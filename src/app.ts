import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import { config } from './config/index.js';
import { errorHandler } from './api/middleware/error.middleware.js';
import { logger } from './utils/logger.js';
import { apiRoutes } from './api/routes/index.js';
import { JobCleanupService } from './core/queue/job-cleanup-service.js';

// Create Express app
const app = express();

// Apply security middleware
app.use(helmet());
app.use(cors());

// Serve static files from root and media directories
app.use(express.static('.'));
app.use('/screenshots', express.static('screenshots'));
app.use('/media/images', express.static('media/images'));
app.use('/media/videos', express.static('media/videos'));

// Parse JSON bodies
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Apply rate limiting
const limiter = rateLimit({
  windowMs: config.rateLimit.windowMs,
  max: config.rateLimit.max,
  standardHeaders: true,
  legacyHeaders: false,
  message: 'Too many requests from this IP, please try again later',
});
app.use(limiter);

// Request logging middleware
app.use((req, res, next) => {
  logger.info(`${req.method} ${req.url}`);
  next();
});

// API routes
app.use('/api/v1', apiRoutes);

// Health check endpoint
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'ok' });
});

// Error handling middleware
app.use(errorHandler);

// 404 handler
app.use((req, res) => {
  res.status(404).json({ error: 'Not Found' });
});

// Start the JobCleanupService
const jobCleanupService = JobCleanupService.getInstance();
jobCleanupService.start();

export default app;
