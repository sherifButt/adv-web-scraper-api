import { Page, BrowserContext, ElementHandle } from 'playwright'; // Import ElementHandle here
import { CssSelectorConfig } from '../../types/extraction.types.js';
import { BehaviorEmulator } from '../../core/human/behavior-emulator.js';
import { CaptchaSolver } from '../../core/captcha/captcha-solver.js';
import { SessionManager } from '../../core/session/session-manager.js';

/**
 * Context for navigation operations
 */
export interface NavigationContext {
  [key: string]: any;
  // Optional properties for forEachElement loop context
  loopIndex?: number;
  currentItemHandle?: ElementHandle;
  resolvedTargetElement?: ElementHandle | null;
  resolvedTargetElements?: ElementHandle[] | null;
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
  step?: number; // Added for GotoStep
  description?: string; // Optional description for logging/debugging
}

/**
 * Specific type for the 'gotoStep' action
 */
export interface GotoStep extends NavigationStep {
  type: 'gotoStep';
  step: number; // Target step index (1-based)
}

/**
 * Specific type for the 'forEachElement' action
 */
export interface ForEachElementStep extends NavigationStep {
  type: 'forEachElement';
  selector: string; // Selector for the elements to iterate over
  elementSteps: NavigationStep[]; // Steps to execute for each element
  maxIterations?: number; // Optional limit on the number of elements processed
  description?: string; // Optional description for the loop step
}

/**
 * Result object returned by step handlers, potentially indicating a jump.
 */
export interface StepResult {
  gotoStepIndex?: number; // 0-based index to jump to
  // Add other potential result properties here if needed
}
