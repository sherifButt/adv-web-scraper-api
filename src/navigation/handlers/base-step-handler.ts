import { Page } from 'playwright';
import { NavigationStep, StepResult } from '../types/navigation.types.js';
import { logger } from '../../utils/logger.js';
import { IStepHandler } from '../types/step-handler.interface.js';
import { NavigationContext } from '../types/navigation.types.js';

export abstract class BaseStepHandler implements IStepHandler {
  protected page: Page;

  constructor(page: Page) {
    this.page = page;
  }

  abstract canHandle(step: NavigationStep): boolean;
  abstract execute(
    step: NavigationStep,
    context: NavigationContext,
    page: Page
  ): Promise<StepResult>;

  protected async handleWaitFor(waitFor: string | number | any, timeout?: number): Promise<void> {
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

  protected resolveValue(value: any, context: Record<string, any>): any {
    if (value === undefined || value === null) return value;
    if (typeof value === 'function') return value(context);
    if (typeof value === 'string' && value.includes('{{')) {
      return value.replace(/\{\{([^}]+)\}\}/g, (_, key) => {
        const keys = key.trim().split('.');
        let result: any = context; // Use 'any' for dynamic property access
        for (const k of keys) {
          if (result === undefined || result === null || typeof result !== 'object') return '';
          result = result[k];
        }
        return result !== undefined && result !== null ? String(result) : '';
      });
    }
    return value;
  }
}
