import { Job } from 'bullmq';
import { logger } from '../../utils/logger.js';
import { BrowserPool, BrowserOptions } from '../browser/browser-pool.js';
import { NavigationEngine } from '../../navigation/navigation-engine.js';
import { StorageService } from '../../storage/index.js';
import { ProxyManager } from '../proxy/proxy-manager.js';
import { config } from '../../config/index.js';
import { ProxyInfo } from '../../types/index.js'; // Assuming ProxyInfo is in types

// Define the shape of the progress callback function
type ProgressCallback = (progress: number, status: string) => Promise<void>;

export async function processNavigationJob(job: Job) {
  const { startUrl, steps, variables, options } = job.data;
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
    // Changed let to const
    headless: options?.headless !== false,
  };
  // Fetch and configure proxy if enabled
  if (config.proxy.enabled) {
    await updateProgress(5, 'Configuring Proxy');
    try {
      const proxyManager = ProxyManager.getInstance();
      // TODO: Add filtering options if needed based on job.data.options
      const proxyInfo: ProxyInfo | null = await proxyManager.getProxy();

      if (proxyInfo && proxyInfo.protocols && proxyInfo.protocols.length > 0) {
        // Added checks
        // Format for Playwright
        // Assuming the first protocol is the one to use
        const protocol = proxyInfo.protocols[0]; // Use the first protocol
        browserOptions.proxy = {
          server: `${protocol}://${proxyInfo.ip}:${proxyInfo.port}`,
          // Add username/password if your ProxyInfo includes them and Playwright supports them for the protocol
          // username: proxyInfo.username,
          // password: proxyInfo.password,
        };
        logger.info(`Using proxy: ${browserOptions.proxy.server} for job ${job.id}`);
      } else {
        logger.warn(
          `Proxy enabled, but no valid proxy (or protocols) found for job ${job.id}. Proceeding without proxy.` // Reformatted + updated message
        );
      }
    } catch (proxyError) {
      logger.error(
        // Reformatted
        `Error getting proxy for job ${job.id}: ${
          proxyError instanceof Error ? proxyError.message : String(proxyError)
        }. Proceeding without proxy.`
      );
    }
  } else {
    logger.info(`Proxy is disabled. Proceeding without proxy for job ${job.id}.`);
  }

  let browser: any = null;
  let page: any = null; // Use 'any' temporarily if Browser type is complex
  try {
    await updateProgress(10, 'Acquiring Browser');
    browser = await BrowserPool.getInstance().getBrowser(browserOptions);

    await updateProgress(15, 'Creating Page');
    page = await browser.newPage(); // Check if newPage inherits proxy, or if it needs to be passed to newContext

    if (!page) {
        throw new Error('Failed to create page');
    }

    await updateProgress(20, 'Starting Navigation');
    const engine = new NavigationEngine(page, options);

    // Execute the flow, passing the progress callback
    const result = await engine.executeFlow(startUrl, steps, variables, updateProgress);

    await updateProgress(90, 'Processing Results');
    logger.debug(`Navigation result for job ${job.id}:`, JSON.stringify(result, null, 2)); // Log the result object (stringified)
    logger.debug(`Storing navigation results for job ${job.id}`);
    if (!job.id) {
      // This check might be redundant now with UUID generation, but kept for safety
      logger.error('Job ID is missing, cannot store results.');
    } else {
      await updateProgress(95, 'Storing Results');
      try {
        // Add queueName to the stored data
        await StorageService.getInstance().store({
          ...result,
          id: job.id, // This will be the UUID
          queueName: job.queueName, // Add the queue name
          timestamp: new Date().toISOString(),
        });
        logger.debug(`Successfully stored results for job ${job.id} from queue ${job.queueName}`);
      } catch (storageError) {
        logger.error(
          `Failed to store results for job ${job.id}: ${
            storageError instanceof Error ? storageError.message : String(storageError)
          }`
        );
        // Optionally re-throw or handle storage failure
        await updateProgress(98, 'Storage Failed');
      }
    }
    await page.close();
    page = null; // Prevent double close in finally
    await updateProgress(100, 'Completed');
    logger.info(`Completed navigation job ${job.id} successfully`);
    return result; // Explicitly return the result for job.returnvalue
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    // Try to update progress one last time with error status
    // Use job.progress which might hold the last successful percentage
    // Add type check for the progress object structure
    let lastProgressPercentage = 50; // Default to 50% if unknown or invalid
    if (typeof job.progress === 'object' && job.progress !== null && typeof (job.progress as any).percentage === 'number') {
       lastProgressPercentage = (job.progress as any).percentage;
    }
    await updateProgress(lastProgressPercentage, `Error: ${errorMsg.substring(0, 100)}`); // Truncate error message
    logger.error(`Failed navigation job ${job.id}: ${errorMsg}`);

    // Close page if it exists and wasn't closed
    if (page) {
        try {
            await page.close();
        } catch (closeError) {
            logger.warn(`Job ${job.id}: Error closing page during error handling: ${closeError}`);
        }
    }
    throw error; // Re-throw the error to mark the job as failed in BullMQ
  } finally {
    // Ensure browser is always released
    if (browser) {
        await BrowserPool.getInstance().releaseBrowser(browser);
    }
  }
}
