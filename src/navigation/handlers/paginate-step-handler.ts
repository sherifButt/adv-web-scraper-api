import { Page } from 'playwright';
import { NavigationStep, NavigationContext } from '../types/navigation.types.js';
import { logger } from '../../utils/logger.js';
import { BaseStepHandler } from './base-step-handler.js';
import { StepHandlerFactory } from './step-handler-factory.js'; // Import factory
import { BehaviorEmulator } from '../../core/human/behavior-emulator.js'; // For clicking

export class PaginateStepHandler extends BaseStepHandler {
  private handlerFactory: StepHandlerFactory;
  private behaviorEmulator: BehaviorEmulator;

  constructor(page: Page, handlerFactory: StepHandlerFactory) {
    super(page);
    this.handlerFactory = handlerFactory;
    this.behaviorEmulator = new BehaviorEmulator(page); // For clicking pagination button
  }

  public canHandle(step: NavigationStep): boolean {
    return step.type === 'paginate';
  }

  public async execute(
    step: NavigationStep,
    context: NavigationContext,
    page: Page
  ): Promise<void> {
    const selector = this.resolveValue(step.selector, context);
    const maxPages = step.maxPages || 1; // Default to 1 page if not specified
    const timeout = step.timeout || 30000;

    if (!selector) {
      throw new Error('Paginate step requires a selector for the next page button.');
    }

    logger.info(`Paginating with selector: ${selector}, max pages: ${maxPages}`);

    // Execute initial extraction steps if provided (for the first page)
    if (step.extractSteps) {
      await this.executeExtractSteps(step.extractSteps, context, page);
    }

    for (let currentPage = 1; currentPage < maxPages; currentPage++) {
      const buttonExists = await page.$(selector);
      if (!buttonExists) {
        logger.info(`Pagination button (${selector}) not found. Stopping pagination.`);
        break;
      }

      // Check if the button is disabled
      const isDisabled = await page
        .$eval(selector, el => el.hasAttribute('disabled') || el.classList.contains('disabled'))
        .catch(() => false); // Assume not disabled if check fails

      if (isDisabled) {
        logger.info(`Pagination button (${selector}) is disabled. Stopping pagination.`);
        break;
      }

      logger.info(`Navigating to page ${currentPage + 1} by clicking: ${selector}`);
      await this.behaviorEmulator.clickElement(selector); // Use behavior emulator for click

      // Wait for navigation/content load
      if (step.waitFor) {
        await this.handleWaitFor(step.waitFor, timeout);
      } else {
        // Default wait if none specified
        await page.waitForLoadState('networkidle', { timeout });
      }

      // Optional: Add a check for CAPTCHA after pagination click if needed
      // await this.checkAndSolveCaptcha(); // Assuming checkAndSolveCaptcha is available/refactored

      // Execute extraction steps for the new page
      if (step.extractSteps) {
        await this.executeExtractSteps(step.extractSteps, context, page);
      }

      // Optional: Add a small delay/think time
      await this.behaviorEmulator.think();
    }
  }

  private async executeExtractSteps(
    extractSteps: NavigationStep[],
    context: NavigationContext,
    page: Page
  ): Promise<void> {
    logger.info(`Executing ${extractSteps.length} extract steps for current page.`);
    for (let i = 0; i < extractSteps.length; i++) {
      const extractStep = extractSteps[i];
      try {
        const handler = this.handlerFactory.getHandler(extractStep.type);
        await handler.execute(extractStep, context, page);
      } catch (error) {
        logger.error(
          `Error executing extract step ${i + 1} (${extractStep.type}) during pagination:`,
          error
        );
        // Decide whether to stop pagination on extraction error
        throw error;
      }
    }
  }

  // Placeholder for potential CAPTCHA check refactoring
  // private async checkAndSolveCaptcha(): Promise<void> { ... }
}
