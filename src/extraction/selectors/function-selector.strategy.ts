// src/extraction/selectors/function-selector.strategy.ts

import { Page } from 'playwright';
import {
  FunctionSelectorConfig,
  SelectorConfig,
  SelectorType,
} from '../../types/extraction.types.js';
import { SelectorStrategy } from './selector-strategy.interface.js';
import { logger } from '../../utils/logger.js';

/**
 * Strategy for extracting data using custom functions
 */
export class FunctionSelectorStrategy implements SelectorStrategy {
  /**
   * Check if this strategy can handle the given selector configuration
   * @param config Selector configuration
   * @returns True if this strategy can handle the config
   */
  canHandle(config: SelectorConfig): boolean {
    return config.type === SelectorType.FUNCTION;
  }

  /**
   * Extract data from the page using a custom function
   * @param page Playwright page object
   * @param config Function selector configuration
   * @param context Optional context for the extraction
   * @returns Extracted data
   */
  async extract(page: Page, config: SelectorConfig, context?: any): Promise<any> {
    const functionConfig = config as FunctionSelectorConfig;
    const { function: extractFunction, name } = functionConfig;

    try {
      // Handle different function types
      if (typeof extractFunction === 'string') {
        // Function is provided as a string to be evaluated
        return this.executeStringFunction(page, extractFunction, context);
      } else if (typeof extractFunction === 'function') {
        // Function is provided as a JavaScript function
        return extractFunction(page, context);
      } else {
        logger.error(`Invalid function type for selector "${name}"`);
        return functionConfig.defaultValue !== undefined ? functionConfig.defaultValue : null;
      }
    } catch (error) {
      logger.error(`Error executing function for selector "${name}": ${error}`);
      return functionConfig.defaultValue !== undefined ? functionConfig.defaultValue : null;
    }
  }

  /**
   * Execute a function provided as a string
   * @param page Playwright page object
   * @param functionString Function as a string
   * @param context Optional context for the extraction
   * @returns Extracted data
   */
  private async executeStringFunction(
    page: Page,
    functionString: string,
    context?: any
  ): Promise<any> {
    try {
      // If the function is a simple page evaluation
      if (functionString.startsWith('return ') || functionString.includes(';')) {
        // Execute the function in the browser context
        return page.evaluate(
          `(function(context) { ${functionString} })(${JSON.stringify(context)})`
        );
      } else {
        // Assume it's a reference to a predefined function
        // This would require a registry of functions, which is beyond the scope of this implementation
        logger.warn(`Function string "${functionString}" is not a valid function body`);
        return null;
      }
    } catch (error) {
      logger.error(`Error executing function string: ${error}`);
      return null;
    }
  }
}
