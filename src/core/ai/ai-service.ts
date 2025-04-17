// src/core/ai/ai-service.ts
import { logger } from '../../utils/logger.js';
import { config } from '../../config/index.js';
import {
  AiModelResponse,
  MODEL_COSTS,
  GenerateConfigOptions,
} from '../../types/ai-generation.types.js';
import { NavigationStep } from '../../types/index.js'; // Import NavigationStep

import { OpenAI } from 'openai';
import { DeepSeekAdapter } from './llm-adapters/deepseek.adapter.js';
import { OpenAIAdapter } from './llm-adapters/openai.adapter.js';
import type { LLMAdapter } from './llm-adapters/llm-adapter.interface.js';

export class AiService {
  private static instance: AiService;
  private defaultModel = 'gpt-4o-mini';

  private adapters: Map<string, LLMAdapter> = new Map();

  private constructor() {
    this.initializeAdapters();
  }

  private initializeAdapters() {
    // Initialize OpenAI GPT-4 Mini adapter
    const gpt4miniKey = config.ai?.openai?.apiKey || process.env.OPENAI_API_KEY;
    if (gpt4miniKey) {
      this.adapters.set('gpt-4o-mini', new OpenAIAdapter(gpt4miniKey));
      logger.info('Initialized OpenAI GPT-4 Mini adapter');
    }

    // Initialize DeepSeek Reasoning adapter
    const deepseekKey = config.ai?.deepseek?.apiKey || process.env.DEEPSEEK_API_KEY;
    if (deepseekKey) {
      this.adapters.set('deepseek-reasoning', new DeepSeekAdapter(deepseekKey));
      logger.info('Initialized DeepSeek Reasoning adapter');
    }

    // Initialize OpenAI adapter (fallback)
    const openaiKey = config.ai?.openai?.apiKey || process.env.OPENAI_API_KEY;
    if (openaiKey) {
      this.adapters.set('openai', new OpenAIAdapter(openaiKey));
      logger.info('Initialized OpenAI adapter');
    }

    if (this.adapters.size === 0) {
      logger.warn('No AI adapters initialized - API keys missing');
    }
  }

  public static getInstance(): AiService {
    if (!AiService.instance) {
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
    htmlContent?: string
  ): Promise<AiModelResponse> {
    const systemPrompt = this.buildInitialSystemPrompt();
    const userPrompt = this.buildInitialUserPrompt(url, prompt, htmlContent);

    // Placeholder for actual API call
    return this.callAiModel(systemPrompt, userPrompt, options);
  }

  /**
   * Attempts to fix a previously generated configuration based on errors.
   */
  public async fixConfiguration(
    url: string,
    originalPrompt: string,
    previousConfig: any,
    errorLog: string | null, // Accept string or null
    options: Required<GenerateConfigOptions>
  ): Promise<AiModelResponse> {
    const systemPrompt = this.buildFixSystemPrompt();
    // Pass errorLog (which can be null) to the prompt builder
    const userPrompt = this.buildFixUserPrompt(url, originalPrompt, previousConfig, errorLog);

    // Placeholder for actual API call
    return this.callAiModel(systemPrompt, userPrompt, options);
  }

  // --- Prompt Building ---

  private buildInitialSystemPrompt(): string {
    // Define the expected JSON structure and constraints
    // This is crucial for getting the LLM to output the correct format.
    // Providing a JSON schema or a detailed example is highly recommended.
    return `You are an expert web scraping assistant. Your task is to generate a JSON configuration object that defines the steps to scrape data from a given URL based on a user's prompt.

The JSON configuration MUST follow this structure:
{
  "startUrl": "string (The target URL)",
  "steps": [ NavigationStep ],
  "variables": { /* Optional key-value pairs */ },
  "options": { /* Optional scraping options */ }
}

NavigationStep is an object with a 'type' property and other properties depending on the type. Supported types are:
- goto: { type: "goto", url: "string" }
- click: { type: "click", selector: "string", description?: "string", timeout?: number }
- input: { type: "input", selector: "string", value: "string", description?: "string", humanInput?: boolean }
- wait: { type: "wait", value: number (ms) | "navigation" | "networkidle" | "load", selector?: string (waitForSelector), timeout?: number, description?: "string" }
- extract: { type: "extract", name: "string", selector?: "string", fields: { fieldName: FieldDefinition }, description?: "string", usePageScope?: boolean }
- condition: { type: "condition", condition: "string (selector)" | function, thenSteps: [ NavigationStep ], elseSteps?: [ NavigationStep ], description?: "string" }
- forEachElement: { type: "forEachElement", selector: "string", elementSteps: [ NavigationStep ], maxIterations?: number, description?: "string" }
- mergeContext: { type: "mergeContext", source: "string", target: "string", mergeStrategy?: { field: "overwrite" | "union" | "append" | "ignore" }, defaultMergeStrategy?: "overwrite" | "union" | "append" | "ignore", description?: "string" }
- gotoStep: { type: "gotoStep", step: number (1-based index), description?: "string" }
(Other types like select, scroll, mousemove, hover, executeScript exist but focus on the core ones first).

FieldDefinition (for extract step):
{
  "selector": "string (CSS selector)",
  "type": "css",
  "attribute"?: "string (e.g., 'href', 'src')",
  "multiple"?: boolean,
  "continueOnError"?: boolean,
  "fields"?: { fieldName: FieldDefinition } // For nested objects/lists
}

IMPORTANT RULES:
1.  Generate ONLY the JSON configuration object. Do not include any introductory text, explanations, or markdown formatting like \`\`\`json.
2.  Use robust CSS selectors. Prefer selectors with stable attributes like 'id', 'data-*', or specific class names. Avoid overly complex or brittle selectors.
3.  Ensure the generated JSON is valid.
4.  The 'extract' step's 'fields' property defines the structure of the extracted data. If 'multiple' is true on a field definition, it extracts an array. If that field definition also has nested 'fields', it extracts an array of objects.
5.  For 'forEachElement', the 'elementSteps' run within the context of each matched element. Use selectors relative to that element or simple tag/class selectors. Use 'usePageScope: true' in nested 'extract' steps if you need to extract data from the whole page relative to the loop item.
6.  The 'mergeContext' step is used to combine data extracted in different steps (e.g., merging panel details into a list item). The 'target' path often uses '{{index}}' when merging into items from a 'forEachElement' loop.
7.  Pay close attention to the user's prompt for the exact data fields and navigation actions required. Include necessary 'wait' steps.
`;
  }

  private buildInitialUserPrompt(url: string, prompt: string, htmlContent?: string): string {
    let userPrompt = `Generate the scraping configuration for the following request:
URL: ${url}
Prompt: ${prompt}`;

    if (htmlContent) {
      // Add relevant parts of HTML to give context
      // Be mindful of token limits - maybe just send body or specific sections
      const maxLength = 10000; // Limit HTML context size
      const truncatedHtml =
        htmlContent.length > maxLength ? htmlContent.substring(0, maxLength) + '...' : htmlContent;
      userPrompt += `\n\nRelevant HTML context (truncated):\n\`\`\`html\n${truncatedHtml}\n\`\`\``;
    }
    return userPrompt;
  }

  private buildFixSystemPrompt(): string {
    // Similar to the initial prompt, but focused on fixing
    return `You are an expert web scraping assistant. Your task is to FIX a previously generated JSON scraping configuration that failed during testing.

You will be given the original URL, the original user prompt, the previous JSON configuration that failed, and the error message or log from the failed test run.

Analyze the error and the previous configuration, then generate a NEW, CORRECTED JSON configuration object.

The JSON configuration MUST follow the structure defined previously (startUrl, steps, NavigationStep types, FieldDefinition, etc.).

IMPORTANT RULES:
1.  Generate ONLY the corrected JSON configuration object. Do not include any introductory text, explanations, or markdown formatting like \`\`\`json.
2.  Focus on fixing the specific error reported. Modify selectors, add wait steps, adjust logic, etc., as needed based on the error.
3.  Ensure the generated JSON is valid.
4.  Maintain the original intent of the user's prompt.
5.  Use robust CSS selectors.
`;
  }

  private buildFixUserPrompt(
    url: string,
    originalPrompt: string,
    previousConfig: any,
    errorLog: string | null // Accept string or null
  ): string {
    // Handle null errorLog
    const errorLogContent =
      errorLog ?? 'No specific error log was provided, but the previous configuration failed.';
    return `The following scraping configuration failed during testing. Please fix it based on the error provided.

Original URL: ${url}
Original Prompt: ${originalPrompt}

Previous Failed Configuration:
\`\`\`json
${JSON.stringify(previousConfig, null, 2)}
\`\`\`

Error/Log from Test Run:
\`\`\`
${errorLogContent}
\`\`\`

Generate the corrected JSON configuration:`;
  }

  // --- AI Model Interaction (Placeholder) ---

  private async callAiModel(
    systemPrompt: string,
    userPrompt: string,
    options: Required<GenerateConfigOptions>
  ): Promise<AiModelResponse> {
    const adapter = this.adapters.get(options.model);
    if (!adapter) {
      throw new Error(`No adapter available for model: ${options.model}`);
    }

    try {
      const response = await adapter.generate({
        systemPrompt,
        userPrompt,
        maxTokens: options.maxTokens,
        temperature: options.temperature,
      });

      return {
        config: response.config,
        tokensUsed: response.usage.total_tokens,
        model: options.model,
        cost: this.calculateCost(response.usage.total_tokens, options.model),
      };
    } catch (error: any) {
      logger.error(`Error calling AI model: ${error.message}`);
      throw error; // Re-throw the error
    }
  }

  /**
   * Calculates the estimated cost based on token usage and model.
   */
  public calculateCost(tokensUsed: number, model: string): number {
    const costs = MODEL_COSTS[model as keyof typeof MODEL_COSTS];
    if (!costs) {
      logger.warn(`Cost calculation not available for model: ${model}`);
      return 0;
    }
    // Note: This is a simplified calculation assuming all tokens are output tokens
    // A more accurate calculation would need input/output token counts if available.
    const estimatedCost = tokensUsed * costs.output; // Using output cost as approximation
    return estimatedCost;
  }
}
