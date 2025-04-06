# MCP Server for Knowledge Graph

This project implements a standalone MCP (Model Context Protocol) server with a focus on knowledge graph tools. It provides a set of tools that can be used by AI clients (like Claude) to create, query, and manipulate entities and relationships in a knowledge graph representing codebases or other domains. The goal is to provide persistent memory and context across sessions.

## Features

- Modular architecture with clear separation of concerns
- Standalone Express server mode for direct integration with hosts like Claude Desktop
- NextJS API route compatibility for potential web integration (e.g., for a UI)
- Project management tools (future/optional, focus is on KG)
- Core knowledge graph tools for entity, relationship, and observation management
- Session management for maintaining client context (optional/future enhancement)
- Persistent storage using KuzuDB

## Installation

```bash
# Install dependencies
npm install

# Build the necessary files
npm run build
# (Or potentially run a setup script if provided, e.g., ./setup.js)
```

## Running the Server

### Standalone Mode (Recommended for Claude Desktop)

This mode runs a dedicated server process, ideal for direct use with desktop applications like Claude Desktop that expect to launch and communicate with a server via stdio or a specific port.

```bash
# Ensure you have built the project first (npm run build)
node dist/standalone-server.js
```

This will start an Express server (check console output for the specific port, e.g., 3001 or similar, might differ from the UI port mentioned elsewhere). This is the process Claude Desktop will manage based on your configuration.

### NextJS API Route (For Web UI/Integration)

The code includes compatibility to be run within a NextJS application, typically for providing a backend to a web-based UI for visualizing or managing the graph. See `app/api/mcp/route.ts` for the implementation. Running the NextJS app (`npm run dev`) would expose this.

## Configuration

### Claude Desktop Configuration

To integrate this server with Claude Desktop, update your Claude Desktop configuration file (`claude_desktop_config.json`) to tell Claude how to launch the standalone server.

```json
{
  "mcpServers": {
    "knowledge-graph": {
      "command": "node", // Or "npx" if using a globally installed package or script runner
      "args": [
        // Ensure this is the *absolute path* to the built standalone server file
        "/Users/yourusername/path/to/MCP/Claude/dist/standalone-server.js"
      ]
    }
    // ... potentially other servers like filesystem ...
  }
}
```

Make sure the `command` and `args` correctly point to your Node executable and the *absolute path* to the compiled `standalone-server.js`.

The configuration file is typically located at:
- macOS: `~/Library/Application Support/Claude/claude_desktop_config.json`
- Windows: `%APPDATA%\Claude\claude_desktop_config.json`
- Linux: `~/.config/Claude/claude_desktop_config.json`

## Architecture

The server follows a modular architecture:

1.  **Core Components**:
    *   `MCPServer`: Handles MCP protocol logic, connection management, and tool dispatch.
    *   Tool Handlers: Implement the logic for each specific MCP tool.
2.  **Data Layer**:
    *   **KuzuDB**: An embedded graph database used for persistent storage of entities, relationships, and observations. This allows the knowledge graph to survive server restarts.
3.  **Transport Layer**:
    *   Handles communication (e.g., Stdio, HTTP/SSE) between the server and the MCP client (Claude). Configured during server setup.
4.  **(Optional) UI**:
    *   A potential Next.js frontend (running separately, e.g., on port 3000) could be developed to visualize the graph and allow manual interaction, interacting with the server via its API routes or potentially MCP itself if configured.

## Available Tools

The server focuses on providing tools for knowledge graph manipulation:

*   **Entity Management:** `create_entity`, `get_entity`, `list_entities`, `update_entity_description`, `delete_entity`
*   **Relationship Management:** `create_relationship`, `get_relationships`, `get_related_entities`, `delete_relationship`
*   **Observation Management:** `add_observation`, `delete_observation`

*(Detailed specifications for these tools can be found in `docs/implementation-plan.md`)*

## Known Issues

*   **Port Conflict (`EADDRINUSE`) on Restart:** Sometimes, when the host application (like Claude Desktop) is closed, it may not correctly terminate the standalone server process launched via the configuration. This leaves the port (e.g., 3001) occupied. When you restart the host application, it tries to start the server again on the same port, resulting in an "address already in use" error.
    *   **Workaround:** Manually find and terminate the lingering `node` process associated with `standalone-server.js` using your system's activity monitor or command-line tools (`lsof -ti tcp:<PORT>`, then `kill <PID>`) before restarting the host application. This needs to be addressed within the host application's shutdown logic for a permanent fix.

## Development

### Directory Structure

```
├── app/                  # Optional NextJS app directory (e.g., for UI)
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