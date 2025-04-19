import Joi from 'joi';
import { Request, Response, NextFunction } from 'express';
import { logger } from '../../utils/logger.js';

// Schema for the optional browserOptions within the main options
const browserOptionsSchema = Joi.object({
  headless: Joi.boolean().optional(),
  proxy: Joi.boolean().optional(),
  // Add other specific browser options if needed
}).optional();

// Schema for the main options object
const generateConfigOptionsSchema = Joi.object({
  maxIterations: Joi.number().integer().min(1).max(10).strict().optional(), // Added .strict()
  testConfig: Joi.boolean().optional(),
  model: Joi.string().optional(), // Could add .valid(...) with known models later
  maxTokens: Joi.number().integer().min(100).max(16384).strict().optional(), // Added .strict()
  temperature: Joi.number().min(0).max(1).strict().optional(), // Added .strict()
  browserOptions: browserOptionsSchema,
}).optional();

// Schema for the POST /api/v1/ai/generate-config request body
export const generateConfigSchema = Joi.object({
  url: Joi.string().uri().required().messages({
    'string.base': `"url" should be a type of 'text'`,
    'string.empty': `"url" cannot be an empty field`,
    'string.uri': `"url" must be a valid URI`,
    'any.required': `"url" is a required field`,
  }),
  prompt: Joi.string().required().min(10).messages({
    'string.base': `"prompt" should be a type of 'text'`,
    'string.empty': `"prompt" cannot be an empty field`,
    'string.min': `"prompt" should have a minimum length of {#limit}`,
    'any.required': `"prompt" is a required field`,
  }),
  options: generateConfigOptionsSchema,
});

// Reusable validation middleware
export const validateRequest = (schema: Joi.ObjectSchema) => {
  return (req: Request, res: Response, next: NextFunction) => {
    const { error } = schema.validate(req.body, {
      abortEarly: false, // Return all errors
      allowUnknown: false, // Disallow properties not defined in schema
    });

    if (error) {
      const errorMessages = error.details.map(detail => detail.message).join(', ');
      logger.warn(`Validation failed for ${req.method} ${req.originalUrl}: ${errorMessages}`);
      return res.status(400).json({
        success: false,
        message: 'Validation Error',
        // Apply standard formatting for the map call
        errors: error.details.map(detail => {
          // Removed parentheses again
          return {
            field: detail.path.join('.'),
            message: detail.message,
          };
        }), // Closing parenthesis aligned with 'errors' key
        timestamp: new Date().toISOString(),
      });
    }

    next();
  };
};
