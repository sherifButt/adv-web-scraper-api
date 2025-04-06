// src/extraction/selectors/regex-selector.strategy.ts

import { Page } from 'playwright';
import { RegexSelectorConfig, SelectorConfig, SelectorType } from '../../types/extraction.types.js';
import { SelectorStrategy } from './selector-strategy.interface.js';
import { logger } from '../../utils/logger.js';

/**
 * Strategy for extracting data using regular expressions
 */
export class RegexSelectorStrategy implements SelectorStrategy {
  /**
   * Check if this strategy can handle the given selector configuration
   * @param config Selector configuration
   * @returns True if this strategy can handle the config
   */
  canHandle(config: SelectorConfig): boolean {
    return config.type === SelectorType.REGEX;
  }

  /**
   * Extract data from the page using regular expressions
   * @param page Playwright page object
   * @param config Regex selector configuration
   * @param context Optional context for the extraction
   * @returns Extracted data
   */
  async extract(page: Page, config: SelectorConfig, context?: any): Promise<any> {
    const regexConfig = config as RegexSelectorConfig;
    const { pattern, flags = 'g', group = 0, multiple = false, source } = regexConfig;

    try {
      // Get the source text to apply the regex to
      let sourceText: string;
      if (source) {
        if (source === 'html') {
          // Get the entire HTML content
          sourceText = await page.content();
        } else if (source === 'text') {
          // Get the entire text content
          sourceText = await page.evaluate(() => document.body.innerText);
        } else {
          // Assume source is a CSS or XPath selector
          try {
            const element = await page.$(source);
            if (!element) {
              logger.warn(`Source selector "${source}" not found on page`);
              return regexConfig.defaultValue !== undefined ? regexConfig.defaultValue : null;
            }
            sourceText = (await element.textContent()) || '';
          } catch (error) {
            logger.error(`Error getting source text from selector "${source}": ${error}`);
            return regexConfig.defaultValue !== undefined ? regexConfig.defaultValue : null;
          }
        }
      } else {
        // Default to HTML content
        sourceText = await page.content();
      }

      // Create the regex
      const regex = new RegExp(pattern, flags);
      // Extract data based on whether we want multiple matches or a single one
      if (multiple) {
        return this.extractMultiple(sourceText, regex, group);
      } else {
        return this.extractSingle(sourceText, regex, group);
      }
    } catch (error) {
      logger.error(`Error extracting data with regex pattern "${pattern}": ${error}`);
      return regexConfig.defaultValue !== undefined ? regexConfig.defaultValue : null;
    }
  }

  /**
   * Extract a single match from the source text
   * @param sourceText Source text to apply regex to
   * @param regex Regular expression
   * @param group Capture group to extract
   * @returns Extracted data
   */
  private extractSingle(sourceText: string, regex: RegExp, group: number): string | null {
    const match = regex.exec(sourceText);
    if (!match) {
      return null;
    }
    return match[group] || null;
  }

  /**
   * Extract multiple matches from the source text
   * @param sourceText Source text to apply regex to
   * @param regex Regular expression
   * @param group Capture group to extract
   * @returns Array of extracted data
   */
  private extractMultiple(sourceText: string, regex: RegExp, group: number): string[] {
    const results: string[] = [];
    let match;
    // Reset regex lastIndex to ensure we start from the beginning
    regex.lastIndex = 0;
    while ((match = regex.exec(sourceText)) !== null) {
      if (match[group]) {
        results.push(match[group]);
      }
      // Prevent infinite loops for zero-width matches
      if (match.index === regex.lastIndex) {
        regex.lastIndex++;
      }
    }
    return results;
  }
}
