import { QueueService } from './queue-service.ts';
import { logger } from '../../utils/logger.ts';
import { config } from '../../config/index.ts';

export class JobCleanupService {
  private static instance: JobCleanupService;
  private queueService: QueueService;
  private cleanupInterval: NodeJS.Timeout | null = null;

  private constructor() {
    this.queueService = new QueueService();
  }

  public static getInstance(): JobCleanupService {
    if (!JobCleanupService.instance) {
      JobCleanupService.instance = new JobCleanupService();
    }
    return JobCleanupService.instance;
  }

  public start(): void {
    if (this.cleanupInterval) {
      return; // Already running
    }

    const intervalMs = config.jobs.cleanupIntervalHours * 60 * 60 * 1000;

    // Run immediately on start
    this.cleanupOldJobs();

    // Then schedule regular cleanup
    this.cleanupInterval = setInterval(() => {
      this.cleanupOldJobs();
    }, intervalMs);

    logger.info(
      `Job cleanup service started. Running every ${config.jobs.cleanupIntervalHours} hours`
    );
  }

  public stop(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
      logger.info('Job cleanup service stopped');
    }
  }

  private async cleanupOldJobs(): Promise<void> {
    try {
      const retentionMs = config.jobs.retentionPeriodDays * 24 * 60 * 60 * 1000;
      const cutoffDate = new Date(Date.now() - retentionMs);

      logger.info(
        `Starting job cleanup for jobs older than ${
          config.jobs.retentionPeriodDays
        } days (${cutoffDate.toISOString()})`
      );

      const allQueueJobs = await this.queueService.getAllJobs();
      let totalRemoved = 0;

      for (const { queue: queueName, jobs } of allQueueJobs) {
        let queueRemoved = 0;

        for (const job of jobs) {
          const jobDate = new Date(job.timestamp);

          if (jobDate < cutoffDate) {
            try {
              await this.queueService.cancelJob(job.id);

              queueRemoved++;
              totalRemoved++;
            } catch (error) {
              logger.error(
                `        Failed to remove old job ${job.id} from queue ${queueName}: ${
                  error instanceof Error ? error.message : String(error)
                }        `
              );
            }
          }
        }

        if (queueRemoved > 0) {
          logger.info(`Removed ${queueRemoved} old jobs from queue "${queueName}"`);
        }
      }

      logger.info(
        `Job cleanup completed. Removed ${totalRemoved} jobs older than ${config.jobs.retentionPeriodDays} days`
      );
    } catch (error) {
      logger.error(
        `Error during job cleanup: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  // Manual trigger for testing or immediate cleanup
  public async runCleanupNow(): Promise<void> {
    await this.cleanupOldJobs();
  }
}
