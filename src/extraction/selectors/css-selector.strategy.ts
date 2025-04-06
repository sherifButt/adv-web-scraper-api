// src/extraction/selectors/css-selector.strategy.ts

import { Page } from 'playwright';
import { CssSelectorConfig, SelectorConfig, SelectorType } from '../../types/extraction.types.js';
import { SelectorStrategy } from './selector-strategy.interface.js';
import { logger } from '../../utils/logger.js';

/**
 * Strategy for extracting data using CSS selectors
 */
export class CssSelectorStrategy implements SelectorStrategy {
  /**
   * Check if this strategy can handle the given selector configuration
   * @param config Selector configuration
   * @returns True if this strategy can handle the config
   */
  canHandle(config: SelectorConfig): boolean {
    return config.type === SelectorType.CSS;
  }

  /**
   * Extract data from the page using CSS selectors
   * @param page Playwright page object
   * @param config CSS selector configuration
   * @param context Optional context for the extraction
   * @returns Extracted data
   */
  async extract(page: Page, config: SelectorConfig, context?: any): Promise<any> {
    const cssConfig = config as CssSelectorConfig;
    const { selector, attribute, multiple = false, name } = cssConfig;

    try {
      // Wait for the selector to be available
      await page.waitForSelector(selector, { timeout: 5000 }).catch(() => {
        logger.warn(`Selector "${selector}" not found within timeout`);
      });

      // Check if elements exist
      const exists = (await page.$(selector)) !== null;
      if (!exists) {
        logger.warn(`Selector "${selector}" not found on page`);
        return cssConfig.defaultValue !== undefined ? cssConfig.defaultValue : null;
      }

      // Extract data based on whether we want multiple elements or a single one
      if (multiple) {
        return this.extractMultiple(page, selector, attribute);
      } else {
        return this.extractSingle(page, selector, attribute);
      }
    } catch (error) {
      logger.error(`Error extracting data with CSS selector "${selector}": ${error}`);
      return cssConfig.defaultValue !== undefined ? cssConfig.defaultValue : null;
    }
  }

  /**
   * Extract data from a single element
   * @param page Playwright page object
   * @param selector CSS selector
   * @param attribute Optional attribute to extract
   * @returns Extracted data
   */
  private async extractSingle(
    page: Page,
    selector: string,
    attribute?: string
  ): Promise<string | null> {
    if (attribute) {
      // Extract attribute value
      return page.$eval(selector, (el, attr) => el.getAttribute(attr), attribute);
    } else {
      // Extract text content
      return page.$eval(selector, el => el.textContent?.trim() || '');
    }
  }

  /**
   * Extract data from multiple elements
   * @param page Playwright page object
   * @param selector CSS selector
   * @param attribute Optional attribute to extract
   * @returns Array of extracted data
   */
  private async extractMultiple(
    page: Page,
    selector: string,
    attribute?: string
  ): Promise<string[]> {
    if (attribute) {
      // Extract attribute values
      return page.$$eval(
        selector,
        (elements, attr) => {
          return elements.map(el => el.getAttribute(attr) || '');
        },
        attribute
      );
    } else {
      // Extract text contents
      return page.$$eval(selector, elements => {
        return elements.map(el => el.textContent?.trim() || '');
      });
    }
  }
}
