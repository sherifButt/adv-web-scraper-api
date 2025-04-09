// src/navigation/navigation-engine.ts

import { Page, BrowserContext } from 'playwright';
import { logger } from '../utils/logger.js';
import { CssSelectorConfig } from '../types/extraction.types.js';
import { BehaviorEmulator } from '../core/human/behavior-emulator.js';
import { CaptchaSolver } from '../core/captcha/captcha-solver.js';
import { SessionManager } from '../core/session/session-manager.js';
import { NavigationStep, NavigationOptions, NavigationResult } from '../types/index.js';
import { config } from '../config/index.js';
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
  private browserContext?: BrowserContext;
  private behaviorEmulator: BehaviorEmulator;
  private captchaSolver: CaptchaSolver;
  private sessionManager: SessionManager;
  private context: NavigationContext = {};
  private options: NavigationOptions;
  private screenshotsPath = './screenshots';
  private screenshotsTaken: string[] = [];

  constructor(page: Page, options: NavigationOptions = {}) {
    this.page = page;
    this.options = options;
    this.browserContext = page.context();
    this.behaviorEmulator = new BehaviorEmulator(
      page,
      typeof options.humanEmulation === 'boolean' ? undefined : options.humanEmulation
    );
    this.captchaSolver = new CaptchaSolver(page);
    this.sessionManager = SessionManager.getInstance();

    if (options.screenshots) {
      this.screenshotsPath = options.screenshotsPath || './screenshots';
      if (!fs.existsSync(this.screenshotsPath)) {
        fs.mkdirSync(this.screenshotsPath, { recursive: true });
      }
    }
  }

  public async executeFlow(
    startUrl: string,
    steps: NavigationStep[],
    initialContext: NavigationContext = {}
  ): Promise<NavigationResult> {
    const startTime = Date.now();
    let stepsExecuted = 0;

    try {
      this.context = { ...initialContext };

      // Check if we have a session for this domain
      let sessionApplied = false;
      if (
        this.options.useSession !== false &&
        config.browser.session?.enabled &&
        this.browserContext
      ) {
        try {
          const session = await this.sessionManager.getSession(startUrl);
          if (session) {
            logger.info(`Found existing session for domain: ${session.domain}`);
            
            // Apply session before navigating
            await this.sessionManager.applySession(this.browserContext, session);
            sessionApplied = true;
            logger.info('Applied existing session before navigation');
          }
        } catch (error) {
          logger.warn(`Error applying session: ${error}`);
          // Continue without session
        }
      }

      logger.info(`Navigating to start URL: ${startUrl}`);
      // Try with networkidle first, fall back to load if it fails
      try {
        await this.page.goto(startUrl, {
          waitUntil: 'networkidle',
          timeout: this.options.timeout || 30000,
        });
      } catch (error) {
        logger.warn('networkidle wait failed, trying with load');
        await this.page.goto(startUrl, {
          waitUntil: 'load',
          timeout: this.options.timeout || 30000,
        });
      }

      // Only check for CAPTCHAs if we didn't apply a session or if the session didn't have solved CAPTCHAs
      if (!sessionApplied || this.options.alwaysCheckCaptcha) {
        await this.checkAndSolveCaptcha();
      }

      for (let i = 0; i < steps.length; i++) {
        const step = steps[i];

        if (this.options.maxSteps && stepsExecuted >= this.options.maxSteps) {
          logger.warn(`Reached maximum steps limit (${this.options.maxSteps})`);
          break;
        }

        if (this.options.maxTime && Date.now() - startTime > this.options.maxTime) {
          logger.warn(`Reached maximum time limit (${this.options.maxTime}ms)`);
          break;
        }

        logger.info(`Executing step ${i + 1}: ${step.type}`);
        await this.executeStep(step);
        stepsExecuted++;
        await this.checkAndSolveCaptcha();
        await this.behaviorEmulator.think();
      }

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

  private async takeScreenshot(stepType: string, stepIndex = 0): Promise<string | null> {
    if (!this.options.screenshots) return null;

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

  private async executeStep(step: NavigationStep, stepIndex = 0): Promise<void> {
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
      case 'scroll':
        await this.executeScrollStep(step);
        break;
      case 'executeScript':
        await this.executeScriptStep(step);
        break;
      case 'mousemove':
        await this.executeMouseMoveStep(step);
        break;
      case 'hover':
        await this.executeHoverStep(step);
        break;
      default:
        throw new Error(`Unknown step type: ${step.type}`);
    }

    await this.takeScreenshot(`after_${step.type}`, stepIndex);
  }

  private async executeGotoStep(step: NavigationStep): Promise<void> {
    const url = this.resolveValue(step.value);
    logger.info(`Navigating to: ${url}`);
    await this.page.goto(url, {
      waitUntil: step.waitFor ? 'networkidle' : 'load',
      timeout: step.timeout || this.options.timeout || 30000,
    });
    if (step.waitFor) await this.handleWaitFor(step.waitFor, step.timeout);
  }

  private async executeClickStep(step: NavigationStep): Promise<void> {
    const selector = this.resolveValue(step.selector);
    logger.info(`Clicking element: ${selector}`);
    await this.page.waitForSelector(selector, {
      state: 'visible',
      timeout: step.timeout || this.options.timeout || 30000,
    });
    await this.behaviorEmulator.clickElement(selector);
    if (step.waitFor) await this.handleWaitFor(step.waitFor, step.timeout);
  }

  private async executeInputStep(step: NavigationStep): Promise<void> {
    const selector = this.resolveValue(step.selector);
    const value = this.resolveValue(step.value);
    logger.info(`Entering text into: ${selector}`);
    await this.page.waitForSelector(selector, {
      state: 'visible',
      timeout: step.timeout || this.options.timeout || 30000,
    });
    if (step.clearInput) await this.page.fill(selector, '');
    if (step.humanInput) {
      await this.behaviorEmulator.clickElement(selector);
      await this.behaviorEmulator.typeText(value, { mistakes: true, variableSpeed: true });
    } else {
      await this.page.fill(selector, value);
    }
    if (step.waitFor) await this.handleWaitFor(step.waitFor, step.timeout);
  }

  private async executeSelectStep(step: NavigationStep): Promise<void> {
    const selector = this.resolveValue(step.selector);
    const value = this.resolveValue(step.value);
    logger.info(`Selecting option in: ${selector}`);
    await this.page.waitForSelector(selector, {
      state: 'visible',
      timeout: step.timeout || this.options.timeout || 30000,
    });
    await this.page.selectOption(selector, value);
    if (step.waitFor) await this.handleWaitFor(step.waitFor, step.timeout);
  }

  private async executeWaitStep(step: NavigationStep): Promise<void> {
    if (typeof step.value === 'number') {
      logger.info(`Waiting for ${step.value}ms`);
      await this.page.waitForTimeout(step.value);
    } else if (typeof step.value === 'string') {
      const selector = this.resolveValue(step.value);
      logger.info(`Waiting for element: ${selector}`);
      await this.page.waitForSelector(selector, {
        state: 'visible',
        timeout: step.timeout || this.options.timeout || 30000,
      });
    } else if (step.waitFor) {
      await this.handleWaitFor(step.waitFor, step.timeout);
    } else {
      logger.info('Waiting for network idle');
      await this.page.waitForLoadState('networkidle', {
        timeout: step.timeout || this.options.timeout || 30000,
      });
    }
  }

  private async executeExtractStep(step: NavigationStep): Promise<void> {
    const selector = this.resolveValue(step.selector);
    const name = step.name || 'extractedData';
    logger.info(`Extracting data from: ${selector}`);

    if (step.type === 'extract' && step.fields) {
      const result: Record<string, any> = {};
      for (const [fieldName, fieldDef] of Object.entries(step.fields)) {
        try {
          if (typeof fieldDef === 'object' && 'selector' in fieldDef && 'type' in fieldDef) {
            const fieldSelector = `${selector} ${fieldDef.selector}`;
            if (fieldDef && fieldDef.type === 'css') {
              const cssConfig = fieldDef as CssSelectorConfig;
              try {
                if (cssConfig.multiple) {
                  if (typeof fieldDef === 'object' && 'fields' in fieldDef) {
                    // Use a Set to track unique property URLs to avoid duplicates
                    const uniqueItems = new Map();
                    
                    const items = await this.page.$$eval(
                      fieldSelector,
                      (elements, fields) => {
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
                    
                    // Filter out duplicates based on propertyUrl or address
                    const filteredItems = items.filter(item => {
                      // Skip empty items
                      if (!item.propertyUrl && !item.address) return false;
                      
                      const key = item.propertyUrl || item.address || JSON.stringify(item);
                      if (!key) return false;
                      
                      // If we've seen this item before, check if the current one has more data
                      if (uniqueItems.has(key)) {
                        const existingItem = uniqueItems.get(key);
                        
                        // Merge the items to get the most complete data
                        for (const [field, value] of Object.entries(item)) {
                          if (value && (!existingItem[field] || existingItem[field] === null)) {
                            existingItem[field] = value;
                          }
                        }
                        
                        uniqueItems.set(key, existingItem);
                        return false;
                      }
                      
                      uniqueItems.set(key, item);
                      return true;
                    });
                    
                    result[fieldName] = filteredItems;
                  } else {
                    const attr = fieldDef && fieldDef.type === 'css' && 'attribute' in fieldDef
                      ? fieldDef.attribute
                      : null;
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
                  // Handle multiple selectors (try each one until one works)
                  if (
                    fieldDef &&
                    fieldDef.type === 'css' &&
                    'selectors' in fieldDef &&
                    Array.isArray(fieldDef.selectors)
                  ) {
                    let value = null;
                    for (const selectorOption of fieldDef.selectors) {
                      const fullSelector = `${selector} ${selectorOption}`;
                      try {
                        if ('attribute' in fieldDef) {
                          value = await this.page.$eval(
                            fullSelector,
                            (el, attr) => el.getAttribute(attr),
                            fieldDef.attribute || ''
                          );
                        } else {
                          value = await this.page.$eval(
                            fullSelector,
                            el => el.textContent?.trim() || ''
                          );
                        }
                        if (value) break; // Stop if we found a value
                      } catch (error) {
                        // Continue to next selector if this one fails
                        logger.debug(`Selector ${fullSelector} failed, trying next option`);
                      }
                    }
                    result[fieldName] = value;
                  } else if (fieldDef && fieldDef.type === 'css' && 'attribute' in fieldDef) {
                    result[fieldName] = await this.page
                      .$eval(
                        fieldSelector,
                        (el, attr) => el.getAttribute(attr),
                        fieldDef.attribute || ''
                      )
                      .catch(() => null);
                  } else {
                    result[fieldName] = await this.page
                      .$eval(fieldSelector, el => el.textContent?.trim() || '')
                      .catch(() => null);
                  }
                }
              } catch (error) {
                logger.warn(`Failed to extract CSS field ${fieldName}:`, error);
                result[fieldName] = null;
              }
            } else {
              logger.warn(`Non-CSS selector type ${fieldDef.type} not fully supported`);
              result[fieldName] = null;
            }
          } else {
            logger.warn('Nested extraction not fully supported');
            result[fieldName] = null;
          }
        } catch (error) {
          logger.warn(`Failed to extract field ${fieldName}:`, error);
          result[fieldName] = null;
        }
      }
      this.context[name] = result;
    } else if (step.type === 'extract' && step.list) {
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
      try {
        const value = await this.page.$eval(selector, el => el.innerHTML);
        this.context[name] = value;
      } catch (error) {
        logger.warn(`Failed to extract HTML:`, error);
        this.context[name] = null;
      }
    } else {
      try {
        const value = await this.page.$eval(selector, el => el.textContent?.trim() || '');
        this.context[name] = value;
      } catch (error) {
        logger.warn(`Failed to extract value:`, error);
        this.context[name] = null;
      }
    }
  }

  private async executeConditionStep(step: NavigationStep): Promise<void> {
    const condition = step.condition;
    if (!condition) throw new Error('Condition step requires a condition');

    let result = false;
    if (typeof condition === 'string') {
      try {
        const selector = this.resolveValue(condition);
        const element = await this.page.$(selector);
        result = !!element;
      } catch (error) {
        result = false;
      }
    } else if (typeof condition === 'function') {
      try {
        const conditionFn = condition as (context: any, page: Page) => Promise<boolean>;
        result = await conditionFn(this.context, this.page);
      } catch (error) {
        result = false;
      }
    }

    logger.info(`Condition evaluated to: ${result}`);
    step.result = result;

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

  private async executeScrollStep(step: NavigationStep): Promise<void> {
    const direction = step.direction || 'down';
    const distance = typeof step.distance === 'number' ? step.distance : 100;
    
    logger.info(`Scrolling ${direction} by ${distance}px`);
    
    if (direction === 'down') {
      await this.page.evaluate((dist) => {
        window.scrollBy(0, dist);
      }, distance);
    } else if (direction === 'up') {
      await this.page.evaluate((dist) => {
        window.scrollBy(0, -dist);
      }, distance);
    } else if (direction === 'left') {
      await this.page.evaluate((dist) => {
        window.scrollBy(-dist, 0);
      }, distance);
    } else if (direction === 'right') {
      await this.page.evaluate((dist) => {
        window.scrollBy(dist, 0);
      }, distance);
    }
    
    if (step.waitFor) await this.handleWaitFor(step.waitFor, step.timeout);
  }

  private async executeMouseMoveStep(step: NavigationStep): Promise<void> {
    const selector = this.resolveValue(step.selector);
    const x = typeof step.x === 'number' ? step.x : undefined;
    const y = typeof step.y === 'number' ? step.y : undefined;
    const duration = typeof step.duration === 'number' ? step.duration : 500;
    const humanLike = step.humanLike !== false;

    logger.info(`Moving mouse to ${selector || `coordinates (${x},${y})`}`);
    
    if (selector) {
      await this.page.waitForSelector(selector, {
        state: 'visible',
        timeout: step.timeout || this.options.timeout || 30000,
      });
      
      if (humanLike) {
        await this.behaviorEmulator.moveMouseToElement(selector, duration);
      } else {
        await this.page.hover(selector);
      }
    } else if (x !== undefined && y !== undefined) {
      if (humanLike) {
        await this.behaviorEmulator.moveMouseToCoordinates(x, y, duration);
      } else {
        await this.page.mouse.move(x, y);
      }
    } else {
      throw new Error('Mouse move step requires either selector or x/y coordinates');
    }

    if (step.waitFor) await this.handleWaitFor(step.waitFor, step.timeout);
  }

  private async executeHoverStep(step: NavigationStep): Promise<void> {
    const selector = this.resolveValue(step.selector);
    const duration = typeof step.duration === 'number' ? step.duration : 1000;
    
    logger.info(`Hovering over element: ${selector}`);
    await this.page.waitForSelector(selector, {
      state: 'visible',
      timeout: step.timeout || this.options.timeout || 30000,
    });
    
    await this.executeMouseMoveStep({
      ...step,
      humanLike: true,
      duration: duration / 2
    });
    
    await this.page.waitForTimeout(duration / 2);
    
    if (step.waitFor) await this.handleWaitFor(step.waitFor, step.timeout);
  }

  private async executeScriptStep(step: NavigationStep): Promise<void> {
    const script = this.resolveValue(step.script);
    logger.info(`Executing script: ${script.substring(0, 50)}...`);
    
    try {
      await this.page.evaluate(script);
    } catch (error) {
      logger.warn(`Script execution failed: ${error}`);
      throw error;
    }
    
    if (step.waitFor) await this.handleWaitFor(step.waitFor, step.timeout);
  }

  private async executePaginateStep(step: NavigationStep): Promise<void> {
    const selector = this.resolveValue(step.selector);
    const maxPages = step.maxPages || 1;
    logger.info(`Paginating with selector: ${selector}, max pages: ${maxPages}`);

    if (step.extractSteps) {
      for (let i = 0; i < step.extractSteps.length; i++) {
        await this.executeStep(step.extractSteps[i], i);
      }
    }

    for (let page = 1; page < maxPages; page++) {
      const buttonExists = await this.page.$(selector);
      if (!buttonExists) {
        logger.info('No more pagination buttons found');
        break;
      }

      const isDisabled = await this.page
        .$eval(selector, el => el.hasAttribute('disabled') || el.classList.contains('disabled'))
        .catch(() => false);

      if (isDisabled) {
        logger.info('Pagination button is disabled');
        break;
      }

      logger.info(`Navigating to page ${page + 1}`);
      await this.behaviorEmulator.clickElement(selector);

      if (step.waitFor) {
        await this.handleWaitFor(step.waitFor, step.timeout);
      } else {
        await this.page.waitForLoadState('networkidle', {
          timeout: step.timeout || this.options.timeout || 30000,
        });
      }

      await this.checkAndSolveCaptcha();

      if (step.extractSteps) {
        for (let i = 0; i < step.extractSteps.length; i++) {
          await this.executeStep(step.extractSteps[i], i);
        }
      }

      await this.behaviorEmulator.think();
    }
  }

  private async handleWaitFor(waitFor: string | number | any, timeout?: number): Promise<void> {
    const actualTimeout = timeout || this.options.timeout || 30000;

    if (typeof waitFor === 'number') {
      await this.page.waitForTimeout(waitFor);
    } else if (typeof waitFor === 'string') {
      const selector = this.resolveValue(waitFor);
      await this.page.waitForSelector(selector, {
        state: 'visible',
        timeout: actualTimeout,
      });
    } else if (waitFor === 'navigation') {
      await this.page.waitForNavigation({
        waitUntil: 'load',
        timeout: actualTimeout,
      });
    } else if (waitFor === 'networkidle') {
      await this.page.waitForLoadState('networkidle', {
        timeout: actualTimeout,
      });
    }
  }

  private async checkAndSolveCaptcha(): Promise<void> {
    if (this.options.solveCaptcha) {
      logger.info('Checking for CAPTCHAs');
      const result = await this.captchaSolver.solve({
        useExternalService: true,
        timeout: 60000,
        useSession: this.options.useSession !== false && config.browser.session?.enabled,
        context: this.browserContext,
      });
      if (result.success) {
        logger.info('CAPTCHA solved successfully');
        
        // If we solved a CAPTCHA and we're using sessions, save the session
        if (
          result.method !== 'session_reuse' &&
          result.method !== 'none_required' &&
          this.options.useSession !== false &&
          config.browser.session?.enabled &&
          this.browserContext
        ) {
          try {
            const domain = new URL(this.page.url()).hostname;
            await this.sessionManager.saveSession(this.browserContext, { domain });
            logger.info(`Saved session after solving CAPTCHA for domain: ${domain}`);
          } catch (error) {
            logger.warn(`Failed to save session after solving CAPTCHA: ${error}`);
          }
        }
      } else if (result.error) {
        logger.warn(`CAPTCHA solving failed: ${result.error}`);
      }
    }
  }

  private resolveValue(value: any): any {
    if (value === undefined || value === null) return value;
    if (typeof value === 'function') return value(this.context);
    if (typeof value === 'string' && value.includes('{{')) {
      return value.replace(/\{\{([^}]+)\}\}/g, (_, key) => {
        const keys = key.trim().split('.');
        let result = this.context;
        for (const k of keys) {
          if (result === undefined || result === null) return '';
          result = result[k];
        }
        return result !== undefined && result !== null ? String(result) : '';
      });
    }
    return value;
  }
}
