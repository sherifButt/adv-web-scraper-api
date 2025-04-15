import { Page, ElementHandle } from 'playwright'; // Import ElementHandle
import { NavigationStep, StepResult, NavigationContext } from '../types/navigation.types.js'; // Import StepResult and NavigationContext
import { logger } from '../../utils/logger.js';
import { IStepHandler } from '../types/step-handler.interface.js';
import { BehaviorEmulator } from '../../core/human/behavior-emulator.js';
import { BaseStepHandler } from './base-step-handler.js'; // Import BaseStepHandler

// Extend BaseStepHandler
export class ClickStepHandler extends BaseStepHandler implements IStepHandler {
  // Inherits page and constructor from BaseStepHandler
  private behaviorEmulator: BehaviorEmulator;

  // Override constructor to initialize behaviorEmulator
  constructor(page: Page) {
    super(page); // Call BaseStepHandler constructor
    this.behaviorEmulator = new BehaviorEmulator(page);
  }

  public canHandle(step: NavigationStep): boolean {
    return step.type === 'click';
  }

  // Use NavigationContext for type safety
  public async execute(step: NavigationStep, context: NavigationContext): Promise<StepResult> {
    const selector = this.resolveValue(step.selector, context) as string;
    if (!selector) {
      throw new Error('ClickStep requires a valid selector.');
    }
    logger.info(`Clicking element: ${selector}`);

    const currentItemHandle = context.currentItemHandle as ElementHandle | undefined;
    let elementToClick: ElementHandle | null = null;

    try {
      if (currentItemHandle) {
        // Scope the search within the current loop item
        logger.debug(`Searching for selector "${selector}" within current element handle.`);
        elementToClick = await currentItemHandle.waitForSelector(selector, {
          state: 'visible',
          timeout: step.timeout || 30000,
        });
      } else {
        // Fallback to page-level search
        logger.debug(`Searching for selector "${selector}" on the page.`);
        elementToClick = await this.page.waitForSelector(selector, {
          state: 'visible',
          timeout: step.timeout || 30000,
        });
      }
    } catch (error: any) {
      logger.error(`Element "${selector}" not found or not visible: ${error.message}`);
      // If optional, log and continue, otherwise rethrow
      if (step.optional) {
        logger.warn(`Optional click on "${selector}" skipped as element was not found or visible.`);
        return {};
      } else {
        throw error; // Rethrow if not optional
      }
    }

    if (!elementToClick) {
      // This case should ideally be caught by waitForSelector, but handle defensively
      const errorMsg = `Element "${selector}" could not be found or interacted with.`;
      if (step.optional) {
        logger.warn(`Optional click on "${selector}" skipped. ${errorMsg}`);
        return {};
      } else {
        throw new Error(errorMsg);
      }
    }

    // Now elementToClick is guaranteed to be non-null if we reach here

    if (step.triggerType === 'keyboard') {
      logger.info(`Triggering spacebar keyboard click on element: ${selector}`);
      await elementToClick.focus();
      await this.page.keyboard.down('Space');
      await this.page.waitForTimeout(100); // Brief pause for reliability
      await this.page.keyboard.up('Space');
    } else {
      // Use Playwright's built-in click on the specific ElementHandle
      // It handles visibility, actionability checks, and scrolling internally.
      logger.debug(
        `Performing Playwright click on the resolved element handle for selector: ${selector}`
      );
      await elementToClick.click({ timeout: step.timeout || 30000 });
    }

    // Use inherited handleWaitFor
    if (step.waitFor) await this.handleWaitFor(step.waitFor, step.timeout);

    return {}; // Return empty StepResult
  }

  // handleWaitFor is inherited from BaseStepHandler
  // resolveValue is inherited from BaseStepHandler
}
