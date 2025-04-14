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

        if (step.distance) {
          await page.evaluate(distance => {
            window.scrollBy({ top: distance, behavior: 'smooth' });
          }, step.distance);
        }
        await page.waitForTimeout(800); // Stabilization wait
      } else {
        // Custom scroll behavior with human-like movement
        const box = await page.$eval(resolvedSelector, el => {
          const rect = el.getBoundingClientRect();
          return { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
        });

        const scrollY = box.y - window.innerHeight / 2;
        const scrollX = box.x - window.innerWidth / 2;

        await this.behaviorEmulator.scrollTo({
          x: scrollX,
          y: scrollY,
          margin: step.scrollMargin,
          duration: 1000 + Math.random() * 1000,
        });
      }
    } else {
      // Original directional scrolling behavior
      const direction = step.direction || 'down';
      const distance =
        typeof step.distance === 'number' ? this.resolveValue(step.distance, context) : 100;

      logger.info(`Scrolling ${direction} by ${distance}px`);

      if (direction === 'down') {
        await page.evaluate(dist => window.scrollBy(0, dist), distance);
      } else if (direction === 'up') {
        await page.evaluate(dist => window.scrollBy(0, -dist), distance);
      } else if (direction === 'left') {
        await page.evaluate(dist => window.scrollBy(-dist, 0), distance);
      } else if (direction === 'right') {
        await page.evaluate(dist => window.scrollBy(dist, 0), distance);
      }
    }

    // Wait after scroll action
    await page.waitForTimeout(step.timeout || 500); // Use step timeout or default
    if (step.waitFor) await this.handleWaitFor(step.waitFor, timeout);
    return {};
  }
}
