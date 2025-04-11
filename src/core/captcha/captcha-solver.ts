import { Page, BrowserContext } from 'playwright';
import { CaptchaDetector, CaptchaType } from './captcha-detector.js';
import { logger } from '../../utils/logger.js';
import { config } from '../../config/index.js';
import { BehaviorEmulator } from '../human/behavior-emulator.js';
import { SessionManager } from '../session/session-manager.js';

declare global {
  interface Window {
    ___grecaptcha_cfg?: {
      clients?: {
        [key: string]: {
          callbacks?: Array<(token: string) => void>;
        };
      };
    };
  }
}

/**
 * Result of a CAPTCHA solving attempt
 */
export interface CaptchaSolveResult {
  success: boolean;
  token?: string;
  error?: string;
  method?: string;
  timeSpent?: number;
}

/**
 * Options for solving CAPTCHAs
 */
export interface CaptchaSolveOptions {
  timeout?: number;
  useExternalService?: boolean;
  service?: 'twocaptcha' | 'anticaptcha';
  humanEmulation?: boolean;
  useSession?: boolean;
  context?: BrowserContext;
}

/**
 * Solves various types of CAPTCHAs
 */
export class CaptchaSolver {
  private page: Page;
  private behaviorEmulator: BehaviorEmulator;
  private sessionManager: SessionManager;

  /**
   * Create a new CaptchaSolver
   */
  constructor(page: Page) {
    this.page = page;
    this.behaviorEmulator = new BehaviorEmulator(page);
    this.sessionManager = SessionManager.getInstance();
  }

  /**
   * Detect and solve a CAPTCHA on the current page
   */
  public async solve(options: CaptchaSolveOptions = {}): Promise<CaptchaSolveResult> {
    const startTime = Date.now();
    const url = this.page.url();

    try {
      // Check if we have a session with solved CAPTCHAs for this domain
      if (options.useSession !== false && config.browser.session?.enabled) {
        const session = await this.sessionManager.getSession(url);

        if (session && session.captchaSolved) {
          logger.info(`Using existing session with solved CAPTCHAs for ${session.domain}`);
          return {
            success: true,
            method: 'session_reuse',
            timeSpent: Date.now() - startTime,
          };
        }
      }

      // Detect CAPTCHA
      const detection = await CaptchaDetector.detect(this.page);

      if (!detection.detected) {
        logger.info('No CAPTCHA detected on the page');
        return {
          success: true,
          method: 'none_required',
          timeSpent: Date.now() - startTime,
        };
      }

      logger.info(`Attempting to solve ${detection.type} CAPTCHA`);

      // Set timeout
      const timeout = options.timeout || config.captcha.solveTimeout;
      const timeoutPromise = new Promise<CaptchaSolveResult>((_, reject) => {
        setTimeout(() => {
          reject(new Error(`CAPTCHA solving timed out after ${timeout}ms`));
        }, timeout);
      });

      // Choose solving method based on CAPTCHA type
      let solvingPromise: Promise<CaptchaSolveResult>;

      switch (detection.type) {
        case CaptchaType.RECAPTCHA_V2:
          solvingPromise = this.solveRecaptchaV2(detection.siteKey, detection.selector, options);
          break;
        case CaptchaType.RECAPTCHA_V3:
          solvingPromise = this.solveRecaptchaV3(detection.siteKey, options);
          break;
        case CaptchaType.HCAPTCHA:
          solvingPromise = this.solveHCaptcha(detection.siteKey, detection.selector, options);
          break;
        case CaptchaType.CLOUDFLARE:
          solvingPromise = this.solveCloudflare(options);
          break;
        case CaptchaType.IMAGE_CAPTCHA:
          solvingPromise = this.solveImageCaptcha(detection.selector, options);
          break;
        default:
          return {
            success: false,
            error: `Unsupported CAPTCHA type: ${detection.type}`,
            timeSpent: Date.now() - startTime,
          };
      }

      // Race against timeout
      const result = await Promise.race([solvingPromise, timeoutPromise]);
      result.timeSpent = Date.now() - startTime;

      // If CAPTCHA was solved successfully, save the session
      if (
        result.success &&
        options.useSession !== false &&
        config.browser.session?.enabled &&
        options.context
      ) {
        try {
          const domain = new URL(url).hostname;
          await this.sessionManager.saveSession(options.context, { domain });
          logger.info(`Saved session with solved CAPTCHAs for domain: ${domain}`);
        } catch (error) {
          logger.warn(`Failed to save session after solving CAPTCHA: ${error}`);
        }
      }

      return result;
    } catch (error) {
      logger.error('Error solving CAPTCHA:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
        timeSpent: Date.now() - startTime,
      };
    }
  }

  /**
   * Solve reCAPTCHA v2
   */
  private async solveRecaptchaV2(
    siteKey?: string,
    selector?: string,
    options: CaptchaSolveOptions = {}
  ): Promise<CaptchaSolveResult> {
    // Try external service first if enabled
    if (options.useExternalService && siteKey) {
      try {
        const externalResult = await this.solveWithExternalService(
          'recaptcha_v2',
          siteKey,
          options.service
        );

        if (externalResult.success) {
          // Apply the token to the page
          await this.applyRecaptchaToken(externalResult.token);
          return externalResult;
        }
      } catch (error) {
        logger.warn('External service failed, falling back to browser solving:', error);
      }
    }

    // Fall back to browser-based solving
    try {
      // Find and click on the reCAPTCHA checkbox
      if (selector) {
        await this.behaviorEmulator.clickElement(selector);
        await this.page.waitForTimeout(2000); // Wait for CAPTCHA to load
      } else {
        // Try to find the iframe and click on it
        const frame = this.page.frameLocator('iframe[src*="google.com/recaptcha/api2/anchor"]');
        await frame.locator('.recaptcha-checkbox').click();
        await this.page.waitForTimeout(2000);
      }

      // Check if we need to solve an audio challenge
      const audioChallenge = await this.solveAudioChallenge();
      if (audioChallenge.success) {
        return audioChallenge;
      }

      // If audio challenge failed or wasn't available, we can't solve it in the browser yet
      return {
        success: false,
        error: 'Browser-based solving of image challenges not implemented yet',
        method: 'browser_automation',
      };
    } catch (error) {
      logger.error('Error in browser-based reCAPTCHA solving:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
        method: 'browser_automation',
      };
    }
  }

  /**
   * Solve reCAPTCHA v3
   */
  private async solveRecaptchaV3(
    siteKey?: string,
    options: CaptchaSolveOptions = {}
  ): Promise<CaptchaSolveResult> {
    if (!siteKey) {
      return {
        success: false,
        error: 'Site key is required for reCAPTCHA v3',
        method: 'none',
      };
    }

    // reCAPTCHA v3 can only be solved with an external service or token harvesting
    if (options.useExternalService) {
      return this.solveWithExternalService('recaptcha_v3', siteKey, options.service);
    }

    // Try to extract token from page
    try {
      const token = await this.page.evaluate((key: string) => {
        return (window as any).grecaptcha?.execute(key, { action: 'submit' });
      }, siteKey);

      if (token) {
        return {
          success: true,
          token,
          method: 'token_extraction',
        };
      }
    } catch (error) {
      logger.error('Error extracting reCAPTCHA v3 token:', error);
    }

    return {
      success: false,
      error: 'Could not solve reCAPTCHA v3 without external service',
      method: 'none',
    };
  }

  /**
   * Solve hCaptcha
   */
  private async solveHCaptcha(
    siteKey?: string,
    selector?: string,
    options: CaptchaSolveOptions = {}
  ): Promise<CaptchaSolveResult> {
    // Try external service first if enabled
    if (options.useExternalService && siteKey) {
      try {
        const externalResult = await this.solveWithExternalService(
          'hcaptcha',
          siteKey,
          options.service
        );

        if (externalResult.success) {
          // Apply the token to the page
          await this.applyHCaptchaToken(externalResult.token);
          return externalResult;
        }
      } catch (error) {
        logger.warn('External service failed, falling back to browser solving:', error);
      }
    }

    // Browser-based solving of hCaptcha is not implemented yet
    return {
      success: false,
      error: 'Browser-based solving of hCaptcha not implemented yet',
      method: 'none',
    };
  }

  /**
   * Solve Cloudflare challenge
   */
  private async solveCloudflare(options: CaptchaSolveOptions = {}): Promise<CaptchaSolveResult> {
    // Cloudflare challenges often just need to wait
    logger.info('Waiting for Cloudflare challenge to resolve...');

    try {
      // Wait for the challenge to disappear
      await this.page.waitForSelector(
        '#cf-challenge-running, #cf-please-wait, .cf-browser-verification',
        {
          state: 'detached',
          timeout: 15000,
        }
      );

      // Additional wait to ensure page is fully loaded
      await this.page.waitForLoadState('networkidle');

      // Check if we're still on a Cloudflare page
      const title = await this.page.title();
      if (
        title.includes('Cloudflare') &&
        (title.includes('challenge') || title.includes('security check'))
      ) {
        return {
          success: false,
          error: 'Still on Cloudflare challenge page after waiting',
          method: 'wait',
        };
      }

      return {
        success: true,
        method: 'wait',
      };
    } catch (error) {
      logger.error('Error waiting for Cloudflare challenge:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
        method: 'wait',
      };
    }
  }

  /**
   * Solve image CAPTCHA
   */
  private async solveImageCaptcha(
    selector?: string,
    options: CaptchaSolveOptions = {}
  ): Promise<CaptchaSolveResult> {
    // Image CAPTCHAs are best solved with external services
    if (options.useExternalService && selector) {
      try {
        // Get the image data
        const imageData = await this.page.evaluate(sel => {
          const img = document.querySelector(sel) as HTMLImageElement;
          if (!img || !img.src) return null;

          // If it's a data URL, return it directly
          if (img.src.startsWith('data:')) {
            return img.src;
          }

          // Otherwise, we'd need to fetch and convert to base64
          // This is a simplified version - in production, you'd want to handle this more robustly
          return img.src;
        }, selector);

        if (!imageData) {
          return {
            success: false,
            error: 'Could not extract image data from CAPTCHA',
            method: 'none',
          };
        }

        // Solve with external service
        // This is a placeholder - actual implementation would depend on the service API
        logger.info('Image CAPTCHA solving with external service not fully implemented');
        return {
          success: false,
          error: 'Image CAPTCHA solving not fully implemented',
          method: 'external_service',
        };
      } catch (error) {
        logger.error('Error solving image CAPTCHA:', error);
        return {
          success: false,
          error: error instanceof Error ? error.message : String(error),
          method: 'external_service',
        };
      }
    }

    return {
      success: false,
      error: 'Image CAPTCHA solving requires an external service',
      method: 'none',
    };
  }

  /**
   * Solve audio challenge for reCAPTCHA
   */
  private async solveAudioChallenge(): Promise<CaptchaSolveResult> {
    try {
      // Switch to audio challenge
      const recaptchaFrame = this.page.frameLocator(
        'iframe[src*="google.com/recaptcha/api2/bframe"]'
      );
      const audioButton = recaptchaFrame.locator('#recaptcha-audio-button');

      // Check if audio button exists
      const audioButtonExists = (await audioButton.count()) > 0;
      if (!audioButtonExists) {
        return {
          success: false,
          error: 'Audio challenge not available',
          method: 'audio',
        };
      }

      // Click the audio button
      await audioButton.click();
      await this.page.waitForTimeout(2000);

      // Get the audio source
      const audioSrc = await recaptchaFrame.locator('audio#audio-source').getAttribute('src');
      if (!audioSrc) {
        return {
          success: false,
          error: 'Could not find audio source',
          method: 'audio',
        };
      }

      // In a real implementation, you would:
      // 1. Download the audio file
      // 2. Convert it to text using a speech-to-text service
      // 3. Enter the text into the response field
      // 4. Click the verify button

      // This is a placeholder for the actual implementation
      logger.info('Audio CAPTCHA solving not fully implemented');
      return {
        success: false,
        error: 'Audio CAPTCHA solving not fully implemented',
        method: 'audio',
      };
    } catch (error) {
      logger.error('Error solving audio challenge:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
        method: 'audio',
      };
    }
  }

  /**
   * Solve CAPTCHA using an external service
   */
  private async solveWithExternalService(
    captchaType: string,
    siteKey: string,
    service?: 'twocaptcha' | 'anticaptcha'
  ): Promise<CaptchaSolveResult> {
    // Determine which service to use
    const serviceToUse =
      service ||
      (config.captcha.services.twoCaptcha.enabled
        ? 'twocaptcha'
        : config.captcha.services.antiCaptcha.enabled
        ? 'anticaptcha'
        : null);

    if (!serviceToUse) {
      return {
        success: false,
        error: 'No external CAPTCHA solving service is configured',
        method: 'external_service',
      };
    }

    // Get API key for the selected service
    const apiKey =
      serviceToUse === 'twocaptcha'
        ? config.captcha.services.twoCaptcha.apiKey
        : config.captcha.services.antiCaptcha.apiKey;

    if (!apiKey) {
      return {
        success: false,
        error: `No API key configured for ${serviceToUse}`,
        method: 'external_service',
      };
    }

    // Get the page URL
    const pageUrl = this.page.url();

    // This is a placeholder for the actual API call to the external service
    // In a real implementation, you would:
    // 1. Send a request to the service API with the site key, page URL, and other parameters
    // 2. Poll for the result
    // 3. Return the token when available

    logger.info(`Solving ${captchaType} using ${serviceToUse} (placeholder implementation)`);

    // Simulate a delay for the external service
    await new Promise(resolve => setTimeout(resolve, 3000));

    // Return a placeholder result
    return {
      success: false,
      error: 'External CAPTCHA solving service integration not fully implemented',
      method: 'external_service',
    };
  }

  /**
   * Apply a reCAPTCHA token to the page
   */
  private async applyRecaptchaToken(token?: string): Promise<void> {
    if (!token) return;

    await this.page.evaluate(t => {
      // Find the g-recaptcha-response textarea and set its value
      const responseTextarea = document.querySelector(
        'textarea#g-recaptcha-response'
      ) as HTMLTextAreaElement;
      if (responseTextarea) {
        responseTextarea.value = t;
      }

      // Trigger the callback if it exists
      if ((window as any).___grecaptcha_cfg?.clients) {
        // Find the callback
        const clientKeys = Object.keys((window as any).___grecaptcha_cfg.clients);
        for (const key of clientKeys) {
          const client = (window as any).___grecaptcha_cfg.clients[key];
          if (client && client.callbacks && client.callbacks.length > 0) {
            // Call all callbacks with the token
            for (const callback of client.callbacks) {
              if (typeof callback === 'function') {
                callback(t);
              }
            }
          }
        }
      }
    }, token);
  }

  /**
   * Apply an hCaptcha token to the page
   */
  private async applyHCaptchaToken(token?: string): Promise<void> {
    if (!token) return;

    await this.page.evaluate(t => {
      // Find the h-captcha-response textarea and set its value
      const responseTextarea = document.querySelector(
        'textarea#h-captcha-response'
      ) as HTMLTextAreaElement;
      if (responseTextarea) {
        responseTextarea.value = t;
      }

      // Trigger the callback if it exists
      if ((window as any).hcaptcha && typeof (window as any).hcaptcha.getResponse === 'function') {
        // Find the callback
        const callbacks = (window as any).hcaptcha.getResponse.callbacks;
        if (callbacks && callbacks.length > 0) {
          // Call all callbacks with the token
          for (const callback of callbacks) {
            if (typeof callback === 'function') {
              callback(t);
            }
          }
        }
      }
    }, token);
  }
}
