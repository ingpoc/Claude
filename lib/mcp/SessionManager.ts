import { NextJsSSETransport } from './transport/NextJsSSETransport';

// Session data structure
export interface SessionData {
  projectId?: string;
  [key: string]: unknown;
}

/**
 * Manages MCP server sessions and associated transports
 */
export class SessionManager {
  private sessions: Record<string, SessionData> = {};
  private transports: Record<string, NextJsSSETransport> = {};

  /**
   * Get the current project ID for a session
   */
  getProjectIdForSession(sessionId?: string): string | null {
    if (!sessionId) return null;
    return this.sessions[sessionId]?.projectId || null;
  }

  /**
   * Set the current project ID for a session
   */
  setProjectIdForSession(sessionId: string, projectId: string): void {
    if (!this.sessions[sessionId]) {
      this.sessions[sessionId] = {};
    }
    this.sessions[sessionId].projectId = projectId;
  }

  /**
   * Validate project ID in session
   */
  validateProjectId(sessionId?: string): { valid: boolean; error?: string; projectId?: string } {
    const projectId = this.getProjectIdForSession(sessionId);
    if (!projectId) {
      return { 
        valid: false, 
        error: "No project selected. Use 'select_project' or 'create_project' first."
      };
    }
    return { valid: true, projectId };
  }

  /**
   * Register a transport for a session
   */
  registerTransport(sessionId: string, transport: NextJsSSETransport): void {
    this.transports[sessionId] = transport;
    if (!this.sessions[sessionId]) {
      this.sessions[sessionId] = {};
    }
  }

  /**
   * Get a transport by session ID
   */
  getTransport(sessionId: string): NextJsSSETransport | undefined {
    return this.transports[sessionId];
  }

  /**
   * Get all transports
   */
  getAllTransports(): Record<string, NextJsSSETransport> {
    return this.transports;
  }

  /**
   * Remove a session and its transport
   */
  removeSession(sessionId: string): void {
    delete this.transports[sessionId];
    delete this.sessions[sessionId];
  }

  /**
   * Set custom session data
   */
  setSessionData(sessionId: string, key: string, value: unknown): void {
    if (!this.sessions[sessionId]) {
      this.sessions[sessionId] = {};
    }
    this.sessions[sessionId][key] = value;
  }

  /**
   * Get custom session data
   */
  getSessionData(sessionId: string, key: string): unknown {
    return this.sessions[sessionId]?.[key];
  }
} 