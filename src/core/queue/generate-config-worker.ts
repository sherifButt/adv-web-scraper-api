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

// Helper function to analyze DOM structure for selector debugging
async function analyzeDomForSelector(page: Page, selector: string): Promise<string> {
  try {
    // Try to get information about the selector
    const exists = await page.$(selector) !== null;
    let result = `Selector '${selector}' ${exists ? 'exists' : 'does NOT exist'} in the current DOM.\n`;
    
    if (!exists) {
      // Try to find similar selectors to suggest alternatives
      const selectorParts = selector.split(/\s+|>|\+|~/g).filter(Boolean);
      const lastPart = selectorParts[selectorParts.length - 1];
      
      // Extract the base tag from complex selectors (e.g. table:nth-child(4) -> table)
      const baseTag = lastPart?.split(':')[0]?.split('.')[0]?.split('#')[0]?.split('[')[0];
      
      if (baseTag) {
        // Count elements of this type in the DOM
        const count = await page.evaluate((tag) => document.querySelectorAll(tag).length, baseTag);
        result += `Found ${count} '${baseTag}' elements in the DOM.\n`;
        
        // If it's a specific nth-child, analyze the parent structure
        if (lastPart.includes(':nth-child')) {
          const parent = selectorParts.slice(0, -1).join(' ');
          const parentExists = parent ? await page.$(parent) !== null : false;
          
          if (parent && parentExists) {
            const childrenCount = await page.evaluate(
              (p) => document.querySelector(p)?.children.length || 0, 
              parent
            );
            result += `Parent selector '${parent}' exists and has ${childrenCount} children.\n`;
            
            // Get classes of children for better debugging
            const childrenClasses = await page.evaluate((p) => {
              const children = document.querySelector(p)?.children || [];
              return Array.from(children).map((el, i) => 
                `Child ${i+1}: ${el.tagName.toLowerCase()}, classes: ${Array.from(el.classList).join(', ')}`
              );
            }, parent);
            
            if (childrenClasses.length > 0) {
              result += `Children of '${parent}':\n${childrenClasses.join('\n')}\n`;
            }
          }
        }
      }
    }
    
    return result;
  } catch (error: any) {
    return `Failed to analyze DOM for selector '${selector}': ${error.message}`;
  }
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
  interactionHints: [], // Add default empty array for the new required property
};

// --- Helper Function to Update Job Progress/Data ---
async function updateJobStatus(job: Job, state: Partial<GenerateConfigState>, progressPercentage?: number) {
  const currentData = job.data as GenerateConfigState;
  // Ensure state has necessary properties before merging
  const newState = { ...currentData, ...state };
  await job.updateData(newState);

  // Use provided percentage if available, otherwise calculate based on iteration
  const finalProgressPercentage =
    progressPercentage !== undefined
      ? progressPercentage
      : typeof newState.iteration === 'number' && newState.options?.maxIterations
      ? Math.round((newState.iteration / newState.options.maxIterations) * 100)
      : newState.progress; // Fallback to existing progress in state if any

  // Update progress with both percentage and the detailed status string
  await job.updateProgress({
    percentage: Math.min(100, Math.max(0, finalProgressPercentage)), // Clamp between 0-100
    status: newState.currentStatus ?? 'Processing',
  });

  if (newState.currentStatus) {
    logger.info(`Job ${job.id} status: ${newState.currentStatus} (${finalProgressPercentage}%)`);
  }
}

// --- Main Worker Process ---
export async function processGenerateConfigJob(job: Job): Promise<GenerateConfigResult> {
  if (!job.id) {
    throw new Error('Job ID is required but was not provided');
  }
  // --- Extract potential refinement flags from job data ---
  const {
    url,
    prompt,
    options: reqOptions,
    initialState,
    isRefinement,
    fetchHtmlForRefinement,
    refinesJobId,
  }: GenerateConfigRequest & {
    initialState?: Partial<GenerateConfigState> & { userFeedback?: string };
    isRefinement?: boolean;
    fetchHtmlForRefinement?: boolean;
    refinesJobId?: string;
  } = job.data;

  const jobId = job.id;
  logger.info(
    `Job ${jobId}: Starting AI config ${
      isRefinement ? `refinement (based on ${refinesJobId})` : 'generation'
    } for URL: ${url}`
  );

  const aiService = AiService.getInstance();
  const storageService = StorageService.getInstance();

  // --- Initialize Options (Merge default, request, and potentially refinement state) ---
  const options: Required<GenerateConfigOptions> = {
    ...DEFAULT_OPTIONS,
    ...reqOptions, // Options from the request take precedence
    browserOptions: {
      ...DEFAULT_OPTIONS.browserOptions,
      ...(reqOptions?.browserOptions),
    },
    // Ensure interactionHints are arrays and merged if needed (or just use new ones)
    interactionHints: reqOptions?.interactionHints ?? DEFAULT_OPTIONS.interactionHints,
  };

  // --- Initialize State (Handle both initial generation and refinement) ---
  let state: GenerateConfigState;

  if (isRefinement && initialState) {
    // --- Refinement State Initialization ---
    state = {
      status: 'processing',
      progress: 0, // Reset progress for refinement job
      message: `Initializing refinement based on job ${refinesJobId}`,
      url: url, // URL comes from the original job data passed in
      prompt: prompt, // Original prompt comes from original job data passed in
      options: options, // Use newly merged options
      iteration: 0, // Start at 0, loop will increment to 1
      tokensUsed: initialState.tokensUsed ?? 0, // Carry over or reset? Resetting seems cleaner.
      estimatedCost: initialState.estimatedCost ?? 0, // Resetting seems cleaner.
      currentStatus: 'Initializing Refinement',
      lastConfig: initialState.lastConfig ?? null, // Crucial: start with the previous config
      lastError: initialState.lastError ?? null, // Carry over potential previous error context
      userFeedback: initialState.userFeedback, // The refinement instruction
      fetchHtmlForRefinement: fetchHtmlForRefinement ?? false, // Store the flag
      testResult: null, // Reset test result for refinement attempt
      isRefinement: true, // Mark state as refinement
      fixHistory: [], // Initialize fix history
    };
     if (!state.lastConfig) {
         throw new Error(`Job ${jobId}: Refinement job started without a 'lastConfig' in initialState.`);
     }
     if (!state.userFeedback) {
         logger.warn(`Job ${jobId}: Refinement job started without 'userFeedback' in initialState.`);
         // Proceed, but AI might not have specific instructions
     }
  } else {
    // --- Initial Generation State Initialization ---
    state = {
      status: 'processing',
      progress: 0,
      message: 'Initializing config generation',
      url, // URL from the request
      prompt, // Prompt from the request
      options, // Options from the request merged with defaults
      iteration: 0, // Start at 0
      tokensUsed: 0,
      estimatedCost: 0,
      currentStatus: 'Initializing',
      lastConfig: null,
      lastError: null,
      userFeedback: undefined, // No user feedback initially
      fetchHtmlForRefinement: undefined, // Not applicable
      testResult: null,
      isRefinement: false, // Mark state as initial generation
      fixHistory: [], // Initialize fix history
    };
  }

  await updateJobStatus(job, state);

  // Initial status update
  state.progress = 0;
  await updateJobStatus(job, state, 0);

  // Define progress steps (adjust percentages as needed)
  const PROGRESS_FETCH_HTML_START = 5;
  const PROGRESS_FETCH_HTML_END = 15;
  const PROGRESS_AI_CALL_START = 20;
  const PROGRESS_AI_CALL_END = 60; // AI call is the bulk
  const PROGRESS_VALIDATION_START = 65;
  const PROGRESS_VALIDATION_END = 70;
  const PROGRESS_TEST_START = 75;
  const PROGRESS_TEST_END = 95;
  const PROGRESS_COMPLETE = 100;

  // --- Main Generation/Refinement Loop ---
  while (state.iteration < state.options.maxIterations) {
    state.iteration++; // Increment iteration at the start
    const baseProgress = Math.round(((state.iteration - 1) / state.options.maxIterations) * (PROGRESS_TEST_END - PROGRESS_FETCH_HTML_START)) + PROGRESS_FETCH_HTML_START;
    const progressMultiplier = 1 / state.options.maxIterations;

    // Update status based on whether it's the first pass of initial/refinement or a subsequent fix
     if (state.iteration === 1) {
        state.currentStatus = state.isRefinement
            ? 'Preparing Refinement Config'
            : 'Generating Initial Config';
     } else {
        state.currentStatus = `Preparing Fix Iteration ${state.iteration}`;
     }
    await updateJobStatus(job, state, baseProgress); // Starting progress for iteration


    let aiResponse: AiModelResponse;
    let fetchedHtmlContent: string | undefined;

    try {
      // --- Conditional HTML Fetching ---
      const shouldFetchHtml =
        (!state.isRefinement && state.iteration === 1) || // Always fetch on first iteration of initial generation
        (state.isRefinement && state.iteration === 1 && state.fetchHtmlForRefinement); // Fetch on first iteration of refinement IF flag is true

      if (shouldFetchHtml) {
        state.currentStatus = 'Fetching HTML';
        const progress = baseProgress + (PROGRESS_FETCH_HTML_START - baseProgress) * 0.5 ; // Mid-point fetch
        await updateJobStatus(job, state, progress);
        logger.info(
          `Job ${jobId}: Fetching HTML content for ${state.url} (Iteration ${state.iteration}, RefinementFetch: ${state.fetchHtmlForRefinement})`
        );
        let browser: any = null;
        let page: Page | null = null;
        try {
          // --- [Start of Reusable HTML Fetch Logic] ---
          const browserOptions: BrowserOptions = { headless: true }; // Use state.options? No, keep fetch simple for now.
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
              `Job ${jobId}: Successfully fetched and cleaned HTML (${
                fetchedHtmlContent?.length ?? 0
              } chars).`
            );
             await updateJobStatus(job, state, baseProgress + (PROGRESS_FETCH_HTML_END - baseProgress)); // HTML fetch complete
          } else {
            throw new Error(`Job ${jobId}: Failed to create page for HTML fetching.`);
          }
          // --- [End of Reusable HTML Fetch Logic] ---
        } catch (fetchError: any) {
          logger.warn(
            `Job ${jobId}: Failed to fetch or clean HTML: ${fetchError.message}. Proceeding without HTML context.`
          );
          // Don't assign error to state.lastError here, as it might overwrite a real config error later
          fetchedHtmlContent = undefined;
          // Update progress even if fetch failed, move to next stage
          await updateJobStatus(job, state, baseProgress + (PROGRESS_FETCH_HTML_END - baseProgress));
        } finally {
          if (page) await page.close();
          if (browser) await BrowserPool.getInstance().releaseBrowser(browser);
        }
      } else {
         logger.info(`Job ${jobId}: Skipping HTML fetch for this iteration.`);
         fetchedHtmlContent = undefined;
         // Update progress as if HTML fetch step was completed quickly
          await updateJobStatus(job, state, baseProgress + (PROGRESS_FETCH_HTML_END - baseProgress));
      }

      // --- Determine AI Call Type and Parameters ---
      state.currentStatus =
        state.iteration === 1 && !state.isRefinement
          ? 'Generating Initial Config'
          : state.iteration === 1 && state.isRefinement
          ? 'Generating Refined Config'
          : `Generating Fix (Iteration ${state.iteration})`;
      const progressAICallStart = baseProgress + (PROGRESS_AI_CALL_START - baseProgress);
      await updateJobStatus(job, state, progressAICallStart);
      logger.info(`Job ${jobId}: Calling AI Service (${state.currentStatus})`);


      if (!state.isRefinement && state.iteration === 1) {
        // --- Initial Generation Call ---
        aiResponse = await aiService.generateConfiguration(
          state.url,
          state.prompt, // Use the original prompt
          state.options,
          fetchedHtmlContent,
          jobId,
          state.options.interactionHints
        );
      } else {
        // --- Fix / Refinement Call ---
        // Ensure we have a config to fix/refine
        if (!state.lastConfig) {
          throw new Error(
            `Job ${jobId}: Cannot perform fix/refinement iteration ${state.iteration} without a previous configuration state.`
          );
        }

        // Determine the primary error/reason for this call
        // Prioritize user feedback if this is the first refinement iteration
        // Otherwise, use the last error from testing.
        const errorForFix = (state.isRefinement && state.iteration === 1)
            ? null // Let userFeedback be the primary driver, pass error separately if needed
            : state.lastError ?? 'Test failed or validation passed but requires refinement.'; // Existing logic for subsequent fixes

        // --- Format Fix History for Prompt ---
        let formattedHistory = 'No previous fix attempts in this session.';
        if (state.fixHistory && state.fixHistory.length > 0) {
            formattedHistory = `Fix Attempt History (Total: ${state.fixHistory.length}):\n`;
            state.fixHistory.forEach(attempt => {
                formattedHistory += `\n--- Attempt ${attempt.iteration} ---
`;
                // Optionally summarize config or just mention it was attempted
                formattedHistory += `Config Attempted: (See previous configuration passed separately)\n`;
                formattedHistory += `Error Log: ${attempt.errorLog.substring(0, 1000)}${attempt.errorLog.length > 1000 ? '...' : ''}\n`; // Truncate long errors
            });
             formattedHistory += `\nInstruction: Analyze the history and current error/feedback to propose a distinct fix.`;
        }
        // --- End History Formatting ---

        // --- Determine HTML content for the fix call ---
        // Use HTML captured specifically on failure if available, otherwise use the initially fetched one (if any)
        const htmlForFixCall = state.htmlContentAtFailure ?? fetchedHtmlContent;
        if (state.htmlContentAtFailure) {
            logger.info(`Job ${jobId}: Using HTML captured at failure point for AI fix call.`);
        } else if (fetchedHtmlContent) {
            logger.info(`Job ${jobId}: Using initially fetched HTML for AI fix call.`);
        }
        // Clear the failure-specific HTML from state after deciding, so it's not accidentally reused
        state.htmlContentAtFailure = undefined;
        // -------------------------------------------------

        aiResponse = await aiService.fixConfiguration(
          state.url,
          state.prompt, // Always pass the original prompt for context
          state.lastConfig, // The config to be fixed/refined
          errorForFix, // Error log from testing (or null if initial refinement)
          state.options,
          jobId,
          state.options.interactionHints,
          htmlForFixCall, // Pass HTML captured at failure (preferred) or initially fetched
          state.userFeedback, // Pass explicit user feedback for refinement
          formattedHistory // Pass the formatted history
        );
      }

      // --- Process AI Response (Common Logic) ---
      const progressAICallEnd = baseProgress + (PROGRESS_AI_CALL_END - baseProgress);
      await updateJobStatus(job, {...state, currentStatus: `Processing AI Response (Iteration ${state.iteration})`}, progressAICallEnd);
      logger.info(
        `Job ${jobId}: Received AI Response. Tokens: ${
          aiResponse.tokensUsed
        }, Cost: $${aiResponse.cost.toFixed(6)}`
      );
      state.tokensUsed += aiResponse.tokensUsed;
      state.estimatedCost += aiResponse.cost;
      state.currentStatus = `Validating AI Response (Iteration ${state.iteration})`;
      const progressValidationStart = baseProgress + (PROGRESS_VALIDATION_START - baseProgress);
      await updateJobStatus(job, state, progressValidationStart);

      logger.debug(`Job ${jobId}: Raw AI config:`, aiResponse.config);
      const validationResult = ScrapingConfigSchema.safeParse(aiResponse.config);

      if (!validationResult.success) {
         // ... (existing validation failure logic remains the same) ...
        const errorMsg = `AI response failed schema validation: ${validationResult.error.errors
          .map((e: z.ZodIssue) => `${e.path.join('.')}: ${e.message}`)
          .join(', ')}`;
        logger.warn(`Job ${jobId}: ${errorMsg}`);
        state.lastError = errorMsg;
        state.lastConfig = aiResponse.config; // Store the invalid config for potential next fix attempt

        // Add to fix history for validation errors
        if (state.lastConfig) { // Only add if we have a config to record
          state.fixHistory = state.fixHistory || [];
          state.fixHistory.push({
              iteration: state.iteration,
              configAttempted: state.lastConfig, // Record the config that failed validation
              errorLog: errorMsg
          });
        }

        state.currentStatus = `Validation Failed (Iteration ${state.iteration})`;
        const progressValidationFailed = baseProgress + (PROGRESS_VALIDATION_END - baseProgress);
        await updateJobStatus(job, state, progressValidationFailed);
        continue; // Skip testing and go to next iteration
      }

      logger.info(`Job ${jobId}: AI response schema validation PASSED.`);
      const progressValidationEnd = baseProgress + (PROGRESS_VALIDATION_END - baseProgress);
      await updateJobStatus(job, {...state, currentStatus: `Validation Passed (Iteration ${state.iteration})` }, progressValidationEnd);
      const currentConfig = validationResult.data as {
        startUrl: string;
        steps: NavigationStep[]; // Use NavigationStep[] type
        variables?: Record<string, any>;
        options?: Record<string, any>;
      };
      state.lastConfig = currentConfig; // Store the valid config
      state.lastError = null; // Clear last error after successful validation
      state.userFeedback = undefined; // Clear user feedback after it's been used in a fixConfiguration call


      // --- Testing Phase (Common Logic, if enabled) ---
      if (!state.options.testConfig) {
         // ... (existing no-test logic remains the same) ...
        logger.info(`Job ${jobId}: Skipping test phase as testConfig is false.`);
        state.currentStatus = 'Completed (No Test)';
        await updateJobStatus(job, state, PROGRESS_COMPLETE); // Set progress to 100%
        logger.info(`Job ${jobId}: Storing final configuration (no test).`);
        // Ensure originalPrompt is stored
        await storageService.store({
          id: jobId,
          queueName: job.queueName, // Add queue name
          originalPrompt: state.prompt, // Store original prompt
          url: state.url,
          config: currentConfig, // Store the validated config object
          options: state.options, // Store effective options used
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

      // --- Execute Test ---
      state.currentStatus = `Testing Config (Iteration ${state.iteration})`;
      const progressTestStart = baseProgress + (PROGRESS_TEST_START - baseProgress);
      await updateJobStatus(job, state, progressTestStart);
      logger.info(`Job ${jobId}: Starting configuration test (Iteration ${state.iteration}).`);

      let testPassed = false;
      let testErrorLog: string | null = null;
      let browser: any = null;
      let page: Page | null = null;
      let capturedHtmlForFix: string | undefined = undefined; // Variable to hold captured HTML

      try {
        // ... [Existing Test Setup Logic - Browser Pool, Proxy, Page Creation] ...
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

        // --- Start: Early Selector Validation ---
        logger.info(`Job ${jobId}: Performing early selector validation checks...`);
        const validationPromises: Promise<void>[] = [];
        for (const step of currentConfig.steps) {
            // Check steps that commonly use selectors for interaction or extraction
            const selectorOrArray = (step as any).selector || (step as any).condition;
            if (selectorOrArray && typeof selectorOrArray !== 'function') { // Skip function selectors for now
                 const selectors = Array.isArray(selectorOrArray) ? selectorOrArray.filter(s => s) : [selectorOrArray].filter(s => s);
                for (const selector of selectors) {
                     // Use a short timeout to check if the selector can be attached
                     validationPromises.push(
                        (async () => {
                            try {
                                 // Use locator().waitFor() for a quick check
                                 await page.locator(selector).waitFor({ state: 'attached', timeout: 1500 });
                                 logger.debug(`Early validation PASSED for selector: "${selector}"`);
                            } catch (validationError: any) {
                                // Log a warning, but don't fail the overall process here
                                logger.warn(`Early Selector Validation FAILED (selector: "${selector}"): ${validationError.message?.split('\n')[0]}`);
                            }
                        })()
                    );
                }
            }
            // Also check fields within extract steps
            if (step.type === 'extract' && step.fields) {
                for (const fieldConfig of Object.values(step.fields)) {
                     // Check if fieldConfig is an object and actually has a selector property
                     if (typeof fieldConfig === 'object' && fieldConfig !== null && 'selector' in fieldConfig && fieldConfig.selector && typeof fieldConfig.selector !== 'function') {
                        const fieldSelectors = Array.isArray(fieldConfig.selector) ? fieldConfig.selector.filter(s => s) : [fieldConfig.selector].filter(s => s);
                         for (const fieldSelector of fieldSelectors) {
                             validationPromises.push(
                                (async () => {
                                    try {
                                        await page.locator(fieldSelector).waitFor({ state: 'attached', timeout: 1500 });
                                        logger.debug(`Early validation PASSED for field selector: "${fieldSelector}"`);
                                    } catch (validationError: any) {
                                         logger.warn(`Early Selector Validation FAILED (field selector: "${fieldSelector}"): ${validationError.message?.split('\n')[0]}`);
                                    }
                                })()
                            );
                        }
                    }
                }
            }
        }
        // Wait for all validation checks to complete (or timeout)
        await Promise.all(validationPromises);
        logger.info(`Job ${jobId}: Early selector validation checks completed.`);
        // --- End: Early Selector Validation ---

        logger.info(`Job ${jobId}: Executing navigation flow for test.`);
        const navigationEngine = new NavigationEngine(page, currentConfig.options || {});
        const testNavResult: NavigationResult = await navigationEngine.executeFlow(
          currentConfig.startUrl ?? state.url, // Use startUrl from config if present
          currentConfig.steps, // Pass validated steps
          currentConfig.variables || {}
        );
        logger.debug(`Job ${jobId}: Test navigation result:`, testNavResult);

        // --- Refined Test Evaluation ---
        if (testNavResult.status === 'completed' && !testNavResult.error) {
          // ... (existing 'hasExtractedData' check remains the same) ...
          const hasExtractedData =
            testNavResult.result && Object.keys(testNavResult.result).length > 0;

          if (hasExtractedData) {
            testPassed = true;
            state.testResult = testNavResult.result; // Store successful result
            logger.info(
              `Job ${jobId}: Test PASSED (Iteration ${state.iteration}) - Data extracted.`
            );
          } else {
             testPassed = false;
             testErrorLog =
               'Test completed successfully, but no data was extracted by the configuration.';
             state.testResult = testNavResult.result; // Store empty result for context if needed
             logger.warn(
               `Job ${jobId}: Test FAILED (Iteration ${state.iteration}) - ${testErrorLog}`
             );
          }
        } else {
          // ... (existing test failure logging with selector analysis and HTML context) ...
           testPassed = false;
          // Prioritize the error message from the navigation result if available
          let detailedErrorLog = `Navigation test failed: ${
            testNavResult.error ?? 'Unknown navigation error during execution.'
          }`;
          
          // Enhanced error logging with more context
          if (testNavResult.error && testNavResult.error.includes("selector")) {
            // Extract the failing selector from the error message using regex
            const selectorMatch = testNavResult.error.match(/(['"])([^'"]+)\\1/);
            const failingSelector = selectorMatch ? selectorMatch[2] : null;
            
            // Add selector analysis if we could identify the selector
            if (failingSelector) {
              try {
                const selectorAnalysis = await analyzeDomForSelector(page, failingSelector);
                detailedErrorLog += `\\n\\nSelector Analysis:\\n${selectorAnalysis}`;
              } catch (analysisError: any) {
                logger.warn(`Job ${jobId}: Failed to analyze selector: ${analysisError.message}`);
              }
            }
            
            // For selector errors, add page HTML context around the problematic area
            try {
              const pageHtml = await page.content();
              const minifiedHtml = pageHtml.replace(/\\s+/g, ' ').trim();
              // Limit HTML context size in logs
              const shortenedHtml = minifiedHtml.length > 3000 ? minifiedHtml.substring(0, 3000) + "..." : minifiedHtml;
              detailedErrorLog += `\\n\\nCurrent Page HTML Context (truncated):\\n${shortenedHtml}\\n\\nTry using alternative selectors that exist in the actual page structure.`;
            } catch (htmlError: any) {
              logger.warn(`Job ${jobId}: Failed to get HTML context: ${htmlError.message}`);
            }
          }
          
          // Add step context information
          if (testNavResult && typeof testNavResult === 'object') {
            const stepInfo = JSON.stringify(testNavResult, null, 2).substring(0, 500); // Limit to 500 chars
            detailedErrorLog += `\\n\\nNavigation result context:\\n${stepInfo}${stepInfo.length >= 500 ? '...' : ''}`;
          }

          // --- Simulate Adding Diagnostics --- 
          detailedErrorLog += `\n\n[Simulated Diagnostics: Screenshot available at failure_screenshot_${jobId}_iter${state.iteration}.png]`;
          detailedErrorLog += `\n[Simulated Diagnostics: Console Logs Captured]`;
          // --- End Simulation ---

          testErrorLog = detailedErrorLog; // Assign the full log to testErrorLog

          // --- Capture HTML on failure ---
          try {
              if (page) {
                  capturedHtmlForFix = await page.content();
                  logger.info(`Job ${jobId}: Captured HTML content (${capturedHtmlForFix?.length ?? 0} chars) after test failure for AI fix.`);
              } else {
                  logger.warn(`Job ${jobId}: Cannot capture HTML for fix as page object is null.`);
              }
          } catch (htmlError: any) {
               logger.error(`Job ${jobId}: Could not capture HTML content for AI fix: ${htmlError.message}`);
          }
          // --- End Capture HTML ---

          state.lastError = testErrorLog; // Store enhanced error for the next potential fix iteration
          state.testResult = testNavResult.result; // Store partial result if any
          logger.warn(`Job ${jobId}: Test FAILED (Iteration ${state.iteration}) - ${testNavResult.error}`);

          // Add to fix history for test failures
          if (currentConfig) { // Use currentConfig here as it passed validation
             state.fixHistory = state.fixHistory || [];
             state.fixHistory.push({
               iteration: state.iteration,
               configAttempted: currentConfig, // Record the config that failed the test
               errorLog: state.lastError ?? 'Unknown error in processing loop' // Provide fallback
             });
          }
        }
      } catch (execError: any) {
         // ... (existing catch block for test execution errors) ...
        testPassed = false;
        testErrorLog = `Test execution crashed: ${execError.message}`;

        // --- Simulate Adding Diagnostics (Crash Scenario) --- 
        testErrorLog += `\n\n[Simulated Diagnostics: Screenshot available at failure_screenshot_${jobId}_iter${state.iteration}.png]`;
        testErrorLog += `\n[Simulated Diagnostics: Console Logs Captured (Crash)]`;
        // --- End Simulation ---

         // --- Capture HTML on crash ---
         try {
            if (page) {
                capturedHtmlForFix = await page.content();
                logger.info(`Job ${jobId}: Captured HTML content (${capturedHtmlForFix?.length ?? 0} chars) after test crash for AI fix.`);
            } else {
                logger.warn(`Job ${jobId}: Cannot capture HTML for fix (crash) as page object is null.`);
            }
        } catch (htmlError: any) {
            logger.error(`Job ${jobId}: Could not capture HTML content for AI fix (crash): ${htmlError.message}`);
        }
        // --- End Capture HTML ---

        state.lastError = testErrorLog; // Store crash error
        state.testResult = null; // No reliable result available

        // Add to fix history for crashes
        if (currentConfig) { // Record the config that led to the crash
          state.fixHistory = state.fixHistory || [];
          state.fixHistory.push({
              iteration: state.iteration,
              configAttempted: currentConfig,
              errorLog: state.lastError ?? 'Unknown error in processing loop' // Provide fallback
          });
        }

        logger.error(
          `Job ${jobId}: Test FAILED (Iteration ${state.iteration}) - ${testErrorLog}`,
          execError
        );
      } finally {
        // ... (existing finally block to close page/browser) ...
        if (page) await page.close();
        if (browser) await BrowserPool.getInstance().releaseBrowser(browser);
      }

      // --- Post-Test Logic ---
      if (testPassed) {
        state.currentStatus = 'Completed';
        await updateJobStatus(job, state, PROGRESS_COMPLETE); // Set progress to 100%
        logger.info(`Job ${jobId}: Storing final configuration after successful test.`);
         // Ensure originalPrompt is stored
        await storageService.store({
          id: jobId,
          queueName: job.queueName,
          originalPrompt: state.prompt, // Store original prompt
          url: state.url,
          config: currentConfig,
          options: state.options,
          estimatedCost: state.estimatedCost,
        });
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
        // Test failed, prepare for next iteration (if maxIterations not reached)
        state.lastError = testErrorLog || 'Unknown test failure';
        state.htmlContentAtFailure = capturedHtmlForFix; // Store captured HTML in state
        state.currentStatus = `Test Failed (Iteration ${state.iteration})`;
        const progressTestEnd = baseProgress + (PROGRESS_TEST_END - baseProgress);
        await updateJobStatus(job, state, progressTestEnd);
        logger.warn(
          `Job ${jobId}: Test failed. Preparing for fix iteration ${state.iteration + 1}. Error: ${
            state.lastError?.substring(0, 500) // Log truncated error
          }...`
        );
        // Loop continues...
      }
    } catch (error: any) {
      // --- Catch errors within the main loop (e.g., AI call failure, validation error not caught) ---
      logger.error(
        `Job ${jobId}: Unhandled error in generation/validation loop (Iteration ${state.iteration}): ${error.message}`,
        { error }
      );
      state.lastError = error.message; // Store the error
      state.currentStatus = `Error Occurred (Iteration ${state.iteration})`;

      // Add to fix history for other loop errors
      if (state.lastConfig) { // Record the config that was active when error occurred (might be from previous iter or current invalid one)
        state.fixHistory = state.fixHistory || [];
        state.fixHistory.push({
            iteration: state.iteration,
            configAttempted: state.lastConfig,
            errorLog: state.lastError ?? 'Unknown error in processing loop' // Provide fallback
        });
      }

      // Use progress from the end of the test phase, as the error likely happened there or after
      const progressErrorOccurred = baseProgress + (PROGRESS_TEST_END - baseProgress);
      await updateJobStatus(job, state, progressErrorOccurred);
      // Loop continues, will likely use this error in the next potential fix attempt
    }
  } // --- End of while loop ---

  // --- Max Iterations Reached ---
  logger.error(
    `Job ${jobId}: Failed to generate working config after ${state.options.maxIterations} iterations.`
  );
  state.currentStatus = 'Failed - Max Iterations Reached';
  state.message = `Failed after ${state.options.maxIterations} attempts. Last error: ${
    state.lastError ?? 'Unknown'
  }`;
  state.status = 'failed'; // Final status
  // Use progress from the end of the test phase for the final failure state
  await updateJobStatus(job, state, PROGRESS_TEST_END);

   // Store the final failed state? Optional, but might be useful for debugging.
   // Store the last generated config even if it failed the final test.
   await storageService.store({
     id: jobId,
     queueName: job.queueName,
     originalPrompt: state.prompt,
     url: state.url,
     config: state.lastConfig, // Store the last config attempted
     options: state.options,
     estimatedCost: state.estimatedCost,
     status: 'failed', // Explicitly store failed status
     errorMessage: state.lastError, // Store the final error message
   });


  throw new Error(
    `Failed to generate working config for job ${jobId} after ${
      state.options.maxIterations
    } iterations. Last error: ${state.lastError ?? 'Unknown error'}`
  );
}
