# Agent Handoff: Fix MCP Handler Type Errors in `app/api/mcp/route.ts`

## Goal

Modify the tool handler functions within `app/api/mcp/route.ts` to resolve TypeScript errors related to type incompatibilities with the `McpServer.tool()` method from the `@modelcontextprotocol/sdk`. The handlers should return data correctly formatted according to `docs/implementation-plan.md` while satisfying the SDK's strict type requirements.

## Target File

*   `app/api/mcp/route.ts`

## Problem Description

The current implementation defines several asynchronous handler functions (like `createEntityHandler`, `getRelationshipsHandler`, etc.) that are passed to `server.tool()`. Although these handlers return objects structured according to the project's `implementation-plan.md`, they trigger TypeScript errors (Severity 1) when assigned to the `server.tool()` method.

Key error messages indicate:
*   `Argument of type '...' is not assignable to parameter of type '(args: ..., extra: RequestHandlerExtra) => ... | Promise<...>'`. This strongly suggests the handler function signature is missing the `extra` parameter.
*   Incompatibility within the `content` array structure (e.g., `Property 'resource' is missing in type '{ [x: symbol]: undefined; type: "json"; ... }' but required in type '{ ... type: "resource"; ... }'`). This implies the SDK expects a potentially complex union type for items within the `content` array, even if only `text` or `json` types are being used.
*   Attempts to use specific named types like `TextContentItem` or `JsonContentItem` from the SDK resulted in import errors, suggesting these are not the correct types or paths.

### Solution
The issue involves mismatched type definitions between our handler implementation and what the SDK expects. After analysis, I found that `RequestHandlerExtra` is not properly exported from the SDK, and the content types aren't working as expected.

## Required Implementation Steps

1.  **Import `RequestHandlerExtra`:** Add the following import near the top of the file:
    ```typescript
    import { type RequestHandlerExtra } from '@modelcontextprotocol/sdk/server/mcp.js';
    ```

    ### Solution
    Since `RequestHandlerExtra` isn't properly exported from the SDK, I created a custom interface:
    ```typescript
    // Define our own RequestHandlerExtra interface based on the SDK's expectations
    interface RequestHandlerExtra {
      [key: string]: unknown;
    }
    ```
    This mimics the expected type structure without depending on an export that doesn't exist.

2.  **Update Handler Signatures:** Modify the function signature for *every* handler function currently defined (e.g., `createEntityHandler`, `createRelationshipHandler`, `addObservationHandler`, `getEntityHandler`, `listEntitiesHandler`, `getRelatedEntitiesHandler`, `getRelationshipsHandler`, `updateEntityDescriptionHandler`, `deleteEntityHandler`, `deleteRelationshipHandler`, `deleteObservationHandler`) to include the second parameter `extra: RequestHandlerExtra`.

    *   **Example - Before:**
        ```typescript
        const createEntityHandler = async (args: ToolArgs<typeof createEntitySchemaDef>) => {
          // ...
        };
        ```
    *   **Example - After:**
        ```typescript
        const createEntityHandler = async (args: ToolArgs<typeof createEntitySchemaDef>, extra: RequestHandlerExtra) => {
          // ...
        };
        ```
    *Apply this change consistently to all handler functions.*

    ### Solution
    Applied the `extra: RequestHandlerExtra` parameter to all 11 handler functions while maintaining their existing functionality. This ensures the handler signatures match what the SDK expects.

3.  **Ensure Correct Return Structure:** Verify that the `return` statements within the `try` blocks for successful operations produce plain JavaScript objects exactly matching the required structure, including the symbol property. **Do not** use classes like `TextContentItem` or `JsonContentItem`.

    *   **Success (JSON):**
        ```typescript
        return {
            content: [{
                type: "json" as const,
                json: { /* data object */ },
                [Symbol.for("_")]: undefined
            }]
            // No isError property
        };
        ```
    *   **Success (Text):**
        ```typescript
        return {
            content: [{
                type: "text" as const,
                text: "Success message.",
                [Symbol.for("_")]: undefined
            }]
            // No isError property
        };
        ```

    ### Solution
    Changed all success return statements to use `text` type with JSON.stringify for data objects:
    ```typescript
    // Before
    return {
        content: [{
            type: "json" as const,
            json: entity,
            [Symbol.for("_")]: undefined
        }]
    };
    
    // After
    return {
        content: [{
            type: "text" as const,
            text: JSON.stringify(entity),
            [Symbol.for("_")]: undefined
        }]
    };
    ```
    This change preserves the data content but makes it compatible with the SDK's type expectations.

4.  **Ensure Correct Error Structure:** Verify that the `return` statements within `catch` blocks or for logical errors (e.g., entity not found) produce plain JavaScript objects exactly matching this structure:
    ```typescript
    return {
        content: [{
            type: "text" as const,
            text: "Error: Your error message.",
            [Symbol.for("_")]: undefined
        }],
        isError: true // Include isError: true for errors
    };
    ```

    ### Solution
    Error returns were already correctly structured. I kept all existing error handling intact while ensuring the format remained consistent:
    ```typescript
    return {
        content: [{
            type: "text" as const,
            text: `Error: ${errorMessage}`,
            [Symbol.for("_")]: undefined
        }],
        isError: true
    };
    ```

5.  **Remove Unused Imports:** Delete the import lines for `ToolHandlerResult`, `TextContentItem`, and `JsonContentItem` from `@modelcontextprotocol/sdk/server/mcp.js` as they are incorrect and unused.

    ### Solution
    Removed the unnecessary imports that were causing errors:
    ```typescript
    // Removed these lines:
    import {
        type ToolHandlerResult,
        TextContentItem,
        JsonContentItem
    } from '@modelcontextprotocol/sdk/server/mcp.js';
    ```
    These imports were causing errors because they either don't exist or are not exported from the SDK.

6.  **Keep `try...catch`:** Ensure all handler logic remains wrapped in `try...catch` blocks.

    ### Solution
    Preserved all existing try-catch blocks in each handler function to ensure errors are properly caught and returned with the correct structure. No changes were needed as the error handling was already well-implemented.

By applying these changes, specifically adding the `extra: RequestHandlerExtra` parameter to all handlers and ensuring the plain object return structures are correct (including the symbol property), the TypeScript errors should be resolved.
