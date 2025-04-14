import { Page } from 'playwright';
import { NavigationStep, StepResult } from '../types/navigation.types.js'; // Import StepResult
import { logger } from '../../utils/logger.js';
import { IStepHandler } from '../types/step-handler.interface.js';

export class WaitStepHandler implements IStepHandler {
  private page: Page;

  constructor(page: Page) {
    this.page = page;
  }

  public canHandle(step: NavigationStep): boolean {
    return step.type === 'wait';
  }

  public async execute(step: NavigationStep, context: Record<string, any>): Promise<StepResult> {
    // Change return type
    if (typeof step.value === 'number') {
      logger.info(`Waiting for ${step.value}ms`);
      await this.page.waitForTimeout(step.value);
    } else if (typeof step.value === 'string') {
      const selector = this.resolveValue(step.value, context);
      logger.info(`Waiting for element: ${selector}`);
      await this.page.waitForSelector(selector, {
        state: 'visible',
        timeout: step.timeout || 30000,
      });
    } else if (step.waitFor) {
      await this.handleWaitFor(step.waitFor, step.timeout);
    } else {
      logger.info('Waiting for network idle');
      await this.page.waitForLoadState('networkidle', {
        timeout: step.timeout || 30000,
      });
    }

    return {}; // Return empty StepResult
  }

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
}
