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

1.  **Clone the repository (if you haven't already):**
    ```bash
    git clone <your-repository-url>
    cd mcp-knowledge-graph
    ```

2.  **Install dependencies:**
    ```bash
    npm install
    ```

3.  **Prepare the application (builds server and Next.js app):**
    This step compiles the TypeScript server code to JavaScript (in `dist/`) and builds the Next.js application for production (in `.next/`).
    ```bash
    npm run preparepackage
    ```

## Running the Project

You can run this project in several ways, depending on whether you're doing local development and testing, or integrating it as a service launched by a host application (like an AI client).

### 1. Local Development & Testing (Using npm Scripts)

This mode is ideal for actively developing the UI and/or the API.

**A. Full Stack (UI & API with Hot-Reloading):**

This is the most common local development setup. It starts two services:
*   **Next.js Development Server (UI):** Serves the frontend from `app/` with hot-reloading.
    *   Runs on: `http://localhost:4000` (by default, via `npm run start-nextjs` which uses `next dev -p 4000`).
*   **API Server & MCP SDK (`standalone-server.ts`):** Handles backend API logic and the MCP stdio service.
    *   Runs on: `http://localhost:3155` (by default, when `NODE_ENV` is `development`).

The Next.js development server (port 4000) is configured to proxy API requests (`/api/ui/*`) to this API server (port 3155).

**To start everything for local development:**
```bash
# Ensure environment variables are NOT overriding to production
# (e.g., unset NODE_ENV or ensure it's 'development')
npm run start:all
```
Access the UI in your browser at `http://localhost:4000`. The API backend will be at `http://localhost:3155`.

**B. Running API/MCP Server or Next.js UI Separately:**

*   **API Server & MCP SDK only:**
    ```bash
    # This will run based on NODE_ENV.
    # If NODE_ENV=development (or not set), it listens on UI_API_PORT (default 3155).
    # If NODE_ENV=production, it tries to serve the built Next.js app on UI_API_PORT (default 4000).
    npm run start 
    ```
*   **Next.js UI Development Server only:**
    ```bash
    npm run start-nextjs # Runs 'next dev -p 4000'
    ```

### 2. Running via a Host Application (e.g., Claude Desktop, Cursor)

When this server is launched by an external host application (like Claude via its `claude_desktop_config.json`), the host application manages the lifecycle of the `standalone-server.js` process.

**Prerequisite:** Always ensure your project is built, especially for production mode.
```bash
npm run preparepackage
```
This command compiles your TypeScript server to `dist/` and creates a production build of the Next.js app in `.next/`.

**A. Production Mode (Recommended for Host Application):**

In this mode, the single `dist/standalone-server.js` process will:
*   Serve the optimized Next.js UI.
*   Handle all API requests.
*   Run the MCP SDK server (for stdio communication with the host).

**Host Application Configuration (`claude_desktop_config.json` example):**
```json
{
  "mcpServers": {
    "mcp-knowledge-graph": {
      "command": "node",
      "args": [
        // Absolute path to the built standalone server
        "/path/to/your/mcp-knowledge-graph/dist/standalone-server.js"
      ],
      "cwd": "/path/to/your/mcp-knowledge-graph", // Absolute path to project root
      "env": {
        "NODE_ENV": "production",
        "UI_API_PORT": "4000" // Port for combined UI and API
      }
    }
    // ... other MCP server configurations ...
  }
}
```
*   Set `NODE_ENV` to `"production"`.
*   Set `UI_API_PORT` to the desired port for the combined UI and API (e.g., `4000`).
*   Ensure `cwd` points to your project's root directory.
The host application will launch this server. Access the UI at the `UI_API_PORT` (e.g., `http://localhost:4000`).

**B. Development Mode (for Debugging Backend with Host Application):**

This setup is useful if you want the host application to manage your backend/MCP server (running `standalone-server.js`) while you actively develop the UI with hot-reloading separately.

**Host Application Configuration (`claude_desktop_config.json` example):**
```json
{
  "mcpServers": {
    "mcp-knowledge-graph": {
      "command": "node",
      "args": [
        // Absolute path to the built standalone server
        "/path/to/your/mcp-knowledge-graph/dist/standalone-server.js"
      ],
      "cwd": "/path/to/your/mcp-knowledge-graph", // Absolute path to project root
      "env": {
        "NODE_ENV": "development",
        "UI_API_PORT": "3155" // Port for the API server (UI runs separately)
      }
    }
    // ... other MCP server configurations ...
  }
}
```
*   Set `NODE_ENV` to `"development"`.
*   Set `UI_API_PORT` to the port your API backend should use (e.g., `3155`).
*   The host application will launch `standalone-server.js`, which will *only* run the API and MCP SDK server on this port (e.g., 3155). It will **not** serve the Next.js UI.

*   **To view the UI:** You **must manually start** the Next.js development server in a separate terminal:
    ```bash
    cd /path/to/your/mcp-knowledge-graph
    npm run start-nextjs 
    ```
    This will typically run the UI on `http://localhost:4000`, which will then proxy API calls to the server managed by the host application (at `http://localhost:3155`).

### MCP SDK Server (Stdio)

In all the above scenarios where `standalone-server.js` (or `standalone-server.ts`) is run, it also initializes and runs the MCP SDK server. This server communicates over stdio by default and is intended for programmatic interaction by MCP-compatible clients (like the host application).

## Configuration

### Host Application Configuration (General Notes)

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
      // Set the Current Working Directory to the project root
      "cwd": "/path/to/your/mcp-knowledge-graph",
      // Define environment variables for the server process
      "env": {
        "NODE_ENV": "production", // Or "development"
        "UI_API_PORT": "4000"     // Adjust port as needed (e.g., 3155 for dev API)
      }
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