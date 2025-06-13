/**
 * Session Management for MCP Knowledge Graph Server
 * Provides forced initialization and context tracking similar to ingpoc/Claude
 */

import { promises as fs } from "fs";
import path from "path";
import { randomUUID } from "crypto";

export interface SessionData {
  id: string;
  projectId: string;
  clientInfo: {
    name: string;
    version: string;
  };
  contextEntities: string[];
  lastAccessed: Date;
  createdAt: Date;
  metadata?: Record<string, any>;
}

export class SessionManager {
  private sessions = new Map<string, SessionData>();
  private sessionsDir: string;
  private sessionTimeout: number; // milliseconds

  constructor(sessionsDir: string = ".mcp-sessions", timeoutHours: number = 24) {
    this.sessionsDir = sessionsDir;
    this.sessionTimeout = timeoutHours * 60 * 60 * 1000;
    this.ensureSessionsDir();
    this.loadPersistedSessions();
    this.startCleanupTimer();
  }

  /**
   * Create a new session with project context
   */
  createSession(projectId: string = 'default', clientInfo?: any): string {
    const sessionId = randomUUID();
    const sessionData: SessionData = {
      id: sessionId,
      projectId,
      clientInfo: clientInfo || { name: 'unknown', version: 'unknown' },
      contextEntities: [],
      lastAccessed: new Date(),
      createdAt: new Date(),
      metadata: {}
    };

    this.sessions.set(sessionId, sessionData);
    this.persistSession(sessionData);
    
    console.error(`🔌 Created session ${sessionId} for project ${projectId}`);
    return sessionId;
  }

  /**
   * Get session data by ID
   */
  getSession(sessionId: string): SessionData | null {
    const session = this.sessions.get(sessionId);
    if (session) {
      session.lastAccessed = new Date();
      this.persistSession(session);
    }
    return session || null;
  }

  /**
   * Check if session exists and is valid
   */
  isValidSession(sessionId: string): boolean {
    const session = this.sessions.get(sessionId);
    if (!session) return false;
    
    const now = Date.now();
    const isExpired = now - session.lastAccessed.getTime() > this.sessionTimeout;
    
    if (isExpired) {
      this.destroySession(sessionId);
      return false;
    }
    
    return true;
  }

  /**
   * Update session with entity context
   */
  addEntityToContext(sessionId: string, entityId: string): void {
    const session = this.sessions.get(sessionId);
    if (session) {
      if (!session.contextEntities.includes(entityId)) {
        session.contextEntities.push(entityId);
        session.lastAccessed = new Date();
        this.persistSession(session);
      }
    }
  }

  /**
   * Get all active sessions
   */
  getActiveSessions(): SessionData[] {
    return Array.from(this.sessions.values());
  }

  /**
   * Destroy a specific session
   */
  destroySession(sessionId: string): void {
    this.sessions.delete(sessionId);
    this.deletePersistedSession(sessionId);
    console.error(`🗑️ Destroyed session ${sessionId}`);
  }

  /**
   * Clean up expired sessions
   */
  cleanupExpiredSessions(): number {
    const now = Date.now();
    let cleanedCount = 0;

    for (const [sessionId, session] of this.sessions.entries()) {
      const isExpired = now - session.lastAccessed.getTime() > this.sessionTimeout;
      if (isExpired) {
        this.destroySession(sessionId);
        cleanedCount++;
      }
    }

    if (cleanedCount > 0) {
      console.error(`🧹 Cleaned up ${cleanedCount} expired sessions`);
    }

    return cleanedCount;
  }

  /**
   * Get session statistics
   */
  getStats(): { active: number; totalCreated: number; avgLifetime: number } {
    const active = this.sessions.size;
    const now = Date.now();
    
    let totalLifetime = 0;
    let totalCreated = 0;
    
    for (const session of this.sessions.values()) {
      totalCreated++;
      totalLifetime += now - session.createdAt.getTime();
    }
    
    const avgLifetime = totalCreated > 0 ? totalLifetime / totalCreated : 0;
    
    return {
      active,
      totalCreated,
      avgLifetime: Math.round(avgLifetime / 1000 / 60) // minutes
    };
  }

  // Private methods

  private async ensureSessionsDir(): Promise<void> {
    try {
      await fs.mkdir(this.sessionsDir, { recursive: true });
    } catch {
      // ignore
    }
  }

  private async persistSession(session: SessionData): Promise<void> {
    try {
      const filePath = path.join(this.sessionsDir, `${session.id}.json`);
      await fs.writeFile(filePath, JSON.stringify(session, null, 2));
    } catch (error) {
      console.error(`Failed to persist session ${session.id}:`, error);
    }
  }

  private async deletePersistedSession(sessionId: string): Promise<void> {
    try {
      const filePath = path.join(this.sessionsDir, `${sessionId}.json`);
      await fs.unlink(filePath);
    } catch {
      // ignore - file might not exist
    }
  }

  private async loadPersistedSessions(): Promise<void> {
    try {
      const files = await fs.readdir(this.sessionsDir);
      const jsonFiles = files.filter(f => f.endsWith('.json'));
      
      for (const file of jsonFiles) {
        try {
          const filePath = path.join(this.sessionsDir, file);
          const content = await fs.readFile(filePath, 'utf8');
          const session = JSON.parse(content) as SessionData;
          
          // Convert date strings back to Date objects
          session.lastAccessed = new Date(session.lastAccessed);
          session.createdAt = new Date(session.createdAt);
          
          // Only restore if not expired
          const now = Date.now();
          const isExpired = now - session.lastAccessed.getTime() > this.sessionTimeout;
          
          if (!isExpired) {
            this.sessions.set(session.id, session);
          } else {
            await fs.unlink(filePath); // Clean up expired persisted session
          }
        } catch (error) {
          console.error(`Failed to load session from ${file}:`, error);
        }
      }
      
      console.error(`📂 Loaded ${this.sessions.size} persisted sessions`);
    } catch {
      // Directory doesn't exist yet, ignore
    }
  }

  private startCleanupTimer(): void {
    // Clean up every hour
    setInterval(() => {
      this.cleanupExpiredSessions();
    }, 60 * 60 * 1000);
  }
}