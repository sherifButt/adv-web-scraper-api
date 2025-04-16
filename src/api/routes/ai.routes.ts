// src/api/routes/ai.routes.ts
import { Router } from 'express';
import { asyncHandler } from '../middleware/error.middleware.js';
import { QueueService } from '../../core/queue/queue-service.js';
import { logger } from '../../utils/logger.js';
import { GenerateConfigRequest, ApiResponse } from '../../types/index.js'; // Import relevant types

const router = Router();
const queueService = new QueueService(); // Initialize queue service

/**
 * @route   POST /api/v1/ai/generate-config
 * @desc    Queue a job to generate a scraping configuration using AI
 * @access  Public
 */
router.post(
  '/generate-config',
  asyncHandler(async (req, res) => {
    try {
      const { url, prompt, options }: GenerateConfigRequest = req.body;

      // --- Basic Validation ---
      if (!url || typeof url !== 'string') {
        return res.status(400).json({
          success: false,
          message: 'URL is required and must be a string',
          error: 'Missing or invalid parameter: url',
          timestamp: new Date().toISOString(),
        });
      }
      try {
        // Validate URL format
        new URL(url);
      } catch (_) {
        return res.status(400).json({
          success: false,
          message: 'Invalid URL format',
          error: 'Invalid parameter format: url',
          timestamp: new Date().toISOString(),
        });
      }

      if (!prompt || typeof prompt !== 'string') {
        return res.status(400).json({
          success: false,
          message: 'Prompt is required and must be a string',
          error: 'Missing or invalid parameter: prompt',
          timestamp: new Date().toISOString(),
        });
      }

      // TODO: Add more specific validation for options if needed using Zod

      logger.info(`Queueing AI config generation job for URL: ${url}`);

      // --- Queue the Job ---
      const job = await queueService.addJob(
        'config-generation-jobs', // Target the correct queue
        'generate-config', // Job name/type
        { url, prompt, options } // Job data
      );

      // --- Return Job Info ---
      const response: ApiResponse<{ jobId: string; statusUrl: string }> = {
        success: true,
        message: 'AI configuration generation job queued successfully',
        data: {
          jobId: job.id!, // Assert job.id is not null/undefined
          statusUrl: `/api/v1/jobs/${job.id}`, // Use correct API version path
        },
        timestamp: new Date().toISOString(),
      };
      return res.status(202).json(response);

    } catch (error: any) {
      logger.error(`Error in AI generate-config endpoint: ${error.message}`);
      const response: ApiResponse<null> = {
        success: false,
        message: 'Failed to queue AI configuration generation job',
        error: error.message,
        timestamp: new Date().toISOString(),
      };
      return res.status(500).json(response);
    }
  })
);

export const aiRoutes = router;
