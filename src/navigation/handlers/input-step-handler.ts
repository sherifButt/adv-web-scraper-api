import { Page } from 'playwright';
import { NavigationStep, StepResult } from '../types/navigation.types.js'; // Import StepResult
import { logger } from '../../utils/logger.js';
import { IStepHandler } from '../types/step-handler.interface.js';
import { BehaviorEmulator } from '../../core/human/behavior-emulator.js';

export class InputStepHandler implements IStepHandler {
  private page: Page;
  private behaviorEmulator: BehaviorEmulator;

  constructor(page: Page) {
    this.page = page;
    this.behaviorEmulator = new BehaviorEmulator(page);
  }

  public canHandle(step: NavigationStep): boolean {
    return step.type === 'input';
  }

  public async execute(step: NavigationStep, context: Record<string, any>): Promise<StepResult> {
    const value = this.resolveValue(step.value, context);
    
    if (step.useFocusedElement) {
        logger.info(`Typing into focused element.`);
        if (!value) {
            logger.warn('No value provided for typing into focused element.');
            return {};
        }
        // Assuming BehaviorEmulator.typeText can handle typing into the currently focused element
        // If not, we might need to use this.page.keyboard.type directly.
        await this.behaviorEmulator.typeText(value, {
            mistakes: step.humanInput === undefined ? true : step.humanInput, // Default to human-like if humanInput is not specified
            variableSpeed: step.humanInput === undefined ? true : step.humanInput,
          });
    } else if (step.selector) {
        const selector = this.resolveValue(step.selector, context);
        logger.info(`Entering text into: ${selector}`);
        await this.page.waitForSelector(selector, {
          state: 'visible',
          timeout: step.timeout || 30000,
        });
        if (step.clearInput) {
            // Use fill to clear, then click/type for human emulation if requested
            await this.page.fill(selector, ''); 
        }
        if (step.humanInput) {
          await this.behaviorEmulator.clickElement(selector);
          await this.behaviorEmulator.typeText(value, {
            mistakes: true,
            variableSpeed: true,
          });
        } else {
          await this.page.fill(selector, value); // Use fill for direct input if not humanInput
        }
    } else {
        logger.error('Input step requires either a selector or useFocusedElement to be true.');
        throw new Error('Input step must have a selector or useFocusedElement set to true.');
    }

    if (step.waitFor) await this.handleWaitFor(step.waitFor, step.timeout);

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
