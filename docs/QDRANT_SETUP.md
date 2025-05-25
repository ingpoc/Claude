# Qdrant Vector Database Setup Guide

## Overview

This guide explains how to set up and configure Qdrant vector database integration with the MCP Knowledge Graph Server for semantic search and context intelligence.

## Environment Configuration

Create a `.env.local` file in your project root with the following configuration:

```bash
# Qdrant Vector Database Configuration
QDRANT_URL=http://localhost:6333
QDRANT_API_KEY=your_qdrant_api_key_here

# OpenAI Configuration (for embeddings)
OPENAI_API_KEY=your_openai_api_key_here

# Server Configuration
UI_API_PORT=4000
NODE_ENV=development

# Database Configuration
KUZU_DB_PATH=./.kuzu-db

# Optional: Qdrant Cloud Configuration
# QDRANT_CLOUD_URL=https://your-cluster.qdrant.io
# QDRANT_CLOUD_API_KEY=your_qdrant_cloud_api_key_here

# Optional: Advanced Qdrant Configuration
QDRANT_COLLECTION_PREFIX=mcp_kg_
QDRANT_VECTOR_SIZE=1536
QDRANT_DISTANCE_METRIC=Cosine
QDRANT_REPLICATION_FACTOR=1
QDRANT_SHARD_NUMBER=1

# Optional: Performance Configuration
QDRANT_TIMEOUT=30000
QDRANT_RETRY_ATTEMPTS=3
QDRANT_BATCH_SIZE=100

# Optional: Advanced Features
QDRANT_QUANTIZATION_ENABLED=true
QDRANT_HNSW_M=16
QDRANT_HNSW_EF_CONSTRUCT=100
```

## Installation Options

### Option 1: Docker (Recommended for Development)

```bash
# Pull and run Qdrant
docker pull qdrant/qdrant
docker run -p 6333:6333 -p 6334:6334 \
    -v $(pwd)/qdrant_storage:/qdrant/storage:z \
    qdrant/qdrant
```

### Option 2: Qdrant Cloud (Recommended for Production)

1. Sign up at [Qdrant Cloud](https://cloud.qdrant.io/)
2. Create a cluster
3. Get your cluster URL and API key
4. Update your `.env.local` with the cloud configuration

### Option 3: Local Installation

```bash
# Install Qdrant locally (requires Rust)
cargo install qdrant
qdrant
```

## Features Enabled by Qdrant Integration

### 1. Semantic Entity Search
- Find entities by meaning, not just keywords
- Example: Search "authentication" to find login-related functions

### 2. Context Intelligence
- Automatic entity extraction from conversations
- Smart context loading based on semantic similarity
- Conversation memory with vector-based retrieval

### 3. Relationship Discovery
- Find similar entities automatically
- Suggest relationships based on semantic similarity
- Cluster related concepts

### 4. Advanced Search Capabilities
- Hybrid search (dense + sparse vectors)
- Multi-vector search
- Filtered vector search
- Recommendation systems

## API Endpoints

Once configured, the following vector search endpoints will be available:

```
POST /api/projects/{projectId}/vector-search
GET  /api/projects/{projectId}/similar-entities/{entityId}
POST /api/projects/{projectId}/extract-entities
GET  /api/projects/{projectId}/vector-stats
```

## MCP Tools

The following MCP tools will be available for vector operations:

- `semantic_search_entities` - Search entities by semantic meaning
- `find_similar_entities` - Find entities similar to a given entity
- `extract_entities_from_text` - Auto-extract entities from text
- `get_entity_recommendations` - Get recommended related entities
- `vector_search_conversations` - Search conversations semantically

## Testing the Integration

1. Start Qdrant (using one of the options above)
2. Set your environment variables
3. Start the MCP server
4. Create some entities with descriptions
5. Try semantic search:

```bash
# Example MCP tool call
{
  "tool": "semantic_search_entities",
  "arguments": {
    "projectId": "your-project-id",
    "query": "user authentication",
    "limit": 5
  }
}
```

## Troubleshooting

### Common Issues

1. **Connection Failed**: Check if Qdrant is running on the correct port
2. **API Key Invalid**: Verify your Qdrant Cloud API key
3. **Embedding Errors**: Ensure OpenAI API key is valid
4. **Collection Not Found**: Collections are created automatically on first use

### Health Check

Use the health check endpoint to verify Qdrant connectivity:

```bash
curl http://localhost:4000/api/health/qdrant
```

## Performance Optimization

### For Large Datasets

1. **Increase Shard Number**: Set `QDRANT_SHARD_NUMBER=4` for better parallelism
2. **Use Quantization**: Enable scalar quantization for memory efficiency
3. **Batch Operations**: Use batch upserts for bulk data loading
4. **Index Optimization**: Configure HNSW parameters for your use case

### Memory Management

```bash
# Configure collection with optimized settings
QDRANT_HNSW_EF_CONSTRUCT=200
QDRANT_HNSW_M=16
QDRANT_QUANTIZATION_ENABLED=true
```

## Security Considerations

1. **API Keys**: Never commit API keys to version control
2. **Network Security**: Use HTTPS for Qdrant Cloud connections
3. **Access Control**: Implement proper authentication for production
4. **Data Encryption**: Enable encryption at rest for sensitive data

## Advanced Features

### Hybrid Search

Combine dense and sparse vectors for better search results:

```typescript
// Example hybrid search configuration
const searchResult = await qdrantService.hybridSearchEntities(query, projectId, {
  vectorWeight: 0.7,    // 70% weight for semantic similarity
  keywordWeight: 0.3,   // 30% weight for keyword matching
  minScore: 0.4,        // Minimum combined score
  entityType: 'function' // Optional type filter
});
```

### Quantization Support

Enable scalar quantization for 4x memory reduction:

```bash
# Enable quantization in .env.local
QDRANT_QUANTIZATION_ENABLED=true
```

Benefits:
- 4x memory reduction (float32 → int8)
- Faster search performance
- Minimal accuracy loss (typically <2%)

### Batch Operations

Efficient bulk operations for large datasets:

```typescript
// Batch upsert entities
await qdrantService.upsertEntitiesBatch(entities);

// Batch embedding generation
const embeddings = await qdrantService.generateEmbeddingsBatch(texts);
```

### Retry Logic & Error Handling

Automatic retry with exponential backoff:
- Configurable retry attempts (default: 3)
- Exponential backoff (1s, 2s, 4s, max 5s)
- Comprehensive error logging
- Graceful degradation

### Performance Optimizations

#### HNSW Index Configuration
```bash
QDRANT_HNSW_M=16                    # Number of connections per node
QDRANT_HNSW_EF_CONSTRUCT=100        # Search width during construction
```

#### Collection Optimization
```bash
QDRANT_SHARD_NUMBER=4               # Increase for better parallelism
QDRANT_REPLICATION_FACTOR=2         # Increase for high availability
```

#### Batch Processing
```bash
QDRANT_BATCH_SIZE=100               # Optimize for your use case
QDRANT_TIMEOUT=30000                # Increase for large operations
```

## Monitoring and Metrics

Monitor your Qdrant integration with:

1. **Collection Stats**: Track vector count, memory usage
2. **Search Performance**: Monitor query latency and throughput
3. **Embedding Quality**: Track search relevance scores
4. **Error Rates**: Monitor failed operations and retries

## Next Steps

1. Set up your environment configuration
2. Start Qdrant using your preferred method
3. Test the basic integration
4. Explore advanced features like hybrid search
5. Optimize for your specific use case

For more advanced configuration and features, refer to the [Qdrant Documentation](https://qdrant.tech/documentation/). 