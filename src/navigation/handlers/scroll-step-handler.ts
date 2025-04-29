import { Page } from 'playwright';
import { NavigationStep, NavigationContext, StepResult } from '../types/navigation.types.js';
import { logger } from '../../utils/logger.js';
import { BaseStepHandler } from './base-step-handler.js';
import { BehaviorEmulator } from '../../core/human/behavior-emulator.js'; // Needed for custom scroll

export class ScrollStepHandler extends BaseStepHandler {
  private behaviorEmulator: BehaviorEmulator;

  constructor(page: Page) {
    super(page);
    // Initialize BehaviorEmulator specifically for this handler if needed,
    // or consider passing it via constructor if shared state is complex.
    // For now, creating a new instance is simpler.
    this.behaviorEmulator = new BehaviorEmulator(page);
  }

  public canHandle(step: NavigationStep): boolean {
    return step.type === 'scroll';
  }

  public async execute(
    step: NavigationStep,
    context: NavigationContext,
    page: Page
  ): Promise<StepResult> {
    const timeout = step.timeout || 30000; // Default timeout

    if (step.selector) {
      const resolvedSelector = this.resolveValue(step.selector, context);
      logger.info(`Scrolling to element: ${resolvedSelector}`);
      await page.waitForSelector(resolvedSelector, {
        state: 'visible',
        timeout: timeout,
      });

      if (step.scrollIntoView) {
        // Hybrid scroll approach from original engine
        await page.evaluate(
          ({ selector, scrollMargin }: { selector: string; scrollMargin?: number }) => {
            const element = document.querySelector(selector);
            if (element) {
              element.scrollIntoView({
                behavior: 'smooth',
                block: 'center',
                inline: 'center',
              });
              if (scrollMargin) {
                window.scrollBy(0, -scrollMargin);
              }
            }
          },
          {
            selector: resolvedSelector,
            scrollMargin: step.scrollMargin,
          }
        );

        // Scroll additional distance if specified
        if (step.distance) {
          await page.evaluate(distance => {
            window.scrollBy({ top: distance, behavior: 'smooth' });
          }, step.distance);
        }

        // Stabilization wait with humanLike randomization
        let stabilizationWait = 800;
        if (step.humanLike) {
          stabilizationWait = Math.floor(stabilizationWait * (0.8 + Math.random() * 0.4));
          logger.debug(`Using human-like scroll stabilization wait: ${stabilizationWait}ms`);
        }
        await page.waitForTimeout(stabilizationWait);
      } else {
        // Custom scroll behavior with human-like movement
        const box = await page.$eval(resolvedSelector, el => {
          const rect = el.getBoundingClientRect();
          return { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
        });

        // Calculate target scroll based on element position relative to viewport center
        // Note: This calculation assumes scrolling the window/main frame.
        // Adjust if scrolling within a specific scrollable element is needed.
        const viewportSize = page.viewportSize() || { width: 1280, height: 720 }; // Default if null
        const targetScrollY = box.y - viewportSize.height / 2;
        const targetScrollX = box.x - viewportSize.width / 2;

        // Use behavior emulator for the scroll
        await this.behaviorEmulator.scroll({
          // Pass deltas, not absolute coordinates
          x: targetScrollX - (await page.evaluate(() => window.scrollX)),
          y: targetScrollY - (await page.evaluate(() => window.scrollY)),
          duration: step.humanLike ? 1000 + Math.random() * 1000 : 500, // Use humanLike duration
          // Margin is complex with coordinate scrolling, consider applying after if needed
        });
      }
    } else {
      // Directional scrolling behavior
      const direction = step.direction || 'down';
      let distance = typeof step.distance === 'number' ? this.resolveValue(step.distance, context) : 100;
      let deltaX = 0;
      let deltaY = 0;

      if (step.humanLike) {
        // Randomize distance slightly
        const originalDistance = distance;
        distance = Math.floor(distance * (0.8 + Math.random() * 0.4));
        logger.info(`Scrolling ${direction} with human-like randomization: target ~${originalDistance}px, actual ${distance}px`);
      } else {
        logger.info(`Scrolling ${direction} by ${distance}px`);
      }

      // Map direction to delta values
      if (direction === 'down') {
        deltaY = distance;
      } else if (direction === 'up') {
        deltaY = -distance;
      } else if (direction === 'left') {
        deltaX = -distance;
      } else if (direction === 'right') {
        deltaX = distance;
      }

      if (step.humanLike) {
        // Use BehaviorEmulator for smoother, variable-speed scroll
        await this.behaviorEmulator.scroll({
          x: deltaX,
          y: deltaY,
          duration: 800 + Math.random() * 600, // Randomize duration
        });
      } else {
        // Original direct scroll for non-humanLike
        await page.evaluate(({ dx, dy }) => window.scrollBy(dx, dy), { dx: deltaX, dy: deltaY });
      }
    }

    // Wait after scroll action with humanLike randomization
    let finalWait = step.timeout || 500; // Default wait is 500ms, not step.timeout
    if (step.humanLike) {
        finalWait = Math.floor(finalWait * (0.8 + Math.random() * 0.4));
        logger.debug(`Using human-like final scroll wait: ${finalWait}ms`);
    }
    await page.waitForTimeout(finalWait);

    if (step.waitFor) await this.handleWaitFor(step.waitFor, timeout);
    return {};
  }
}
