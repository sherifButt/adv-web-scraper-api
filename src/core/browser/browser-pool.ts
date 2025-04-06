import { Browser, BrowserContext, chromium, firefox, webkit } from 'playwright';
import { logger } from '../../utils/logger.js';
import { config } from '../../config/index.js';

/**
 * Browser types supported by the pool
 */
export type BrowserType = 'chromium' | 'firefox' | 'webkit';

/**
 * Browser instance with metadata
 */
interface BrowserInstance {
  browser: Browser;
  contexts: BrowserContext[];
  lastUsed: Date;
  isIdle: boolean;
}

/**
 * Options for creating a browser instance
 */
export interface BrowserOptions {
  browserType?: BrowserType;
  headless?: boolean;
  args?: string[];
  proxy?: {
    server: string;
    username?: string;
    password?: string;
  };
  userAgent?: string;
  viewport?: {
    width: number;
    height: number;
  };
}

/**
 * Manages a pool of browser instances
 */
export class BrowserPool {
  private static instance: BrowserPool;
  private browsers: Map<string, BrowserInstance> = new Map();
  private idleCheckInterval: NodeJS.Timeout | null = null;

  private constructor() {
    // Start idle checking
    this.idleCheckInterval = setInterval(() => {
      this.checkIdleBrowsers();
    }, 60000); // Check every minute
  }

  /**
   * Get the singleton instance of BrowserPool
   */
  public static getInstance(): BrowserPool {
    if (!BrowserPool.instance) {
      BrowserPool.instance = new BrowserPool();
    }
    return BrowserPool.instance;
  }

  /**
   * Get a browser instance from the pool or create a new one
   */
  public async getBrowser(options: BrowserOptions = {}): Promise<Browser> {
    const browserType = options.browserType || 'chromium';
    const key = this.getBrowserKey(browserType, options);

    // Check if we have an available browser
    const instance = this.browsers.get(key);
    if (instance && !instance.isIdle) {
      instance.lastUsed = new Date();
      return instance.browser;
    }

    // Create a new browser instance
    const browser = await this.launchBrowser(browserType, options);
    this.browsers.set(key, {
      browser,
      contexts: [],
      lastUsed: new Date(),
      isIdle: false,
    });

    logger.info(`Launched new ${browserType} browser instance`);
    return browser;
  }

  /**
   * Create a new browser context
   */
  public async createContext(
    browser: Browser,
    options: BrowserOptions = {}
  ): Promise<BrowserContext> {
    const instance = this.findBrowserInstance(browser);
    if (!instance) {
      throw new Error('Browser instance not found in pool');
    }

    const contextOptions = {
      viewport: options.viewport || config.browser.defaultOptions.defaultViewport,
      userAgent: options.userAgent,
      proxy: options.proxy,
    };

    const context = await browser.newContext(contextOptions);
    instance.contexts.push(context);
    return context;
  }

  /**
   * Release a browser back to the pool
   */
  public releaseBrowser(browser: Browser): void {
    const instance = this.findBrowserInstance(browser);
    if (instance) {
      instance.isIdle = true;
      instance.lastUsed = new Date();
      logger.debug('Browser released back to pool');
    }
  }

  /**
   * Close all browser instances
   */
  public async closeAll(): Promise<void> {
    if (this.idleCheckInterval) {
      clearInterval(this.idleCheckInterval);
      this.idleCheckInterval = null;
    }

    const closePromises: Promise<void>[] = [];
    for (const instance of this.browsers.values()) {
      closePromises.push(instance.browser.close());
    }

    await Promise.all(closePromises);
    this.browsers.clear();
    logger.info('All browser instances closed');
  }

  /**
   * Check for idle browsers and close them if they've been idle too long
   */
  private checkIdleBrowsers(): void {
    const now = new Date();
    const idleTimeoutMs = config.browser.pool.idleTimeoutMs;

    for (const [key, instance] of this.browsers.entries()) {
      if (instance.isIdle) {
        const idleTime = now.getTime() - instance.lastUsed.getTime();
        if (idleTime > idleTimeoutMs) {
          logger.info(`Closing idle browser instance (idle for ${idleTime}ms)`);
          instance.browser.close().catch(err => {
            logger.error('Error closing idle browser:', err);
          });
          this.browsers.delete(key);
        }
      }
    }
  }

  /**
   * Launch a new browser instance
   */
  private async launchBrowser(type: BrowserType, options: BrowserOptions): Promise<Browser> {
    const launchOptions = {
      headless: options.headless ?? config.browser.defaultOptions.headless,
      args: options.args ?? config.browser.defaultOptions.args,
      proxy: options.proxy,
    };

    switch (type) {
      case 'firefox':
        return firefox.launch(launchOptions);
      case 'webkit':
        return webkit.launch(launchOptions);
      case 'chromium':
      default:
        return chromium.launch(launchOptions);
    }
  }

  /**
   * Find a browser instance in the pool
   */
  private findBrowserInstance(browser: Browser): BrowserInstance | undefined {
    for (const instance of this.browsers.values()) {
      if (instance.browser === browser) {
        return instance;
      }
    }
    return undefined;
  }

  /**
   * Generate a unique key for a browser configuration
   */
  private getBrowserKey(type: BrowserType, options: BrowserOptions): string {
    return `${type}-${options.headless ? 'headless' : 'headed'}-${
      options.proxy ? 'proxy' : 'direct'
    }`;
  }
}
