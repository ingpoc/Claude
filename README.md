# MCP Knowledge Graph Server with Interactive Dashboard

[![smithery badge](https://smithery.ai/badge/@ingpoc/claude)](https://smithery.ai/client/@ingpoc/claude)

This project implements a comprehensive MCP (Model Context Protocol) server for knowledge graph management with an integrated Next.js dashboard. It provides AI-powered tools for creating, querying, and visualizing knowledge graphs with persistent vector storage and context intelligence features.

## Features

### Core Knowledge Graph
- **Entity Management**: Create, update, delete, and query entities with rich metadata
- **Relationship Mapping**: Build complex relationships between entities with strength scoring
- **Project Organization**: Multi-project workspace with isolated data management
- **Observation Tracking**: Add contextual observations to entities for enhanced knowledge capture

### Vector Database & AI
- **Qdrant Integration**: High-performance vector storage with semantic search capabilities
- **OpenAI Embeddings**: Automatic embedding generation for semantic similarity
- **Smart Search**: Vector-based entity and relationship discovery
- **Context Intelligence**: AI-powered conversation analysis and context prediction

### Interactive Dashboard
- **Modern UI**: Built with Next.js, shadcn/ui, and Tailwind CSS
- **Graph Visualization**: Interactive knowledge graph with React Flow
- **Real-time Analytics**: Project metrics and entity statistics
- **Natural Language Query**: AI-powered natural language search interface
- **Activity Feed**: Track all knowledge graph operations

### MCP Server Integration
- **Standardized Protocol**: Full MCP compatibility for AI client integration
- **Tool Library**: Comprehensive set of knowledge graph tools
- **Session Management**: Context-aware session handling for AI interactions
- **Vector Search Tools**: Advanced semantic search capabilities

## Architecture

### Tech Stack
- **Backend**: Node.js + Express + TypeScript
- **Database**: Qdrant Vector Database (replaces KuzuDB)
- **Frontend**: Next.js 14 + React + TypeScript
- **UI Components**: shadcn/ui + Radix UI + Tailwind CSS
- **Animation**: GSAP for smooth interactions
- **AI Integration**: OpenAI API for embeddings and language processing

### Data Models
```typescript
interface QdrantEntity {
  id: string;
  name: string;
  type: string;
  description?: string;
  projectId: string;
  metadata: Record<string, any>;
  createdAt: Date;
  updatedAt: Date;
}

interface QdrantRelationship {
  id: string;
  sourceId: string;
  targetId: string;
  type: string;
  description?: string;
  projectId: string;
  strength: number; // 0-1 similarity score
  metadata: Record<string, any>;
  createdAt: Date;
}
```

## Installation

### Installing via Smithery

To install MCP Knowledge Graph Server with Interactive Dashboard for Claude Desktop automatically via [Smithery](https://smithery.ai/client/@ingpoc/claude):

```bash
npx -y @smithery/cli install @ingpoc/claude --client claude
```

### Manual Installation
1. **Clone the repository:**
   ```bash
   git clone <your-repository-url>
   cd mcp-knowledge-graph
   ```

2. **Install dependencies:**
   ```bash
   npm install
   ```

3. **Environment Configuration:**
   Create a `.env.local` file with:
   ```env
   # Qdrant Configuration
   QDRANT_URL=http://localhost:6333
   QDRANT_API_KEY=your_qdrant_api_key

   # OpenAI Configuration (for embeddings)
   OPENAI_API_KEY=your_openai_api_key

   # Server Configuration
   NODE_ENV=development
   UI_API_PORT=4000
   ```

4. **Start Qdrant Database:**
   ```bash
   # Using Docker
   docker run -p 6333:6333 qdrant/qdrant
   ```

5. **Build the application:**
   ```bash
   npm run preparepackage
   ```

## Running the Application

### Development Mode (Recommended for Local Development)

**Full Stack Development:**
```bash
npm run start:all
```
This starts both:
- Next.js UI server on `http://localhost:4000`
- API server with MCP integration on `http://localhost:3155`

**Individual Services:**
```bash
# API server only
npm run start

# Next.js UI only  
npm run start-nextjs
```

### Production Mode

**Combined Server (UI + API + MCP):**
```bash
npm run start:prod
```
Serves everything on `http://localhost:4000`

### MCP Client Integration

Configure your MCP-compatible AI client (e.g., Claude Desktop) with:

```json
{
  "mcpServers": {
    "knowledge-graph": {
      "command": "node",
      "args": ["/absolute/path/to/mcp-knowledge-graph/dist/standalone-server.js"],
      "cwd": "/absolute/path/to/mcp-knowledge-graph",
      "env": {
        "NODE_ENV": "production",
        "UI_API_PORT": "4000",
        "QDRANT_URL": "http://localhost:6333",
        "OPENAI_API_KEY": "your_openai_api_key"
      }
    }
  }
}
```

## Available MCP Tools

### Entity Management
- `create_entity` - Create new entities with metadata
- `get_entity` - Retrieve entity details
- `list_entities` - List entities with filtering
- `update_entity_description` - Update entity properties
- `delete_entity` - Remove entities and relationships
- `add_observation` - Add contextual observations
- `delete_observation` - Remove observations
- `edit_observation` - Update observation text

### Relationship Management
- `create_relationship` - Create entity relationships
- `get_relationships` - Retrieve relationships
- `get_related_entities` - Find connected entities
- `delete_relationship` - Remove relationships

### Project Management
- `create_project` - Create new projects
- `get_project` - Retrieve project details
- `list_projects` - List all projects
- `delete_project` - Remove projects

### Vector Search & AI
- `vector_search` - Semantic search across entities
- `find_similar_entities` - Discover similar entities
- `auto_extract_entities` - AI-powered entity extraction
- `get_smart_suggestions` - Context-aware suggestions

### Session & Context
- `initialize_session` - Start MCP sessions
- `add_conversation_context` - Track conversation context
- `get_conversation_context` - Retrieve session context
- `update_session_state` - Update session information
- `end_session` - Clean up sessions

## Dashboard Features

### Project Dashboard
- Create and manage multiple projects
- Real-time project statistics
- Entity and relationship metrics
- Activity timeline

### Knowledge Graph Visualization
- Interactive graph with React Flow
- Entity type filtering
- Relationship visualization
- Zoom and pan controls

### AI-Powered Features
- Natural language query interface
- Smart entity suggestions
- Conversation context analysis
- Intelligent relationship discovery

### Settings Management
- AI feature toggles
- Model configuration
- API key management
- Performance settings

## API Endpoints

### Projects
- `GET /api/ui/projects` - List projects
- `POST /api/ui/projects` - Create project
- `GET /api/ui/projects/:id` - Get project
- `DELETE /api/ui/projects/:id` - Delete project

### Entities
- `GET /api/ui/projects/:id/entities` - List entities
- `POST /api/ui/projects/:id/entities` - Create entity
- `PUT /api/ui/projects/:id/entities/:entityId` - Update entity
- `DELETE /api/ui/projects/:id/entities/:entityId` - Delete entity

### Relationships
- `GET /api/ui/projects/:id/relationships` - List relationships
- `POST /api/ui/projects/:id/relationships` - Create relationship
- `DELETE /api/ui/projects/:id/relationships/:relId` - Delete relationship

### Graph Data
- `GET /api/ui/projects/:id/graph` - Get complete graph data
- `GET /api/ui/projects/:id/metrics` - Get project metrics

## Development

### Directory Structure
```
├── app/                     # Next.js App Router
│   ├── api/                # API routes
│   ├── projects/           # Project pages
│   ├── settings/           # Settings pages
│   └── page.tsx           # Dashboard home
├── components/             # React components
│   ├── ui/                # shadcn/ui components
│   └── zen/               # Custom components
├── lib/                   # Core libraries
│   ├── mcp/               # MCP server implementation
│   │   ├── tools/         # MCP tool handlers
│   │   └── transport/     # Transport layer
│   └── services/          # Data services
│       ├── QdrantDataService.ts
│       ├── EntityService.ts
│       └── SettingsService.ts
├── qdrant_storage/        # Qdrant data directory
└── standalone-server.ts   # MCP server entry point
```

### Adding New Tools

1. Create tool definition in `lib/mcp/tools/`
2. Implement handler function
3. Register in `standalone-server.ts`
4. Add to tool exports

### Adding UI Features

1. Create component in `components/`
2. Add API route in `app/api/`
3. Update service layer if needed
4. Test with dashboard interface

## Performance & Scaling

### Qdrant Configuration
- Vector size: 1536 (OpenAI ada-002)
- Distance metric: Cosine similarity
- Optimized for similarity search
- Automatic indexing and replication

### Caching
- Vector embeddings cached in Qdrant
- API response caching
- Static asset optimization

### Memory Management
- Efficient vector storage
- Session cleanup
- Garbage collection optimization

## Troubleshooting

### Common Issues

1. **Port Conflicts**: Change `UI_API_PORT` if default ports are occupied
2. **Qdrant Connection**: Ensure Qdrant is running on configured port
3. **OpenAI API**: Verify API key and rate limits
4. **Build Errors**: Run `npm run build:server` before starting

### Logs
- Application logs via Winston logger
- Qdrant operation logs
- MCP protocol debugging

### Health Checks
- `GET /api/ui/cache/stats` - System health
- Qdrant collection status
- Vector database metrics

## License

[Your License Here]

## Contributing

[Your Contributing Guidelines Here]