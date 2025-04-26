// src/extraction/extraction-engine.ts

import { ElementHandle, Page } from 'playwright';
import { v4 as uuidv4 } from 'uuid';
import {
  ExtractionConfig,
  ExtractionResult,
  FieldConfig,
  NestedExtractionConfig,
  SelectorConfig,
  SelectorType,
} from '../types/extraction.types.js';
import {
  CssSelectorStrategy,
  FunctionSelectorStrategy,
  RegexSelectorStrategy,
  SelectorStrategy,
  XPathSelectorStrategy,
} from './selectors/index.js';
import { logger } from '../utils/logger.js';
import { BrowserPool } from '../core/browser/browser-pool.js';
import { BehaviorEmulator } from '../core/human/behavior-emulator.js';
import { CaptchaDetector } from '../core/captcha/captcha-detector.js';
import { CaptchaSolver } from '../core/captcha/captcha-solver.js';
import { ProxyManager } from '../core/proxy/proxy-manager.js';

/**
 * Main extraction engine for extracting data from web pages
 */
export class ExtractionEngine {
  private selectorStrategies: SelectorStrategy[] = [];
  private browserPool: BrowserPool;
  private proxyManager: ProxyManager;

  /**
   * Create a new extraction engine
   */
  constructor() {
    // Register selector strategies
    this.selectorStrategies = [
      new CssSelectorStrategy(),
      new XPathSelectorStrategy(),
      new RegexSelectorStrategy(),
      new FunctionSelectorStrategy(),
    ];

    // Get singleton instances
    this.browserPool = BrowserPool.getInstance();
    this.proxyManager = ProxyManager.getInstance();
  }

  /**
   * Extract data from a web page
   * @param config Extraction configuration
   * @returns Extraction result
   */
  public async extract(config: ExtractionConfig): Promise<ExtractionResult> {
    const startTime = new Date();
    const id = `extract_${uuidv4()}`;
    const url = config.url || '';
    let pagesProcessed = 0;
    let itemsExtracted = 0;

    try {
      // Get a browser instance
      const browser = await this.browserPool.getBrowser(config.options?.browser);

      // Set up proxy if requested
      let proxyInfo = null;
      if (config.options?.proxy) {
        proxyInfo = await this.proxyManager.getProxy();
      }

      // Create a browser context with proxy if available
      const contextOptions: any = {};
      if (proxyInfo) {
        if (!proxyInfo.ip || !proxyInfo.port || !proxyInfo.protocols?.length) {
          throw new Error('Proxy configuration is incomplete - missing ip, port or protocols');
        }
        contextOptions.proxy = {
          server: `${proxyInfo.protocols[0]}://${proxyInfo.ip}:${proxyInfo.port}`,
        };
        if (proxyInfo.username && proxyInfo.password) {
          contextOptions.proxy.username = proxyInfo.username;
          contextOptions.proxy.password = proxyInfo.password;
        }
      }

      // Create a browser context
      const context = await this.browserPool.createContext(browser, {
        ...config.options?.browser,
        proxy: contextOptions.proxy,
      });

      // Create a page
      const page = await context.newPage();

      // Set up human emulation if requested
      let behaviorEmulator = null;
      if (config.options?.humanEmulation) {
        behaviorEmulator = new BehaviorEmulator(page);
      }

      // Set headers if provided
      if (config.options?.headers) {
        await page.setExtraHTTPHeaders(config.options.headers);
      }

      // Set cookies if provided
      if (config.options?.cookies) {
        const cookies = Object.entries(config.options.cookies).map(([name, value]) => ({
          name,
          value,
          url,
        }));
        await context.addCookies(cookies);
      }

      // Navigate to the URL
      await page.goto(url, {
        timeout: config.options?.timeout || 30000,
        waitUntil: 'networkidle',
      });

      // Wait for selector if specified
      if (config.options?.waitForSelector) {
        await page.waitForSelector(config.options.waitForSelector, {
          timeout: config.options?.waitForTimeout || 5000,
        });
      }

      // Check for CAPTCHA if requested
      if (config.options?.solveCaptcha) {
        const captchaDetection = await CaptchaDetector.detect(page);
        if (captchaDetection.detected) {
          logger.info(`CAPTCHA detected: ${captchaDetection.type}`);
          const captchaSolver = new CaptchaSolver(page);
          const solveResult = await captchaSolver.solve();
          if (!solveResult.success) {
            throw new Error(`Failed to solve CAPTCHA: ${solveResult.error}`);
          }
        }
      }

      // Extract data
      pagesProcessed++;
      const data = await this.extractFields(page, config.fields, {});

      // Handle pagination if configured
      if (config.pagination) {
        // Pagination implementation would go here
        // This is a placeholder for future implementation
      }

      // Count extracted items
      itemsExtracted = this.countExtractedItems(data);

      // Clean up resources
      await context.close();
      this.browserPool.releaseBrowser(browser);

      // Report proxy result if used
      if (proxyInfo) {
        this.proxyManager.reportProxyResult(proxyInfo, true);
      }

      // Calculate duration
      const endTime = new Date();
      const duration = endTime.getTime() - startTime.getTime();

      // Return the result
      return {
        id,
        url,
        status: 'completed',
        data,
        stats: {
          startTime: startTime.toISOString(),
          endTime: endTime.toISOString(),
          duration,
          pagesProcessed,
          itemsExtracted,
        },
        timestamp: new Date().toISOString(),
      };
    } catch (error: any) {
      logger.error(`Extraction error: ${error}`);

      // Calculate duration
      const endTime = new Date();
      const duration = endTime.getTime() - startTime.getTime();

      // Return error result
      return {
        id,
        url,
        status: 'failed',
        data: null,
        error: error.message,
        stats: {
          startTime: startTime.toISOString(),
          endTime: endTime.toISOString(),
          duration,
          pagesProcessed,
          itemsExtracted,
        },
        timestamp: new Date().toISOString(),
      };
    }
  }

  /**
   * Extract fields from a page
   * @param page Playwright page
   * @param fields Field configuration
   * @param context Extraction context
   * @returns Extracted data
   */
  private async extractFields(
    page: Page,
    fields: FieldConfig,
    context: any
  ): Promise<Record<string, any>> {
    const result: Record<string, any> = {};

    for (const [fieldName, fieldConfig] of Object.entries(fields)) {
      try {
        if (this.isNestedExtractionConfig(fieldConfig)) {
          // Handle nested extraction
          const nestedResult = await this.extractNestedFields(page, fieldConfig, context);
          if (nestedResult === null) {
            result[fieldName] = {
              value: null,
              error: `No elements found for selector: ${fieldConfig.selector}`,
            };
          } else {
            result[fieldName] = nestedResult;
          }
        } else {
          // Handle regular field extraction
          const value = await this.extractField(page, fieldConfig, context);
          if (value === null) {
            const selector =
              'selector' in fieldConfig
                ? fieldConfig.selector
                : fieldConfig.type === 'regex'
                ? fieldConfig.pattern
                : fieldConfig.type === 'function'
                ? 'custom function'
                : 'unknown selector';
            result[fieldName] = {
              value: null,
              error: `No elements found for selector: ${selector}`,
            };
          } else {
            result[fieldName] = value;
          }
        }
      } catch (error: unknown) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        logger.error(`Error extracting field "${fieldName}": ${errorMessage}`);
        result[fieldName] = {
          value: null,
          error: `Extraction failed: ${errorMessage}`,
        };
      }
    }

    return result;
  }

  /**
   * Extract a single field from a page
   * @param page Playwright page
   * @param config Selector configuration
   * @param context Extraction context
   * @returns Extracted data
   */
  private async extractField(page: Page, config: SelectorConfig, context: any): Promise<any> {
    // Find the appropriate strategy for this selector
    const strategy = this.selectorStrategies.find(s => s.canHandle(config));

    if (!strategy) {
      throw new Error(`No strategy found for selector type: ${config.type}`);
    }

    // Extract the data using the strategy
    let value = await strategy.extract(page, config, context);

    // Apply transformation if specified
    if (config.transform) {
      value = await this.applyTransformation(value, config.transform, context);
    }

    // Apply data type conversion if specified
    if (config.dataType) {
      value = this.convertDataType(value, config.dataType);
    }

    return value;
  }

  /**
   * Extract nested fields from a page
   * @param page Playwright page
   * @param config Nested extraction configuration
   * @param context Extraction context
   * @returns Extracted data
   */
  private async extractNestedFields(
    page: Page,
    config: NestedExtractionConfig,
    context: any
  ): Promise<any> {
    const { selector, type, multiple = false, fields } = config;

    // Helper function to try multiple selectors
    const trySelectors = async <T>(
      action: (selector: string) => Promise<T | null | undefined>
    ): Promise<T | null | undefined> => {
      if (typeof selector === 'string') {
        return action(selector);
      } else if (Array.isArray(selector)) {
        for (const sel of selector) {
          const result = await action(sel);
          // Use the first selector that yields a non-null/non-empty result
          if (result !== null && result !== undefined && (!Array.isArray(result) || result.length > 0)) {
            logger.debug(`Using fallback selector: ${sel}`);
            return result;
          }
          logger.debug(`Fallback selector failed: ${sel}`);
        }
        logger.warn(`All fallback selectors failed for config: ${JSON.stringify(config)}`);
        return null; // Or undefined, depending on desired behavior
      }
      return null; // Should not happen if selector is string | string[]
    };

    try {
      if (multiple) {
        // Extract multiple items
        if (type === SelectorType.CSS) {
          // For CSS selectors, use $$eval for better performance
          return trySelectors(async (sel) =>
            page.$$eval(
              sel, // Use the single selector 'sel' here
              (elements, fieldsJson) => {
                const fields = JSON.parse(fieldsJson);
                return elements.map(element => {
                  const result: Record<string, any> = {};

                  for (const [fieldName, fieldConfig] of Object.entries(fields)) {
                    try {
                      if ((fieldConfig as any).type === 'css') {
                        const subElements = element.querySelectorAll((fieldConfig as any).selector);
                        if ((fieldConfig as any).multiple) {
                          result[fieldName] = Array.from(subElements).map(el => {
                            if ((fieldConfig as any).attribute) {
                              return el.getAttribute((fieldConfig as any).attribute) || '';
                            } else if ((fieldConfig as any).source === 'html') {
                              // Preserve HTML structure by wrapping in CDATA
                              return `<![CDATA[\n${el.innerHTML}\n]]>`;
                            } else {
                              return el.textContent?.trim() || '';
                            }
                          });
                        } else if (subElements.length > 0) {
                          if ((fieldConfig as any).attribute) {
                            result[fieldName] =
                              subElements[0].getAttribute((fieldConfig as any).attribute) || '';
                          } else {
                            result[fieldName] = subElements[0].textContent?.trim() || '';
                          }
                        } else {
                          result[fieldName] = null;
                        }
                      } else {
                        // For non-CSS selectors, we can't handle them in the browser context
                        result[fieldName] = null;
                      }
                    } catch (error) {
                      result[fieldName] = null; // Default to null on error
                    }
                  }

                  return result;
                });
              },
              JSON.stringify(fields)
            )
          );
        } else {
          // For XPath selectors, we need to handle each element individually
          // Use trySelectors to get the list of elements
          const elements = await trySelectors(async (sel) => page.$$(sel));
          if (!elements || elements.length === 0) {
             logger.warn(`Selector(s) "${Array.isArray(selector) ? selector.join('", "') : selector}" not found for nested XPath extraction`);
             return [];
          }

          const results: any[] = [];
          for (const element of elements) {
            const elementContext = { ...context, element };
            const result: Record<string, any> = {};

            for (const [fieldName, fieldConfig] of Object.entries(fields)) {
              try {
                if (this.isNestedExtractionConfig(fieldConfig)) {
                  // Handle nested extraction
                  result[fieldName] = await this.extractNestedFields(
                    page,
                    fieldConfig,
                    elementContext
                  );
                } else {
                  // Handle regular field extraction
                  result[fieldName] = await this.extractField(page, fieldConfig, elementContext);
                }
              } catch (error) {
                logger.error(`Error extracting nested field "${fieldName}": ${error}`);
                result[fieldName] = null; // Default to null on error
              }
            }
            results.push(result);
          }
          return results;
        }
      } else {
        // Extract a single item
        // Use trySelectors to find the single element
        const element = await trySelectors(async (sel) => page.$(sel));
        if (!element) {
          logger.warn(`Selector(s) "${Array.isArray(selector) ? selector.join('", "') : selector}" not found for single nested extraction`);
          return null;
        }

        const elementContext = { ...context, element };
        return this.extractFields(page, fields, elementContext);
      }
    } catch (error) {
      logger.error(`Error in nested extraction: ${error}`);
      return null;
    }
  }

  /**
   * Apply a transformation to an extracted value
   * @param value Value to transform
   * @param transform Transformation function or string
   * @param context Extraction context
   * @returns Transformed value
   */
  private async applyTransformation(
    value: any,
    transform: string | ((value: any, context?: any) => any),
    context: any
  ): Promise<any> {
    try {
      if (typeof transform === 'function') {
        // Apply function directly
        return transform(value, context);
      } else if (typeof transform === 'string') {
        // Parse and apply transformation string
        // This is a placeholder for future implementation
        // Could support things like 'trim', 'toLowerCase', 'replace(a, b)', etc.
        if (transform === 'trim' && typeof value === 'string') {
          return value.trim();
        } else if (transform === 'toLowerCase' && typeof value === 'string') {
          return value.toLowerCase();
        } else if (transform === 'toUpperCase' && typeof value === 'string') {
          return value.toUpperCase();
        } else if (transform.startsWith('replace(') && typeof value === 'string') {
          const match = transform.match(/replace\((['"])(.+?)\1,\s*(['"])(.+?)\3\)/);
          if (match) {
            const [_, __, pattern, ___, replacement] = match;
            return value.replace(new RegExp(pattern, 'g'), replacement);
          }
        }
      }

      // If no transformation applied, return original value
      return value;
    } catch (error) {
      logger.error(`Error applying transformation: ${error}`);
      return value;
    }
  }

  /**
   * Convert a value to the specified data type
   * @param value Value to convert
   * @param dataType Target data type
   * @returns Converted value
   */
  private convertDataType(value: any, dataType: string): any {
    try {
      switch (dataType) {
        case 'string':
          return String(value);
        case 'number':
          return Number(value);
        case 'boolean':
          return Boolean(value);
        case 'date':
          return new Date(value).toISOString();
        case 'array':
          return Array.isArray(value) ? value : [value];
        case 'object':
          return typeof value === 'object' ? value : { value };
        default:
          return value;
      }
    } catch (error) {
      logger.error(`Error converting data type: ${error}`);
      return value;
    }
  }

  /**
   * Count the number of items extracted
   * @param data Extracted data
   * @returns Number of items
   */
  private countExtractedItems(data: any): number {
    if (!data) {
      return 0;
    }

    if (Array.isArray(data)) {
      return data.length;
    }

    if (typeof data === 'object') {
      let count = 0;
      for (const value of Object.values(data)) {
        count += this.countExtractedItems(value);
      }
      return count || 1; // Count at least 1 for non-empty objects
    }

    return 1; // Count primitive values as 1
  }

  /**
   * Check if a field config is a nested extraction config
   * @param config Field configuration
   * @returns True if it's a nested extraction config
   */
  private isNestedExtractionConfig(config: any): config is NestedExtractionConfig {
    return (
      typeof config === 'object' &&
      config !== null &&
      'selector' in config &&
      'type' in config &&
      'fields' in config
    );
  }
}
