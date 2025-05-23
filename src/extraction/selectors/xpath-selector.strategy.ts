// src/extraction/selectors/xpath-selector.strategy.ts

import { Page } from 'playwright';
import { SelectorConfig, SelectorType, XPathSelectorConfig } from '../../types/extraction.types.js';
import { SelectorStrategy } from './selector-strategy.interface.js';
import { logger } from '../../utils/logger.js';

/**
 * Strategy for extracting data using XPath selectors
 */
export class XPathSelectorStrategy implements SelectorStrategy {
  /**
   * Check if this strategy can handle the given selector configuration
   * @param config Selector configuration
   * @returns True if this strategy can handle the config
   */
  canHandle(config: SelectorConfig): boolean {
    return config.type === SelectorType.XPATH;
  }

  /**
   * Extract data from the page using XPath selectors
   * @param page Playwright page object
   * @param config XPath selector configuration
   * @param context Optional context for the extraction
   * @returns Extracted data
   */
  async extract(page: Page, config: SelectorConfig, context?: any): Promise<any> {
    const xpathConfig = config as XPathSelectorConfig;
    const { selector, attribute, multiple = false, name, defaultValue } = xpathConfig;

    // Helper function to try multiple selectors
    const trySelectors = async <T>(
      action: (selector: string) => Promise<T | null | undefined>
    ): Promise<T | null | undefined> => {
      if (typeof selector === 'string') {
        return action(selector);
      } else if (Array.isArray(selector)) {
        for (const sel of selector) {
          const result = await action(sel);
          // Use the first selector that yields a non-null/non-empty result
          if (result !== null && result !== undefined && (!Array.isArray(result) || result.length > 0)) {
            logger.debug(`Using fallback XPath selector: ${sel}`);
            return result;
          }
          logger.debug(`Fallback XPath selector failed: ${sel}`);
        }
        logger.warn(`All fallback XPath selectors failed for config: ${JSON.stringify(config)}`);
        return null;
      }
      return null;
    };

    try {
      // Find elements using XPath, trying fallbacks if necessary
      const elements = await trySelectors(async (sel) => page.$$(sel));

      if (!elements || elements.length === 0) {
        const selectorString = Array.isArray(selector) ? selector.join('", "') : selector;
        logger.warn(`XPath selector(s) "${selectorString}" did not match any elements`);
        return defaultValue !== undefined ? defaultValue : null;
      }

      // Extract data based on whether we want multiple elements or a single one
      if (multiple) {
        return this.extractMultiple(elements, attribute);
      } else {
        return this.extractSingle(elements[0], attribute);
      }
    } catch (error) {
      const selectorString = Array.isArray(selector) ? selector.join('", "') : selector;
      logger.error(`Error extracting data with XPath selector(s) "${selectorString}": ${error}`);
      return defaultValue !== undefined ? defaultValue : null;
    }
  }

  /**
   * Extract data from a single element
   * @param element Playwright ElementHandle
   * @param attribute Optional attribute to extract
   * @returns Extracted data
   */
  private async extractSingle(element: any, attribute?: string): Promise<string | null> {
    try {
      if (attribute) {
        // Extract attribute value
        return await element.getAttribute(attribute);
      } else {
        // Extract text content
        return await element.textContent().then((text: string) => text.trim());
      }
    } catch (error) {
      logger.error(`Error extracting data from element: ${error}`);
      return null;
    }
  }

  /**
   * Extract data from multiple elements
   * @param elements Array of Playwright ElementHandles
   * @param attribute Optional attribute to extract
   * @returns Array of extracted data
   */
  private async extractMultiple(elements: any[], attribute?: string): Promise<string[]> {
    try {
      const results: string[] = [];
      for (const element of elements) {
        if (attribute) {
          // Extract attribute value
          const value = await element.getAttribute(attribute);
          results.push(value || '');
        } else {
          // Extract text content
          const text = await element.textContent();
          results.push(text ? text.trim() : '');
        }
      }
      return results;
    } catch (error) {
      logger.error(`Error extracting data from elements: ${error}`);
      return [];
    }
  }
}
