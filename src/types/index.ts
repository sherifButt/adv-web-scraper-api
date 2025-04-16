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
  host?: string;
  ip?: string;
  port?: number;
  country?: string;
  city?: string;
  region?: string;
  asn?: string;
  org?: string;
  isp?: string;
  type?: 'http' | 'https' | 'socks4' | 'socks5';
  protocols?: string[];
  anonymityLevel?: string;
  minSpeed?: number;
  maxLatency?: number;
  minUpTime?: number;
  minSuccessRate?: number;
  session?: string;
  rotating?: boolean;
}

export interface ProxyInfo {
  _id?: string; // From JSON
  ip: string; // From JSON (used instead of host)
  port: number; // From JSON (needs conversion from string)
  protocols?: ('http' | 'https' | 'socks4' | 'socks5')[]; // From JSON
  username?: string; // Keep for potential auth
  password?: string; // Keep for potential auth
  anonymityLevel?: string; // From JSON
  asn?: string; // From JSON
  city?: string; // From JSON
  country?: string; // From JSON
  region?: string | null; // From JSON
  org?: string; // From JSON
  isp?: string; // From JSON
  google?: boolean; // From JSON
  speed?: number; // From JSON
  latency?: number; // From JSON
  responseTime?: number; // From JSON
  upTime?: number; // From JSON
  upTimeSuccessCount?: number; // From JSON
  upTimeTryCount?: number; // From JSON
  workingPercent?: number | null; // From JSON
  lastChecked?: number; // From JSON (Unix timestamp)
  created_at?: string; // From JSON (ISO Date string)
  updated_at?: string; // From JSON (ISO Date string)
  // Internal/Calculated fields
  successRate?: number; // Calculated internally
  lastUsed?: string; // Set internally (ISO Date string)
  // Deprecated/Removed fields
  // host?: string; // Replaced by ip
  // type?: 'http' | 'https' | 'socks4' | 'socks5'; // Replaced by protocols array
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
    | 'executeScript'
    | 'mousemove'
    | 'hover';
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

// Export navigation types
export * from '../navigation/types/navigation.types.js';
export * from '../navigation/types/step-handler.interface.js';

// Export AI generation types
export * from './ai-generation.types.js';
