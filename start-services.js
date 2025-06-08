#!/usr/bin/env node

/**
 * Unified Startup Script for MCP Knowledge Graph
 * 
 * This script starts both the Python backend service and Next.js frontend,
 * allowing MCP clients to connect to already-running services.
 * 
 * Usage: npm run start-services
 */

import { spawn } from 'child_process';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

class ServiceManager {
  constructor() {
    this.processes = [];
    this.isShuttingDown = false;
    
    // Handle graceful shutdown
    process.on('SIGINT', () => this.gracefulShutdown());
    process.on('SIGTERM', () => this.gracefulShutdown());
    process.on('exit', () => this.cleanup());
  }

  log(service, message, type = 'info') {
    const timestamp = new Date().toLocaleTimeString();
    const colors = {
      info: '\x1b[36m',    // Cyan
      success: '\x1b[32m', // Green
      error: '\x1b[31m',   // Red
      warn: '\x1b[33m'     // Yellow
    };
    const reset = '\x1b[0m';
    
    console.log(`${colors[type]}[${timestamp}] ${service}: ${message}${reset}`);
  }

  async checkPort(port, host = 'localhost') {
    return new Promise(async (resolve) => {
      const { default: net } = await import('net');
      const socket = new net.Socket();
      
      socket.setTimeout(1000);
      socket.on('connect', () => {
        socket.destroy();
        resolve(true);
      });
      
      socket.on('timeout', () => {
        socket.destroy();
        resolve(false);
      });
      
      socket.on('error', () => {
        resolve(false);
      });
      
      socket.connect(port, host);
    });
  }

  async waitForService(port, serviceName, maxWait = 30000) {
    const startTime = Date.now();
    
    while (Date.now() - startTime < maxWait) {
      if (await this.checkPort(port)) {
        this.log(serviceName, `Service ready on port ${port}`, 'success');
        return true;
      }
      await new Promise(resolve => setTimeout(resolve, 1000));
      this.log(serviceName, `Waiting for service on port ${port}...`, 'info');
    }
    
    throw new Error(`${serviceName} failed to start within ${maxWait}ms`);
  }

  spawnProcess(command, args, options, serviceName) {
    const proc = spawn(command, args, {
      stdio: ['ignore', 'pipe', 'pipe'],
      ...options
    });

    proc.stdout.on('data', (data) => {
      const lines = data.toString().split('\n').filter(line => line.trim());
      lines.forEach(line => this.log(serviceName, line, 'info'));
    });

    proc.stderr.on('data', (data) => {
      const lines = data.toString().split('\n').filter(line => line.trim());
      lines.forEach(line => {
        if (line.includes('WARNING') || line.includes('warning')) {
          this.log(serviceName, line, 'warn');
        } else {
          this.log(serviceName, line, 'error');
        }
      });
    });

    proc.on('close', (code) => {
      if (!this.isShuttingDown) {
        if (code === 0) {
          this.log(serviceName, 'Process exited successfully', 'success');
        } else {
          this.log(serviceName, `Process exited with code ${code}`, 'error');
        }
      }
    });

    proc.on('error', (error) => {
      this.log(serviceName, `Process error: ${error.message}`, 'error');
    });

    this.processes.push({ proc, serviceName });
    return proc;
  }

  async startPythonService() {
    this.log('Python', 'Checking if Python service is already running...', 'info');
    
    if (await this.checkPort(8000)) {
      this.log('Python', 'Service already running on port 8000', 'warn');
      return true;
    }

    this.log('Python', 'Starting Memvid service...', 'info');
    
    // Check if Python service file exists
    const pythonServicePath = path.join(__dirname, 'python-service', 'python_memvid_service.py');
    if (!fs.existsSync(pythonServicePath)) {
      throw new Error(`Python service not found at ${pythonServicePath}`);
    }

    // Start Python service
    const pythonProc = this.spawnProcess(
      'python',
      [pythonServicePath],
      { 
        cwd: path.join(__dirname, 'python-service'),
        env: { 
          ...process.env,
          PYTHONUNBUFFERED: '1',
          HOST: '127.0.0.1',
          PORT: '8000'
        }
      },
      'Python'
    );

    // Wait for service to be ready
    await this.waitForService(8000, 'Python Service', 15000);
    return true;
  }

  async startFrontend() {
    this.log('Frontend', 'Checking if frontend is already running...', 'info');
    
    if (await this.checkPort(3000)) {
      this.log('Frontend', 'Service already running on port 3000', 'warn');
      return true;
    }

    this.log('Frontend', 'Starting Next.js development server...', 'info');

    // Build first if needed
    if (!fs.existsSync(path.join(__dirname, '.next'))) {
      this.log('Frontend', 'Building Next.js application...', 'info');
      const buildProc = this.spawnProcess('npm', ['run', 'build'], { cwd: __dirname }, 'Frontend Build');
      
      await new Promise((resolve, reject) => {
        buildProc.on('close', (code) => {
          if (code === 0) {
            resolve();
          } else {
            reject(new Error(`Build failed with code ${code}`));
          }
        });
      });
    }

    // Start frontend
    const frontendProc = this.spawnProcess(
      'npm',
      ['run', 'dev'],
      { 
        cwd: __dirname,
        env: { 
          ...process.env,
          PORT: '3000'
        }
      },
      'Frontend'
    );

    // Wait for frontend to be ready
    await this.waitForService(3000, 'Frontend Service', 20000);
    return true;
  }

  async gracefulShutdown() {
    if (this.isShuttingDown) return;
    this.isShuttingDown = true;

    this.log('System', 'Shutting down services...', 'warn');
    
    for (const { proc, serviceName } of this.processes) {
      if (!proc.killed) {
        this.log(serviceName, 'Stopping process...', 'warn');
        proc.kill('SIGTERM');
        
        // Force kill after 5 seconds
        setTimeout(() => {
          if (!proc.killed) {
            this.log(serviceName, 'Force killing process...', 'error');
            proc.kill('SIGKILL');
          }
        }, 5000);
      }
    }

    setTimeout(() => {
      this.log('System', 'All services stopped', 'success');
      process.exit(0);
    }, 1000);
  }

  cleanup() {
    // Ensure all processes are killed
    for (const { proc } of this.processes) {
      if (!proc.killed) {
        proc.kill('SIGKILL');
      }
    }
  }

  async start() {
    try {
      this.log('System', '🚀 Starting MCP Knowledge Graph Services', 'success');
      this.log('System', '═══════════════════════════════════════', 'info');

      // Start Python backend
      this.log('System', '📊 Step 1: Starting Python Backend Service', 'info');
      await this.startPythonService();
      
      // Start frontend
      this.log('System', '🌐 Step 2: Starting Next.js Frontend', 'info');
      await this.startFrontend();

      this.log('System', '═══════════════════════════════════════', 'success');
      this.log('System', '✅ All services started successfully!', 'success');
      this.log('System', '', 'info');
      this.log('System', '🔗 Services:', 'info');
      this.log('System', '   • Frontend Dashboard: http://localhost:3000', 'info');
      this.log('System', '   • Python API Service: http://localhost:8000', 'info');
      this.log('System', '   • API Documentation: http://localhost:8000/docs', 'info');
      this.log('System', '', 'info');
      this.log('System', '📋 MCP Configuration:', 'info');
      this.log('System', '   • MCP Server Path: ./dist/src/server/mcp-host-simple.js', 'info');
      this.log('System', '   • Build MCP Server: npm run build:server', 'info');
      this.log('System', '', 'info');
      this.log('System', '🛑 Press Ctrl+C to stop all services', 'warn');
      this.log('System', '═══════════════════════════════════════', 'info');

      // Keep the process alive
      await new Promise(() => {});
      
    } catch (error) {
      this.log('System', `Startup failed: ${error.message}`, 'error');
      await this.gracefulShutdown();
      process.exit(1);
    }
  }
}

// Start services
const manager = new ServiceManager();
manager.start().catch(console.error);