// src/core/ai/llm-adapters/anthropic.adapter.ts
import { logger } from '../../../utils/logger.js';
import { LLMAdapter, LLMGenerateResponse } from './llm-adapter.interface.js'; // Removed LLMGenerateOptions

// Define the structure for Anthropic API request
interface AnthropicRequest {
  model: string;
  system: string;
  messages: { role: 'user' | 'assistant'; content: string }[];
  max_tokens: number;
  temperature?: number;
  // Add other Anthropic-specific parameters if needed (e.g., top_p, top_k)
}

// Define the structure for Anthropic API response (simplified)
interface AnthropicResponse {
  id: string;
  type: string;
  role: string;
  content: { type: string; text: string }[];
  model: string;
  stop_reason: string;
  stop_sequence: string | null;
  usage: {
    input_tokens: number;
    output_tokens: number;
  };
}

export class AnthropicAdapter implements LLMAdapter {
  private apiKey: string;
  private modelId = 'claude-3-5-sonnet-20240620'; // Use the specific model ID
  private apiUrl = 'https://api.anthropic.com/v1/messages';

  constructor(apiKey: string) {
    if (!apiKey) {
      throw new Error('Anthropic API key is required.');
    }
    this.apiKey = apiKey;
  }

  // Updated options to match interface definition directly
  async generate(options: {
    systemPrompt: string;
    userPrompt: string;
    maxTokens?: number;
    temperature?: number;
  }): Promise<LLMGenerateResponse> {
    const { systemPrompt, userPrompt, maxTokens = 4096, temperature } = options; // Default maxTokens for Claude 3.5 Sonnet

    const requestBody: AnthropicRequest = {
      model: this.modelId,
      system: systemPrompt,
      messages: [{ role: 'user', content: userPrompt }],
      max_tokens: maxTokens,
    };

    if (temperature !== undefined) {
      requestBody.temperature = temperature;
    }

    logger.debug(`Anthropic Request Body (model: ${this.modelId}):`, {
      // Avoid logging full prompts unless necessary
      model: requestBody.model,
      max_tokens: requestBody.max_tokens,
      temperature: requestBody.temperature,
      message_length: userPrompt.length,
      system_prompt_length: systemPrompt.length,
    });

    try {
      const response = await fetch(this.apiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': this.apiKey,
          'anthropic-version': '2023-06-01', // Required header
        },
        body: JSON.stringify(requestBody),
      });

      if (!response.ok) {
        const errorBody = await response.text();
        logger.error(`Anthropic API request failed with status ${response.status}: ${errorBody}`);
        throw new Error(`Anthropic API request failed: ${response.status} ${response.statusText}`);
      }

      const data: AnthropicResponse = await response.json();
      logger.debug('Anthropic Raw Response:', data);

      // Extract the JSON configuration from the response content
      // Anthropic returns content as an array, usually with one text block
      const responseText = data.content?.[0]?.text?.trim() ?? '';

      // Attempt to find and parse the JSON block
      let configJson: object | null = null;
      const jsonRegex = /```json\s*([\s\S]*?)\s*```|({[\s\S]*})/; // Look for markdown block or raw JSON
      const match = responseText.match(jsonRegex);

      if (match) {
        const jsonString = match[1] || match[2]; // Get content from markdown or raw JSON
        try {
          configJson = JSON.parse(jsonString);
          logger.debug('Successfully parsed JSON config from Anthropic response.');
        } catch (parseError: any) {
          logger.error(`Failed to parse JSON from Anthropic response: ${parseError.message}`, {
            responseText,
          });
          // Don't throw here, let the calling service handle potentially non-JSON responses if needed
          // Or throw if JSON is strictly required:
          throw new Error(`Failed to parse JSON configuration from Anthropic response.`);
        }
      } else {
        logger.warn('Could not find a JSON block in the Anthropic response.', { responseText });
        // Throw error as we expect JSON config
        throw new Error(`Could not extract JSON configuration from Anthropic response.`);
      }

      if (!configJson) {
        throw new Error(`Extracted JSON configuration was null or empty.`);
      }

      // Ensure usage data exists
      const inputTokens = data.usage?.input_tokens ?? 0;
      const outputTokens = data.usage?.output_tokens ?? 0;
      const totalTokens = inputTokens + outputTokens;

      return {
        config: configJson, // Return the parsed JSON object
        usage: {
          prompt_tokens: inputTokens,
          completion_tokens: outputTokens,
          total_tokens: totalTokens,
        },
      };
    } catch (error: any) {
      logger.error(`Error calling Anthropic API: ${error.message}`, { error });
      throw new Error(`Anthropic adapter failed: ${error.message}`);
    }
  }
}
