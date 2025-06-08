# MCP Knowledge Graph - Usage Guide

## Quick Start

### 1. Start Services
```bash
# Start both frontend and backend together
npm run start:services
```

This will:
- Start Python backend service on port 8000
- Start Next.js frontend on port 3000  
- Keep both running until you press Ctrl+C

### 2. Configure AI Applications

#### For Claude Desktop
Add to `claude_desktop_config.json`:
```json
{
  "mcpServers": {
    "knowledge-graph": {
      "command": "node",
      "args": ["/absolute/path/to/your/project/dist/mcp-host-simple.js"]
    }
  }
}
```

#### For Cursor  
Add via Settings → MCP Servers:
```json
{
  "name": "knowledge-graph",
  "command": "node", 
  "args": ["/absolute/path/to/your/project/dist/mcp-host-simple.js"]
}
```

#### For Cline
Add to config:
```json
{
  "mcpServers": [
    {
      "name": "knowledge-graph",
      "command": "node",
      "args": ["/absolute/path/to/your/project/dist/mcp-host-simple.js"]
    }
  ]
}
```

### 3. Available MCP Tools

- **create_project** - Create a new project for organizing entities
- **list_projects** - List all projects with stats
- **create_entity** - Create knowledge entities (with projectId)
- **get_entity** - Retrieve entity by ID
- **list_entities** - List entities (with project filtering)
- **search_entities** - Semantic search using memvid
- **add_observation** - Add notes to entities  
- **create_relationship** - Connect entities with relationships
- **list_connected_clients** - See connected AI applications

### 4. Web Dashboard

Visit http://localhost:3000 for:
- Project and entity management
- Visual knowledge graph
- Activity monitoring
- Natural language queries

## Troubleshooting

### Services Not Starting
```bash
# Kill any stuck processes
npm run kill-ports

# Clean and rebuild
npm run clean
npm run build:server
npm run start:services
```

### MCP Connection Issues
```bash
# Test if backend is running
curl http://localhost:8000/health

# Check MCP server manually
npm run mcp:simple
```

### Data Location
- Storage: `python-service/shared_knowledge/`
- Metadata: `python-service/shared_knowledge/metadata.json`
- Memvid video: `python-service/shared_knowledge/knowledge_graph.mp4`

## Example Usage

1. Start services: `npm run start:services`
2. Open AI app (Claude, Cursor, etc.)
3. Create a project: "Create a project called 'My Research' for academic work"
4. Add entities: "Create an entity in My Research project called 'Machine Learning' of type 'concept'"
5. Connect entities: "Create a relationship between Machine Learning and Neural Networks"
6. Search: "Search for entities related to artificial intelligence"

The knowledge graph is shared across all connected AI applications!