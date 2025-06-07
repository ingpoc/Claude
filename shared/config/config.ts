import { z } from 'zod';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config({ path: '.env.local' });

// Configuration schema using Zod for validation
const configSchema = z.object({
  // Environment
  nodeEnv: z.enum(['development', 'production', 'test']).default('development'),
  
  // Service ports
  apiGatewayPort: z.number().default(3000),
  graphServicePort: z.number().default(3001),
  contextServicePort: z.number().default(3002),
  mcpServicePort: z.number().default(3003),
  uiServicePort: z.number().default(4000),
  
  // Database connections
  qdrant: z.object({
    url: z.string().default('http://localhost:6333'),
    apiKey: z.string().optional(),
    timeout: z.number().default(30000),
  }),
  
  redis: z.object({
    url: z.string().default('redis://localhost:6379'),
    cluster: z.boolean().default(false),
    keyPrefix: z.string().default('mcp-kg:'),
    ttl: z.number().default(24 * 60 * 60), // 24 hours
  }),
  
  // AI/ML services
  openai: z.object({
    apiKey: z.string(),
    model: z.string().default('gpt-4'),
    embeddingModel: z.string().default('text-embedding-ada-002'),
    maxTokens: z.number().default(2000),
    temperature: z.number().default(0.7),
  }),
  
  // Event bus configuration
  eventBus: z.object({
    type: z.enum(['redis', 'kafka', 'nats']).default('redis'),
    redis: z.object({
      url: z.string().default('redis://localhost:6379'),
      streamName: z.string().default('domain-events'),
    }),
    kafka: z.object({
      brokers: z.array(z.string()).default(['localhost:9092']),
      clientId: z.string().default('mcp-knowledge-graph'),
      groupId: z.string().default('mcp-kg-consumers'),
    }),
  }),
  
  // Security
  auth: z.object({
    jwtSecret: z.string(),
    jwtExpiration: z.string().default('24h'),
    bcryptRounds: z.number().default(10),
  }),
  
  // Rate limiting
  rateLimit: z.object({
    windowMs: z.number().default(15 * 60 * 1000), // 15 minutes
    max: z.number().default(100),
    standardHeaders: z.boolean().default(true),
  }),
  
  // CORS
  cors: z.object({
    allowedOrigins: z.array(z.string()).default(['http://localhost:4000']),
    credentials: z.boolean().default(true),
  }),
  
  // Logging
  logging: z.object({
    level: z.enum(['error', 'warn', 'info', 'debug']).default('info'),
    format: z.enum(['json', 'simple']).default('json'),
    file: z.object({
      enabled: z.boolean().default(true),
      path: z.string().default('./logs'),
      maxFiles: z.number().default(5),
      maxSize: z.string().default('10m'),
    }),
  }),
  
  // Feature flags
  features: z.object({
    vectorSearch: z.boolean().default(true),
    realTimeUpdates: z.boolean().default(true),
    aiSuggestions: z.boolean().default(true),
    analytics: z.boolean().default(false),
    distributedTracing: z.boolean().default(false),
  }),
  
  // Performance settings
  performance: z.object({
    maxEntityBatchSize: z.number().default(100),
    embeddingBatchSize: z.number().default(10),
    searchResultLimit: z.number().default(50),
    sessionCleanupInterval: z.number().default(60 * 60 * 1000), // 1 hour
  }),
});

// Raw configuration from environment
const rawConfig = {
  nodeEnv: process.env.NODE_ENV,
  
  // Ports
  apiGatewayPort: parseInt(process.env.API_GATEWAY_PORT || '3000'),
  graphServicePort: parseInt(process.env.GRAPH_SERVICE_PORT || '3001'),
  contextServicePort: parseInt(process.env.CONTEXT_SERVICE_PORT || '3002'),
  mcpServicePort: parseInt(process.env.MCP_SERVICE_PORT || '3003'),
  uiServicePort: parseInt(process.env.UI_SERVICE_PORT || '4000'),
  
  // Database
  qdrant: {
    url: process.env.QDRANT_URL || 'http://localhost:6333',
    apiKey: process.env.QDRANT_API_KEY,
    timeout: parseInt(process.env.QDRANT_TIMEOUT || '30000'),
  },
  
  redis: {
    url: process.env.REDIS_URL || 'redis://localhost:6379',
    cluster: process.env.REDIS_CLUSTER === 'true',
    keyPrefix: process.env.REDIS_KEY_PREFIX || 'mcp-kg:',
    ttl: parseInt(process.env.REDIS_TTL || '86400'),
  },
  
  // AI
  openai: {
    apiKey: process.env.OPENAI_API_KEY || '',
    model: process.env.OPENAI_MODEL || 'gpt-4',
    embeddingModel: process.env.OPENAI_EMBEDDING_MODEL || 'text-embedding-ada-002',
    maxTokens: parseInt(process.env.OPENAI_MAX_TOKENS || '2000'),
    temperature: parseFloat(process.env.OPENAI_TEMPERATURE || '0.7'),
  },
  
  // Event bus
  eventBus: {
    type: process.env.EVENT_BUS_TYPE || 'redis',
    redis: {
      url: process.env.EVENT_BUS_REDIS_URL || process.env.REDIS_URL || 'redis://localhost:6379',
      streamName: process.env.EVENT_BUS_STREAM_NAME || 'domain-events',
    },
    kafka: {
      brokers: process.env.KAFKA_BROKERS?.split(',') || ['localhost:9092'],
      clientId: process.env.KAFKA_CLIENT_ID || 'mcp-knowledge-graph',
      groupId: process.env.KAFKA_GROUP_ID || 'mcp-kg-consumers',
    },
  },
  
  // Security
  auth: {
    jwtSecret: process.env.JWT_SECRET || 'your-secret-key',
    jwtExpiration: process.env.JWT_EXPIRATION || '24h',
    bcryptRounds: parseInt(process.env.BCRYPT_ROUNDS || '10'),
  },
  
  // Rate limiting
  rateLimit: {
    windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS || '900000'),
    max: parseInt(process.env.RATE_LIMIT_MAX || '100'),
    standardHeaders: process.env.RATE_LIMIT_STANDARD_HEADERS !== 'false',
  },
  
  // CORS
  cors: {
    allowedOrigins: process.env.CORS_ALLOWED_ORIGINS?.split(',') || ['http://localhost:4000'],
    credentials: process.env.CORS_CREDENTIALS !== 'false',
  },
  
  // Logging
  logging: {
    level: process.env.LOG_LEVEL || 'info',
    format: process.env.LOG_FORMAT || 'json',
    file: {
      enabled: process.env.LOG_FILE_ENABLED !== 'false',
      path: process.env.LOG_FILE_PATH || './logs',
      maxFiles: parseInt(process.env.LOG_FILE_MAX_FILES || '5'),
      maxSize: process.env.LOG_FILE_MAX_SIZE || '10m',
    },
  },
  
  // Feature flags
  features: {
    vectorSearch: process.env.FEATURE_VECTOR_SEARCH !== 'false',
    realTimeUpdates: process.env.FEATURE_REAL_TIME_UPDATES !== 'false',
    aiSuggestions: process.env.FEATURE_AI_SUGGESTIONS !== 'false',
    analytics: process.env.FEATURE_ANALYTICS === 'true',
    distributedTracing: process.env.FEATURE_DISTRIBUTED_TRACING === 'true',
  },
  
  // Performance
  performance: {
    maxEntityBatchSize: parseInt(process.env.MAX_ENTITY_BATCH_SIZE || '100'),
    embeddingBatchSize: parseInt(process.env.EMBEDDING_BATCH_SIZE || '10'),
    searchResultLimit: parseInt(process.env.SEARCH_RESULT_LIMIT || '50'),
    sessionCleanupInterval: parseInt(process.env.SESSION_CLEANUP_INTERVAL || '3600000'),
  },
};

// Validate and export configuration
export const config = configSchema.parse(rawConfig);

// Type for the configuration
export type Config = z.infer<typeof configSchema>;

// Service-specific configuration getters
export const getServiceConfig = (serviceName: string) => ({
  ...config,
  serviceName,
  port: getServicePort(serviceName),
});

export const getServicePort = (serviceName: string): number => {
  switch (serviceName) {
    case 'api-gateway': return config.apiGatewayPort;
    case 'graph-service': return config.graphServicePort;
    case 'context-service': return config.contextServicePort;
    case 'mcp-service': return config.mcpServicePort;
    case 'ui-service': return config.uiServicePort;
    default: throw new Error(`Unknown service: ${serviceName}`);
  }
};

// Service URLs for internal communication
export const getServiceUrls = () => ({
  apiGateway: `http://localhost:${config.apiGatewayPort}`,
  graphService: `http://localhost:${config.graphServicePort}`,
  contextService: `http://localhost:${config.contextServicePort}`,
  mcpService: `http://localhost:${config.mcpServicePort}`,
  uiService: `http://localhost:${config.uiServicePort}`,
});
