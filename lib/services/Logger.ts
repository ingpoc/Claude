export enum LogLevel {
  ERROR = 'error',
  WARN = 'warn',
  INFO = 'info',
  DEBUG = 'debug'
}

export interface LogContext {
  projectId?: string;
  entityId?: string;
  relationshipId?: string;
  operation?: string;
  [key: string]: any;
}

class Logger {
  private isDevelopment = process.env.NODE_ENV !== 'production';
  private isMcpMode = process.env.MCP_MODE === 'true' || process.stdin.isTTY === false;
  private isBrowser = typeof window !== 'undefined';

  private formatMessage(level: LogLevel, message: string, context?: LogContext): string {
    const timestamp = new Date().toISOString();
    const contextStr = context ? ` | Context: ${JSON.stringify(context)}` : '';
    return `[${timestamp}] [${level.toUpperCase()}] ${message}${contextStr}`;
  }

  private safeLog(message: string, useStderr = false): void {
    // In browser production mode, suppress all logging
    if (this.isBrowser && !this.isDevelopment) {
      return;
    }

    if (this.isMcpMode && !this.isBrowser) {
      // In MCP mode (server-side), only use stderr for errors to avoid interfering with JSON-RPC on stdout
      if (useStderr) {
        process.stderr.write(message + '\n');
      }
      // Don't log info/debug messages in MCP mode to keep stdout clean
    } else if (!this.isBrowser) {
      // Normal server mode, use console
      if (useStderr) {
        console.error(message);
      } else {
        console.log(message);
      }
    } else if (this.isDevelopment) {
      // Browser development mode, use console
      if (useStderr) {
        console.error(message);
      } else {
        console.log(message);
      }
    }
  }

  error(message: string, error?: Error | unknown, context?: LogContext): void {
    const formattedMessage = this.formatMessage(LogLevel.ERROR, message, context);
    this.safeLog(formattedMessage, true);
    if (error instanceof Error) {
      this.safeLog('Error details: ' + error.message, true);
      if (this.isDevelopment) {
        this.safeLog('Stack trace: ' + (error.stack || ''), true);
      }
    } else if (error) {
      this.safeLog('Error details: ' + String(error), true);
    }
  }

  warn(message: string, context?: LogContext): void {
    const formattedMessage = this.formatMessage(LogLevel.WARN, message, context);
    this.safeLog(formattedMessage, true);
  }

  info(message: string, context?: LogContext): void {
    const formattedMessage = this.formatMessage(LogLevel.INFO, message, context);
    this.safeLog(formattedMessage, false);
  }

  debug(message: string, context?: LogContext): void {
    if (this.isDevelopment) {
      const formattedMessage = this.formatMessage(LogLevel.DEBUG, message, context);
      this.safeLog(formattedMessage, false);
    }
  }
}

export const logger = new Logger(); 