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
        // Resolve the selector value from context, which might be a string or array
        const resolvedSelector = this.resolveValue(selector, context);
        
        // Handle different selector formats properly
        if (Array.isArray(resolvedSelector)) {
          // Handle array of selectors by trying each one until success
          logger.debug(`Trying multiple frame selectors (array of ${resolvedSelector.length})`);
          frame = await this.tryMultipleSelectors(page, resolvedSelector, step.timeout);
        } else if (typeof resolvedSelector === 'string' && resolvedSelector.includes(',')) {
          // Handle comma-separated CSS selector list by splitting and trying each
          const selectorParts = resolvedSelector.split(',').map(s => s.trim()).filter(Boolean);
          logger.debug(`Trying multiple frame selectors (comma-separated, ${selectorParts.length} parts)`);
          frame = await this.tryMultipleSelectors(page, selectorParts, step.timeout);
        } else if (typeof resolvedSelector === 'string') {
          // Simple string selector
          logger.debug(`Locating frame using selector: ${resolvedSelector}`);
          frame = await this.findFrameBySelector(page, resolvedSelector, step.timeout);
        } else {
          throw new Error(`Invalid selector format for iframe: ${typeof resolvedSelector}`);
        }
        
        if (!frame) {
          throw new Error(`Could not find frame with any of the provided selectors`);
        }
      } else if (frameId) {
        // Playwright's page.frame() doesn't directly support ID, use name or URL pattern
        // A common workaround is to use a selector targeting the ID
        const idSelector = `iframe#${frameId}`;
        logger.debug(`Locating frame using ID selector: ${idSelector}`);
        frame = await this.findFrameBySelector(page, idSelector, step.timeout);
        
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
      logger.info(`Executing ${steps?.length || 0} steps within frame context.`);
      
      // Skip if no steps to execute
      if (!steps || steps.length === 0) {
        logger.debug('No steps specified to execute within frame');
        return {};
      }
      
      // Execute each step in the frame
      for (let i = 0; i < steps.length; i++) {
        const subStep = steps[i];
        try {
          const handler = this.handlerFactory.getHandler(subStep.type);
          // Execute the sub-step, passing the FRAME instead of the PAGE
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
      if (switchToDefault) {
        logger.debug('Implicitly returning to main page context after frame operations.');
      }
    }
  }
  
  /**
   * Helper method to find a frame by selector with proper error handling
   */
  private async findFrameBySelector(
    page: Page, 
    selector: string, 
    timeout?: number
  ): Promise<Frame | null> {
    try {
      // First check if the element exists
      const elementHandle = await page.waitForSelector(selector, {
        state: 'attached',
        timeout: timeout || 10000,
      });
      
      if (!elementHandle) {
        return null;
      }
      
      // Get the contentFrame from the element
      const frame = await elementHandle.contentFrame();
      return frame;
    } catch (error) {
      logger.warn(`Error finding frame with selector "${selector}": ${error instanceof Error ? error.message : String(error)}`);
      return null;
    }
  }
  
  /**
   * Try multiple selectors until one works
   */
  private async tryMultipleSelectors(
    page: Page, 
    selectors: string[], 
    timeout?: number
  ): Promise<Frame | null> {
    logger.debug(`Trying ${selectors.length} different selectors to find frame`);
    
    // Try with specific timeout for each selector
    const perSelectorTimeout = Math.max(1000, Math.floor((timeout || 10000) / selectors.length));
    
    // First attempt - Try each selector quickly
    for (const selector of selectors) {
      const frame = await this.findFrameBySelector(page, selector, perSelectorTimeout);
      if (frame) {
        logger.debug(`Found frame with selector: ${selector}`);
        return frame;
      }
    }
    
    // Second attempt - Wait a bit and retry once more with longer timeout
    await page.waitForTimeout(1000);
    logger.debug('First attempt failed, retrying frame selectors with longer timeout');
    
    // Retry with more time
    for (const selector of selectors) {
      const frame = await this.findFrameBySelector(page, selector, perSelectorTimeout * 2);
      if (frame) {
        logger.debug(`Found frame with selector after retry: ${selector}`);
        return frame;
      }
    }
    
    // Check if any iframes exist on the page for better logging
    const iframeCount = await page.evaluate(() => document.querySelectorAll('iframe').length);
    if (iframeCount > 0) {
      logger.warn(`Found ${iframeCount} iframes but none matched the selectors`);
      // Log iframe sources for debugging
      await page.evaluate(() => {
        const iframes = document.querySelectorAll('iframe');
        const sources = Array.from(iframes).map((iframe, index) => {
          const src = iframe.getAttribute('src') || iframe.getAttribute('data-src') || 'no-src';
          return `iframe[${index}]: ${src}`;
        });
        console.log('Available iframes:', sources.join('\n'));
      });
    } else {
      logger.warn('No iframes found on the page');
    }
    
    return null;
  }
}
