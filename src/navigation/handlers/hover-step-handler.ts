import { Page } from 'playwright';
import { NavigationStep, NavigationContext, StepResult } from '../types/navigation.types.js';
import { logger } from '../../utils/logger.js';
import { BaseStepHandler } from './base-step-handler.js';
import { MouseStepHandler } from './mouse-step-handler.js'; // Hover uses mouse move logic

export class HoverStepHandler extends BaseStepHandler {
  private mouseHandler: MouseStepHandler; // Delegate to MouseStepHandler

  constructor(page: Page) {
    super(page);
    // Hover needs mouse movement capabilities
    this.mouseHandler = new MouseStepHandler(page);
  }

  public canHandle(step: NavigationStep): boolean {
    return step.type === 'hover';
  }

  public async execute(
    step: NavigationStep,
    context: NavigationContext,
    page: Page
  ): Promise<StepResult> {
    const selector = this.resolveValue(step.selector, context);
    // Default hover duration is 1000ms, split for move and pause
    const duration =
      typeof step.duration === 'number' ? this.resolveValue(step.duration, context) : 1000;
    const timeout = step.timeout || 30000;

    if (!selector) {
      throw new Error('Hover step requires a selector.');
    }

    logger.info(`Hovering over element: ${selector}`);
    await page.waitForSelector(selector, { state: 'visible', timeout });

    // Use the MouseStepHandler's execute method to perform the move
    // Create a temporary 'mousemove' step for delegation
    const mouseMoveStep: NavigationStep = {
      ...step, // Copy relevant properties like selector, humanLike etc.
      type: 'mousemove', // Change type to delegate
      action: 'move', // Ensure it's just a move
      duration: duration / 2, // Move mouse over half the duration
      // Ensure waitFor is not carried over to the delegated move step
      waitFor: undefined,
    };

    // Execute the mouse move part using the MouseStepHandler
    await this.mouseHandler.execute(mouseMoveStep, context, page);

    // Wait for the remaining duration to simulate the hover pause
    await page.waitForTimeout(duration / 2);

    // Handle original step's waitFor after the hover action is complete
    if (step.waitFor) await this.handleWaitFor(step.waitFor, timeout);
    return {};
  }
}
