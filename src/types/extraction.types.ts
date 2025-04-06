// src/types/extraction.types.ts

/**
 * Supported selector types for data extraction
 */
export enum SelectorType {
  CSS = 'css',
  XPATH = 'xpath',
  REGEX = 'regex',
  FUNCTION = 'function',
}

/**
 * Supported data types for extracted values
 */
export enum DataType {
  STRING = 'string',
  NUMBER = 'number',
  BOOLEAN = 'boolean',
  DATE = 'date',
  OBJECT = 'object',
  ARRAY = 'array',
}

/**
 * Base interface for all selector configurations
 */
export interface BaseSelectorConfig {
  type: SelectorType;
  name: string;
  required?: boolean;
  defaultValue?: any;
  transform?: string | ((value: any, context?: any) => any);
  dataType?: DataType;
}

/**
 * CSS selector configuration
 */
export interface CssSelectorConfig extends BaseSelectorConfig {
  type: SelectorType.CSS;
  selector: string;
  attribute?: string; // If not provided, innerText is used
  multiple?: boolean; // If true, returns an array of matches
}

/**
 * XPath selector configuration
 */
export interface XPathSelectorConfig extends BaseSelectorConfig {
  type: SelectorType.XPATH;
  selector: string;
  attribute?: string; // If not provided, innerText is used
  multiple?: boolean; // If true, returns an array of matches
}

/**
 * Regex selector configuration
 */
export interface RegexSelectorConfig extends BaseSelectorConfig {
  type: SelectorType.REGEX;
  pattern: string;
  flags?: string;
  group?: number; // Capture group to extract, defaults to 0 (entire match)
  multiple?: boolean; // If true, returns an array of matches
  source?: string; // Source to apply regex to (e.g., 'html', 'text', or a CSS/XPath selector)
}

/**
 * Function selector configuration
 */
export interface FunctionSelectorConfig extends BaseSelectorConfig {
  type: SelectorType.FUNCTION;
  function: string | ((page: any, context?: any) => Promise<any>);
}

/**
 * Union type for all selector configurations
 */
export type SelectorConfig =
  | CssSelectorConfig
  | XPathSelectorConfig
  | RegexSelectorConfig
  | FunctionSelectorConfig;

/**
 * Field configuration for object extraction
 */
export interface FieldConfig {
  [fieldName: string]: SelectorConfig | NestedExtractionConfig;
}

/**
 * Configuration for nested object extraction
 */
export interface NestedExtractionConfig {
  selector: string;
  type: SelectorType.CSS | SelectorType.XPATH;
  multiple?: boolean;
  fields: FieldConfig;
}

/**
 * Complete extraction configuration
 */
export interface ExtractionConfig {
  url?: string;
  fields: FieldConfig;
  pagination?: PaginationConfig;
  validation?: ValidationConfig;
  options?: ExtractionOptions;
}

/**
 * Pagination configuration
 */
export interface PaginationConfig {
  type: 'click' | 'url' | 'infinite-scroll';
  selector?: string; // For 'click' type
  urlPattern?: string; // For 'url' type
  pageParam?: string; // For 'url' type
  maxPages?: number;
  waitFor?: string | number; // Selector to wait for or timeout in ms
}

/**
 * Validation configuration
 */
export interface ValidationConfig {
  schema?: any; // JSON Schema for validation
  custom?: (data: any) => boolean | Promise<boolean>;
  required?: string[]; // List of required fields
}

/**
 * Extraction options
 */
export interface ExtractionOptions {
  timeout?: number;
  waitForSelector?: string;
  waitForTimeout?: number;
  javascript?: boolean;
  proxy?: boolean;
  humanEmulation?: boolean;
  solveCaptcha?: boolean;
  headers?: Record<string, string>;
  cookies?: Record<string, string>;
  browser?: {
    type?: 'chromium' | 'firefox' | 'webkit';
    headless?: boolean;
    args?: string[];
  };
}

/**
 * Extraction result
 */
export interface ExtractionResult {
  id: string;
  url: string;
  status: 'completed' | 'failed' | 'partial';
  data: any;
  error?: string;
  stats?: {
    startTime: string;
    endTime: string;
    duration: number;
    pagesProcessed: number;
    itemsExtracted: number;
  };
  timestamp: string;
}

/**
 * Extraction job status
 */
export interface ExtractionJobStatus {
  id: string;
  url: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  progress?: {
    pagesProcessed: number;
    itemsExtracted: number;
    estimatedTimeRemaining?: number;
  };
  timestamp: string;
}

/**
 * Transformation function type
 */
export type TransformFunction = (value: any, context?: any) => any;

/**
 * Validation function type
 */
export type ValidationFunction = (data: any) => boolean | Promise<boolean>;
