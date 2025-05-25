import * as kuzu from 'kuzu';
import { logger } from './Logger';
import { getDbConnection } from '../projectManager';

export interface QueryParams {
  [key: string]: any;
}

export interface QueryOptions {
  timeout?: number;
  retries?: number;
}

export class DatabaseService {
  private static instance: DatabaseService;
  private connectionCache = new Map<string, { conn: kuzu.Connection; lastUsed: number }>();
  private readonly CONNECTION_TIMEOUT = 30000; // 30 seconds
  private readonly MAX_RETRIES = 3;

  static getInstance(): DatabaseService {
    if (!DatabaseService.instance) {
      DatabaseService.instance = new DatabaseService();
    }
    return DatabaseService.instance;
  }

  async executeQuery<T = any>(
    projectId: string,
    query: string,
    params?: QueryParams,
    options: QueryOptions = {}
  ): Promise<kuzu.QueryResult | null> {
    const { timeout = this.CONNECTION_TIMEOUT, retries = this.MAX_RETRIES } = options;
    
    logger.debug('Executing database query', {
      projectId,
      query: query.substring(0, 100) + '...',
      hasParams: !!params
    });

    let attempt = 0;
    while (attempt < retries) {
      try {
        const conn = await this.getConnection(projectId);
        if (!conn) {
          logger.error('Failed to get database connection', undefined, { projectId, attempt });
          return null;
        }

        // Execute query with or without parameters
        let result: kuzu.QueryResult;
        if (params && Object.keys(params).length > 0) {
          // For now, use basic query method - parameterized queries might have issues
          result = await conn.query(query, params);
        } else {
          result = await conn.query(query, undefined);
        }

        logger.debug('Query executed successfully', { projectId, attempt });
        return result;

      } catch (error) {
        attempt++;
        logger.error(`Query execution failed (attempt ${attempt}/${retries})`, error, {
          projectId,
          query: query.substring(0, 100) + '...'
        });

        if (attempt >= retries) {
          logger.error('Max retries reached for query execution', error, { projectId });
          return null;
        }

        // Clear cached connection on error
        this.connectionCache.delete(projectId);
        
        // Wait before retry (exponential backoff)
        await new Promise(resolve => setTimeout(resolve, Math.pow(2, attempt) * 1000));
      }
    }

    return null;
  }

  async beginTransaction(projectId: string): Promise<boolean> {
    try {
      const result = await this.executeQuery(projectId, 'BEGIN TRANSACTION;');
      return !!result;
    } catch (error) {
      logger.error('Failed to begin transaction', error, { projectId });
      return false;
    }
  }

  async commitTransaction(projectId: string): Promise<boolean> {
    try {
      const result = await this.executeQuery(projectId, 'COMMIT;');
      return !!result;
    } catch (error) {
      logger.error('Failed to commit transaction', error, { projectId });
      return false;
    }
  }

  async rollbackTransaction(projectId: string): Promise<boolean> {
    try {
      const result = await this.executeQuery(projectId, 'ROLLBACK;');
      return !!result;
    } catch (error) {
      logger.error('Failed to rollback transaction', error, { projectId });
      return false;
    }
  }

  async withTransaction<T>(
    projectId: string, 
    operation: () => Promise<T>
  ): Promise<T | null> {
    const transactionStarted = await this.beginTransaction(projectId);
    if (!transactionStarted) {
      logger.error('Failed to start transaction', undefined, { projectId });
      return null;
    }

    try {
      const result = await operation();
      const committed = await this.commitTransaction(projectId);
      
      if (!committed) {
        logger.error('Failed to commit transaction', undefined, { projectId });
        await this.rollbackTransaction(projectId);
        return null;
      }
      
      return result;
    } catch (error) {
      logger.error('Transaction operation failed, rolling back', error, { projectId });
      await this.rollbackTransaction(projectId);
      return null;
    }
  }

  private async getConnection(projectId: string): Promise<kuzu.Connection | null> {
    try {
      // Check cache first
      const cached = this.connectionCache.get(projectId);
      if (cached && Date.now() - cached.lastUsed < this.CONNECTION_TIMEOUT) {
        cached.lastUsed = Date.now();
        return cached.conn;
      }

      // Get new connection
      const { conn } = await getDbConnection(projectId);
      if (!conn) {
        return null;
      }

      // Cache the connection
      this.connectionCache.set(projectId, {
        conn,
        lastUsed: Date.now()
      });

      return conn;
    } catch (error) {
      logger.error('Failed to get database connection', error, { projectId });
      return null;
    }
  }

  // Cleanup old connections
  cleanup(): void {
    const now = Date.now();
    for (const [projectId, cached] of this.connectionCache.entries()) {
      if (now - cached.lastUsed > this.CONNECTION_TIMEOUT) {
        this.connectionCache.delete(projectId);
        logger.debug('Cleaned up stale database connection', { projectId });
      }
    }
  }
}

export const databaseService = DatabaseService.getInstance();

// Cleanup connections periodically
if (typeof setInterval !== 'undefined') {
  setInterval(() => {
    databaseService.cleanup();
  }, 60000); // Every minute
} 