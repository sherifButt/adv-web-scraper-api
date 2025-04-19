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
  // Basic whitespace reduction
  html = html.replace(/\s+/g, ' ').trim();
  return html;
}

// --- Configuration Schema ---
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
  model: 'gpt-4o-mini',
  maxTokens: 8192,
  temperature: 0.7,
  browserOptions: {
    headless: true,
    proxy: false,
  },
};

// --- Helper Function to Update Job Progress/Data ---
async function updateJobStatus(job: Job, state: Partial<GenerateConfigState>) {
  const currentData = job.data as GenerateConfigState;
  const newData = { ...currentData, ...state };
  await job.updateData(newData);

  if (typeof state.iteration === 'number' && state.options?.maxIterations) {
    const progress = Math.round((state.iteration / state.options.maxIterations) * 100);
    await job.updateProgress(progress);
  }
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
  logger.info(`Job ${jobId}: Starting AI config generation for URL: ${url}`);

  const aiService = AiService.getInstance();
  const storageService = StorageService.getInstance();

  const options: Required<GenerateConfigOptions> = {
    ...DEFAULT_OPTIONS,
    ...reqOptions,
    browserOptions: {
      ...DEFAULT_OPTIONS.browserOptions,
      ...reqOptions?.browserOptions,
    },
  };

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
      if (state.iteration === 1) {
        state.currentStatus = 'Fetching Initial HTML';
        await updateJobStatus(job, state);
        logger.info(`Job ${jobId}: Fetching HTML content for ${state.url}`);
        let browser: any = null;
        let page: Page | null = null;
        try {
          const browserOptions: BrowserOptions = { headless: true };
          if (globalConfig.proxy.enabled && globalConfig.proxy.useForHtmlFetch) {
            const proxyManager = ProxyManager.getInstance();
            const proxyInfo: ProxyInfo | null = await proxyManager.getProxy();
            if (proxyInfo?.protocols?.length) {
              const protocol = proxyInfo.protocols[0];
              browserOptions.proxy = { server: `${protocol}://${proxyInfo.ip}:${proxyInfo.port}` };
              logger.info(
                `Job ${jobId}: Using proxy ${browserOptions.proxy.server} for HTML fetch.`
              );
            } else {
              logger.warn(`Job ${jobId}: HTML fetch proxy requested but none found.`);
            }
          }

          browser = await BrowserPool.getInstance().getBrowser(browserOptions);
          page = await browser.newPage();
          if (page) {
            await page.goto(state.url, { waitUntil: 'domcontentloaded', timeout: 60000 });
            const rawHtml = await page.content();
            fetchedHtmlContent = cleanHtml(rawHtml);
            logger.info(
              `Job ${jobId}: Successfully fetched and cleaned HTML (${fetchedHtmlContent.length} chars).`
            );
          } else {
            throw new Error(`Job ${jobId}: Failed to create page for HTML fetching.`);
          }
        } catch (fetchError: any) {
          logger.warn(
            `Job ${jobId}: Failed to fetch or clean HTML: ${fetchError.message}. Proceeding without HTML context.`
          );
          state.lastError = `HTML fetch failed: ${fetchError.message}`;
          fetchedHtmlContent = undefined;
        } finally {
          if (page) await page.close();
          if (browser) await BrowserPool.getInstance().releaseBrowser(browser);
        }
        state.currentStatus = 'Generating Initial Config';
        await updateJobStatus(job, state);
      }

      logger.info(`Job ${jobId}: Calling AI Service (Iteration ${state.iteration})`);
      if (state.iteration === 1) {
        aiResponse = await aiService.generateConfiguration(
          state.url,
          state.prompt,
          state.options,
          fetchedHtmlContent,
          jobId
        );
      } else {
        if (!state.lastConfig) {
          throw new Error(
            `Job ${jobId}: Cannot perform fix iteration ${state.iteration} without a previous configuration state.`
          );
        }
        const errorForFix =
          state.lastError ?? 'Test failed or validation passed but requires refinement.';
        aiResponse = await aiService.fixConfiguration(
          state.url,
          state.prompt,
          state.lastConfig,
          errorForFix,
          state.options,
          jobId
        );
      }

      logger.info(
        `Job ${jobId}: Received AI Response. Tokens: ${
          aiResponse.tokensUsed
        }, Cost: $${aiResponse.cost.toFixed(6)}`
      );
      state.tokensUsed += aiResponse.tokensUsed;
      state.estimatedCost += aiResponse.cost;
      state.currentStatus = `Validating AI Response (Iteration ${state.iteration})`;
      await updateJobStatus(job, state);

      logger.debug(`Job ${jobId}: Raw AI config:`, aiResponse.config);
      const validationResult = ScrapingConfigSchema.safeParse(aiResponse.config);
      if (!validationResult.success) {
        const errorMsg = `AI response failed schema validation: ${validationResult.error.errors
          .map((e: z.ZodIssue) => `${e.path.join('.')}: ${e.message}`)
          .join(', ')}`;
        logger.warn(`Job ${jobId}: ${errorMsg}`);
        state.lastError = errorMsg;
        state.lastConfig = aiResponse.config;
        state.currentStatus = `Validation Failed (Iteration ${state.iteration})`;
        await updateJobStatus(job, state);
        continue;
      }

      logger.info(`Job ${jobId}: AI response schema validation PASSED.`);
      const currentConfig = validationResult.data as {
        startUrl: string;
        steps: any[];
        variables?: Record<string, any>;
        options?: Record<string, any>;
      };
      state.lastConfig = currentConfig;
      state.lastError = null;

      if (!state.options.testConfig) {
        logger.info(`Job ${jobId}: Skipping test phase as testConfig is false.`);
        state.currentStatus = 'Completed (No Test)';
        await updateJobStatus(job, state);
        logger.info(`Job ${jobId}: Storing final configuration (no test).`);
        await storageService.store({
          id: jobId,
          ...currentConfig,
          estimatedCost: state.estimatedCost, // Store cost
        });
        return {
          id: jobId,
          url: state.url,
          status: 'completed',
          config: currentConfig,
          tokensUsed: state.tokensUsed,
          estimatedCost: state.estimatedCost, // Return cost
          iterations: state.iteration,
          timestamp: new Date().toISOString(),
        };
      }

      state.currentStatus = `Testing Config (Iteration ${state.iteration})`;
      await updateJobStatus(job, state);
      logger.info(`Job ${jobId}: Starting configuration test (Iteration ${state.iteration}).`);

      let testPassed = false;
      let testErrorLog: string | null = null;
      let browser: any = null;
      let page: Page | null = null;

      try {
        const browserOptions: BrowserOptions = {
          headless: state.options.browserOptions.headless,
        };
        if (state.options.browserOptions.proxy && globalConfig.proxy.enabled) {
          const proxyManager = ProxyManager.getInstance();
          const proxyInfo: ProxyInfo | null = await proxyManager.getProxy();
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

        if (!page) {
          throw new Error(`Job ${jobId}: Failed to create page for testing.`);
        }
        logger.info(`Job ${jobId}: Executing navigation flow for test.`);
        const navigationEngine = new NavigationEngine(page, currentConfig.options || {});
        const testNavResult: NavigationResult = await navigationEngine.executeFlow(
          currentConfig.startUrl ?? state.url,
          currentConfig.steps as NavigationStep[],
          currentConfig.variables || {}
        );
        logger.debug(`Job ${jobId}: Test navigation result:`, testNavResult);

        // Refined Test Evaluation
        if (testNavResult.status === 'completed' && !testNavResult.error) {
          // Check if any data was actually extracted in the result object
          const hasExtractedData =
            testNavResult.result && Object.keys(testNavResult.result).length > 0;

          if (hasExtractedData) {
            testPassed = true;
            state.testResult = testNavResult.result; // Store successful result
            logger.info(
              `Job ${jobId}: Test PASSED (Iteration ${state.iteration}) - Data extracted.`
            );
          } else {
            // Test completed without errors, but no data was extracted. This is a failure scenario for fixing.
            testPassed = false;
            testErrorLog =
              'Test completed successfully, but no data was extracted by the configuration.';
            state.testResult = testNavResult.result; // Store empty result for context if needed
            logger.warn(
              `Job ${jobId}: Test FAILED (Iteration ${state.iteration}) - ${testErrorLog}`
            );
          }
        } else {
          // Test failed during navigation (e.g., selector not found, timeout)
          testPassed = false;
          // Prioritize the error message from the navigation result if available
          testErrorLog = `Navigation test failed: ${
            testNavResult.error ?? 'Unknown navigation error during execution.'
          }`;
          state.testResult = testNavResult.result; // Store partial result if any
          logger.warn(`Job ${jobId}: Test FAILED (Iteration ${state.iteration}) - ${testErrorLog}`);
        }
      } catch (execError: any) {
        // Catch errors from the overall executeFlow call (e.g., browser crash, setup issues)
        testPassed = false;
        testErrorLog = `Test execution crashed: ${execError.message}`;
        state.testResult = null; // No reliable result available
        // Apply ESLint formatting fix with careful indentation
        logger.error(
          `Job ${jobId}: Test FAILED (Iteration ${state.iteration}) - ${testErrorLog}`,
          execError
        );
      } finally {
        if (page) await page.close();
        if (browser) await BrowserPool.getInstance().releaseBrowser(browser);
      }

      if (testPassed) {
        state.currentStatus = 'Completed';
        await updateJobStatus(job, state);
        logger.info(`Job ${jobId}: Storing final configuration after successful test.`);
        await storageService.store({
          id: jobId,
          ...currentConfig,
          estimatedCost: state.estimatedCost, // Store cost
        });
        return {
          id: jobId,
          url: state.url,
          status: 'completed',
          config: currentConfig,
          tokensUsed: state.tokensUsed,
          estimatedCost: state.estimatedCost, // Return cost
          iterations: state.iteration,
          timestamp: new Date().toISOString(),
        };
      } else {
        state.lastError = testErrorLog || 'Unknown test failure';
        state.currentStatus = `Test Failed (Iteration ${state.iteration})`;
        logger.warn(
          `Job ${jobId}: Test failed. Preparing for fix iteration ${state.iteration + 1}. Error: ${
            state.lastError
          }`
        );
        await updateJobStatus(job, state);
      }
    } catch (error: any) {
      logger.error(
        `Job ${jobId}: Unhandled error in generation/validation loop (Iteration ${state.iteration}): ${error.message}`,
        { error }
      );
      state.lastError = error.message;
      state.currentStatus = `Error Occurred (Iteration ${state.iteration})`;
      await updateJobStatus(job, state);
    }
  } // End of while loop

  logger.error(
    `Job ${jobId}: Failed to generate working config after ${state.options.maxIterations} iterations.`
  );
  state.currentStatus = 'Failed - Max Iterations Reached';
  state.message = `Failed after ${state.options.maxIterations} attempts. Last error: ${
    state.lastError ?? 'Unknown'
  }`;
  await updateJobStatus(job, state);

  throw new Error(
    `Failed to generate working config after ${
      state.options.maxIterations
    } iterations. Last error: ${state.lastError ?? 'Unknown error'}`
  );
}
