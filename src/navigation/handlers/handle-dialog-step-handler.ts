import { Page, Dialog } from 'playwright';
import { HandleDialogStep, NavigationContext, StepResult } from '../types/navigation.types.js';
import { logger } from '../../utils/logger.js';
import { BaseStepHandler } from './base-step-handler.js';

export class HandleDialogStepHandler extends BaseStepHandler {
  public canHandle(step: HandleDialogStep): boolean {
    return step.type === 'handleDialog';
  }

  public async execute(
    step: HandleDialogStep,
    context: NavigationContext,
    page: Page
  ): Promise<StepResult> {
    const { action, promptText, description, optional = false } = step;

    const stepDescription = description || `Handle dialog with action: ${action}`;
    logger.info(`Executing step: ${stepDescription} (Setting up listener)`);

    // This step primarily sets up a listener for the *next* dialog.
    // It doesn't wait for a dialog itself, but prepares for one triggered
    // by a subsequent action (e.g., a click).

    try {
      page.once('dialog', async (dialog: Dialog) => {
        logger.info(`Dialog opened: type=${dialog.type()}, message="${dialog.message()}"`);
        try {
          if (action === 'accept') {
            await dialog.accept(promptText); // promptText is ignored for alert/confirm
            logger.info(`Dialog accepted${promptText ? ` with text "${promptText}"` : ''}.`);
          } else if (action === 'dismiss') {
            await dialog.dismiss();
            logger.info('Dialog dismissed.');
          }
        } catch (dialogError: any) {
          // Log error during dialog handling but don't necessarily fail the main step
          // unless the step is mandatory? This depends on desired behavior.
          // For now, just log it. The main action might still succeed or fail separately.
          logger.error(`Error handling dialog: ${dialogError.message}`);
          // If the main step was optional, this error shouldn't cause failure.
          // If the main step was mandatory, the error in the *triggering* action
          // is more relevant than this listener error.
        }
      });

      logger.debug(`Dialog listener set for action: ${action}`);
      // This step completes immediately after setting the listener.
      // The actual dialog interaction happens asynchronously if/when a dialog appears.
      return {};
    } catch (error: any) {
      // This catch block is unlikely to be hit unless there's an error setting up the listener itself.
      const errorMessage = `Error setting up dialog listener for step "${stepDescription}": ${error.message}`;
      logger.error(errorMessage);
      if (!optional) {
        // Even if optional, an error setting the listener might be critical.
        throw new Error(errorMessage);
      } else {
        logger.warn(`Optional handleDialog step failed during setup, continuing flow.`);
        context[`${step.name || 'lastDialogError'}`] = errorMessage;
        return {}; // Continue flow
      }
    }
  }
}
