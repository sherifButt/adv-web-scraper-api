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
// ExtractionEngine might not be needed if we scope to element handles
// import { ExtractionEngine } from '../../extraction/extraction-engine.js';
import { RegexSelectorStrategy } from '../../extraction/selectors/regex-selector.strategy.js';
import { NavigationContext, StepResult } from '../types/navigation.types.js';

export class ExtractStepHandler extends BaseStepHandler {
  private regexStrategy = new RegexSelectorStrategy();

  public canHandle(step: NavigationStep): boolean {
    // Added newline based on eslint error
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
    ); // Removed trailing comma and adjusted newline based on eslint error

    // --- Main Extraction Logic ---
    // The primary extraction happens based on the top-level step definition
    // It populates context[name]
    if (step.fields) {
      // Case 1: Extracting an object with multiple fields
      const baseElement = selector
        ? await scope.$(selector)
        : // If no selector, and scope is an element handle, use the handle itself as base
        scope !== page
        ? (scope as ElementHandle)
        : null; // Cannot extract fields from page without a base selector

      if (!baseElement && selector) {
        // Only warn if a selector was provided but not found
        logger.warn(`Base element not found for field extraction: ${selector}`);
        context[name] = {};
      } else if (!baseElement && !selector && scope === page) {
        // Error if trying to extract fields from page without a selector
        logger.error(`Cannot extract fields from page scope without a 'selector'.`);
        context[name] = {};
      } else if (baseElement) {
        // Proceed with extraction from the found/provided base element
        context[name] = await this.extractFieldsFromElement(baseElement, step.fields, page); // Pass page
        // Dispose only if we created the handle here (i.e., scope was page and selector was used)
        if (scope === page && selector) {
          await baseElement.dispose();
        }
      } else {
        // Should not happen if logic above is correct, but default to empty
        context[name] = {};
      } // Removed extra indentation based on eslint error
    } else if (step.list && selector) {
      // Case 2: Extracting a list (simple or complex) - requires a selector
      // Note: step.list is a boolean flag, not the list definition itself.
      // The structure for list extraction is defined within step.fields usually.
      // This branch might need reconsideration based on how list extraction is defined.
      // Assuming step.list implies extracting an array based on step.selector directly.
      // This conflicts with the nested 'news' example. Let's comment out for now
      // and rely on extractFieldsFromElement handling 'multiple'.
      // context[name] = await this.extractList(selector, scope, step as CssSelectorConfig, page); // Pass page
      logger.warn(
        `Direct 'list: true' extraction at top level is ambiguous. Define lists within 'fields' using 'multiple: true'.`
      );
      context[name] = [];
    } else if (step.source === 'html' && selector) {
      // Case 3: Extracting inner HTML - requires a selector
      context[name] = await this.extractHtml(selector, scope);
    } else if (selector) {
      // Case 4: Extracting single text/attribute - requires a selector
      context[name] = await this.extractText(selector, scope, step as CssSelectorConfig);
    } else {
      // Case 5: No selector and not field extraction from element handle - Invalid state?
      logger.warn(`Invalid extraction step configuration: No selector or fields provided.`);
      context[name] = null;
    }

    // Log the extracted data if it's the main trendsData step
    if (name === 'trendsData') {
      logger.debug(
        `Completed extraction for step "${name}":`,
        JSON.stringify(context[name], null, 2)
      );
    }

    return {};
  }

  // Extracts fields from a single provided element handle
  private async extractFieldsFromElement(
    element: ElementHandle,
    // Field definitions can include nested structures
    fields: Record<string, SelectorConfig | any>, // Use 'any' for flexibility with nested fields
    page: Page // Pass page object for potential recursive calls needing page scope
  ): Promise<Record<string, any>> {
    // Added newline based on eslint error
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
            element, // Scope is the current element
            subFieldDef.fields,
            page // Pass page down
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
          if (elementHtml === null) {
            elementHtml = await element.evaluate(el => (el as Element).outerHTML);
          }
          item[subFieldName] = await this.regexStrategy.extract(null, subFieldDef, {
            htmlContent: elementHtml,
          });
          logger.debug(`[extractFieldsFromElement] Extracted regex for "${subFieldName}"`);
        } else {
          logger.warn(
            `Unsupported selector type "${subFieldDef.type}" for field "${subFieldName}"`
          );
          item[subFieldName] = null;
        }
      } catch (error: any) {
        logger.warn(`Failed to extract sub-field "${subFieldName}" from element: ${error.message}`); // Fixed formatting based on eslint error
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
    scope: ElementHandle, // Should always be an element for nested lists
    nestedFields: Record<string, SelectorConfig | any>,
    page: Page
  ): Promise<Array<Record<string, any>>> {
    // Added newline based on eslint error
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
      // Recursively call extractFieldsFromElement for each element in the list
      // Pass the nestedFields definition and the page object
      const nestedData = await this.extractFieldsFromElement(el, nestedFields, page);
      results.push(nestedData);
      // Do not dispose 'el' here, it belongs to the 'scope' ElementHandle
    }
    // Handles are managed by the caller that provided the 'scope' ElementHandle
    return results;
  }

  // Helper for extracting a simple list (text or attribute)
  private async extractSimpleList(
    selector: string,
    scope: Page | ElementHandle,
    config: CssSelectorConfig
  ): Promise<string[]> {
    // Added newline based on eslint error
    const attr = config.attribute;
    try {
      // Use $$eval for efficient extraction of simple lists
      return await scope.$$eval(
        selector,
        (elements, attr) =>
          elements.map(el => (attr ? el.getAttribute(attr) || '' : el.textContent?.trim() || '')), // Fixed formatting based on eslint error
        attr // Pass attr to page context
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
    // Fixed formatting based on eslint error
    try {
      return await scope.$eval(selector, el => el.innerHTML);
    } catch (error: any) {
      logger.warn(`Failed to extract HTML with selector "${selector}": ${error.message}`);
      // Consider optional/continueOnError here if added to NavigationStep base type
      return null; // Return null on error for now
    }
  }

  // Extracts text or attribute from a single element found within a scope
  private async extractText(
    selector: string,
    scope: Page | ElementHandle,
    config: CssSelectorConfig // Config might have optional/continueOnError
  ): Promise<string | null> {
    const attr = config.attribute;
    try {
      return await scope.$eval(
        selector,
        (el, attr) => (attr ? el.getAttribute(attr) || '' : el.textContent?.trim() || ''),
        attr // Pass attr to page context
      );
    } catch (error: any) {
      logger.warn(`Failed to extract text/attribute with selector "${selector}": ${error.message}`);
      if (config.continueOnError) {
        return config.defaultValue !== undefined ? config.defaultValue : null;
      } else {
        throw new Error(`Critical extraction failure for selector "${selector}": ${error.message}`); // Fixed formatting based on eslint error
      }
    }
  }
}
