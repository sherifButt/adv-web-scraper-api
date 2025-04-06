import { Page } from 'playwright';
import { logger } from '../../utils/logger.js';

/**
 * Types of CAPTCHAs that can be detected
 */
export enum CaptchaType {
  RECAPTCHA_V2 = 'recaptcha_v2',
  RECAPTCHA_V3 = 'recaptcha_v3',
  HCAPTCHA = 'hcaptcha',
  IMAGE_CAPTCHA = 'image_captcha',
  CLOUDFLARE = 'cloudflare',
  UNKNOWN = 'unknown',
}

/**
 * Result of CAPTCHA detection
 */
export interface CaptchaDetectionResult {
  detected: boolean;
  type: CaptchaType | null;
  siteKey?: string;
  selector?: string;
  iframe?: string;
  confidence: number; // 0-1 confidence score
}

/**
 * Detects various types of CAPTCHAs on a page
 */
export class CaptchaDetector {
  /**
   * Detect if a page contains a CAPTCHA
   */
  public static async detect(page: Page): Promise<CaptchaDetectionResult> {
    logger.info('Detecting CAPTCHAs on page...');

    // Check for reCAPTCHA v2
    const recaptchaV2Result = await this.detectRecaptchaV2(page);
    if (recaptchaV2Result.detected) {
      return recaptchaV2Result;
    }

    // Check for reCAPTCHA v3
    const recaptchaV3Result = await this.detectRecaptchaV3(page);
    if (recaptchaV3Result.detected) {
      return recaptchaV3Result;
    }

    // Check for hCaptcha
    const hCaptchaResult = await this.detectHCaptcha(page);
    if (hCaptchaResult.detected) {
      return hCaptchaResult;
    }

    // Check for Cloudflare challenge
    const cloudflareResult = await this.detectCloudflare(page);
    if (cloudflareResult.detected) {
      return cloudflareResult;
    }

    // Check for image CAPTCHAs
    const imageCaptchaResult = await this.detectImageCaptcha(page);
    if (imageCaptchaResult.detected) {
      return imageCaptchaResult;
    }

    // No CAPTCHA detected
    return {
      detected: false,
      type: null,
      confidence: 1.0,
    };
  }

  /**
   * Detect reCAPTCHA v2
   */
  private static async detectRecaptchaV2(page: Page): Promise<CaptchaDetectionResult> {
    // Check for reCAPTCHA iframe
    const recaptchaIframe = await page.$('iframe[src*="google.com/recaptcha/api2/anchor"]');
    
    // Check for reCAPTCHA div
    const recaptchaDiv = await page.$('div.g-recaptcha');
    
    // Check for reCAPTCHA script
    const recaptchaScript = await page.$('script[src*="google.com/recaptcha/api.js"]');
    
    // Extract site key if available
    let siteKey: string | undefined;
    if (recaptchaDiv) {
      siteKey = await page.evaluate(el => el.getAttribute('data-sitekey'), recaptchaDiv);
    }
    
    // If no site key from div, try to extract from script
    if (!siteKey && recaptchaScript) {
      const scriptContent = await page.evaluate(() => document.documentElement.outerHTML);
      const siteKeyMatch = scriptContent.match(/data-sitekey="([^"]+)"/);
      if (siteKeyMatch && siteKeyMatch[1]) {
        siteKey = siteKeyMatch[1];
      }
    }
    
    const detected = !!(recaptchaIframe || recaptchaDiv || recaptchaScript);
    const confidence = recaptchaIframe ? 1.0 : recaptchaDiv ? 0.9 : recaptchaScript ? 0.7 : 0;
    
    if (detected) {
      logger.info(`Detected reCAPTCHA v2 with confidence ${confidence}`);
    }
    
    return {
      detected,
      type: detected ? CaptchaType.RECAPTCHA_V2 : null,
      siteKey,
      selector: recaptchaDiv ? 'div.g-recaptcha' : undefined,
      iframe: recaptchaIframe ? 'iframe[src*="google.com/recaptcha/api2/anchor"]' : undefined,
      confidence,
    };
  }

  /**
   * Detect reCAPTCHA v3
   */
  private static async detectRecaptchaV3(page: Page): Promise<CaptchaDetectionResult> {
    // Check for reCAPTCHA v3 script
    const recaptchaScript = await page.$('script[src*="google.com/recaptcha/api.js?render="]');
    
    // Extract site key if available
    let siteKey: string | undefined;
    if (recaptchaScript) {
      const scriptSrc = await page.evaluate(el => el.getAttribute('src'), recaptchaScript);
      const siteKeyMatch = scriptSrc?.match(/render=([^&]+)/);
      if (siteKeyMatch && siteKeyMatch[1]) {
        siteKey = siteKeyMatch[1];
      }
    }
    
    // If no site key from script src, try to extract from page content
    if (!siteKey && recaptchaScript) {
      const scriptContent = await page.evaluate(() => document.documentElement.outerHTML);
      const siteKeyMatch = scriptContent.match(/grecaptcha\.execute\('([^']+)'/);
      if (siteKeyMatch && siteKeyMatch[1]) {
        siteKey = siteKeyMatch[1];
      }
    }
    
    const detected = !!recaptchaScript;
    const confidence = detected ? 0.9 : 0;
    
    if (detected) {
      logger.info(`Detected reCAPTCHA v3 with confidence ${confidence}`);
    }
    
    return {
      detected,
      type: detected ? CaptchaType.RECAPTCHA_V3 : null,
      siteKey,
      confidence,
    };
  }

  /**
   * Detect hCaptcha
   */
  private static async detectHCaptcha(page: Page): Promise<CaptchaDetectionResult> {
    // Check for hCaptcha iframe
    const hcaptchaIframe = await page.$('iframe[src*="hcaptcha.com/captcha"]');
    
    // Check for hCaptcha div
    const hcaptchaDiv = await page.$('div.h-captcha');
    
    // Check for hCaptcha script
    const hcaptchaScript = await page.$('script[src*="hcaptcha.com/1/api.js"]');
    
    // Extract site key if available
    let siteKey: string | undefined;
    if (hcaptchaDiv) {
      siteKey = await page.evaluate(el => el.getAttribute('data-sitekey'), hcaptchaDiv);
    }
    
    // If no site key from div, try to extract from script
    if (!siteKey && hcaptchaScript) {
      const scriptContent = await page.evaluate(() => document.documentElement.outerHTML);
      const siteKeyMatch = scriptContent.match(/data-sitekey="([^"]+)"/);
      if (siteKeyMatch && siteKeyMatch[1]) {
        siteKey = siteKeyMatch[1];
      }
    }
    
    const detected = !!(hcaptchaIframe || hcaptchaDiv || hcaptchaScript);
    const confidence = hcaptchaIframe ? 1.0 : hcaptchaDiv ? 0.9 : hcaptchaScript ? 0.7 : 0;
    
    if (detected) {
      logger.info(`Detected hCaptcha with confidence ${confidence}`);
    }
    
    return {
      detected,
      type: detected ? CaptchaType.HCAPTCHA : null,
      siteKey,
      selector: hcaptchaDiv ? 'div.h-captcha' : undefined,
      iframe: hcaptchaIframe ? 'iframe[src*="hcaptcha.com/captcha"]' : undefined,
      confidence,
    };
  }

  /**
   * Detect Cloudflare challenge
   */
  private static async detectCloudflare(page: Page): Promise<CaptchaDetectionResult> {
    // Check for Cloudflare challenge elements
    const cfChallenge = await page.$('#cf-challenge-running, #cf-please-wait, .cf-browser-verification');
    
    // Check for Cloudflare challenge in title
    const title = await page.title();
    const cfTitleMatch = title.includes('Cloudflare') && 
                         (title.includes('challenge') || title.includes('security check'));
    
    // Check for Cloudflare challenge in URL
    const url = page.url();
    const cfUrlMatch = url.includes('cloudflare') && url.includes('challenge');
    
    const detected = !!(cfChallenge || cfTitleMatch || cfUrlMatch);
    const confidence = cfChallenge ? 1.0 : cfTitleMatch ? 0.9 : cfUrlMatch ? 0.8 : 0;
    
    if (detected) {
      logger.info(`Detected Cloudflare challenge with confidence ${confidence}`);
    }
    
    return {
      detected,
      type: detected ? CaptchaType.CLOUDFLARE : null,
      selector: cfChallenge ? '#cf-challenge-running, #cf-please-wait, .cf-browser-verification' : undefined,
      confidence,
    };
  }

  /**
   * Detect image CAPTCHA
   */
  private static async detectImageCaptcha(page: Page): Promise<CaptchaDetectionResult> {
    // Common image CAPTCHA indicators
    const captchaIndicators = [
      'img[src*="captcha"]',
      'img[alt*="captcha"]',
      'input[name*="captcha"]',
      'div[id*="captcha"]',
      'div[class*="captcha"]',
      'label[for*="captcha"]',
      'img[src*="securimage"]',
    ];
    
    // Check for any of the indicators
    const captchaElement = await page.$(captchaIndicators.join(', '));
    
    // Check for CAPTCHA-related text
    const captchaText = await page.evaluate(() => {
      const bodyText = document.body.innerText.toLowerCase();
      return bodyText.includes('captcha') || 
             bodyText.includes('security code') || 
             bodyText.includes('verification code');
    });
    
    const detected = !!(captchaElement || captchaText);
    const confidence = captchaElement ? 0.9 : captchaText ? 0.7 : 0;
    
    if (detected) {
      logger.info(`Detected image CAPTCHA with confidence ${confidence}`);
    }
    
    return {
      detected,
      type: detected ? CaptchaType.IMAGE_CAPTCHA : null,
      selector: captchaElement ? captchaIndicators.join(', ') : undefined,
      confidence,
    };
  }
}
