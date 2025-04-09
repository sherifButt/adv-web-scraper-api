import { Page } from 'playwright';
import { NavigationStep } from '../types/navigation.types.js';
import { logger } from '../../utils/logger.js';
import { IStepHandler } from '../types/step-handler.interface.js';

export class GotoStepHandler implements IStepHandler {
  private page: Page;

  constructor(page: Page) {
    this.page = page;
  }

  public canHandle(step: NavigationStep): boolean {
    return step.type === 'goto';
  }

  public async execute(step: NavigationStep, context: Record<string, any>): Promise<void> {
    const url = this.resolveValue(step.value, context);
    logger.info(`Navigating to: ${url}`);
    await this.page.goto(url, {
      waitUntil: step.waitFor ? 'networkidle' : 'load',
      timeout: step.timeout || 30000,
    });
    if (step.waitFor) await this.handleWaitFor(step.waitFor, step.timeout);
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
