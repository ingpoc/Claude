import { z } from 'zod';
import { v4 as uuidv4 } from 'uuid';

export interface Session {
  id: string;
  projectId: string;
  contextEntityIds: string[];
  metadata: Record<string, any>;
  createdAt: Date;
  lastAccessedAt: Date;
}

export class SessionManager {
  private sessions: Map<string, Session> = new Map();
  private defaultProjectId: string | null = null;
  
  createSession(projectId?: string): Session {
    const session: Session = {
      id: uuidv4(),
      projectId: projectId || this.defaultProjectId || 'default',
      contextEntityIds: [],
      metadata: {},
      createdAt: new Date(),
      lastAccessedAt: new Date()
    };
    
    this.sessions.set(session.id, session);
    return session;
  }
  
  getSession(sessionId: string): Session | undefined {
    const session = this.sessions.get(sessionId);
    if (session) {
      session.lastAccessedAt = new Date();
    }
    return session;
  }
  
  updateSession(sessionId: string, updates: Partial<Session>): Session | undefined {
    const session = this.sessions.get(sessionId);
    if (session) {
      Object.assign(session, updates);
      session.lastAccessedAt = new Date();
      return session;
    }
    return undefined;
  }
  
  addContextEntity(sessionId: string, entityId: string): void {
    const session = this.sessions.get(sessionId);
    if (session && !session.contextEntityIds.includes(entityId)) {
      session.contextEntityIds.push(entityId);
      session.lastAccessedAt = new Date();
    }
  }
  
  setDefaultProjectId(projectId: string | null): void {
    this.defaultProjectId = projectId;
  }
  
  getProjectIdForSession(sessionId?: string): string {
    if (sessionId) {
      const session = this.sessions.get(sessionId);
      if (session) {
        return session.projectId;
      }
    }
    return this.defaultProjectId || 'default';
  }
  
  deleteSession(sessionId: string): boolean {
    return this.sessions.delete(sessionId);
  }
  
  getAllSessions(): Session[] {
    return Array.from(this.sessions.values());
  }
  
  cleanupInactiveSessions(maxAgeMs: number = 24 * 60 * 60 * 1000): number {
    const now = Date.now();
    let cleaned = 0;
    
    for (const [id, session] of this.sessions.entries()) {
      if (now - session.lastAccessedAt.getTime() > maxAgeMs) {
        this.sessions.delete(id);
        cleaned++;
      }
    }
    
    return cleaned;
  }
}
