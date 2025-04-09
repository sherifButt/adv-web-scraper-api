import { Page } from 'playwright';
import { NavigationStep } from '../types/navigation.types.js';
import { logger } from '../../utils/logger.js';
import { CssSelectorConfig } from '../../types/extraction.types.js';
import { BaseStepHandler } from './base-step-handler.js';

export class ExtractStepHandler extends BaseStepHandler {
  public canHandle(step: NavigationStep): boolean {
    return step.type === 'extract';
  }

  public async execute(step: NavigationStep, context: Record<string, any>): Promise<void> {
    const selector = this.resolveValue(step.selector, context);
    const name = step.name || 'extractedData';
    logger.info(`Extracting data from: ${selector}`);

    if (step.fields) {
      const result: Record<string, any> = {};
      for (const [fieldName, fieldDef] of Object.entries(step.fields)) {
        try {
          if (typeof fieldDef === 'object' && 'selector' in fieldDef && 'type' in fieldDef) {
            const fieldSelector = `${selector} ${fieldDef.selector}`;
            if (fieldDef.type === 'css') {
              const cssConfig = fieldDef as CssSelectorConfig;
              try {
                if (cssConfig.multiple) {
                  if ('fields' in fieldDef) {
                    result[fieldName] = await this.extractMultipleFields(
                      fieldSelector,
                      fieldDef.fields
                    );
                  } else {
                    result[fieldName] = await this.extractMultipleValues(fieldSelector, cssConfig);
                  }
                } else {
                  if ('selectors' in fieldDef && Array.isArray(fieldDef.selectors)) {
                    result[fieldName] = await this.tryMultipleSelectors(selector, fieldDef);
                  } else {
                    result[fieldName] = await this.extractSingleValue(fieldSelector, cssConfig);
                  }
                }
              } catch (error) {
                logger.warn(`Failed to extract CSS field ${fieldName}:`, error);
                result[fieldName] = null;
              }
            } else {
              logger.warn(`Non-CSS selector type ${fieldDef.type} not fully supported`);
              result[fieldName] = null;
            }
          } else {
            logger.warn('Nested extraction not fully supported');
            result[fieldName] = null;
          }
        } catch (error) {
          logger.warn(`Failed to extract field ${fieldName}:`, error);
          result[fieldName] = null;
        }
      }
      context[name] = result;
    } else if (step.list) {
      context[name] = await this.extractList(selector);
    } else if (step.source === 'html') {
      context[name] = await this.extractHtml(selector);
    } else {
      context[name] = await this.extractText(selector);
    }
  }

  private async extractMultipleFields(
    selector: string,
    fields: Record<string, any>
  ): Promise<any[]> {
    return this.page.$$eval(
      selector,
      (elements, fields) =>
        elements.map(el => {
          const item: Record<string, string | null> = {};
          for (const [subFieldName, subFieldDef] of Object.entries(fields)) {
            if (typeof subFieldDef === 'object' && subFieldDef && 'selector' in subFieldDef) {
              const subEl = el.querySelector(subFieldDef.selector);
              item[subFieldName] = subEl
                ? 'attribute' in subFieldDef
                  ? subEl.getAttribute(subFieldDef.attribute as string) || ''
                  : subEl.textContent?.trim() || ''
                : null;
            }
          }
          return item;
        }),
      fields
    );
  }

  private async extractMultipleValues(selector: string, config: CssSelectorConfig): Promise<any[]> {
    const attr = 'attribute' in config ? config.attribute : null;
    return this.page.$$eval(
      selector,
      (elements, attr) =>
        elements.map(el => (attr ? el.getAttribute(attr) || '' : el.textContent?.trim() || '')),
      attr
    );
  }

  private async tryMultipleSelectors(baseSelector: string, fieldDef: any): Promise<any> {
    for (const selectorOption of fieldDef.selectors) {
      const fullSelector = `${baseSelector} ${selectorOption}`;
      try {
        if ('attribute' in fieldDef) {
          return await this.page.$eval(
            fullSelector,
            (el, attr) => el.getAttribute(attr),
            fieldDef.attribute || ''
          );
        } else {
          return await this.page.$eval(fullSelector, el => el.textContent?.trim() || '');
        }
      } catch (error) {
        logger.debug(`Selector ${fullSelector} failed, trying next option`);
      }
    }
    return null;
  }

  private async extractSingleValue(selector: string, config: CssSelectorConfig): Promise<any> {
    if ('attribute' in config) {
      return await this.page
        .$eval(selector, (el, attr) => el.getAttribute(attr), config.attribute || '')
        .catch(() => null);
    }
    return await this.page.$eval(selector, el => el.textContent?.trim() || '').catch(() => null);
  }

  private async extractList(selector: string): Promise<string[]> {
    return this.page
      .$$eval(selector, elements => elements.map(el => el.textContent?.trim() || ''))
      .catch(() => []);
  }

  private async extractHtml(selector: string): Promise<string | null> {
    return this.page.$eval(selector, el => el.innerHTML).catch(() => null);
  }

  private async extractText(selector: string): Promise<string | null> {
    return this.page.$eval(selector, el => el.textContent?.trim() || '').catch(() => null);
  }
}
