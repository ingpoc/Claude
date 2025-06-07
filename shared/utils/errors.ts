import { Response } from 'express';
import { logger } from './logger';

// Standard error types
export class AppError extends Error {
  public readonly statusCode: number;
  public readonly isOperational: boolean;
  public readonly code?: string;

  constructor(
    message: string,
    statusCode: number = 500,
    isOperational: boolean = true,
    code?: string
  ) {
    super(message);
    
    this.statusCode = statusCode;
    this.isOperational = isOperational;
    this.code = code;
    
    Error.captureStackTrace(this, this.constructor);
  }
}

export class ValidationError extends AppError {
  constructor(message: string, details?: any) {
    super(message, 400, true, 'VALIDATION_ERROR');
    this.name = 'ValidationError';
  }
}

export class NotFoundError extends AppError {
  constructor(resource: string, id?: string) {
    const message = id ? `${resource} with id '${id}' not found` : `${resource} not found`;
    super(message, 404, true, 'NOT_FOUND');
    this.name = 'NotFoundError';
  }
}

export class ConflictError extends AppError {
  constructor(message: string) {
    super(message, 409, true, 'CONFLICT');
    this.name = 'ConflictError';
  }
}

export class UnauthorizedError extends AppError {
  constructor(message: string = 'Unauthorized') {
    super(message, 401, true, 'UNAUTHORIZED');
    this.name = 'UnauthorizedError';
  }
}

export class ForbiddenError extends AppError {
  constructor(message: string = 'Forbidden') {
    super(message, 403, true, 'FORBIDDEN');
    this.name = 'ForbiddenError';
  }
}

// Error handler middleware factory
export const createErrorHandler = (serviceName: string) => {
  return (error: any, req: any, res: Response, next: any) => {
    let appError: AppError;

    // Convert known error types to AppError
    if (error instanceof AppError) {
      appError = error;
    } else if (error.name === 'ValidationError') {
      appError = new ValidationError(error.message);
    } else if (error.name === 'CastError') {
      appError = new ValidationError(`Invalid ${error.path}: ${error.value}`);
    } else if (error.code === 11000) {
      appError = new ConflictError('Duplicate resource');
    } else {
      appError = new AppError(
        'Internal server error',
        500,
        false,
        'INTERNAL_ERROR'
      );
    }

    // Log error
    if (appError.statusCode >= 500) {
      logger.error('Internal server error', error, {
        service: serviceName,
        requestId: req.requestId,
        path: req.path,
        method: req.method,
        userId: req.user?.id,
      });
    } else {
      logger.warn('Client error', {
        service: serviceName,
        requestId: req.requestId,
        path: req.path,
        method: req.method,
        error: appError.message,
        statusCode: appError.statusCode,
      });
    }

    // Send error response
    res.status(appError.statusCode).json({
      success: false,
      error: {
        message: appError.message,
        code: appError.code,
        ...(process.env.NODE_ENV === 'development' && {
          stack: appError.stack,
        }),
      },
      timestamp: new Date().toISOString(),
      requestId: req.requestId,
    });
  };
};

// Async error wrapper
export const asyncHandler = (fn: Function) => {
  return (req: any, res: any, next: any) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
};

// Validation helper
export const validateRequired = (data: any, fields: string[]): void => {
  const missing = fields.filter(field => {
    const value = data[field];
    return value === undefined || value === null || value === '';
  });

  if (missing.length > 0) {
    throw new ValidationError(`Missing required fields: ${missing.join(', ')}`);
  }
};

// Type guard for operational errors
export const isOperationalError = (error: any): error is AppError => {
  return error instanceof AppError && error.isOperational;
};
