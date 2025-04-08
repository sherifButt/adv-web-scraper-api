/**
 * Common types used throughout the application
 */

// Scraping related types
export interface ScrapeRequest {
  url: string;
  selectors: Record<string, SelectorDefinition>;
  options?: ScrapeOptions;
}

export interface SelectorDefinition {
  selector: string;
  type: 'text' | 'html' | 'attribute' | 'property' | 'list';
  attribute?: string;
  property?: string;
  fields?: Record<string, SelectorDefinition>;
  transform?: string; // Function name or transformation string
}

export interface ScrapeOptions {
  javascript?: boolean;
  proxy?: boolean | ProxyOptions;
  humanEmulation?: boolean | HumanEmulationOptions;
  timeout?: number;
  waitFor?: string | number;
  headers?: Record<string, string>;
  cookies?: Record<string, string>;
  solveCaptcha?: boolean;
}

export interface ScrapeResult {
  id: string;
  url: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  data?: any;
  error?: string;
  timestamp: string;
}

// CAPTCHA related types
export interface CaptchaSolveRequest {
  url: string;
  captchaType: 'recaptcha' | 'hcaptcha' | 'image' | 'cloudflare';
  selector?: string;
  siteKey?: string;
  options?: CaptchaOptions;
}

export interface CaptchaOptions {
  proxy?: boolean | ProxyOptions;
  timeout?: number;
  service?: string;
}

export interface CaptchaSolveResult {
  success: boolean;
  token?: string;
  error?: string;
  timestamp: string;
}

// Proxy related types
export interface ProxyOptions {
  country?: string;
  type?: 'http' | 'https' | 'socks4' | 'socks5';
  session?: string;
  rotating?: boolean;
}

export interface ProxyInfo {
  host: string;
  port: number;
  type: 'http' | 'https' | 'socks4' | 'socks5';
  username?: string;
  password?: string;
  country?: string;
  responseTime?: number;
  successRate?: number;
  lastUsed?: string;
}

// Human emulation related types
export interface HumanEmulationOptions {
  profile?: 'fast' | 'average' | 'careful';
  mouseMovements?: boolean;
  scrolling?: boolean;
  typing?: boolean;
  typoRate?: number;
}

// Navigation related types
export interface NavigationRequest {
  startUrl: string;
  steps: NavigationStep[];
  variables?: Record<string, any>;
  options?: NavigationOptions;
}

import { FieldConfig } from './extraction.types.js';

export interface NavigationStep {
  type:
    | 'goto'
    | 'click'
    | 'input'
    | 'select'
    | 'wait'
    | 'extract'
    | 'condition'
    | 'paginate'
    | 'scroll'
    | 'executeScript';
  selector?: string;
  value?: string;
  waitFor?: string | number;
  timeout?: number;
  humanInput?: boolean;
  name?: string;
  fields?: FieldConfig;
  condition?: string;
  thenSteps?: NavigationStep[];
  elseSteps?: NavigationStep[];
  maxPages?: number;
  direction?: 'up' | 'down' | 'left' | 'right';
  distance?: number;
  script?: string;
  [key: string]: any;
}

export interface NavigationOptions extends ScrapeOptions {
  maxSteps?: number;
  maxTime?: number;
  screenshots?: boolean;
  screenshotsPath?: string;
  useSession?: boolean;
  alwaysCheckCaptcha?: boolean;
}

export interface NavigationResult {
  id: string;
  startUrl: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  stepsExecuted: number;
  result?: any;
  error?: string;
  screenshots?: string[];
  timestamp: string;
}

// API response type
export interface ApiResponse<T> {
  success: boolean;
  message: string;
  data?: T;
  error?: string;
  timestamp: string;
}

// Export extraction types
export * from './extraction.types.js';
