import { RequestHandler } from 'express';
import Joi from 'joi';
import { logger } from '../../utils/logger.js';

const sessionSchema = Joi.object({
  adapter: Joi.string().valid('memory', 'redis', 'mongodb').required(),
  ttl: Joi.number().min(30000).max(86400000).default(86400000),
  browser: Joi.object({
    userAgent: Joi.string(),
    viewport: Joi.object({
      width: Joi.number().min(800).max(3840),
      height: Joi.number().min(600).max(2160),
    }),
  }).optional(),
});

export const validateCreateSession: RequestHandler = (req, res, next) => {
  const { error } = sessionSchema.validate(req.body);
  if (error) {
    logger.error(`Session validation failed: ${error.message}`);
    return res.status(400).json({
      success: false,
      message: 'Validation failed',
      error: error.message,
      timestamp: new Date().toISOString(),
    });
  }
  next();
};
