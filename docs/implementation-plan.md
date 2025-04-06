# Knowledge Graph MCP: Implementation Plan

## Goal

Implement a robust and user-friendly Knowledge Graph MCP server that allows AI clients to effectively build, query, and maintain a knowledge graph of codebases and related concepts using the Model Context Protocol.

## Core Tool Implementation

The following tools, based on the features outlined in `docs/feature-goals.md`, need to be implemented. Clear input validation and informative error handling adhering to MCP standards are crucial for each.

**Crucial Aspect:** Each tool handler *must* return data in the format expected by the `@modelcontextprotocol/sdk`, which is an object containing a `content` array. Items in this array can be `{ type: 'text', text: '...' }`, `{ type: 'json', json: {...} }`, etc. Conformance is vital to avoid client-side errors. Error conditions should also return this structure, often with a text message describing the error, and potentially setting an `isError: true` flag if the SDK supports it in the result.

### 1. Entity Management

*   **`create_entity`**
    *   **Inputs:** `project_id: string` (Context), `name: string`, `type: string`, `description: string = ''`, `observations: string[] = []` (Optional initial observations), `parentId: string | null = null` (Optional parent entity ID)
    *   **Output (Success):** `{ content: [{ type: 'json', json: { entity: { id: string, name: string, type: string, description: string, parentId: string | null, /* other relevant fields */ } } }] }`
    *   **Output (Error):** `{ content: [{ type: 'text', text: 'Error: ...' }] }`
    *   **Logic:** Generate unique entity ID, validate inputs (e.g., check if parentId exists if provided), insert into KuzuDB for the given `project_id`. Handle potential name/type uniqueness constraints if desired.
*   **`get_entity`**
    *   **Inputs:** `project_id: string`, `entity_id: string`
    *   **Output (Success):** `{ content: [{ type: 'json', json: { entity: { id: string, name: string, type: string, description: string, parentId: string | null, observations: { id: string, text: string }[] /* potentially add relationships here too */ } } }] }`
    *   **Output (Error):** `{ content: [{ type: 'text', text: 'Error: Entity {entity_id} not found.' }] }`
    *   **Logic:** Query KuzuDB by `entity_id` within the `project_id`, retrieve entity details and its associated observations.
*   **`list_entities`**
    *   **Inputs:** `project_id: string`, `type: string | null = null`, `name_contains: string | null = null`, `limit: number = 50`
    *   **Output:** `{ content: [{ type: 'json', json: { entities: [{ id: string, name: string, type: string }] } }] }`
    *   **Logic:** Query KuzuDB entities table for the `project_id` with optional filters for `type` and partial `name` matching. Apply limit.
*   **`update_entity_description`**
    *   **Inputs:** `project_id: string`, `entity_id: string`, `description: string`
    *   **Output (Success):** `{ content: [{ type: 'text', text: 'Entity description updated successfully.' }] }`
    *   **Output (Error):** `{ content: [{ type: 'text', text: 'Error: Entity {entity_id} not found.' }] }`
    *   **Logic:** Find entity by `entity_id` within `project_id` and update its description field in KuzuDB.
*   **`delete_entity`**
    *   **Inputs:** `project_id: string`, `entity_id: string`
    *   **Output (Success):** `{ content: [{ type: 'text', text: 'Entity, its observations, and related relationships deleted.' }] }`
    *   **Output (Error):** `{ content: [{ type: 'text', text: 'Error: Entity {entity_id} not found.' }] }`
    *   **Logic:** Delete the entity node, its associated observations, and *all* its incoming/outgoing relationships from KuzuDB for the given `project_id`.

### 2. Relationship Management

*   **`create_relationship`**
    *   **Inputs:** `project_id: string`, `source_id: string`, `target_id: string`, `type: string`, `description: string = ''`
    *   **Output (Success):** `{ content: [{ type: 'json', json: { relationship: { id: string, source_id: string, target_id: string, type: string, description: string } } }] }`
    *   **Output (Error):** `{ content: [{ type: 'text', text: 'Error: Source or Target entity not found.' }] }`
    *   **Logic:** Validate `source_id` and `target_id` exist within `project_id`, generate unique relationship ID, insert relationship edge into KuzuDB.
*   **`get_relationships`**
    *   **Inputs:** `project_id: string`, `entity_id: string`, `relationship_type: string | null = null`, `direction: 'incoming' | 'outgoing' | 'both' = 'both'`, `limit: number = 50`
    *   **Output:** `{ content: [{ type: 'json', json: { relationships: [{ id: string, source_id: string, target_id: string, type: string, description: string }] } }] }`
    *   **Logic:** Query KuzuDB relationships table connected to `entity_id` within `project_id`, applying filters for type and direction.
*   **`get_related_entities`**
    *   **Inputs:** `project_id: string`, `entity_id: string`, `relationship_type: string | null = null`, `direction: 'incoming' | 'outgoing' | 'both' = 'both'`, `limit: number = 50`
    *   **Output:** `{ content: [{ type: 'json', json: { related_entities: [{ entity: { id: string, name: string, type: string }, relationship: { id: string, type: string, direction: 'incoming' | 'outgoing' } }] } }] }`
    *   **Logic:** Perform graph traversal query from `entity_id` within `project_id` based on filters. Return the connected entities and details about the relationship connecting them.
*   **`delete_relationship`**
    *   **Inputs:** `project_id: string`, `relationship_id: string`
    *   **Output (Success):** `{ content: [{ type: 'text', text: 'Relationship deleted.' }] }`
    *   **Output (Error):** `{ content: [{ type: 'text', text: 'Error: Relationship {relationship_id} not found.' }] }`
    *   **Logic:** Delete the specific relationship edge by its ID within the `project_id` from KuzuDB.

### 3. Observation Management

*   **`add_observation`**
    *   **Inputs:** `project_id: string`, `entity_id: string`, `observation: string`
    *   **Output (Success):** `{ content: [{ type: 'json', json: { observation: { id: string, text: string } } }] }` (Returning the created observation with its ID)
    *   **Output (Error):** `{ content: [{ type: 'text', text: 'Error: Entity {entity_id} not found.' }] }`
    *   **Logic:** Find entity by `entity_id` within `project_id`. Add the observation, potentially as a separate node related to the entity or as structured data within the entity node itself in KuzuDB. Generate unique observation ID.
*   **`delete_observation`**
    *   **Inputs:** `project_id: string`, `entity_id: string`, `observation_id: string`
    *   **Output (Success):** `{ content: [{ type: 'text', text: 'Observation deleted.' }] }`
    *   **Output (Error):** `{ content: [{ type: 'text', text: 'Error: Observation {observation_id} not found or does not belong to entity {entity_id}.' }] }`
    *   **Logic:** Find and remove the specific observation identified by `observation_id` associated with `entity_id` within `project_id`.

## Pre-packaged Prompts / Usage Examples (for AI Client)

These demonstrate how an AI might interact with the tools (assuming `project_id = 'proj_123'`):

*   **Creating an entity:** "Create a 'file' entity named 'src/utils.ts' under project 'proj_123'."
    *   *Expected Tool Call:* `create_entity(project_id='proj_123', name='src/utils.ts', type='file')`
*   **Linking entities:** "In project 'proj_123', create an 'imports' relationship from entity 'file_abc' to entity 'func_xyz'."
    *   *Expected Tool Call:* `create_relationship(project_id='proj_123', source_id='file_abc', target_id='func_xyz', type='imports')`
*   **Adding details:** "For entity 'func_xyz' in project 'proj_123', add the observation: 'Handles date formatting using moment.js'."
    *   *Expected Tool Call:* `add_observation(project_id='proj_123', entity_id='func_xyz', observation='Handles date formatting using moment.js')`
*   **Querying:** "In project 'proj_123', what functions does entity 'file_abc' contain?"
    *   *Expected Tool Call:* `get_related_entities(project_id='proj_123', entity_id='file_abc', relationship_type='contains', direction='outgoing')` (Assuming 'contains' relationship type)
*   **Listing:** "List all 'class' entities in project 'proj_123'."
    *   *Expected Tool Call:* `list_entities(project_id='proj_123', type='class')`

## Crucial Aspects for MCP Server Usefulness

1.  **Clear Tool Definition:** Provide comprehensive documentation (like this plan and potentially generated API docs) detailing each tool's purpose, parameters (name, type, required/optional), and expected return format.
2.  **Consistent Return Structure:** *Strictly* adhere to the MCP SDK's expected return format (`{ content: [...] }`) for both success and error cases. This is critical for client compatibility.
3.  **Robust Input Validation:** Validate all incoming parameters (type, format, existence of IDs within the correct `project_id`). Return clear, actionable error messages within the standard MCP structure.
4.  **Project Context:** Ensure all operations correctly scope data to the provided `project_id`.
5.  **State Management & Persistence:** The graph database **KuzuDB** is responsible for managing the state of the knowledge graph. Ensure database connections are handled correctly (e.g., initialized per project) and that data persists across server restarts.
6.  **Error Handling & Logging:** Implement comprehensive server-side logging (e.g., using a library like Winston or Pino) to aid debugging. Return user/AI-friendly errors via the MCP structure.
7.  **Security:** As this is likely a local development tool, security might be less critical initially. However, if exposed, proper authentication/authorization would be necessary. Input sanitization is always recommended.

By focusing on these implementation details, particularly consistent return structures, clear definitions, and robust data handling per project, the Knowledge Graph MCP server can become a reliable and valuable tool.
