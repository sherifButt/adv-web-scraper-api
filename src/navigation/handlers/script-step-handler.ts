import { Page } from 'playwright';
import { NavigationStep, NavigationContext, StepResult } from '../types/navigation.types.js';
import { logger } from '../../utils/logger.js';
import { BaseStepHandler } from './base-step-handler.js';

export class ScriptStepHandler extends BaseStepHandler {
  public canHandle(step: NavigationStep): boolean {
    return step.type === 'executeScript';
  }

  public async execute(
    step: NavigationStep,
    context: NavigationContext,
    page: Page
  ): Promise<StepResult> {
    const script = this.resolveValue(step.script, context);
    const timeout = step.timeout || 30000;

    if (!script || typeof script !== 'string') {
      throw new Error('ExecuteScript step requires a valid script string.');
    }

    logger.info(`Executing script: ${script.substring(0, 50)}...`);

    try {
      // Consider adding a timeout for the script execution itself if needed
      await page.evaluate(script);
    } catch (error) {
      logger.warn(`Script execution failed: ${error}`);
      // Decide if script errors should halt the flow or just be logged
      // throw error; // Uncomment to halt on script error
    }

    if (step.waitFor) await this.handleWaitFor(step.waitFor, timeout);
    return {};
  }
}
