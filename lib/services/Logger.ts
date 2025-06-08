import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

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
  private isMcpMode = process.env.MCP_MODE === 'true' || process.stdin.isTTY === false || process.argv.includes('mcp-host');
  private isBrowser = typeof window !== 'undefined';
  private logDir = path.join(__dirname, '../../logs');
  private logFile = path.join(this.logDir, 'mcp-host.log');
  private errorFile = path.join(this.logDir, 'error.log');

  constructor() {
    // Ensure log directory exists
    if (!this.isBrowser && !fs.existsSync(this.logDir)) {
      fs.mkdirSync(this.logDir, { recursive: true });
    }
  }

  private formatMessage(level: LogLevel, message: string, context?: LogContext): string {
    const timestamp = new Date().toISOString();
    const contextStr = context ? ` | Context: ${JSON.stringify(context)}` : '';
    return `[${timestamp}] [${level.toUpperCase()}] ${message}${contextStr}`;
  }

  private writeToFile(filename: string, message: string): void {
    try {
      fs.appendFileSync(filename, message + '\n', 'utf8');
    } catch (err) {
      // Silently fail if can't write to file
    }
  }

  private safeLog(message: string, level: LogLevel): void {
    // In browser production mode, suppress all logging
    if (this.isBrowser && !this.isDevelopment) {
      return;
    }

    if (this.isMcpMode && !this.isBrowser) {
      // In MCP mode, write ALL logs to file, NEVER to stdout/stderr
      const logFile = level === LogLevel.ERROR ? this.errorFile : this.logFile;
      this.writeToFile(logFile, message);
      
      // Also write errors to main log file
      if (level === LogLevel.ERROR) {
        this.writeToFile(this.logFile, message);
      }
    } else if (!this.isBrowser) {
      // Normal server mode, use console
      if (level === LogLevel.ERROR || level === LogLevel.WARN) {
        console.error(message);
      } else {
        console.log(message);
      }
    } else if (this.isDevelopment) {
      // Browser development mode, use console
      if (level === LogLevel.ERROR || level === LogLevel.WARN) {
        console.error(message);
      } else {
        console.log(message);
      }
    }
  }

  error(message: string, error?: Error | unknown, context?: LogContext): void {
    const formattedMessage = this.formatMessage(LogLevel.ERROR, message, context);
    this.safeLog(formattedMessage, LogLevel.ERROR);
    if (error instanceof Error) {
      this.safeLog('Error details: ' + error.message, LogLevel.ERROR);
      if (this.isDevelopment || this.isMcpMode) {
        this.safeLog('Stack trace: ' + (error.stack || ''), LogLevel.ERROR);
      }
    } else if (error) {
      this.safeLog('Error details: ' + String(error), LogLevel.ERROR);
    }
  }

  warn(message: string, context?: LogContext): void {
    const formattedMessage = this.formatMessage(LogLevel.WARN, message, context);
    this.safeLog(formattedMessage, LogLevel.WARN);
  }

  info(message: string, context?: LogContext): void {
    const formattedMessage = this.formatMessage(LogLevel.INFO, message, context);
    this.safeLog(formattedMessage, LogLevel.INFO);
  }

  debug(message: string, context?: LogContext): void {
    if (this.isDevelopment || this.isMcpMode) {
      const formattedMessage = this.formatMessage(LogLevel.DEBUG, message, context);
      this.safeLog(formattedMessage, LogLevel.DEBUG);
    }
  }
}

export const logger = new Logger();
