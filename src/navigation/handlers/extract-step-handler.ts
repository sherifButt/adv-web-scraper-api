// src/navigation/handlers/extract-step-handler.ts

import { ElementHandle, Page } from 'playwright'; // Add ElementHandle
import { NavigationStep } from '../types/navigation.types.js';
import { logger } from '../../utils/logger.js';
import {
  CssSelectorConfig,
  RegexSelectorConfig, // Add RegexSelectorConfig
  SelectorConfig, // Add SelectorConfig
  SelectorType, // Add SelectorType
} from '../../types/extraction.types.js';
import { BaseStepHandler } from './base-step-handler.js';
import { ExtractionEngine } from '../../extraction/extraction-engine.js'; // Keep for potential future use
import { RegexSelectorStrategy } from '../../extraction/selectors/regex-selector.strategy.js'; // Import Regex strategy

export class ExtractStepHandler extends BaseStepHandler {
  private regexStrategy = new RegexSelectorStrategy(); // Instantiate regex strategy
  public canHandle(step: NavigationStep): boolean {
    return step.type === 'extract';
  }

  public async execute(step: NavigationStep, context: Record<string, any>): Promise<void> {
    const selector = this.resolveValue(step.selector, context);
    const name = step.name || 'extractedData';
    logger.info(`Extracting data from: ${selector}`);

    if (step.fields) {
      const result: Record<string, any> = {};
      for (const [fieldName, fieldDef] of Object.entries(step.fields)) {
        try {
          if (typeof fieldDef === 'object' && 'selector' in fieldDef && 'type' in fieldDef) {
            const fieldSelector = `${selector} ${fieldDef.selector}`;
            if (fieldDef.type === 'css') {
              const cssConfig = fieldDef as CssSelectorConfig;
              try {
                if (cssConfig.multiple) {
                  if ('fields' in fieldDef) {
                    result[fieldName] = await this.extractMultipleFields(
                      fieldSelector,
                      fieldDef.fields
                    );
                  } else {
                    result[fieldName] = await this.extractMultipleValues(fieldSelector, cssConfig);
                  }
                } else {
                  if ('selectors' in fieldDef && Array.isArray(fieldDef.selectors)) {
                    result[fieldName] = await this.tryMultipleSelectors(selector, fieldDef);
                  } else {
                    result[fieldName] = await this.extractSingleValue(fieldSelector, cssConfig);
                  }
                }
              } catch (error) {
                logger.warn(`Failed to extract CSS field ${fieldName}:`, error);
                result[fieldName] = null;
              }
            } else if (fieldDef.type === 'regex') {
              try {
                const extractionEngine = new ExtractionEngine();
                const regexResult = await extractionEngine.extract({
                  url: this.page.url(),
                  fields: {
                    [fieldName]: fieldDef,
                  },
                  options: {
                    browser: {
                      headless: true,
                    },
                  },
                });
                let extractedValue = regexResult?.data?.[fieldName] || null;
                // Handle both direct regex matches and string values
                if (extractedValue !== null) {
                  if (typeof extractedValue === 'object' && extractedValue.value !== undefined) {
                    // Handle structured regex result
                    extractedValue = extractedValue.value;
                  }
                  // Convert numbers in parentheses to numeric values
                  if (typeof extractedValue === 'string' && extractedValue.match(/^\(\d+\)$/)) {
                    extractedValue = Number(extractedValue.replace(/[()]/g, ''));
                  }
                }
                result[fieldName] = extractedValue;
              } catch (error) {
                logger.warn(`Failed to extract regex field ${fieldName}:`, error);
                result[fieldName] = null;
              }
            } else {
              logger.warn(`Unsupported selector type ${fieldDef.type}`);
              result[fieldName] = null;
            }
          } else {
            logger.warn('Nested extraction not fully supported');
            result[fieldName] = null;
          }
        } catch (error) {
          logger.warn(`Failed to extract field ${fieldName}:`, error);
          result[fieldName] = null;
        }
      }
      context[name] = result;
    } else if (step.list) {
      context[name] = await this.extractList(selector);
    } else if (step.source === 'html') {
      context[name] = await this.extractHtml(selector);
    } else {
      context[name] = await this.extractText(selector);
    }
  }

  // Refactored to handle mixed CSS/Regex nested fields correctly
  private async extractMultipleFields(
    selector: string,
    fields: Record<string, SelectorConfig> // Use SelectorConfig type
  ): Promise<any[]> {
    const elements = await this.page.$$(selector);
    if (!elements || elements.length === 0) {
      logger.warn(`No elements found for multiple fields selector: ${selector}`);
      return [];
    }

    const results: any[] = [];
    for (const element of elements) {
      const item: Record<string, any> = {};
      const elementHtml = await element.evaluate(el => el.outerHTML); // Get outerHTML for regex

      for (const [subFieldName, subFieldDef] of Object.entries(fields)) {
        try {
          if (subFieldDef.type === SelectorType.CSS) {
            const cssConfig = subFieldDef as CssSelectorConfig;
            if (cssConfig.multiple) {
              // Extract multiple sub-values using CSS within the element
              const attr = 'attribute' in cssConfig ? cssConfig.attribute : null;
              // Pass attr into the function scope
              item[subFieldName] = await element.$$eval(
                cssConfig.selector,
                (
                  subElements,
                  localAttr // Use localAttr inside the function
                ) =>
                  subElements.map(subEl =>
                    localAttr
                      ? subEl.getAttribute(localAttr) || ''
                      : subEl.textContent?.trim() || ''
                  ),
                attr // Pass attr here to be received as localAttr
              );
            } else {
              // Extract single sub-value using CSS within the element
              const attr = 'attribute' in cssConfig ? cssConfig.attribute : null;
              // Pass attr into the function scope
              item[subFieldName] = await element
                .$eval(
                  cssConfig.selector,
                  (
                    subEl,
                    localAttr // Use localAttr inside the function
                  ) =>
                    localAttr
                      ? subEl.getAttribute(localAttr) || ''
                      : subEl.textContent?.trim() || '',
                  attr // Pass attr here to be received as localAttr
                )
                .catch(() => null); // Handle cases where sub-selector doesn't match
            }
          } else if (subFieldDef.type === SelectorType.REGEX) {
            // Extract sub-value using Regex strategy on the element's HTML
            item[subFieldName] = await this.regexStrategy.extract(null, subFieldDef, {
              htmlContent: elementHtml,
            });
          } else {
            logger.warn(
              `Unsupported selector type "${subFieldDef.type}" in extractMultipleFields for field "${subFieldName}"`
            );
            item[subFieldName] = null;
          }
        } catch (error) {
          logger.warn(
            `Failed to extract sub-field "${subFieldName}" from element with selector "${selector}":`,
            error
          );
          item[subFieldName] = null;
        }
      }
      results.push(item);

      // Dispose element handle to free up memory
      await element.dispose();
    }
    return results;
  }

  private async extractMultipleValues(selector: string, config: CssSelectorConfig): Promise<any[]> {
    const attr = 'attribute' in config ? config.attribute : null;
    return this.page.$$eval(
      selector,
      (elements, attr) =>
        elements.map(el => (attr ? el.getAttribute(attr) || '' : el.textContent?.trim() || '')),
      attr
    );
  }

  private async tryMultipleSelectors(baseSelector: string, fieldDef: any): Promise<any> {
    for (const selectorOption of fieldDef.selectors) {
      const fullSelector = `${baseSelector} ${selectorOption}`;
      try {
        if ('attribute' in fieldDef) {
          return await this.page.$eval(
            fullSelector,
            (el, attr) => el.getAttribute(attr),
            fieldDef.attribute || ''
          );
        } else {
          return await this.page.$eval(fullSelector, el => el.textContent?.trim() || '');
        }
      } catch (error) {
        logger.debug(`Selector ${fullSelector} failed, trying next option`);
      }
    }
    return null;
  }

  private async extractSingleValue(selector: string, config: CssSelectorConfig): Promise<any> {
    if ('attribute' in config) {
      return await this.page
        .$eval(selector, (el, attr) => el.getAttribute(attr), config.attribute || '')
        .catch(() => null);
    }
    return await this.page.$eval(selector, el => el.textContent?.trim() || '').catch(() => null);
  }

  private async extractList(selector: string): Promise<string[]> {
    return this.page
      .$$eval(selector, elements => elements.map(el => el.textContent?.trim() || ''))
      .catch(() => []);
  }

  private async extractHtml(selector: string): Promise<string | null> {
    return this.page.$eval(selector, el => el.innerHTML).catch(() => null);
  }

  private async extractText(selector: string): Promise<string | null> {
    return this.page.$eval(selector, el => el.textContent?.trim() || '').catch(() => null);
  }
}
