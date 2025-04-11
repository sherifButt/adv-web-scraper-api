import { Router } from 'express';
import { asyncHandler } from '../middleware/error.middleware.js';
import { BrowserPool } from '../../core/browser/browser-pool.js';
import { ProxyManager } from '../../core/proxy/proxy-manager.js';
import { NavigationEngine } from '../../navigation/navigation-engine.js';
import { SessionManager } from '../../core/session/session-manager.js';
import { StorageService } from '../../storage/index.js';
import { logger } from '../../utils/logger.js';
import { NavigationRequest, NavigationResult } from '../../types/index.js';
import { config } from '../../config/index.js';

const router = Router();
const browserPool = BrowserPool.getInstance();
const proxyManager = ProxyManager.getInstance();
const sessionManager = SessionManager.getInstance();
const storageService = StorageService.getInstance();

// Initialize services
(async () => {
  try {
    await storageService.initialize();
    logger.info('Storage service initialized for navigation routes');

    await sessionManager.initialize();
    logger.info('Session manager initialized for navigation routes');
  } catch (error: any) {
    logger.error(`Error initializing services: ${error.message}`);
  }
})();

/**
 * @route   POST /api/v1/navigate
 * @desc    Execute a multi-step navigation flow
 * @access  Public
 */
router.post(
  '/',
  asyncHandler(async (req, res) => {
    try {
      const { startUrl, steps, variables, options }: NavigationRequest = req.body;

      // Validate request
      if (!startUrl) {
        return res.status(400).json({
          success: false,
          message: 'Start URL is required',
          error: 'Missing required parameter: startUrl',
          timestamp: new Date().toISOString(),
        });
      }

      if (!steps || !Array.isArray(steps) || steps.length === 0) {
        return res.status(400).json({
          success: false,
          message: 'Navigation steps are required',
          error: 'Missing required parameter: steps',
          timestamp: new Date().toISOString(),
        });
      }

      logger.info(`Starting navigation flow for URL: ${startUrl}`);

      // Get a browser from the pool
      const browser = await browserPool.getBrowser({
        headless: options?.javascript !== false, // Use headless unless javascript is explicitly disabled
      });

      // Get a proxy if requested
      let proxy = null;
      if (options?.proxy) {
        proxy = await proxyManager.getProxy(typeof options.proxy === 'object' ? options.proxy : {});
      }

      // Create a browser context with the proxy if available
      const context = await browserPool.createContext(browser, {
        proxy: proxy
          ? {
              server: `${proxy.type}://${proxy.host}:${proxy.port}`,
              username: proxy.username,
              password: proxy.password,
            }
          : undefined,
      });

      // Create a page
      const page = await context.newPage();

      // Create a navigation engine
      const navigationEngine = new NavigationEngine(page, {
        timeout: options?.timeout,
        solveCaptcha: options?.solveCaptcha,
        humanEmulation: options?.humanEmulation,
        maxSteps: options?.maxSteps,
        maxTime: options?.maxTime,
        screenshots: options?.screenshots,
        screenshotsPath: options?.screenshotsPath,
        useSession: options?.useSession !== false && config.browser.session?.enabled,
        alwaysCheckCaptcha: options?.alwaysCheckCaptcha,
      });

      // Execute the navigation flow
      const result = await navigationEngine.executeFlow(startUrl, steps, variables || {});

      // Store the result
      await storageService.store(result as any);

      // Release the browser back to the pool
      browserPool.releaseBrowser(browser);

      // Return the result with full screenshot URLs if they exist
      const responseData = {
        ...result,
        screenshots: result.screenshots?.map(
          screenshot => `http://${config.server.host}/${screenshot}`
        ),
      };

      return res.status(200).json({
        success: true,
        message: 'Navigation flow executed successfully',
        data: responseData,
        timestamp: new Date().toISOString(),
      });
    } catch (error: any) {
      logger.error(`Error in navigation endpoint: ${error.message}`);
      return res.status(500).json({
        success: false,
        message: 'Navigation flow execution failed',
        error: error.message,
        timestamp: new Date().toISOString(),
      });
    }
  })
);

/**
 * @route   GET /api/v1/navigate/:id
 * @desc    Get the result of a navigation job
 * @access  Public
 */
router.get(
  '/:id',
  asyncHandler(async (req, res) => {
    const id = req.params.id;

    // Get the result from storage service
    const result = await storageService.retrieve(id);

    if (!result) {
      return res.status(404).json({
        success: false,
        message: 'Navigation result not found',
        error: `No navigation result found with ID: ${id}`,
        timestamp: new Date().toISOString(),
      });
    }

    // Return the result
    return res.status(200).json({
      success: true,
      message: 'Navigation result retrieved successfully',
      data: result,
      timestamp: new Date().toISOString(),
    });
  })
);

/**
 * @route   POST /api/v1/navigate/crawl
 * @desc    Start a crawling job
 * @access  Public
 */
router.post(
  '/crawl',
  asyncHandler(async (req, res) => {
    try {
      const { startUrl, maxPages, selectors, filters, options } = req.body;

      // Validate request
      if (!startUrl) {
        return res.status(400).json({
          success: false,
          message: 'Start URL is required',
          error: 'Missing required parameter: startUrl',
          timestamp: new Date().toISOString(),
        });
      }

      if (!selectors || Object.keys(selectors).length === 0) {
        return res.status(400).json({
          success: false,
          message: 'Selectors are required',
          error: 'Missing required parameter: selectors',
          timestamp: new Date().toISOString(),
        });
      }

      logger.info(`Starting crawl for URL: ${startUrl}`);

      // Create a unique ID for this crawl
      const crawlId = `crawl_${Date.now()}`;

      // Store the initial crawl status
      const initialResult = {
        id: crawlId,
        url: startUrl,
        status: 'pending' as 'completed' | 'failed' | 'partial',
        stepsExecuted: 0,
        data: {},
        timestamp: new Date().toISOString(),
      };

      await storageService.store(initialResult);

      // Start the crawl process asynchronously
      setTimeout(async () => {
        try {
          // Get a browser from the pool
          const browser = await browserPool.getBrowser({
            headless: options?.javascript !== false,
          });

          // Get a proxy if requested
          let proxy = null;
          if (options?.proxy) {
            proxy = await proxyManager.getProxy(
              typeof options.proxy === 'object' ? options.proxy : {}
            );
          }

          // Create a browser context with the proxy if available
          const context = await browserPool.createContext(browser, {
            proxy: proxy
              ? {
                  server: `${proxy.type}://${proxy.host}:${proxy.port}`,
                  username: proxy.username,
                  password: proxy.password,
                }
              : undefined,
          });

          // Create a page
          const page = await context.newPage();

          // Create a navigation engine
          const navigationEngine = new NavigationEngine(page, {
            timeout: options?.timeout,
            solveCaptcha: options?.solveCaptcha,
            humanEmulation: options?.humanEmulation,
            screenshots: options?.screenshots,
            screenshotsPath: options?.screenshotsPath,
            useSession: options?.useSession !== false && config.browser.session?.enabled,
            alwaysCheckCaptcha: options?.alwaysCheckCaptcha,
          });

          // Update status to processing
          await storageService.update(crawlId, {
            status: 'partial',
          });

          // Create navigation steps for crawling
          const steps = [
            {
              type: 'paginate' as const,
              selector: filters?.nextPageSelector || 'a.next-page',
              maxPages: maxPages || 1,
              extractSteps: [
                {
                  type: 'extract' as const,
                  name: 'crawlData',
                  selector: selectors.itemSelector,
                  fields: selectors.fields,
                },
              ],
              waitFor: filters?.waitForSelector || 'networkidle',
            },
          ];

          // Execute the navigation flow
          const result = await navigationEngine.executeFlow(startUrl, steps);

          // Update the result
          await storageService.update(crawlId, {
            status: 'completed',
            data: result.result,
          });

          // Release the browser back to the pool
          browserPool.releaseBrowser(browser);

          logger.info(`Crawl completed for URL: ${startUrl}`);
        } catch (error: any) {
          logger.error(`Error in crawl process: ${error.message}`);

          // Update the result with error
          await storageService.update(crawlId, {
            status: 'failed',
            error: error.message,
          });
        }
      }, 0);

      // Return the initial response
      return res.status(202).json({
        success: true,
        message: 'Crawling job started',
        data: {
          id: crawlId,
          startUrl,
          maxPages: maxPages || 1,
          status: 'pending',
          timestamp: new Date().toISOString(),
        },
      });
    } catch (error: any) {
      logger.error(`Error starting crawl: ${error.message}`);
      return res.status(500).json({
        success: false,
        message: 'Failed to start crawling job',
        error: error.message,
        timestamp: new Date().toISOString(),
      });
    }
  })
);

/**
 * @route   GET /api/v1/navigate
 * @desc    List navigation results with optional filtering and pagination
 * @access  Public
 */
router.get(
  '/',
  asyncHandler(async (req, res) => {
    // Parse query parameters
    const limit = req.query.limit ? parseInt(req.query.limit as string) : undefined;
    const offset = req.query.offset ? parseInt(req.query.offset as string) : undefined;
    const status = req.query.status as string | undefined;
    const url = req.query.url as string | undefined;
    const fromDate = req.query.fromDate ? new Date(req.query.fromDate as string) : undefined;
    const toDate = req.query.toDate ? new Date(req.query.toDate as string) : undefined;

    // Get results from storage service
    const results = await storageService.list({
      limit,
      offset,
      status,
      url,
      fromDate,
      toDate,
    });

    // Filter to only include navigation results (IDs starting with 'nav_' or 'crawl_')
    const navigationResults = results.filter(
      result => result.id.startsWith('nav_') || result.id.startsWith('crawl_')
    );

    // Return the results
    return res.status(200).json({
      success: true,
      message: 'Navigation results retrieved successfully',
      data: navigationResults,
      count: navigationResults.length,
      timestamp: new Date().toISOString(),
    });
  })
);

export const navigationRoutes = router;
