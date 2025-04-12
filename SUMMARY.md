# MCP Knowledge Graph

## Overview
This MCP (Model Context Protocol) implementation provides a knowledge graph functionality that enables AI assistants like Claude to build and maintain persistent context about codebases across sessions. It serves as an external memory system allowing AIs to store, retrieve, and reason about code entities, their relationships, and observations.

## Usecase
The primary usecase of this MCP is to enhance AI coding assistants by:

1. **Persistent Memory**: Maintain knowledge about a codebase beyond a single conversation session
2. **Structured Knowledge**: Organize information about code entities (files, functions, classes, concepts) and their relationships
3. **Context Building**: Allow AIs to incrementally build understanding of complex codebases
4. **Knowledge Transfer**: Enable reuse of insights and observations across different user interactions

## Key Features
- Project management (create, list, delete projects)
- Entity management (create, retrieve, update, delete code entities)
- Relationship tracking (define connections between entities)
- Observation storage (add contextual notes to entities)
- Session management (initialize and maintain project context)

## Technical Implementation
- Standalone Express server compatible with Claude Desktop
- KuzuDB for persistent graph database storage
- MCP protocol implementation for standardized tool interaction
- API routes for potential UI integration

## Integration
Designed to work with Claude Desktop through the MCP protocol, allowing Claude to build and maintain knowledge about codebases as it assists users with coding tasks.
