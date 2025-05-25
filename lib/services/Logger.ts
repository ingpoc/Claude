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

  private formatMessage(level: LogLevel, message: string, context?: LogContext): string {
    const timestamp = new Date().toISOString();
    const contextStr = context ? ` | Context: ${JSON.stringify(context)}` : '';
    return `[${timestamp}] [${level.toUpperCase()}] ${message}${contextStr}`;
  }

  private safeLog(message: string, useStderr = false): void {
    if (this.isMcpMode) {
      // In MCP mode, only use stderr to avoid interfering with JSON-RPC on stdout
      process.stderr.write(message + '\n');
    } else {
      // Normal mode, use console
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
    this.safeLog(formattedMessage, true);
  }

  debug(message: string, context?: LogContext): void {
    if (this.isDevelopment) {
      const formattedMessage = this.formatMessage(LogLevel.DEBUG, message, context);
      this.safeLog(formattedMessage, true);
    }
  }
}

export const logger = new Logger(); 