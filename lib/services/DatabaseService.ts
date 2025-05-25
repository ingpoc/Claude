import { logger } from './Logger';
import { qdrantDataService } from './QdrantDataService';

export interface QueryParams {
  [key: string]: any;
}

export interface QueryOptions {
  timeout?: number;
  retries?: number;
}

export class DatabaseService {
  private static instance: DatabaseService;

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
  ): Promise<any | null> {
    logger.warn('DatabaseService.executeQuery called - this is deprecated. Use QdrantDataService instead.', {
      projectId,
      query: query.substring(0, 100) + '...'
    });

    // For compatibility, return null or throw an error
    throw new Error('KuzuDB queries are no longer supported. Please use QdrantDataService methods instead.');
  }

  async beginTransaction(projectId: string): Promise<boolean> {
    logger.warn('DatabaseService.beginTransaction called - transactions not supported in Qdrant');
    return true; // Qdrant doesn't need explicit transactions
  }

  async commitTransaction(projectId: string): Promise<boolean> {
    logger.warn('DatabaseService.commitTransaction called - transactions not supported in Qdrant');
    return true; // Qdrant doesn't need explicit transactions
  }

  async rollbackTransaction(projectId: string): Promise<boolean> {
    logger.warn('DatabaseService.rollbackTransaction called - transactions not supported in Qdrant');
    return true; // Qdrant doesn't need explicit transactions
  }

  async withTransaction<T>(
    projectId: string, 
    operation: () => Promise<T>
  ): Promise<T | null> {
    logger.warn('DatabaseService.withTransaction called - executing operation without transaction in Qdrant');
    
    try {
      return await operation();
    } catch (error) {
      logger.error('Operation failed', error, { projectId });
      return null;
    }
  }

  // Cleanup method for compatibility
  cleanup(): void {
    logger.debug('DatabaseService.cleanup called - no cleanup needed for Qdrant');
  }
}

export const databaseService = DatabaseService.getInstance(); 