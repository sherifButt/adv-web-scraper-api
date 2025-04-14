import { Page } from 'playwright';
import {
  GotoStep,
  StepResult,
  NavigationStep,
  NavigationContext,
} from '../types/navigation.types.js';
import { IStepHandler } from '../types/step-handler.interface.js';
import { logger } from '../../utils/logger.js'; // Corrected import name

/**
 * Handles the 'gotoStep' navigation step.
 * This handler instructs the NavigationEngine to jump to a specific step index.
 */
export class GotoStepHandler implements IStepHandler {
  // private logger = new Logger(GotoStepHandler.name); // Logger instance created directly from imported logger

  /**
   * Determines if this handler can execute the given step.
   * @param step The navigation step to evaluate.
   * @returns True if the step type is 'gotoStep', false otherwise.
   */
  canHandle(step: NavigationStep): boolean {
    return step.type === 'gotoStep';
  }

  /**
   * Executes the gotoStep logic.
   * Note: The return type deviates from IStepHandler (Promise<void>) to pass the
   * target index back to the engine. The engine needs modification to handle this.
   * @param step - The GotoStep configuration object.
   * @param context - The current navigation context (not directly used).
   * @param page - The Playwright Page object (not directly used).
   * @returns A Promise resolving to a StepResult containing the target step index.
   */
  async execute(
    step: NavigationStep, // Use base type first
    context: NavigationContext, // Use correct context type
    page: Page // Match interface order
  ): Promise<StepResult> {
    // Return StepResult for engine
    // Type assertion inside the method
    const gotoStep = step as GotoStep;

    if (typeof gotoStep.step !== 'number' || gotoStep.step <= 0) {
      // Step index should be 1-based
      logger.error(`Invalid target step index: ${gotoStep.step}`);
      throw new Error(
        `Invalid target step index specified in gotoStep: ${gotoStep.step}. Must be 1 or greater.`
      );
    }
    logger.info(`Executing gotoStep: Jumping to step index ${gotoStep.step}`);
    // Return the target step index (0-based) for the engine to handle
    // Subtract 1 because the engine loop increments before executing
    return { gotoStepIndex: gotoStep.step - 1 };
  }
}
