import * as fs from 'fs/promises';
import * as path from 'path';
import matter from 'gray-matter';
import { z } from 'zod';
import { logger } from '../../utils/logger.js';

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
  configContent: z.record(z.unknown()).optional(),
});

// Define the structure for the detailed template object (including config content)
export const DetailedTemplateSchema = TemplateSchema.extend({
  configContent: z.record(z.unknown()),
});

export type TemplateMetadata = z.infer<typeof TemplateMetadataSchema>;
export type Template = z.infer<typeof TemplateSchema>;
export type DetailedTemplate = z.infer<typeof DetailedTemplateSchema>;

// Define pagination options
export interface PaginationOptions {
  page?: number; // Current page (1-based index)
  limit?: number; // Number of items per page
}

// Define filter types for listTemplates with pagination
export interface ListTemplateFilters {
  site?: string;
  tag?: string;
  difficulty?: string;
  related_step?: string;
}

// Define the paginated response structure
export interface PaginatedResponse<T> {
  data: T[];
  pagination: {
    total: number; // Total number of items
    page: number; // Current page
    limit: number; // Items per page
    totalPages: number; // Total number of pages
  };
}

const TEMPLATES_DIR = 'config-templates';
const DEFAULT_PAGE_SIZE = 10;
const MAX_PAGE_SIZE = 100;

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
   * Lists available templates, optionally filtering and paginating results.
   * Uses a simple time-based cache.
   */
  public async listTemplates(
    filters: ListTemplateFilters = {},
    pagination?: PaginationOptions
  ): Promise<PaginatedResponse<Template>> {
    const now = Date.now();
    let allTemplates: Template[] = [];

    // Use cache if valid
    if (this.templatesCache && this.cacheTimestamp && now - this.cacheTimestamp < this.CACHE_TTL) {
      logger.debug('Returning cached templates');
      allTemplates = this.templatesCache;
    } else {
      // Cache expired or empty, scan templates directory
      logger.debug('Cache expired or empty, scanning templates directory...');
      allTemplates = await this.scanTemplates();
      this.templatesCache = allTemplates;
      this.cacheTimestamp = now;
      logger.info(`Successfully scanned and cached ${allTemplates.length} templates.`);
    }

    // Apply filters
    const filteredTemplates = this.filterTemplates(allTemplates, filters);

    // Apply pagination
    return this.paginateResults(filteredTemplates, pagination);
  }

  /**
   * Scan directory structure for templates.
   */
  private async scanTemplates(): Promise<Template[]> {
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
                  const { data: metadata, content: _ } = matter(readmeContent);

                  // Validate metadata
                  const validationResult = TemplateMetadataSchema.safeParse(metadata);
                  if (!validationResult.success) {
                    logger.warn(
                      `Invalid metadata in ${readmePath}: ${validationResult.error.message}`
                    );
                    continue; // Skip this template
                  }

                  const validatedMetadata = validationResult.data;
                  const configFileName = validatedMetadata.path;
                  const relativeConfigPath = path.join(
                    TEMPLATES_DIR,
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
                      `Config file specified in metadata not found: ${absoluteConfigPath} (referenced in ${readmePath})`
                    );
                    continue; // Skip this template
                  }

                  // Try reading the config file content
                  let configContent: Record<string, unknown> | null = null;
                  try {
                    const configContentStr = await fs.readFile(absoluteConfigPath, 'utf-8');
                    configContent = JSON.parse(configContentStr);
                  } catch (configReadError: any) {
                    logger.warn(
                      `Could not read or parse config file ${absoluteConfigPath} for template ${siteName}/${challengeName}: ${configReadError.message}`
                    );
                    // Include template without content
                  }

                  allTemplates.push({
                    site: siteName,
                    challenge: challengeName,
                    metadata: validatedMetadata,
                    configPath: relativeConfigPath,
                    configContent: configContent ?? undefined,
                  });
                } catch (readmeError: any) {
                  if (readmeError.code !== 'ENOENT') {
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
                `Error reading challenges directory for site ${siteName}: ${challengeReadError.message}`
              );
            }
            // If 'challenges' dir doesn't exist, skip this site.
          }
        }
      }
      return allTemplates;
    } catch (error: any) {
      logger.error(`Error scanning templates directory ${templatesDir}: ${error.message}`);
      return []; // Return empty array on top-level error
    }
  }

  /**
   * Retrieves details for a single template, including its config content.
   */
  public async getTemplate(site: string, challenge: string): Promise<DetailedTemplate | null> {
    // Leverage cached templates to find the base template data
    const templatesResponse = await this.listTemplates({ site });
    const template = templatesResponse.data.find(t => t.challenge === challenge);

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
      return detailedTemplate;
    } catch (error: any) {
      logger.error(
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

    if (filters.difficulty) {
      filteredTemplates = filteredTemplates.filter(
        t => t.metadata.difficulty === filters.difficulty
      );
    }

    if (filters.related_step) {
      const relatedStep = filters.related_step;
      filteredTemplates = filteredTemplates.filter(t => {
        // Safely handle potentially undefined related_steps array
        const relatedSteps = t.metadata.related_steps || [];
        return relatedSteps.includes(relatedStep);
      });
    }

    return filteredTemplates;
  }

  /**
   * Helper function to paginate results.
   */
  private paginateResults(
    templates: Template[],
    options?: PaginationOptions
  ): PaginatedResponse<Template> {
    const total = templates.length;

    // Set default pagination values or use provided values
    const page = Math.max(1, options?.page || 1); // Ensure minimum page is 1
    const limit = Math.min(MAX_PAGE_SIZE, options?.limit || DEFAULT_PAGE_SIZE); // Cap at MAX_PAGE_SIZE

    const totalPages = Math.max(1, Math.ceil(total / limit));
    const safePageIndex = Math.min(page, totalPages);
    const startIndex = (safePageIndex - 1) * limit;
    const endIndex = Math.min(startIndex + limit, total);

    // Get the slice of data for the current page
    const paginatedData = templates.slice(startIndex, endIndex);

    return {
      data: paginatedData,
      pagination: {
        total,
        page: safePageIndex,
        limit,
        totalPages,
      },
    };
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
