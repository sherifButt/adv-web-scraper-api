import { Page } from 'playwright';
import { NavigationStep, StepResult } from '../types/navigation.types.js'; // Import StepResult
import { logger } from '../../utils/logger.js';
// Remove IStepHandler import, import BaseStepHandler
// import { IStepHandler } from '../types/step-handler.interface.js';
import { BaseStepHandler } from './base-step-handler.js';

// Extend BaseStepHandler
export class WaitStepHandler extends BaseStepHandler {
  // Remove private page property, inherited from BaseStepHandler
  // private page: Page;

  // Update constructor to call super
  constructor(page: Page) {
    super(page);
    // this.page = page;
  }

  public canHandle(step: NavigationStep): boolean {
    return step.type === 'wait';
  }

  public async execute(step: NavigationStep, context: Record<string, any>): Promise<StepResult> {
    // Change return type
    if (typeof step.value === 'number') {
      let waitTime = step.value;
      if (step.humanLike) {
        // Randomize between 80% and 120% of the original value
        waitTime = Math.floor(step.value * (0.8 + Math.random() * 0.4));
        logger.info(`Waiting with human-like randomization: around ${step.value}ms, actual: ${waitTime}ms`);
      } else {
        logger.info(`Waiting for ${waitTime}ms`);
      }
      // Use this.page from BaseStepHandler
      await this.page.waitForTimeout(waitTime);
    } else if (typeof step.value === 'string') {
      // Use inherited resolveValue
      const selector = this.resolveValue(step.value, context);
      logger.info(`Waiting for element: ${selector}`);
      // Use this.page from BaseStepHandler
      await this.page.waitForSelector(selector, {
        state: 'visible',
        timeout: step.timeout || 30000,
      });
    } else if (step.waitFor) {
      // Use inherited handleWaitFor
      await this.handleWaitFor(step.waitFor, step.timeout);
    } else {
      logger.info('Waiting for network idle');
      // Use this.page from BaseStepHandler
      await this.page.waitForLoadState('networkidle', {
        timeout: step.timeout || 30000,
      });
    }

    return {}; // Return empty StepResult
  }

  // Remove private handleWaitFor, inherited from BaseStepHandler
  /*
  private async handleWaitFor(waitFor: string | number | any, timeout?: number): Promise<void> {
    const actualTimeout = timeout || 30000;
    if (typeof waitFor === 'number') {
      await this.page.waitForTimeout(waitFor);
    } else if (typeof waitFor === 'string') {
      await this.page.waitForSelector(waitFor, {
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
  */

  // Remove private resolveValue, inherited from BaseStepHandler
  /*
  private resolveValue(value: any, context: Record<string, any>): any {
    if (value === undefined || value === null) return value;
    if (typeof value === 'function') return value(context);
    if (typeof value === 'string' && value.includes('{{')) {
      return value.replace(/\{\{([^}]+)\}\}/g, (_, key) => {
        const keys = key.trim().split('.');
        let result = context;
        for (const k of keys) {
          if (result === undefined || result === null) return '';
          result = result[k];
        }
        return result !== undefined && result !== null ? String(result) : '';
      });
    }
    return value;
  }
  */
}
