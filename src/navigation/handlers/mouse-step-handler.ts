import { Page } from 'playwright';
import { NavigationStep, NavigationContext, StepResult } from '../types/navigation.types.js'; // Removed Point import
import { logger } from '../../utils/logger.js';
import { BaseStepHandler } from './base-step-handler.js';
import { BehaviorEmulator } from '../../core/human/behavior-emulator.js';

// Define Point locally if not exported from types
interface Point {
  x: number;
  y: number;
}

export class MouseStepHandler extends BaseStepHandler {
  private behaviorEmulator: BehaviorEmulator;

  constructor(page: Page) {
    super(page);
    this.behaviorEmulator = new BehaviorEmulator(page);
  }

  public canHandle(step: NavigationStep): boolean {
    // This handler manages 'mousemove', 'drag', 'click', and 'wheel' actions
    // specified within a 'mousemove' step type using the 'action' property.
    return step.type === 'mousemove';
  }

  public async execute(
    step: NavigationStep,
    context: NavigationContext,
    page: Page
  ): Promise<StepResult> {
    const selector = this.resolveValue(step.selector, context);
    const x = typeof step.x === 'number' ? this.resolveValue(step.x, context) : undefined;
    const y = typeof step.y === 'number' ? this.resolveValue(step.y, context) : undefined;
    const duration =
      typeof step.duration === 'number' ? this.resolveValue(step.duration, context) : 500;
    const humanLike = step.humanLike !== false;
    const pathPointsRaw = step.pathPoints || [];
    const action = step.action || 'move'; // Default to 'move'
    const timeout = step.timeout || 30000;

    logger.info(`Executing mouse ${action} to ${selector || `coordinates (${x},${y})`}`);

    let targetX: number | undefined = x;
    let targetY: number | undefined = y;

    // Resolve path points if they are selectors
    const resolvedPathPoints = await Promise.all(
      pathPointsRaw.map(async (point: { selector: string } | Point) => {
        if (typeof point === 'object' && 'selector' in point) {
          const element = await page.$(point.selector);
          if (!element) return point; // Return original if selector not found
          const box = await element.boundingBox();
          if (!box) return point; // Return original if no bounding box
          return {
            x: box.x + box.width / 2,
            y: box.y + box.height / 2,
          };
        }
        return point; // Return original point if not a selector object
      })
    );

    if (selector) {
      await page.waitForSelector(selector, { state: 'visible', timeout });
      const box = await page.$eval(selector, el => {
        const rect = el.getBoundingClientRect();
        return {
          x: rect.left + rect.width / 2,
          y: rect.top + rect.height / 2,
        };
      });
      targetX = box.x;
      targetY = box.y;

      if (humanLike) {
        await this.behaviorEmulator.moveMouseToElement(selector, duration);
      } else {
        // Ensure targetX and targetY are defined before moving
        if (targetX !== undefined && targetY !== undefined) {
          await page.mouse.move(targetX, targetY);
        } else {
          throw new Error('Target coordinates for mouse move are undefined.');
        }
      }
    } else if (targetX !== undefined && targetY !== undefined) {
      if (humanLike) {
        await this.behaviorEmulator.moveMouseToCoordinates(
          targetX,
          targetY,
          duration,
          undefined, // steps parameter - not directly applicable here?
          // Filter the array to ensure only Point objects are passed
          resolvedPathPoints.filter((p): p is Point => 'x' in p && 'y' in p)
        );
      } else {
        await page.mouse.move(targetX, targetY);
      }
    } else {
      throw new Error('Mouse move step requires either selector or x/y coordinates');
    }

    // Perform additional action if specified
    await this.performMouseAction(step, action, duration, page, context);

    if (step.waitFor) await this.handleWaitFor(step.waitFor, timeout);
    return {};
  }

  private async performMouseAction(
    step: NavigationStep,
    action: string,
    duration: number,
    page: Page,
    context: NavigationContext
  ): Promise<void> {
    switch (action) {
      case 'drag': {
        // Log the drag operation
        logger.info(`Starting drag operation`);

        await page.mouse.down();
        await page.waitForTimeout(100); // Small delay after mousedown

        if (step.dragTo) {
          try {
            // Handle dragTo as a string or as an object with a selector property
            let dragToSelector: string;

            if (typeof step.dragTo === 'string') {
              dragToSelector = this.resolveValue(step.dragTo, context);
            } else if (typeof step.dragTo === 'object' && 'selector' in step.dragTo) {
              dragToSelector = this.resolveValue(step.dragTo.selector, context);
            } else {
              throw new Error(`Invalid dragTo format: ${JSON.stringify(step.dragTo)}`);
            }

            logger.info(`Dragging to element: ${dragToSelector}`);
            await page.waitForSelector(dragToSelector, { timeout: 5000 });
            await this.behaviorEmulator.moveMouseToElement(dragToSelector, duration);

            await page.waitForTimeout(100); // Small delay before releasing
          } catch (error) {
            // Release mouse if there's an error
            await page.mouse.up();
            throw new Error(`Drag operation failed: ${error.message}`);
          }
        } else {
          logger.warn('Drag operation with no target specified');
        }

        await page.mouse.up();
        await page.waitForTimeout(300); // Wait for animations
        break;
      }
      // Other cases remain the same...
      case 'click': {
        await page.mouse.down();
        await page.waitForTimeout(50 + Math.random() * 100);
        await page.mouse.up();
        break;
      }
      case 'wheel': {
        const deltaX =
          typeof step.deltaX === 'number' ? this.resolveValue(step.deltaX, context) : 0;
        const deltaY =
          typeof step.deltaY === 'number' ? this.resolveValue(step.deltaY, context) : 0;

        if (step.humanLike !== false) {
          await this.behaviorEmulator.scroll({
            x: deltaX,
            y: deltaY,
            duration,
          });
        } else {
          await page.mouse.wheel(deltaX, deltaY);
        }

        await page.waitForTimeout(100);
        break;
      }
      case 'move':
      default: {
        // Move action already handled above
        break;
      }
    }
  }
}
