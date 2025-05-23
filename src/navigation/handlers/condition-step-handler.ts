import { Page, ElementHandle } from 'playwright'; // Import ElementHandle
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
        const selector = this.resolveValue(condition, context) as string;
        const currentItemHandle = context.currentItemHandle as ElementHandle | undefined;
        const scope = currentItemHandle || this.page; // Use element handle if available
        logger.debug(
          `Evaluating condition selector "${selector}" within ${
            currentItemHandle ? 'current element handle' : 'page'
          }.`
        );
        // Use $ instead of waitForSelector for a simple existence check
        const element = await scope.$(selector);
        result = !!element; // True if element exists in the scope, false otherwise
      } catch (error: any) {
        // Check if the error is likely a selector syntax error
        if (error.message?.includes('is not a valid selector') || error.name === 'SyntaxError') {
          logger.error(`Invalid selector syntax in condition: "${condition}". Error: ${error.message}`);
          // Re-throw the syntax error to halt execution and report it
          throw new Error(`InvalidConditionSelectorError: Selector "${condition}" is invalid: ${error.message}`);
        } else {
          // Log other errors as warnings and treat condition as false
          logger.warn(`Error evaluating condition selector "${condition}": ${error.message}`);
          result = false;
        }
      }
    } else if (typeof condition === 'function') {
      try {
        const conditionFn = condition as (context: any, page: Page) => Promise<boolean>;
        // Pass the specific context to the function
        result = await conditionFn(context, this.page);
      } catch (error) {
        logger.warn(`Error executing condition function: ${error}`);
        result = false; // Treat errors as false condition
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
