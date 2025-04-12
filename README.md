# MCP Server for Knowledge Graph

This project implements a standalone MCP (Model Context Protocol) server focused on knowledge graph tools. It provides a standardized interface for AI clients or any MCP-enabled application to create, query, and manipulate entities and relationships within a persistent knowledge graph. This graph can represent codebases, research projects, or any other domain where structured, persistent knowledge is beneficial. The goal is to provide a robust external memory and context mechanism across sessions.

## Features

- Modular architecture with clear separation of concerns
- Standalone Express server mode for direct integration with various host applications
- NextJS API route compatibility for potential web integration (e.g., for a UI)
- Core knowledge graph tools for entity, relationship, and observation management
- Session management for maintaining client context (potentially using project identifiers or paths)
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

### Standalone Mode (Recommended for Direct Integration)

This mode runs a dedicated server process, ideal for direct use with applications that launch and communicate with external tools via stdio or a specific network port.

```bash
# Ensure you have built the project first (npm run build)
node dist/standalone-server.js
```

This will start an Express server (check console output for the specific port, e.g., 3001 or similar). This is the process the host application will manage based on its configuration.

### NextJS API Route (For Web UI/Integration)

The code includes compatibility to be run within a NextJS application, typically for providing a backend to a web-based UI for visualizing or managing the graph. See `app/api/mcp/route.ts` for the implementation. Running the NextJS app (`npm run dev`) would expose this.

## Configuration

### Host Application Configuration

To integrate this server with an MCP-compatible host application, you typically need to configure the host to launch the standalone server. The specific configuration method depends on the host application. Below is a *generic example* inspired by common patterns:

```json
{
  "mcpServers": {
    "knowledge-graph-server-id": { // An identifier used by the host application
      "command": "node", // Or the path to the node executable
      "args": [
        // Ensure this is the *absolute path* to the built standalone server file
        "/path/to/your/mcp-knowledge-graph/dist/standalone-server.js"
        // Optional: Additional arguments for the server can be added here
      ],
      // Optional: Specify communication method (e.g., port, stdio) if needed by the host
      "port": 3001 // Example if communicating via network port
    }
    // ... potentially other MCP server configurations ...
  }
}
```

Consult the documentation of your specific host application to determine the correct way to register and configure an external MCP server. Make sure the `command` and `args` correctly point to your Node executable and the *absolute path* to the compiled `standalone-server.js`.

## Architecture

The server follows a modular architecture:

1.  **Core Components**:
    *   `MCPServer`: Handles MCP protocol logic, connection management, and tool dispatch.
    *   Tool Handlers: Implement the logic for each specific MCP tool.
2.  **Data Layer**:
    *   **KuzuDB**: An embedded graph database used for persistent storage of entities, relationships, and observations. This allows the knowledge graph to survive server restarts.
3.  **Transport Layer**:
    *   Handles communication (e.g., Stdio, HTTP/SSE) between the server and the MCP client. Configured during server setup.
4.  **(Optional) UI**:
    *   A potential Next.js frontend (running separately, e.g., on port 3000) could be developed to visualize the graph and allow manual interaction, interacting with the server via its API routes or potentially MCP itself if configured.

## Available Tools

The server focuses on providing tools for knowledge graph manipulation:

*   **Entity Management:** `create_entity`, `get_entity`, `list_entities`, `update_entity_description`, `delete_entity`
*   **Relationship Management:** `create_relationship`, `get_relationships`, `get_related_entities`, `delete_relationship`
*   **Observation Management:** `add_observation`, `delete_observation`

*(Detailed specifications for these tools can be found in `docs/implementation-plan.md`)*

## Known Issues

*   **Port Conflict (`EADDRINUSE`) on Restart:** Sometimes, when the host application is closed, it may not correctly terminate the standalone server process it launched. This leaves the communication port (e.g., 3001) occupied. When the host application restarts, it might try to start the server again on the same port, resulting in an "address already in use" error.
    *   **Workaround 1:** Manually find and terminate the lingering `node` process associated with `standalone-server.js` using your system's activity monitor or command-line tools (`lsof -ti tcp:<PORT>`, then `kill <PID>`) before restarting the host application. Proper termination should ideally be handled by the host application's lifecycle management.
    *   **Workaround 2:** Change the default port in `standalone-server.ts` (if configurable, check the source) or configure the server to use a different port via arguments if supported. Rebuild the server (`npm run build:server` or similar) and update the host application configuration accordingly.

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