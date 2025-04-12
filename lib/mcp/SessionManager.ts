import { NextJsSSETransport } from './transport/NextJsSSETransport';

// Define a default session ID for contexts without explicit session management (e.g., stdio)
const DEFAULT_STDIO_SESSION_ID = 'default_stdio_session';

// Session data structure - Added projectVersion
export interface SessionData {
  projectId?: string;
  projectVersion?: string; // Added to store context version
  [key: string]: unknown;
}

/**
 * Manages MCP server sessions and associated transports
 */
export class SessionManager {
  private sessions: Record<string, SessionData> = {};
  private transports: Record<string, NextJsSSETransport> = {};

  // Helper to get the effective session ID
  private getEffectiveSessionId(sessionId?: string): string {
      return sessionId || DEFAULT_STDIO_SESSION_ID;
  }

  /**
   * Get the current project ID for a session
   * @deprecated Consider using getActiveProjectContext
   */
  getProjectIdForSession(sessionId?: string): string | null {
    const effectiveSessionId = this.getEffectiveSessionId(sessionId);
    return this.sessions[effectiveSessionId]?.projectId || null;
  }

  /**
   * Set the current project ID for a session
   * @deprecated Consider using setActiveProjectContext
   */
  setProjectIdForSession(sessionId: string, projectId: string): void {
    const effectiveSessionId = this.getEffectiveSessionId(sessionId);
    if (!this.sessions[effectiveSessionId]) {
      this.sessions[effectiveSessionId] = {};
    }
    this.sessions[effectiveSessionId].projectId = projectId;
    // Note: This doesn't set the version. Use setActiveProjectContext for that.
  }

  // --- New Methods for Project Context --- 

  /**
   * Sets the active project context (ID and version) for a session.
   * Uses a default ID if none is provided (for stdio).
   */
  setActiveProjectContext(sessionId: string | undefined, projectId: string, version: string): void {
      const effectiveSessionId = this.getEffectiveSessionId(sessionId);
      if (!this.sessions[effectiveSessionId]) {
          this.sessions[effectiveSessionId] = {};
      }
      this.sessions[effectiveSessionId].projectId = projectId;
      this.sessions[effectiveSessionId].projectVersion = version;
      console.error(`[SessionManager] Set active context for session '${effectiveSessionId}': ProjectID=${projectId}, Version=${version}`);
  }

  /**
   * Gets the active project context (ID and version) for a session.
   * Uses a default ID if none is provided.
   */
  getActiveProjectContext(sessionId: string | undefined): { projectId: string; version: string } | null {
      const effectiveSessionId = this.getEffectiveSessionId(sessionId);
      const session = this.sessions[effectiveSessionId];
      if (session?.projectId && session.projectVersion) {
          return { projectId: session.projectId, version: session.projectVersion };
      }
      return null;
  }

  /**
   * Checks if an active project context (ID and version) exists for the session.
   * Uses a default ID if none is provided.
   */
  hasActiveProjectContext(sessionId: string | undefined): boolean {
      const effectiveSessionId = this.getEffectiveSessionId(sessionId);
      const session = this.sessions[effectiveSessionId];
      // Check for both projectId and projectVersion to confirm context is set
      return !!(session?.projectId && session.projectVersion);
  }

  /**
   * Clears the active project context (ID and version) for a session.
   * Uses a default ID if none is provided.
   */
  clearActiveProjectContext(sessionId: string | undefined): void {
      const effectiveSessionId = this.getEffectiveSessionId(sessionId);
      if (this.sessions[effectiveSessionId]) {
          delete this.sessions[effectiveSessionId].projectId;
          delete this.sessions[effectiveSessionId].projectVersion;
          console.error(`[SessionManager] Cleared active context for session '${effectiveSessionId}'`);
      }
  }

  // --- End of New Methods ---

  /**
   * Validate project ID in session - Updated to use hasActiveProjectContext
   */
  validateProjectId(sessionId?: string): { valid: boolean; error?: string; projectId?: string } {
    // We now check if the full context is set, not just the ID.
    const hasContext = this.hasActiveProjectContext(sessionId);
    if (!hasContext) {
      return { 
        valid: false, 
        // Updated error message to mention init_session
        error: "No project context initialized. Use 'init_session' first."
      };
    }
    // If context exists, get the ID to return it (optional, but might be useful)
    const projectId = this.getProjectIdForSession(sessionId);
    return { valid: true, projectId: projectId || undefined }; // Ensure projectId is string | undefined
  }

  /**
   * Register a transport for a session
   */
  registerTransport(sessionId: string, transport: NextJsSSETransport): void {
    const effectiveSessionId = this.getEffectiveSessionId(sessionId); // Use effective ID
    this.transports[effectiveSessionId] = transport;
    if (!this.sessions[effectiveSessionId]) {
      this.sessions[effectiveSessionId] = {};
    }
  }

  /**
   * Get a transport by session ID
   */
  getTransport(sessionId: string): NextJsSSETransport | undefined {
    const effectiveSessionId = this.getEffectiveSessionId(sessionId); // Use effective ID
    return this.transports[effectiveSessionId];
  }

  /**
   * Get all transports
   */
  getAllTransports(): Record<string, NextJsSSETransport> {
    // This likely remains specific to explicit session IDs from transports
    return this.transports;
  }

  /**
   * Remove a session and its transport
   */
  removeSession(sessionId: string): void {
    const effectiveSessionId = this.getEffectiveSessionId(sessionId); // Use effective ID
    delete this.transports[effectiveSessionId]; // Remove transport if it exists
    delete this.sessions[effectiveSessionId]; // Remove session data
  }

  /**
   * Set custom session data
   */
  setSessionData(sessionId: string, key: string, value: unknown): void {
    const effectiveSessionId = this.getEffectiveSessionId(sessionId); // Use effective ID
    if (!this.sessions[effectiveSessionId]) {
      this.sessions[effectiveSessionId] = {};
    }
    this.sessions[effectiveSessionId][key] = value;
  }

  /**
   * Get custom session data
   */
  getSessionData(sessionId: string, key: string): unknown {
    const effectiveSessionId = this.getEffectiveSessionId(sessionId); // Use effective ID
    return this.sessions[effectiveSessionId]?.[key];
  }
} 