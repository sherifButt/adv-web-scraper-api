import { NavigationStep, NavigationContext, StepResult } from './navigation.types.js'; // Add StepResult import
import { Page } from 'playwright';

/**
 * Interface for all step handler implementations
 */
export interface IStepHandler {
  /**
   * Determines if this handler can execute the given step
   * @param step The navigation step to evaluate
   */
  canHandle(step: NavigationStep): boolean;

  /**
   * Executes the navigation step
   * @param step The step to execute
   * @param context The current navigation context
   * @param page The Playwright page instance
   * @returns A StepResult, potentially indicating a jump
   */
  execute(step: NavigationStep, context: NavigationContext, page: Page): Promise<StepResult>;
}
