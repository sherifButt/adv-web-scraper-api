import { Page } from 'playwright'; // Removed PageGotoOptions import
import { NavigationStep, NavigationContext, StepResult } from '../types/navigation.types.js';
import { IStepHandler } from '../types/step-handler.interface.js';
import { logger } from '../../utils/logger.js';
import { BaseStepHandler } from './base-step-handler.js';

/**
 * Handles the 'goto' navigation step for navigating to a URL.
 */
export class GotoStepHandler extends BaseStepHandler implements IStepHandler {
  // Add constructor to accept page and pass to BaseStepHandler
  constructor(page: Page) {
    super(page);
  }

  /**
   * Determines if this handler can execute the given step.
   * @param step The navigation step to evaluate.
   * @returns True if the step type is 'goto', false otherwise.
   */
  canHandle(step: NavigationStep): boolean {
    // Correctly handle 'goto' type
    return step.type === 'goto';
  }

  /**
   * Executes the goto logic: navigates the page to a specified URL.
   * @param step - The NavigationStep configuration object, expected to have 'value' (URL).
   * @param context - The current navigation context.
   * @param page - The Playwright Page object (passed for consistency, but uses this.page).
   * @returns A Promise resolving to an empty StepResult.
   */
  async execute(
    step: NavigationStep,
    context: NavigationContext,
    page: Page // Keep page param for interface consistency, but use this.page internally
  ): Promise<StepResult> {
    const url = step.value;
    // Map step.waitFor to Playwright's WaitUntilState type
    const waitUntilState = (
      step.waitFor === 'networkidle'
        ? 'networkidle'
        : step.waitFor === 'domcontentloaded'
        ? 'domcontentloaded'
        : step.waitFor === 'commit'
        ? 'commit'
        : 'load'
    ) as 'load' | 'domcontentloaded' | 'networkidle' | 'commit'; // Default to 'load'

    const timeout = step.timeout || 30000; // Default timeout

    if (typeof url !== 'string' || !url) {
      throw new Error("Step type 'goto' requires a non-empty string 'value' for the URL.");
    }

    const resolvedUrl = this.resolveValue(url, context) as string;
    const stepDescription = step.description || `Navigate to ${resolvedUrl}`;
    logger.info(`Executing step: ${stepDescription}`);

    try {
      // Define options object directly
      const gotoOptions = {
        timeout: timeout,
        waitUntil: waitUntilState,
      };

      logger.debug(`Navigating to ${resolvedUrl} with options: ${JSON.stringify(gotoOptions)}`);

      // Use the base class's page reference (this.page)
      await this.page.goto(resolvedUrl, gotoOptions);

      logger.info(`Successfully navigated to ${resolvedUrl}`);
      return {}; // Indicate success, no jump needed
    } catch (error: any) {
      const errorMessage = `Error during goto step "${stepDescription}": ${error.message}`;
      logger.error(errorMessage);
      if (!step.optional) {
        throw new Error(errorMessage); // Re-throw if mandatory
      } else {
        logger.warn(`Optional goto step failed, continuing flow.`);
        context[`${step.name || 'lastGotoError'}`] = errorMessage;
        return {}; // Continue flow
      }
    }
  }
}
