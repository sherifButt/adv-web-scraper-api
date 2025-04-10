import { Page, Mouse } from 'playwright';
import { HumanEmulationOptions } from '../../types/index.js';
import { logger } from '../../utils/logger.js';

/**
 * Behavior profile types
 */
export type BehaviorProfile = 'fast' | 'average' | 'careful';

/**
 * Profile configuration for human behavior
 */
interface ProfileConfig {
  mouseSpeed: number; // Pixels per millisecond
  clickDelay: [number, number]; // Min and max delay before clicking in ms
  typeSpeed: [number, number]; // Min and max delay between keystrokes in ms
  typoRate: number; // Probability of making a typo (0-1)
  scrollSpeed: [number, number]; // Min and max scroll speed in pixels
  thinkingTime: [number, number]; // Min and max delay between actions in ms
}

/**
 * Point coordinates
 */
interface Point {
  x: number;
  y: number;
}

/**
 * Emulates human-like behavior for browser interactions
 */
export class BehaviorEmulator {
  private page: Page;
  private profile: ProfileConfig;

  /**
   * Profile configurations for different behavior types
   */
  private static readonly PROFILES: Record<BehaviorProfile, ProfileConfig> = {
    fast: {
      mouseSpeed: 0.7,
      clickDelay: [80, 200],
      typeSpeed: [50, 150],
      typoRate: 0.02,
      scrollSpeed: [400, 900],
      thinkingTime: [300, 800],
    },
    average: {
      mouseSpeed: 0.4,
      clickDelay: [150, 400],
      typeSpeed: [100, 250],
      typoRate: 0.04,
      scrollSpeed: [250, 600],
      thinkingTime: [800, 2000],
    },
    careful: {
      mouseSpeed: 0.25,
      clickDelay: [300, 700],
      typeSpeed: [200, 450],
      typoRate: 0.07,
      scrollSpeed: [150, 400],
      thinkingTime: [1500, 4000],
    },
  };

  /**
   * Create a new BehaviorEmulator
   */
  constructor(page: Page, options: HumanEmulationOptions = {}) {
    this.page = page;
    this.profile = BehaviorEmulator.PROFILES[options.profile || 'average'];
  }

  /**
   * Move the mouse to an element with human-like motion
   */
  public async moveMouseToElement(selector: string, duration?: number): Promise<void> {
    const element = await this.page.$(selector);
    if (!element) {
      throw new Error(`Element not found: ${selector}`);
    }

    const box = await element.boundingBox();
    if (!box) {
      throw new Error(`Cannot get bounding box for: ${selector}`);
    }

    // Target the center of the element
    const targetX = box.x + box.width / 2;
    const targetY = box.y + box.height / 2;

    await this.moveMouseToCoordinates(targetX, targetY, duration || 0);
  }

  /**
   * Move the mouse to a specific position with human-like motion
   */
  public async scrollTo(options: {
    x: number;
    y: number;
    margin?: number;
    duration: number;
  }): Promise<void> {
    const { x, y, margin = 0, duration } = options;
    await this.page.mouse.wheel(x + margin, y + margin);
    await this.page.waitForTimeout(duration);
  }

  public async moveMouseToCoordinates(
    x: number,
    y: number,
    duration: number,
    button?: 'left' | 'right' | 'middle',
    pathPoints: Point[] = [],
    from?: { x: number; y: number } | { selector: string }
  ): Promise<void> {
    let startX: number;
    let startY: number;

    if (from) {
      if ('selector' in from) {
        const element = await this.page.$(from.selector);
        if (!element) throw new Error(`From element not found: ${from.selector}`);
        const box = await element.boundingBox();
        if (!box) throw new Error(`Cannot get bounding box for: ${from.selector}`);
        startX = box.x + box.width / 2;
        startY = box.y + box.height / 2;
      } else {
        startX = from.x;
        startY = from.y;
      }
    } else {
      // Default to viewport center if no from position specified
      const viewportSize = this.page.viewportSize() || { width: 1280, height: 720 };
      startX = viewportSize.width / 2;
      startY = viewportSize.height / 2;
    }

    // Generate path with intermediate points
    const allPoints = [{ x: startX, y: startY }];

    // Add path points if any
    for (const point of pathPoints) {
      if ('selector' in point) {
        const element = await this.page.$(point.selector as string);
        if (!element) continue;
        const box = await element.boundingBox();
        if (!box) continue;
        allPoints.push({
          x: box.x + box.width / 2,
          y: box.y + box.height / 2,
        });
      } else {
        allPoints.push(point);
      }
    }

    // Add final destination
    allPoints.push({ x, y });

    // Generate smooth path through all points
    const points = this.generateMultiPointPath(allPoints);

    // Calculate total movement time based on distance and profile speed
    const distance = Math.sqrt(Math.pow(x - startX, 2) + Math.pow(y - startY, 2));
    const totalTime = duration || distance / this.profile.mouseSpeed;

    // Move through points with timing adjusted for duration
    const mouse = this.page.mouse;
    const startTime = Date.now();
    for (let i = 0; i < points.length; i++) {
      const point = points[i];
      await mouse.move(point.x, point.y);

      // Calculate elapsed time and adjust delays to meet total duration
      const elapsed = Date.now() - startTime;
      const remaining = totalTime - elapsed;
      const pointsLeft = points.length - i - 1;

      if (pointsLeft > 0) {
        const delay = Math.min(remaining / pointsLeft, 25);
        await this.randomDelay(delay * 0.8, delay * 1.2);
      }
    }

    // Small delay before any potential click
    await this.randomDelay(this.profile.clickDelay[0], this.profile.clickDelay[1]);
  }

  /**
   * Click on an element with human-like behavior
   */
  public async clickElement(selector: string): Promise<void> {
    await this.moveMouseToElement(selector);
    await this.page.mouse.down();
    await this.randomDelay(50, 150);
    await this.page.mouse.up();
  }

  /**
   * Type text with human-like timing and occasional typos
   */
  public async typeText(
    text: string,
    options: { mistakes?: boolean; variableSpeed?: boolean } = {}
  ): Promise<void> {
    const { mistakes = true, variableSpeed = true } = options;

    for (let i = 0; i < text.length; i++) {
      // Occasionally make a typo and correct it
      if (mistakes && Math.random() < this.profile.typoRate) {
        const typoChar = this.getRandomTypo(text[i]);
        await this.page.keyboard.press(typoChar);
        await this.randomDelay(300, 700);
        await this.page.keyboard.press('Backspace');
        await this.randomDelay(200, 500);
      }

      // Type the correct character with variable speed
      await this.page.keyboard.press(text[i]);

      if (variableSpeed) {
        // Longer delay for space and punctuation
        const delay = /[\s.,!?]/.test(text[i])
          ? this.randomDelay(150, 400)
          : this.randomDelay(this.profile.typeSpeed[0], this.profile.typeSpeed[1]);
        await delay;
      }
    }
  }

  /**
   * Scroll with human-like behavior
   */
  public async scroll(options: { x: number; y: number; duration?: number }): Promise<void> {
    const { x, y, duration = 1000 } = options;
    const distance = Math.sqrt(x * x + y * y);
    const steps = Math.max(10, Math.floor(duration / 100));
    const stepDelay = duration / steps;
    const stepX = x / steps;
    const stepY = y / steps;

    for (let i = 0; i < steps; i++) {
      const progress = i / steps;
      const ease = this.easeInOutCubic(progress);
      const currentX = Math.round(stepX * ease);
      const currentY = Math.round(stepY * ease);

      await this.page.mouse.wheel(currentX, currentY);
      await this.page.waitForTimeout(stepDelay + Math.random() * 20);
    }
  }

  private easeInOutCubic(t: number): number {
    return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
  }

  /**
   * Wait for a random amount of time to simulate human thinking
   */
  public async think(): Promise<void> {
    await this.randomDelay(this.profile.thinkingTime[0], this.profile.thinkingTime[1]);
  }

  /**
   * Generate a natural mouse path using Bezier curves
   */
  private generateMultiPointPath(points: Point[]): Point[] {
    if (points.length < 2) return points;

    const path: Point[] = [];

    for (let i = 0; i < points.length - 1; i++) {
      const start = points[i];
      const end = points[i + 1];

      const segmentPoints = Math.floor(
        Math.sqrt(Math.pow(end.x - start.x, 2) + Math.pow(end.y - start.y, 2)) / 5
      );

      // Add some randomness to the control points
      const controlPoint1 = {
        x: start.x + (end.x - start.x) / 3 + (Math.random() * 100 - 50),
        y: start.y + (end.y - start.y) / 3 + (Math.random() * 100 - 50),
      };

      const controlPoint2 = {
        x: start.x + (2 * (end.x - start.x)) / 3 + (Math.random() * 100 - 50),
        y: start.y + (2 * (end.y - start.y)) / 3 + (Math.random() * 100 - 50),
      };

      // Calculate points along the Bezier curve
      for (let j = 0; j <= segmentPoints; j++) {
        const t = j / segmentPoints;
        const point = this.bezierPoint(start, controlPoint1, controlPoint2, end, t);
        path.push(point);
      }
    }

    return path;
  }

  /**
   * Calculate a point on a cubic Bezier curve
   */
  private bezierPoint(p0: Point, p1: Point, p2: Point, p3: Point, t: number): Point {
    const x =
      Math.pow(1 - t, 3) * p0.x +
      3 * Math.pow(1 - t, 2) * t * p1.x +
      3 * (1 - t) * Math.pow(t, 2) * p2.x +
      Math.pow(t, 3) * p3.x;

    const y =
      Math.pow(1 - t, 3) * p0.y +
      3 * Math.pow(1 - t, 2) * t * p1.y +
      3 * (1 - t) * Math.pow(t, 2) * p2.y +
      Math.pow(t, 3) * p3.y;

    return { x, y };
  }

  /**
   * Get a random typo for a character
   */
  private getRandomTypo(char: string): string {
    // Keyboard layout adjacency map for common typos
    const adjacentKeys: Record<string, string[]> = {
      a: ['q', 'w', 's', 'z'],
      s: ['a', 'w', 'd', 'z', 'x'],
      d: ['s', 'e', 'f', 'c', 'x'],
      f: ['d', 'r', 'g', 'v', 'c'],
      // Add more mappings as needed
    };

    // Default to a random letter if no mapping exists
    if (!adjacentKeys[char.toLowerCase()]) {
      const letters = 'abcdefghijklmnopqrstuvwxyz';
      return letters.charAt(Math.floor(Math.random() * letters.length));
    }

    // Get a random adjacent key
    const adjacent = adjacentKeys[char.toLowerCase()];
    return adjacent[Math.floor(Math.random() * adjacent.length)];
  }

  /**
   * Wait for a random amount of time
   */
  private async randomDelay(min: number, max: number): Promise<void> {
    const delay = Math.floor(Math.random() * (max - min + 1) + min);
    await new Promise(resolve => setTimeout(resolve, delay));
  }
}
