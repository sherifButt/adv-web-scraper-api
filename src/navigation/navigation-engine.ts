// src/navigation/navigation-engine.ts

import { Page, BrowserContext } from 'playwright';
import { logger } from '../utils/logger.js';
import { BehaviorEmulator } from '../core/human/behavior-emulator.js';
import { CaptchaSolver } from '../core/captcha/captcha-solver.js';
import { SessionManager } from '../core/session/session-manager.js';
import { StepHandlerFactory } from './handlers/step-handler-factory.js';
import {
  NavigationStep,
  NavigationOptions,
  NavigationResult,
  StepResult, // Import StepResult
} from '../types/index.js'; // Combined imports
import { NavigationContext } from './types/navigation.types.js'; // Import from specific file
import { config } from '../config/index.js';
import * as fs from 'fs';
import * as path from 'path';

/**
 * Engine for executing multi-step navigation flows using a handler-based approach.
 */
export class NavigationEngine {
  private page: Page;
  private browserContext?: BrowserContext;
  private behaviorEmulator: BehaviorEmulator;
  private captchaSolver: CaptchaSolver;
  private sessionManager: SessionManager;
  private context: NavigationContext = {};
  private options: NavigationOptions;
  private screenshotsPath = './screenshots';
  private screenshotsTaken: string[] = [];
  private handlerFactory: StepHandlerFactory;

  constructor(page: Page, options: NavigationOptions = {}) {
    this.page = page;
    this.options = options;
    this.browserContext = page.context();
    // BehaviorEmulator might still be needed for top-level actions like 'think'
    this.behaviorEmulator = new BehaviorEmulator(
      page,
      typeof options.humanEmulation === 'boolean' ? undefined : options.humanEmulation
    );
    this.captchaSolver = new CaptchaSolver(page);
    this.sessionManager = SessionManager.getInstance();
    // Initialize the factory which holds all step handlers
    this.handlerFactory = new StepHandlerFactory(page);

    if (options.screenshots) {
      this.screenshotsPath = options.screenshotsPath || './screenshots';
      if (!fs.existsSync(this.screenshotsPath)) {
        fs.mkdirSync(this.screenshotsPath, { recursive: true });
      }
    }
  }

  // Cookie domains that should always be persisted
  private static PERSISTENT_COOKIE_DOMAINS = [
    '.google.com',
    '.google.co.uk',
    '.accounts.google.com',
  ];

  // Last session save timestamp for debouncing
  private lastSessionSaveTime = 0;
  // Session version counter
  private sessionVersion = 0;

  /**
   * Executes a navigation flow defined by a series of steps.
   * @param startUrl The initial URL to navigate to.
   * @param steps An array of NavigationStep objects defining the flow.
   * @param initialContext Optional initial context data.
   * @returns A Promise resolving to a NavigationResult object.
   */
  public async executeFlow(
    startUrl: string,
    steps: NavigationStep[],
    initialContext: NavigationContext = {}
  ): Promise<NavigationResult> {
    const startTime = Date.now();
    let stepsExecuted = 0;

    try {
      this.context = { ...initialContext };

      // --- Session Handling ---
      let sessionApplied = false;
      if (
        this.options.useSession !== false &&
        config.browser.session?.enabled &&
        this.browserContext
      ) {
        sessionApplied = await this.applySessionIfExists(startUrl);
        if (sessionApplied) {
          this.sessionVersion = 1; // Initial version after applying session
        }
      }

      // --- Initial Navigation ---
      logger.info(`Navigating to start URL: ${startUrl}`);
      await this.gotoInitialUrl(startUrl);

      // --- Initial CAPTCHA Check ---
      if (!sessionApplied || this.options.alwaysCheckCaptcha) {
        await this.checkAndSolveCaptcha();
      }

      // --- Step Execution Loop ---
      for (let i = 0; i < steps.length; i++) {
        const step = steps[i];

        // Check execution limits
        if (this.options.maxSteps && stepsExecuted >= this.options.maxSteps) {
          logger.warn(`Reached maximum steps limit (${this.options.maxSteps})`);
          break;
        }
        if (this.options.maxTime && Date.now() - startTime > this.options.maxTime) {
          logger.warn(`Reached maximum time limit (${this.options.maxTime}ms)`);
          break;
        }

        logger.info(`Executing step ${i + 1}: ${step.type}`);
        // Execute step and get potential result (including jump index)
        const stepResult = await this.executeStep(step, i);
        stepsExecuted++;

        // Handle gotoStep jump
        if (stepResult?.gotoStepIndex !== undefined && stepResult.gotoStepIndex >= -1) {
          // Allow -1 to restart
          logger.info(`Jumping to step index ${stepResult.gotoStepIndex + 1}`);
          i = stepResult.gotoStepIndex; // Set loop counter to the step BEFORE the target
          continue; // Skip post-step actions for the gotoStep itself
        }

        // Post-step actions (only if not jumping)
        await this.checkAndSolveCaptcha();
        await this.behaviorEmulator.think(); // Simulate thinking time
      }

      // --- Flow Completion ---
      // Update session with any new cookies if session is enabled
      if (
        this.options.useSession !== false &&
        config.browser.session?.enabled &&
        this.browserContext
      ) {
        const currentUrl = this.page.url();
        const domain = new URL(currentUrl).hostname;

        // Only save if it's been at least 5 seconds since last save
        const now = Date.now();
        if (now - this.lastSessionSaveTime > 5000) {
          try {
            await this.saveSessionWithSafeguards(domain);
            this.lastSessionSaveTime = now;
            this.sessionVersion++;
            logger.info(`Updated session v${this.sessionVersion} for domain: ${domain}`);
          } catch (error) {
            logger.error(`Failed to save session: ${error}`);
          }
        }
      }

      return this.formatResult('completed', startUrl, stepsExecuted);
    } catch (error) {
      // --- Error Handling ---
      logger.error('Error executing navigation flow:', error);
      return this.formatResult('failed', startUrl, stepsExecuted, error);
    }
  }

  /**
   * Executes a single navigation step using the appropriate handler.
   * Returns StepResult which might contain a gotoStepIndex.
   */
  private async executeStep(step: NavigationStep, stepIndex: number): Promise<StepResult | void> {
    await this.takeScreenshot(`before_${step.type}`, stepIndex);
    let stepResult: StepResult | void;

    try {
      // Get the appropriate handler from the factory based on step type
      const handler = this.handlerFactory.getHandler(step.type);
      // Execute the step using the handler - potentially returns StepResult
      // We need to cast the result type here as the interface expects void
      stepResult = (await handler.execute(step, this.context, this.page)) as StepResult | void;
    } catch (error) {
      logger.error(`Error executing step type ${step.type}:`, error);
      // Re-throw the error to be caught by the main executeFlow catch block
      throw error;
    }

    await this.takeScreenshot(`after_${step.type}`, stepIndex);
    return stepResult; // Return the result (could be void or StepResult)
  }

  /**
   * Attempts to apply a saved session for the given URL's domain.
   */
  private async applySessionIfExists(url: string): Promise<boolean> {
    if (!this.browserContext) return false;
    try {
      const session = await this.sessionManager.getSession(url);
      if (session) {
        logger.info(`Found existing session for domain: ${session.domain}`);
        await this.sessionManager.applySession(this.browserContext, session);
        logger.info('Applied existing session before navigation');
        return true;
      }
    } catch (error) {
      logger.warn(`Error applying session: ${error}`);
    }
    return false;
  }

  /**
   * Navigates to the initial URL, trying 'networkidle' first.
   */
  private async gotoInitialUrl(url: string): Promise<void> {
    const timeout = this.options.timeout || 30000;

    // Set language and location preferences before navigation
    await this.page.setExtraHTTPHeaders({
      'Accept-Language': 'en-GB,en-US;q=0.9,en;q=0.8',
    });

    await this.page.context().addInitScript(() => {
      Object.defineProperty(navigator, 'language', {
        get: function () {
          return 'en-GB';
        },
      });
      Object.defineProperty(navigator, 'languages', {
        get: function () {
          return ['en-GB', 'en-US', 'en'];
        },
      });
    });

    try {
      await this.page.goto(url, {
        waitUntil: 'networkidle',
        timeout,
        referer: 'https://www.google.com/',
      });
    } catch (error) {
      logger.warn(`'networkidle' wait failed for ${url}, trying 'load'`);
      await this.page.goto(url, {
        waitUntil: 'load',
        timeout,
        referer: 'https://www.google.com/',
      });
    }
  }

  /**
   * Checks for and attempts to solve CAPTCHAs if configured.
   */
  private async checkAndSolveCaptcha(): Promise<void> {
    if (!this.options.solveCaptcha || !this.browserContext) return;

    logger.info('Checking for CAPTCHAs');
    const result = await this.captchaSolver.solve({
      useExternalService: true, // Consider making this configurable
      timeout: 60000, // Consider making this configurable
      useSession: this.options.useSession !== false && config.browser.session?.enabled,
      context: this.browserContext,
    });

    if (result.success) {
      logger.info(`CAPTCHA solved successfully (method: ${result.method})`);
      // Save session if a CAPTCHA was actively solved (not reused)
      if (
        result.method !== 'session_reuse' &&
        result.method !== 'none_required' &&
        this.options.useSession !== false &&
        config.browser.session?.enabled
      ) {
        await this.saveSessionAfterCaptchaSolve();
      }
    } else if (result.error) {
      logger.warn(`CAPTCHA solving failed: ${result.error}`);
      // Potentially throw an error here if CAPTCHA solving is critical
      // throw new Error(`CAPTCHA solving failed: ${result.error}`);
    }
  }

  /**
   * Saves the current browser session with safeguards.
   */
  private async saveSessionWithSafeguards(domain: string): Promise<void> {
    if (!this.browserContext) return;

    // Filter cookies to only persist important ones
    const cookies = await this.browserContext.cookies();
    const filteredCookies = cookies.filter(cookie =>
      NavigationEngine.PERSISTENT_COOKIE_DOMAINS.some(d => cookie.domain.endsWith(d))
    );

    if (filteredCookies.length === 0) {
      logger.debug('No persistent cookies found - skipping session save');
      return;
    }

    await this.sessionManager.saveSession(this.browserContext, {
      domain,
      version: this.sessionVersion + 1,
      cookies: filteredCookies,
    });
  }

  /**
   * Saves the current browser session after successfully solving a CAPTCHA.
   */
  private async saveSessionAfterCaptchaSolve(): Promise<void> {
    if (!this.browserContext) return;
    try {
      const domain = new URL(this.page.url()).hostname;
      await this.saveSessionWithSafeguards(domain);
      this.sessionVersion++;
      logger.info(
        `Saved session v${this.sessionVersion} after solving CAPTCHA for domain: ${domain}`
      );
    } catch (error) {
      logger.warn(`Failed to save session after solving CAPTCHA: ${error}`);
    }
  }

  /**
   * Takes a screenshot if screenshotting is enabled.
   */
  private async takeScreenshot(stepInfo: string, stepIndex: number): Promise<string | null> {
    if (!this.options.screenshots) return null;

    try {
      const timestamp = Date.now();
      const filename = `${stepIndex}_${stepInfo}_${timestamp}.png`;
      const filepath = path.join(this.screenshotsPath, filename);

      await this.page.screenshot({ path: filepath, fullPage: true });
      logger.info(`Screenshot taken: ${filepath}`);
      // Store relative path for API response
      const relativePath = path.relative(process.cwd(), filepath);
      this.screenshotsTaken.push(relativePath);
      return relativePath;
    } catch (error) {
      logger.error('Error taking screenshot:', error);
      return null;
    }
  }

  /**
   * Formats the final result object.
   */
  private formatResult(
    status: 'completed' | 'failed',
    startUrl: string,
    stepsExecuted: number,
    error?: any
  ): NavigationResult {
    const result: NavigationResult = {
      id: `nav_${Date.now()}`,
      startUrl,
      status,
      stepsExecuted,
      result: this.context, // Include the final context
      // Prepend domain to screenshot paths (use just the base domain)
      screenshots: this.screenshotsTaken.map(p => `${p}`),
      timestamp: new Date().toISOString(),
    };
    if (error) {
      result.error = error instanceof Error ? error.message : String(error);
    }
    return result;
  }

  // Removed executeGotoStep, executeClickStep, executeInputStep, executeSelectStep,
  // executeWaitStep, executeExtractStep, executeConditionStep, executePaginateStep,
  // executeScrollStep, executeMouseMoveStep, executeHoverStep, executeScriptStep
  // Removed handleWaitFor, resolveValue (now in BaseStepHandler)
}
