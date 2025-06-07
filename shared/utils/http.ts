import { Response } from 'express';
import { ApiResponse, PaginatedResponse } from '../types/domain';

// Standard API response helpers
export class ApiResponseBuilder {
  static success<T>(data: T, message?: string): ApiResponse<T> {
    return {
      success: true,
      data,
      timestamp: new Date().toISOString(),
    };
  }

  static error(message: string, code?: string): ApiResponse {
    return {
      success: false,
      error: message,
      timestamp: new Date().toISOString(),
    };
  }

  static paginated<T>(
    items: T[],
    page: number,
    limit: number,
    total: number
  ): PaginatedResponse<T> {
    return {
      items,
      pagination: {
        page,
        limit,
        total,
        hasNext: page * limit < total,
        hasPrev: page > 1,
      },
    };
  }
}

// Express response helpers
export const sendSuccess = <T>(
  res: Response,
  data: T,
  statusCode: number = 200,
  message?: string
): Response => {
  return res.status(statusCode).json(ApiResponseBuilder.success(data, message));
};

export const sendError = (
  res: Response,
  message: string,
  statusCode: number = 500,
  code?: string
): Response => {
  return res.status(statusCode).json(ApiResponseBuilder.error(message, code));
};

export const sendCreated = <T>(res: Response, data: T): Response => {
  return sendSuccess(res, data, 201);
};

export const sendNoContent = (res: Response): Response => {
  return res.status(204).send();
};

export const sendNotFound = (res: Response, resource: string): Response => {
  return sendError(res, `${resource} not found`, 404, 'NOT_FOUND');
};

export const sendBadRequest = (res: Response, message: string): Response => {
  return sendError(res, message, 400, 'BAD_REQUEST');
};

export const sendUnauthorized = (res: Response, message: string = 'Unauthorized'): Response => {
  return sendError(res, message, 401, 'UNAUTHORIZED');
};

export const sendForbidden = (res: Response, message: string = 'Forbidden'): Response => {
  return sendError(res, message, 403, 'FORBIDDEN');
};

export const sendConflict = (res: Response, message: string): Response => {
  return sendError(res, message, 409, 'CONFLICT');
};

export const sendPaginated = <T>(
  res: Response,
  items: T[],
  page: number,
  limit: number,
  total: number
): Response => {
  return res.json(ApiResponseBuilder.paginated(items, page, limit, total));
};

// Middleware for adding request ID to responses
export const addRequestId = (req: any, res: Response, next: any) => {
  const requestId = req.requestId || 'unknown';
  
  // Override json method to add requestId
  const originalJson = res.json;
  res.json = function(body: any) {
    if (typeof body === 'object' && body !== null) {
      body.requestId = requestId;
    }
    return originalJson.call(this, body);
  };
  
  next();
};

// Helper to validate pagination parameters
export const validatePagination = (query: any) => {
  const page = Math.max(1, parseInt(query.page) || 1);
  const limit = Math.min(100, Math.max(1, parseInt(query.limit) || 10));
  const offset = (page - 1) * limit;
  
  return { page, limit, offset };
};

// Helper to parse sort parameters
export const parseSort = (query: any, allowedFields: string[] = []) => {
  const sort = query.sort || 'createdAt';
  const order = query.order === 'asc' ? 'asc' : 'desc';
  
  // Validate sort field if allowedFields is provided
  if (allowedFields.length > 0 && !allowedFields.includes(sort)) {
    throw new Error(`Invalid sort field. Allowed fields: ${allowedFields.join(', ')}`);
  }
  
  return { sort, order };
};

// Helper to parse filter parameters
export const parseFilters = (query: any, allowedFilters: string[] = []) => {
  const filters: Record<string, any> = {};
  
  for (const key of allowedFilters) {
    if (query[key] !== undefined) {
      filters[key] = query[key];
    }
  }
  
  return filters;
};

// Content negotiation helper
export const negotiateContent = (req: any, res: Response, data: any) => {
  const acceptHeader = req.headers.accept || '';
  
  if (acceptHeader.includes('application/xml')) {
    // For XML responses (if needed)
    res.type('application/xml');
    return res.send(convertToXml(data));
  } else if (acceptHeader.includes('text/csv')) {
    // For CSV responses (if needed)
    res.type('text/csv');
    return res.send(convertToCsv(data));
  } else {
    // Default to JSON
    return res.json(data);
  }
};

// Placeholder converters (implement as needed)
const convertToXml = (data: any): string => {
  // Simple XML conversion - implement proper XML serialization if needed
  return `<?xml version="1.0" encoding="UTF-8"?><data>${JSON.stringify(data)}</data>`;
};

const convertToCsv = (data: any): string => {
  // Simple CSV conversion - implement proper CSV serialization if needed
  if (Array.isArray(data)) {
    const headers = Object.keys(data[0] || {});
    const csvRows = [
      headers.join(','),
      ...data.map(row => headers.map(field => row[field]).join(','))
    ];
    return csvRows.join('\n');
  }
  return '';
};

// Rate limiting response
export const sendRateLimited = (res: Response): Response => {
  return res.status(429).json({
    success: false,
    error: 'Too many requests',
    timestamp: new Date().toISOString(),
  });
};

// Service unavailable response
export const sendServiceUnavailable = (res: Response, service: string): Response => {
  return res.status(503).json({
    success: false,
    error: `${service} service unavailable`,
    timestamp: new Date().toISOString(),
  });
};
