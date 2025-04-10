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

      // Clean and validate the pattern
      const cleanedPattern = this.cleanPattern(pattern);
      if (!this.isValidPattern(cleanedPattern)) {
        logger.warn(`Invalid regex pattern: ${pattern}`);
        return regexConfig.defaultValue !== undefined ? regexConfig.defaultValue : null;
      }

      // Create the regex
      const regex = new RegExp(cleanedPattern, flags);
      // Extract data based on whether we want multiple matches or a single one
      if (multiple) {
        return this.extractMultiple(sourceText, regex, group);
      } else {
        return this.extractSingle(sourceText, regex, group, regexConfig);
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
  private extractSingle(
    sourceText: string,
    regex: RegExp,
    group: number,
    config: RegexSelectorConfig
  ): string | number | null {
    try {
      const match = regex.exec(sourceText);
      if (!match) {
        return null;
      }
      // Handle invalid group numbers
      const result = group < 0 || group >= match.length ? match[0] : match[group];
      if (!result) return null;

      // Convert to number if specified
      if (config.dataType === 'number') {
        // First try direct conversion, then fallback to cleaning non-numeric chars
        let numericValue = Number(result);
        if (isNaN(numericValue)) {
          numericValue = Number(result.replace(/[^0-9.-]/g, ''));
        }
        return isNaN(numericValue) ? null : numericValue;
      }
      return result;
    } catch (error) {
      logger.warn(`Regex execution error: ${error}`);
      return null;
    }
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
    try {
      // Reset regex lastIndex to ensure we start from the beginning
      regex.lastIndex = 0;
      while ((match = regex.exec(sourceText)) !== null) {
        // Handle invalid group numbers
        const result = group >= 0 && group < match.length ? match[group] : match[0];
        if (result) {
          results.push(result);
        }
        // Prevent infinite loops for zero-width matches
        if (match.index === regex.lastIndex) {
          regex.lastIndex++;
        }
      }
    } catch (error) {
      logger.warn(`Regex execution error: ${error}`);
    }
    return results;
  }

  /**
   * Clean regex pattern by removing surrounding slashes if present
   * @param pattern Input pattern
   * @returns Cleaned pattern
   */
  private cleanPattern(pattern: string): string {
    // Remove surrounding slashes if they exist
    if (pattern.startsWith('/') && pattern.endsWith('/')) {
      return pattern.slice(1, -1);
    }
    return pattern;
  }

  /**
   * Validate regex pattern syntax
   * @param pattern Pattern to validate
   * @returns True if pattern is valid
   */
  private isValidPattern(pattern: string): boolean {
    try {
      new RegExp(pattern);
      return true;
    } catch {
      return false;
    }
  }
}
