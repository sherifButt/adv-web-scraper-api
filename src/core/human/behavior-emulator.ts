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
      mouseSpeed: 0.8,
      clickDelay: [50, 150],
      typeSpeed: [30, 100],
      typoRate: 0.01,
      scrollSpeed: [300, 800],
      thinkingTime: [200, 500],
    },
    average: {
      mouseSpeed: 0.5,
      clickDelay: [100, 300],
      typeSpeed: [80, 200],
      typoRate: 0.03,
      scrollSpeed: [200, 500],
      thinkingTime: [500, 1500],
    },
    careful: {
      mouseSpeed: 0.3,
      clickDelay: [200, 500],
      typeSpeed: [150, 350],
      typoRate: 0.05,
      scrollSpeed: [100, 300],
      thinkingTime: [1000, 3000],
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
  public async moveMouseToElement(selector: string): Promise<void> {
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

    await this.moveMouseToPosition(targetX, targetY);
  }

  /**
   * Move the mouse to a specific position with human-like motion
   */
  public async moveMouseToPosition(x: number, y: number): Promise<void> {
    // Get current mouse position or use a default starting point
    const mouse = this.page.mouse;
    // Playwright doesn't expose current mouse position, so we'll use the viewport center as a starting point
    // if this is the first movement, or the target coordinates of the previous movement otherwise
    const viewportSize = this.page.viewportSize() || { width: 1280, height: 720 };
    const startX = viewportSize.width / 2; // Default to center of viewport
    const startY = viewportSize.height / 2;

    // Generate a natural path using Bezier curves
    const points = this.generateNaturalPath({ x: startX, y: startY }, { x, y });

    // Move through points with variable speed
    for (let i = 0; i < points.length; i++) {
      const point = points[i];
      await mouse.move(point.x, point.y);
      
      // Variable delay between movements
      if (i < points.length - 1) {
        await this.randomDelay(5, 15);
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
  public async scroll(direction: 'up' | 'down', distance?: number): Promise<void> {
    const scrollDistance =
      distance ||
      Math.floor(
        Math.random() * (this.profile.scrollSpeed[1] - this.profile.scrollSpeed[0]) +
          this.profile.scrollSpeed[0]
      );
    
    // Scroll in smaller increments for more natural movement
    const steps = Math.floor(scrollDistance / 50) + 1;
    const increment = scrollDistance / steps;
    
    for (let i = 0; i < steps; i++) {
      const stepDistance = direction === 'down' ? increment : -increment;
      await this.page.mouse.wheel(0, stepDistance);
      await this.randomDelay(10, 30);
    }
    
    // Pause after scrolling
    await this.randomDelay(300, 800);
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
  private generateNaturalPath(start: Point, end: Point): Point[] {
    const points: Point[] = [];
    const numPoints = Math.floor(
      Math.sqrt(Math.pow(end.x - start.x, 2) + Math.pow(end.y - start.y, 2)) / 10
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
    for (let i = 0; i <= numPoints; i++) {
      const t = i / numPoints;
      const point = this.bezierPoint(start, controlPoint1, controlPoint2, end, t);
      points.push(point);
    }
    
    return points;
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
