# AI Agent Guide: Using the MCP Knowledge Graph Server

## 1. Purpose of this Document

This document provides instructions for you, an AI assistant, on how to effectively use the MCP Knowledge Graph Server. Your goal is to leverage this server to build and query a persistent, structured knowledge base about software codebases, enabling you to provide better context-aware assistance during development tasks.

## 2. Your Core Task

Your primary objective when interacting with this server is to:

*   **Build Knowledge:** Populate the graph by creating entities (representing code elements like files, functions, classes, concepts), adding observations (notes, summaries, issues), and defining relationships (like calls, imports, implements) between entities as you analyze or are provided information about a codebase.
*   **Query Knowledge:** Retrieve stored information (entity details, observations, related entities) from the graph to gain context before performing tasks like code generation, analysis, refactoring, or answering questions about the codebase.

## 3. General Usage Principles

*   **Initialization:** Always ensure a project session is initialized using `mcp_knowledge_graph_init_session` before attempting other graph operations. Use the correct `codebaseIdentifier` (usually the absolute path of the project root).
*   **Entity Identification:** Use consistent and descriptive naming conventions for entity `name` fields (e.g., full file paths, qualified function/class names).
*   **Entity Types:** Use appropriate and consistent `type` values (e.g., `file`, `function`, `class`, `interface`, `variable`, `module`, `concept`, `feature`, `requirement`).
*   **Relationship Types:** Use standard relationship `type` values relevant to code (`calls`, `imports`, `implements`, `inherits`, `contains`, `uses`, `related_to`).
*   **Observation Quality:** Store concise, factual, and relevant observations. Examples include implementation summaries, dependencies, TODOs, rationale, or identified issues.
*   **Error Handling:** If a tool call fails, report the error and avoid making assumptions about the graph state.

## 4. Step-by-Step Tool Usage Guide

### 4.1 Initializing the Session

*   **Tool:** `mcp_knowledge_graph_init_session`
*   **When to Use:** At the beginning of an interaction related to a specific codebase, or if the project context might have changed.
*   **Parameters:**
    *   `codebaseIdentifier`: Provide the **absolute path** to the project's root directory *or* a known project ID.
*   **Goal:** To link your current session to the correct knowledge graph for the target codebase.

### 4.2 Creating Code Entities

*   **Tool:** `mcp_knowledge_graph_create_entity`
*   **When to Use:** When you identify a significant code element (file, function, class, etc.) or concept that should be tracked in the graph.
*   **Parameters:**
    *   `name`: Unique identifier (e.g., `src/api/userRoutes.ts`, `src/utils/auth.ts::verifyToken`).
    *   `type`: Classification (e.g., `file`, `function`, `class`, `concept`).
    *   `description`: Brief summary of its purpose.
    *   `observations` (Optional): Initial newline-separated notes.
    *   `parentId` (Optional): ID of a containing entity (e.g., file containing a function).
*   **Goal:** Register code elements and concepts as nodes in the graph.

### 4.3 Adding Observations to Entities

*   **Tool:** `mcp_knowledge_graph_add_observation`
*   **When to Use:** When you learn something specific about an existing entity (its implementation, a TODO, an issue, its purpose, etc.).
*   **Parameters:**
    *   `entity_id`: The ID of the entity to add the note to (obtain this from `create_entity` or `get_entity`/`list_entities`).
    *   `observation`: The textual note.
*   **Goal:** Enrich the graph with contextual details about specific entities.

### 4.4 Defining Relationships Between Entities

*   **Tool:** `mcp_knowledge_graph_create_relationship`
*   **When to Use:** When you identify a direct connection between two entities (e.g., function A calls function B, file X imports file Y).
*   **Parameters:**
    *   `source_id`: ID of the entity initiating the relationship.
    *   `target_id`: ID of the entity the relationship points to.
    *   `type`: Type of connection (`calls`, `imports`, `implements`, `contains`, etc.).
    *   `description` (Optional): More context about the relationship.
*   **Goal:** Model the structure and dependencies within the codebase.

### 4.5 Retrieving Entity Information

*   **Tool:** `mcp_knowledge_graph_get_entity`
*   **When to Use:** To fetch the description and all observations associated with a specific entity before you work with it or answer questions about it.
*   **Parameters:**
    *   `entity_id`: The ID of the entity you need information about.
*   **Goal:** Understand a specific entity's purpose and associated context.

### 4.6 Exploring Connections

*   **Tools:** `mcp_knowledge_graph_get_related_entities`, `mcp_knowledge_graph_get_relationships`
*   **When to Use:** To understand how an entity connects to others (e.g., find callers of a function, find functions within a file, identify implemented interfaces).
*   **Parameters (`get_related_entities`):**
    *   `entity_id`: The ID of the starting entity.
    *   `relationshipType` (Optional): Filter by relationship type (e.g., `calls`).
    *   `direction` (Optional): Filter by direction (`incoming`, `outgoing`, `both`). Default is `both`.
*   **Parameters (`get_relationships`):**
    *   Can filter by `fromId`, `toId`, `type`.
*   **Goal:** Discover dependencies and structural links involving an entity.

### 4.7 Listing Entities

*   **Tool:** `mcp_knowledge_graph_list_entities`
*   **When to Use:** To get an overview of entities in the current project graph or to find the ID of a specific entity if you only know its approximate name or type.
*   **Parameters:**
    *   `type` (Optional): Filter the list by entity type.
*   **Goal:** Discover existing entities or find specific entity IDs.

### 4.8 Managing the Graph (Use Sparingly or When Instructed)

*   **Tools:** `update_entity_description`, `delete_entity`, `delete_relationship`, `delete_observation`
*   **When to Use:** Primarily when explicitly correcting outdated information identified through verification or direct user instruction. Avoid speculative deletion.
*   **Goal:** Maintain the accuracy of the knowledge graph.

## 5. Examples

*   **Creating a function entity:**
    `mcp_knowledge_graph_create_entity(name='src/auth.js::loginUser', type='function', description='Handles user login logic.')`
*   **Adding a TODO observation:**
    `mcp_knowledge_graph_add_observation(entity_id='entity_abc...', observation='TODO: Add input validation.')`
*   **Creating a 'calls' relationship:**
    `mcp_knowledge_graph_create_relationship(source_id='entity_abc...', target_id='entity_xyz...', type='calls')`
*   **Getting details for a function:**
    `mcp_knowledge_graph_get_entity(entity_id='entity_abc...')`
*   **Finding functions called by a specific function:**
    `mcp_knowledge_graph_get_related_entities(entity_id='entity_abc...', relationshipType='calls', direction='outgoing')`

## 6. Supporting Information

*   **Storage:** The knowledge graph is stored persistently using KuzuDB.
*   **Integration:** This server is typically integrated via host application configuration (see `README.md`). Your ability to call these tools depends on that integration.
*   **Observations Storage:** Observations for an entity are stored as a JSON array string within the entity node itself.
