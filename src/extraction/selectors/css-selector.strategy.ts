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

    // Try multiple selectors if provided
    if (cssConfig.selectors && cssConfig.selectors.length > 0) {
      // Try each selector in the array until one works
      for (const selectorOption of cssConfig.selectors) {
        try {
          // Transform dynamic class selectors to use wildcard matching
          const transformedSelector = selectorOption.includes('__')
            ? selectorOption.replace(/(\.[a-zA-Z0-9-]+)__[a-zA-Z0-9]+/g, '[class*="$1"]')
            : selectorOption;

          // Check if elements exist
          const exists = (await page.$(transformedSelector)) !== null;
          if (exists) {
            // Use this selector since it exists
            logger.debug(`Using selector option: ${transformedSelector}`);
            
            // Extract data based on whether we want multiple elements or a single one
            if (multiple) {
              return this.extractMultiple(page, transformedSelector, attribute, cssConfig.source);
            } else {
              return this.extractSingle(page, transformedSelector, attribute, cssConfig.source);
            }
          }
        } catch (error) {
          // Continue to next selector if this one fails
          logger.debug(`Selector option ${selectorOption} failed, trying next option`);
        }
      }
      
      // If we get here, none of the selectors worked
      logger.warn(`None of the provided selectors worked for ${name || 'unnamed field'}`);
      return cssConfig.defaultValue !== undefined ? cssConfig.defaultValue : null;
    }

    // Handle single selector (original behavior)
    // Transform dynamic class selectors to use wildcard matching
    const transformedSelector = selector.includes('__')
      ? selector.replace(/(\.[a-zA-Z0-9-]+)__[a-zA-Z0-9]+/g, '[class*="$1"]')
      : selector;

    try {
      // Wait for the selector to be available
      await page.waitForSelector(transformedSelector, { timeout: 5000 }).catch(() => {
        logger.warn(
          `Selector "${selector}" (transformed to "${transformedSelector}") not found within timeout`
        );
      });

      // Check if elements exist
      const exists = (await page.$(transformedSelector)) !== null;
      if (!exists) {
        logger.warn(
          `Selector "${selector}" (transformed to "${transformedSelector}") not found on page`
        );
        return cssConfig.defaultValue !== undefined ? cssConfig.defaultValue : null;
      }

      // Extract data based on whether we want multiple elements or a single one
      try {
        if (multiple) {
          return this.extractMultiple(page, transformedSelector, attribute, cssConfig.source);
        } else {
          return this.extractSingle(page, transformedSelector, attribute, cssConfig.source);
        }
      } catch (error) {
        if (cssConfig.continueOnError) {
          logger.warn(`Failed to extract with selector "${transformedSelector}": ${error}`);
          return null;
        }
        throw error;
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
    attribute?: string,
    source?: 'html' | 'text'
  ): Promise<string | null> {
    if (attribute) {
      // Extract attribute value
      return page.$eval(selector, (el, attr) => el.getAttribute(attr), attribute);
    } else if (source === 'html') {
      // Extract HTML content
      return page.$eval(selector, el => el.innerHTML);
    } else {
      // Default to text content
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
    attribute?: string,
    source?: 'html' | 'text'
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
    } else if (source === 'html') {
      // Extract HTML contents
      return page.$$eval(selector, elements => {
        return elements.map(el => el.innerHTML);
      });
    } else {
      // Default to text contents
      return page.$$eval(selector, elements => {
        return elements.map(el => el.textContent?.trim() || '');
      });
    }
  }
}
