import { Page, ElementHandle } from 'playwright';
import {
  NavigationContext,
  NavigationStep,
  ForEachElementStep,
  StepResult, // Import StepResult here
} from '../types/navigation.types.js';
import { IStepHandler } from '../types/step-handler.interface.js';
import { logger } from '../../utils/logger.js'; // Import the logger instance

export class ForEachElementStepHandler implements IStepHandler {
  canHandle(step: NavigationStep): boolean {
    return step.type === 'forEachElement';
  }

  async execute(
    step: ForEachElementStep,
    context: NavigationContext,
    page: Page
  ): Promise<StepResult> {
    // Change return type
    logger.info(`Executing forEachElement: ${step.description || step.selector}`);

    if (!step.selector) {
      throw new Error('ForEachElementStep requires a "selector".');
    }
    // Note: We are ignoring step.elementSteps for now and hardcoding the logic
    // for the Google Trends case within this handler as a temporary measure.
    // A proper implementation would require NavigationEngine changes.

    const elementHandles = await page.$$(step.selector);
    const maxIterations = step.maxIterations ?? elementHandles.length;
    const iterations = Math.min(elementHandles.length, maxIterations);

    logger.info(
      `Found ${elementHandles.length} elements for selector "${step.selector}". Will iterate ${iterations} times.`
    );

    // Selectors specific to the Google Trends panel interaction
    const rowClickTargetSelector = '.mZ3RIc'; // Click the title inside the row
    const panelSelector = '.EMz5P';
    const panelVisibleContentSelector = '.EMz5P .k44Spe'; // Wait for graph/news area
    const newsLinkSelector = '.jDtQ5 .xZCHj';
    const relatedQuerySelector = '.HLcRPe button';
    const closeButtonSelector = '.EMz5P button[aria-label="Close"]';

    for (let i = 0; i < iterations; i++) {
      const elementHandle = elementHandles[i];
      const trendData = context.trendsData?.trends?.[i]; // Get corresponding data from context
      const trendTitle = trendData?.title || `(No Title at index ${i})`;
      logger.info(`--- Iteration ${i + 1}/${iterations} for trend: ${trendTitle} ---`);

      // Initialize detail fields
      if (trendData) {
        trendData.news = [];
      }
      const initialRelatedQueries = new Set(trendData?.relatedQueries || []);

      try {
        // 1. Find and Click Target in Row
        logger.debug(`  Waiting for row ${i + 1} to be visible...`);
        await elementHandle.waitForElementState('visible', { timeout: 7000 });
        const clickTarget = await elementHandle.$(rowClickTargetSelector);
        if (!clickTarget) {
          logger.warn(
            `  Click target '${rowClickTargetSelector}' not found in row ${i + 1}. Skipping.`
          );
          continue;
        }
        logger.debug(`  Clicking target in row ${i + 1}...`);
        await clickTarget.click({ timeout: 10000 });

        // 2. Wait for Panel Content
        logger.debug('  Waiting for panel content...');
        await page.waitForSelector(panelVisibleContentSelector, {
          state: 'visible',
          timeout: 15000,
        });
        logger.debug('  Panel content visible.');
        await page.waitForTimeout(750); // Allow content to settle

        // 3. Extract News
        logger.debug('  Extracting news items...');
        let newsItems: any[] = [];
        try {
          newsItems = await page.$$eval(
            panelSelector + ' ' + newsLinkSelector,
            (links: Element[]) =>
              links.map((link: Element) => ({
                title: link.querySelector('.QbLC8c')?.textContent?.trim() || null,
                sourceInfo: link.querySelector('.pojp0c')?.textContent?.trim() || null,
                url: (link as HTMLAnchorElement).href,
              }))
          );
          if (trendData) trendData.news = newsItems;
          logger.debug(`  Extracted ${newsItems.length} news items.`);
        } catch (e: any) {
          logger.error(`  Error during news extraction: ${e.message}`);
        }

        // 4. Extract Related Queries from Panel
        logger.debug('  Extracting related queries from panel...');
        let panelRelatedQueries: (string | null)[] = [];
        try {
          panelRelatedQueries = await page.$$eval(
            panelSelector + ' ' + relatedQuerySelector,
            (buttons: Element[]) => buttons.map((btn: Element) => btn.getAttribute('data-term'))
          );
          logger.debug(`  Found ${panelRelatedQueries.length} related queries in panel.`);
        } catch (e: any) {
          logger.error(`  Error during related query extraction: ${e.message}`);
        }

        // 5. Merge and Deduplicate Related Queries
        const finalRelatedQueries = new Set(initialRelatedQueries);
        let addedCount = 0;
        panelRelatedQueries.forEach(q => {
          if (q && !finalRelatedQueries.has(q)) {
            finalRelatedQueries.add(q);
            addedCount++;
          }
        });
        if (trendData) {
          trendData.relatedQueries = Array.from(finalRelatedQueries);
        }
        logger.debug(
          `  Added ${addedCount} new related queries. Total unique: ${finalRelatedQueries.size}`
        );

        // 6. Close Panel
        logger.debug('  Attempting to close panel...');
        try {
          const closeButton = await page.waitForSelector(closeButtonSelector, {
            state: 'visible',
            timeout: 5000,
          });
          await closeButton.click({ timeout: 5000 });
          await page.waitForSelector(panelSelector, {
            state: 'hidden',
            timeout: 7000,
          });
          logger.debug('  Panel closed successfully.');
        } catch (closeError: any) {
          logger.warn(`  Could not explicitly close panel: ${closeError.message}`);
        }

        logger.debug('  Waiting briefly before next iteration...');
        await page.waitForTimeout(750);
      } catch (error: any) {
        logger.error(`  Error during iteration ${i + 1}: ${error.message}`);
        if (trendData) {
          // Restore original related queries if iteration failed mid-way
          trendData.relatedQueries = Array.from(initialRelatedQueries);
        }
        // Attempt recovery close
        try {
          const panelVisible = await page.isVisible(panelSelector, {
            timeout: 1000,
          });
          if (panelVisible) {
            logger.warn('  Panel visible after error, attempting recovery close...');
            const closeButton = await page.$(closeButtonSelector);
            if (closeButton) {
              await closeButton.click({ timeout: 5000, force: true });
              await page.waitForSelector(panelSelector, {
                state: 'hidden',
                timeout: 5000,
              });
              logger.info('  Recovery close successful.');
            } else {
              logger.warn('  Recovery close failed: Close button not found.');
            }
          }
        } catch (recoveryCloseError: any) {
          logger.warn(`  Recovery close attempt failed: ${recoveryCloseError.message}`);
        }
        logger.warn('  Continuing to next iteration despite error.');
        console.error(error.stack); // Log stack trace for debugging
      } finally {
        logger.info(`--- Finished Iteration ${i + 1}/${iterations} ---`);
      }
    }

    logger.info(`Finished forEachElement: ${step.description || step.selector}`);
    return {}; // Return empty StepResult object
  }
}
