// src/core/queue/queue-service.ts

import { Queue, Worker, QueueEvents, Job } from 'bullmq';
import { redisConnection } from '../config/redis.js';
import { logger } from '../../utils/logger.js';
import { processNavigationJob } from './navigation-worker.js';
import { processGenerateConfigJob } from './generate-config-worker.js';

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

    // Ensure job ID is unique
    if (options?.jobId) {
      const existingJob = await queue.getJob(options.jobId);
      if (existingJob) {
        throw new Error(`Job ID ${options.jobId} already exists in queue ${queueName}`);
      }
    } else {
      // Force UUID generation if no ID provided
      options = { ...options, jobId: undefined };
    }

    return queue.add(jobName, data, options);
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
  private serializeJob(job: Job): any {
    // Extract only the necessary properties from the job
    const serializedJob = {
      id: job.id,
      name: job.name,
      data: job.data, // Typically omitted in API responses to reduce size
      opts: job.opts,
      progress: job.progress,
      returnvalue: job.returnvalue,
      stacktrace: job.stacktrace,
      delay: job.delay,
      priority: job.opts?.priority || 0,
      attemptsStarted: job.attemptsStarted,
      attemptsMade: job.attemptsMade,
      timestamp: job.timestamp,
      queueName: job.queueName,
      finishedOn: job.finishedOn,
      processedOn: job.processedOn,
      failedReason: job.failedReason,
    };

    return serializedJob;
  }

  public async getAllJobs(): Promise<Array<{ queue: string; jobs: any[] }>> {
    const results = [];

    for (const [name, queue] of Object.entries(this.queues)) {
      try {
        const jobs = await queue.getJobs(['waiting', 'active', 'completed', 'failed', 'delayed']);

        // Create a serializable version of each job
        const serializedJobs = jobs.map(job => this.serializeJob(job));

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
