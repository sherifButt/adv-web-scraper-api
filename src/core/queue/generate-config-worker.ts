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
// Basic HTML Cleaning Helper
function cleanHtml(html: string): string {
  // Remove script tags and their content
  html = html.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '');
  // Remove style tags and their content
  html = html.replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, '');
  // Remove HTML comments
  html = html.replace(/<!--.*?-->/gs, '');
  // Remove SVG tags
  html = html.replace(/<svg\b[^<]*(?:(?!<\/svg>)<[^<]*)*<\/svg>/gi, '');
  // Remove noscript tags
  html = html.replace(/<noscript\b[^<]*(?:(?!<\/noscript>)<[^<]*)*<\/noscript>/gi, '');
  // Optional: Remove inline styles (more complex, might remove valid content attributes)
  // html = html.replace(/ style="[^"]*"/gi, '');
  // Optional: Remove all attributes starting with 'on' (event handlers)
  // html = html.replace(/ on\w+="[^"]*"/gi, '');
  // Basic whitespace reduction
  html = html.replace(/\s+/g, ' ').trim();
  return html;
}

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
  const jobId = job.id; // Keep jobId accessible
  logger.info(`Job ${jobId}: Starting AI config generation for URL: ${url}`);

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
    let fetchedHtmlContent: string | undefined;

    try {
      // --- Fetch and Clean HTML on First Iteration ---
      if (state.iteration === 1) {
        state.currentStatus = 'Fetching Initial HTML';
        await updateJobStatus(job, state);
        logger.info(`Job ${jobId}: Fetching HTML content for ${state.url}`);
        let browser: any = null;
        let page: Page | null = null;
        try {
          const browserOptions: BrowserOptions = { headless: true }; // Use simple headless for fetching
          // Add proxy if configured globally for fetching, separate from test proxy setting
          if (globalConfig.proxy.enabled && globalConfig.proxy.useForHtmlFetch) {
            const proxyManager = ProxyManager.getInstance();
            const proxyInfo: ProxyInfo | null = await proxyManager.getProxy();
            if (proxyInfo?.protocols?.length) {
              const protocol = proxyInfo.protocols[0];
              browserOptions.proxy = { server: `${protocol}://${proxyInfo.ip}:${proxyInfo.port}` };
              logger.info(
                // Fixed formatting
                `Job ${jobId}: Using proxy ${browserOptions.proxy.server} for HTML fetch.`
              );
            } else {
              logger.warn(`Job ${jobId}: HTML fetch proxy requested but none found.`); // Adjusted formatting
            }
          }

          browser = await BrowserPool.getInstance().getBrowser(browserOptions);
          page = await browser.newPage();
          // Add null check before using page
          if (page) {
            await page.goto(state.url, { waitUntil: 'domcontentloaded', timeout: 60000 }); // Wait for DOM
            const rawHtml = await page.content();
            fetchedHtmlContent = cleanHtml(rawHtml);
            logger.info(
              // Fixed formatting
              `Job ${jobId}: Successfully fetched and cleaned HTML (${fetchedHtmlContent.length} chars).`
            );
          } else {
            throw new Error(`Job ${jobId}: Failed to create page for HTML fetching.`); // Fixed formatting
          }
        } catch (fetchError: any) {
          logger.warn(
            // Fixed formatting
            `Job ${jobId}: Failed to fetch or clean HTML: ${fetchError.message}. Proceeding without HTML context.`
          );
          state.lastError = `HTML fetch failed: ${fetchError.message}`; // Log fetch error
          fetchedHtmlContent = undefined; // Ensure it's undefined if fetch fails
        } finally {
          // Add null check before closing page
          if (page) {
            await page.close();
          }
          if (browser) {
            await BrowserPool.getInstance().releaseBrowser(browser);
          }
        }
        state.currentStatus = 'Generating Initial Config'; // Update status after fetch attempt
        await updateJobStatus(job, state);
      }

      // --- Call AI Service ---
      logger.info(`Job ${jobId}: Calling AI Service (Iteration ${state.iteration})`);
      if (state.iteration === 1) {
        aiResponse = await aiService.generateConfiguration(
          state.url,
          state.prompt,
          state.options,
          fetchedHtmlContent, // Pass fetched HTML
          jobId // Pass jobId
        );
      } else {
        // Ensure lastConfig is not null/undefined before calling fix
        if (!state.lastConfig) {
          // If lastConfig is missing on a fix iteration, something went wrong.
          throw new Error( // Fixed formatting
            `Job ${jobId}: Cannot perform fix iteration ${state.iteration} without a previous configuration state.`
          );
        }
        // Note: lastError can be null if validation passed but testing failed without a specific error string
        const errorForFix = // Fixed formatting
          state.lastError ?? 'Test failed or validation passed but requires refinement.';

        // Redundant check removed (already fixed in previous step, just ensuring context match)
        // Pass lastError directly, the check above guarantees it's a string here
        aiResponse = await aiService.fixConfiguration(
          state.url,
          state.prompt,
          state.lastConfig,
          errorForFix, // Pass potentially modified error string
          state.options,
          jobId // Pass jobId
        );
      }

      logger.info(
        // Fixed formatting
        `Job ${jobId}: Received AI Response. Tokens: ${
          aiResponse.tokensUsed
        }, Cost: $${aiResponse.cost.toFixed(6)}`
      );
      state.tokensUsed += aiResponse.tokensUsed;
      state.estimatedCost += aiResponse.cost; // Accumulate cost from the current response
      state.currentStatus = `Validating AI Response (Iteration ${state.iteration})`;
      await updateJobStatus(job, state);

      // --- Validate AI Response ---
      logger.debug(`Job ${jobId}: Raw AI config:`, aiResponse.config); // Log raw config before validation
      const validationResult = ScrapingConfigSchema.safeParse(aiResponse.config);
      if (!validationResult.success) {
        const errorMsg = `AI response failed schema validation: ${validationResult.error.errors
          .map((e: z.ZodIssue) => `${e.path.join('.')}: ${e.message}`) // Use ZodIssue type
          .join(', ')}`;
        logger.warn(`Job ${jobId}: ${errorMsg}`);
        state.lastError = errorMsg;
        state.lastConfig = aiResponse.config; // Store the invalid config for the next fix attempt
        state.currentStatus = `Validation Failed (Iteration ${state.iteration})`;
        await updateJobStatus(job, state);
        continue; // Go to next iteration
      }

      logger.info(`Job ${jobId}: AI response schema validation PASSED.`);
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
        state.currentStatus = 'Completed (No Test)';
        await updateJobStatus(job, state);
        logger.info(`Job ${jobId}: Storing final configuration.`);
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
      logger.info(`Job ${jobId}: Starting configuration test (Iteration ${state.iteration}).`);

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
          throw new Error(`Job ${jobId}: Failed to create page for testing.`);
        }
        logger.info(`Job ${jobId}: Executing navigation flow for test.`);
        const navigationEngine = new NavigationEngine(page, currentConfig.options || {});
        // Cast steps to NavigationStep[] when passing to executeFlow
        const testNavResult: NavigationResult = await navigationEngine.executeFlow(
          currentConfig.startUrl ?? state.url, // Use nullish coalescing for fallback
          currentConfig.steps as NavigationStep[], // Cast here
          currentConfig.variables || {}
        );
        logger.debug(`Job ${jobId}: Test navigation result:`, testNavResult);

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
        logger.debug(`Job ${jobId}: Cleaning up test browser resources.`);
        if (page) await page.close();
        if (browser) await BrowserPool.getInstance().releaseBrowser(browser);
      }

      // --- Handle Test Outcome ---
      if (testPassed) {
        state.currentStatus = 'Completed';
        await updateJobStatus(job, state);
        logger.info(`Job ${jobId}: Storing final configuration after successful test.`);
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
        logger.warn(
          // Fixed formatting
          `Job ${jobId}: Test failed. Preparing for fix iteration ${state.iteration + 1}. Error: ${
            state.lastError
          }`
        );
        await updateJobStatus(job, state);
        // Loop continues
      }
    } catch (error: any) {
      // Catch errors from AI call or validation or HTML fetch setup
      logger.error(
        // Fixed formatting
        `Job ${jobId}: Unhandled error in generation/validation loop (Iteration ${state.iteration}): ${error.message}`,
        { error }
      );
      state.lastError = error.message;
      state.currentStatus = `Error Occurred (Iteration ${state.iteration})`;
      await updateJobStatus(job, state);
      // Continue to next iteration if possible, maybe the fix attempt can recover
      // If the error is critical (e.g., AI service unavailable), it might make sense to fail fast here.
    }
  } // End of while loop

  // --- Max Iterations Reached ---
  logger.error(
    `Job ${jobId}: Failed to generate working config after ${state.options.maxIterations} iterations.`
  );
  state.currentStatus = 'Failed - Max Iterations Reached';
  state.message = `Failed after ${state.options.maxIterations} attempts. Last error: ${
    // Fixed formatting
    state.lastError ?? 'Unknown'
  }`;
  await updateJobStatus(job, state);

  // Throw error to mark job as failed in BullMQ
  throw new Error( // Fixed formatting
    `Failed to generate working config after ${
      state.options.maxIterations
    } iterations. Last error: ${state.lastError ?? 'Unknown error'}`
  );
}
