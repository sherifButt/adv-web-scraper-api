// src/core/queue/queue-service.ts

import { Queue, Worker, QueueEvents, Job } from 'bullmq';
import { v4 as uuidv4 } from 'uuid'; // Import uuid
import { redisConnection } from '../config/redis.js';
import { logger } from '../../utils/logger.js';
import { processNavigationJob } from './navigation-worker.js';
import { processGenerateConfigJob } from './generate-config-worker.js';
import { NavigationStep, NavigationResult, ProxyInfo } from '../../types/index.js';
import { Page } from 'playwright';
import * as z from 'zod'; // Using Zod for schema validation

// Define an interface for the detailed progress object
interface DetailedProgress {
    percentage?: number;
    status?: string;
}

export class QueueService {
  private queues: Record<string, Queue> = {};
  private workers: Record<string, Worker> = {};
  private queueEvents: Record<string, QueueEvents> = {};

  constructor() {
    this.setupSystemQueues();
  }

  private setupSystemQueues() {
    this.createQueue('scraping-jobs', {
      defaultJobOptions: {
        attempts: 3,
        backoff: {
          type: 'exponential',
          delay: 1000,
        },
      },
    });

    this.createQueue('captcha-solving', {
      priority: 1, // Higher priority for CAPTCHA jobs
    });

    this.createQueue('proxy-rotation');

    this.createQueue('navigation-jobs', {
      defaultJobOptions: {
        attempts: 3,
        backoff: {
          type: 'exponential',
          delay: 1000,
        },
      },
    });

    // Create worker for navigation jobs
    this.createWorker('navigation-jobs', processNavigationJob);

    // Create queue and worker for AI config generation jobs
    this.createQueue('config-generation-jobs', {
      defaultJobOptions: {
        attempts: 1, // Config generation might be less critical to retry automatically
        timeout: 300000, // Allow 5 minutes for generation + testing
      },
    });
    this.createWorker('config-generation-jobs', processGenerateConfigJob);
  }

  public createQueue(name: string, options: any = {}) {
    if (this.queues[name]) {
      return this.queues[name];
    }

    const queue = new Queue(name, {
      connection: redisConnection,
      ...options,
    });

    this.queues[name] = queue;
    this.setupQueueMonitoring(name);
    return queue;
  }

  private setupQueueMonitoring(name: string) {
    this.queueEvents[name] = new QueueEvents(name, {
      connection: redisConnection,
    });

    this.queueEvents[name].on('completed', ({ jobId }: { jobId: string }) => {
      logger.info(`Job ${jobId} completed in queue ${name}`);
    });

    this.queueEvents[name].on(
      'failed',
      ({ jobId, failedReason }: { jobId: string; failedReason: string }) => {
        logger.error(`Job ${jobId} failed in queue ${name}: ${failedReason}`);
      }
    );
  }

  public async addJob(queueName: string, jobName: string, data: any, options?: any) {
    const queue = this.queues[queueName] || this.createQueue(queueName);
    const jobOptions = { ...options }; // Clone options to avoid modifying the original object

    // Generate a UUID if jobId is not provided
    if (!jobOptions?.jobId) {
      jobOptions.jobId = uuidv4();
      logger.info(
        `Generated unique Job ID ${jobOptions.jobId} for job ${jobName} in queue ${queueName}`
      );
    }

    // Check for duplicates using the potentially generated or provided jobId
    const existingJob = await queue.getJob(jobOptions.jobId);
    if (existingJob) {
      logger.warn(`Job ID ${jobOptions.jobId} already exists in queue ${queueName}. Skipping add.`);
      // Optionally throw an error or return the existing job
      // throw new Error(`Job ID ${jobOptions.jobId} already exists in queue ${queueName}`);
      return existingJob; // Return existing job instead of throwing error
    }

    logger.info(`Adding job ${jobName} to queue ${queueName} with ID ${jobOptions.jobId}`);
    return queue.add(jobName, data, jobOptions);
  }

  // Allow processor to return any Promise result
  public createWorker(queueName: string, processor: (job: Job) => Promise<any>) {
    if (this.workers[queueName]) {
      return this.workers[queueName];
    }

    const worker = new Worker(queueName, processor, {
      connection: redisConnection,
      concurrency: 5,
    });

    worker.on('completed', (job: Job) => {
      logger.info(`Completed job ${job.id} in queue ${queueName}`);
    });

    worker.on('failed', (job: Job | undefined, err: Error) => {
      logger.error(`Failed job ${job?.id} in queue ${queueName}: ${err.message}`);
    });

    this.workers[queueName] = worker;
    return worker;
  }

  public async close() {
    await Promise.all([
      ...Object.values(this.queues).map(q => q.close()),
      ...Object.values(this.workers).map(w => w.close()),
      ...Object.values(this.queueEvents).map(e => e.close()),
    ]);
  }

  // Get a specific queue by name
  public getQueueByName(name: string): Queue | undefined {
    return this.queues[name];
  }

  public async getJobFromAnyQueue(jobId: string): Promise<Job | null> {
    for (const queue of Object.values(this.queues)) {
      const job = await queue.getJob(jobId);
      if (job) return job;
    }
    return null;
  }

  // Helper to convert Job to a plain serializable object
  private async serializeJob(job: Job): Promise<any> {
    // Determine the overall job state
    let status: string = 'unknown';
    if (await job.isCompleted()) status = 'completed';
    else if (await job.isFailed()) status = 'failed';
    else if (await job.isActive()) status = 'active';
    else if (await job.isDelayed()) status = 'delayed';
    else if (await job.isWaiting()) status = 'waiting';
    else if (await job.isWaitingChildren()) status = 'waiting-children';
    // TODO: Add other states if necessary (e.g., paused, stuck?)

    // Extract detailed progress if available
    let progressPercentage: number = 0;
    let detailedStatus: string | undefined = undefined;

    // Check if progress is an object and fits our expected structure
    const progressData = job.progress as any; // Cast to any for initial check
    if (
      typeof progressData === 'object' &&
      progressData !== null &&
      (typeof progressData.percentage === 'number' || typeof progressData.status === 'string')
    ) {
      const detailedProgress = progressData as DetailedProgress; // Cast to our interface
      progressPercentage = Math.round(detailedProgress.percentage ?? 0);
      detailedStatus = detailedProgress.status ?? undefined;
    } else if (typeof job.progress === 'number') {
      progressPercentage = Math.round(job.progress);
    }

    // Ensure progress is 100% if completed, 0% if not started
    if (status === 'completed') {
        progressPercentage = 100;
        // Optionally clear detailed status upon completion
        // detailedStatus = undefined;
    } else if (status === 'waiting' || status === 'delayed') {
        progressPercentage = 0;
    }


    const serializedJob = {
      id: job.id,
      name: job.name,
      status: status, // Overall status
      progress: progressPercentage, // Use 'progress' for the percentage
      detailedStatus: status === 'active' ? detailedStatus : undefined, // Show detailed status only when active
      // data: job.data, // Keep data omitted unless specifically needed
      opts: {
          attempts: job.opts?.attempts,
          delay: job.opts?.delay,
          priority: job.opts?.priority,
          repeat: job.opts?.repeat,
          lifo: job.opts?.lifo,
          jobId: job.opts?.jobId,
          removeOnComplete: job.opts?.removeOnComplete,
          removeOnFail: job.opts?.removeOnFail,
          // Add other relevant opts if needed, avoid exposing sensitive ones
      },
      returnValue: job.returnvalue, // Keep for completed jobs
      failedReason: job.failedReason, // Keep for failed jobs
      stacktrace: job.stacktrace?.slice(0, 1), // Limit stacktrace in response
      attemptsMade: job.attemptsMade,
      timestamp: job.timestamp,
      queueName: job.queueName,
      finishedOn: job.finishedOn,
      processedOn: job.processedOn,
    };

    // Clean up undefined fields if needed, although often handled by JSON.stringify
    // Object.keys(serializedJob).forEach(key => serializedJob[key] === undefined && delete serializedJob[key]);

    return serializedJob;
  }

  public async getAllJobs(): Promise<Array<{ queue: string; jobs: any[] }>> {
    const results = [];

    for (const [name, queue] of Object.entries(this.queues)) {
      try {
        const jobs = await queue.getJobs(['waiting', 'active', 'completed', 'failed', 'delayed']);

        // Use Promise.all because serializeJob is now async
        const serializedJobs = await Promise.all(jobs.map(job => this.serializeJob(job)));

        results.push({ queue: name, jobs: serializedJobs });
      } catch (error) {
        logger.error(
          `Error getting jobs from queue ${name}: ${
            error instanceof Error ? error.message : String(error)
          }`
        );
        // Continue with other queues even if one fails
        results.push({ queue: name, jobs: [] });
      }
    }

    return results;
  }

  public async cancelJob(jobId: string): Promise<boolean> {
    for (const queue of Object.values(this.queues)) {
      const job = await queue.getJob(jobId);
      if (job) {
        await job.remove();
        return true;
      }
    }
    return false;
  }
}
