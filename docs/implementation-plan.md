# Knowledge Graph MCP: Implementation Plan

## Goal

Implement a robust and user-friendly Knowledge Graph MCP server that allows AI clients to effectively build, query, and maintain a knowledge graph of codebases and related concepts.

## Core Tool Implementation

The following tools, outlined in `docs/knowledge-graph.md`, need to be implemented. Clear input validation and informative error handling are crucial for each.

**Crucial Aspect:** Each tool handler *must* return data in the format expected by the `@modelcontextprotocol/sdk`, which is typically an object containing a `content` array with items like `{ type: 'text', text: '...' }` or `{ type: 'json', json: {...} }`. The exact structure should conform to the SDK's requirements to avoid type errors.

### 1. Entity Management

*   **`create_entity`**
    *   **Inputs:** `name: string`, `type: string`, `description: string = ''`, `parent_id: string | null = null`
    *   **Output:** `{ content: [{ type: 'json', json: { id: string, name: string, type: string, description: string, parent_id: string | null } }] }` or error message.
    *   **Logic:** Generate unique ID, validate inputs, insert into KuzuDB.
*   **`get_entity`**
    *   **Inputs:** `id: string`
    *   **Output:** `{ content: [{ type: 'json', json: { id: string, name: string, type: string, description: string, parent_id: string | null, observations: string[] } }] }` or error message.
    *   **Logic:** Query KuzuDB by ID, retrieve entity and associated observations.
*   **`list_entities`**
    *   **Inputs:** `type: string | null = null`, `name_contains: string | null = null`, `limit: number = 20`
    *   **Output:** `{ content: [{ type: 'json', json: { entities: [{ id: string, name: string, type: string }] } }] }`
    *   **Logic:** Query KuzuDB with optional filters.
*   **`update_entity_description`**
    *   **Inputs:** `id: string`, `description: string`
    *   **Output:** `{ content: [{ type: 'text', text: 'Entity description updated successfully.' }] }` or error message.
    *   **Logic:** Find entity by ID and update its description field.
*   **`delete_entity`**
    *   **Inputs:** `id: string`
    *   **Output:** `{ content: [{ type: 'text', text: 'Entity and related relationships deleted.' }] }` or error message.
    *   **Logic:** Delete entity and *all* its incoming/outgoing relationships from KuzuDB.

### 2. Relationship Management

*   **`create_relationship`**
    *   **Inputs:** `from_id: string`, `to_id: string`, `type: string`
    *   **Output:** `{ content: [{ type: 'json', json: { id: string, from_id: string, to_id: string, type: string } }] }` or error message.
    *   **Logic:** Validate `from_id` and `to_id` exist, insert relationship into KuzuDB.
*   **`get_relationships`**
    *   **Inputs:** `entity_id: string | null = null`, `type: string | null = null`, `direction: 'incoming' | 'outgoing' | 'both' = 'both'`, `limit: number = 20`
    *   **Output:** `{ content: [{ type: 'json', json: { relationships: [{ id: string, from_id: string, to_id: string, type: string }] } }] }`
    *   **Logic:** Query KuzuDB relationships table with filters.
*   **`get_related_entities`**
    *   **Inputs:** `entity_id: string`, `relationship_type: string | null = null`, `direction: 'incoming' | 'outgoing' | 'both' = 'both'`, `limit: number = 20`
    *   **Output:** `{ content: [{ type: 'json', json: { related_entities: [{ id: string, name: string, type: string, relationship_type: string }] } }] }`
    *   **Logic:** Perform graph traversal query from `entity_id` based on filters.
*   **`delete_relationship`**
    *   **Inputs:** `id: string`
    *   **Output:** `{ content: [{ type: 'text', text: 'Relationship deleted.' }] }` or error message.
    *   **Logic:** Delete specific relationship by its ID.

### 3. Observation Management

*   **`add_observation`**
    *   **Inputs:** `entity_id: string`, `observation: string`
    *   **Output:** `{ content: [{ type: 'text', text: 'Observation added successfully.' }] }` or error message.
    *   **Logic:** Find entity by ID, append observation text to its observation list/relation.
*   **`delete_observation`**
    *   **Inputs:** `entity_id: string`, `observation_index: number` (or a unique observation ID if implemented)
    *   **Output:** `{ content: [{ type: 'text', text: 'Observation deleted.' }] }` or error message.
    *   **Logic:** Find entity, remove the specified observation.

## Pre-packaged Prompts / Usage Examples (for AI Client)

These demonstrate how an AI might use the tools:

*   **Creating an entity:** "Create a 'file' entity named 'src/api/auth.ts' with the description 'Handles user authentication endpoints'."
    *   *Expected Tool Call:* `create_entity(name='src/api/auth.ts', type='file', description='Handles user authentication endpoints')`
*   **Linking entities:** "Create an 'imports' relationship from the entity 'src/api/auth.ts' (ID: {auth_file_id}) to the entity 'src/lib/utils.ts' (ID: {utils_file_id})."
    *   *Expected Tool Call:* `create_relationship(from_id='{auth_file_id}', to_id='{utils_file_id}', type='imports')`
*   **Adding details:** "Add an observation to entity {auth_file_id}: 'Uses JWT for token generation'."
    *   *Expected Tool Call:* `add_observation(entity_id='{auth_file_id}', observation='Uses JWT for token generation')`
*   **Querying relationships:** "Show me entities that the 'src/api/auth.ts' file (ID: {auth_file_id}) calls."
    *   *Expected Tool Call:* `get_related_entities(entity_id='{auth_file_id}', relationship_type='calls', direction='outgoing')`
*   **Listing entities:** "List all entities of type 'function' that contain 'user' in their name."
    *   *Expected Tool Call:* `list_entities(type='function', name_contains='user')`

## Crucial Aspects for MCP Server Usefulness

1.  **Clear Tool Definition:** Provide comprehensive documentation (`knowledge-graph.md` and this plan) detailing each tool's purpose, parameters (name, type, required/optional), and expected return format.
2.  **Consistent Return Structure:** *Strictly* adhere to the MCP SDK's expected return format (e.g., `{ content: [...] }`). This is the primary source of the current issues and must be correctly implemented.
3.  **Robust Input Validation:** Validate all incoming parameters (type, format, existence of IDs where necessary). Return clear, actionable error messages within the standard MCP return structure (e.g., `{ content: [{ type: 'text', text: 'Error: Entity ID {id} not found.' }] }`).
4.  **Idempotency (where applicable):** Consider if operations like `create_entity` should be idempotent (e.g., return the existing entity if called with the same unique parameters) or throw an error.
5.  **State Management:** The graph database (KuzuDB) inherently manages state. Ensure database connections are handled correctly (pooling, closing). 
6.  **Scalability:** While KuzuDB is embedded, consider potential future scaling needs if the graph becomes very large.
7.  **Error Handling & Logging:** Implement comprehensive server-side logging to debug issues. Return user-friendly errors via the MCP structure.
8.  **Security:** If the MCP server is exposed, consider authentication/authorization mechanisms (though likely less critical for a local dev tool).

By focusing on these implementation details, particularly the correct return structure and clear definitions, the Knowledge Graph MCP server can become a reliable and useful tool for AI clients.
