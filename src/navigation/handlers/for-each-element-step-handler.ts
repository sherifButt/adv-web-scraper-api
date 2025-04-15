import { Page, ElementHandle } from 'playwright';
import {
  NavigationContext,
  NavigationStep,
  ForEachElementStep,
  StepResult,
} from '../types/navigation.types.js';
import { IStepHandler } from '../types/step-handler.interface.js';
import { logger } from '../../utils/logger.js';
import { StepHandlerFactory } from './step-handler-factory.js';

export class ForEachElementStepHandler implements IStepHandler {
  canHandle(step: NavigationStep): boolean {
    return step.type === 'forEachElement';
  }

  async execute(
    step: ForEachElementStep,
    context: NavigationContext,
    page: Page
  ): Promise<StepResult> {
    logger.info(`Executing forEachElement: ${step.description || step.selector}`);

    if (!step.selector) {
      throw new Error('ForEachElementStep requires a "selector".');
    }

    if (!step.elementSteps || step.elementSteps.length === 0) {
      throw new Error('ForEachElementStep requires at least one elementStep.');
    }

    const elementHandles = await page.$$(step.selector);
    const maxIterations = step.maxIterations ?? elementHandles.length;
    const iterations = Math.min(elementHandles.length, maxIterations);

    logger.info(
      `Found ${elementHandles.length} elements for selector "${step.selector}". Will iterate ${iterations} times.`
    );

    // Instantiate the factory *once* before the loop
    const handlerFactory = new StepHandlerFactory(page);

    // Loop through each element
    for (let i = 0; i < iterations; i++) {
      const elementHandle = elementHandles[i];
      // Create context specific to this iteration, including the element and index
      const iterationContext: NavigationContext = {
        ...context,
        currentItemHandle: elementHandle, // Use the correct property name
        currentIndex: i,
      };

      logger.info(`--- Iteration ${i + 1}/${iterations} ---`);

      try {
        await elementHandle.waitForElementState('visible', { timeout: 7000 });

        // Execute each nested step within the context of the current element
        for (const elementStep of step.elementSteps) {
          const handler = handlerFactory.getHandler(elementStep.type);
          // Add logging to verify context before executing nested step
          logger.debug(
            `Executing nested step type "${
              elementStep.type
            }" for index ${i}. Context has currentItemHandle: ${!!iterationContext.currentItemHandle}` // Log still checks correct property name now
          );
          // Pass the iteration-specific context to the nested step handler
          await handler.execute(elementStep, iterationContext, page);
        }
      } catch (error: any) {
        // Log errors but continue processing other elements
        logger.error(`Error during iteration ${i + 1}: ${error.message}`);
        console.error(error.stack); // Log stack for debugging
        logger.warn('Continuing to next iteration despite error.');
      } finally {
        logger.info(`--- Finished Iteration ${i + 1}/${iterations} ---`);
      }
    }

    logger.info(`Finished forEachElement: ${step.description || step.selector}`);
    // Return empty result as this step doesn't modify flow control directly
    return {};
  }
}
