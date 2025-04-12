import { Router } from 'express';
import { Queue, Job } from 'bullmq';
import { redisConnection } from '../../core/config/redis.js';
import { StorageService } from '../../storage/storage-service.js';
import { QueueService } from '../../core/queue/queue-service.js';
import { logger } from '../../utils/logger.js';

const router = Router();
const queueService = new QueueService();
const storageService = StorageService.getInstance();

/**
 * @route   GET /api/v1/jobs
 * @desc    Get list of all jobs
 * @access  Public
 */
router.get('/', async (req, res) => {
  try {
    const jobs = await queueService.getAllJobs();
    // remove data from jobs
    // jobs.forEach(job => {
    //   job.jobs.forEach(j => {
    //     delete j.data;
    //   });
    // });
    return res.status(200).json({
      success: true,
      message: 'Jobs retrieved',
      data: jobs,
      timestamp: new Date().toISOString(),
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    logger.error(`Failed to get jobs: ${message}`);
    return res.status(500).json({
      success: false,
      message: 'Failed to get jobs',
      error: message,
      timestamp: new Date().toISOString(),
    });
  }
});

/**
 * @route   DELETE /api/v1/jobs/:id
 * @desc    Cancel a job
 * @access  Public
 */
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const result = await queueService.cancelJob(id);

    if (!result) {
      return res.status(404).json({
        success: false,
        message: 'Job not found or already completed',
        error: `No active job found with ID: ${id}`,
        timestamp: new Date().toISOString(),
      });
    }

    return res.status(200).json({
      success: true,
      message: 'Job cancelled',
      data: { id },
      timestamp: new Date().toISOString(),
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    logger.error(`Failed to cancel job: ${message}`);
    return res.status(500).json({
      success: false,
      message: 'Failed to cancel job',
      error: message,
      timestamp: new Date().toISOString(),
    });
  }
});

/**
 * @route   GET /api/v1/jobs/:id
 * @desc    Get job status and results
 * @access  Public
 */
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;

    // Get job status from queue
    // Get job from any queue
    const job = await queueService.getJobFromAnyQueue(id);
    if (!job) {
      return res.status(404).json({
        success: false,
        message: 'Job not found',
        error: `No job found with ID: ${id}`,
        timestamp: new Date().toISOString(),
      });
    }

    // Get stored results if job completed
    let result = null;
    const jobState = await job.getState();
    logger.debug(`Job ${id} state: ${jobState}`);

    if (jobState === 'completed') {
      logger.debug(`Attempting to retrieve results for completed job ${id} from storage`);
      result = await storageService.retrieve(id);
      logger.debug(
        `Result from storage for job ${id}:`,
        result ? JSON.stringify(result, null, 2) : 'null'
      );

      if (!result) {
        logger.warn(`No stored results found for completed job ${id}. Checking job.returnvalue.`);
        // Check if results might be in job return value
        if (job.returnvalue) {
          logger.debug(
            `Found result in job.returnvalue for job ${id}:`,
            JSON.stringify(job.returnvalue, null, 2)
          );
          result = job.returnvalue;
        } else {
          logger.warn(`No result found in job.returnvalue for job ${id}.`);
        }
      }
    }

    return res.status(200).json({
      success: true,
      message: 'Job status retrieved',
      data: {
        id: job.id,
        status: jobState,
        progress: job.progress,
        result,
        createdAt: job.timestamp,
        completedAt: job.finishedOn,
        failedReason: job.failedReason,
      },
      timestamp: new Date().toISOString(),
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    logger.error(`Failed to get job status: ${message}`);
    return res.status(500).json({
      success: false,
      message: 'Failed to get job status',
      error: message,
      timestamp: new Date().toISOString(),
    });
  }
});

export const jobRoutes = router;
