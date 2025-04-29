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

    const clickMethod = step.clickMethod || 'single'; // Default to single click
    const clickTimeout = step.timeout || 30000;

    if (clickMethod === 'keyboard') {
      logger.info(`Triggering keyboard (Spacebar) click on element: ${selector}`);
      await elementToClick.focus(); // Removed timeout argument
      await this.page.keyboard.down('Space');
      // Add humanLike randomization to the pause
      let keyPause = 100;
      if (step.humanLike) {
        keyPause = Math.floor(keyPause * (0.8 + Math.random() * 0.4));
        logger.debug(`Using human-like key press pause: ${keyPause}ms`);
      }
      await this.page.waitForTimeout(keyPause); // Brief pause for reliability
      await this.page.keyboard.up('Space');
    } else if (clickMethod === 'double') {
      logger.info(`Performing double click on element: ${selector}`);
      // Construct options for dblclick (similar subset as click)
      const dblClickOptions: Parameters<typeof elementToClick.dblclick>[0] = {
        timeout: clickTimeout,
        button: step.button, // 'left', 'right', 'middle'
        modifiers: step.modifiers, // ['Alt', 'Control', 'Meta', 'Shift']
        position: step.position, // { x, y }
        force: step.force, // boolean
      };
      // Remove undefined properties to avoid passing them to Playwright
      Object.keys(dblClickOptions).forEach(
        key =>
          dblClickOptions[key as keyof typeof dblClickOptions] === undefined &&
          delete dblClickOptions[key as keyof typeof dblClickOptions]
      );
      await elementToClick.dblclick(dblClickOptions);
    } else {
      // Default to single click ('single' or unspecified)
      logger.info(
        `Performing ${step.button || 'left'} ${clickMethod} click on element: ${selector}`
      );
      // Construct options object for Playwright's click
      const clickOptions: Parameters<typeof elementToClick.click>[0] = {
        timeout: clickTimeout,
        button: step.button, // 'left', 'right', 'middle'
        modifiers: step.modifiers, // ['Alt', 'Control', 'Meta', 'Shift']
        position: step.position, // { x, y }
        force: step.force, // boolean
        // clickCount: 1, // Default for single click, no need to specify unless > 1
      };
      // Remove undefined properties to avoid passing them to Playwright
      Object.keys(clickOptions).forEach(
        key =>
          clickOptions[key as keyof typeof clickOptions] === undefined &&
          delete clickOptions[key as keyof typeof clickOptions]
      );

      logger.debug(`Performing Playwright click with options: ${JSON.stringify(clickOptions)}`);
      await elementToClick.click(clickOptions);
    }

    // Use inherited handleWaitFor
    if (step.waitFor) await this.handleWaitFor(step.waitFor, step.timeout);

    return {}; // Return empty StepResult
  }

  // handleWaitFor is inherited from BaseStepHandler
  // resolveValue is inherited from BaseStepHandler
}
