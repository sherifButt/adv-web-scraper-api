import { Queue, Worker, QueueEvents, Job } from 'bullmq';
import { redisConnection } from '../config/redis.js';
import { logger } from '../../utils/logger.js';
import { processNavigationJob } from './navigation-worker.js';
import { processGenerateConfigJob } from './generate-config-worker.js'; // Import the new worker process

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

  public async getJobFromAnyQueue(jobId: string): Promise<Job | null> {
    for (const queue of Object.values(this.queues)) {
      const job = await queue.getJob(jobId);
      if (job) return job;
    }
    return null;
  }

  public async getAllJobs(): Promise<Array<{ queue: string; jobs: Job[] }>> {
    const results = [];
    for (const [name, queue] of Object.entries(this.queues)) {
      const jobs = await queue.getJobs(['waiting', 'active', 'completed', 'failed', 'delayed']);
      results.push({ queue: name, jobs });
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
