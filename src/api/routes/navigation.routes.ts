import { Router } from 'express';
import { asyncHandler } from '../middleware/error.middleware.js';
import { BrowserPool } from '../../core/browser/browser-pool.js';
import { ProxyManager } from '../../core/proxy/proxy-manager.js';
import { QueueService } from '../../core/queue/queue-service.js';
import { NavigationEngine } from '../../navigation/navigation-engine.js';
import { SessionManager } from '../../core/session/session-manager.js';
import { StorageService } from '../../storage/index.js';
import { logger } from '../../utils/logger.js';
import { NavigationRequest, NavigationResult } from '../../types/index.js';
import { config } from '../../config/index.js';
import { validateNavigateRequest } from '../validators/navigation.validator.js';
import { BrowserOptions } from '../../core/browser/browser-pool.js';

const router = Router();
const browserPool = BrowserPool.getInstance();
const proxyManager = ProxyManager.getInstance();
const queueService = new QueueService();
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
  validateNavigateRequest,
  asyncHandler(async (req, res) => {
    try {
      const { startUrl, steps, variables, browserOptions, options }: NavigationRequest & { browserOptions?: BrowserOptions } = req.body;

      logger.info(`Queueing navigation job for URL: ${startUrl}`);

      const job = await queueService.addJob('navigation-jobs', 'execute-flow', {
        startUrl,
        steps,
        variables: variables || {},
        browserOptions,
        options,
      });

      return res.status(202).json({
        success: true,
        message: 'Navigation job queued successfully',
        jobId: job.id,
        statusUrl: `/api/jobs/${job.id}`,
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
          let page; // Declare page variable here

          // Get a browser from the pool with args to prevent leaks
          const launchOptions = {
            headless: options?.javascript !== false,
            args: [
              '--proxy-bypass-list=*', // Force all traffic through proxy
              '--disable-features=WebRtcHideLocalIpsWithMdns,WebRTC', // Disable mDNS and WebRTC entirely
              // '--disable-web-security', // Use with caution if needed for CORS/CSP issues, might be detectable
              // '--ignore-certificate-errors', // Already handled by context option?
            ],
          };
          const browser = await browserPool.getBrowser(launchOptions);

          // Get a proxy if requested
          let proxy = null;
          if (options?.proxy) {
            proxy = await proxyManager.getProxy(
              typeof options.proxy === 'object' ? options.proxy : {}
            );
          }

          // Create browser context with proxy and security settings
          const contextOptions = {
            proxy: proxy
              ? {
                  server: `${proxy.protocols?.[0] || 'http'}://${proxy.ip}:${proxy.port}`,
                  username: proxy.username,
                  password: proxy.password,
                }
              : undefined,
            // Security headers need to be set at page level
            // Add common User-Agent and viewport
            userAgent:
              'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/110.0.0.0 Safari/537.36',
            viewport: { width: 1920, height: 1080 },
            // Explicitly block permissions that could leak IP via WebRTC
            permissions: ['geolocation'], // Block geolocation explicitly
            bypassCSP: true, // May help scripts load correctly
          }; // Correct newline placement

          const context = await browserPool.createContext(browser, contextOptions);

          // Removed context.route() as it didn't resolve the leak
          // Further restrict context permissions after creation if needed
          // await context.grantPermissions([], { origin: startUrl }); // Example: Revoke all permissions for the specific origin

          // Configure additional proxy security
          if (proxy) {
            await context.addInitScript({
              content: `
                // Prevent WebRTC leaks & basic fingerprinting
                Object.defineProperty(navigator, 'webdriver', { get: () => false });
                Object.defineProperty(navigator, 'plugins', { get: () => [] }); // Empty array is often less suspicious
                Object.defineProperty(navigator, 'languages', { get: () => ['en-GB', 'en'] });
                window.navigator.chrome = { runtime: {} }; // Minimal chrome object spoof
                // Removed static connection override as it might be detectable
              `,
            });

            // Set headers at page level after creation
            page = await context.newPage(); // Assign to the outer scope variable
            await page.setExtraHTTPHeaders({
              // Ensure we use the actual proxy IP obtained
              'X-Forwarded-For': proxy.ip,
              'Accept-Language': 'en-GB,en;q=0.9', // Consistent language
              // Add other common headers that might be expected
              'Sec-Fetch-Site': 'none',
              'Sec-Fetch-Mode': 'navigate',
              'Sec-Fetch-User': '?1',
              'Sec-Fetch-Dest': 'document',
              'Sec-Ch-Ua': '"Chromium";v="110", "Not A(Brand";v="24", "Google Chrome";v="110"',
              'Sec-Ch-Ua-Mobile': '?0',
              'Sec-Ch-Ua-Platform': '"Windows"', // Match User-Agent platform
              'Upgrade-Insecure-Requests': '1',
            });
            // No return here, let the flow continue
          } else {
            // Create a page normally if no proxy
            page = await context.newPage();
          }

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
