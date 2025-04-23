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
 * @route GET /api/v1/jobs
 * @desc Get list of all jobs with pagination, limit and filtering by queue or job name
 * @access Public
 */
router.get('/', async (req, res) => {
  try {
    // Extract query parameters
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 10;
    const queue = req.query.queue as string; // Optional queue filter
    const name = req.query.name as string; // Optional job name filter

    // Calculate offset
    const offset = (page - 1) * limit;

    // Get all jobs from queues
    const jobs = await queueService.getAllJobs();

    // Apply filters
    let filteredJobs = [...jobs];

    // First filter by queue name if specified
    if (queue) {
      // Check if the queue parameter is a queue name or job name
      const queueExists = filteredJobs.some(jobData => jobData.queue === queue);

      if (queueExists) {
        // Filter by queue name
        filteredJobs = filteredJobs.filter(jobData => jobData.queue === queue);
      } else {
        // It might be a job name, so filter by job name instead
        filteredJobs = filteredJobs
          .map(queueData => {
            return {
              queue: queueData.queue,
              jobs: queueData.jobs.filter(job => job.name === queue),
            };
          })
          .filter(queueData => queueData.jobs.length > 0);
      }
    }

    // Then filter by job name if specified
    if (name) {
      filteredJobs = filteredJobs
        .map(queueData => {
          return {
            queue: queueData.queue,
            jobs: queueData.jobs.filter(job => job.name === name),
          };
        })
        .filter(queueData => queueData.jobs.length > 0);
    }

    // Calculate total number of jobs and pages
    const totalJobs = filteredJobs.reduce((acc, queueJobs) => acc + queueJobs.jobs.length, 0);
    const totalPages = Math.ceil(totalJobs / limit);

    // Apply pagination and limit to the jobs
    const paginatedData = [];
    let currentCount = 0;

    for (const queueData of filteredJobs) {
      // Skip entire queue if we've already passed the current page's data
      if (currentCount >= offset + limit) {
        continue;
      }

      const queueJobs = [...queueData.jobs];
      const pageJobs = [];

      for (const job of queueJobs) {
        // Skip jobs before the current page
        if (currentCount < offset) {
          currentCount++;
          continue;
        }

        // Add jobs within the current page's limit
        if (currentCount < offset + limit) {
          // Omit job data to reduce response size
          const jobCopy = { ...job };
          delete jobCopy.data;
          pageJobs.push(jobCopy);
          currentCount++;
        } else {
          break;
        }
      }

      if (pageJobs.length > 0) {
        paginatedData.push({
          queue: queueData.queue,
          jobs: pageJobs,
        });
      }
    }

    return res.status(200).json({
      success: true,
      message: 'Jobs retrieved',
      data: paginatedData,
      pagination: {
        page,
        limit,
        totalJobs,
        totalPages,
      },
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
 * @route DELETE /api/v1/jobs/:id
 * @desc Cancel a job
 * @access Public
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
 * @route GET /api/v1/jobs/:id
 * @desc Get job status and results
 * @access Public
 */
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;

    // Get job status from queue
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
    let resultData = null;
    let estimatedCost = null;
    let numberInQueue = null;

    const jobState = await job.getState();
    logger.debug(`Job ${id} state: ${jobState}`);

    // Get position in queue for active/waiting jobs
    if (jobState === 'waiting' || jobState === 'active') {
      const queueName = job.queueName;
      const queue = await queueService.getQueueByName(queueName);

      if (queue) {
        // For waiting jobs, check position in waiting list
        if (jobState === 'waiting') {
          const waitingJobs = await queue.getWaiting();
          const jobIndex = waitingJobs.findIndex(j => j.id === id);

          if (jobIndex !== -1) {
            numberInQueue = jobIndex + 1;
          }
        }
        // For active jobs, position is 0 (currently processing)
        // plus count of jobs with higher priority in the waiting list
        else if (jobState === 'active') {
          const waitingJobs = await queue.getWaiting();
          // Get job priority (default to 0 if not set)
          const jobPriority = job.opts?.priority || 0;

          // Count jobs with higher or equal priority
          const higherPriorityJobs = waitingJobs.filter(j => {
            const priority = j.opts?.priority || 0;
            return priority >= jobPriority;
          }).length;

          // For active jobs, position is 0 (currently processing)
          // but we show the count of higher priority jobs waiting
          numberInQueue = higherPriorityJobs > 0 ? higherPriorityJobs : 0;
        }
      }
    }

    if (jobState === 'completed') {
      logger.debug(`Attempting to retrieve results for completed job ${id} from storage`);
      const storedResult = await storageService.retrieve(id);

      logger.debug(
        `Result from storage for job ${id}:`,
        storedResult ? JSON.stringify(storedResult, null, 2) : 'null'
      );

      if (storedResult) {
        estimatedCost = storedResult.estimatedCost;
        resultData = storedResult;
      } else {
        logger.warn(`No stored results found for completed job ${id}. Checking job.returnvalue.`);

        if (job.returnvalue) {
          logger.debug(
            `Found result in job.returnvalue for job ${id}:`,
            JSON.stringify(job.returnvalue, null, 2)
          );
          resultData = job.returnvalue;
          estimatedCost = job.returnvalue.estimatedCost;
        } else {
          logger.warn(`No result found in job.returnvalue for job ${id}.`);
        }
      }
    }

    const responseData = {
      id: job.id,
      name: job.name,
      status: jobState,
      progress: job.progress,
      result: resultData,
      estimatedCost: estimatedCost,
      createdAt: job.timestamp,
      completedAt: job.finishedOn,
      failedReason: job.failedReason,
      numberInQueue: job.numberInQueue,
    };

    // Add numberInQueue for active/waiting jobs
    // Always include it for active/waiting jobs, even if it's 0
    if (jobState === 'waiting' || jobState === 'active') {
      responseData['numberInQueue'] = numberInQueue !== null ? numberInQueue : 0;
    }

    return res.status(200).json({
      success: true,
      message: 'Job status retrieved',
      data: responseData,
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
