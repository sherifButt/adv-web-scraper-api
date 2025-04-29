import { Job } from 'bullmq';
import { logger } from '../../utils/logger.js';
import { BrowserPool, BrowserOptions } from '../browser/browser-pool.js';
import { NavigationEngine } from '../../navigation/navigation-engine.js';
import { StorageService } from '../../storage/index.js';
import { config } from '../../config/index.js';
import { BrowserContext, Page } from 'playwright';

// Define the shape of the progress callback function
type ProgressCallback = (progress: number, status: string) => Promise<void>;

export async function processNavigationJob(job: Job) {
  const { startUrl, steps, variables, options, browserOptions: jobBrowserOptions } = job.data;
  const totalSteps = steps?.length ?? 0;

  // Helper function to update job progress
  const updateProgress: ProgressCallback = async (percentage, status) => {
    try {
      await job.updateProgress({ percentage: Math.min(100, Math.max(0, percentage)), status });
      logger.info(`Job ${job.id} progress: ${status} (${percentage}%)`);
    } catch (err) {
      logger.warn(`Job ${job.id}: Failed to update progress - ${err instanceof Error ? err.message : String(err)}`);
    }
  };

  await updateProgress(0, 'Initializing');
  logger.info(`Starting navigation job ${job.id} for URL: ${startUrl}`);

  const browserOptions: BrowserOptions = {
    ...(jobBrowserOptions || {}),
    headless: options?.headless !== false,
  };

  let browser: any = null;
  let context: BrowserContext | null = null;
  let page: Page | null = null;

  try {
    await updateProgress(10, 'Acquiring Browser');
    browser = await BrowserPool.getInstance().getBrowser(browserOptions);

    await updateProgress(15, 'Creating Context and Page');
    context = await BrowserPool.getInstance().createContext(browser, browserOptions);
    page = await context.newPage();

    if (!page) {
        throw new Error('Failed to create page');
    }

    await updateProgress(20, 'Starting Navigation');
    const engine = new NavigationEngine(page, options);

    const result = await engine.executeFlow(startUrl, steps, variables, updateProgress);

    await updateProgress(90, 'Processing Results');
    logger.debug(`Navigation result for job ${job.id}:`, JSON.stringify(result, null, 2));
    logger.debug(`Storing navigation results for job ${job.id}`);
    if (!job.id) {
      logger.error('Job ID is missing, cannot store results.');
    } else {
      await updateProgress(95, 'Storing Results');
      try {
        await StorageService.getInstance().store({
          ...result,
          id: job.id,
          queueName: job.queueName,
          timestamp: new Date().toISOString(),
        });
        logger.debug(`Successfully stored results for job ${job.id} from queue ${job.queueName}`);
      } catch (storageError) {
        logger.error(
          `Failed to store results for job ${job.id}: ${
            storageError instanceof Error ? storageError.message : String(storageError)
          }`
        );
        await updateProgress(98, 'Storage Failed');
      }
    }
    await page.close();
    page = null;
    await context.close();
    context = null;

    await updateProgress(100, 'Completed');
    logger.info(`Completed navigation job ${job.id} successfully`);
    return result;
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    let lastProgressPercentage = 50;
    if (typeof job.progress === 'object' && job.progress !== null && typeof (job.progress as any).percentage === 'number') {
       lastProgressPercentage = (job.progress as any).percentage;
    }
    await updateProgress(lastProgressPercentage, `Error: ${errorMsg.substring(0, 100)}`);
    logger.error(`Failed navigation job ${job.id}: ${errorMsg}`);

    if (page) {
        try { await page.close(); page = null; } catch (closeError) {
            logger.warn(`Job ${job.id}: Error closing page during error handling: ${closeError}`);
        }
    }
    if (context) { 
        try { await context.close(); context = null; } catch (closeError) {
            logger.warn(`Job ${job.id}: Error closing context during error handling: ${closeError}`);
        }
    }
    throw error;
  } finally {
    if (browser) {
        logger.debug(`Browser instance for job ${job.id} will be managed by pool.`);
    }
  }
}
