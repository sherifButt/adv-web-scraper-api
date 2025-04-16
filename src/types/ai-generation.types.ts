// src/types/ai-generation.types.ts

/**
 * Request to generate a scraping configuration using AI
 */
export interface GenerateConfigRequest {
  /**
   * The URL of the website to scrape
   */
  url: string;

  /**
   * Natural language prompt describing what data to extract and how to navigate
   */
  prompt: string;

  /**
   * Optional configuration options
   */
  options?: GenerateConfigOptions;
}

/**
 * Options for configuration generation
 */
export interface GenerateConfigOptions {
  /**
   * Maximum number of iterations for testing and fixing
   * @default 3
   */
  maxIterations?: number;

  /**
   * Whether to test the generated configuration
   * @default true
   */
  testConfig?: boolean;

  /**
   * Model to use for generation
   * @default "gpt-4"
   */
  model?: string;

  /**
   * Maximum tokens to use for generation
   * @default 8192
   */
  maxTokens?: number;

  /**
   * Temperature for generation
   * @default 0.7
   */
  temperature?: number;

  /**
   * Browser options for testing
   */
  browserOptions?: {
    /**
     * Whether to run in headless mode
     * @default true
     */
    headless?: boolean;

    /**
     * Whether to use a proxy
     * @default false
     */
    proxy?: boolean;
  };
}

/**
 * Status of a configuration generation job
 */
export interface GenerateConfigStatus {
  /**
   * Job ID
   */
  id: string;

  /**
   * URL being scraped
   */
  url: string;

  /**
   * Current status of the job
   */
  status: 'pending' | 'generating' | 'testing' | 'fixing' | 'completed' | 'failed';

  /**
   * Detailed status message
   */
  statusMessage: string;

  /**
   * Current iteration (1-based)
   */
  currentIteration?: number;

  /**
   * Maximum iterations
   */
  maxIterations?: number;

  /**
   * Tokens used so far
   */
  tokensUsed?: number;

  /**
   * Estimated cost so far
   */
  estimatedCost?: number;

  /**
   * Generated configuration (if completed)
   */
  config?: any;

  /**
   * Error message (if failed)
   */
  error?: string;

  /**
   * Timestamp
   */
  timestamp: string;
}

/**
 * Result of a configuration generation job
 */
export interface GenerateConfigResult {
  /**
   * Job ID
   */
  id: string;

  /**
   * URL being scraped
   */
  url: string;

  /**
   * Status of the job
   */
  status: 'completed' | 'failed';

  /**
   * Generated configuration
   */
  config?: any;

  /**
   * Error message
   */
  error?: string;

  /**
   * Tokens used
   */
  tokensUsed: number;

  /**
   * Estimated cost
   */
  estimatedCost: number;

  /**
   * Number of iterations required
   */
  iterations: number;

  /**
   * Timestamp
   */
  timestamp: string;
}

/**
 * Internal state for the generate-config worker
 */
export interface GenerateConfigState {
  /**
   * URL being scraped
   */
  url: string;

  /**
   * Prompt for generation
   */
  prompt: string;

  /**
   * Options for generation
   */
  options: Required<GenerateConfigOptions>;

  /**
   * Current iteration (0-based)
   */
  iteration: number;

  /**
   * Total tokens used
   */
  tokensUsed: number;

  /**
   * Estimated cost
   */
  estimatedCost: number;

  /**
   * Current status
   */
  currentStatus: string;

  /**
   * Last configuration
   */
  lastConfig: any;

  /**
   * Last error
   */
  lastError: string | null;

  /**
   * Test result
   */
  testResult: any;
}

/**
 * AI model response
 */
export interface AiModelResponse {
  /**
   * Generated configuration
   */
  config: any;

  /**
   * Tokens used
   */
  tokensUsed: number;

  /**
   * Model used
   */
  model: string;
}

/**
 * Cost calculation for different models
 */
export const MODEL_COSTS = {
  'gpt-4': {
    input: 0.00003, // $0.03 per 1K tokens
    output: 0.00006, // $0.06 per 1K tokens
  },
  'gpt-3.5-turbo': {
    input: 0.000001, // $0.001 per 1K tokens
    output: 0.000002, // $0.002 per 1K tokens
  },
};
