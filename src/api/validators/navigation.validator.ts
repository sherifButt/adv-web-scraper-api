import { RequestHandler } from 'express';
import Joi from 'joi';
import { logger } from '../../utils/logger.js';

// Define Joi schema for BrowserOptions fields we want to validate
const browserOptionsSchema = Joi.object({
  userAgent: Joi.string(),
  viewport: Joi.object({
    width: Joi.number().min(100).max(3840),
    height: Joi.number().min(100).max(2160),
  }).optional(),
  proxy: Joi.object({
    server: Joi.string().required(),
    username: Joi.string(),
    password: Joi.string(),
  }).optional(),
  extraHTTPHeaders: Joi.object().pattern(Joi.string(), Joi.string()).optional(), // Allow string key/value pairs
  // Add other BrowserOptions fields here if needed (headless, args, browserType)
  // headless: Joi.boolean(),
  // args: Joi.array().items(Joi.string()),
  // browserType: Joi.string().valid('chromium', 'firefox', 'webkit'),
});

// Define Joi schema for the main navigation request
const navigationRequestSchema = Joi.object({
  startUrl: Joi.string().uri().required(),
  steps: Joi.array().items(Joi.object()).min(1).required(), // Basic step validation (array of objects)
  variables: Joi.object().optional(),
  browserOptions: browserOptionsSchema.optional(), // Include optional browserOptions
  options: Joi.object().optional(), // Keep existing generic options field
});

export const validateNavigateRequest: RequestHandler = (req, res, next) => {
  const { error } = navigationRequestSchema.validate(req.body, { abortEarly: false }); // Validate and collect all errors
  if (error) {
    const errorMessages = error.details.map((detail) => detail.message).join(', ');
    logger.error(`Navigation request validation failed: ${errorMessages}`);
    return res.status(400).json({
      success: false,
      message: 'Validation failed',
      error: errorMessages,
      timestamp: new Date().toISOString(),
    });
  }
  next();
}; 