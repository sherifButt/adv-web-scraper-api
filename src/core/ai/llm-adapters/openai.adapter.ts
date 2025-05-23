import { OpenAI } from 'openai';
import type { LLMAdapter, LLMGenerateResponse, ModelOptions } from './llm-adapter.interface.js'; // Updated import
import { logger } from '../../../utils/logger.js';

export class OpenAIAdapter implements LLMAdapter {
  private client: OpenAI;

  constructor(apiKey: string) {
    this.client = new OpenAI({
      apiKey: apiKey,
    });
  }

  async generate(options: {
    model: string; // Added model parameter
    systemPrompt: string;
    userPrompt: string;
    maxTokens?: number;
    temperature?: number;
  }): Promise<LLMGenerateResponse> {
    // Updated return type
    try {
      const response = await this.client.chat.completions.create({
        model: options.model, // Use the provided model name
        messages: [
          { role: 'system', content: options.systemPrompt },
          { role: 'user', content: options.userPrompt },
        ],
        max_tokens: options.maxTokens || 2000,
        temperature: options.temperature || 0.7,
        response_format: { type: 'json_object' },
      });

      const content = response.choices[0]?.message?.content;
      if (!content) {
        throw new Error('No content in OpenAI response');
      }

      return {
        config: JSON.parse(content),
        usage: {
          prompt_tokens: response.usage?.prompt_tokens || 0,
          completion_tokens: response.usage?.completion_tokens || 0,
          total_tokens: response.usage?.total_tokens || 0,
        },
      };
    } catch (error) {
      logger.error('OpenAI API error:', error);
      throw error;
    }
  }
}
