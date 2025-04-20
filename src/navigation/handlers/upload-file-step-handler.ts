import { Page } from 'playwright';
import * as path from 'path';
import * as fs from 'fs';
import { UploadFileStep, NavigationContext, StepResult } from '../types/navigation.types.js'; // Corrected import format
import { logger } from '../../utils/logger.js';
import { BaseStepHandler } from './base-step-handler.js';

export class UploadFileStepHandler extends BaseStepHandler {
  public canHandle(step: UploadFileStep): boolean {
    return step.type === 'uploadFile';
  }

  public async execute(
    step: UploadFileStep,
    context: NavigationContext,
    page: Page
  ): Promise<StepResult> {
    const { selector, filePath, description, optional = false } = step;

    const stepDescription = description || `Upload file`;
    logger.info(`Executing step: ${stepDescription}`);

    if (!selector || !filePath) {
      throw new Error('UploadFile step requires both "selector" and "filePath".');
    }

    const resolvedSelector = this.resolveValue(selector, context) as string;
    const resolvedFilePath = this.resolveValue(filePath, context) as string;

    // Basic security check: Ensure the path is within reasonable bounds if relative
    // This is a simple check and might need refinement based on deployment strategy.
    const absolutePath = path.resolve(resolvedFilePath);
    // TODO: Add more robust path validation based on allowed directories if necessary.
    // For now, just check if the file exists.
    if (!fs.existsSync(absolutePath)) {
      throw new Error(
        `File not found at path: ${absolutePath} (resolved from ${resolvedFilePath})`
      );
    }

    try {
      logger.debug(`Locating file input element: ${resolvedSelector}`);
      const locator = page.locator(resolvedSelector);

      // Wait for the element to be present and visible/enabled?
      // setInputFiles implicitly waits for the element to be visible and enabled.
      await locator.waitFor({ state: 'visible', timeout: step.timeout || 10000 });

      logger.debug(`Setting input files to: ${absolutePath}`);
      await locator.setInputFiles(absolutePath);

      logger.info(`File upload step completed for selector "${resolvedSelector}".`);
      return {};
    } catch (error: any) {
      const errorMessage = `Error during uploadFile step "${stepDescription}" for selector "${resolvedSelector}": ${error.message}`;
      logger.error(errorMessage);
      if (!optional) {
        throw new Error(errorMessage); // Re-throw if mandatory
      } else {
        logger.warn(`Optional uploadFile step failed, continuing flow.`);
        context[`${step.name || 'lastUploadError'}`] = errorMessage;
        return {}; // Continue flow
      }
    }
  }
}
