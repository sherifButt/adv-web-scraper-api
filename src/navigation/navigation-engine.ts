import { Page } from 'playwright';
import { logger } from '../utils/logger.js';
import { BehaviorEmulator } from '../core/human/behavior-emulator.js';
import { CaptchaSolver } from '../core/captcha/captcha-solver.js';
import { ProxyManager } from '../core/proxy/proxy-manager.js';
import { NavigationStep, NavigationOptions, NavigationResult } from '../types/index.js';
import * as fs from 'fs';
import * as path from 'path';

/**
 * Context for navigation operations
 */
export interface NavigationContext {
  [key: string]: any;
}

/**
 * Engine for executing multi-step navigation flows
 */
export class NavigationEngine {
  private page: Page;
  private behaviorEmulator: BehaviorEmulator;
  private captchaSolver: CaptchaSolver;
  private context: NavigationContext = {};
  private options: NavigationOptions;
  private screenshotsPath = './screenshots';
  private screenshotsTaken: string[] = [];

  /**
   * Create a new NavigationEngine
   */
  constructor(page: Page, options: NavigationOptions = {}) {
    this.page = page;
    this.options = options;
    this.behaviorEmulator = new BehaviorEmulator(
      page,
      typeof options.humanEmulation === 'boolean' ? undefined : options.humanEmulation
    );
    this.captchaSolver = new CaptchaSolver(page);

    // Set up screenshots path
    if (options.screenshots) {
      this.screenshotsPath = options.screenshotsPath || './screenshots';

      // Create screenshots directory if it doesn't exist
      if (!fs.existsSync(this.screenshotsPath)) {
        fs.mkdirSync(this.screenshotsPath, { recursive: true });
      }
    }
  }

  /**
   * Execute a navigation flow
   */
  public async executeFlow(
    startUrl: string,
    steps: NavigationStep[],
    initialContext: NavigationContext = {}
  ): Promise<NavigationResult> {
    const startTime = Date.now();
    let stepsExecuted = 0;

    try {
      // Initialize context
      this.context = { ...initialContext };

      // Navigate to start URL
      logger.info(`Navigating to start URL: ${startUrl}`);
      await this.page.goto(startUrl, {
        waitUntil: 'networkidle',
        timeout: this.options.timeout || 30000,
      });

      // Check for CAPTCHA on the initial page
      await this.checkAndSolveCaptcha();

      // Execute each step
      for (let i = 0; i < steps.length; i++) {
        const step = steps[i];

        // Check if we've reached the maximum steps
        if (this.options.maxSteps && stepsExecuted >= this.options.maxSteps) {
          logger.warn(`Reached maximum steps limit (${this.options.maxSteps})`);
          break;
        }

        // Check if we've reached the maximum time
        if (this.options.maxTime && Date.now() - startTime > this.options.maxTime) {
          logger.warn(`Reached maximum time limit (${this.options.maxTime}ms)`);
          break;
        }

        // Execute the step
        logger.info(`Executing step ${i + 1}: ${step.type}`);
        await this.executeStep(step);
        stepsExecuted++;

        // Check for CAPTCHA after each step
        await this.checkAndSolveCaptcha();

        // Add a small delay between steps to appear more human-like
        await this.behaviorEmulator.think();
      }

      // Return the result
      return {
        id: `nav_${Date.now()}`,
        startUrl,
        status: 'completed',
        stepsExecuted,
        result: this.context,
        screenshots: this.screenshotsTaken,
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      logger.error('Error executing navigation flow:', error);

      return {
        id: `nav_${Date.now()}`,
        startUrl,
        status: 'failed',
        stepsExecuted,
        error: error instanceof Error ? error.message : String(error),
        screenshots: this.screenshotsTaken,
        timestamp: new Date().toISOString(),
      };
    }
  }

  /**
   * Take a screenshot of the current page state
   */
  private async takeScreenshot(stepType: string, stepIndex = 0): Promise<string | null> {
    if (!this.options.screenshots) {
      return null;
    }

    try {
      const timestamp = Date.now();
      const filename = `${stepIndex}_${stepType}_${timestamp}.png`;
      const filepath = path.join(this.screenshotsPath, filename);

      await this.page.screenshot({ path: filepath, fullPage: true });
      logger.info(`Screenshot taken: ${filepath}`);

      this.screenshotsTaken.push(filepath);
      return filepath;
    } catch (error) {
      logger.error('Error taking screenshot:', error);
      return null;
    }
  }

  /**
   * Execute a single navigation step
   */
  private async executeStep(step: NavigationStep, stepIndex = 0): Promise<void> {
    // Take a screenshot before executing the step
    await this.takeScreenshot(`before_${step.type}`, stepIndex);

    switch (step.type) {
      case 'goto':
        await this.executeGotoStep(step);
        break;
      case 'click':
        await this.executeClickStep(step);
        break;
      case 'input':
        await this.executeInputStep(step);
        break;
      case 'select':
        await this.executeSelectStep(step);
        break;
      case 'wait':
        await this.executeWaitStep(step);
        break;
      case 'extract':
        await this.executeExtractStep(step);
        break;
      case 'condition':
        await this.executeConditionStep(step);
        break;
      case 'paginate':
        await this.executePaginateStep(step);
        break;
      default:
        throw new Error(`Unknown step type: ${step.type}`);
    }

    // Take a screenshot after executing the step
    await this.takeScreenshot(`after_${step.type}`, stepIndex);
  }

  /**
   * Execute a goto step
   */
  private async executeGotoStep(step: NavigationStep): Promise<void> {
    const url = this.resolveValue(step.value);

    logger.info(`Navigating to: ${url}`);

    await this.page.goto(url, {
      waitUntil: step.waitFor ? 'networkidle' : 'load',
      timeout: step.timeout || this.options.timeout || 30000,
    });

    if (step.waitFor) {
      await this.handleWaitFor(step.waitFor, step.timeout);
    }
  }

  /**
   * Execute a click step
   */
  private async executeClickStep(step: NavigationStep): Promise<void> {
    const selector = this.resolveValue(step.selector);

    logger.info(`Clicking element: ${selector}`);

    // Wait for the element to be visible
    await this.page.waitForSelector(selector, {
      state: 'visible',
      timeout: step.timeout || this.options.timeout || 30000,
    });

    // Use the behavior emulator to click like a human
    await this.behaviorEmulator.clickElement(selector);

    // Wait for navigation or specific element if specified
    if (step.waitFor) {
      await this.handleWaitFor(step.waitFor, step.timeout);
    }
  }

  /**
   * Execute an input step
   */
  private async executeInputStep(step: NavigationStep): Promise<void> {
    const selector = this.resolveValue(step.selector);
    const value = this.resolveValue(step.value);

    logger.info(`Entering text into: ${selector}`);

    // Wait for the element to be visible
    await this.page.waitForSelector(selector, {
      state: 'visible',
      timeout: step.timeout || this.options.timeout || 30000,
    });

    // Clear the input field if needed
    if (step.clearInput) {
      await this.page.fill(selector, '');
    }

    // Use the behavior emulator to type like a human
    if (step.humanInput) {
      await this.behaviorEmulator.clickElement(selector);
      await this.behaviorEmulator.typeText(value, {
        mistakes: true,
        variableSpeed: true,
      });
    } else {
      // Use the standard Playwright method for faster input
      await this.page.fill(selector, value);
    }

    // Wait for specific element if specified
    if (step.waitFor) {
      await this.handleWaitFor(step.waitFor, step.timeout);
    }
  }

  /**
   * Execute a select step
   */
  private async executeSelectStep(step: NavigationStep): Promise<void> {
    const selector = this.resolveValue(step.selector);
    const value = this.resolveValue(step.value);

    logger.info(`Selecting option in: ${selector}`);

    // Wait for the element to be visible
    await this.page.waitForSelector(selector, {
      state: 'visible',
      timeout: step.timeout || this.options.timeout || 30000,
    });

    // Select the option
    await this.page.selectOption(selector, value);

    // Wait for specific element if specified
    if (step.waitFor) {
      await this.handleWaitFor(step.waitFor, step.timeout);
    }
  }

  /**
   * Execute a wait step
   */
  private async executeWaitStep(step: NavigationStep): Promise<void> {
    if (typeof step.value === 'number') {
      // Wait for a specific amount of time
      logger.info(`Waiting for ${step.value}ms`);
      await this.page.waitForTimeout(step.value);
    } else if (typeof step.value === 'string') {
      // Wait for a specific selector
      const selector = this.resolveValue(step.value);
      logger.info(`Waiting for element: ${selector}`);
      await this.page.waitForSelector(selector, {
        state: 'visible',
        timeout: step.timeout || this.options.timeout || 30000,
      });
    } else if (step.waitFor) {
      // Use the waitFor property
      await this.handleWaitFor(step.waitFor, step.timeout);
    } else {
      // Default to waiting for network idle
      logger.info('Waiting for network idle');
      await this.page.waitForLoadState('networkidle', {
        timeout: step.timeout || this.options.timeout || 30000,
      });
    }
  }

  /**
   * Execute an extract step
   */
  private async executeExtractStep(step: NavigationStep): Promise<void> {
    const selector = this.resolveValue(step.selector);
    const name = step.name || 'extractedData';

    logger.info(`Extracting data from: ${selector}`);

    if (step.type === 'extract' && step.fields) {
      // Extract multiple fields
      const result: Record<string, any> = {};

      for (const [fieldName, fieldDef] of Object.entries(step.fields)) {
        try {
          if (typeof fieldDef === 'object' && 'selector' in fieldDef && 'type' in fieldDef) {
            const fieldSelector = `${selector} ${fieldDef.selector}`;

            if (fieldDef.type === 'css') {
              if (fieldDef.multiple) {
                // Extract multiple items with nested fields
                if (typeof fieldDef === 'object' && 'fields' in fieldDef) {
                  result[fieldName] = await this.page.$$eval(
                    fieldSelector,
                    (elements: Element[], fields: Record<string, any>) => {
                      return elements.map(el => {
                        const item: Record<string, string | null> = {};
                        for (const [subFieldName, subFieldDef] of Object.entries(fields)) {
                          if (typeof subFieldDef === 'object' && 'selector' in subFieldDef) {
                            const subEl = el.querySelector(subFieldDef.selector);
                            item[subFieldName] = subEl
                              ? 'attribute' in subFieldDef
                                ? subEl.getAttribute(subFieldDef.attribute as string) || ''
                                : subEl.textContent?.trim() || ''
                              : null;
                          }
                        }
                        return item;
                      });
                    },
                    fieldDef.fields
                  );
                } else {
                  // Simple multiple items case
                  const attr =
                    fieldDef.type === 'css' && 'attribute' in fieldDef ? fieldDef.attribute : null;
                  result[fieldName] = await this.page.$$eval(
                    fieldSelector,
                    (elements, attr) => {
                      return elements.map(el => {
                        if (attr) {
                          return el.getAttribute(attr) || '';
                        } else {
                          return el.textContent?.trim() || '';
                        }
                      });
                    },
                    attr
                  );
                }
              } else {
                // Extract single item
                if (fieldDef.type === 'css' && 'attribute' in fieldDef) {
                  result[fieldName] = await this.page.$eval(
                    fieldSelector,
                    (el, attr) => el.getAttribute(attr),
                    fieldDef.attribute || ''
                  );
                } else {
                  result[fieldName] = await this.page.$eval(
                    fieldSelector,
                    el => el.textContent?.trim() || ''
                  );
                }
              }
            } else {
              // For non-CSS selectors, use the extraction engine
              logger.warn(
                `Non-CSS selector type ${fieldDef.type} not fully supported in navigation engine`
              );
              result[fieldName] = null;
            }
          } else {
            // Nested extraction config
            logger.warn('Nested extraction not fully supported in navigation engine');
            result[fieldName] = null;
          }
        } catch (error) {
          logger.warn(`Failed to extract field ${fieldName}:`, error);
          result[fieldName] = null;
        }
      }

      this.context[name] = result;
    } else if (step.type === 'extract' && step.list) {
      // Extract a list of items
      try {
        const items = await this.page.$$eval(selector, elements => {
          return elements.map(el => el.textContent?.trim() || '');
        });

        this.context[name] = items;
      } catch (error) {
        logger.warn(`Failed to extract list:`, error);
        this.context[name] = [];
      }
    } else if (step.source === 'html') {
      // Extract HTML content
      try {
        const value = await this.page.$eval(selector, el => el.innerHTML);

        this.context[name] = value;
      } catch (error) {
        logger.warn(`Failed to extract HTML:`, error);
        this.context[name] = null;
      }
    } else {
      // Extract a single text value
      try {
        const value = await this.page.$eval(selector, el => el.textContent?.trim() || '');

        this.context[name] = value;
      } catch (error) {
        logger.warn(`Failed to extract value:`, error);
        this.context[name] = null;
      }
    }
  }

  /**
   * Execute a condition step
   */
  private async executeConditionStep(step: NavigationStep): Promise<void> {
    const condition = step.condition;

    if (!condition) {
      throw new Error('Condition step requires a condition');
    }

    // Evaluate the condition
    let result = false;

    if (typeof condition === 'string') {
      // Check if an element exists
      try {
        const selector = this.resolveValue(condition);
        const element = await this.page.$(selector);
        result = !!element;
      } catch (error) {
        result = false;
      }
    } else if (typeof condition === 'function') {
      // Evaluate a function
      try {
        // Cast condition to a function type to avoid the "not callable" error
        const conditionFn = condition as (context: any, page: Page) => Promise<boolean>;
        result = await conditionFn(this.context, this.page);
      } catch (error) {
        result = false;
      }
    }

    logger.info(`Condition evaluated to: ${result}`);

    // Store the result in the step for later reference
    step.result = result;

    // Execute the appropriate branch
    if (result && step.thenSteps) {
      logger.info('Executing then branch');
      for (let i = 0; i < step.thenSteps.length; i++) {
        await this.executeStep(step.thenSteps[i], i);
      }
    } else if (!result && step.elseSteps) {
      logger.info('Executing else branch');
      for (let i = 0; i < step.elseSteps.length; i++) {
        await this.executeStep(step.elseSteps[i], i);
      }
    }
  }

  /**
   * Execute a paginate step
   */
  private async executePaginateStep(step: NavigationStep): Promise<void> {
    const selector = this.resolveValue(step.selector);
    const maxPages = step.maxPages || 1;

    logger.info(`Paginating with selector: ${selector}, max pages: ${maxPages}`);

    // Extract data from the current page if extraction steps are provided
    if (step.extractSteps) {
      for (let i = 0; i < step.extractSteps.length; i++) {
        await this.executeStep(step.extractSteps[i], i);
      }
    }

    // Paginate through the pages
    for (let page = 1; page < maxPages; page++) {
      // Check if the next page button exists and is enabled
      const buttonExists = await this.page.$(selector);
      if (!buttonExists) {
        logger.info('No more pagination buttons found');
        break;
      }

      // Check if the button is disabled
      const isDisabled = await this.page
        .$eval(selector, el => el.hasAttribute('disabled') || el.classList.contains('disabled'))
        .catch(() => false);

      if (isDisabled) {
        logger.info('Pagination button is disabled');
        break;
      }

      // Click the next page button
      logger.info(`Navigating to page ${page + 1}`);
      await this.behaviorEmulator.clickElement(selector);

      // Wait for the page to load
      if (step.waitFor) {
        await this.handleWaitFor(step.waitFor, step.timeout);
      } else {
        await this.page.waitForLoadState('networkidle', {
          timeout: step.timeout || this.options.timeout || 30000,
        });
      }

      // Check for CAPTCHA
      await this.checkAndSolveCaptcha();

      // Extract data from the new page if extraction steps are provided
      if (step.extractSteps) {
        for (let i = 0; i < step.extractSteps.length; i++) {
          await this.executeStep(step.extractSteps[i], i);
        }
      }

      // Add a small delay between pages to appear more human-like
      await this.behaviorEmulator.think();
    }
  }

  /**
   * Handle waiting for a specific condition
   */
  private async handleWaitFor(waitFor: string | number | any, timeout?: number): Promise<void> {
    const actualTimeout = timeout || this.options.timeout || 30000;

    if (typeof waitFor === 'number') {
      // Wait for a specific amount of time
      await this.page.waitForTimeout(waitFor);
    } else if (typeof waitFor === 'string') {
      // Wait for a specific selector
      const selector = this.resolveValue(waitFor);
      await this.page.waitForSelector(selector, {
        state: 'visible',
        timeout: actualTimeout,
      });
    } else if (waitFor === 'navigation') {
      // Wait for navigation to complete
      await this.page.waitForNavigation({
        waitUntil: 'load',
        timeout: actualTimeout,
      });
    } else if (waitFor === 'networkidle') {
      // Wait for network to be idle
      await this.page.waitForLoadState('networkidle', {
        timeout: actualTimeout,
      });
    }
  }

  /**
   * Check for and solve any CAPTCHAs on the page
   */
  private async checkAndSolveCaptcha(): Promise<void> {
    if (this.options.solveCaptcha) {
      logger.info('Checking for CAPTCHAs');

      const result = await this.captchaSolver.solve({
        useExternalService: true,
        timeout: 60000,
      });

      if (result.success) {
        logger.info('CAPTCHA solved successfully');
      } else if (result.error) {
        logger.warn(`CAPTCHA solving failed: ${result.error}`);
      }
    }
  }

  /**
   * Resolve a value that might contain template variables
   */
  private resolveValue(value: any): any {
    if (value === undefined || value === null) {
      return value;
    }

    if (typeof value === 'function') {
      return value(this.context);
    }

    if (typeof value === 'string' && value.includes('{{')) {
      // Replace template variables
      return value.replace(/\{\{([^}]+)\}\}/g, (_, key) => {
        const keys = key.trim().split('.');
        let result = this.context;

        for (const k of keys) {
          if (result === undefined || result === null) {
            return '';
          }
          result = result[k];
        }

        return result !== undefined && result !== null ? String(result) : '';
      });
    }

    return value;
  }
}
