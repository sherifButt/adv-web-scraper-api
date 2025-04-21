import { Page, BrowserContext } from 'playwright';
import { SwitchTabStep, NavigationContext, StepResult } from '../types/navigation.types.js';
import { logger } from '../../utils/logger.js';
import { BaseStepHandler } from './base-step-handler.js';

export class SwitchTabStepHandler extends BaseStepHandler {
  // Note: This handler can change the active page. The NavigationEngine
  // needs to be updated to check StepResult.newPage and update its internal 'page' reference.

  public canHandle(step: SwitchTabStep): boolean {
    return step.type === 'switchTab';
  }

  public async execute(
    step: SwitchTabStep,
    context: NavigationContext,
    page: Page // The *current* page before this step executes
  ): Promise<StepResult> {
    const {
      action,
      target,
      url: newUrl,
      waitFor,
      contextKey = 'newPage',
      description,
      optional = false,
    } = step;

    const stepDescription = description || `Switch tab: ${action}`;
    logger.info(`Executing step: ${stepDescription}`);

    const browserContext: BrowserContext = page.context();
    let targetPage: Page | null = page; // Assume current page remains target unless changed
    const stepResult: StepResult = {}; // Initialize empty result - Use const

    try {
      switch (action) {
        case 'new': {
          if (!newUrl) throw new Error("Action 'new' requires a 'url'.");
          const resolvedUrl = this.resolveValue(newUrl, context) as string;
          logger.debug(`Opening new tab with URL: ${resolvedUrl}`);
          const newPageInstance = await browserContext.newPage();
          await newPageInstance.goto(resolvedUrl, {
            waitUntil: 'load',
            timeout: step.timeout || 30000,
          });
          logger.info(`Opened and navigated new tab to ${resolvedUrl}`);
          context[contextKey] = newPageInstance; // Store reference in context
          targetPage = newPageInstance; // Update target page
          stepResult.newPage = targetPage; // Signal page change
          break;
        }

        case 'switchToLast': { // New action implementation
          logger.debug('Switching to the last opened tab...');
          const pages = browserContext.pages();
          if (pages.length < 2) {
            // If only one page, maybe log a warning but don't fail? Or throw? Let's throw for now.
            throw new Error('switchToLast action requires at least two tabs/windows to be open.');
          }
          const lastPage = pages[pages.length - 1]; // Get the last page
          await lastPage.bringToFront();
          // Optional: Wait for load state on the switched page
          await lastPage.waitForLoadState('load', { timeout: step.timeout || 30000 });
          logger.info(`Switched to last opened tab: ${await lastPage.url()}`);
          targetPage = lastPage; // Update the target page reference
          stepResult.newPage = targetPage; // Signal the page change to NavigationEngine
          context[contextKey] = targetPage; // Store reference in context

          // Optional wait condition within the new tab
          if (waitFor) {
            await this.performWaitOnPage(waitFor, targetPage, step.timeout);
          }
          break;
        }

        case 'waitForNew': {
          // This step now *waits* for the popup event triggered by a *previous* step (usually a click).
          logger.debug('Waiting for new tab/popup...');
          try {
            // Wait for the 'page' event which signifies a new tab/popup
            // Increase timeout significantly for waiting for popup event
            const popupTimeout = step.timeout || 30000; // Use step timeout or default to 30s
            logger.debug(`Waiting for 'page' event with timeout: ${popupTimeout}ms`);
            const newPageInstance = await browserContext.waitForEvent('page', {
              timeout: popupTimeout,
            });
            // Wait for the new page to finish loading, use same timeout
            await newPageInstance.waitForLoadState('load', { timeout: popupTimeout });
            logger.info(`New tab/popup detected and loaded: ${await newPageInstance.url()}`);
            context[contextKey] = newPageInstance;
            targetPage = newPageInstance; // Update target page
            stepResult.newPage = targetPage; // Signal page change

            // Optional wait condition within the new tab
            if (waitFor) {
              await this.performWaitOnPage(waitFor, targetPage, step.timeout);
            }
          } catch (e) {
            logger.error(`Timeout or error waiting for new tab/popup: ${e}`);
            throw new Error('Timed out or failed waiting for new tab/popup.');
          }
          break;
        }

        case 'switch': {
          if (target === undefined) throw new Error("Action 'switch' requires a 'target'.");
          const pages = browserContext.pages();
          logger.debug(`Switching tab. Current tabs: ${pages.length}`);
          let foundPage: Page | null = null;

          if (typeof target === 'number') {
            if (target < 0 || target >= pages.length) {
              throw new Error(`Invalid tab index ${target}. Only ${pages.length} tabs open.`);
            }
            foundPage = pages[target];
            logger.info(`Switching to tab index ${target}: ${await foundPage.url()}`);
          } else if (typeof target === 'string') {
            const pattern = new RegExp(target); // Assume target is a regex string for URL or title
            for (const p of pages) {
              const pUrl = p.url();
              const pTitle = await p.title();
              if (pattern.test(pUrl) || pattern.test(pTitle)) {
                foundPage = p;
                logger.info(`Switching to tab matching "${target}": ${pUrl}`);
                break;
              }
            }
            if (!foundPage) {
              throw new Error(`No open tab found matching pattern: ${target}`);
            }
          } else {
            throw new Error(
              "Invalid 'target' type for switch action. Must be number (index) or string (URL/Title regex)."
            );
          }

          if (foundPage) {
            await foundPage.bringToFront();
            targetPage = foundPage; // Update target page
            stepResult.newPage = targetPage; // Signal page change
            // Optional wait condition within the switched tab
            if (waitFor) {
              await this.performWaitOnPage(waitFor, targetPage, step.timeout);
            }
          }
          break;
        }

        case 'close': {
          const pages = browserContext.pages();
          if (pages.length <= 1 && target === undefined) {
            logger.warn('Cannot close the last remaining tab without a specific target.');
            break; // Be lenient
          }

          let pageToClose: Page | null = null;

          if (target === undefined) {
            if (pages.length > 1) pageToClose = page; // Close the page passed into this step
          } else if (typeof target === 'number') {
            if (target < 0 || target >= pages.length)
              throw new Error(`Invalid tab index ${target} to close.`);
            pageToClose = pages[target];
          } else if (typeof target === 'string') {
            const pattern = new RegExp(target);
            for (const p of pages) {
              if (pattern.test(p.url()) || pattern.test(await p.title())) {
                pageToClose = p;
                break;
              }
            }
            if (!pageToClose)
              throw new Error(`No open tab found matching pattern "${target}" to close.`);
          } else {
            throw new Error("Invalid 'target' type for close action.");
          }

          if (pageToClose) {
            const closingCurrentPage = page === pageToClose;
            const urlClosed = pageToClose.url();
            logger.info(`Closing tab: ${urlClosed}`);
            await pageToClose.close();

            // Determine the new target page
            const remainingPages = browserContext.pages();
            if (closingCurrentPage) {
              if (remainingPages.length > 0) {
                targetPage = remainingPages[0]; // Switch to first available
                await targetPage.bringToFront();
                logger.info(`Switched focus back to tab: ${targetPage.url()}`);
              } else {
                targetPage = null; // No pages left
                logger.warn('Closed the last tab.');
              }
              stepResult.newPage = targetPage; // Signal page change (or null if last tab closed)
            } else {
              // Closed a different tab, the original 'page' remains the target
              targetPage = page;
              // No need to signal newPage if the current page didn't change
            }

            // Optional wait after closing (applied to the new targetPage if focus shifted)
            if (waitFor && typeof waitFor === 'number' && targetPage) {
              await targetPage.waitForTimeout(waitFor);
            }
          } else {
            logger.warn('No specific tab identified to close.');
          }
          break;
        }

        default:
          throw new Error(`Unsupported switchTab action: ${action}`);
      }

      // Ensure the targetPage is updated in the handler's internal state if needed elsewhere
      // this.page = targetPage; // This shouldn't be done here, NavigationEngine handles it

      return stepResult; // Return result containing potential newPage
    } catch (error: any) {
      const errorMessage = `Error during switchTab step "${stepDescription}": ${error.message}`;
      logger.error(errorMessage);
      if (!optional) {
        throw new Error(errorMessage); // Re-throw if mandatory
      } else {
        logger.warn(`Optional switchTab step failed, continuing flow.`);
        context[`${step.name || 'lastTabError'}`] = errorMessage;
        return {}; // Continue flow, return empty result
      }
    }
  }

  // Specific wait function to operate on a potentially different page object
  private async performWaitOnPage(
    waitFor: string | number | any,
    pageScope: Page,
    timeout?: number
  ): Promise<void> {
    const actualTimeout = timeout || 30000;
    logger.debug(`Performing wait (${typeof waitFor}: ${waitFor}) on page: ${pageScope.url()}`);
    if (typeof waitFor === 'number') {
      await pageScope.waitForTimeout(waitFor);
    } else if (typeof waitFor === 'string') {
      await pageScope.waitForSelector(waitFor, {
        state: 'visible',
        timeout: actualTimeout,
      });
    } else if (waitFor === 'navigation') {
      await pageScope.waitForNavigation({
        waitUntil: 'load',
        timeout: actualTimeout,
      });
    } else if (waitFor === 'networkidle') {
      await pageScope.waitForLoadState('networkidle', {
        timeout: actualTimeout,
      });
    } else {
      logger.warn(`Unsupported waitFor condition type in performWaitOnPage: ${waitFor}`);
    }
  }
}
