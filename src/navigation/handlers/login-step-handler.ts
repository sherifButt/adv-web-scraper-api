import { Page } from 'playwright';
import { LoginStep, NavigationContext, StepResult } from '../types/navigation.types.js';
import { logger } from '../../utils/logger.js';
import { BaseStepHandler } from './base-step-handler.js';
// We might need access to other handlers or their logic, but let's start simple
// import { InputStepHandler } from './input-step-handler.js';
// import { ClickStepHandler } from './click-step-handler.js';

export class LoginStepHandler extends BaseStepHandler {
  // private inputHandler: InputStepHandler;
  // private clickHandler: ClickStepHandler;

  constructor(page: Page) {
    super(page);
    // If we want to reuse exact handler logic:
    // this.inputHandler = new InputStepHandler(page);
    // this.clickHandler = new ClickStepHandler(page);
  }

  public canHandle(step: LoginStep): boolean {
    return step.type === 'login';
  }

  public async execute(
    step: LoginStep,
    context: NavigationContext,
    page: Page // Receive page instance
  ): Promise<StepResult> {
    const {
      usernameSelector,
      passwordSelector,
      submitSelector,
      usernameValue,
      passwordValue,
      waitForNavigation = true, // Default to waiting for navigation
      description,
      // strategy, // Strategy not implemented in this basic version
    } = step;

    const stepDescription = description || `Login action`;
    logger.info(`Executing step: ${stepDescription}`);

    // Resolve values from context if they are template strings
    const resolvedUsername = this.resolveValue(usernameValue, context) as string;
    const resolvedPassword = this.resolveValue(passwordValue, context) as string; // Be mindful of logging passwords

    if (!resolvedUsername || !resolvedPassword) {
      throw new Error('Username or password value is missing or could not be resolved.');
    }

    try {
      // --- Fill Username ---
      logger.debug(`Filling username in selector: ${usernameSelector}`);
      const usernameLocator = page.locator(usernameSelector);
      await usernameLocator.waitFor({ state: 'visible', timeout: step.timeout || 10000 });
      // Consider using human-like typing from BehaviorEmulator if needed
      await usernameLocator.fill(resolvedUsername);
      // Make think time conditional
      if(step.humanLike) await this.simulateThinkTime(); // Add a small pause

      // --- Fill Password ---
      logger.debug(`Filling password in selector: ${passwordSelector}`);
      const passwordLocator = page.locator(passwordSelector);
      await passwordLocator.waitFor({ state: 'visible', timeout: step.timeout || 10000 });
      await passwordLocator.fill(resolvedPassword);
      // Make think time conditional
      if(step.humanLike) await this.simulateThinkTime();

      // --- Click Submit ---
      logger.debug(`Clicking submit button: ${submitSelector}`);
      const submitLocator = page.locator(submitSelector);
      await submitLocator.waitFor({ state: 'visible', timeout: step.timeout || 10000 });

      // Handle waiting logic
      if (waitForNavigation) {
        logger.debug('Waiting for navigation after submit click...');
        // Default wait for navigation triggered by the click
        await Promise.all([
          page.waitForNavigation({ waitUntil: 'networkidle', timeout: step.timeout || 30000 }), // Wait for navigation to complete
          submitLocator.click(),
        ]);
        logger.info('Navigation detected after login submit.');
      } else if (typeof waitForNavigation === 'string' || typeof waitForNavigation === 'number') {
        logger.debug(`Waiting for condition "${waitForNavigation}" after submit click...`);
        // Wait for a specific selector or timeout after click
        await submitLocator.click();
        // Corrected call to handleWaitFor with 2 arguments
        await this.handleWaitFor(waitForNavigation, step.timeout);
      } else {
        logger.debug('Not waiting for navigation after submit click.');
        await submitLocator.click(); // Click without waiting for navigation
      }

      logger.info(`Login step completed successfully.`);
      return {};
    } catch (error: any) {
      const errorMessage = `Error during login step "${stepDescription}": ${error.message}`;
      logger.error(errorMessage);
      // Check if the step is optional
      if (step.optional) {
        logger.warn(`Optional login step failed, continuing flow.`);
        context[`${step.name || 'lastLoginError'}`] = errorMessage;
        return {}; // Continue flow
      } else {
        throw new Error(errorMessage); // Re-throw if mandatory
      }
    }
  }

  // Helper to add pauses, mimicking BaseStepHandler's potential utility
  private async simulateThinkTime(min = 50, max = 150) {
    const time = Math.random() * (max - min) + min;
    await new Promise(resolve => setTimeout(resolve, time));
  }
}
