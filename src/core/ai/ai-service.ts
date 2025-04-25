// src/core/ai/ai-service.ts
import { config } from '../../config/index.js';
import { AiModelResponse, GenerateConfigOptions } from '../../types/ai-generation.types.js'; // Removed MODEL_COSTS import
import { logger } from '../../utils/logger.js';

import { getProviderFromModel } from './config/model-config.js'; // Import from new config
import { AdapterFactory } from './factories/adapter-factory.js';
import type { LLMAdapter, LLMGenerateResponse } from './llm-adapters/llm-adapter.interface.js';
import {
  FIX_CONFIG_SYSTEM_PROMPT,
  fixConfigUserPrompt,
} from './prompt-templates/fix-config.prompt.js';
import {
  GENERATE_CONFIG_SYSTEM_PROMPT,
  generateConfigUserPrompt,
} from './prompt-templates/generate-config.prompt.js';
import { CostCalculator } from './services/cost-calculator.js'; // Import CostCalculator

export class AiService {
  private static instance: AiService;
  private defaultModel = 'gpt-4o-mini'; // Default model if none specified
  private adapters: Map<string, LLMAdapter> = new Map(); // Stores adapters by provider name

  private constructor() {
    this.initializeAdapters();
  }

  private initializeAdapters() {
    logger.info('Initializing AI adapters using Factory...');

    const providers = [
      { name: 'openai', key: config.ai?.openai?.apiKey || process.env.OPENAI_API_KEY },
      { name: 'deepseek', key: config.ai?.deepseek?.apiKey || process.env.DEEPSEEK_API_KEY },
      { name: 'anthropic', key: config.ai?.anthropic?.apiKey || process.env.ANTHROPIC_API_KEY },
      { name: 'openrouter', key: config.ai?.openRouter?.apiKey || process.env.OPENROUTER_API_KEY },
    ];

    // Debug log the OpenRouter API key value (without exposing the actual key)
    const openRouterKey = providers.find(p => p.name === 'openrouter')?.key;
    logger.debug(`OpenRouter API key present: ${!!openRouterKey}`);
    logger.debug(`OpenRouter API key length: ${openRouterKey?.length || 0}`);

    providers.forEach(({ name, key }) => {
      logger.debug(`Checking ${name} provider configuration...`);
      if (key) {
        logger.debug(`${name} API key found, attempting to create adapter...`);
        if (!this.adapters.has(name)) {
          const adapter = AdapterFactory.create(name, key);
          if (adapter) {
            this.adapters.set(name, adapter);
            logger.info(`Successfully initialized ${name} adapter`);
          } else {
            logger.warn(`${name} adapter could not be created. Check adapter implementation.`);
          }
        } else {
          logger.debug(`${name} adapter already exists, skipping initialization.`);
        }
      } else {
        logger.warn(`${name} API key not found. ${name} models will be unavailable.`);
      }
    });

    if (this.adapters.size === 0) {
      logger.error(
        'CRITICAL: No AI adapters initialized - All AI features disabled. Check API key configurations.'
      );
    } else {
      logger.info(`Successfully initialized ${this.adapters.size} AI adapters: ${Array.from(this.adapters.keys()).join(', ')}`);
    }
  }

  public static getInstance(): AiService {
    if (!AiService.instance) {
      // Ensure adapters are initialized when getting the instance
      AiService.instance = new AiService();
    }
    return AiService.instance;
  }

  /**
   * Generates a scraping configuration based on URL and prompt.
   */
  public async generateConfiguration(
    url: string,
    prompt: string,
    options: Required<GenerateConfigOptions>,
    htmlContent?: string,
    jobId?: string,
    interactionHints?: string[] // Add interactionHints parameter
  ): Promise<AiModelResponse> {
    const systemPrompt = GENERATE_CONFIG_SYSTEM_PROMPT;
    // Pass interactionHints to the prompt function
    const userPrompt = generateConfigUserPrompt(url, prompt, htmlContent, interactionHints);
    return this.callAiModel(systemPrompt, userPrompt, options, jobId);
  }

  /**
   * Attempts to fix a previously generated configuration based on errors or user feedback.
   */
  public async fixConfiguration(
    url: string,
    originalPrompt: string,
    previousConfig: any,
    errorLog: string | null, // Error from automated test, or null if refinement starts from user feedback
    options: Required<GenerateConfigOptions>,
    jobId?: string,
    interactionHints?: string[],
    htmlContent?: string, // Optional fresh HTML context
    userFeedback?: string // Optional user feedback for refinement
  ): Promise<AiModelResponse> {
    const systemPrompt = FIX_CONFIG_SYSTEM_PROMPT;
    // Pass all relevant context to the prompt function
    const userPrompt = fixConfigUserPrompt(
      url,
      originalPrompt,
      previousConfig,
      errorLog,
      interactionHints,
      htmlContent, // Pass HTML content
      userFeedback // Pass user feedback
    );
    return this.callAiModel(systemPrompt, userPrompt, options, jobId);
  }

  // --- AI Model Interaction ---

  private async callAiModel(
    systemPrompt: string,
    userPrompt: string,
    options: Required<GenerateConfigOptions>,
    jobId?: string // Optional Job ID for logging context
  ): Promise<AiModelResponse> {
    const logPrefix = jobId ? `Job ${jobId}: ` : '';
    const modelName = options.model || this.defaultModel;

    // Determine provider using the imported function
    const provider = getProviderFromModel(modelName);
    if (!provider) {
      // Logger warning is handled inside getProviderFromModel
      throw new Error(`Unknown AI provider for model: ${modelName}`);
    }

    const adapter = this.adapters.get(provider);
    if (!adapter) {
      // This likely means the API key for the provider was missing during initialization
      logger.error(
        `${logPrefix}No adapter initialized for provider '${provider}'. Check API key configuration.`
      );
      throw new Error(
        `AI provider '${provider}' is not available (missing API key?). Cannot use model: ${modelName}`
      );
    }

    logger.info(`${logPrefix}Using AI model ${modelName} via ${provider} adapter.`);
    // Avoid logging potentially large prompts/HTML in production info logs unless debug enabled
    logger.debug(`${logPrefix}System Prompt:\n${systemPrompt}`);
    logger.debug(`${logPrefix}User Prompt:\n${userPrompt}`);
    logger.debug(`${logPrefix}Calling ${provider} adapter with options:`, {
      model: modelName,
      maxTokens: options.maxTokens,
      temperature: options.temperature,
    });

    try {
      // Pass the specific model name to the adapter's generate method
      const response: LLMGenerateResponse = await adapter.generate({
        model: modelName, // Pass the specific model
        systemPrompt,
        userPrompt,
        maxTokens: options.maxTokens,
        temperature: options.temperature,
      });

      logger.debug(`${logPrefix}Raw AI Response from ${modelName}:`, response); // Log raw response for debugging

      // Basic validation of response structure
      if (
        !response ||
        typeof response.config !== 'object' ||
        !response.usage ||
        typeof response.usage.total_tokens !== 'number'
      ) {
        logger.error(
          `${logPrefix}Invalid response structure received from AI adapter for model ${modelName}.`
        );
        throw new Error(`Invalid response structure from AI model ${modelName}`);
      }

      // Calculate cost using the dedicated service
      const cost = CostCalculator.calculate(
        response.usage.prompt_tokens,
        response.usage.completion_tokens,
        modelName // Use the actual model name for cost calculation
      );

      logger.info(
        `${logPrefix}AI call successful. Model: ${modelName}, Tokens: ${
          response.usage.total_tokens
        }, Est. Cost: $${cost.toFixed(6)}`
      );

      return {
        config: response.config,
        tokensUsed: response.usage.total_tokens,
        model: modelName, // Return the actual model used
        cost: cost,
      };
    } catch (error: any) {
      logger.error(`${logPrefix}Error calling AI model ${modelName}: ${error.message}`, { error });
      // Re-throw a more specific error
      throw new Error(`AI model ${modelName} failed: ${error.message}`);
    }
  }

  // calculateCost method is removed as it's now in CostCalculator service
}
