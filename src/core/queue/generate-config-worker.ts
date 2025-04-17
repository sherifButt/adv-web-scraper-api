// src/core/queue/generate-config-worker.ts
import { Job } from 'bullmq';
import { logger } from '../../utils/logger.js';
import { AiService } from '../ai/ai-service.js';
import { StorageService } from '../../storage/index.js';
import { BrowserPool, BrowserOptions } from '../browser/browser-pool.js';
import { ProxyManager } from '../proxy/proxy-manager.js';
import { NavigationEngine } from '../../navigation/navigation-engine.js';
import { config as globalConfig } from '../../config/index.js';
import {
  GenerateConfigRequest,
  GenerateConfigOptions,
  GenerateConfigState,
  GenerateConfigResult,
  AiModelResponse,
} from '../../types/ai-generation.types.js';
// Import NavigationStep from main index again
import { NavigationStep, NavigationResult, ProxyInfo } from '../../types/index.js';
import { Page } from 'playwright';
import * as z from 'zod'; // Using Zod for schema validation

// --- Configuration Schema (Reverted to Basic Example) ---
// This should match the structure expected by NavigationEngine
const ScrapingConfigSchema = z.object({
  startUrl: z.string().url(),
  steps: z.array(z.object({ type: z.string() }).passthrough()), // Basic step validation
  variables: z.record(z.any()).optional(),
  options: z.record(z.any()).optional(),
});

// --- Default Options ---
const DEFAULT_OPTIONS: Required<GenerateConfigOptions> = {
  maxIterations: 3,
  testConfig: true,
  model: 'gpt-4o-mini', // Or choose a default model available
  maxTokens: 8192,
  temperature: 0.7,
  browserOptions: {
    headless: true,
    proxy: false,
  },
};

// --- Helper Function to Update Job Progress/Data ---
async function updateJobStatus(job: Job, state: Partial<GenerateConfigState>) {
  // Use job.data directly as getData() might not be standard or could have issues
  const currentData = job.data as GenerateConfigState;
  const newData = { ...currentData, ...state };
  await job.updateData(newData);

  // Also update progress for BullMQ UI (optional)
  // Add checks for iteration and options before calculating progress
  if (typeof state.iteration === 'number' && state.options?.maxIterations) {
    const progress = Math.round((state.iteration / state.options.maxIterations) * 100);
    await job.updateProgress(progress);
  }
  // Ensure currentStatus exists before logging
  if (state.currentStatus) {
    logger.info(`Job ${job.id} status: ${state.currentStatus}`);
  }
}

// --- Main Worker Process ---
export async function processGenerateConfigJob(job: Job): Promise<GenerateConfigResult> {
  if (!job.id) {
    throw new Error('Job ID is required but was not provided');
  }
  const { url, prompt, options: reqOptions }: GenerateConfigRequest = job.data;
  const jobId = job.id;
  logger.info(`Starting AI config generation job ${jobId} for URL: ${url}`);

  const aiService = AiService.getInstance();
  const storageService = StorageService.getInstance();

  // Merge default options with request options
  const options: Required<GenerateConfigOptions> = {
    ...DEFAULT_OPTIONS,
    ...reqOptions,
    browserOptions: {
      ...DEFAULT_OPTIONS.browserOptions,
      ...reqOptions?.browserOptions,
    },
  };

  // Initialize state with all required fields
  const state: GenerateConfigState = {
    status: 'processing',
    progress: 0,
    message: 'Initializing config generation',
    url,
    prompt,
    options,
    iteration: 0,
    tokensUsed: 0,
    estimatedCost: 0,
    currentStatus: 'Initializing',
    lastConfig: null,
    lastError: null,
    testResult: null,
  };

  await updateJobStatus(job, state);

  // --- Generation and Fixing Loop ---
  while (state.iteration < state.options.maxIterations) {
    state.iteration++;
    state.currentStatus =
      state.iteration === 1
        ? 'Generating Initial Config'
        : `Preparing Fix Iteration ${state.iteration}`;
    await updateJobStatus(job, state);

    let aiResponse: AiModelResponse;
    try {
      // --- Call AI Service ---
      if (state.iteration === 1) {
        // TODO: Optionally fetch HTML content here
        // let htmlContent: string | undefined;
        // if (options.fetchHtml) { ... }
        aiResponse = await aiService.generateConfiguration(
          state.url,
          state.prompt,
          state.options
          // htmlContent
        );
      } else {
        // Ensure lastConfig and lastError are not null/undefined before calling
        if (!state.lastConfig || !state.lastError) {
          // This should ideally not happen due to the check above, but belts and braces
          throw new Error('Cannot perform fix iteration without previous config and error state.');
        }
        // Pass lastError directly, the check above guarantees it's a string here
        aiResponse = await aiService.fixConfiguration(
          state.url,
          state.prompt,
          state.lastConfig,
          state.lastError, // Pass directly after check
          state.options
        );
      }

      state.tokensUsed += aiResponse.tokensUsed;
      state.estimatedCost = aiService.calculateCost(state.tokensUsed, aiResponse.model);
      state.currentStatus = `Received LLM Response (Iteration ${state.iteration})`;
      await updateJobStatus(job, state);

      // --- Validate AI Response ---
      const validationResult = ScrapingConfigSchema.safeParse(aiResponse.config);
      if (!validationResult.success) {
        const errorMsg = `AI response failed schema validation: ${validationResult.error.errors
          .map((e: any) => `${e.path.join('.')}: ${e.message}`) // Add : any type to e
          .join(', ')}`;
        logger.warn(`Job ${jobId}: ${errorMsg}`);
        state.lastError = errorMsg;
        state.lastConfig = aiResponse.config; // Store the invalid config for the next fix attempt
        state.currentStatus = `Validation Failed (Iteration ${state.iteration})`;
        await updateJobStatus(job, state);
        continue; // Go to next iteration
      }

      // Cast the validated data to the expected type, keeping the steps cast for executeFlow
      const currentConfig = validationResult.data as {
        startUrl: string;
        steps: any[]; // Use any[] here, cast later
        variables?: Record<string, any>;
        options?: Record<string, any>;
      };
      state.lastConfig = currentConfig; // Store the validated config
      state.lastError = null; // Reset error if validation passes

      // --- Test Configuration (if enabled) ---
      if (!state.options.testConfig) {
        logger.info(`Job ${jobId}: Skipping test phase as testConfig is false.`);
        state.currentStatus = 'Completed';
        await updateJobStatus(job, state);
        await storageService.store({ id: jobId, ...currentConfig }); // Store final config
        return {
          id: jobId,
          url: state.url,
          status: 'completed',
          config: currentConfig,
          tokensUsed: state.tokensUsed,
          estimatedCost: state.estimatedCost,
          iterations: state.iteration,
          timestamp: new Date().toISOString(),
        };
      }

      state.currentStatus = `Testing Config (Iteration ${state.iteration})`;
      await updateJobStatus(job, state);

      let testPassed = false;
      let testErrorLog: string | null = null;
      let browser: any = null; // Use 'any' for simplicity, replace with actual Browser type if needed
      let page: Page | null = null;

      try {
        // --- Setup Browser for Test ---
        const browserOptions: BrowserOptions = {
          headless: state.options.browserOptions.headless,
        };
        if (state.options.browserOptions.proxy && globalConfig.proxy.enabled) {
          const proxyManager = ProxyManager.getInstance();
          const proxyInfo: ProxyInfo | null = await proxyManager.getProxy(); // Basic proxy selection
          if (proxyInfo?.protocols?.length) {
            const protocol = proxyInfo.protocols[0];
            browserOptions.proxy = { server: `${protocol}://${proxyInfo.ip}:${proxyInfo.port}` };
            logger.info(`Job ${jobId}: Using proxy ${browserOptions.proxy.server} for test.`);
          } else {
            logger.warn(`Job ${jobId}: Test proxy requested but none found.`);
          }
        }
        browser = await BrowserPool.getInstance().getBrowser(browserOptions);
        page = await browser.newPage();

        // --- Execute Test ---
        if (!page) {
          throw new Error('Failed to create page for testing.');
        }
        const navigationEngine = new NavigationEngine(page, currentConfig.options || {});
        // Cast steps to NavigationStep[] when passing to executeFlow
        const testNavResult: NavigationResult = await navigationEngine.executeFlow(
          currentConfig.startUrl ?? state.url, // Use nullish coalescing for fallback
          currentConfig.steps as NavigationStep[], // Cast here
          currentConfig.variables || {}
        );

        // --- Evaluate Test ---
        if (testNavResult.status === 'completed' && !testNavResult.error) {
          // Basic success criteria: completed without error and got some result data
          // TODO: Add more sophisticated checks if needed (e.g., check if specific fields exist)
          if (testNavResult.result && Object.keys(testNavResult.result).length > 0) {
            testPassed = true;
            state.testResult = testNavResult.result; // Store successful result
            logger.info(`Job ${jobId}: Test PASSED (Iteration ${state.iteration})`);
          } else {
            testErrorLog = 'Test completed but no data was extracted.';
            logger.warn(`Job ${jobId}: ${testErrorLog}`);
          }
        } else {
          testErrorLog = `Test failed: ${testNavResult.error ?? 'Unknown navigation error'}`; // Use nullish coalescing
          logger.warn(`Job ${jobId}: ${testErrorLog}`);
        }
      } catch (execError: any) {
        testErrorLog = `Test execution error: ${execError.message}`;
        logger.error(`Job ${jobId}: ${testErrorLog}`, execError);
      } finally {
        // --- Cleanup Test Browser ---
        if (page) await page.close();
        if (browser) await BrowserPool.getInstance().releaseBrowser(browser);
      }

      // --- Handle Test Outcome ---
      if (testPassed) {
        state.currentStatus = 'Completed';
        await updateJobStatus(job, state);
        await storageService.store({ id: jobId, ...currentConfig }); // Store final config
        return {
          id: jobId,
          url: state.url,
          status: 'completed',
          config: currentConfig,
          tokensUsed: state.tokensUsed,
          estimatedCost: state.estimatedCost,
          iterations: state.iteration,
          timestamp: new Date().toISOString(),
        };
      } else {
        // Test failed, prepare for next iteration
        state.lastError = testErrorLog || 'Unknown test failure';
        state.currentStatus = `Test Failed (Iteration ${state.iteration})`;
        await updateJobStatus(job, state);
        // Loop continues
      }
    } catch (error: any) {
      // Catch errors from AI call or validation
      logger.error(
        `Job ${jobId}: Error in generation/validation loop (Iteration ${state.iteration}): ${error.message}`
      );
      state.lastError = error.message;
      state.currentStatus = `Error Occurred (Iteration ${state.iteration})`;
      await updateJobStatus(job, state);
      // Continue to next iteration if possible, maybe the fix attempt can recover
    }
  } // End of while loop

  // --- Max Iterations Reached ---
  logger.error(
    `Job ${jobId}: Failed to generate working config after ${state.options.maxIterations} iterations.`
  );
  state.currentStatus = 'Failed - Max Iterations Reached';
  await updateJobStatus(job, state);

  // Throw error to mark job as failed in BullMQ
  throw new Error(
    `Failed to generate working config after ${
      state.options.maxIterations
    } iterations. Last error: ${state.lastError ?? 'Unknown error'}` // Add fallback for lastError
  );
}
