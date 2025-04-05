# Knowledge Graph MCP

## Overview

The Knowledge Graph MCP server is a tool that allows AI assistants (like the Claude app) to build, maintain, and query a structured knowledge representation of code, concepts, and their relationships. This enables assistants to develop a persistent understanding of complex codebases, track context across sessions, and reason about relationships between different software components.

This project also includes a Next.js web application for visualizing and interacting with the knowledge graph data, but the Next.js application **does not** use the MCP server; it interacts directly with the backend database logic.

## Architecture

This implementation uses:
- **KuzuDB**: A graph database used for storing entities and relationships.
- **Backend Logic (`lib/`)**: TypeScript modules (`knowledgeGraph.ts`, `projectManager.ts`) containing the core logic for interacting with KuzuDB.
- **Standalone MCP Server (`standalone-server.js`)**: A dedicated Node.js/Express server that exposes the backend logic to AI clients via the Model Context Protocol (MCP). Uses code from `lib/mcp/`.
- **Next.js Application (`app/`, `components/`)**: A web-based frontend UI for visualizing and managing the knowledge graph. This application interacts directly with the Backend Logic (e.g., via Server Actions), **not** through the MCP Server.

## Core Concepts

### Entities

Entities represent discrete concepts, components, or artifacts in the knowledge graph. Each entity has:

- **ID**: Unique identifier
- **Name**: Human-readable name (e.g., "Button.tsx", "Authentication Module") 
- **Type**: Classification (e.g., "file", "function", "concept", "requirement")
- **Description**: Purpose or role of the entity
- **Observations**: List of text notes or observations about the entity
- **Parent ID**: Optional reference to a parent entity

### Relationships

Relationships express connections between entities. Each relationship has:

- **ID**: Unique identifier
- **From**: Source entity ID
- **To**: Target entity ID
- **Type**: Nature of the relationship (e.g., "calls", "imports", "implements")

## Available Tools (for MCP Server)

### Entity Management

- **create_entity**: Register a new entity in the knowledge graph
- **get_entity**: Retrieve detailed information about a specific entity
- **list_entities**: List entities, with optional type/name filtering
- **update_entity_description**: Update an entity's description
- **delete_entity**: Remove an entity and its relationships

### Relationship Management

- **create_relationship**: Define a relationship between two entities
- **get_relationships**: Retrieve relationships with optional filtering
- **get_related_entities**: Find entities connected to a specified entity
- **delete_relationship**: Remove a specific relationship

### Observation Management

- **add_observation**: Add a text observation to an entity
- **delete_observation**: Remove a specific observation from an entity

## Use Cases (for AI via MCP Server)

### Code Understanding

- Map file structures, functions, and their relationships
- Track imports, dependencies, and function calls
- Maintain persistent context across multiple development sessions

### Architecture Documentation

- Capture high-level components and their interactions
- Document design patterns and implementation details
- Create "living" documentation that evolves with the codebase

### Requirements Tracing

- Link requirements to implementation components
- Track feature dependencies and impact analysis
- Support regression testing by understanding affected components

## Implementation Details

The knowledge graph backend logic resides in `lib/knowledgeGraph.ts` and `lib/projectManager.ts`, interacting with a KuzuDB database.

This backend logic is exposed in two ways:

1.  **Standalone MCP Server**: A separate Node.js process (`standalone-server.js`) provides MCP compliant API endpoints (e.g., `/events` for SSE, `/mcp-messages` for requests) for AI assistant integration.
2.  **Next.js Frontend**: The web application (`app/`) uses Next.js features (like Server Actions) to call the backend logic in `lib/` directly for its UI features.

## Getting Started (for AI Assistants)

To interact with the Knowledge Graph via the MCP server:

1.  Ensure the standalone server is running (e.g., `node dist/standalone-server.js`).
2.  Connect your AI assistant client to the standalone server's endpoints (typically `http://localhost:3010`).
3.  The assistant can use any of the provided tools (listed above) to query or update the graph via JSON-RPC messages sent to the `/mcp-messages` endpoint.
4.  Entity and relationship information is returned as structured JSON.
5.  Build the graph incrementally as you explore and understand code.
6.  Use the graph to recall and reason about code structure and relationships.

(Note: The Next.js web application is used separately for direct visualization and does not use these MCP tools.)

## Example Workflow (for AI via MCP Server)

1. Create entities for key files and functions
2. Establish relationships between them (e.g., "imports", "calls")
3. Add observations about behavior, edge cases, or important details
4. Query the graph to recall how components are related
5. Update descriptions and relationships as understanding evolves
