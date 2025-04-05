#!/usr/bin/env node

const { spawn, execSync } = require('child_process');
const http = require('http');
const net = require('net');
const path = require('path');
const fs = require('fs');

// Constants
const PORT = 3000;
const LOG_FILE = path.join(__dirname, 'mcp-debug.log');
const MCP_API_URL = `http://localhost:${PORT}/api/mcp`;

// Make sure we're running in the correct directory
process.chdir(__dirname);

// Create log file
const logStream = fs.createWriteStream(LOG_FILE, { flags: 'a' });

// Log to both console and file
function log(message, type = 'INFO') {
  const timestamp = new Date().toISOString();
  const formattedMessage = `[${timestamp}] [${type}] ${message}`;
  
  // Log to stderr for visibility in Claude logs
  console.error(formattedMessage);
  
  // Also log to file
  logStream.write(formattedMessage + '\n');
}

// Dynamically try to load MCP modules with error handling
let McpServer, StdioServerTransport;
try {
  log('Loading MCP SDK modules...');
  // Try different import paths
  try {
    const sdk = require('@modelcontextprotocol/sdk');
    McpServer = sdk.McpServer || sdk.server?.McpServer;
    // Attempt to get StdioServerTransport from the main package too
    StdioServerTransport = sdk.StdioServerTransport || sdk.server?.StdioServerTransport;
    if (!StdioServerTransport) {
        log('StdioServerTransport not found in main package, will try direct import.', 'WARNING');
        throw new Error('StdioServerTransport not found in main package'); // Force fallback
    }
    log('Loaded MCP SDK modules from main package');
  } catch (e) {
    // Fallback to direct imports
    log(`Failed to load from main package: ${e.message}, trying direct import...`);
    
    // Try another approach for loading the modules
    try {
      const mcpModule = require('@modelcontextprotocol/sdk/server/mcp.js');
      const stdioModule = require('@modelcontextprotocol/sdk/server/stdio.js');
      McpServer = mcpModule.McpServer;
      // Assign to the outer scope variable
      StdioServerTransport = stdioModule.StdioServerTransport;
      if (!StdioServerTransport) {
          throw new Error('StdioServerTransport not found in direct import');
      }
      log('Loaded MCP SDK modules via direct import');
    } catch (e2) {
      log(`Failed direct import: ${e2.message}, trying manual implementation...`, 'WARNING');
      
      // Manual implementation of basic MCP functionality
      const { EventEmitter } = require('events');
      
      class BasicStdioTransport extends EventEmitter {
        constructor() {
          super();
          this.stdin = process.stdin;
          this.stdout = process.stdout;
          
          // Set up input processing
          this.stdin.setEncoding('utf8');
          this.stdin.on('data', (data) => {
            try {
              // Handle JSON-RPC message
              const message = JSON.parse(data);
              this.emit('message', message);
            } catch (err) {
              log(`Error parsing input: ${err.message}`, 'ERROR');
            }
          });
          
          log('Created basic stdio transport');
        }
        
        async send(message) {
          this.stdout.write(JSON.stringify(message) + '\n');
        }
        
        async start() {
          log('Basic stdio transport started');
          return Promise.resolve();
        }
      }
      
      class BasicMcpServer {
        constructor(options) {
          this.options = options;
          log(`Created basic MCP server: ${options.name} v${options.version}`);
        }
        
        async start(transport) {
          this.transport = transport;
          log('Basic MCP server started');
          return Promise.resolve();
        }
      }
      
      // Use our basic implementations
      McpServer = BasicMcpServer;
      StdioServerTransport = BasicStdioTransport;
      log('Using basic MCP implementation as fallback', 'WARNING');
    }
  }
} catch (e) {
  log(`Failed to load MCP SDK: ${e.message}`, 'ERROR');
  log('Please run: npm install --save @modelcontextprotocol/sdk', 'ERROR');
  process.exit(1);
}

// Debug JSON-RPC messages
const debugJsonRpc = (direction, data) => {
  try {
    const msg = typeof data === 'string' ? data : JSON.stringify(data);
    log(`${direction} ${msg.substring(0, 200)}${msg.length > 200 ? '...' : ''}`, 'RPC');
  } catch (e) {
    log(`Error logging ${direction} message: ${e.message}`, 'ERROR');
  }
};

// Check if port is available or if Next.js is already running
const isPortAvailable = (port) => {
  return new Promise((resolve) => {
    const tester = net.createServer()
      .once('error', () => {
        resolve(false);
      })
      .once('listening', () => {
        tester.close();
        resolve(true);
      })
      .listen(port);
  });
};

// Check if Next.js API is responding
const pingNextJs = async () => {
  return new Promise((resolve) => {
    const req = http.get(`http://localhost:${PORT}/api/mcp/health`, (res) => {
      let data = '';
      res.on('data', (chunk) => {
        data += chunk;
      });
      
      res.on('end', () => {
        try {
          const response = JSON.parse(data);
          if (response.status === 'ok') {
            log(`Next.js MCP API is healthy: ${data}`, 'HEALTH');
            resolve(true);
            return;
          }
        } catch (e) {
          // Parsing error, considered not ready
        }
        resolve(false);
      });
    });
    
    req.on('error', () => {
      resolve(false);
    });
    
    req.setTimeout(500, () => {
      req.destroy();
      resolve(false);
    });
  });
};

// Forward JSON-RPC messages to the Next.js API
const forwardToNextJs = async (message) => {
  try {
    log(`Forwarding message to Next.js API: ID=${message?.id}, Method=${message?.method}`);
    
    return new Promise((resolve, reject) => {
      const requestData = JSON.stringify(message);
      
      const options = {
        hostname: 'localhost',
        port: PORT,
        path: '/api/mcp',
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(requestData)
        }
      };
      
      const req = http.request(options, (res) => {
        let data = '';
        
        res.on('data', (chunk) => {
          data += chunk;
        });
        
        res.on('end', () => {
          try {
            if (res.statusCode !== 200) {
              log(`Next.js API returned non-200 status: ${res.statusCode}`, 'WARNING');
              reject(new Error(`HTTP Error: ${res.statusCode}`));
              return;
            }
            
            const response = JSON.parse(data);
            log(`Received response from Next.js API: ID=${response?.id}`);
            resolve(response);
          } catch (e) {
            log(`Error parsing Next.js API response: ${e.message}`, 'ERROR');
            reject(e);
          }
        });
      });
      
      req.on('error', (e) => {
        log(`Error sending request to Next.js API: ${e.message}`, 'ERROR');
        reject(e);
      });
      
      req.setTimeout(5000, () => {
        log('Request to Next.js API timed out', 'ERROR');
        req.destroy();
        reject(new Error('Request timeout'));
      });
      
      req.write(requestData);
      req.end();
    });
  } catch (error) {
    log(`Error in forwardToNextJs: ${error.message}`, 'ERROR');
    throw error;
  }
};

// Start Next.js in the background if it's not already running
const startNextIfNeeded = async () => {
  const portAvailable = await isPortAvailable(PORT);
  if (!portAvailable) {
    log(`Next.js appears to be already running on port ${PORT}, checking health...`);
    const isReady = await pingNextJs();
    if (isReady) {
      return true; // Already running and healthy
    }
    log(`Next.js is running but not responding to health check`, 'WARNING');
  }
  
  log(`Starting Next.js server in background...`);
  
  // Create a log file for Next.js output
  const nextLogFile = fs.openSync('nextjs.log', 'a');
  
  // Spawn Next.js with output redirected to log file
  const nextProcess = spawn('npm', ['run', 'dev'], {
    detached: true,
    stdio: ['ignore', nextLogFile, nextLogFile]
  });
  
  // Handle startup errors
  nextProcess.on('error', (err) => {
    log(`Error starting Next.js: ${err.message}`, 'ERROR');
  });
  
  // Detach the process to run independently
  nextProcess.unref();
  
  // Wait for Next.js to start by polling
  let attempts = 0;
  const maxAttempts = 60; // Allow up to 60 seconds
  
  log(`Waiting for Next.js to start (max ${maxAttempts} seconds)...`);
  
  while (attempts < maxAttempts) {
    attempts++;
    
    const isReady = await pingNextJs();
    if (isReady) {
      log(`Next.js server started successfully after ${attempts} attempts`);
      return true;
    }
    
    // Wait a second before trying again
    log(`Waiting for Next.js (attempt ${attempts}/${maxAttempts})...`);
    await new Promise(resolve => setTimeout(resolve, 1000));
  }
  
  log(`Failed to start Next.js server in time`, 'ERROR');
  return false;
};

// Create a simple MCP server that connects to the Next.js API
const startMcpServer = async () => {
  log('Creating MCP transport...');
  let transport;
  try {
    transport = new StdioServerTransport();
  } catch (e) {
    log(`Fatal error in initialization: ${e.message}`, 'ERROR');
    process.exit(1);
  }
  log('MCP transport created.');
  // Add inspection log for the transport object
  log(`Inspecting transport object: typeof=${typeof transport}, constructor=${transport?.constructor?.name}, has .on method? ${typeof transport?.on === 'function'}`, 'DEBUG');
  
  // Add an error handler to the transport
  if (typeof transport.onerror === 'function') {
    transport.onerror = (error) => {
      log(`Transport error: ${error?.message || error}`, 'ERROR');
    };
  }

  log("Creating MCP server...");
  // Create MCP server
  const server = new McpServer({
    name: "knowledge-graph-mcp",
    version: "0.1.0",
  });
  
  // Create a message handler function
  const handleMessage = async (message) => {
    log(`Message received in transport handler: ID=${message?.id}, Method=${message?.method}`, 'DEBUG'); // Log entry
    try {
      debugJsonRpc('<- CLIENT:', message);
      
      // Forward to Next.js and get response
      const response = await forwardToNextJs(message);
      
      // Make sure we have a valid response object with jsonrpc field
      const validResponse = response && typeof response === 'object' 
        ? response 
        : { jsonrpc: "2.0", id: message.id, error: { code: -32603, message: "Invalid response format" } };
      
      // Ensure the response has the jsonrpc field
      if (!validResponse.jsonrpc) {
        validResponse.jsonrpc = "2.0";
      }
      
      // Send the response back to the client
      debugJsonRpc('-> CLIENT:', validResponse);
      // Add log before sending
      log(`Attempting to send response for ID: ${validResponse.id}`, 'DEBUG');
      transport.send(validResponse);
      log(`Successfully sent response for ID: ${validResponse.id}`, 'DEBUG');
    } catch (error) {
      log(`Error handling message: ${error.message}`, 'ERROR');
      
      // Send error response if we have a message ID
      if (message && message.id) {
        const errorResponse = {
          jsonrpc: "2.0",
          id: message.id,
          error: {
            code: -32603,
            message: `Internal error: ${error.message}`
          }
        };
        debugJsonRpc('-> CLIENT (ERROR):', errorResponse);
        transport.send(errorResponse);
      }
    }
  };
  
  // Register message handler - the StdioServerTransport uses onmessage, not event emitter
  log("Setting up onmessage handler for transport");
  transport.onmessage = handleMessage;
  
  // Start the server
  log("Starting MCP server...");
  try {
    await server.connect(transport);
    log("MCP server started and connected successfully");
  } catch (error) {
    log(`Failed to start MCP server: ${error.message}`, 'ERROR');
    process.exit(1);
  }
};

// Main function
const main = async () => {
  try {
    log("Starting knowledge graph MCP wrapper...");
    
    // Start Next.js if needed
    const nextJsStarted = await startNextIfNeeded();
    if (!nextJsStarted) {
      log("Could not start or connect to Next.js server. Exiting.", 'ERROR');
      process.exit(1);
    }
    
    // Start MCP server
    await startMcpServer();
    
    // Handle shutdown
    process.on('SIGINT', () => {
      log("Shutting down...");
      logStream.end();
      process.exit(0);
    });
    
    log("Wrapper initialization complete.");
  } catch (error) {
    log(`Fatal error in initialization: ${error.message}`, 'ERROR');
    process.exit(1);
  }
};

// Start the application
main().catch(error => {
  log(`Unhandled exception: ${error.message}`, 'ERROR');
  logStream.end(() => process.exit(1)); // Ensure log is written before exit
});

// Add global error handlers to catch silent exits
process.on('uncaughtException', (error, origin) => {
  log(`Uncaught Exception: ${error?.message || error}`, 'FATAL');
  log(`Origin: ${origin}`, 'FATAL');
  log(`Stack: ${error?.stack}`, 'FATAL');
  logStream.end(() => process.exit(1)); // Ensure log is written before exit
});

process.on('unhandledRejection', (reason, promise) => {
  log(`Unhandled Rejection: ${reason?.message || reason}`, 'FATAL');
  // Log promise details for debugging
  log(`Promise: ${JSON.stringify(promise)}`, 'FATAL');
});