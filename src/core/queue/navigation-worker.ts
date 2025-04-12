import { Job } from 'bullmq';
import { logger } from '../../utils/logger.js';
import { BrowserPool } from '../browser/browser-pool.js';
import { NavigationEngine } from '../../navigation/navigation-engine.js';
import { StorageService } from '../../storage/index.js';

export async function processNavigationJob(job: Job) {
  const { startUrl, steps, variables, options } = job.data;
  logger.info(`Starting navigation job ${job.id} for URL: ${startUrl}`);

  const browser = await BrowserPool.getInstance().getBrowser({
    headless: options?.headless !== false,
  });
  const page = await browser.newPage();

  try {
    const engine = new NavigationEngine(page, options);
    const result = await engine.executeFlow(startUrl, steps, variables);
    logger.debug(`Navigation result for job ${job.id}:`, JSON.stringify(result, null, 2)); // Log the result object (stringified)
    logger.debug(`Storing navigation results for job ${job.id}`);
    if (!job.id) {
      logger.error('Job ID is missing, cannot store results.');
    } else {
      try {
        await StorageService.getInstance().store({
          ...result,
          id: job.id, // job.id should be defined here
          timestamp: new Date().toISOString(),
        });
        logger.debug(`Successfully stored results for job ${job.id}`);
      } catch (storageError) {
        logger.error(
          `Failed to store results for job ${job.id}: ${
            storageError instanceof Error ? storageError.message : String(storageError)
          }`
        );
        // Optionally re-throw or handle storage failure
      }
    }
    await page.close();
    logger.info(`Completed navigation job ${job.id} successfully`);
    return result; // Explicitly return the result for job.returnvalue
  } catch (error) {
    await page.close();
    logger.error(
      `Failed navigation job ${job.id}: ${error instanceof Error ? error.message : String(error)}`
    );
    throw error;
  } finally {
    await BrowserPool.getInstance().releaseBrowser(browser);
  }
}
