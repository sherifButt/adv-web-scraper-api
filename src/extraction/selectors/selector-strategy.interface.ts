// src/extraction/selectors/selector-strategy.interface.ts

import { Page } from 'playwright';
import { SelectorConfig } from '../../types/extraction.types.js';

/**
 * Interface for selector strategies
 * Implements the Strategy pattern for different selector types
 */
export interface SelectorStrategy {
  /**
   * Extract data from the page using the selector
   * @param page Playwright page object
   * @param config Selector configuration
   * @param context Optional context for the extraction
   * @returns Extracted data
   */
  extract(page: Page, config: SelectorConfig, context?: any): Promise<any>;

  /**
   * Check if this strategy can handle the given selector configuration
   * @param config Selector configuration
   * @returns True if this strategy can handle the config
   */
  canHandle(config: SelectorConfig): boolean;
}
