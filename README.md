# MCP Server for Knowledge Graph

This project implements a standalone MCP (Model Context Protocol) server with a focus on knowledge graph tools. It provides a set of tools that can be used to create, query, and manipulate entities and relationships in a knowledge graph.

## Features

- Modular architecture with clear separation of concerns
- Standalone Express server mode for direct use with Claude Desktop
- NextJS API route compatibility for web integration
- Project management tools
- Knowledge graph tools for entity/relationship management
- Session management for maintaining client context

## Installation

```bash
# Install dependencies
npm install

# Run the setup script to prepare the standalone server
./setup.js
```

## Running the Server

### Standalone Mode

To run the server in standalone mode:

```bash
node standalone-server-dist.js
```

This will start an Express server on port 3010 that can be directly used with Claude Desktop.

### NextJS API Route

To use the server as a NextJS API route, you can use the implementation in `app/api/mcp/route.ts`.

## Configuration

### Claude Desktop Configuration

To use this server with Claude Desktop, update your Claude Desktop configuration file:

```json
{
  "mcpServers": {
    "knowledge-graph": {
      "command": "node",
      "args": [
        "/path/to/your/standalone-server-dist.js"
      ]
    }
  }
}
```

The configuration file is typically located at:
- macOS: `~/Library/Application Support/Claude/claude_desktop_config.json`
- Windows: `%APPDATA%\Claude\claude_desktop_config.json`
- Linux: `~/.config/Claude/claude_desktop_config.json`

## Architecture

The server follows a modular architecture with the following components:

1. **Core Components**:
   - `MCPServerConfig`: Handles server configuration and tool registration
   - `SessionManager`: Manages client sessions and their contexts

2. **Transport Layer**:
   - `NextJsSSETransport`: Provides SSE transport capabilities for both NextJS and Express

3. **Tools**:
   - `KnowledgeGraphTools`: Tools for entity and relationship management
   - `ProjectTools`: Tools for project management

4. **Data Layer**:
   - Simple in-memory storage for development and testing
   - Can be extended to use external databases

## Available Tools

### Project Tools

- `project_createProject`: Create a new project
- `project_getProject`: Get a project by ID
- `project_getProjects`: Get all projects
- `project_deleteProject`: Delete a project

### Knowledge Graph Tools

- `knowledgeGraph_createEntity`: Create a new entity
- `knowledgeGraph_getEntity`: Get an entity by ID
- `knowledgeGraph_getAllEntities`: Get all entities
- `knowledgeGraph_createRelationship`: Create a relationship between entities
- `knowledgeGraph_getRelationships`: Get relationships with optional filters
- `knowledgeGraph_getRelatedEntities`: Get entities related to a given entity
- `knowledgeGraph_addObservation`: Add an observation to an entity
- `knowledgeGraph_updateEntityDescription`: Update entity description
- `knowledgeGraph_deleteEntity`: Delete an entity
- `knowledgeGraph_deleteRelationship`: Delete a relationship
- `knowledgeGraph_deleteObservation`: Delete an observation

## Development

### Directory Structure

```
├── app/                  # NextJS app directory
│   └── api/              # API routes
│       └── mcp/          # MCP API route
├── lib/                  # Library code
│   └── mcp/              # MCP implementation
│       ├── tools/        # Tool implementations
│       └── transport/    # Transport implementations
├── dist/                 # Compiled output
├── setup.js              # Setup script for standalone server
└── standalone-server.js  # Standalone Express server
```

### Adding New Tools

To add new tools, create a new tool configuration in the `lib/mcp/tools` directory following the pattern of the existing tools. Then register the tool configuration in the server configuration.