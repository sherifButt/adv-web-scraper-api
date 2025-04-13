import { Job } from 'bullmq';
import { logger } from '../../utils/logger.js';
import { BrowserPool, BrowserOptions } from '../browser/browser-pool.js';
import { NavigationEngine } from '../../navigation/navigation-engine.js';
import { StorageService } from '../../storage/index.js';
import { ProxyManager } from '../proxy/proxy-manager.js';
import { config } from '../../config/index.js';
import { ProxyInfo } from '../../types/index.js'; // Assuming ProxyInfo is in types

export async function processNavigationJob(job: Job) {
  const { startUrl, steps, variables, options } = job.data;
  logger.info(`Starting navigation job ${job.id} for URL: ${startUrl}`);

  const browserOptions: BrowserOptions = {
    // Changed let to const
    headless: options?.headless !== false,
  };
  // Fetch and configure proxy if enabled
  if (config.proxy.enabled) {
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

  const browser = await BrowserPool.getInstance().getBrowser(browserOptions);
  // Note: Creating context might also need proxy options if not inherited from browser launch
  const page = await browser.newPage(); // Check if newPage inherits proxy, or if it needs to be passed to newContext

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
