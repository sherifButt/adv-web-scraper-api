import { Router, Request, Response, NextFunction } from 'express';
import { TemplateService, ListTemplateFilters } from '../../core/templates/template.service.js'; // Use .js extension
import { logger } from '../../utils/logger.js'; // Use .js extension

const router = Router();
const templateService = TemplateService.getInstance();

// GET /api/v1/templates - List all templates with optional filtering
router.get('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    // Extract query parameters for filtering
    const filters: ListTemplateFilters = {};
    if (req.query.site && typeof req.query.site === 'string') {
      filters.site = req.query.site;
    }
    if (req.query.tag && typeof req.query.tag === 'string') {
      filters.tag = req.query.tag;
    }

    logger.info(`Listing templates with filters: ${JSON.stringify(filters)}`);
    const templates = await templateService.listTemplates(filters);

    // Return only metadata and configPath for the list endpoint
    const responseData = templates.map(t => ({
      site: t.site,
      challenge: t.challenge,
      metadata: t.metadata,
      configPath: t.configPath,
    }));

    res.json(responseData);
  } catch (error) {
    logger.error('Error fetching template list:', error);
    next(error); // Pass error to the global error handler
  }
});

// GET /api/v1/templates/:site/:challenge - Get a single template's details including config content
router.get('/:site/:challenge', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { site, challenge } = req.params;
    logger.info(`Fetching template details for site=${site}, challenge=${challenge}`);

    const template = await templateService.getTemplate(site, challenge);

    if (!template) {
      return res.status(404).json({ message: 'Template not found' });
    }

    // Return the detailed template including configContent
    res.json(template);
  } catch (error) {
    logger.error(
      `Error fetching template details for ${req.params.site}/${req.params.challenge}:`,
      error
    );
    next(error); // Pass error to the global error handler
  }
});

export default router;
