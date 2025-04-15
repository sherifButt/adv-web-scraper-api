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

  // Use NavigationContext for type safety
  protected resolveValue(value: any, context: NavigationContext): any {
    if (value === undefined || value === null) return value;
    if (typeof value === 'function') return value(context); // Functions can access full context

    if (typeof value === 'string' && value.includes('{{')) {
      // First, specifically replace {{currentIndex}} if present
      let resolvedValue = value;
      if (context.currentIndex !== undefined) {
        resolvedValue = resolvedValue
          .replace(/\{\{currentIndex\}\}/g, String(context.currentIndex))
          .replace(/\{\{index\}\}/g, String(context.currentIndex)); // Also handle {{index}} for compatibility
      }

      // Then, handle nested property access like {{prop.subprop}}
      // This regex handles paths possibly containing resolved array indices now
      return resolvedValue.replace(/\{\{([^}]+)\}\}/g, (_, key) => {
        const keys = key.trim().split('.');
        let result: any = context;
        for (const k of keys) {
          if (result === undefined || result === null) return ''; // Stop if path becomes invalid

          // Check if k is a number (potentially an array index)
          const index = parseInt(k, 10);
          if (!isNaN(index) && Array.isArray(result)) {
            result = result[index]; // Access array element
          } else if (typeof result === 'object' && result !== null) {
            // Check result is object and not null
            result = result[k]; // Access object property
          } else {
            return ''; // Cannot access property/index on non-object/array or null
          }
        }
        return result !== undefined && result !== null ? String(result) : '';
      });
    }
    return value;
  }
}
