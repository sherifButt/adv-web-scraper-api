// src/navigation/handlers/extract-step-handler.ts
import { ElementHandle, Page } from 'playwright';
import { NavigationStep } from '../types/navigation.types.js';
import { logger } from '../../utils/logger.js';
import {
  CssSelectorConfig,
  RegexSelectorConfig,
  SelectorConfig,
  SelectorType,
} from '../../types/extraction.types.js';
import { BaseStepHandler } from './base-step-handler.js';
import { RegexSelectorStrategy } from '../../extraction/selectors/regex-selector.strategy.js';
import { NavigationContext, StepResult } from '../types/navigation.types.js';

export class ExtractStepHandler extends BaseStepHandler {
  private regexStrategy = new RegexSelectorStrategy();

  public canHandle(step: NavigationStep): boolean {
    return step.type === 'extract';
  }

  public async execute(
    step: NavigationStep,
    context: NavigationContext,
    page: Page
  ): Promise<StepResult> {
    const selector = this.resolveValue(step.selector, context) as string;
    const name = step.name || 'extractedData';
    const currentItemHandle = context.currentItemHandle as ElementHandle | undefined;

    // Determine scope: Use page scope if usePageScope is true, otherwise default to element or page
    const scope = step.usePageScope ? page : currentItemHandle || page;

    logger.info(
      `Extracting data from: ${selector || 'current element'}. Scope: ${
        step.usePageScope ? 'Page' : currentItemHandle ? 'Element' : 'Page'
      }`
    );

    // --- Main Extraction Logic ---
    try {
      // Handle multiple elements extraction at top level
      if ((step as any).multiple === true && selector) {
        logger.debug(`Extracting multiple elements with selector: ${selector}`);

        // Get all elements matching the selector
        const elements = await scope.$$(selector);
        logger.debug(`Found ${elements.length} elements for extraction`);

        const results: Array<Record<string, any>> = [];

        for (const element of elements) {
          try {
            // For each element, extract based on fields or as simple value
            let itemData: any;

            if (step.fields) {
              // Extract complex object with fields
              itemData = await this.extractFieldsFromElement(element, step.fields, page);
            } else if (step.source === 'html') {
              // Extract HTML
              itemData = await element.evaluate(el => el.innerHTML);
            } else {
              // Extract text or attribute
              const config = step as CssSelectorConfig;
              const attr = config.attribute;
              itemData = await element.evaluate(
                (el, attr) => (attr ? el.getAttribute(attr) || '' : el.textContent?.trim() || ''),
                attr
              );
            }

            results.push(itemData);
          } catch (error: any) {
            logger.warn(`Error extracting data from element: ${error.message}`);
            // If continueOnError, push default or null
            if ((step as any).continueOnError) {
              results.push(
                (step as any).defaultValue !== undefined ? (step as any).defaultValue : null
              );
            }
          }

          // Dispose each element handle
          await element.dispose();
        }

        // Save the results to context
        context[name] = results;
        logger.debug(`Extracted ${results.length} items for "${name}"`);
      } else if (step.fields) {
        // Case: Extracting an object with fields (single element)
        const baseElement = selector
          ? await scope.$(selector)
          : scope !== page
          ? (scope as ElementHandle)
          : null;

        if (!baseElement && selector) {
          logger.warn(`Base element not found for field extraction: ${selector}`);
          context[name] = {};
        } else if (!baseElement && !selector && scope === page) {
          logger.error(`Cannot extract fields from page scope without a 'selector'.`);
          context[name] = {};
        } else if (baseElement) {
          context[name] = await this.extractFieldsFromElement(baseElement, step.fields, page);

          // Dispose only if we created the handle here
          if (scope === page && selector) {
            await baseElement.dispose();
          }
        } else {
          context[name] = {};
        }
      } else if (step.list && selector) {
        // Legacy support for list extraction
        logger.warn(`Direct 'list: true' extraction is deprecated. Use 'multiple: true' instead.`);

        // Handle simple list extraction (backward compatibility)
        const elements = await scope.$$(selector);
        const results: string[] = [];

        for (const element of elements) {
          try {
            const config = step as CssSelectorConfig;
            const attr = config.attribute;
            const value = await element.evaluate(
              (el, attr) => (attr ? el.getAttribute(attr) || '' : el.textContent?.trim() || ''),
              attr
            );
            results.push(value);
          } catch (error: any) {
            logger.warn(`Error extracting value from list element: ${error.message}`);
          }
          await element.dispose();
        }

        context[name] = results;
      } else if (step.source === 'html' && selector) {
        // Case: Extracting inner HTML
        context[name] = await this.extractHtml(selector, scope);
      } else if (step.type === 'regex' && selector) {
        // Case: Extracting based on regex from a specific element's HTML
        logger.debug(`Extracting regex from element: ${selector}`);
        let elementHtml: string | null = null;
        try {
          const element = await scope.$(selector);
          if (element) {
            elementHtml = await element.evaluate(el => (el as Element).outerHTML);
            await element.dispose(); // Dispose handle after getting HTML
          } else {
            logger.warn(`Element not found for regex extraction selector: ${selector}`);
          }
        } catch (err: any) {
          logger.error(`Error finding element or getting HTML for regex selector ${selector}: ${err.message}`);
          // Rethrow or handle based on continueOnError in the next block
          elementHtml = null; // Ensure html is null if element fetch failed
        }
        
        // Perform extraction using the strategy
        try {
          if (elementHtml !== null) {
            context[name] = await this.regexStrategy.extract(null, step as RegexSelectorConfig, {
              htmlContent: elementHtml,
            });
          } else {
            // If element wasn't found or HTML fetch failed
            if ((step as any).continueOnError) {
              context[name] = (step as any).defaultValue !== undefined ? (step as any).defaultValue : null;
            } else {
              throw new Error(`Element not found for selector: ${selector}`);
            }
          }
        } catch (extractError: any) {
          logger.error(`Regex extraction failed for selector ${selector}: ${extractError.message}`);
          if ((step as any).continueOnError) {
            context[name] = (step as any).defaultValue !== undefined ? (step as any).defaultValue : null;
          } else {
            throw extractError; // Rethrow critical extraction error
          }
        }
      } else if (selector) {
        // Case: Extracting single text/attribute (Default to CSS)
        context[name] = await this.extractText(selector, scope, step as CssSelectorConfig);
      } else {
        logger.warn(`Invalid extraction step configuration: No selector or fields provided.`);
        context[name] = null;
      }

      // Log completion for important extractions
      if (name === 'trendsData') {
        logger.debug(
          `Completed extraction for step "${name}":`,
          JSON.stringify(context[name], null, 2)
        );
      }

      return {};
    } catch (error: any) {
      // Top-level error handling
      logger.error(`Failed to execute extraction step: ${error.message}`);
      if ((step as any).continueOnError) {
        context[name] =
          (step as any).defaultValue !== undefined ? (step as any).defaultValue : null;
        return {};
      }
      throw error;
    }
  }

  // Extracts fields from a single provided element handle
  private async extractFieldsFromElement(
    element: ElementHandle,
    fields: Record<string, SelectorConfig | any>,
    page: Page
  ): Promise<Record<string, any>> {
    const item: Record<string, any> = {};
    // Get outerHTML once if needed for regex
    let elementHtml: string | null = null;

    // Get a simple representation of the parent element for logging
    const parentSelectorInfo = await element.evaluate(el => {
      const htmlEl = el as HTMLElement;
      return (
        (htmlEl.tagName || '') +
        (htmlEl.id ? '#' + htmlEl.id : '') +
        (htmlEl.className && typeof htmlEl.className === 'string'
          ? '.' + htmlEl.className.trim().replace(/\s+/g, '.')
          : '')
      );
    });

    logger.debug(
      `[extractFieldsFromElement] Extracting fields from element: ${parentSelectorInfo}`
    );

    for (const [subFieldName, subFieldDef] of Object.entries(fields)) {
      // Ensure subFieldDef is treated as an object
      if (typeof subFieldDef !== 'object' || subFieldDef === null) {
        logger.warn(
          `[extractFieldsFromElement] Invalid field definition for "${subFieldName}". Skipping.`
        );
        continue;
      }

      try {
        // Check for list extraction with nested fields first
        if (subFieldDef.type === SelectorType.CSS && subFieldDef.multiple && subFieldDef.fields) {
          // Handle list of complex objects
          item[subFieldName] = await this.extractListWithFields(
            subFieldDef.selector,
            element,
            subFieldDef.fields,
            page
          );

          logger.debug(
            `[extractFieldsFromElement] Extracted list with fields for "${subFieldName}" using selector "${subFieldDef.selector}"`
          );
        } else if (subFieldDef.type === SelectorType.CSS) {
          // Handle single CSS extraction (text, attribute, or simple list)
          const cssConfig = subFieldDef as CssSelectorConfig;

          if (cssConfig.multiple) {
            // Simple list (text/attribute)
            item[subFieldName] = await this.extractSimpleList(
              cssConfig.selector,
              element,
              cssConfig
            );

            logger.debug(
              `[extractFieldsFromElement] Extracted simple list for "${subFieldName}" using selector "${cssConfig.selector}"`
            );
          } else {
            // Single value (text/attribute)
            item[subFieldName] = await this.extractText(cssConfig.selector, element, cssConfig);

            logger.debug(
              `[extractFieldsFromElement] Extracted text/attribute for "${subFieldName}" using selector "${cssConfig.selector}"`
            );
          }
        } else if (subFieldDef.type === SelectorType.REGEX) {
          // Handle Regex extraction
          const regexConfig = subFieldDef as RegexSelectorConfig;
          let targetText: string | null = null;

          // Check if a selector is provided in the field definition itself
          if (subFieldDef.selector) {
            logger.debug(`[extractFieldsFromElement] Regex field "${subFieldName}" targeting child selector: "${subFieldDef.selector}"`);
            const childElement = await element.$(subFieldDef.selector);
            if (childElement) {
              targetText = await childElement.evaluate(el => el.textContent);
              await childElement.dispose();
              logger.debug(`[extractFieldsFromElement] Found child element for regex, text content length: ${targetText?.length ?? 0}`);
            } else {
              logger.warn(`[extractFieldsFromElement] Child element not found for regex selector: "${subFieldDef.selector}" within parent ${parentSelectorInfo}`);
              targetText = null;
            }
          } else {
            logger.debug(`[extractFieldsFromElement] Regex field "${subFieldName}" has no child selector, applying to parent element's outerHTML.`);
            if (elementHtml === null) {
              elementHtml = await element.evaluate(el => (el as Element).outerHTML);
            }
            targetText = elementHtml;
          }

          // Perform extraction using the strategy
          if (targetText !== null) {
            item[subFieldName] = await this.regexStrategy.extract(null, regexConfig, {
              htmlContent: targetText,
            });
            logger.debug(`[extractFieldsFromElement] Extracted regex value for "${subFieldName}"`);
          } else {
             logger.warn(`[extractFieldsFromElement] No target text found for regex field "${subFieldName}".`);
             if (subFieldDef.continueOnError) {
                 item[subFieldName] = subFieldDef.defaultValue !== undefined ? subFieldDef.defaultValue : null;
             } else {
                 throw new Error(`Child element not found for regex selector: "${subFieldDef.selector}" for field "${subFieldName}"`);
             }
          }
        } else {
          logger.warn(
            `Unsupported selector type "${subFieldDef.type}" for field "${subFieldName}"`
          );
          item[subFieldName] = null;
        }
      } catch (error: any) {
        logger.warn(`Failed to extract sub-field "${subFieldName}" from element: ${error.message}`);

        if (subFieldDef.continueOnError) {
          item[subFieldName] =
            subFieldDef.defaultValue !== undefined ? subFieldDef.defaultValue : null;
        } else {
          // If continueOnError is not true, re-throw or handle as critical failure
          throw new Error(
            `Critical extraction failure for field "${subFieldName}": ${error.message}`
          );
        }
      }
    }

    return item;
  }

  // Helper for extracting a list of complex objects with nested fields
  private async extractListWithFields(
    selector: string,
    scope: ElementHandle,
    nestedFields: Record<string, SelectorConfig | any>,
    page: Page
  ): Promise<Array<Record<string, any>>> {
    const elements = await scope.$$(selector);

    if (!elements || elements.length === 0) {
      logger.debug(`No elements found for nested list selector "${selector}" within parent scope.`);
      return [];
    }

    const results: Array<Record<string, any>> = [];

    logger.debug(
      `Extracting nested fields for ${elements.length} elements with selector "${selector}"`
    );

    for (const el of elements) {
      try {
        // Recursively call extractFieldsFromElement for each element in the list
        const nestedData = await this.extractFieldsFromElement(el, nestedFields, page);
        results.push(nestedData);
      } catch (error: any) {
        logger.warn(`Error extracting nested fields from element: ${error.message}`);
        // Skip this element on error, continue with others
      } finally {
        // Always dispose element handles we've created
        await el.dispose();
      }
    }

    return results;
  }

  // Helper for extracting a simple list (text or attribute)
  private async extractSimpleList(
    selector: string,
    scope: Page | ElementHandle,
    config: CssSelectorConfig
  ): Promise<string[]> {
    const attr = config.attribute;

    try {
      // Use $$eval for efficient extraction of simple lists
      return await scope.$$eval(
        selector,
        (elements, attr) =>
          elements.map(el => (attr ? el.getAttribute(attr) || '' : el.textContent?.trim() || '')),
        attr
      );
    } catch (error: any) {
      logger.warn(`Failed to extract simple list with selector "${selector}": ${error.message}`);

      if (config.continueOnError) {
        return config.defaultValue !== undefined ? config.defaultValue : [];
      } else {
        throw new Error(
          `Critical extraction failure for list selector "${selector}": ${error.message}`
        );
      }
    }
  }

  // Extracts inner HTML from a single element found within a scope
  private async extractHtml(selector: string, scope: Page | ElementHandle): Promise<string | null> {
    try {
      return await scope.$eval(selector, el => el.innerHTML);
    } catch (error: any) {
      logger.warn(`Failed to extract HTML with selector "${selector}": ${error.message}`);
      // Consider optional/continueOnError here if added to NavigationStep base type
      return null;
    }
  }

  // Extracts text or attribute from a single element found within a scope
  private async extractText(
    selector: string,
    scope: Page | ElementHandle,
    config: CssSelectorConfig
  ): Promise<string | null> {
    const attr = config.attribute;

    try {
      // --- Handle "self" selector --- 
      if (selector === 'self') {
         // Use a more robust type guard to check if scope is ElementHandle
         // Check for a method unique to ElementHandle, e.g., 'evaluateHandle' or use instanceof if possible
         // For simplicity, let's check if it's NOT a Page by checking for a Page-specific method like 'goto'
        if (typeof (scope as any).goto === 'function') { // Check if it behaves like a Page
          logger.warn(`'self' selector cannot be used with Page scope directly. Requires an element scope.`);
          if (config.continueOnError) {
              return config.defaultValue !== undefined ? String(config.defaultValue) : null;
          }
          throw new Error("'self' selector used incorrectly with Page scope.");
        } else {
            // Type assertion to help TypeScript understand scope is ElementHandle here
            const elementScope = scope as ElementHandle;
            return await elementScope.evaluate(
                (el: Element, attrValue?: string) => // Add types for el and attrValue
                attrValue ? el.getAttribute(attrValue) || '' : el.textContent?.trim() || '',
                attr // Pass attr as the argument to the callback
            );
        }
      } else {
        // --- Handle standard selectors --- 
        return await scope.$eval(
          selector,
          (el: Element, attrValue?: string) => // Add types for el and attrValue
            attrValue ? el.getAttribute(attrValue) || '' : el.textContent?.trim() || '',
          attr // Pass attr as the argument to the callback
        );
      }
    } catch (error: any) {
      // Log slightly differently based on selector type for clarity
      const failureType = selector === 'self' ? 'evaluate self' : 'find/evaluate selector';
      logger.warn(
        `Failed to ${failureType} "${selector}": ${error.message?.split('\n')[0]}` // Log concise error
      );

      if (config.continueOnError) {
        return config.defaultValue !== undefined ? String(config.defaultValue) : null;
      } else {
        // Re-throw a more specific error for critical failures
        throw new Error(
          `Critical extraction failure for selector "${selector}": ${error.message}`
        );
      }
    }
  }
}
