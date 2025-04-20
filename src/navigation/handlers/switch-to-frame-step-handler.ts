import { Page, Frame, ElementHandle } from 'playwright';
import {
  SwitchToFrameStep,
  NavigationContext,
  StepResult,
  NavigationStep,
} from '../types/navigation.types.js';
import { logger } from '../../utils/logger.js';
import { BaseStepHandler } from './base-step-handler.js';
import { StepHandlerFactory } from './step-handler-factory.js'; // Import factory

export class SwitchToFrameStepHandler extends BaseStepHandler {
  private handlerFactory: StepHandlerFactory;

  // Requires the factory to execute nested steps
  constructor(page: Page, handlerFactory: StepHandlerFactory) {
    super(page);
    this.handlerFactory = handlerFactory;
  }

  public canHandle(step: SwitchToFrameStep): boolean {
    return step.type === 'switchToFrame';
  }

  public async execute(
    step: SwitchToFrameStep,
    context: NavigationContext,
    page: Page // Main page instance
  ): Promise<StepResult> {
    const {
      selector,
      frameId,
      frameName,
      steps,
      switchToDefault = true, // Default to switching back
      description,
      optional = false,
    } = step;

    const stepDescription = description || `Switch to frame and execute steps`;
    logger.info(`Executing step: ${stepDescription}`);

    let frame: Frame | null = null;

    try {
      // --- Find the frame ---
      if (selector) {
        const resolvedSelector = this.resolveValue(selector, context) as string;
        logger.debug(`Locating frame using selector: ${resolvedSelector}`);
        const elementHandle = await page.waitForSelector(resolvedSelector, {
          state: 'attached', // Wait for the element to be in the DOM
          timeout: step.timeout || 10000,
        });
        if (!elementHandle) {
          throw new Error(`Iframe element not found for selector: ${resolvedSelector}`);
        }
        frame = await elementHandle.contentFrame();
        if (!frame) {
          throw new Error(`Could not get content frame for selector: ${resolvedSelector}`);
        }
        logger.debug(`Found frame using selector: ${resolvedSelector}`);
      } else if (frameId) {
        // Playwright's page.frame() doesn't directly support ID, use name or URL pattern
        // A common workaround is to use a selector targeting the ID
        const idSelector = `iframe#${frameId}`;
        logger.debug(`Locating frame using ID selector: ${idSelector}`);
        const elementHandle = await page.waitForSelector(idSelector, {
          state: 'attached',
          timeout: step.timeout || 10000,
        });
        if (!elementHandle) {
          throw new Error(`Iframe element not found for ID: ${frameId}`);
        }
        frame = await elementHandle.contentFrame();
        if (!frame) {
          throw new Error(`Could not get content frame for ID: ${frameId}`);
        }
        logger.debug(`Found frame using ID: ${frameId}`);
      } else if (frameName) {
        logger.debug(`Locating frame using name: ${frameName}`);
        frame = page.frame(frameName);
        if (!frame) {
          // Wait a bit for the frame to potentially appear if lookup fails initially
          await page.waitForTimeout(1000);
          frame = page.frame(frameName);
          if (!frame) {
            throw new Error(`Frame with name "${frameName}" not found.`);
          }
        }
        logger.debug(`Found frame using name: ${frameName}`);
      } else {
        throw new Error('SwitchToFrame step requires one of: selector, frameId, or frameName.');
      }

      if (!frame) {
        throw new Error('Failed to find or access the specified frame.');
      }

      // --- Execute steps within the frame ---
      logger.info(`Executing ${steps.length} steps within frame context.`);
      // IMPORTANT: We need to pass the 'frame' object to the sub-handlers.
      // Current BaseStepHandler and execute signatures expect a Page.
      // This requires modification or careful handling in sub-steps.
      // For now, let's assume sub-handlers can work with frame locators.
      // A better approach might be to pass the frame as part of the context
      // or modify the execute signature. Let's try passing the frame directly.

      for (let i = 0; i < steps.length; i++) {
        const subStep = steps[i];
        try {
          const handler = this.handlerFactory.getHandler(subStep.type);
          // Execute the sub-step, passing the FRAME instead of the PAGE
          // This assumes handlers are adapted or use locators relative to the passed scope.
          // TODO: Verify/adapt all handlers to accept Frame | Page as scope.
          // For now, casting 'frame' as 'Page' might work if handlers use frame.locator()
          // which has a similar API to page.locator(). This is risky.
          // A safer temporary approach: pass frame in context.
          // const frameContext = { ...context, __currentFrame: frame };
          // Let's assume BaseStepHandler is modified to check context.__currentFrame
          // and use frame.locator() if present, otherwise page.locator().
          // OR, modify execute signature (major change).
          // Sticking with passing frame directly for now, assuming handlers adapt.
          await handler.execute(subStep, context, frame as any as Page); // Risky cast!
        } catch (error: any) {
          const subStepErrorMessage = `Error executing sub-step ${i + 1} (${
            subStep.type
          }) in frame: ${error.message}`;
          logger.error(subStepErrorMessage);
          if (!subStep.optional) {
            throw new Error(subStepErrorMessage); // Re-throw only if the sub-step is mandatory
          } else {
            logger.warn(
              `Optional sub-step ${i + 1} (${subStep.type}) failed, continuing frame steps.`
            );
            // Optionally store the error in context if needed
            context[`${subStep.name || `subStep${i + 1}Error`}`] = subStepErrorMessage;
          }
        }
      }

      logger.info(`Finished executing steps within frame.`);
      return {};
    } catch (error: any) {
      const errorMessage = `Error during switchToFrame step "${stepDescription}": ${error.message}`;
      logger.error(errorMessage);
      // Explicitly check step.optional directly from the step object
      if (!step.optional) {
        throw new Error(errorMessage); // Re-throw if mandatory
      } else {
        logger.warn(`Optional switchToFrame step "${stepDescription}" failed, continuing flow.`);
        context[`${step.name || 'lastFrameError'}`] = errorMessage;
        return {}; // Continue flow
      }
    } finally {
      // --- Switch back to default context (main page) ---
      // This is tricky as Playwright doesn't have an explicit "switch back".
      // Operations are implicitly on the main page unless a frame locator is used.
      // If sub-handlers were passed the frame object directly, subsequent steps
      // outside this handler will correctly use the main page object again.
      // So, no explicit action needed here if handlers receive the correct scope.
      if (switchToDefault) {
        logger.debug('Implicitly returning to main page context after frame operations.');
      }
    }
  }
}
