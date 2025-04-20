import { Page } from 'playwright';
import { ManageStorageStep, NavigationContext, StepResult } from '../types/navigation.types.js'; // Corrected import format
import { logger } from '../../utils/logger.js';
import { BaseStepHandler } from './base-step-handler.js';

export class ManageStorageStepHandler extends BaseStepHandler {
  public canHandle(step: ManageStorageStep): boolean {
    return step.type === 'manageStorage';
  }

  public async execute(
    step: ManageStorageStep,
    context: NavigationContext,
    page: Page
  ): Promise<StepResult> {
    const {
      storageType, // 'local' or 'session'
      action,
      key,
      value,
      contextKey = 'retrievedStorageItem', // Default context key for 'getItem'
      description,
      optional = false,
    } = step;

    const stepDescription = description || `Manage ${storageType}Storage: ${action}`;
    logger.info(`Executing step: ${stepDescription}`);

    const storageObjectName = storageType === 'local' ? 'localStorage' : 'sessionStorage';

    try {
      // Validate required fields based on action
      if ((action === 'setItem' || action === 'getItem' || action === 'removeItem') && !key) {
        throw new Error(`Action '${action}' requires a 'key'.`);
      }
      if (action === 'setItem' && value === undefined) {
        throw new Error(`Action 'setItem' requires a 'value'.`);
      }

      const resolvedKey = key ? (this.resolveValue(key, context) as string) : undefined;
      // Resolve and stringify value for setItem
      const resolvedValue =
        action === 'setItem' ? JSON.stringify(this.resolveValue(value, context)) : undefined;

      // Execute action in browser context
      const result = await page.evaluate(
        ({ storageObjectName, action, resolvedKey, resolvedValue }) => {
          const storage = window[storageObjectName as keyof Window];
          if (!storage) {
            throw new Error(`${storageObjectName} is not available.`);
          }

          switch (action) {
            case 'setItem':
              if (resolvedKey && resolvedValue !== undefined) {
                storage.setItem(resolvedKey, resolvedValue);
              }
              return null; // No return value for setItem
            case 'getItem':
              if (resolvedKey) {
                const item = storage.getItem(resolvedKey);
                // Attempt to parse JSON, return raw string if parsing fails
                try {
                  return item !== null ? JSON.parse(item) : null;
                } catch (e) {
                  return item;
                }
              }
              return null;
            case 'removeItem':
              if (resolvedKey) {
                storage.removeItem(resolvedKey);
              }
              return null; // No return value for removeItem
            case 'clear':
              storage.clear();
              return null; // No return value for clear
            default:
              throw new Error(`Unsupported storage action: ${action}`);
          }
        },
        { storageObjectName, action, resolvedKey, resolvedValue } // Pass parameters to evaluate
      );

      // Store result in context if action was 'getItem'
      if (action === 'getItem') {
        context[contextKey] = result;
        logger.info(
          `Retrieved item for key "${resolvedKey}" from ${storageObjectName} and stored in context.${contextKey}.`
        );
      } else {
        logger.info(
          `Action '${action}' completed successfully on ${storageObjectName}${
            resolvedKey ? ` for key "${resolvedKey}"` : ''
          }.`
        );
      }

      return {};
    } catch (error: any) {
      const errorMessage = `Error during manageStorage step "${stepDescription}": ${error.message}`;
      logger.error(errorMessage);
      if (!optional) {
        throw new Error(errorMessage); // Re-throw if mandatory
      } else {
        logger.warn(`Optional manageStorage step failed, continuing flow.`);
        context[`${step.name || 'lastStorageError'}`] = errorMessage;
        return {}; // Continue flow
      }
    }
  }
}
