// Type declaration for the 'kuzu' module based on KuzuDB 0.9.0 API documentation

declare module 'kuzu' {
    export class Database {
        constructor(path: string, systemConfig?: Record<string, any>);
        close(): void;
    }

    export class Connection {
        constructor(database: Database, config?: Record<string, any>);
        query(query: string, params?: Record<string, any>): Promise<QueryResult>;
        prepare(query: string): Promise<PreparedStatement>;
        execute(statement: PreparedStatement, params?: Record<string, any>): Promise<QueryResult>;
    }

    export class QueryResult {
        // Async methods
        getNext(): Promise<Record<string, any> | null>;
        getAll(): Promise<Record<string, any>[]>;
        getColumnNames(): Promise<string[]>;
        getColumnDataTypes(): Promise<string[]>;
        
        // Sync methods
        hasNext(): boolean;
        getNextSync(): Record<string, any> | null;
        getAllSync(): Record<string, any>[];
        getColumnNamesSync(): string[];
        getColumnDataTypesSync(): string[];
        getNumTuples(): number;
        
        // Utility methods
        resetIterator(): void;
        close(): void;
        
        // Callback-based methods
        each(resultCallback: (row: Record<string, any>) => void, 
             doneCallback: () => void, 
             errorCallback: (error: Error) => void): void;
        all(resultCallback: (rows: Record<string, any>[]) => void, 
            errorCallback: (error: Error) => void): void;
    }

    export class PreparedStatement {
        // Add prepared statement methods if needed
    }
} 