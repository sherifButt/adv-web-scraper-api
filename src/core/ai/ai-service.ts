// src/core/ai/ai-service.ts
import { logger } from '../../utils/logger.js';
import { config } from '../../config/index.js';
import {
  AiModelResponse,
  MODEL_COSTS,
  GenerateConfigOptions,
} from '../../types/ai-generation.types.js';
import { NavigationStep } from '../../types/index.js'; // Import NavigationStep

// Placeholder for actual AI SDK client (e.g., OpenAI)
// import OpenAI from 'openai';

export class AiService {
  private static instance: AiService;
  // private openai: OpenAI; // Placeholder for the actual client

  private constructor() {
    // Initialize the AI client (e.g., OpenAI)
    // This requires an API key, typically from environment variables
    const apiKey = config.ai?.apiKey || process.env.OPENAI_API_KEY;
    if (!apiKey) {
      logger.warn('AI Service: API key not found. AI generation will not work.');
      // Handle the absence of API key appropriately, maybe throw an error
      // or disable AI features gracefully. For now, we'll allow it but log a warning.
      // this.openai = null; // Or some indicator that the client is not available
    } else {
      // this.openai = new OpenAI({ apiKey });
      logger.info('AI Service initialized.'); // Placeholder log
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
    logger.info(`Calling AI model (${options.model})`);
    // Placeholder implementation - Replace with actual OpenAI API call
    // if (!this.openai) {
    //   throw new Error('AI Service client is not initialized. Cannot call AI model.');
    // }

    try {
      // const response = await this.openai.chat.completions.create({
      //   model: options.model,
      //   messages: [
      //     { role: 'system', content: systemPrompt },
      //     { role: 'user', content: userPrompt },
      //   ],
      //   max_tokens: options.maxTokens,
      //   temperature: options.temperature,
      //   response_format: { type: 'json_object' }, // Request JSON output if supported
      // });

      // const generatedJsonString = response.choices[0]?.message?.content;
      // const usage = response.usage; // { prompt_tokens, completion_tokens, total_tokens }

      // --- Placeholder Response ---
      await new Promise(resolve => setTimeout(resolve, 1000)); // Simulate delay
      const generatedJsonString = `{
        "startUrl": "placeholder_url",
        "steps": [ { "type": "wait", "value": 500, "description": "Placeholder step" } ],
        "variables": {},
        "options": {}
      }`;
      const usage = { prompt_tokens: 500, completion_tokens: 100, total_tokens: 600 };
      // --- End Placeholder ---

      if (!generatedJsonString) {
        throw new Error('AI model returned empty content.');
      }

      let generatedConfig: any;
      try {
        generatedConfig = JSON.parse(generatedJsonString);
      } catch (parseError) {
        logger.error('Failed to parse AI model response as JSON:', generatedJsonString);
        throw new Error(`AI model did not return valid JSON. Response: ${generatedJsonString}`);
      }

      const tokensUsed = usage?.total_tokens || 0; // Get actual token usage

      logger.info(`AI model call successful. Tokens used: ${tokensUsed}`);

      return {
        config: generatedConfig,
        tokensUsed: tokensUsed,
        model: options.model, // Return the model used
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
