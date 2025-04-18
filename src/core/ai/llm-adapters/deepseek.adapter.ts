import axios from 'axios';
import type { LLMAdapter, LLMGenerateResponse, ModelOptions } from './llm-adapter.interface.js'; // Updated import
import { logger } from '../../../utils/logger.js';

export class DeepSeekAdapter implements LLMAdapter {
  private apiKey: string;
  private baseUrl = 'https://api.deepseek.com/v1';

  constructor(apiKey: string) {
    this.apiKey = apiKey;
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
      const response = await axios.post(
        `${this.baseUrl}/chat/completions`,
        {
          model: options.model, // Use the provided model name
          messages: [
            { role: 'system', content: options.systemPrompt },
            { role: 'user', content: options.userPrompt },
          ],
          max_tokens: options.maxTokens || 2000,
          temperature: options.temperature || 0.7,
          // response_format: { type: 'json_object' }, // Removed: May not be supported by all models
        },
        {
          headers: {
            Authorization: `Bearer ${this.apiKey}`,
            'Content-Type': 'application/json',
          },
        }
      );

      const content = response.data.choices[0]?.message?.content;
      if (!content) {
        throw new Error('No content in DeepSeek response');
      }

      // Attempt to parse the content as JSON, handle potential errors
      let parsedConfig: any;
      try {
        parsedConfig = JSON.parse(content);
      } catch (parseError: any) {
        logger.error(`DeepSeek response content is not valid JSON: ${parseError.message}`, { content });
        // Throw a specific error if JSON parsing fails, as the rest of the system expects JSON config
        throw new Error(`DeepSeek model did not return valid JSON output.`);
      }

      return {
        config: parsedConfig,
        usage: {
          prompt_tokens: response.data.usage?.prompt_tokens || 0,
          completion_tokens: response.data.usage?.completion_tokens || 0,
          total_tokens: response.data.usage?.total_tokens || 0,
        },
      };
    } catch (error) {
      logger.error('DeepSeek API error:', error);
      throw error;
    }
  }
}
