import { Connection } from 'kuzu';
import fs from 'fs';

class KnowledgeGraph {
  private projectId: string;

  constructor(projectId: string) {
    this.projectId = projectId;
  }

  async createEntity(entityData: EntityData) {
    // ... existing setup code ...

    try {
      // ... existing transaction setup ...

      // Add more robust verification with retries
      let verificationPassed = false;
      for (let attempt = 0; attempt < 3; attempt++) {
        await new Promise(resolve => setTimeout(resolve, 100 * (attempt + 1)));
        
        const verifyQuery = await conn.prepare(
          "MATCH (e:Entity {id: $id}) RETURN e.id"
        );
        const verificationResult = await verifyQuery.executeAll({ id: entityId });
        
        if (verificationResult.length > 0) {
          verificationPassed = true;
          break;
        }
      }

      if (!verificationPassed) {
        throw new Error(`Entity verification failed after 3 attempts for ID: ${entityId}`);
      }

      return entityId;
    } catch (error) {
      // ... existing error handling ...
    }
  }

  private async initializeDatabaseDirectory(projectId: string) {
    const dbPath = this.getDatabasePath(projectId);
    if (!fs.existsSync(dbPath)) {
      fs.mkdirSync(dbPath, { recursive: true });
    }
  }

  private async getConnection(): Promise<Connection> {
    await this.initializeDatabaseDirectory(this.projectId);
    // ... rest of existing connection logic ...
  }

  private async initSchema(conn: Connection) {
    // Fix schema creation syntax for KuzuDB
    await conn.query(`
      CREATE NODE TABLE IF NOT EXISTS Entity (
        id STRING PRIMARY KEY,
        name STRING,
        type STRING,
        description STRING,
        observationsJson STRING,
        parentId STRING
      )
    `);
    
    await conn.query(`
      CREATE REL TABLE IF NOT EXISTS Related (
        FROM Entity TO Entity,
        id STRING PRIMARY KEY,
        type STRING,
        description STRING
      )
    `);
  }
} 