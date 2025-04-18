import { logger } from '../../../utils/logger.js';

// Mapping from model name prefixes to provider names
export const MODEL_PROVIDER_MAP: { [prefix: string]: string } = {
  'gpt-': 'openai',
  'deepseek-': 'deepseek',
  'claude-': 'anthropic',
  // Add more prefixes as needed
};

// Function to determine the provider from a model name
export function getProviderFromModel(modelName: string): string | null {
  for (const prefix in MODEL_PROVIDER_MAP) {
    if (modelName.startsWith(prefix)) {
      return MODEL_PROVIDER_MAP[prefix];
    }
  }
  logger.warn(`Could not determine provider for model: ${modelName}`);
  return null; // Or handle unknown models differently
}

// Model cost definitions (moved from ai-generation.types.ts)
export const MODEL_COSTS = {
  // OpenAI models
  'gpt-4o': {
    input: 0.0025 / 1000, // $2.50 per 1M tokens
    output: 0.01 / 1000, // $10.00 per 1M tokens
  },
  'gpt-4o-mini': {
    input: 0.00015 / 1000, // $0.15 per 1M tokens
    output: 0.0006 / 1000, // $0.60 per 1M tokens
  },
  // NOTE: Using gpt-4o-mini costs as placeholder for gpt-4.1-mini
  'gpt-4.1-mini': {
    input: 0.00015 / 1000,
    output: 0.0006 / 1000,
  },
  'gpt-4': {
    input: 0.03 / 1000, // $30.00 per 1M tokens
    output: 0.06 / 1000, // $60.00 per 1M tokens
  },
  'gpt-3.5-turbo': {
    input: 0.003 / 1000, // $3.00 per 1M tokens
    output: 0.006 / 1000, // $6.00 per 1M tokens
  },

  // DeepSeek models (Assuming costs remain the same, adjust if necessary)
  'deepseek-reasoner': {
    input: 0.0015 / 1000,
    output: 0.0025 / 1000,
  },
  'deepseek-chat': {
    input: 0.001 / 1000,
    output: 0.002 / 1000,
  },

  // Anthropic models
  'claude-3-7-sonnet-20250219': {
    input: 3 / 1_000_000, // $3 / 1M input tokens
    output: 15 / 1_000_000, // $15 / 1M output tokens
  },
  'claude-3-5-sonnet-20240620': {
    input: 3 / 1_000_000, // $3 / 1M input tokens
    output: 15 / 1_000_000, // $15 / 1M output tokens
  },
  // Add other models like Opus, Haiku if needed
};

// Type definition for cost structure (optional, but good practice)
export interface ModelCost {
  input: number; // Cost per input token
  output: number; // Cost per output token
}

// Type definition for the MODEL_COSTS map
export type ModelCostMap = {
  [modelName: string]: ModelCost;
};
