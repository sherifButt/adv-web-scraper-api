import { Page, ElementHandle, Locator } from 'playwright';
import { AssertStep, NavigationContext, StepResult } from '../types/navigation.types.js';
import { logger } from '../../utils/logger.js';
import { BaseStepHandler } from './base-step-handler.js';

// Helper function for retrying assertions with timeout
async function retryAssertion<T>(
  assertionFn: () => Promise<T>,
  timeout: number,
  errorMessagePrefix: string
): Promise<T> {
  const startTime = Date.now();
  let lastError: Error | null = null;

  while (Date.now() - startTime < timeout) {
    try {
      return await assertionFn(); // Attempt the assertion
    } catch (error: any) {
      lastError = error; // Store the last error
      // Wait a short interval before retrying
      await new Promise(resolve => setTimeout(resolve, 100));
    }
  }
  // Timeout reached, throw the last encountered error
  throw new Error(
    `${errorMessagePrefix}: Timeout after ${timeout}ms. Last error: ${
      lastError?.message || 'Unknown error'
    }`
  );
}

export class AssertStepHandler extends BaseStepHandler {
  public canHandle(step: AssertStep): boolean {
    return step.type === 'assert';
  }

  public async execute(
    step: AssertStep,
    context: NavigationContext,
    page: Page
  ): Promise<StepResult> {
    const {
      selector,
      assertionType,
      expectedValue,
      attributeName,
      timeout = 5000, // Default timeout for assertions
      optional = false,
      description,
    } = step;

    const resolvedSelector = this.resolveValue(selector, context) as string;
    const stepDescription = description || `Assert ${assertionType} on "${resolvedSelector}"`;
    logger.info(`Executing step: ${stepDescription}`);

    try {
      const currentItemHandle = context.currentItemHandle as ElementHandle | undefined;

      const assertFn = async () => {
        // Get the target element/locator based on the scope
        let targetElement: ElementHandle | null = null;
        let targetLocator: Locator | null = null;

        if (currentItemHandle) {
          // Scope is ElementHandle: Use querySelector ($) within the handle
          targetElement = await currentItemHandle.$(resolvedSelector);
        } else {
          // Scope is Page: Use locator
          targetLocator = page.locator(resolvedSelector).first();
          // Try to get the element handle from locator for consistency in checks below
          // Handle potential error if locator doesn't resolve to an element immediately
          try {
            targetElement = (await targetLocator.elementHandle({ timeout: 100 })) || null; // Short timeout just to get handle if exists
          } catch (e) {
            targetElement = null; // Element likely doesn't exist yet or selector is wrong
          }
        }

        // --- Perform Assertion ---
        // Use targetLocator primarily for Playwright's built-in waiting,
        // but use targetElement for checks where it's more direct or required.

        switch (assertionType) {
          case 'exists': {
            let exists = false;
            if (targetLocator) {
              exists = (await targetLocator.count()) > 0;
            } else if (targetElement) {
              exists = true; // If we have the handle from ElementHandle scope, it exists
            }
            if (!exists) {
              throw new Error(`Element does not exist.`);
            }
            logger.debug(`Assertion check passed: Element "${resolvedSelector}" exists.`);
            break;
          }
          case 'isVisible': {
            let visible = false;
            if (targetLocator) {
              // Use locator's isVisible which includes auto-waiting
              visible = await targetLocator.isVisible({ timeout });
            } else if (targetElement) {
              visible = await targetElement.isVisible(); // No built-in wait here
            } else {
              throw new Error(`Element not found to check visibility.`);
            }
            if (!visible) throw new Error(`Element is not visible.`);
            logger.debug(`Assertion check passed: Element "${resolvedSelector}" is visible.`);
            break;
          }
          case 'isHidden': {
            let hidden = false;
            if (targetLocator) {
              // Use locator's isHidden which includes auto-waiting
              hidden = await targetLocator.isHidden({ timeout });
            } else if (targetElement) {
              hidden = await targetElement.isHidden(); // No built-in wait here
            } else {
              // If element doesn't exist, consider it hidden? Or throw error?
              // Let's consider non-existence as hidden for this assertion.
              hidden = true;
            }
            if (!hidden) throw new Error(`Element is not hidden.`);
            logger.debug(`Assertion check passed: Element "${resolvedSelector}" is hidden.`);
            break;
          }
          case 'containsText': {
            if (expectedValue === undefined) {
              throw new Error('Assertion type "containsText" requires an expectedValue.');
            }
            let textContent: string | null;
            if (targetLocator) {
              textContent = await targetLocator.textContent({ timeout }); // Use locator's waiting
            } else if (targetElement) {
              textContent = await targetElement.textContent();
            } else {
              throw new Error(`Element not found to check text content.`);
            }

            textContent = textContent || ''; // Handle null case

            let match = false;
            if (typeof expectedValue === 'string') {
              match = textContent.includes(expectedValue);
            } else if (expectedValue instanceof RegExp) {
              match = expectedValue.test(textContent);
            } else {
              throw new Error('expectedValue for "containsText" must be a string or RegExp.');
            }
            if (!match) {
              throw new Error(`Text "${textContent}" does not contain "${expectedValue}".`);
            }
            logger.debug(
              `Assertion check passed: Element "${resolvedSelector}" contains text "${expectedValue}".`
            );
            break;
          }
          case 'hasAttribute': {
            if (!attributeName) {
              throw new Error('Assertion type "hasAttribute" requires an attributeName.');
            }
            let attrValue: string | null;
            if (targetLocator) {
              attrValue = await targetLocator.getAttribute(attributeName, {
                timeout,
              });
            } else if (targetElement) {
              attrValue = await targetElement.getAttribute(attributeName);
            } else {
              throw new Error(`Element not found to check attribute.`);
            }

            if (attrValue === null) {
              throw new Error(`Attribute "${attributeName}" does not exist.`);
            }
            logger.debug(
              `Assertion check passed: Element "${resolvedSelector}" has attribute "${attributeName}".`
            );
            break;
          }
          case 'attributeEquals': {
            if (!attributeName || expectedValue === undefined) {
              throw new Error(
                'Assertion type "attributeEquals" requires attributeName and expectedValue.'
              );
            }
            let actualValue: string | null;
            if (targetLocator) {
              actualValue = await targetLocator.getAttribute(attributeName, {
                timeout,
              });
            } else if (targetElement) {
              actualValue = await targetElement.getAttribute(attributeName);
            } else {
              throw new Error(`Element not found to check attribute value.`);
            }

            actualValue = actualValue || ''; // Handle null case

            let match = false;
            if (typeof expectedValue === 'string') {
              match = actualValue === expectedValue;
            } else if (expectedValue instanceof RegExp) {
              match = expectedValue.test(actualValue);
            } else {
              throw new Error('expectedValue for "attributeEquals" must be a string or RegExp.');
            }
            if (!match) {
              throw new Error(
                `Attribute "${attributeName}" value "${actualValue}" does not equal "${expectedValue}".`
              );
            }
            logger.debug(
              `Assertion check passed: Element "${resolvedSelector}" attribute "${attributeName}" equals "${expectedValue}".`
            );
            break;
          }
          default: {
            // This case should ideally be caught by type checking, but added for safety
            const exhaustiveCheck: never = assertionType;
            throw new Error(`Unsupported assertion type: ${exhaustiveCheck}`);
          }
        }
      };

      // Retry the assertion function until timeout - timeout is handled inside assertion types using locator where possible
      // The retryAssertion helper is now mainly for cases where ElementHandle is used or initial element finding fails.
      await retryAssertion(
        assertFn,
        timeout, // Use the step's timeout for the overall retry loop
        `Assertion failed for step "${stepDescription}"`
      );

      logger.info(`Assertion passed for step: ${stepDescription}`);
      return {}; // Assertion passed
    } catch (error: any) {
      const errorMessage = error.message; // Use the message from retryAssertion or the direct error
      logger.error(errorMessage);
      if (!optional) {
        // Ensure the error thrown includes the step description for context
        throw new Error(
          `Mandatory assertion failed for step "${stepDescription}": ${error.message}`
        );
      } else {
        logger.warn(`Optional assertion failed, continuing flow: ${errorMessage}`);
        // Store the error in context if needed
        context[`${step.name || 'lastAssertionError'}`] = errorMessage;
        return {}; // Continue flow as it's optional
      }
    }
  }
}
