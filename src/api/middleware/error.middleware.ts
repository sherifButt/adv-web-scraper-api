import { Request, Response, NextFunction } from 'express';
import { logger } from '../../utils/logger.js';

// Custom error class for API errors
export class ApiError extends Error {
  statusCode: number;
  isOperational: boolean;

  constructor(statusCode: number, message: string, isOperational = true, stack = '') {
    super(message);
    this.statusCode = statusCode;
    this.isOperational = isOperational;
    if (stack) {
      this.stack = stack;
    } else {
      Error.captureStackTrace(this, this.constructor);
    }
  }
}

// Error handler middleware
export const errorHandler = (
  err: Error | ApiError,
  req: Request,
  res: Response,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  next: NextFunction
) => {
  // Default error values
  let statusCode = 500;
  let message = 'Internal Server Error';
  let isOperational = false;

  // Handle ApiError instances
  if (err instanceof ApiError) {
    statusCode = err.statusCode;
    message = err.message;
    isOperational = err.isOperational;
  } else if (err.name === 'ValidationError') {
    // Handle Joi validation errors
    statusCode = 400;
    message = err.message;
    isOperational = true;
  } else if (err.name === 'MongoError' && (err as any).code === 11000) {
    // Handle MongoDB duplicate key errors
    statusCode = 409;
    message = 'Duplicate key error';
    isOperational = true;
  }

  // Log the error
  if (isOperational) {
    logger.warn(`Operational error: ${message}`);
  } else {
    logger.error(`Unexpected error: ${err.message}`, { stack: err.stack });
  }

  // Send response
  res.status(statusCode).json({
    status: 'error',
    message,
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack }),
  });
};

// 404 handler middleware
export const notFoundHandler = (req: Request, res: Response) => {
  const message = `Cannot ${req.method} ${req.originalUrl}`;
  logger.warn(`404 - ${message}`);
  res.status(404).json({
    status: 'error',
    message,
  });
};

// Async handler to catch errors in async route handlers
export const asyncHandler = (
  fn: (req: Request, res: Response, next: NextFunction) => Promise<any>
) => {
  return (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
};
