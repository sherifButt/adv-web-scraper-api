import { Page } from 'playwright';
import { NavigationStep, NavigationContext, StepResult } from '../types/navigation.types.js';
import { logger } from '../../utils/logger.js';
import { BaseStepHandler } from './base-step-handler.js';
import { BehaviorEmulator } from '../../core/human/behavior-emulator.js';

// Define Point locally if not exported from types
interface Point {
  x: number;
  y: number;
}

// Define interfaces for the new naming convention
interface CoordinatePoint {
  x: number;
  y: number;
}

interface Delta {
  x: number;
  y: number;
}

// Enhanced Target interface to include offsets
interface Target {
  selector?: string;
  x?: number;
  y?: number;
  offsetX?: number;
  offsetY?: number;
}

// Helper function for random delays
function getRandomDelay(delay?: { min: number; max: number } | number): number {
  if (typeof delay === 'number') {
    return delay;
  }
  if (delay && typeof delay === 'object' && delay.min !== undefined && delay.max !== undefined) {
    // Ensure min is less than max
    const min = Math.min(delay.min, delay.max);
    const max = Math.max(delay.min, delay.max);
    return Math.random() * (max - min) + min;
  }
  return 0; // Default to no delay if invalid or undefined
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
    // Extract and resolve parameters
    const action = step.action || 'move'; // Default to 'move'
    const timeout = step.timeout || 30000;
    // Use step.duration for initial move/scroll, specific durations might be needed for drag parts
    const duration =
      typeof step.duration === 'number' ? this.resolveValue(step.duration, context) : 500;
    const humanLike = step.humanLike !== false;

    // Resolve target (now includes offsets, only uses mouseTarget)
    const target = this.resolveTarget(step, context);

    // Resolve start point and intermediate path points (only uses startPoint/pathPoints)
    const pathPoints = this.resolvePathPoints(step, context);

    // Log target details including offsets if present
    let targetDesc = target.selector
      ? `selector "${target.selector}"`
      : `coordinates (${target.x},${target.y})`;
    if (target.offsetX !== undefined || target.offsetY !== undefined) {
      targetDesc += ` with offset (${target.offsetX || 0},${target.offsetY || 0})`;
    }
    logger.info(`Executing mouse ${action} to ${targetDesc}`);

    // Handle the mouse movement based on whether we have a selector or coordinates
    if (target.selector) {
      // Pass the full target object to handle offsets and randomization
      await this.moveToSelector(page, target, duration, humanLike, timeout, step.randomizeOffset);
    } else if (target.x !== undefined && target.y !== undefined) {
      // Coordinates don't have offsets or randomization in the same way
      await this.moveToCoordinates(page, target.x, target.y, duration, humanLike, pathPoints);
    } else {
      // Error should have been thrown by resolveTarget if invalid
      throw new Error('Internal error: Invalid target resolved.');
    }

    // Perform additional action if specified, passing relevant step properties
    await this.performMouseAction(step, action, duration, page, context);

    // Use the protected handleWaitFor from BaseStepHandler
    if (step.waitFor) await this.handleWaitFor(step.waitFor, timeout);
    return {};
  }

  // --- Resolver Methods (Legacy logic removed) ---

  private resolveTarget(step: NavigationStep, context: NavigationContext): Target {
    if (!step.mouseTarget || typeof step.mouseTarget !== 'object') {
      throw new Error('Mouse step requires a mouseTarget object with selector or x/y coordinates.');
    }

    const target: Target = {};

    if (step.mouseTarget.selector) {
      target.selector = this.resolveValue(step.mouseTarget.selector, context);
      // Resolve offsets if provided
      if (typeof step.mouseTarget.offsetX === 'number') {
        target.offsetX = this.resolveValue(step.mouseTarget.offsetX, context);
      }
      if (typeof step.mouseTarget.offsetY === 'number') {
        target.offsetY = this.resolveValue(step.mouseTarget.offsetY, context);
      }
    } else if (typeof step.mouseTarget.x === 'number' && typeof step.mouseTarget.y === 'number') {
      target.x = this.resolveValue(step.mouseTarget.x, context);
      target.y = this.resolveValue(step.mouseTarget.y, context);
    } else {
      throw new Error(
        'mouseTarget object must contain either a selector (string) or x/y coordinates (number).'
      );
    }

    return target;
  }

  private resolvePathPoints(
    step: NavigationStep,
    context: NavigationContext
  ): (Point | { selector: string })[] {
    // Check for startPoint (new style) - this defines the *first* point
    const resolvedIntermediatePoints = (step.pathPoints || []).map((point: any) =>
      this.resolveSinglePathPoint(point, context)
    );

    if (
      step.startPoint &&
      typeof step.startPoint === 'object' &&
      'x' in step.startPoint &&
      'y' in step.startPoint
    ) {
      const start: Point = {
        x: this.resolveValue(step.startPoint.x, context),
        y: this.resolveValue(step.startPoint.y, context),
      };
      // Ensure start point is a Point, not {selector}
      return [start, ...resolvedIntermediatePoints];
    }

    // If no startPoint, use resolved pathPoints directly (first point is start)
    return resolvedIntermediatePoints;
  }

  // Helper to resolve a single point in pathPoints
  private resolveSinglePathPoint(
    point: any,
    context: NavigationContext
  ): Point | { selector: string } {
    if (typeof point === 'object' && point !== null) {
      if ('selector' in point && typeof point.selector === 'string') {
        // Resolve selector string within the object if needed
        return { selector: this.resolveValue(point.selector, context) };
      } else if (
        'x' in point &&
        typeof point.x === 'number' &&
        'y' in point &&
        typeof point.y === 'number'
      ) {
        return {
          x: this.resolveValue(point.x, context),
          y: this.resolveValue(point.y, context),
        };
      }
    }
    // If not a valid point object, warn and throw error
    logger.warn(`Invalid path point format encountered: ${JSON.stringify(point)}`);
    throw new Error(
      `Invalid path point format: ${JSON.stringify(
        point
      )}. Must be {x: number, y: number} or {selector: string}.`
    );
  }

  // --- Execution Methods ---

  private async moveToSelector(
    page: Page,
    target: Target,
    duration: number,
    humanLike: boolean,
    timeout: number,
    randomizeOffset?: boolean | number
  ): Promise<void> {
    if (!target.selector) {
      throw new Error('moveToSelector requires a target selector.');
    }
    await page.waitForSelector(target.selector, { state: 'visible', timeout });

    const element = await page.$(target.selector);
    if (!element) {
      throw new Error(`Element not found for selector: ${target.selector}`);
    }
    const box = await element.boundingBox();
    if (!box) {
      throw new Error(`Could not get bounding box for selector: ${target.selector}`);
    }

    let targetX = box.x + box.width / 2 + (target.offsetX || 0);
    let targetY = box.y + box.height / 2 + (target.offsetY || 0);

    if (randomizeOffset) {
      const maxOffset = typeof randomizeOffset === 'number' ? Math.abs(randomizeOffset) : 5;
      const randomX = (Math.random() - 0.5) * 2 * maxOffset;
      const randomY = (Math.random() - 0.5) * 2 * maxOffset;
      targetX = Math.max(box.x, Math.min(box.x + box.width, targetX + randomX));
      targetY = Math.max(box.y, Math.min(box.y + box.height, targetY + randomY));
      logger.debug(
        `Applied random offset: new target (${targetX.toFixed(2)}, ${targetY.toFixed(2)})`
      );
    }

    if (humanLike) {
      logger.warn(
        'Human-like move to selector with offset/randomization currently uses coordinate path.'
      );
      await this.behaviorEmulator.moveMouseToCoordinates(targetX, targetY, duration);
    } else {
      await page.mouse.move(targetX, targetY);
    }
  }

  private async moveToCoordinates(
    page: Page,
    targetX: number,
    targetY: number,
    duration: number,
    humanLike: boolean,
    pathPoints: (Point | { selector: string })[] // Use resolved type
  ): Promise<void> {
    if (humanLike) {
      // Filter only valid Point objects for the emulator's path
      const validPathPoints = pathPoints.filter(
        (p): p is Point => typeof p === 'object' && 'x' in p && 'y' in p
      );
      await this.behaviorEmulator.moveMouseToCoordinates(
        targetX,
        targetY,
        duration,
        undefined, // steps parameter
        validPathPoints // Pass only coordinate points
      );
    } else {
      await page.mouse.move(targetX, targetY);
    }
  }

  private async performMouseAction(
    step: NavigationStep,
    action: string,
    initialMoveDuration: number,
    page: Page,
    context: NavigationContext
  ): Promise<void> {
    const delayBefore = getRandomDelay(step.delayBeforeAction);
    if (delayBefore > 0) {
      logger.debug(`Applying delay before action: ${delayBefore.toFixed(0)}ms`);
      await page.waitForTimeout(delayBefore);
    }

    switch (action) {
      case 'drag': {
        logger.info(`Starting drag operation`);
        await page.mouse.down();
        await page.waitForTimeout(100); // Small inherent delay

        const dragTarget = this.resolveDragTarget(step, context); // Only checks step.endPoint

        if (dragTarget) {
          try {
            let finalDragX: number;
            let finalDragY: number;
            // Use step.duration for the drag movement itself, fallback to initialMoveDuration or default
            const dragDuration =
              typeof step.duration === 'number'
                ? this.resolveValue(step.duration, context)
                : initialMoveDuration || 500;

            if (dragTarget.selector) {
              logger.info(`Dragging to element: ${dragTarget.selector}`);
              const element = await page.$(dragTarget.selector);
              if (!element)
                throw new Error(`Drag target element not found: ${dragTarget.selector}`);
              const box = await element.boundingBox();
              if (!box)
                throw new Error(
                  `Could not get bounding box for drag target: ${dragTarget.selector}`
                );

              finalDragX = box.x + box.width / 2 + (dragTarget.offsetX || 0);
              finalDragY = box.y + box.height / 2 + (dragTarget.offsetY || 0);

              if (step.randomizeOffset) {
                const maxOffset =
                  typeof step.randomizeOffset === 'number' ? Math.abs(step.randomizeOffset) : 5;
                const randomX = (Math.random() - 0.5) * 2 * maxOffset;
                const randomY = (Math.random() - 0.5) * 2 * maxOffset;
                finalDragX = Math.max(box.x, Math.min(box.x + box.width, finalDragX + randomX));
                finalDragY = Math.max(box.y, Math.min(box.y + box.height, finalDragY + randomY));
                logger.debug(
                  `Applied random offset to drag target: (${finalDragX.toFixed(
                    2
                  )}, ${finalDragY.toFixed(2)})`
                );
              }
            } else if (dragTarget.x !== undefined && dragTarget.y !== undefined) {
              logger.info(`Dragging to coordinates: (${dragTarget.x}, ${dragTarget.y})`);
              finalDragX = dragTarget.x;
              finalDragY = dragTarget.y;
            } else {
              throw new Error('Invalid drag target endpoint.');
            }

            if (step.humanLike !== false) {
              logger.warn('Human-like drag currently moves to endpoint coordinates directly.');
              await this.behaviorEmulator.moveMouseToCoordinates(
                finalDragX,
                finalDragY,
                dragDuration
              );
            } else {
              await page.mouse.move(finalDragX, finalDragY);
            }

            await page.waitForTimeout(100); // Small delay before releasing
          } catch (err) {
            await page.mouse.up(); // Ensure mouse up on error
            const errorMessage = err instanceof Error ? err.message : String(err);
            throw new Error(`Drag operation failed: ${errorMessage}`);
          }
        } else {
          // Error should be thrown by resolveDragTarget if endPoint is invalid
          throw new Error('Drag action specified but no valid endPoint found.');
        }

        await page.mouse.up();
        break;
      }

      case 'click': {
        await page.mouse.down();
        await page.waitForTimeout(50 + Math.random() * 50);
        await page.mouse.up();
        break;
      }

      case 'wheel': {
        const delta = this.resolveDelta(step, context); // Only checks step.delta
        const scrollDuration =
          typeof step.duration === 'number' ? this.resolveValue(step.duration, context) : 100;

        if (step.humanLike !== false) {
          await this.behaviorEmulator.scroll({
            x: delta.x,
            y: delta.y,
            duration: scrollDuration,
          });
        } else {
          await page.mouse.wheel(delta.x, delta.y);
        }
        break;
      }

      case 'move':
      default: {
        // Move action already handled. Delay after action will apply.
        break;
      }
    }

    const delayAfter = getRandomDelay(step.delayAfterAction);
    if (delayAfter > 0) {
      logger.debug(`Applying delay after action: ${delayAfter.toFixed(0)}ms`);
      await page.waitForTimeout(delayAfter);
    }
  }

  private resolveDragTarget(step: NavigationStep, context: NavigationContext): Target {
    if (step.action !== 'drag') {
      // This case should ideally not be reached if called correctly from performMouseAction
      throw new Error('resolveDragTarget called for non-drag action');
    }

    if (!step.endPoint || typeof step.endPoint !== 'object') {
      throw new Error('Drag action requires an endPoint object with selector or x/y coordinates.');
    }

    const target: Target = {};

    if (step.endPoint.selector) {
      target.selector = this.resolveValue(step.endPoint.selector, context);
      if (typeof step.endPoint.offsetX === 'number') {
        target.offsetX = this.resolveValue(step.endPoint.offsetX, context);
      }
      if (typeof step.endPoint.offsetY === 'number') {
        target.offsetY = this.resolveValue(step.endPoint.offsetY, context);
      }
    } else if (typeof step.endPoint.x === 'number' && typeof step.endPoint.y === 'number') {
      target.x = this.resolveValue(step.endPoint.x, context);
      target.y = this.resolveValue(step.endPoint.y, context);
    } else {
      throw new Error(
        'endPoint object must contain either a selector (string) or x/y coordinates (number).'
      );
    }
    // Removed legacy check for step.dragTo
    return target;
  }

  private resolveDelta(step: NavigationStep, context: NavigationContext): Delta {
    const delta: Delta = { x: 0, y: 0 };

    if (step.delta && typeof step.delta === 'object') {
      if ('x' in step.delta && typeof step.delta.x === 'number') {
        delta.x = this.resolveValue(step.delta.x, context);
      }
      if ('y' in step.delta && typeof step.delta.y === 'number') {
        delta.y = this.resolveValue(step.delta.y, context);
      }
    } else if (step.action === 'wheel') {
      // If action is 'wheel' but delta object is missing or invalid, throw error.
      throw new Error("Wheel action requires a 'delta' object with x/y properties.");
    }
    // Removed legacy checks for step.deltaX, step.deltaY
    return delta;
  }

  // Removed private handleWaitFor - will use protected method from BaseStepHandler
}
