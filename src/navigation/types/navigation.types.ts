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
  // Properties for ClickStepHandler
  clickMethod?: 'single' | 'double' | 'keyboard'; // Default: 'single'
  button?: 'left' | 'right' | 'middle'; // Default: 'left'
  modifiers?: Array<'Alt' | 'Control' | 'Meta' | 'Shift'>; // Optional modifier keys
  position?: { x: number; y: number }; // Optional click position within element
  force?: boolean; // Optional: Force click, bypass actionability checks
  // Properties for MouseStepHandler (including drag/wheel)
  triggerType?: 'mouse' | 'keyboard'; // Kept for potential other uses, but clickMethod is preferred for clicks
  dragTo?: any;
  deltaX?: number;
  deltaY?: number;
  maxPages?: number;
  extractSteps?: NavigationStep[];
  script?: string | (() => string);
  result?: boolean;
  step?: number; // Added for GotoStep
  description?: string; // Optional description for logging/debugging
  optional?: boolean; // Allow step to fail without stopping the flow
  usePageScope?: boolean; // Added: Force extraction scope to page, ignoring currentItemHandle
  waitForPopup?: boolean; // Added: For click steps, wait for a popup/new tab event triggered by the click

  // New properties for structured mouse/drag/wheel parameters (used in MouseStepHandler refactor)
  mouseTarget?: {
    selector?: string;
    x?: number;
    y?: number;
    offsetX?: number; // Optional offset from element center/corner
    offsetY?: number; // Optional offset from element center/corner
  }; // Renamed from 'target' - Alternative to top-level selector/x/y for move/click target
  startPoint?: { x: number; y: number }; // Alternative to first element in pathPoints
  endPoint?: {
    selector?: string;
    x?: number;
    y?: number;
    offsetX?: number; // Optional offset from element center/corner
    offsetY?: number; // Optional offset from element center/corner
  }; // Alternative to dragTo for drag target
  delta?: { x?: number; y?: number }; // Alternative to deltaX/deltaY for wheel action

  // Randomization options for mousemove
  randomizeOffset?: boolean | number; // True for default range, or number for max pixel offset
  delayBeforeAction?: { min: number; max: number } | number; // Delay in ms before action (click, drag start, wheel)
  delayAfterAction?: { min: number; max: number } | number; // Delay in ms after action (click, drag end, wheel)

  // --- Enhanced Wait Options ---
  waitForState?: 'visible' | 'attached' | 'detached' | 'hidden'; // Removed 'stable'. Optional: Wait for a specific element state before proceeding (applies if selector is present)
  waitForNetworkIdle?: boolean; // Optional: Wait for network activity to cease before proceeding
  networkIdleTimeout?: number; // Optional: Timeout for network idle wait (default: 30000)
  // ---------------------------------
  
  // --- Input Specific ---
  useFocusedElement?: boolean; // Optional: If true, type into the currently focused element without specifying a selector
  // ----------------------
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
 * Specific type for the 'mergeContext' action
 */
export interface MergeContextStep extends NavigationStep {
  type: 'mergeContext';
  source: string; // Key in context to get data from (e.g., 'panelData')
  target: string; // Key in context to merge into (e.g., 'trendsData.trends[{{index}}]')
  mergeStrategy?: { [key: string]: 'overwrite' | 'union' | 'append' | 'ignore' }; // Optional per-field strategy
  defaultMergeStrategy?: 'overwrite' | 'union' | 'append' | 'ignore'; // Default strategy if not specified per field
}

/**
 * Specific type for the 'assert' action
 */
export interface AssertStep extends NavigationStep {
  type: 'assert';
  selector: string; // Selector for the element to assert against
  assertionType: // Type of assertion to perform
  | 'exists' // Check if element exists in the DOM
    | 'isVisible' // Check if element is visible
    | 'isHidden' // Check if element is hidden
    | 'containsText' // Check if element contains specific text
    | 'hasAttribute' // Check if element has a specific attribute
    | 'attributeEquals'; // Check if element's attribute has a specific value
  expectedValue?: string | RegExp; // Value to compare against (for text/attribute checks)
  attributeName?: string; // Attribute name (for attribute checks)
  timeout?: number; // Optional timeout for the assertion check
  optional?: boolean; // If true, failure doesn't stop the flow (defaults to false)
  description?: string; // Optional description for logging
}

/**
 * Specific type for the 'login' action
 */
export interface LoginStep extends NavigationStep {
  type: 'login';
  usernameSelector: string; // Selector for the username/email input field
  passwordSelector: string; // Selector for the password input field
  submitSelector: string; // Selector for the submit button
  usernameValue: string; // Username or email to input (can use context variables)
  passwordValue: string; // Password to input (can use context variables, consider security implications)
  strategy?: 'standard' | string; // Optional: 'standard' or custom identifier for complex flows (e.g., SSO)
  waitForNavigation?: boolean | string | number; // Optional: Wait condition after clicking submit (default: true, waits for navigation)
  description?: string; // Optional description for logging
}

/**
 * Specific type for the 'switchToFrame' action
 */
export interface SwitchToFrameStep extends NavigationStep {
  type: 'switchToFrame';
  selector?: string; // Selector to identify the iframe element
  frameId?: string; // ID of the frame
  frameName?: string; // Name of the frame
  steps: NavigationStep[]; // Steps to execute within the iframe context
  switchToDefault?: boolean; // Whether to switch back to the main context afterwards (default: true)
  description?: string; // Optional description for logging
}

/**
 * Specific type for the 'uploadFile' action
 */
export interface UploadFileStep extends NavigationStep {
  type: 'uploadFile';
  selector: string; // Selector for the <input type="file"> element
  filePath: string; // Path to the file to upload (relative to worker or absolute)
  description?: string; // Optional description for logging
}

/**
 * Specific type for the 'handleDialog' action
 */
export interface HandleDialogStep extends NavigationStep {
  type: 'handleDialog';
  action: 'accept' | 'dismiss'; // Whether to accept or dismiss the dialog
  promptText?: string; // Optional text to enter for prompt dialogs
  description?: string; // Optional description for logging
}

/**
 * Specific type for the 'manageCookies' action
 */
export interface ManageCookiesStep extends NavigationStep {
  type: 'manageCookies';
  action: 'add' | 'delete' | 'clear' | 'get'; // Action to perform
  cookies?: Array<{
    // Required for 'add'
    name: string;
    value: string;
    url?: string; // Optional: Associates cookie with a URL
    domain?: string; // Optional: Cookie domain
    path?: string; // Optional: Cookie path
    expires?: number; // Optional: Unix timestamp for expiration
    httpOnly?: boolean; // Optional
    secure?: boolean; // Optional
    sameSite?: 'Strict' | 'Lax' | 'None'; // Optional
  }>;
  name?: string; // Required for 'delete', optional filter for 'get'
  domain?: string; // Optional filter for 'delete', 'clear', 'get'
  path?: string; // Optional filter for 'delete', 'clear', 'get'
  contextKey?: string; // Optional: Key to store result in context for 'get' action (default: 'retrievedCookies')
  description?: string; // Optional description for logging
}

/**
 * Specific type for the 'manageStorage' action (localStorage/sessionStorage)
 */
export interface ManageStorageStep extends NavigationStep {
  type: 'manageStorage';
  storageType: 'local' | 'session'; // Type of storage to interact with
  action: 'setItem' | 'getItem' | 'removeItem' | 'clear'; // Action to perform
  key?: string; // Required for setItem, getItem, removeItem
  value?: any; // Required for setItem (will be JSON.stringified)
  contextKey?: string; // Optional: Key to store result in context for 'getItem' action (default: 'retrievedStorageItem')
  description?: string; // Optional description for logging
}

/**
 * Specific type for the 'switchTab' action
 */
export interface SwitchTabStep extends NavigationStep {
  type: 'switchTab';
  action: 'switch' | 'new' | 'close' | 'waitForNew' | 'switchToLast'; // Added 'switchToLast'
  target?: number | string; // Tab index (0-based) or URL/Title pattern (regex string) for 'switch'/'close'
  url?: string; // URL to open for 'new' action
  waitFor?: string | number; // Optional wait condition after switching/opening/closing
  contextKey?: string; // Optional: Key to store the new page object in context for 'new'/'waitForNew' action (default: 'newPage')
  description?: string; // Optional description for logging
}

// --- Specific Step Type Interfaces ---

// Playwright's valid modifier keys
export type KeyboardModifier = 'Alt' | 'Control' | 'Meta' | 'Shift';

// Interface for the 'press' step
export interface PressStep extends NavigationStep {
  type: 'press';
  /** The key to press (e.g., 'Enter', 'Tab', 'A', 'ArrowDown', '$').
   *  Should match Playwright's key names: https://playwright.dev/docs/api/class-keyboard#keyboard-press
   */
  key: string;
  /** Optional array of modifier keys to hold during the press. */
  modifiers?: KeyboardModifier[];
  /** Optional: Specify 'down' or 'up' for holding/releasing keys. Defaults to a full 'press' (down + up). */
  action?: 'press' | 'down' | 'up';
  /** Optional delay (ms) between key down and key up for 'press' action. */
  delay?: number;
  /** Optional selector to focus before pressing the key. */
  selector?: string;
  // Inherits optional, description, timeout, waitFor, etc. from NavigationStep
}

/**
 * Result object returned by step handlers, potentially indicating a jump or page change.
 */
export interface StepResult {
  gotoStepIndex?: number; // 0-based index to jump to
  newPage?: Page | null; // Optional: The new page object if the active page changed (e.g., after switchTab, newTab, close)
  // Add other potential result properties here if needed
}
