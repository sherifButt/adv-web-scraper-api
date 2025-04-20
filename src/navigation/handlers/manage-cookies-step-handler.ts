import { Page, BrowserContext } from 'playwright';
import { ManageCookiesStep, NavigationContext, StepResult } from '../types/navigation.types.js';
import { logger } from '../../utils/logger.js';
import { BaseStepHandler } from './base-step-handler.js';

export class ManageCookiesStepHandler extends BaseStepHandler {
  public canHandle(step: ManageCookiesStep): boolean {
    return step.type === 'manageCookies';
  }

  public async execute(
    step: ManageCookiesStep,
    context: NavigationContext,
    page: Page
  ): Promise<StepResult> {
    const {
      action,
      cookies: cookiesToAdd, // Rename for clarity
      name: cookieName, // Rename for clarity
      domain,
      path,
      contextKey = 'retrievedCookies', // Default context key for 'get'
      description,
      optional = false,
    } = step;

    const stepDescription = description || `Manage cookies: ${action}`;
    logger.info(`Executing step: ${stepDescription}`);

    const browserContext: BrowserContext = page.context();

    try {
      switch (action) {
        case 'add': {
          if (!cookiesToAdd || !Array.isArray(cookiesToAdd) || cookiesToAdd.length === 0) {
            throw new Error("Action 'add' requires a non-empty 'cookies' array.");
          }
          // Resolve values within cookies if needed (e.g., {{context.value}})
          const resolvedCookies = cookiesToAdd.map(cookie => {
            // Added newline for linter
            return {
              ...cookie,
              name: this.resolveValue(cookie.name, context),
              value: this.resolveValue(cookie.value, context),
              domain: cookie.domain ? this.resolveValue(cookie.domain, context) : undefined,
              path: cookie.path ? this.resolveValue(cookie.path, context) : undefined,
              url: cookie.url ? this.resolveValue(cookie.url, context) : undefined,
              // Ensure expires is a number if present
              expires:
                cookie.expires !== undefined
                  ? Number(this.resolveValue(cookie.expires, context))
                  : undefined,
            };
          });
          await browserContext.addCookies(resolvedCookies);
          logger.info(`Added ${resolvedCookies.length} cookie(s).`);
          break;
        }

        case 'clear': {
          // Playwright's clearCookies doesn't support filtering by name/path directly.
          // We get all cookies and filter manually for deletion if needed,
          // or just clear all if no filters are provided.
          if (!domain && !path && !cookieName) {
            await browserContext.clearCookies();
            logger.info('Cleared all cookies.');
          } else {
            // Get cookies matching the broader filters (domain/path)
            const currentCookies = await browserContext.cookies();
            const cookiesToDelete = currentCookies.filter(
              c =>
                // Added newline for linter
                (!domain || c.domain === domain) &&
                (!path || c.path === path) &&
                (!cookieName || c.name === cookieName) // Add name filter here
            );
            // Delete requires specific cookies, so we reconstruct the list
            await browserContext.clearCookies({
              name: cookieName, // Can pass name, domain, path directly here
              domain: domain,
              path: path,
            });
            logger.info(
              `Cleared ${cookiesToDelete.length} cookie(s) matching filters (name: ${cookieName}, domain: ${domain}, path: ${path}).`
            );
          }
          break;
        }

        case 'delete': {
          // This action seems redundant given 'clear' with filters.
          // Let's implement it for completeness based on the interface.
          if (!cookieName) {
            throw new Error("Action 'delete' requires the 'name' of the cookie.");
          }
          // ClearCookies with specific filters is effectively delete
          await browserContext.clearCookies({ name: cookieName, domain, path });
          logger.info(
            `Attempted to delete cookie(s) with name "${cookieName}" (domain: ${domain}, path: ${path}).`
          );
          break;
        }

        case 'get': {
          const allCookies = await browserContext.cookies();
          // Apply filters if provided
          const filteredCookies = allCookies.filter(
            c =>
              // Added newline for linter
              (!cookieName || c.name === cookieName) &&
              (!domain || c.domain === domain) &&
              (!path || c.path === path)
          );
          context[contextKey] = filteredCookies;
          logger.info(
            `Retrieved ${filteredCookies.length} cookie(s) matching filters and stored in context.${contextKey}.`
          );
          break;
        }

        default: {
          // Should be caught by TypeScript, but good practice
          throw new Error(`Unsupported manageCookies action: ${action}`);
        }
      }

      return {};
    } catch (error: any) {
      const errorMessage = `Error during manageCookies step "${stepDescription}": ${error.message}`;
      logger.error(errorMessage);
      if (!optional) {
        throw new Error(errorMessage); // Re-throw if mandatory
      } else {
        logger.warn(`Optional manageCookies step failed, continuing flow.`);
        context[`${step.name || 'lastCookieError'}`] = errorMessage;
        return {}; // Continue flow
      }
    }
  }
}
