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

  // --- Start: Helper functions for selector fallbacks ---

  private async trySelectors<T>(
    scope: Page | ElementHandle,
    selectorOrArray: string | string[],
    operation: (sel: string) => Promise<T | null | undefined>, // Generic operation like scope.$(sel) or scope.$eval(sel, ...)
    pageForContext: Page // Add page parameter for logging context
  ): Promise<T | null> {
    const selectors = Array.isArray(selectorOrArray) ? selectorOrArray.filter(s => s) : [selectorOrArray].filter(s => s); // Ensure array and remove empty strings
    if (selectors.length === 0) {
        logger.warn('No valid selectors provided.');
        return null;
    }

    for (const selector of selectors) {
      try {
        const result = await operation(selector);
        // Check if the operation was successful (found element/s or got a value)
        // null/undefined usually indicates failure for Playwright find operations ($/$$eval return null/throw on failure)
        // empty array indicates failure for $$
        if (result !== null && result !== undefined && (!Array.isArray(result) || result.length > 0)) {
          logger.debug(`Successfully used selector "${selector}"`);
          return result; // Return the first successful result
        }
         logger.debug(`Selector "${selector}" did not yield a result.`);
      } catch (error: any) {
        // Ignore errors like TimeoutError if the selector just wasn't found,
        // log other potential errors (like syntax errors).
        if (error.name !== 'TimeoutError' && !error.message?.includes('failed to find element') && !error.message?.includes('strict mode violation')) {
           logger.warn(`Error testing selector "${selector}": ${error.message?.split('\n')[0]}`);
        } else {
           // Log selector failure at debug level if it's just not found
           logger.debug(`Selector "${selector}" failed or not found: ${error.message?.split('\n')[0]}`);
        }

        // --- Add Enhanced Logging on Failure ---
        // Log screenshot and HTML snippet only on the *first* selector failure for this operation, to avoid spamming
        if (selector === selectors[0]) { // Only log context for the first attempted selector
            try {
                 // Use the page object passed into the helper
                 const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
                 const screenshotPath = `error_screenshot_selector_${timestamp}.png`;
                 await pageForContext.screenshot({ path: screenshotPath, fullPage: true }); // Use pageForContext
                 logger.warn(`Selector "${selector}" failed. Screenshot saved to: ${screenshotPath}`);

                 // Log HTML snippet
                let htmlSnippet = '';
                 // Use a simpler check for ElementHandle vs Page (does it have evaluate?)
                 const isElement = 'evaluate' in scope && typeof scope.evaluate === 'function';

                if (isElement) { // Check if scope is ElementHandle
                    try {
                         htmlSnippet = await (scope as ElementHandle).evaluate((el: Element) => el.outerHTML.substring(0, 1000));
                         logger.warn(`Selector "${selector}" failed within element scope. Parent HTML snippet (approx 1000 chars):\n${htmlSnippet}`);
                    } catch (snippetError: any) {
                         logger.warn(`Could not get HTML snippet for element scope: ${snippetError.message}`);
                    }
                } else if ('content' in scope && typeof scope.content === 'function') { // Check if scope is Page
                    try {
                        const pageContent = await scope.content();
                        htmlSnippet = pageContent.substring(0, 2000);
                        logger.warn(`Selector "${selector}" failed within page scope. Page HTML snippet (approx 2000 chars):\n${htmlSnippet}`);
                    } catch (snippetError: any) {
                         logger.warn(`Could not get HTML snippet for page scope: ${snippetError.message}`);
                    }
                }
            } catch (logError: any) {
                logger.error(`Failed to capture debug context (screenshot/HTML) on selector failure: ${logError.message}`);
            }
        }
        // --- End Enhanced Logging ---
      }
    }
    logger.warn(`None of the selectors worked: ${JSON.stringify(selectors)}`);
    return null; // Return null if none of the selectors worked
  }


  // Specific helpers for common operations

  private async findFirst(scope: Page | ElementHandle, selectorOrArray: string | string[], pageForContext: Page): Promise<ElementHandle | null> {
      return this.trySelectors(scope, selectorOrArray, (sel) => scope.$(sel), pageForContext);
  }

  private async findAll(scope: Page | ElementHandle, selectorOrArray: string | string[], pageForContext: Page): Promise<ElementHandle[]> {
      const result = await this.trySelectors<ElementHandle[]>(scope, selectorOrArray, (sel) => scope.$$(sel), pageForContext);
      return result ?? []; // Return empty array if null
  }

  private async evalFirst<R>(scope: Page | ElementHandle, selectorOrArray: string | string[], pageFunction: (element: Element | SVGElement) => R, pageForContext: Page, arg?: any): Promise<R | null> {
      return this.trySelectors<R>(scope, selectorOrArray, (sel) => scope.$eval(sel, pageFunction as any, arg), pageForContext); // Cast needed due to Playwright's complex types
  }

  // $$eval is tricky with fallbacks as it needs the *one* selector that works.
  // We find all elements first using the fallback logic, then use $$eval if elements are found.
  private async evalAll<R>(scope: Page | ElementHandle, selectorOrArray: string | string[], pageFunction: (elements: (Element | SVGElement)[]) => R, pageForContext: Page, arg?: any): Promise<R | null> {
       // Use findAll which incorporates the fallback logic
      const elements = await this.findAll(scope, selectorOrArray, pageForContext);
      if (elements.length > 0) {
          // Find *which* selector succeeded to pass to $$eval
          const successfulSelector = await this.findSuccessfulSelector(scope, selectorOrArray);
          if (!successfulSelector) {
               logger.warn(`Could not determine successful selector for $$eval despite finding elements with: ${JSON.stringify(selectorOrArray)}`);
              return null;
          }

          try {
               // Use the single successful selector with $$eval
               // Note: $$eval might still fail if elements disappear between findAll and $$eval
               logger.debug(`Using successful selector "${successfulSelector}" for $$eval`);
               return await scope.$$eval(successfulSelector, pageFunction as any, arg);
           } catch (error: any) {
                logger.warn(`Error during $$eval for selector "${successfulSelector}": ${error.message}`);
                return null; // Treat eval error as failure
           }

      } else {
          // This case is already handled by trySelectors within findAll, but log for clarity
          logger.warn(`No elements found for any selector in $$eval context: ${JSON.stringify(selectorOrArray)}`);
          return null;
      }
  }

  // Helper to find which selector actually worked for findAll (needed for $$eval)
  private async findSuccessfulSelector(scope: Page | ElementHandle, selectorOrArray: string | string[]): Promise<string | null> {
      const selectors = Array.isArray(selectorOrArray) ? selectorOrArray.filter(s => s) : [selectorOrArray].filter(s => s);
      for (const selector of selectors) {
          try {
              // Use waitForSelector with a short timeout as a quick check
              await scope.waitForSelector(selector, { state: 'attached', timeout: 50 }); // Very short timeout
              const result = await scope.$$(selector); // Double-check with $$
              if (result.length > 0) {
                   // Dispose handles created by $$ check if not needed
                   await Promise.all(result.map(h => h.dispose()));
                  return selector;
              }
          } catch { /* Ignore timeouts, selector not found */ }
      }
      return null;
  }

  // --- End: Helper functions ---

  // --- Start: Enhanced Wait Helper ---
  private async handleEnhancedWaits(step: NavigationStep, page: Page): Promise<void> {
    try {
      // 1. Wait for Network Idle if requested
      if (step.waitForNetworkIdle) {
        const timeout = step.networkIdleTimeout ?? 30000; // Default 30s
        logger.debug(`Waiting for network idle (timeout: ${timeout}ms)...`);
        await page.waitForLoadState('networkidle', { timeout });
        logger.debug('Network is idle.');
      }

      // 2. Wait for Selector State if requested (and if a selector exists for the step)
      // Resolve selector value if needed
      // Note: Assuming context isn't needed here, might need adjustment if selector is dynamic
      const selectorOrArray = typeof step.selector === 'function' ? step.selector() : step.selector;
      if (step.waitForState && selectorOrArray) {
         // Use the *first* selector if it's an array for the state wait
        const primarySelector = Array.isArray(selectorOrArray) ? selectorOrArray[0] : selectorOrArray;
        if (primarySelector) {
            const timeout = step.timeout ?? 30000; // Use step timeout or default
             logger.debug(`Waiting for selector "${primarySelector}" to reach state "${step.waitForState}" (timeout: ${timeout}ms)...`);
             await page.waitForSelector(primarySelector, {
                state: step.waitForState,
                timeout: timeout,
             });
             logger.debug(`Selector "${primarySelector}" reached state "${step.waitForState}".`);
        } else {
             logger.warn('waitForState requested, but no valid primary selector found to wait for.');
        }
      }
    } catch (error: any) {
      logger.error(`Error during enhanced wait: ${error.message}`, { error });
      // Decide if this error should stop the flow or just be logged
      // Re-throwing here would stop the step execution
      throw new Error(`Enhanced wait failed: ${error.message}`);
    }
  }
  // --- End: Enhanced Wait Helper ---


  public async execute(
    step: NavigationStep,
    context: NavigationContext,
    page: Page
  ): Promise<StepResult> {
     // --- Call Enhanced Wait Helper at the beginning ---
     await this.handleEnhancedWaits(step, page);
     // ---------------------------------------------------

    // Resolve selector value if needed (assuming it resolves to string | string[])
    const selectorOrArray = this.resolveValue(step.selector, context) as string | string[];
    const name = step.name || 'extractedData';
    const currentItemHandle = context.currentItemHandle as ElementHandle | undefined;

    // Determine scope: Use page scope if usePageScope is true, otherwise default to element or page
    const scope = step.usePageScope ? page : currentItemHandle || page;

    logger.info(
      `Extracting data from: ${JSON.stringify(selectorOrArray) || 'current element'}. Scope: ${
        step.usePageScope ? 'Page' : currentItemHandle ? 'Element' : 'Page'
      }`
    );

    // --- Main Extraction Logic ---
    try {
      // Handle multiple elements extraction at top level
      if ((step as any).multiple === true && selectorOrArray) {
        logger.debug(`Extracting multiple elements with selector(s): ${JSON.stringify(selectorOrArray)}`);

        // Use helper function to get elements
        const elements = await this.findAll(scope, selectorOrArray, page); // Pass page
        logger.debug(`Found ${elements.length} elements for extraction`);

        const results: Array<Record<string, any>> = [];

        for (const element of elements) {
          try {
            // For each element, extract based on fields or as simple value
            let itemData: any;

            if (step.fields) {
              // Extract complex object with fields - PASS THE ELEMENT DIRECTLY
              itemData = await this.extractFieldsFromElement(element, step.fields, page);
            } else if (step.source === 'html') {
              // Extract HTML
              itemData = await element.evaluate(el => (el as Element).innerHTML);
            } else {
              // Extract text or attribute
              const config = step as CssSelectorConfig;
              const attr = config.attribute;
              itemData = await element.evaluate(
                (el, attrVal) => (attrVal ? (el as Element).getAttribute(attrVal) || '' : el.textContent?.trim() || ''), // Cast el
                attr
              );
            }

            results.push(itemData);
          } catch (error: any) {
            logger.warn(`Error extracting data from one of the multiple elements: ${error.message}`);
            // If continueOnError, push default or null
            if ((step as any).continueOnError) {
              results.push(
                (step as any).defaultValue !== undefined ? (step as any).defaultValue : null
              );
            }
             // Decide if we should dispose the handle here or let the loop handle it.
             // If continueOnError is false, the loop might break, handle should be disposed.
             // If true, the loop continues. Let's dispose at the end of the loop iteration.
          }

          // Dispose element handle after processing it
           try {
             await element.dispose();
           } catch (disposeError: any) {
              logger.warn(`Error disposing element handle: ${disposeError.message}`);
           }
        }

        // Save the results to context
        context[name] = results;
        logger.debug(`Extracted ${results.length} items for "${name}"`);
      } else if (step.fields) {
        // Case: Extracting an object with fields (single element or page scope)
        const baseElement = selectorOrArray
          ? await this.findFirst(scope, selectorOrArray, page) // Pass page
          : scope !== page
          ? (scope as ElementHandle) // Use existing element scope
          : null; // Page scope without selector

        if (!baseElement && selectorOrArray) {
          // Log warning if selectors were provided but none worked
           logger.warn(`Base element not found for field extraction using selector(s): ${JSON.stringify(selectorOrArray)}`);
          context[name] = {}; // Default to empty object as per original logic
        } else if (!baseElement && !selectorOrArray && scope === page) {
          // Error only if page scope AND no selector provided
          logger.error(`Cannot extract fields from page scope without a 'selector'.`);
          context[name] = {}; // Default to empty object
        } else if (baseElement) {
           // Base element found (either via selector or passed in scope)
          context[name] = await this.extractFieldsFromElement(baseElement, step.fields, page);

          // Dispose only if we created the handle here (i.e., found via selector from page scope)
          if (scope === page && selectorOrArray) {
             try {
               await baseElement.dispose();
             } catch (disposeError: any) {
                logger.warn(`Error disposing base element handle: ${disposeError.message}`);
             }
          }
        } else {
          // Catch-all for unexpected cases? Or just page scope without selector handled above.
          context[name] = {};
        }
      } else if (step.list && selectorOrArray) {
        // Legacy support for list extraction
        logger.warn(`Direct 'list: true' extraction is deprecated. Use 'multiple: true' instead.`);

        // Handle simple list extraction (backward compatibility)
        const elements = await this.findAll(scope, selectorOrArray, page); // Pass page
        const results: string[] = [];

        for (const element of elements) {
          try {
            const config = step as CssSelectorConfig;
            const attr = config.attribute;
            const value = await element.evaluate(
              (el, attrVal) => (attrVal ? (el as Element).getAttribute(attrVal) || '' : el.textContent?.trim() || ''), // Cast el
              attr
            );
            results.push(value);
          } catch (error: any) {
            logger.warn(`Error extracting value from list element: ${error.message}`);
          }
           try {
             await element.dispose();
           } catch (disposeError: any) {
             logger.warn(`Error disposing legacy list element handle: ${disposeError.message}`);
           }
        }

        context[name] = results;
      } else if (step.source === 'html' && selectorOrArray) {
        // Case: Extracting inner HTML
        context[name] = await this.extractHtml(selectorOrArray, scope, page); // Pass page
      } else if (step.type === 'regex' && selectorOrArray) {
        // Case: Extracting based on regex from a specific element's HTML
        logger.debug(`Extracting regex from element found by selector(s): ${JSON.stringify(selectorOrArray)}`);
        let elementHtml: string | null = null;
        const element = await this.findFirst(scope, selectorOrArray, page); // Pass page

        if (element) {
           try {
              elementHtml = await element.evaluate(el => (el as Element).outerHTML);
           } catch (evalError: any) {
                logger.error(`Error evaluating element's outerHTML for regex: ${evalError.message}`);
               elementHtml = null;
           } finally {
               try {
                 await element.dispose(); // Dispose handle after getting HTML or on error
               } catch (disposeError: any) {
                 logger.warn(`Error disposing regex target element handle: ${disposeError.message}`);
               }
           }
        } else {
          logger.warn(`Element not found for regex extraction using selector(s): ${JSON.stringify(selectorOrArray)}`);
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
              throw new Error(`Element not found or failed to get HTML for regex extraction using selector(s): ${JSON.stringify(selectorOrArray)}`);
            }
          }
        } catch (extractError: any) {
          logger.error(`Regex extraction failed for source selector(s) ${JSON.stringify(selectorOrArray)}: ${extractError.message}`);
          if ((step as any).continueOnError) {
            context[name] = (step as any).defaultValue !== undefined ? (step as any).defaultValue : null;
          } else {
            throw extractError; // Rethrow critical extraction error
          }
        }
      } else if (selectorOrArray) {
        // Case: Extracting single text/attribute (Default to CSS)
        context[name] = await this.extractText(selectorOrArray, scope, step as CssSelectorConfig, page); // Pass page
      } else {
        // Handle case where step has no selector or fields
        logger.warn(`Invalid extraction step configuration: No selector or fields provided for step "${name}".`);
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
      // Top-level error handling for the whole execute method
      logger.error(`Failed to execute extraction step "${name}": ${error.message}`, { error }); // Log full error object
      if ((step as any).continueOnError) {
        context[name] =
          (step as any).defaultValue !== undefined ? (step as any).defaultValue : null;
        return {}; // Suppress error and return empty result
      }
      throw error; // Rethrow if not continueOnError
    }
  }

  // Extracts fields from a single provided element handle
  private async extractFieldsFromElement(
    element: ElementHandle,
    fields: Record<string, SelectorConfig | any>, // Assuming NestedExtractionConfig handled elsewhere
    page: Page // Keep page context if needed for Function selectors maybe?
  ): Promise<Record<string, any>> {
    const item: Record<string, any> = {};
    // Get outerHTML once if needed for regex - only if regex field exists without its own selector
    let elementHtml: string | null = null;
    const needsOuterHtml = Object.values(fields).some(f => f.type === SelectorType.REGEX && !f.selector);


    // Get a simple representation of the parent element for logging
    let parentSelectorInfo = 'unknown';
    try {
      parentSelectorInfo = await element.evaluate(el => {
        const htmlEl = el as HTMLElement;
        return (
          (htmlEl.tagName || '') +
          (htmlEl.id ? '#' + htmlEl.id : '') +
          (htmlEl.className && typeof htmlEl.className === 'string'
            ? '.' + htmlEl.className.trim().replace(/\s+/g, '.')
            : '')
        );
      });
    } catch (evalError: any) {
       logger.warn(`Could not evaluate parent element info: ${evalError.message}`);
       // Element might have been detached already
    }

    logger.debug(
      `[extractFieldsFromElement] Extracting fields from element: ${parentSelectorInfo}`
    );

    for (const [subFieldName, subFieldDef] of Object.entries(fields)) {
      // Ensure subFieldDef is treated as an object with properties we expect
      if (typeof subFieldDef !== 'object' || subFieldDef === null || !subFieldDef.type) {
        logger.warn(
          `[extractFieldsFromElement] Invalid or incomplete field definition for "${subFieldName}" in parent ${parentSelectorInfo}. Skipping. Definition: ${JSON.stringify(subFieldDef)}`
        );
        continue;
      }

      try {
        // Check for list extraction with nested fields first
        // Assuming NestedExtractionConfig is handled by checking 'fields' property
        if (subFieldDef.fields && subFieldDef.selector && subFieldDef.multiple) {
          // Handle list of complex objects
          item[subFieldName] = await this.extractListWithFields(
            subFieldDef.selector, // Pass selector array/string
            element, // Scope is the current element
            subFieldDef.fields,
            page
          );

          logger.debug(
            `[extractFieldsFromElement] Extracted list with fields for "${subFieldName}" using selector(s) "${JSON.stringify(subFieldDef.selector)}"`
          );
        } else if (subFieldDef.type === SelectorType.CSS && subFieldDef.selector) {
           // Handle single CSS extraction (text, attribute, or simple list)
          const cssConfig = subFieldDef as CssSelectorConfig; // Now includes string | string[] selector

          if (cssConfig.multiple) {
            // Simple list (text/attribute)
            item[subFieldName] = await this.extractSimpleList(
              cssConfig.selector, // Pass selector array/string
              element, // Scope is the current element
              cssConfig,
              page
            );

            logger.debug(
              `[extractFieldsFromElement] Extracted simple list for "${subFieldName}" using selector(s) "${JSON.stringify(cssConfig.selector)}"`
            );
          } else {
            // Single value (text/attribute)
            item[subFieldName] = await this.extractText(
                cssConfig.selector, // Pass selector array/string
                element, // Scope is the current element
                cssConfig,
                page
            );

            logger.debug(
              `[extractFieldsFromElement] Extracted text/attribute for "${subFieldName}" using selector(s) "${JSON.stringify(cssConfig.selector)}"`
            );
          }
        } else if (subFieldDef.type === SelectorType.REGEX) {
          // Handle Regex extraction
          const regexConfig = subFieldDef as RegexSelectorConfig;
          let targetText: string | null = null;
          let childElement: ElementHandle | null = null; // Define here for disposal

          // Check if a selector is provided in the field definition itself
          if (subFieldDef.selector) {
            logger.debug(`[extractFieldsFromElement] Regex field "${subFieldName}" targeting child selector(s): "${JSON.stringify(subFieldDef.selector)}"`);
            childElement = await this.findFirst(element, subFieldDef.selector, page); // Use helper

            if (childElement) {
               try {
                  targetText = await childElement.evaluate(el => el.textContent);
                  logger.debug(`[extractFieldsFromElement] Found child element for regex, text content length: ${targetText?.length ?? 0}`);
               } catch (evalError: any) {
                   logger.warn(`[extractFieldsFromElement] Error evaluating text content of child element for regex: ${evalError.message}`);
                   targetText = null;
               } finally {
                   if (childElement) {
                     try { await childElement.dispose(); } catch (e: any) { logger.warn(`Error disposing child regex element handle: ${e.message}`); }
                   }
               }
            } else {
              logger.warn(`[extractFieldsFromElement] Child element not found for regex selector(s): "${JSON.stringify(subFieldDef.selector)}" within parent ${parentSelectorInfo}`);
              targetText = null;
            }
          } else {
            // No child selector for regex, use parent's outerHTML
            logger.debug(`[extractFieldsFromElement] Regex field "${subFieldName}" has no child selector, applying to parent element's outerHTML.`);
            if (needsOuterHtml && elementHtml === null) { // Only evaluate if needed and not already done
               try {
                  elementHtml = await element.evaluate(el => (el as Element).outerHTML); // Cast el
               } catch (evalError: any) {
                   logger.warn(`[extractFieldsFromElement] Error evaluating outerHTML for regex: ${evalError.message}`);
                   elementHtml = null; // Ensure it's null on error
               }
            }
            targetText = elementHtml; // Use potentially null value
          }

          // Perform extraction using the strategy
          if (targetText !== null) {
             try {
                 item[subFieldName] = await this.regexStrategy.extract(null, regexConfig, {
                    htmlContent: targetText,
                 });
                 logger.debug(`[extractFieldsFromElement] Extracted regex value for "${subFieldName}"`);
             } catch (regexError: any) {
                 logger.error(`[extractFieldsFromElement] Regex extraction execution failed for "${subFieldName}": ${regexError.message}`);
                 // Check continueOnError for the specific field config
                 if (subFieldDef.continueOnError) {
                     item[subFieldName] = subFieldDef.defaultValue !== undefined ? subFieldDef.defaultValue : null;
                 } else {
                     throw regexError; // Re-throw if extraction itself fails critically
                 }
             }
          } else {
             // Target text was null (e.g., child selector failed, or outerHTML failed)
             logger.warn(`[extractFieldsFromElement] No target text found for regex field "${subFieldName}".`);
             if (subFieldDef.continueOnError) {
                 item[subFieldName] = subFieldDef.defaultValue !== undefined ? subFieldDef.defaultValue : null;
             } else {
                 // Throw error if target text is missing and not continuing on error
                 throw new Error(`Could not find target text/element for regex field "${subFieldName}" with selector(s) ${JSON.stringify(subFieldDef.selector)}`);
             }
          }
        } else if (subFieldDef.type === SelectorType.XPATH && subFieldDef.selector) {
             // Handle XPath - Assuming extractText and extractSimpleList primarily use CSS $/$$,
             // REMOVING placeholder XPath logic as it was incomplete and causing type issues.
             logger.warn(`[extractFieldsFromElement] XPath selectors are not currently supported with fallback logic in field extraction for "${subFieldName}". Skipping.`);
             if (subFieldDef.continueOnError) {
                item[subFieldName] = subFieldDef.defaultValue !== undefined ? subFieldDef.defaultValue : null;
             } else {
                 // Set to null, outer layers handle required checks if necessary
                item[subFieldName] = null;
                 // Potentially throw: throw new Error(`Unsupported XPath selector for required field ${subFieldName}`);
             }
        } else {
           // Covers cases like Function selectors or invalid types/missing selectors
          logger.warn(
            `[extractFieldsFromElement] Unsupported or incomplete configuration for field "${subFieldName}". Type: ${subFieldDef.type}, Selector: ${JSON.stringify(subFieldDef.selector)}`
          );
           // Apply default value logic based on continueOnError
          if (subFieldDef.continueOnError) {
            item[subFieldName] = subFieldDef.defaultValue !== undefined ? subFieldDef.defaultValue : null;
          } else {
             // If not continuing, treat as null or potentially throw an error if the field is mandatory?
             // For now, set to null to avoid breaking the loop, but a mandatory check could happen later.
             item[subFieldName] = null;
             // Consider throwing if subFieldDef.required is true?
             // throw new Error(`Unsupported/incomplete configuration for required field "${subFieldName}"`);
          }
        }
      } catch (error: any) {
         // Catch errors from the try block (e.g., critical extraction failures re-thrown)
        logger.error(`Failed to extract sub-field "${subFieldName}" from element ${parentSelectorInfo}: ${error.message}`, { error });

        // Apply default value logic based on continueOnError at the field level
        if (subFieldDef.continueOnError) {
          item[subFieldName] =
            subFieldDef.defaultValue !== undefined ? subFieldDef.defaultValue : null;
        } else {
          // If continueOnError is not true for the field, re-throw to stop processing this parent element's fields.
          // The outer execute method's catch block will handle based on the step's continueOnError.
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
    selectorOrArray: string | string[], // Accept array
    scope: ElementHandle,
    nestedFields: Record<string, SelectorConfig | any>,
    page: Page
  ): Promise<Array<Record<string, any>>> {
    // Use helper to find elements
    const elements = await this.findAll(scope, selectorOrArray, page);

    if (elements.length === 0) {
      // Warning already logged by findAll/trySelectors if no selectors worked
      return [];
    }

    const results: Array<Record<string, any>> = [];

    logger.debug(
      `Extracting nested fields for ${elements.length} elements found by selector(s) "${JSON.stringify(selectorOrArray)}"`
    );

    for (const el of elements) {
      try {
        // Recursively call extractFieldsFromElement for each element in the list
        const nestedData = await this.extractFieldsFromElement(el, nestedFields, page);
        results.push(nestedData);
      } catch (error: any) {
        // Log error from processing one element, but continue with others in the list
        logger.warn(`Error extracting nested fields from one element in the list: ${error.message}`);
        // Optionally push a default/error object based on config? For now, just skip.
      } finally {
        // Always dispose element handles we've created within this loop
         try {
            await el.dispose();
         } catch (disposeError: any) {
             logger.warn(`Error disposing nested list element handle: ${disposeError.message}`);
         }
      }
    }

    return results;
  }

  // Helper for extracting a simple list (text or attribute)
  private async extractSimpleList(
    selectorOrArray: string | string[], // Accept array
    scope: Page | ElementHandle,
    config: CssSelectorConfig,
    pageForContext: Page // Add page parameter
  ): Promise<string[]> {
    const attr = config.attribute;

    try {
      // Use evalAll helper which handles fallbacks and $$eval logic
      const result = await this.evalAll<string[]>(
        scope,
        selectorOrArray,
        (elements: Element[], attrVal?: string) => // Correct signature and types
          elements.map((el: Element) => (attrVal ? el.getAttribute(attrVal) || '' : el.textContent?.trim() || '')),
        pageForContext, // Pass page
        attr // Pass attribute as argument
      );

      // evalAll returns null on failure, return default or empty array
      if (result === null) {
          logger.warn(`evalAll failed for simple list selector(s) "${JSON.stringify(selectorOrArray)}"`);
          if (config.continueOnError) {
             return config.defaultValue !== undefined ? config.defaultValue : [];
          } else {
              throw new Error(`Critical extraction failure for list selector(s) "${JSON.stringify(selectorOrArray)}"`);
          }
      }
      return result;

    } catch (error: any) {
       // Catch potential re-throw from evalAll or other unexpected errors
      logger.error(`Unexpected error in extractSimpleList for selector(s) "${JSON.stringify(selectorOrArray)}": ${error.message}`);
      if (config.continueOnError) {
        return config.defaultValue !== undefined ? config.defaultValue : [];
      } else {
        // --- Format and Re-throw Specific Error ---
        let specificError: Error;
        const conciseErrorMessage = error.message?.split('\n')[0];
        const selectorString = JSON.stringify(selectorOrArray);

        if (error.name === 'TimeoutError' || conciseErrorMessage?.includes('waiting for selector')) {
            specificError = new Error(`SelectorTimeoutError: Failed waiting for list selector ${selectorString}: ${conciseErrorMessage}`);
        } else if (conciseErrorMessage?.includes('invalid selector') || conciseErrorMessage?.includes('syntax error')) {
            specificError = new Error(`SelectorSyntaxError: Invalid list selector syntax for ${selectorString}: ${conciseErrorMessage}`);
        } else {
          specificError = new Error(`CriticalListExtractionError: Failed for list selector ${selectorString}: ${conciseErrorMessage}`);
        }
        specificError.stack = error.stack;
        (specificError as any).originalError = error;
        throw specificError; // Re-throw the more specific error
        // --- End Specific Error Formatting ---
      }
    }
  }

  // Extracts inner HTML from a single element found within a scope
  private async extractHtml(selectorOrArray: string | string[], scope: Page | ElementHandle, pageForContext: Page): Promise<string | null> {
    try {
      // Use evalFirst helper
      const result = await this.evalFirst<string>(scope, selectorOrArray, el => (el as Element).innerHTML, pageForContext); // Cast el
      if (result === null) {
          logger.warn(`Failed to extract HTML with selector(s): "${JSON.stringify(selectorOrArray)}"`);
      }
      return result; // Returns null if no selector worked
    } catch (error: any) {
       // Catch unexpected errors from evalFirst/trySelectors
      logger.error(`Unexpected error extracting HTML for selector(s) "${JSON.stringify(selectorOrArray)}": ${error.message}`);
      return null; // Return null on unexpected error
    }
  }

  // Extracts text or attribute from a single element found within a scope
  private async extractText(
    selectorOrArray: string | string[], // Accept array
    scope: Page | ElementHandle,
    config: CssSelectorConfig,
    pageForContext: Page // Add page parameter
  ): Promise<string | null> {
    const attr = config.attribute;
    // Define isSelfSelector outside the try block
    const isSelfSelector = !Array.isArray(selectorOrArray) && selectorOrArray === 'self';

    try {
      // --- Handle "self" selector ---
      // "self" doesn't make sense as an array, treat as single special case
      // const isSelfSelector = !Array.isArray(selectorOrArray) && selectorOrArray === 'self'; // Moved outside

      if (isSelfSelector) {
         // Use a more robust type guard to check if scope is ElementHandle
         // Check if it's NOT a Page by checking for a Page-specific method like 'goto'
        if (typeof (scope as any).goto === 'function') { // Check if it behaves like a Page
          logger.warn(`'self' selector cannot be used with Page scope directly. Requires an element scope.`);
          if (config.continueOnError) {
              return config.defaultValue !== undefined ? String(config.defaultValue) : null;
          }
          throw new Error("'self' selector used incorrectly with Page scope.");
        } else {
            // Type assertion to help TypeScript understand scope is ElementHandle here
            const elementScope = scope as ElementHandle;
            try {
               // Evaluate directly on the element scope
               return await elementScope.evaluate(
                   (el: Element, attrValue?: string) => // Add types for el and attrValue
                   attrValue ? el.getAttribute(attrValue) || '' : el.textContent?.trim() || '',
                   attr // Pass attr as the argument to the callback
               );
            } catch (selfEvalError: any) {
                 logger.warn(`Failed to evaluate self: ${selfEvalError.message?.split('\n')[0]}`);
                 if (config.continueOnError) {
                     return config.defaultValue !== undefined ? String(config.defaultValue) : null;
                 } else {
                     throw new Error(`Critical extraction failure evaluating self: ${selfEvalError.message}`);
                 }
            }
        }
      } else {
        // --- Handle standard selectors using helper ---
        const result = await this.evalFirst<string>(
          scope,
          selectorOrArray,
          (el: Element, attrValue?: string) => // Add types for el and attrValue
            attrValue ? el.getAttribute(attrValue) || '' : el.textContent?.trim() || '',
          pageForContext, // Pass page
          attr // Pass attr as the argument to the callback
        );

        if (result === null) {
           // Warning already logged by evalFirst/trySelectors if no selectors worked
           if (config.continueOnError) {
              return config.defaultValue !== undefined ? String(config.defaultValue) : null;
           } else {
              // If not continuing and result is null, throw critical error
              throw new Error(`Critical extraction failure: None of the selectors worked for "${JSON.stringify(selectorOrArray)}"`);
           }
        }
        return result;
      }
    } catch (error: any) {
      // Catch errors re-thrown from helpers or the 'self' block
      const failureType = isSelfSelector ? 'evaluate self' : 'find/evaluate selector(s)';
      const conciseErrorMessage = error.message?.split('\n')[0]; // Get first line of error

      logger.error( // Log as error because this catch block means a potentially critical failure occurred
        `Failed to ${failureType} "${JSON.stringify(selectorOrArray)}": ${conciseErrorMessage}`, { error }
      );

      // Double-check continueOnError as error might be re-thrown
      if (config.continueOnError) {
        return config.defaultValue !== undefined ? String(config.defaultValue) : null;
      } else {
        // --- Format and Re-throw Specific Error ---
        let specificError: Error;
        const selectorString = JSON.stringify(selectorOrArray);

        if (error.name === 'TimeoutError' || conciseErrorMessage?.includes('waiting for selector')) {
          specificError = new Error(`SelectorTimeoutError: Failed waiting for selector ${selectorString}: ${conciseErrorMessage}`);
        } else if (conciseErrorMessage?.includes('invalid selector') || conciseErrorMessage?.includes('syntax error')) {
            specificError = new Error(`SelectorSyntaxError: Invalid selector syntax for ${selectorString}: ${conciseErrorMessage}`);
        } else {
          // Generic critical failure
          specificError = new Error(`CriticalExtractionError: Failed to ${failureType} ${selectorString}: ${conciseErrorMessage}`);
        }
        // Preserve original stack if possible, or attach original error
        specificError.stack = error.stack; 
        (specificError as any).originalError = error; 

        throw specificError; // Re-throw the more specific error
        // --- End Specific Error Formatting ---
      }
    }
  }
}
