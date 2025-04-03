// Basic type declaration for the 'kuzu' module to satisfy TypeScript
// This doesn't provide full type safety for the library's methods.

declare module 'kuzu' {
    // Define the classes based on the library's usage
    export class Database {
        constructor(path: string, systemConfig?: Record<string, any>);
        // Add other methods if needed, e.g., close()
    }

    export class Connection {
        constructor(database: Database, config?: Record<string, any>);
        query(query: string, params?: Record<string, any>): Promise<QueryResult>;
        // Add other methods like prepare, execute, etc., if needed
    }

    export class QueryResult {
        // Add the getAll method signature
        getAll(): Promise<Record<string, any>[]>; // Returns an array of result objects
        // Keep previous methods if needed, or refine types further
        // Define methods based on observed usage
        next(): Promise<Record<string, any> | null>; // Simplified return type
        getValue(columnName: string): any; // Simplified return type
        // Add other methods like close, getColumnNames, etc., if needed
    }

    // Add any other exports if necessary
} 