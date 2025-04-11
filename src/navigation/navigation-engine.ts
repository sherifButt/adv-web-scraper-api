// src/navigation/navigation-engine.ts

import { Page, BrowserContext } from 'playwright';
import { logger } from '../utils/logger.js';
import { BehaviorEmulator } from '../core/human/behavior-emulator.js';
import { CaptchaSolver } from '../core/captcha/captcha-solver.js';
import { SessionManager } from '../core/session/session-manager.js';
import { StepHandlerFactory } from './handlers/step-handler-factory.js';
import { NavigationStep, NavigationOptions, NavigationResult } from '../types/index.js'; // Combined imports
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
        await this.executeStep(step, i); // Pass index for screenshot naming
        stepsExecuted++;

        // Post-step actions
        await this.checkAndSolveCaptcha();
        await this.behaviorEmulator.think(); // Simulate thinking time
      }

      // --- Flow Completion ---
      return this.formatResult('completed', startUrl, stepsExecuted);
    } catch (error) {
      // --- Error Handling ---
      logger.error('Error executing navigation flow:', error);
      return this.formatResult('failed', startUrl, stepsExecuted, error);
    }
  }

  /**
   * Executes a single navigation step using the appropriate handler.
   */
  private async executeStep(step: NavigationStep, stepIndex: number): Promise<void> {
    await this.takeScreenshot(`before_${step.type}`, stepIndex);

    try {
      // Get the appropriate handler from the factory based on step type
      const handler = this.handlerFactory.getHandler(step.type);
      // Execute the step using the handler
      await handler.execute(step, this.context, this.page);
    } catch (error) {
      logger.error(`Error executing step type ${step.type}:`, error);
      // Re-throw the error to be caught by the main executeFlow catch block
      throw error;
    }

    await this.takeScreenshot(`after_${step.type}`, stepIndex);
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
    try {
      await this.page.goto(url, { waitUntil: 'networkidle', timeout });
    } catch (error) {
      logger.warn(`'networkidle' wait failed for ${url}, trying 'load'`);
      await this.page.goto(url, { waitUntil: 'load', timeout });
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
   * Saves the current browser session after successfully solving a CAPTCHA.
   */
  private async saveSessionAfterCaptchaSolve(): Promise<void> {
    if (!this.browserContext) return;
    try {
      const domain = new URL(this.page.url()).hostname;
      await this.sessionManager.saveSession(this.browserContext, { domain });
      logger.info(`Saved session after solving CAPTCHA for domain: ${domain}`);
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
      // Prepend domain to screenshot paths
      screenshots: this.screenshotsTaken.map(p => `${config.server.host}/${p}`),
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
