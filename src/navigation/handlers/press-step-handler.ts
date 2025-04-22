import { Page } from 'playwright';
import { PressStep, NavigationContext, StepResult } from '../types/navigation.types.js';
import { logger } from '../../utils/logger.js';
import { BaseStepHandler } from './base-step-handler.js';

// Define the modifier type locally if not imported, matching Playwright's definition
type KeyboardModifier = 'Alt' | 'Control' | 'Meta' | 'Shift';

export class PressStepHandler extends BaseStepHandler {
  public canHandle(step: PressStep): boolean {
    // Ensure the step object has a 'type' property before checking its value
    return typeof step === 'object' && step !== null && step.type === 'press';
  }

  public async execute(
    step: PressStep,
    context: NavigationContext,
    page: Page
  ): Promise<StepResult> {
    const {
      key,
      modifiers,
      action = 'press', // Default to 'press'
      delay,
      selector,
      description,
      optional = false,
      timeout = 30000, // Default timeout from BaseStepHandler or specific
    } = step;

    const stepDescription = description || `Press key: ${key}`;
    logger.info(`Executing step: ${stepDescription}`);

    if (!key) {
      throw new Error('PressStep requires a "key" property.');
    }

    // Resolve values from context
    const resolvedKey = this.resolveValue(key, context) as string;
    const resolvedModifiers = modifiers
      ? (this.resolveValue(modifiers, context) as KeyboardModifier[])
      : undefined;
    const resolvedDelay = delay ? (this.resolveValue(delay, context) as number) : undefined;
    const resolvedSelector = selector // Apply ESLint formatting suggestion
      ? (this.resolveValue(selector, context) as string)
      : undefined;

    try {
      // Focus the element if a selector is provided
      if (resolvedSelector) {
        logger.debug(`Focusing element "${resolvedSelector}" before pressing key.`);
        await page.waitForSelector(resolvedSelector, { state: 'visible', timeout });
        await page.focus(resolvedSelector);
      }

      // Perform the keyboard action
      logger.debug(
        `Performing keyboard action "${action}" for key "${resolvedKey}" with modifiers: ${JSON.stringify(
          resolvedModifiers || []
        )}`
      );

      switch (action) {
        case 'down':
          // Note: Playwright's down/up doesn't directly take modifiers.
          // Modifiers are typically handled by pressing them down separately before the main key.
          // This handler assumes modifiers are managed via separate 'down'/'up' steps if needed for complex sequences.
          await page.keyboard.down(resolvedKey);
          logger.info(`Pressed down key: ${resolvedKey}`);
          break;

        case 'up':
          await page.keyboard.up(resolvedKey);
          logger.info(`Released key: ${resolvedKey}`);
          break;

        case 'press':
        default: {
          // Construct the key string with modifiers for page.keyboard.press
          // e.g., "Shift+A", "Control+Meta+C"
          const keyWithModifiers = resolvedModifiers
            ? `${resolvedModifiers.join('+')}+${resolvedKey}`
            : resolvedKey;

          // Pass only delay in the options object
          await page.keyboard.press(keyWithModifiers, {
            delay: resolvedDelay,
          });
          logger.info(`Pressed key combination: ${keyWithModifiers}`);
          break;
        }
      }

      // Handle waitFor after the action
      if (step.waitFor) {
        await this.handleWaitFor(step.waitFor, timeout);
      }

      return {}; // Indicate success
    } catch (error: any) {
      const errorMessage = `Error during press step "${stepDescription}": ${error.message}`;
      logger.error(errorMessage);
      if (!optional) {
        throw new Error(errorMessage); // Re-throw if mandatory
      } else {
        logger.warn(`Optional press step failed, continuing flow.`);
        context[`${step.name || 'lastPressError'}`] = errorMessage;
        return {}; // Continue flow
      }
    }
  }
}
