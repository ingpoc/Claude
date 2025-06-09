# MCP Knowledge Graph with Memvid Integration

A comprehensive knowledge graph system that combines the Model Context Protocol (MCP) with video-based storage using memvid, enhanced AI integration, and a modern dashboard interface.

## 🚀 Features

### Core Capabilities
- **MCP-Compliant Server**: Fully compatible with Claude Desktop, Cursor, Cline, and any MCP-enabled application
- **Video-Based Storage**: Uses memvid to compress knowledge into MP4 files for efficient storage and semantic search
- **AI-Powered Interface**: OpenRouter integration supporting 300+ AI models with intelligent query processing
- **Multi-Project Support**: Organize entities and relationships into separate projects
- **Real-Time Dashboard**: Interactive web interface with graph visualization, project management, and analytics

### Technical Stack
- **Backend**: Python FastAPI service with memvid integration
- **MCP Server**: TypeScript implementation with Zod validation
- **Frontend**: Next.js 15 with React Flow graph visualization
- **Storage**: JSON metadata + MP4 video compression via memvid
- **AI Integration**: OpenRouter API with multi-level fallback system

## 📁 Project Structure

```
├── app/                          # Next.js dashboard application
│   ├── page.tsx                 # Main dashboard with natural language query
│   ├── projects/[projectId]/    # Project detail pages
│   └── settings/                # Settings configuration
├── components/                   # React components
│   ├── ui/                      # UI components (graphs, forms, etc.)
│   └── *.tsx                    # Entity, project, and dashboard components
├── src/server/                   # MCP server source
│   └── mcp-host.ts              # TypeScript source file
├── dist/                         # Built files
│   └── mcp-host.js              # Production MCP server (compiled from TypeScript)
├── python-service/               # Backend service
│   ├── python_memvid_service.py # Main Python API server
│   ├── requirements.txt         # Python dependencies
│   └── shared_knowledge/        # Storage directory
│       ├── metadata.json        # JSON-based fast access
│       ├── knowledge_graph.mp4  # Compressed video storage
│       └── knowledge_graph_index.* # Search indices
└── lib/                         # Utilities and hooks
```

## 🛠️ Installation & Setup

### 1. Prerequisites
```bash
# Node.js 18+ and Python 3.8+
node --version  # Should be 18+
python --version  # Should be 3.8+
```

### 2. Install Dependencies
```bash
# Install Node.js dependencies
npm install

# Install Python dependencies
cd python-service
pip install -r requirements.txt
cd ..
```

### 3. Build MCP Server
```bash
npm run build:server
```

### 4. Start Services
```bash
# Option 1: Start all services together
npm run start:services

# Option 2: Start manually
# Terminal 1: Python service
cd python-service && python python_memvid_service.py

# Terminal 2: Dashboard
npm run dev
```

## 🔧 Configuration

### MCP Client Setup

**Claude Desktop** - Add to `claude_desktop_config.json`:
```json
{
  "mcpServers": {
    "knowledge-graph": {
      "command": "node",
      "args": ["/absolute/path/to/dist/mcp-host.js"],
      "env": { "NODE_ENV": "development" }
    }
  }
}
```

**Cursor** - Add via Settings → MCP Servers:
```json
{
  "name": "knowledge-graph",
  "command": "node", 
  "args": ["/absolute/path/to/dist/mcp-host.js"]
}
```

### AI Integration Setup

1. **Get OpenRouter API Key**: Visit [OpenRouter](https://openrouter.ai) and create an account
2. **Configure in Dashboard**: Go to Settings → AI Configuration
3. **Add API Key**: Enter your OpenRouter API key
4. **Select Model**: Choose from 300+ available models (default: GPT-4o)

## 📊 Usage

### MCP Tools Available

| Tool | Description | Parameters |
|------|-------------|------------|
| `create_entity` | Create new knowledge entity | name, type, description, projectId |
| `get_entity` | Retrieve entity by ID | entityId |
| `search_entities` | Search entities by query | query, limit, projectId |
| `create_relationship` | Link two entities | sourceId, targetId, type, description |
| `list_projects` | Get all projects | - |
| `create_project` | Create new project | name, description |

### Dashboard Features

- **Natural Language Query**: Ask questions about your knowledge graph using AI
- **Graph Visualization**: Interactive node-link diagrams with auto-layout
- **Project Management**: Create, view, and manage multiple projects
- **Entity Management**: Add entities with rich descriptions and observations
- **Relationship Mapping**: Create and visualize connections between entities
- **Settings Panel**: Configure AI models, API keys, and feature toggles

### Video Storage (Memvid)

The system automatically compresses your knowledge graph into an MP4 video file for efficient storage:

- **Location**: `python-service/shared_knowledge/knowledge_graph.mp4`
- **Auto-Rebuild**: Video regenerates when entities/relationships change
- **Semantic Search**: AI-powered search through video-encoded knowledge
- **Compression**: Significant storage savings compared to traditional databases

## 🔍 API Endpoints

### Python Service (Port 8000)

```
GET    /                          # Service status
GET    /health                    # Health check
POST   /api/entities              # Create entity
GET    /api/entities              # List entities
GET    /api/entities/{id}         # Get entity
PUT    /api/entities/{id}         # Update entity
DELETE /api/entities/{id}         # Delete entity
POST   /api/relationships         # Create relationship
GET    /api/relationships         # List relationships
DELETE /api/relationships/{id}    # Delete relationship
GET    /api/search                # Search entities
POST   /api/projects              # Create project
GET    /api/projects              # List projects
GET    /api/projects/{id}         # Get project
POST   /api/ai-query              # AI-powered queries
```

### Dashboard (Port 3000)

```
/                                 # Main dashboard
/projects                         # Project listing
/projects/[projectId]             # Project details
/settings                         # Configuration
```

## 🧪 Development

### Running Tests
```bash
npm test
```

### Type Checking
```bash
npm run typecheck
```

### Linting
```bash
npm run lint
```

### Development Scripts
```bash
npm run dev              # Start Next.js dashboard
npm run build            # Build dashboard
npm run build:server     # Build MCP server
npm run python:start     # Start Python service
npm run start:services   # Start all services
```

## 🐛 Troubleshooting

### Common Issues

**Memvid Video Not Creating**
- Ensure memvid is installed: `pip install memvid`
- Check Python service logs for API errors
- Verify entities exist before expecting video generation

**MCP Connection Issues**
- Use absolute paths in MCP configurations
- Check if the Python service is running on port 8000
- Ensure proper permissions on the built MCP server file

**AI Queries Not Working**
- Configure OpenRouter API key in dashboard settings
- Check internet connectivity for API calls
- Verify the Python service has the `requests` library installed

**Dashboard Not Loading**
- Ensure Python service is running on port 8000
- Check for CORS issues in browser console
- Verify Next.js is running on port 3000

### Service Status Check
```bash
# Check Python service
curl http://localhost:8000/

# Expected response:
{
  "service": "Memvid Knowledge Graph Service",
  "status": "running", 
  "memvid_available": true,
  "entities": 6,
  "relationships": 1,
  "projects": 3,
  "video_exists": true,
  "index_exists": true
}
```

## 📈 Performance & Scaling

### Current Capabilities
- **Entities**: Supports thousands of entities efficiently
- **Projects**: Unlimited project creation and management  
- **Concurrent Clients**: Multiple MCP clients can connect simultaneously
- **Storage**: Memvid compression provides 90%+ space savings
- **Search Speed**: Sub-second semantic search through video indices

### Optimization Features
- **Relevance Scoring**: Returns only high-relevance results (>0.5 threshold)
- **Project Scoping**: Limit searches to specific projects for faster results
- **Caching**: Intelligent caching of AI responses and search results
- **Fallback Systems**: Multi-level fallback for AI queries and search

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests if applicable
5. Submit a pull request

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🔗 Related Projects

- [Model Context Protocol (MCP)](https://modelcontextprotocol.io/)
- [Memvid](https://github.com/Olow304/memvid) - Video-based knowledge storage
- [OpenRouter](https://openrouter.ai/) - AI model API aggregator
- [Next.js](https://nextjs.org/) - React framework
- [FastAPI](https://fastapi.tiangolo.com/) - Python web framework

---

**Built with ❤️ for the MCP ecosystem**