import { QdrantClient } from '@qdrant/js-client-rest';
import OpenAI from 'openai';
import { logger } from './Logger';

export interface EntityVector {
  id: string;
  vector: number[];
  payload: {
    name: string;
    type: string;
    description: string;
    metadata: Record<string, any>;
    projectId: string;
    relationships: string[];
    conversationIds: string[];
    createdAt: string;
    updatedAt: string;
  };
}

export interface ConversationVector {
  id: string;
  vector: number[];
  payload: {
    userId: string;
    projectId: string;
    content: string;
    entities: string[];
    timestamp: string;
    sessionId?: string;
  };
}

export interface SearchResult<T> {
  id: string;
  score: number;
  payload: T;
}

export class QdrantService {
  private client: QdrantClient;
  private openai: OpenAI | null = null;
  private isInitialized = false;
  private readonly batchSize: number;
  private readonly timeout: number;
  private readonly retryAttempts: number;

  constructor() {
    this.client = new QdrantClient({
      url: process.env.QDRANT_URL || 'http://localhost:6333',
      apiKey: process.env.QDRANT_API_KEY,
      timeout: parseInt(process.env.QDRANT_TIMEOUT || '30000'),
    });
    
    // Performance configuration
    this.batchSize = parseInt(process.env.QDRANT_BATCH_SIZE || '100');
    this.timeout = parseInt(process.env.QDRANT_TIMEOUT || '30000');
    this.retryAttempts = parseInt(process.env.QDRANT_RETRY_ATTEMPTS || '3');
  }

  private getOpenAIClient(): OpenAI {
    if (!this.openai) {
      if (!process.env.OPENAI_API_KEY) {
        throw new Error('OPENAI_API_KEY environment variable is required for vector operations');
      }
      this.openai = new OpenAI({
        apiKey: process.env.OPENAI_API_KEY,
      });
    }
    return this.openai;
  }

  async initialize(): Promise<void> {
    if (this.isInitialized) return;

    try {
      // Create collections if they don't exist
      await this.ensureCollection('entities', 1536); // OpenAI embedding dimension
      await this.ensureCollection('conversations', 1536);
      await this.ensureCollection('context_sessions', 1536);
      
      this.isInitialized = true;
      logger.info('Qdrant service initialized successfully');
    } catch (error) {
      logger.error('Failed to initialize Qdrant service', { error });
      throw error;
    }
  }

  private async ensureCollection(name: string, vectorSize: number): Promise<void> {
    try {
      await this.client.getCollection(name);
      logger.debug(`Collection ${name} already exists`);
    } catch (error) {
      // Collection doesn't exist, create it with advanced configuration
      const collectionConfig = {
        vectors: {
          size: vectorSize,
          distance: (process.env.QDRANT_DISTANCE_METRIC as any) || 'Cosine',
        },
        optimizers_config: {
          default_segment_number: parseInt(process.env.QDRANT_SHARD_NUMBER || '2'),
          max_segment_size: 20000,
          memmap_threshold: 20000,
          indexing_threshold: 20000,
          flush_interval_sec: 5,
          max_optimization_threads: 1,
        },
        replication_factor: parseInt(process.env.QDRANT_REPLICATION_FACTOR || '1'),
        shard_number: parseInt(process.env.QDRANT_SHARD_NUMBER || '1'),
        // Enable quantization for better performance and memory usage
        quantization_config: process.env.QDRANT_QUANTIZATION_ENABLED === 'true' ? {
          scalar: {
            type: 'int8',
            quantile: 0.99,
            always_ram: true,
          }
        } : undefined,
        // HNSW index configuration for better search performance
        hnsw_config: {
          m: parseInt(process.env.QDRANT_HNSW_M || '16'),
          ef_construct: parseInt(process.env.QDRANT_HNSW_EF_CONSTRUCT || '100'),
          full_scan_threshold: 10000,
          max_indexing_threads: 0,
          on_disk: false,
        },
      };

      await this.client.createCollection(name, collectionConfig);
      logger.info(`Created Qdrant collection with advanced configuration: ${name}`, {
        vectorSize,
        quantizationEnabled: !!collectionConfig.quantization_config,
        shardNumber: collectionConfig.shard_number,
        replicationFactor: collectionConfig.replication_factor
      });
    }
  }

  async generateEmbedding(text: string): Promise<number[]> {
    try {
      const openai = this.getOpenAIClient();
      const response = await openai.embeddings.create({
        model: 'text-embedding-3-small',
        input: text,
      });
      return response.data[0].embedding;
    } catch (error) {
      logger.error('Failed to generate embedding', { error, text: text.substring(0, 100) });
      throw error;
    }
  }

  // Batch operations for better performance
  async generateEmbeddingsBatch(texts: string[]): Promise<number[][]> {
    try {
      const openai = this.getOpenAIClient();
      const response = await openai.embeddings.create({
        model: 'text-embedding-3-small',
        input: texts,
      });
      return response.data.map(item => item.embedding);
    } catch (error) {
      logger.error('Failed to generate batch embeddings', { error, count: texts.length });
      throw error;
    }
  }

  // Retry logic wrapper
  private async withRetry<T>(operation: () => Promise<T>, operationName: string): Promise<T> {
    let lastError: Error | undefined;
    
    for (let attempt = 1; attempt <= this.retryAttempts; attempt++) {
      try {
        return await operation();
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));
        
        if (attempt === this.retryAttempts) {
          logger.error(`${operationName} failed after ${this.retryAttempts} attempts`, { 
            error: lastError.message,
            attempts: attempt 
          });
          throw lastError;
        }
        
        const delay = Math.min(1000 * Math.pow(2, attempt - 1), 5000); // Exponential backoff, max 5s
        logger.warn(`${operationName} failed, retrying in ${delay}ms`, { 
          attempt, 
          error: lastError.message 
        });
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
    
    throw lastError;
  }

  // Batch upsert entities for better performance
  async upsertEntitiesBatch(entities: Omit<EntityVector, 'vector'>[]): Promise<void> {
    await this.initialize();
    
    if (entities.length === 0) return;
    
    // Process in batches
    for (let i = 0; i < entities.length; i += this.batchSize) {
      const batch = entities.slice(i, i + this.batchSize);
      
      // Generate embeddings for the batch
      const texts = batch.map(entity => 
        `${entity.payload.name} ${entity.payload.type} ${entity.payload.description}`
      );
      
      const embeddings = await this.generateEmbeddingsBatch(texts);
      
      // Prepare points for upsert
      const points = batch.map((entity, index) => ({
        id: entity.id,
        vector: embeddings[index],
        payload: entity.payload,
      }));
      
      // Upsert with retry logic
      await this.withRetry(async () => {
        await this.client.upsert('entities', {
          wait: true,
          points,
        });
      }, `Batch upsert entities (${i + 1}-${i + batch.length})`);
      
      logger.debug(`Batch upserted entities to Qdrant`, { 
        batchStart: i + 1,
        batchEnd: i + batch.length,
        totalEntities: entities.length 
      });
    }
  }

  // Entity operations
  async upsertEntity(entity: Omit<EntityVector, 'vector'>): Promise<void> {
    await this.initialize();
    
    const embeddingText = `${entity.payload.name} ${entity.payload.type} ${entity.payload.description}`;
    const vector = await this.generateEmbedding(embeddingText);
    
    await this.withRetry(async () => {
      await this.client.upsert('entities', {
        wait: true,
        points: [{
          id: entity.id,
          vector,
          payload: entity.payload,
        }],
      });
    }, `Upsert entity ${entity.id}`);
    
    logger.debug('Entity upserted to Qdrant', { entityId: entity.id, projectId: entity.payload.projectId });
  }

  async searchEntities(
    query: string, 
    projectId: string, 
    limit: number = 10,
    filter?: Record<string, any>
  ): Promise<SearchResult<EntityVector['payload']>[]> {
    await this.initialize();
    
    const queryVector = await this.generateEmbedding(query);
    
    const searchFilter: any = {
      must: [
        { key: 'projectId', match: { value: projectId } }
      ]
    };
    
    if (filter) {
      Object.entries(filter).forEach(([key, value]) => {
        searchFilter.must.push({ key, match: { value } });
      });
    }
    
    const result = await this.withRetry(async () => {
      return await this.client.search('entities', {
        vector: queryVector,
        limit,
        filter: searchFilter,
        with_payload: true,
        score_threshold: 0.3, // Minimum similarity threshold
      });
    }, `Search entities for query: ${query.substring(0, 50)}`);
    
    return result.map(point => ({
      id: point.id as string,
      score: point.score || 0,
      payload: point.payload as EntityVector['payload'],
    }));
  }

  // Advanced hybrid search combining multiple search strategies
  async hybridSearchEntities(
    query: string,
    projectId: string,
    options: {
      limit?: number;
      vectorWeight?: number; // 0.0 to 1.0, weight for vector search
      keywordWeight?: number; // 0.0 to 1.0, weight for keyword search
      minScore?: number;
      entityType?: string;
    } = {}
  ): Promise<SearchResult<EntityVector['payload']>[]> {
    await this.initialize();
    
    const {
      limit = 10,
      vectorWeight = 0.7,
      keywordWeight = 0.3,
      minScore = 0.4,
      entityType
    } = options;
    
    // Vector search component
    const vectorResults = await this.searchEntities(query, projectId, Math.ceil(limit * 1.5), {
      ...(entityType && { type: entityType })
    });
    
    // Keyword-based filtering (simulate traditional search)
    const keywordResults = vectorResults.filter(result => {
      const text = `${result.payload.name} ${result.payload.description}`.toLowerCase();
      const queryWords = query.toLowerCase().split(' ');
      const matchCount = queryWords.filter(word => text.includes(word)).length;
      return matchCount > 0;
    });
    
    // Combine scores using weighted fusion
    const hybridResults = vectorResults.map(result => {
      const isKeywordMatch = keywordResults.some(kr => kr.id === result.id);
      const keywordScore = isKeywordMatch ? 1.0 : 0.0;
      
      const hybridScore = (result.score * vectorWeight) + (keywordScore * keywordWeight);
      
      return {
        ...result,
        score: hybridScore
      };
    });
    
    // Filter by minimum score and sort
    return hybridResults
      .filter(result => result.score >= minScore)
      .sort((a, b) => b.score - a.score)
      .slice(0, limit);
  }

  async getEntity(entityId: string): Promise<EntityVector | null> {
    await this.initialize();
    
    const result = await this.client.retrieve('entities', {
      ids: [entityId],
      with_payload: true,
      with_vector: true,
    });
    
    if (result.length === 0) return null;
    
    const point = result[0];
    return {
      id: point.id as string,
      vector: point.vector as number[],
      payload: point.payload as EntityVector['payload'],
    };
  }

  async deleteEntity(entityId: string): Promise<void> {
    await this.initialize();
    
    await this.client.delete('entities', {
      wait: true,
      points: [entityId],
    });
    
    logger.debug('Entity deleted from Qdrant', { entityId });
  }

  // Conversation operations
  async upsertConversation(conversation: Omit<ConversationVector, 'vector'>): Promise<void> {
    await this.initialize();
    
    const vector = await this.generateEmbedding(conversation.payload.content);
    
    await this.client.upsert('conversations', {
      wait: true,
      points: [{
        id: conversation.id,
        vector,
        payload: conversation.payload,
      }],
    });
    
    logger.debug('Conversation upserted to Qdrant', { 
      conversationId: conversation.id, 
      projectId: conversation.payload.projectId 
    });
  }

  async searchConversations(
    query: string,
    projectId: string,
    limit: number = 10
  ): Promise<SearchResult<ConversationVector['payload']>[]> {
    await this.initialize();
    
    const queryVector = await this.generateEmbedding(query);
    
    const result = await this.client.search('conversations', {
      vector: queryVector,
      limit,
      filter: {
        must: [{ key: 'projectId', match: { value: projectId } }]
      },
      with_payload: true,
    });
    
    return result.map(point => ({
      id: point.id as string,
      score: point.score || 0,
      payload: point.payload as ConversationVector['payload'],
    }));
  }

  // Relationship discovery through vector similarity
  async findSimilarEntities(
    entityId: string,
    projectId: string,
    limit: number = 5
  ): Promise<SearchResult<EntityVector['payload']>[]> {
    await this.initialize();
    
    const entity = await this.getEntity(entityId);
    if (!entity) return [];
    
    const result = await this.client.search('entities', {
      vector: entity.vector,
      limit: limit + 1, // +1 to exclude the entity itself
      filter: {
        must: [
          { key: 'projectId', match: { value: projectId } },
          { key: 'id', match: { value: entityId }, should_not: true }
        ]
      },
      with_payload: true,
    });
    
    return result.map(point => ({
      id: point.id as string,
      score: point.score || 0,
      payload: point.payload as EntityVector['payload'],
    }));
  }

  // Get all entities for a project (with pagination)
  async getAllEntities(
    projectId: string,
    offset: number = 0,
    limit: number = 100
  ): Promise<EntityVector[]> {
    await this.initialize();
    
    const result = await this.client.scroll('entities', {
      filter: {
        must: [{ key: 'projectId', match: { value: projectId } }]
      },
      limit,
      offset,
      with_payload: true,
      with_vector: true,
    });
    
    return result.points.map(point => ({
      id: point.id as string,
      vector: point.vector as number[],
      payload: point.payload as EntityVector['payload'],
    }));
  }

  // Health check
  async healthCheck(): Promise<boolean> {
    try {
      await this.client.getCollections();
      return true;
    } catch (error) {
      logger.error('Qdrant health check failed', { error });
      return false;
    }
  }

  // Collection stats
  async getCollectionStats(collectionName: string): Promise<any> {
    await this.initialize();
    return await this.client.getCollection(collectionName);
  }
}

export const qdrantService = new QdrantService(); 