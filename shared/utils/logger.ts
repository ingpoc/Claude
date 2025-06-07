import winston from 'winston';
import { config } from '../config/config';

// Custom log levels
const logLevels = {
  error: 0,
  warn: 1,
  info: 2,
  debug: 3,
};

// Custom format for structured logging
const logFormat = winston.format.combine(
  winston.format.timestamp(),
  winston.format.errors({ stack: true }),
  winston.format.json(),
  winston.format.printf(({ timestamp, level, message, service, ...meta }) => {
    return JSON.stringify({
      timestamp,
      level,
      service: service || 'unknown',
      message,
      ...meta,
    });
  })
);

// Create the logger
const createLogger = (serviceName?: string) => {
  const transports: winston.transport[] = [
    new winston.transports.Console({
      format: config.logging.format === 'simple' 
        ? winston.format.combine(
            winston.format.colorize(),
            winston.format.simple()
          )
        : logFormat,
    }),
  ];

  // Add file transport if enabled
  if (config.logging.file.enabled) {
    transports.push(
      new winston.transports.File({
        filename: `${config.logging.file.path}/error.log`,
        level: 'error',
        format: logFormat,
        maxsize: parseSize(config.logging.file.maxSize),
        maxFiles: config.logging.file.maxFiles,
      }),
      new winston.transports.File({
        filename: `${config.logging.file.path}/combined.log`,
        format: logFormat,
        maxsize: parseSize(config.logging.file.maxSize),
        maxFiles: config.logging.file.maxFiles,
      })
    );
  }

  return winston.createLogger({
    level: config.logging.level,
    levels: logLevels,
    format: logFormat,
    defaultMeta: { service: serviceName },
    transports,
    exitOnError: false,
  });
};

// Helper function to parse file size
function parseSize(size: string): number {
  const units: Record<string, number> = {
    b: 1,
    k: 1024,
    m: 1024 * 1024,
    g: 1024 * 1024 * 1024,
  };
  
  const match = size.toLowerCase().match(/^(\d+)([bkmg])?$/);
  if (!match) return 10 * 1024 * 1024; // Default 10MB
  
  const [, num, unit = 'b'] = match;
  return parseInt(num) * units[unit];
}

// Create default logger
export const logger = createLogger();

// Factory function for service-specific loggers
export const createServiceLogger = (serviceName: string) => {
  return createLogger(serviceName);
};

// Helper functions for structured logging
export const logWithContext = (
  level: 'error' | 'warn' | 'info' | 'debug',
  message: string,
  context: Record<string, any> = {},
  error?: Error
) => {
  const logData: any = {
    message,
    ...context,
  };

  if (error) {
    logData.error = {
      name: error.name,
      message: error.message,
      stack: error.stack,
    };
  }

  logger[level](logData);
};

// Convenience functions
export const logError = (message: string, error?: Error, context?: Record<string, any>) => {
  logWithContext('error', message, context, error);
};

export const logWarn = (message: string, context?: Record<string, any>) => {
  logWithContext('warn', message, context);
};

export const logInfo = (message: string, context?: Record<string, any>) => {
  logWithContext('info', message, context);
};

export const logDebug = (message: string, context?: Record<string, any>) => {
  logWithContext('debug', message, context);
};

// Request logging middleware
export const requestLogger = (serviceName: string) => {
  const serviceLogger = createServiceLogger(serviceName);
  
  return (req: any, res: any, next: any) => {
    const start = Date.now();
    const requestId = req.headers['x-request-id'] || `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    // Add request ID to request object
    req.requestId = requestId;
    
    // Log request start
    serviceLogger.info('Request started', {
      requestId,
      method: req.method,
      url: req.url,
      userAgent: req.headers['user-agent'],
      ip: req.ip,
    });
    
    // Override res.end to log response
    const originalEnd = res.end;
    res.end = function(...args: any[]) {
      const duration = Date.now() - start;
      
      serviceLogger.info('Request completed', {
        requestId,
        method: req.method,
        url: req.url,
        statusCode: res.statusCode,
        duration,
        contentLength: res.get('content-length'),
      });
      
      originalEnd.apply(this, args);
    };
    
    next();
  };
};

// Performance timing helper
export const withTiming = async <T>(
  operation: string,
  fn: () => Promise<T>,
  context?: Record<string, any>
): Promise<T> => {
  const start = Date.now();
  
  try {
    const result = await fn();
    const duration = Date.now() - start;
    
    logInfo(`Operation completed: ${operation}`, {
      operation,
      duration,
      ...context,
    });
    
    return result;
  } catch (error) {
    const duration = Date.now() - start;
    
    logError(`Operation failed: ${operation}`, error as Error, {
      operation,
      duration,
      ...context,
    });
    
    throw error;
  }
};

export default logger;
