/**
 * Optimized backend client with connection pooling and caching
 */

import { cache } from './PerformanceCache.js';

export class BackendClient {
  private baseURL: string;
  private keepAliveAgent: any;

  constructor(baseURL = "http://127.0.0.1:8000") {
    this.baseURL = baseURL;
    
    // Use keep-alive for connection reuse
    if (typeof process !== 'undefined') {
      const http = require('http');
      this.keepAliveAgent = new http.Agent({
        keepAlive: true,
        maxSockets: 10,
        maxFreeSockets: 5,
        timeout: 60000,
        freeSocketTimeout: 30000
      });
    }
  }

  private async request(path: string, options: RequestInit = {}): Promise<any> {
    const url = `${this.baseURL}${path}`;
    
    // Add keep-alive agent for Node.js
    if (this.keepAliveAgent) {
      (options as any).agent = this.keepAliveAgent;
    }

    const response = await fetch(url, {
      headers: {
        'Content-Type': 'application/json',
        'Keep-Alive': 'timeout=60, max=100',
        ...options.headers
      },
      ...options
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    return response.json();
  }

  async get(path: string, cacheKey?: string, cacheTTL?: number): Promise<any> {
    // Check cache first
    if (cacheKey && cache.has(cacheKey)) {
      return cache.get(cacheKey);
    }

    const result = await this.request(path);

    // Cache the result
    if (cacheKey) {
      cache.set(cacheKey, result, cacheTTL);
    }

    return result;
  }

  async post(path: string, data?: any): Promise<any> {
    return this.request(path, {
      method: 'POST',
      body: data ? JSON.stringify(data) : undefined
    });
  }

  async put(path: string, data?: any): Promise<any> {
    return this.request(path, {
      method: 'PUT',
      body: data ? JSON.stringify(data) : undefined
    });
  }

  async delete(path: string): Promise<any> {
    return this.request(path, {
      method: 'DELETE'
    });
  }

  async checkHealth(): Promise<boolean> {
    try {
      const response = await this.get('/health', 'health_check', 10000); // 10s cache
      return response && response.status === 'running';
    } catch {
      return false;
    }
  }

  // Batch operations for better performance
  async batchRequest(requests: Array<{path: string, method?: string, data?: any}>): Promise<any[]> {
    const promises = requests.map(req => {
      const method = req.method || 'GET';
      return method === 'GET' ? this.get(req.path) : this.request(req.path, {
        method,
        body: req.data ? JSON.stringify(req.data) : undefined
      });
    });

    return Promise.all(promises);
  }
}

// Singleton instance
export const backend = new BackendClient();