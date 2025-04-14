import { Page } from 'playwright';
import { NavigationStep, NavigationContext, StepResult } from '../types/navigation.types.js';
import { logger } from '../../utils/logger.js';
import { BaseStepHandler } from './base-step-handler.js';
import { StepHandlerFactory } from './step-handler-factory.js'; // Import factory for recursive calls

export class ConditionStepHandler extends BaseStepHandler {
  private handlerFactory: StepHandlerFactory;

  constructor(page: Page, handlerFactory: StepHandlerFactory) {
    super(page);
    this.handlerFactory = handlerFactory;
  }

  public canHandle(step: NavigationStep): boolean {
    return step.type === 'condition';
  }

  public async execute(
    step: NavigationStep,
    context: NavigationContext,
    page: Page
  ): Promise<StepResult> {
    const condition = step.condition;
    if (!condition) throw new Error('Condition step requires a condition');

    let result = false;
    if (typeof condition === 'string') {
      try {
        const selector = this.resolveValue(condition, context);
        const element = await this.page.$(selector);
        result = !!element;
      } catch (error) {
        result = false;
      }
    } else if (typeof condition === 'function') {
      try {
        const conditionFn = condition as (context: any, page: Page) => Promise<boolean>;
        result = await conditionFn(context, this.page);
      } catch (error) {
        result = false;
      }
    }

    logger.info(`Condition evaluated to: ${result}`);
    step.result = result; // Store result in the step object if needed later

    const stepsToExecute = result ? step.thenSteps : step.elseSteps;

    if (stepsToExecute) {
      logger.info(`Executing ${result ? 'then' : 'else'} branch`);
      for (let i = 0; i < stepsToExecute.length; i++) {
        const subStep = stepsToExecute[i];
        try {
          // Use the factory to get the handler for the sub-step
          const handler = this.handlerFactory.getHandler(subStep.type);
          // Execute the sub-step using its handler, passing the page instance
          await handler.execute(subStep, context, this.page);
        } catch (error) {
          logger.error(`Error executing sub-step ${i + 1} (${subStep.type}) in condition:`, error);
          throw error; // Re-throw to stop the flow on error within conditional branch
        }
      }
    }
    return {};
  }
}
