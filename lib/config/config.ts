import { z } from 'zod';

// Configuration schema
const ConfigSchema = z.object({
    // Qdrant settings
    qdrant: z.object({
        url: z.string().default('http://localhost:6333'),
        apiKey: z.string().optional(),
        collectionName: z.string().default('knowledge_graph'),
        vectorSize: z.number().default(1536),
    }),
    
    // OpenAI settings
    openai: z.object({
        apiKey: z.string(),
        model: z.string().default('gpt-4-turbo-preview'),
        embeddingModel: z.string().default('text-embedding-ada-002'),
        temperature: z.number().default(0.7),
        maxTokens: z.number().default(1000),
    }),
    
    // Performance settings
    performance: z.object({
        batchSize: z.number().default(100),
        cacheEnabled: z.boolean().default(true),
        cacheTTL: z.number().default(3600), // 1 hour
        maxConcurrentRequests: z.number().default(10),
        vectorSearchLimit: z.number().default(20),
        similarityThreshold: z.number().default(0.7),
    }),
    
    // MCP settings
    mcp: z.object({
        serverName: z.string().default('mcp-knowledge-graph-lean'),
        serverVersion: z.string().default('2.0.0'),
        maxToolCallRetries: z.number().default(3),
        toolCallTimeout: z.number().default(30000), // 30 seconds
    }),
    
    // Logging settings
    logging: z.object({
        level: z.enum(['error', 'warn', 'info', 'debug']).default('info'),
        format: z.enum(['json', 'text']).default('json'),
    }),
});

export type Config = z.infer<typeof ConfigSchema>;

// Load configuration from environment
export function loadConfig(): Config {
    const config = {
        qdrant: {
            url: process.env.QDRANT_URL || 'http://localhost:6333',
            apiKey: process.env.QDRANT_API_KEY,
            collectionName: process.env.QDRANT_COLLECTION || 'knowledge_graph',
            vectorSize: parseInt(process.env.VECTOR_SIZE || '1536'),
        },
        openai: {
            apiKey: process.env.OPENAI_API_KEY || '',
            model: process.env.OPENAI_MODEL || 'gpt-4-turbo-preview',
            embeddingModel: process.env.OPENAI_EMBEDDING_MODEL || 'text-embedding-ada-002',
            temperature: parseFloat(process.env.OPENAI_TEMPERATURE || '0.7'),
            maxTokens: parseInt(process.env.OPENAI_MAX_TOKENS || '1000'),
        },
        performance: {
            batchSize: parseInt(process.env.BATCH_SIZE || '100'),
            cacheEnabled: process.env.CACHE_ENABLED !== 'false',
            cacheTTL: parseInt(process.env.CACHE_TTL || '3600'),
            maxConcurrentRequests: parseInt(process.env.MAX_CONCURRENT_REQUESTS || '10'),
            vectorSearchLimit: parseInt(process.env.VECTOR_SEARCH_LIMIT || '20'),
            similarityThreshold: parseFloat(process.env.SIMILARITY_THRESHOLD || '0.7'),
        },
        mcp: {
            serverName: process.env.MCP_SERVER_NAME || 'mcp-knowledge-graph-lean',
            serverVersion: process.env.MCP_SERVER_VERSION || '2.0.0',
            maxToolCallRetries: parseInt(process.env.MAX_TOOL_CALL_RETRIES || '3'),
            toolCallTimeout: parseInt(process.env.TOOL_CALL_TIMEOUT || '30000'),
        },
        logging: {
            level: (process.env.LOG_LEVEL || 'info') as any,
            format: (process.env.LOG_FORMAT || 'json') as any,
        },
    };
    
    return ConfigSchema.parse(config);
}

// Singleton instance
let configInstance: Config | null = null;

export function getConfig(): Config {
    if (!configInstance) {
        configInstance = loadConfig();
    }
    return configInstance;
}

// Export config instance
export const config = getConfig();
