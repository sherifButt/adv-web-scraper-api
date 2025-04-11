import { Page, BrowserContext } from 'playwright';
import { CssSelectorConfig } from '../../types/extraction.types.js';
import { BehaviorEmulator } from '../../core/human/behavior-emulator.js';
import { CaptchaSolver } from '../../core/captcha/captcha-solver.js';
import { SessionManager } from '../../core/session/session-manager.js';

/**
 * Context for navigation operations
 */
export interface NavigationContext {
  [key: string]: any;
}

/**
 * Result of a navigation flow execution
 */
export interface NavigationResult {
  id: string;
  startUrl: string;
  status: 'completed' | 'failed';
  stepsExecuted: number;
  result: NavigationContext;
  screenshots: string[];
  timestamp: string;
  error?: string;
}

/**
 * Options for navigation engine
 */
export interface NavigationOptions {
  humanEmulation?: boolean | object;
  solveCaptcha?: boolean;
  useSession?: boolean;
  screenshots?: boolean;
  screenshotsPath?: string;
  timeout?: number;
  maxSteps?: number;
  maxTime?: number;
  alwaysCheckCaptcha?: boolean;
}

/**
 * Base navigation step definition
 */
export interface NavigationStep {
  type: string;
  selector?: string | (() => string);
  value?: any;
  name?: string;
  timeout?: number;
  waitFor?: string | number;
  condition?: string | ((context: any, page: Page) => Promise<boolean>);
  thenSteps?: NavigationStep[];
  elseSteps?: NavigationStep[];
  fields?: Record<string, any>;
  list?: boolean;
  source?: string;
  clearInput?: boolean;
  humanInput?: boolean;
  scrollIntoView?: boolean;
  scrollMargin?: number;
  direction?: string;
  distance?: number;
  x?: number;
  y?: number;
  duration?: number;
  humanLike?: boolean;
  pathPoints?: Array<{ x: number; y: number } | { selector: string }>;
  action?: string;
  triggerType?: 'mouse' | 'keyboard';
  dragTo?: any;
  deltaX?: number;
  deltaY?: number;
  maxPages?: number;
  extractSteps?: NavigationStep[];
  script?: string | (() => string);
  result?: boolean;
}
