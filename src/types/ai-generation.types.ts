export interface AiModelResponse {
  config: any;
  tokensUsed: number;
  model: string;
  cost: number;
}

export interface GenerateConfigRequest {
  url: string;
  prompt: string;
  selectors?: Record<string, string>;
  options?: GenerateConfigOptions;
}

export interface GenerateConfigState {
  status: 'pending' | 'processing' | 'completed' | 'failed';
  progress: number;
  message: string;
  url: string;
  prompt: string;
  options: Required<GenerateConfigOptions>;
  iteration: number;
  tokensUsed: number;
  estimatedCost: number;
  currentStatus: string;
  lastConfig: any | null;
  lastError: string | null;
  testResult: any | null;
}

export interface GenerateConfigResult {
  id: string;
  url: string;
  status: string;
  config: any;
  state?: GenerateConfigState; // Made optional since it's not always provided
  tokensUsed: number;
  estimatedCost: number; // Ensure this is explicitly part of the final result
  iterations: number;
  timestamp: string;
}

export interface GenerateConfigOptions {
  model: string;
  maxTokens: number;
  temperature: number;
  maxIterations?: number;
  testConfig?: boolean;
  browserOptions?: {
    headless?: boolean;
    timeout?: number;
    proxy?: boolean;
    viewport?: {
      width: number;
      height: number;
    };
  };
  interactionHints?: string[]; // Add optional hints for dynamic content
}

export interface LLMAdapter {
  generate(options: {
    systemPrompt: string;
    userPrompt: string;
    maxTokens?: number;
    temperature?: number;
  }): Promise<LLMResponse>;
}

export interface LLMResponse {
  config: any;
  usage: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
}

export const DEFAULT_OPTIONS: Required<GenerateConfigOptions> = {
  model: 'gpt-4o-mini',
  maxTokens: 2000,
  temperature: 0.7,
  maxIterations: 3,
  testConfig: false,
  browserOptions: {
    headless: true,
    timeout: 30000,
    viewport: {
      width: 1280,
      height: 800,
    },
  },
  interactionHints: [], // Add default empty array for the new required property
};
