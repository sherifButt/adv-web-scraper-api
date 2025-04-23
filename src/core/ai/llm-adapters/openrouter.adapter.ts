// src/core/ai/llm-adapters/openrouter.adapter.ts
import axios from 'axios';
import type { LLMAdapter, LLMGenerateResponse } from './llm-adapter.interface.js';
import { logger } from '../../../utils/logger.js';

export class OpenRouterAdapter implements LLMAdapter {
  private apiKey: string;

  constructor(apiKey: string) {
    this.apiKey = apiKey;
  }

  private transformModelName(modelName: string): string {
    // Check if the model already includes a provider prefix
    if (modelName.startsWith('google/') || 
        modelName.startsWith('anthropic/') || 
        modelName.startsWith('openai/') || 
        modelName.startsWith('mistral/')) {
      // Return the model name as is - do not add openrouter prefix
      return modelName;
    }
    
    // If the model name already starts with openrouter/, strip it to avoid double prefixing
    if (modelName.startsWith('openrouter/')) {
      return modelName.substring(11);
    }
    
    // No provider prefix found, return as is
    return modelName;
  }

  async generate(options: {
    model: string;
    systemPrompt: string;
    userPrompt: string;
    maxTokens?: number;
    temperature?: number;
  }): Promise<LLMGenerateResponse> {
    try {
      const openRouterModel = this.transformModelName(options.model);
      logger.debug(`Using OpenRouter model: ${openRouterModel}`);

      const requestBody = {
        model: openRouterModel,
        messages: [
          { role: 'system', content: options.systemPrompt },
          { role: 'user', content: options.userPrompt },
        ],
        max_tokens: options.maxTokens || 2000,
        temperature: options.temperature || 0.7,
      };

      logger.debug(`OpenRouter request body: ${JSON.stringify(requestBody, null, 2)}`);

      const response = await axios.post(
        'https://openrouter.ai/api/v1/chat/completions',
        requestBody,
        {
          headers: {
            Authorization: `Bearer ${this.apiKey}`,
            'Content-Type': 'application/json',
            'HTTP-Referer': 'https://github.com/yourusername/adv-web-scraper-api', // Required by OpenRouter
            'X-Title': 'Advanced Web Scraper API', // Required by OpenRouter
          },
        }
      );

      logger.debug('OpenRouter raw response:', response.data);

      const data = response.data;

      if (!data.choices || data.choices.length === 0) {
        throw new Error('No choices returned from OpenRouter API');
      }

      const content = data.choices[0]?.message?.content;
      if (!content) {
        throw new Error('No content in OpenRouter response');
      }

      // Try to parse the content as JSON
      let parsedConfig;
      try {
        // First try to extract JSON from markdown code blocks if present
        const jsonMatch = content.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
        if (jsonMatch) {
          parsedConfig = JSON.parse(jsonMatch[1]);
        } else {
          // If no code blocks, try parsing the entire content
          parsedConfig = JSON.parse(content);
        }
      } catch (parseError: any) {
        logger.error('Failed to parse OpenRouter response as JSON:', {
          content,
          error: parseError.message,
        });
        throw new Error(`OpenRouter response is not valid JSON: ${parseError.message}`);
      }

      if (!parsedConfig || typeof parsedConfig !== 'object') {
        throw new Error('OpenRouter response did not contain a valid JSON object');
      }

      const usage = data.usage || { prompt_tokens: 0, completion_tokens: 0, total_tokens: 0 };

      return {
        config: parsedConfig,
        usage: {
          prompt_tokens: usage.prompt_tokens || 0,
          completion_tokens: usage.completion_tokens || 0,
          total_tokens: usage.total_tokens || 0,
        },
      };
    } catch (error: any) {
      // Enhance error logging
      if (error.response) {
        // The request was made and the server responded with a status code
        // that falls out of the range of 2xx
        logger.error(`OpenRouter API error (${error.response.status}):`, {
          status: error.response.status,
          statusText: error.response.statusText,
          data: error.response.data,
          headers: error.response.headers,
        });
      } else if (error.request) {
        // The request was made but no response was received
        logger.error('OpenRouter API no response:', error.request);
      } else {
        // Something happened in setting up the request that triggered an Error
        logger.error('OpenRouter API request setup error:', error.message);
      }
      
      throw error;
    }
  }
}
