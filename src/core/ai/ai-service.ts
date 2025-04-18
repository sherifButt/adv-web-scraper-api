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
  "options": { /* Optional scraping options like timeout, userAgent, debug, etc. */ }
}

NavigationStep is an object with a 'type' property and other properties depending on the type. Each step can optionally include 'description' (string) and 'optional' (boolean, default false). Supported types are:

**Basic Navigation & Waiting:**
- goto: { type: "goto", value: "string (URL)", waitFor?: "load" | "networkidle" | "domcontentloaded" }
- wait: { type: "wait", value: number (ms) | "navigation" | "networkidle" | "load", selector?: string (waits for element), timeout?: number }

**Interactions:**
- click: { type: "click", selector: "string", triggerType?: "mouse" | "keyboard", waitFor?: string | number, timeout?: number }
- input: { type: "input", selector: "string", value: "string", clearInput?: boolean, humanInput?: boolean, timeout?: number }
- select: { type: "select", selector: "string", value: "string", timeout?: number } // Selects dropdown option by value
- scroll: { type: "scroll", direction?: "up" | "down" | "left" | "right", distance?: number, selector?: string, scrollIntoView?: boolean, scrollMargin?: number, behavior?: "smooth" | "auto", timeout?: number, waitFor?: string }
- mousemove: { type: "mousemove", selector?: string, x?: number, y?: number, duration?: number, humanLike?: boolean, action?: "move" | "click" | "drag" | "wheel", pathPoints?: Array<{ x: number; y: number } | { selector: string }>, dragTo?: { x: number; y: number } | { selector: string }, deltaX?: number, deltaY?: number, waitFor?: string, timeout?: number }
- hover: { type: "hover", selector: "string", duration?: number, waitFor?: string, timeout?: number }

**Data Extraction:**
- extract: { type: "extract", name: "string (context key)", selector?: string (base selector for fields), fields: { fieldName: FieldDefinition }, usePageScope?: boolean, timeout?: number }

**Flow Control:**
- condition: { type: "condition", condition: "string (selector)" | function, thenSteps: [ NavigationStep ], elseSteps?: [ NavigationStep ] }
- forEachElement: { type: "forEachElement", selector: "string", elementSteps: [ NavigationStep ], maxIterations?: number }
- mergeContext: { type: "mergeContext", source: "string (context key)", target: "string (context key, use {{index}} for loops)", mergeStrategy?: { field: "overwrite" | "union" | "append" | "ignore" }, defaultMergeStrategy?: "overwrite" | "union" | "append" | "ignore" }
- gotoStep: { type: "gotoStep", step: number (1-based index) } // Jumps to another step
- paginate: { type: "paginate", selector: "string (next button)", maxPages?: number, extractSteps: [ NavigationStep ] } // Simplified pagination loop

**Advanced:**
- executeScript: { type: "executeScript", script: "string (JS code)" | function }

FieldDefinition (for 'extract' step):
{
  "selector": "string (CSS selector relative to parent or page if usePageScope=true)",
  "type": "css" | "regex", // Use 'css' by default. Use 'regex' for pattern matching.
  "attribute"?: "string (e.g., 'href', 'src', 'textContent', 'outerHTML')", // Specify attribute for 'css' type
  "pattern"?: "string (JS Regex pattern)", // Required for 'regex' type
  "group"?: number (Regex capture group index), // Optional for 'regex' type
  "dataType"?: "string" | "number" | "boolean", // Optional for 'regex' type
  "multiple"?: boolean (Extract array of values/objects),
  "continueOnError"?: boolean,
  "fields"?: { fieldName: FieldDefinition } // For nested objects/lists
}

IMPORTANT RULES:
1.  Generate ONLY the JSON configuration object. Do not include any introductory text, explanations, or markdown formatting like \`\`\`json.
2.  Use robust CSS selectors. Prefer stable attributes like 'id', 'data-*' attributes, or unique, descriptive class names. Avoid relying on brittle selectors like complex tag hierarchies ('div > div > span'), index-based selectors (':nth-child(3)'), or auto-generated/dynamic class names (e.g., 'css-1q2w3e4').
3.  Ensure the generated JSON is valid and strictly adheres to the defined structure for each step type.
4.  The 'extract' step's 'fields' define the data structure. If 'multiple' is true on a field, it extracts an array. If that field also has nested 'fields', it extracts an array of objects. Use 'attribute' to get specific HTML attributes. Use 'regex' type for extracting data using regular expressions from text content or attributes.
5.  For 'forEachElement', the 'elementSteps' run within the context of each matched element. Selectors inside 'elementSteps' are relative to the current element by default. Use 'usePageScope: true' in nested 'extract' steps if you need to extract data from the whole page relative to the loop item. The variable '{{index}}' (0-based) is available within 'elementSteps'.
6.  The 'mergeContext' step combines data. 'source' is the key of the data to merge (e.g., extracted in a loop). 'target' is the destination path, often using '{{index}}' like 'results.items[{{index}}].details'. Use 'mergeStrategy' to control how fields are combined (default 'overwrite').
7.  Pay close attention to the user's prompt for the exact data fields and navigation actions required. Include necessary 'wait' steps (e.g., wait for selectors, time, or navigation) before interacting with elements, especially after clicks or inputs that trigger dynamic content loading.
8.  Utilize the full range of available 'NavigationStep' types where appropriate to create efficient and robust scraping logic (e.g., use 'scroll' for infinite scroll, 'forEachElement' for lists, 'condition' for handling variations).
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

The JSON configuration MUST follow the comprehensive structure defined previously (startUrl, steps, all NavigationStep types and their parameters, FieldDefinition, etc., as detailed in the generation prompt).

IMPORTANT RULES:
1.  Generate ONLY the corrected JSON configuration object. Do not include any introductory text, explanations, or markdown formatting like \`\`\`json.
2.  Analyze the provided error message and the previous configuration carefully. Identify the likely root cause of the failure (e.g., incorrect selector, element not found, timeout, unexpected page state, flawed logic in 'condition' or 'forEachElement').
3.  Modify the configuration specifically to address this root cause. For example:
    - If an element wasn't found: Adjust the selector, add a 'wait' step before it, or mark the step as 'optional: true' if appropriate.
    - If a timeout occurred: Increase the relevant 'timeout' value or add a more specific 'wait' condition (e.g., wait for a specific selector).
    - If logic failed: Correct the 'condition', 'forEachElement' selector, or steps within 'thenSteps'/'elseSteps'/'elementSteps'.
4.  Ensure the generated JSON is valid and adheres strictly to the defined structure.
5.  Maintain the original intent of the user's prompt while fixing the error.
6.  Use robust CSS selectors (prefer 'id', 'data-*', stable classes; avoid brittle ones).
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
