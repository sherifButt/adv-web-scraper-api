// src/core/ai/ai-service.ts
import { config } from '../../config/index.js';
import {
  AiModelResponse,
  GenerateConfigOptions,
  MODEL_COSTS,
} from '../../types/ai-generation.types.js';
import { logger } from '../../utils/logger.js';

import { AnthropicAdapter } from './llm-adapters/anthropic.adapter.js'; // Import AnthropicAdapter
import { DeepSeekAdapter } from './llm-adapters/deepseek.adapter.js';
import type { LLMAdapter, LLMGenerateResponse } from './llm-adapters/llm-adapter.interface.js'; // Import LLMGenerateResponse
import { OpenAIAdapter } from './llm-adapters/openai.adapter.js';

// --- Few-Shot Examples ---
// Store the JSON content as strings
const googleTrendsExample = `{
  "startUrl": "https://trends.google.com/trending?geo=US&hl=en-US&sort=search-volume&hours=24&category=10&status=active",
  "steps": [
    { "type": "condition", "condition": "button[aria-label='Accept all']", "thenSteps": [{ "type": "click", "selector": "button[aria-label='Accept all']" }] },
    { "type": "wait", "value": 1000 },
    { "type": "wait", "value": 3000 },
    { "type": "condition", "condition": "div[jsname='DRv89'] div[role='combobox'][jsname='oYxtQd']:not([aria-disabled='true'])", "thenSteps": [
        { "type": "click", "selector": "div[jsname='DRv89'] div[role='combobox'][jsname='oYxtQd']", "timeout": 60000 },
        { "type": "wait", "value": 1000 },
        { "type": "click", "selector": ".W7g1Rb-rymPhb-ibnC6b[data-value='50']", "timeout": 60000 }
    ]},
    { "type": "wait", "value": 2000 },
    { "type": "extract", "name": "trendsData", "selector": "table.enOdEe-wZVHld-zg7Cn", "fields": {
        "trends": { "selector": "tr.enOdEe-wZVHld-xMbwt", "type": "css", "multiple": true, "continueOnError": true, "fields": {
            "title": { "selector": ".mZ3RIc", "type": "css", "continueOnError": true },
            "searchVolume": { "selector": ".lqv0Cb", "type": "css", "continueOnError": true },
            "growth": { "selector": ".TXt85b", "type": "css", "continueOnError": true },
            "status": { "selector": ".QxIiwc.TUfb9d div", "type": "css", "continueOnError": true },
            "started": { "selector": ".vdw3Ld", "type": "css", "continueOnError": true },
            "relatedQueries": { "selector": ".k36WW div button", "type": "css", "multiple": true, "continueOnError": true, "attribute": "data-term" }
        }}
    }},
    { "type": "forEachElement", "selector": "tr.enOdEe-wZVHld-xMbwt", "maxIterations": 50, "elementSteps": [
        { "type": "click", "selector": ".mZ3RIc" },
        { "type": "wait", "value": 1000 },
        { "type": "wait", "waitForSelector": ".mZ3RIc span.GDLTpd[role='button']", "timeout": 500, "continueOnError": true },
        { "type": "condition", "condition": ".mZ3RIc span.GDLTpd[role='button']", "thenSteps": [
            { "type": "click", "selector": ".mZ3RIc span.GDLTpd[role='button']" },
            { "type": "wait", "timeout": 500 }
        ]},
        { "type": "wait", "value": 1000 },
        { "type": "wait", "waitForSelector": ".EMz5P .jDtQ5", "timeout": 10000 },
        { "type": "wait", "value": 1500 },
        { "type": "extract", "name": "panelData", "selector": ".EMz5P", "usePageScope": true, "fields": {
            "news": { "selector": ".jDtQ5 > div[jsaction]", "type": "css", "multiple": true, "fields": {
                "title": { "selector": ".QbLC8c", "type": "css" },
                "sourceInfo": { "selector": ".pojp0c", "type": "css" },
                "url": { "selector": "a.xZCHj", "type": "css", "attribute": "href" },
                "image": { "selector": ".QtVIpe", "type": "css", "attribute": "src" }
            }},
            "relatedQueries": { "selector": ".HLcRPe button", "type": "css", "multiple": true, "attribute": "data-term" }
        }},
        { "type": "mergeContext", "source": "panelData", "target": "trendsData.trends[{{index}}]", "mergeStrategy": { "news": "overwrite", "relatedQueries": "union" }},
        { "type": "wait", "value": 500 }
    ]},
    { "type": "condition", "condition": "button[aria-label='Go to next page']:not([disabled])", "thenSteps": [
        { "type": "click", "selector": "button[aria-label='Go to next page']" },
        { "type": "wait", "value": 3000 },
        { "type": "gotoStep", "step": 6 }
    ]}
  ],
  "variables": { "country": "EG" },
  "options": { "timeout": 60000, "waitForSelector": ".DEQ5Hc", "javascript": true, "screenshots": false, "userAgent": "Mozilla/5.0...", "debug": true }
}`;

const googleMapsExample = `{
  "startUrl": "https://maps.google.com/maps?entry=wc",
  "steps": [
    { "type": "condition", "condition": "[aria-haspopup='menu']", "thenSteps": [{ "type": "click", "selector": "[aria-haspopup='menu']" }] },
    { "type": "condition", "condition": "[data-lc='en']", "thenSteps": [{ "type": "click", "selector": "[data-lc='en']" }] },
    { "type": "scroll", "distance": 500 },
    { "type": "condition", "condition": "button[aria-label='Accept all']", "thenSteps": [{ "type": "click", "selector": "button[aria-label='Accept all']" }] },
    { "type": "wait", "value": 500 },
    { "type": "input", "selector": ".searchboxinput", "value": "{{keyword}} near {{postcode}}", "clearInput": true, "humanInput": true },
    { "type": "click", "selector": "#searchbox-searchbutton" },
    { "type": "wait", "value": 1000 },
    { "type": "mousemove", "selector": ".m6QErb[role='feed']", "duration": 4000, "action": "wheel", "deltaY": 6000 },
    { "type": "wait", "value": 3000 },
    { "type": "extract", "name": "searchResults", "selector": ".m6QErb[role='feed']", "fields": {
        "listings": { "selector": ".Nv2PK", "type": "css", "multiple": true, "continueOnError": true, "fields": {
            "name": { "selector": ".fontHeadlineSmall", "type": "css", "continueOnError": true },
            "rating": { "selector": ".MW4etd", "type": "css", "continueOnError": true },
            "reviews": { "selector": "span .UY7F9", "type": "regex", "pattern": "\\\\((\\\\d+)\\\\)", "group": 1, "dataType": "number", "continueOnError": true },
            "services": { "selector": ".W4Efsd .W4Efsd span span", "type": "css", "continueOnError": true },
            "address": { "selector": ".W4Efsd .W4Efsd span + span span + span", "type": "css", "continueOnError": true },
            "phone": { "selector": ".W4Efsd .W4Efsd + .W4Efsd span + span span + span", "type": "css", "continueOnError": true },
            "website": { "selector": "div.lI9IFe div.Rwjeuc div:nth-child(1) a", "type": "css", "attribute": "href", "continueOnError": true }
        }}
    }}
  ],
  "variables": { "keyword": "architect", "postcode": "canton, cardiff,uk" },
  "options": { "timeout": 45000, "waitForSelector": ".m6QErb[role='feed']", "javascript": true, "screenshots": false, "userAgent": "Mozilla/5.0...", "debug": true }
}`;

export class AiService {
  private static instance: AiService;
  private defaultModel = 'gpt-4o-mini'; // Consider moving to config
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

    // Initialize Anthropic Claude 3.5 Sonnet adapter
    const anthropicKey = config.ai?.anthropic?.apiKey || process.env.ANTHROPIC_API_KEY;
    if (anthropicKey) {
      try {
        this.adapters.set('claude-3-5-sonnet-20240620', new AnthropicAdapter(anthropicKey));
        logger.info('Initialized Anthropic Claude 3.5 Sonnet adapter');
      } catch (error: any) {
        logger.error(`Failed to initialize Anthropic adapter: ${error.message}`);
      }
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
    htmlContent?: string,
    jobId?: string // Added optional jobId
  ): Promise<AiModelResponse> {
    const systemPrompt = this.buildInitialSystemPrompt();
    const userPrompt = this.buildInitialUserPrompt(url, prompt, htmlContent);

    // Pass jobId to callAiModel
    return this.callAiModel(systemPrompt, userPrompt, options, jobId);
  }

  /**
   * Attempts to fix a previously generated configuration based on errors.
   */
  public async fixConfiguration(
    url: string,
    originalPrompt: string,
    previousConfig: any,
    errorLog: string | null, // Accept string or null
    options: Required<GenerateConfigOptions>,
    jobId?: string // Added optional jobId
  ): Promise<AiModelResponse> {
    const systemPrompt = this.buildFixSystemPrompt();
    // Pass errorLog (which can be null) to the prompt builder
    const userPrompt = this.buildFixUserPrompt(url, originalPrompt, previousConfig, errorLog);

    // Pass jobId to callAiModel
    return this.callAiModel(systemPrompt, userPrompt, options, jobId);
  }

  // --- Prompt Building ---

  private buildInitialSystemPrompt(): string {
    // Define the expected JSON structure and constraints
    // This is crucial for getting the LLM to output the correct format.
    // Providing a JSON schema or a detailed example is highly recommended.
    // Define the expected JSON structure and constraints
    // This is crucial for getting the LLM to output the correct format.
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

Here are a couple of examples of well-structured configuration JSON objects:

**Example 1: Google Trends**
\`\`\`json
${googleTrendsExample}
\`\`\`

**Example 2: Google Maps**
\`\`\`json
${googleMapsExample}
\`\`\`
`;
  }

  private buildInitialUserPrompt(url: string, prompt: string, htmlContent?: string): string {
    let userPrompt = `Generate the scraping configuration for the following request:
URL: ${url}
Prompt: ${prompt}`;

    if (htmlContent) {
      // Add relevant parts of HTML to give context
      // Be mindful of token limits - maybe just send body or specific sections
      const maxLength = 15000; // Increased Limit HTML context size slightly
      const truncatedHtml =
        htmlContent.length > maxLength ? htmlContent.substring(0, maxLength) + '...' : htmlContent;
      userPrompt += `\n\nRelevant HTML context (cleaned, truncated):\n\`\`\`html\n${truncatedHtml}\n\`\`\``;
    } else {
      userPrompt += `\n\n(No HTML content provided, generate based on URL structure and common patterns if possible)`;
    }
    return userPrompt;
  }

  private buildFixSystemPrompt(): string {
    // Similar to the initial prompt, but focused on fixing
    return `You are an expert web scraping assistant. Your task is to FIX a previously generated JSON scraping configuration that failed during testing.

You will be given the original URL, the original user prompt, the previous JSON configuration that failed, and the error message or log from the failed test run.

Analyze the error and the previous configuration, then generate a NEW, CORRECTED JSON configuration object.

The JSON configuration MUST follow the comprehensive structure defined previously (startUrl, steps, all NavigationStep types and their parameters, FieldDefinition, etc.). Refer to the structure definition and examples provided in the initial generation task if needed.

IMPORTANT RULES:
1.  Generate ONLY the corrected JSON configuration object. Do not include any introductory text, explanations, or markdown formatting like \`\`\`json.
2.  Analyze the provided error message and the previous configuration carefully. Identify the likely root cause of the failure (e.g., incorrect selector, element not found, timeout, unexpected page state, flawed logic in 'condition' or 'forEachElement', incorrect data extraction field).
3.  Modify the configuration specifically to address this root cause. For example:
    - If an element wasn't found: Adjust the selector, add a 'wait' step before it, or mark the step as 'optional: true' if appropriate.
    - If a timeout occurred: Increase the relevant 'timeout' value or add a more specific 'wait' condition (e.g., wait for a specific selector).
    - If logic failed: Correct the 'condition', 'forEachElement' selector, or steps within 'thenSteps'/'elseSteps'/'elementSteps'.
    - If extraction failed: Correct the 'selector', 'attribute', 'type', 'pattern', or nested 'fields' within the relevant 'extract' step.
4.  Ensure the generated JSON is valid and adheres strictly to the defined structure.
5.  Maintain the original intent of the user's prompt while fixing the error.
6.  Use robust CSS selectors (prefer 'id', 'data-*', stable classes; avoid brittle ones).

Reference Examples (Good Structure):
**Example 1: Google Trends**
\`\`\`json
${googleTrendsExample}
\`\`\`

**Example 2: Google Maps**
\`\`\`json
${googleMapsExample}
\`\`\`
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
    options: Required<GenerateConfigOptions>,
    jobId?: string // Optional Job ID for logging context
  ): Promise<AiModelResponse> {
    const adapter = this.adapters.get(options.model);
    const logPrefix = jobId ? `Job ${jobId}: ` : '';

    if (!adapter) {
      logger.error(`${logPrefix}No adapter available for model: ${options.model}`);
      throw new Error(`No adapter available for model: ${options.model}`);
    }

    logger.debug(`${logPrefix}Calling AI model ${options.model} with options:`, options);
    // Avoid logging potentially large prompts/HTML in production info logs unless debug enabled
    logger.debug(`${logPrefix}System Prompt:\n${systemPrompt}`);
    logger.debug(`${logPrefix}User Prompt:\n${userPrompt}`);

    try {
      const response: LLMGenerateResponse = await adapter.generate({
        systemPrompt,
        userPrompt,
        maxTokens: options.maxTokens, // Ensure adapter uses this
        temperature: options.temperature, // Ensure adapter uses this
      });

      logger.debug(`${logPrefix}Raw AI Response:`, response); // Log raw response for debugging

      // Basic validation of response structure
      if (
        !response ||
        typeof response.config !== 'object' ||
        !response.usage ||
        typeof response.usage.total_tokens !== 'number'
      ) {
        logger.error(
          `${logPrefix}Invalid response structure received from AI adapter for model ${options.model}.`
        );
        throw new Error(`Invalid response structure from AI model ${options.model}`);
      }

      // Pass detailed usage to calculateCost
      const cost = this.calculateCost(
        response.usage.prompt_tokens,
        response.usage.completion_tokens,
        options.model
      );

      logger.info(
        `${logPrefix}AI call successful. Model: ${options.model}, Tokens: ${
          response.usage.total_tokens
        }, Est. Cost: $${cost.toFixed(6)}` // Log total tokens
      );

      return {
        config: response.config, // Assuming adapter returns parsed JSON directly
        tokensUsed: response.usage.total_tokens, // Return total tokens here
        model: options.model,
        cost: cost,
      };
    } catch (error: any) {
      logger.error(`${logPrefix}Error calling AI model ${options.model}: ${error.message}`, {
        error,
      });
      // Consider wrapping the error for more context
      throw new Error(`AI model ${options.model} failed: ${error.message}`);
    }
  }

  /**
   * Calculates the estimated cost based on input/output token usage and model.
   */
  public calculateCost(promptTokens: number, completionTokens: number, model: string): number {
    const costs = MODEL_COSTS[model as keyof typeof MODEL_COSTS];
    if (!costs) {
      logger.warn(`Cost calculation not available for model: ${model}`);
      return 0;
    }
    // Calculate cost based on input and output tokens
    const estimatedCost = promptTokens * costs.input + completionTokens * costs.output;
    return estimatedCost;
  }
}
