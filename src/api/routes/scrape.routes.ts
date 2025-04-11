// src/api/routes/scrape.routes.ts

import { Router } from 'express';
import { asyncHandler } from '../middleware/error.middleware.js';
import { ExtractionEngine } from '../../extraction/index.js';
import { StorageService } from '../../storage/index.js';
import { logger } from '../../utils/logger.js';

const router = Router();
const extractionEngine = new ExtractionEngine();
const storageService = StorageService.getInstance();

// Initialize storage service
(async () => {
  try {
    await storageService.initialize();
    logger.info('Storage service initialized for scrape routes');
  } catch (error: any) {
    logger.error(`Error initializing storage service: ${error.message}`);
  }
})();

/**
 * @route   POST /api/v1/scrape
 * @desc    Scrape data from a URL
 * @access  Public
 */
router.post(
  '/',
  asyncHandler(async (req, res) => {
    try {
      const { url, fields, options } = req.body;

      if (!url) {
        return res.status(400).json({
          success: false,
          message: 'URL is required',
          error: 'Missing required parameter: url',
          timestamp: new Date().toISOString(),
        });
      }

      if (!fields || Object.keys(fields).length === 0) {
        return res.status(400).json({
          success: false,
          message: 'Fields configuration is required',
          error: 'Missing required parameter: fields',
          timestamp: new Date().toISOString(),
        });
      }

      logger.info(`Starting extraction for URL: ${url}`);

      // Execute the extraction
      const result = await extractionEngine.extract({
        url,
        fields,
        options,
      });

      // Store the result using the storage service
      await storageService.store(result);

      // Return the result
      return res.status(200).json({
        success: true,
        message: 'Extraction completed successfully',
        data: result,
        timestamp: new Date().toISOString(),
      });
    } catch (error: any) {
      logger.error(`Error in scrape endpoint: ${error.message}`);
      return res.status(500).json({
        success: false,
        message: 'Extraction failed',
        error: error.message,
        timestamp: new Date().toISOString(),
      });
    }
  })
);

/**
 * @route   GET /api/v1/scrape/:id
 * @desc    Get the result of a scraping job
 * @access  Public
 */
router.get(
  '/:id',
  asyncHandler(async (req, res) => {
    const id = req.params.id;

    // Get the result from storage service
    const result = await storageService.retrieve(id);

    if (!result) {
      return res.status(404).json({
        success: false,
        message: 'Extraction result not found',
        error: `No extraction result found with ID: ${id}`,
        timestamp: new Date().toISOString(),
      });
    }

    // Return the result
    return res.status(200).json({
      success: true,
      message: 'Extraction result retrieved successfully',
      data: result,
      timestamp: new Date().toISOString(),
    });
  })
);

/**
 * @route   PUT /api/v1/scrape/:id
 * @desc    Update an extraction result
 * @access  Public
 */
router.put(
  '/:id',
  asyncHandler(async (req, res) => {
    const id = req.params.id;
    const updateData = req.body;

    // Update the result in storage service
    const success = await storageService.update(id, updateData);

    if (!success) {
      return res.status(404).json({
        success: false,
        message: 'Extraction result not found',
        error: `No extraction result found with ID: ${id}`,
        timestamp: new Date().toISOString(),
      });
    }

    // Get the updated result
    const result = await storageService.retrieve(id);

    // Return the updated result
    return res.status(200).json({
      success: true,
      message: 'Extraction result updated successfully',
      data: result,
      timestamp: new Date().toISOString(),
    });
  })
);

/**
 * @route   DELETE /api/v1/scrape/:id
 * @desc    Delete an extraction result
 * @access  Public
 */
router.delete(
  '/:id',
  asyncHandler(async (req, res) => {
    const id = req.params.id;

    // Delete the result from storage service
    const success = await storageService.delete(id);

    if (!success) {
      return res.status(404).json({
        success: false,
        message: 'Extraction result not found',
        error: `No extraction result found with ID: ${id}`,
        timestamp: new Date().toISOString(),
      });
    }

    // Return success response
    return res.status(200).json({
      success: true,
      message: 'Extraction result deleted successfully',
      timestamp: new Date().toISOString(),
    });
  })
);

/**
 * @route   GET /api/v1/scrape
 * @desc    List extraction results with optional filtering and pagination
 * @access  Public
 */
router.get(
  '/',
  asyncHandler(async (req, res) => {
    // Parse query parameters
    const limit = req.query.limit ? parseInt(req.query.limit as string) : undefined;
    const offset = req.query.offset ? parseInt(req.query.offset as string) : undefined;
    const status = req.query.status as string | undefined;
    const url = req.query.url as string | undefined;
    const fromDate = req.query.fromDate ? new Date(req.query.fromDate as string) : undefined;
    const toDate = req.query.toDate ? new Date(req.query.toDate as string) : undefined;

    // Get results from storage service
    const results = await storageService.list({
      limit,
      offset,
      status,
      url,
      fromDate,
      toDate,
    });

    // Return the results
    return res.status(200).json({
      success: true,
      message: 'Extraction results retrieved successfully',
      data: results,
      count: results.length,
      timestamp: new Date().toISOString(),
    });
  })
);

export const scrapeRoutes = router;
