import * as fs from 'fs/promises';
import * as path from 'path';
import matter from 'gray-matter';
import { z } from 'zod';
import { logger } from '../../utils/logger.js'; // Added .js extension

// Define the Zod schema for template metadata validation
const TemplateMetadataSchema = z.object({
  title: z.string().min(1, 'Title is required'),
  path: z.string().min(1, 'Path is required').endsWith('.json', 'Path must end with .json'),
  description: z.string().min(1, 'Description is required'),
  tags: z.array(z.string()).min(1, 'At least one tag is required'),
  difficulty: z.enum(['Beginner', 'Intermediate', 'Advanced', 'Expert']).optional(),
  related_steps: z.array(z.string()).optional(),
});

// Define the structure for the template object returned by the service
export const TemplateSchema = z.object({
  site: z.string(),
  challenge: z.string(),
  metadata: TemplateMetadataSchema,
  configPath: z.string(),
});

// Define the structure for the detailed template object (including config content)
export const DetailedTemplateSchema = TemplateSchema.extend({
  configContent: z.record(z.unknown()), // Represents the parsed JSON content
});

export type TemplateMetadata = z.infer<typeof TemplateMetadataSchema>;
export type Template = z.infer<typeof TemplateSchema>;
export type DetailedTemplate = z.infer<typeof DetailedTemplateSchema>;

// Define filter types for listTemplates
export interface ListTemplateFilters {
  site?: string;
  tag?: string;
}

const TEMPLATES_DIR = 'config-templates';

export class TemplateService {
  private static instance: TemplateService;
  private templatesCache: Template[] | null = null;
  private cacheTimestamp: number | null = null;
  private readonly CACHE_TTL = 5 * 60 * 1000; // 5 minutes

  private constructor() {
    logger.info('TemplateService initialized');
  }

  public static getInstance(): TemplateService {
    if (!TemplateService.instance) {
      TemplateService.instance = new TemplateService();
    }
    return TemplateService.instance;
  }

  /**
   * Lists available templates, optionally filtering by site or tag.
   * Uses a simple time-based cache.
   */
  public async listTemplates(filters: ListTemplateFilters = {}): Promise<Template[]> {
    const now = Date.now();
    if (
      this.templatesCache && // Fixed formatting
      this.cacheTimestamp &&
      now - this.cacheTimestamp < this.CACHE_TTL
    ) {
      logger.debug('Returning cached templates');
      return this.filterTemplates(this.templatesCache, filters);
    }

    logger.debug('Cache expired or empty, scanning templates directory...');
    const allTemplates: Template[] = [];
    const templatesDir = path.resolve(TEMPLATES_DIR);

    try {
      const siteDirs = await fs.readdir(templatesDir, { withFileTypes: true });

      for (const siteDir of siteDirs) {
        if (siteDir.isDirectory()) {
          const siteName = siteDir.name;
          const challengesPath = path.join(templatesDir, siteName, 'challenges');

          try {
            const challengeDirs = await fs.readdir(challengesPath, { withFileTypes: true });

            for (const challengeDir of challengeDirs) {
              if (challengeDir.isDirectory()) {
                const challengeName = challengeDir.name;
                const challengePath = path.join(challengesPath, challengeName);
                const readmePath = path.join(challengePath, 'README.md');

                try {
                  const readmeContent = await fs.readFile(readmePath, 'utf-8');
                  const { data: metadata, content: _ } = matter(readmeContent); // Use gray-matter

                  // Validate metadata
                  const validationResult = TemplateMetadataSchema.safeParse(metadata);
                  if (!validationResult.success) {
                    logger.warn(
                      `Invalid metadata in ${readmePath}: ${validationResult.error.message}`
                    ); // Removed trailing comma
                    continue; // Skip this template
                  }

                  const validatedMetadata = validationResult.data;
                  const configFileName = validatedMetadata.path; // Get config file name from metadata
                  const relativeConfigPath = path.join(
                    TEMPLATES_DIR, // Fixed formatting
                    siteName,
                    'challenges',
                    challengeName,
                    configFileName
                  );
                  const absoluteConfigPath = path.resolve(relativeConfigPath);

                  // Check if config file actually exists
                  try {
                    await fs.access(absoluteConfigPath);
                  } catch (configAccessError) {
                    logger.warn(
                      `Config file specified in metadata not found: ${absoluteConfigPath} (referenced in ${readmePath})` // Removed trailing comma
                    );
                    continue; // Skip this template
                  }

                  allTemplates.push({
                    // Fixed formatting
                    site: siteName, // Removed trailing comma
                    challenge: challengeName,
                    metadata: validatedMetadata,
                    configPath: relativeConfigPath, // Relative path from project root // Removed trailing comma
                  });
                } catch (readmeError: any) {
                  if (readmeError.code !== 'ENOENT') {
                    // Log errors other than file not found
                    logger.warn(
                      `Error reading or parsing README.md in ${challengePath}: ${readmeError.message}`
                    );
                  }
                  // If README.md is missing, we can't get metadata, so skip.
                }
              }
            }
          } catch (challengeReadError: any) {
            if (challengeReadError.code !== 'ENOENT') {
              logger.warn(
                // Fixed formatting
                `Error reading challenges directory for site ${siteName}: ${challengeReadError.message}`
              );
            }
            // If 'challenges' dir doesn't exist, skip this site.
          }
        }
      }

      this.templatesCache = allTemplates;
      this.cacheTimestamp = now;
      logger.info(`Successfully scanned and cached ${allTemplates.length} templates.`);
      return this.filterTemplates(allTemplates, filters);
    } catch (error: any) {
      logger.error(`Error scanning templates directory ${templatesDir}: ${error.message}`);
      this.templatesCache = null; // Invalidate cache on error
      this.cacheTimestamp = null;
      return []; // Return empty array on top-level error
    }
  }

  /**
   * Retrieves details for a single template, including its config content.
   */
  public async getTemplate(site: string, challenge: string): Promise<DetailedTemplate | null> {
    // Leverage listTemplates to find the base template data (ensures consistency and uses cache)
    const templates = await this.listTemplates({ site });
    const template = templates.find(t => t.challenge === challenge);

    if (!template) {
      logger.warn(`Template not found for site=${site}, challenge=${challenge}`);
      return null;
    }

    // Read the config.json content
    const absoluteConfigPath = path.resolve(template.configPath);
    try {
      const configContentStr = await fs.readFile(absoluteConfigPath, 'utf-8');
      const configContent = JSON.parse(configContentStr);

      const detailedTemplate: DetailedTemplate = {
        ...template,
        configContent,
      };

      // Optional: Validate configContent against a base schema if needed in the future
      // const detailedValidation = DetailedTemplateSchema.safeParse(detailedTemplate);
      // if (!detailedValidation.success) { ... }

      return detailedTemplate;
    } catch (error: any) {
      logger.error(
        // Fixed formatting
        `Error reading or parsing config file ${absoluteConfigPath} for template ${site}/${challenge}: ${error.message}`
      );
      return null; // Return null if config file is missing or invalid JSON
    }
  }

  /**
   * Helper function to apply filters to a list of templates.
   */
  private filterTemplates(templates: Template[], filters: ListTemplateFilters): Template[] {
    let filteredTemplates = templates;

    if (filters.site) {
      filteredTemplates = filteredTemplates.filter(t => t.site === filters.site);
    }

    if (filters.tag) {
      const lowerCaseTag = filters.tag.toLowerCase();
      filteredTemplates = filteredTemplates.filter(t =>
        t.metadata.tags.some(tag => tag.toLowerCase() === lowerCaseTag)
      );
    }

    return filteredTemplates;
  }

  /**
   * Clears the internal template cache.
   */
  public clearCache(): void {
    this.templatesCache = null;
    this.cacheTimestamp = null;
    logger.info('Template cache cleared.');
  }
}
