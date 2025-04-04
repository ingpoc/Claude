# Knowledge Graph MCP

## Overview

The Knowledge Graph MCP is a tool that allows AI assistants to build, maintain, and query a structured knowledge representation of code, concepts, and their relationships. This enables assistants to develop a persistent understanding of complex codebases, track context across sessions, and reason about relationships between different software components.

## Architecture

This implementation uses:
- **KuzuDB**: A graph database used for storing entities and relationships
- **NextJS API Routes**: Server-side routes that expose the knowledge graph functionality
- **Model Context Protocol (MCP)**: Framework for integrating tools with AI assistants

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

## Available Tools

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

## Use Cases

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

The knowledge graph is implemented as a server-side application with:

1. A KuzuDB graph database backend for storing entities and relationships
2. Server-side NextJS API routes that provide access to the graph
3. MCP compliant API endpoints for AI assistant integration

## Getting Started

To interact with the Knowledge Graph MCP through an AI assistant:

1. The assistant can use any of the provided tools to query or update the graph
2. Entity and relationship information is returned as structured JSON
3. Build the graph incrementally as you explore and understand code
4. Use the graph to recall and reason about code structure and relationships

## Example Workflow

1. Create entities for key files and functions
2. Establish relationships between them (e.g., "imports", "calls")
3. Add observations about behavior, edge cases, or important details
4. Query the graph to recall how components are related
5. Update descriptions and relationships as understanding evolves
