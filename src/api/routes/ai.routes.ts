// src/api/routes/ai.routes.ts
import { Router } from 'express';
import { asyncHandler } from '../middleware/error.middleware.js';
import { QueueService } from '../../core/queue/queue-service.js';
import { StorageService } from '../../storage/index.js'; // Import StorageService
import { logger } from '../../utils/logger.js';
import { GenerateConfigRequest, ApiResponse, StoredScrapingConfig } from '../../types/index.js';
import { validateRequest, generateConfigSchema } from '../validators/ai.validator.js';

const router = Router();
const queueService = new QueueService();
const storageService = StorageService.getInstance(); // Get instance of StorageService

/**
 * @route   POST /api/v1/ai/generate-config
 * @desc    Queue a job to generate/refine a scraping configuration using AI
 * @access  Public
 */
router.post(
  '/generate-config',
  validateRequest(generateConfigSchema),
  asyncHandler(async (req, res) => {
    try {
      // Destructure all potential fields from the validated body
      const {
        url,
        prompt,
        options,
        previousJobId,
        fetchHtmlForRefinement,
      }: GenerateConfigRequest & {
        previousJobId?: string;
        fetchHtmlForRefinement?: boolean;
      } = req.body; // Type assertion needed if GenerateConfigRequest isn't updated

      let jobData: any;
      let message: string;

      if (previousJobId) {
        // --- Refinement Flow ---
        logger.info(
          `Queueing AI config refinement job based on previous job: ${previousJobId}`
        );

        // Fetch previous job details from storage
        const previousJobData = (await storageService.retrieve(
          previousJobId
        )) as StoredScrapingConfig | null; // Use retrieve and cast

        // Check if data exists and has the crucial fields
        if (!previousJobData || !previousJobData.config || !previousJobData.originalPrompt) {
          logger.warn(
            `Could not find valid previous job data (missing config or originalPrompt) for ID: ${previousJobId}`
          );
          return res.status(404).json({
            success: false,
            message: `Previous job data not found or incomplete (missing config or originalPrompt) for ID: ${previousJobId}`,
            timestamp: new Date().toISOString(),
          });
        }

        // Prepare job data for refinement
        const refinementOptions = {
          ...previousJobData.options, // Start with previous options
          ...options, // Override with any new options provided
          browserOptions: { // Deep merge browserOptions
              ...(previousJobData.options?.browserOptions || {}),
              ...(options?.browserOptions || {}),
          },
          interactionHints: options?.interactionHints ?? previousJobData.options?.interactionHints ?? [], // Prioritize new hints
        };


        jobData = {
          url: previousJobData.url, // Use original URL from previous job
          prompt: previousJobData.originalPrompt, // Use original prompt from previous job
          options: refinementOptions, // Merged options
          initialState: {
            lastConfig: previousJobData.config, // Last known config
            userFeedback: prompt, // The 'prompt' field in the request is the feedback
            // Reset cost/tokens for the refinement job
            tokensUsed: 0,
            estimatedCost: 0,
          },
          isRefinement: true,
          fetchHtmlForRefinement: fetchHtmlForRefinement ?? false,
          refinesJobId: previousJobId,
        };
        message = 'AI configuration refinement job queued successfully';
      } else {
        // --- Initial Generation Flow ---
        logger.info(`Queueing AI config generation job for URL: ${url}`);
        if (!url || !prompt) {
           // This check is technically redundant due to validation, but good practice
           return res.status(400).json({ success: false, message: "URL and prompt are required for initial generation." });
        }
        jobData = { url, prompt, options };
        message = 'AI configuration generation job queued successfully';
      }

      // --- Queue the Job ---
      const job = await queueService.addJob(
        'config-generation-jobs',
        'generate-config',
        jobData
      );

      // --- Return Job Info ---
      const response: ApiResponse<{ jobId: string; statusUrl: string }> = {
        success: true,
        message: message,
        data: {
          jobId: job.id!,
          statusUrl: `/api/v1/jobs/${job.id}`,
        },
        timestamp: new Date().toISOString(),
      };
      return res.status(202).json(response);
    } catch (error: any) {
      logger.error(`Error in AI generate-config endpoint: ${error.message}`, error);
      const response: ApiResponse<null> = {
        success: false,
        message: 'Failed to queue AI configuration job',
        error: error.message,
        timestamp: new Date().toISOString(),
      };
      // Distinguish between client errors (like 404) and server errors
      if (error.message.includes('Previous job data not found')) {
          return res.status(404).json(response);
      }
      return res.status(500).json(response);
    }
  })
);

export const aiRoutes = router;
