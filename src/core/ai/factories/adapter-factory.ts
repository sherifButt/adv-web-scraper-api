import { AnthropicAdapter } from '../llm-adapters/anthropic.adapter.js';
import { DeepSeekAdapter } from '../llm-adapters/deepseek.adapter.js';
import type { LLMAdapter } from '../llm-adapters/llm-adapter.interface.js';
import { OpenAIAdapter } from '../llm-adapters/openai.adapter.js';
import { logger } from '../../../utils/logger.js';
import { OpenRouterAdapter } from '../llm-adapters/openrouter.adapter.js'; // Import the OpenRouterAdapter

export class AdapterFactory {
  static create(provider: string, apiKey: string): LLMAdapter | null {
    try {
      switch (provider) {
        case 'openai':
          return new OpenAIAdapter(apiKey);
        case 'deepseek':
          return new DeepSeekAdapter(apiKey);
        case 'anthropic':
          return new AnthropicAdapter(apiKey);
        case 'openrouter': // Add a case for OpenRouter
          return new OpenRouterAdapter(apiKey);
        default:
          logger.warn(`Unsupported AI provider requested: ${provider}`);
          return null;
      }
    } catch (error: any) {
      logger.error(`Failed to create adapter for provider ${provider}: ${error.message}`);
      return null;
    }
  }
}
