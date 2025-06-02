# MCP Client Configuration Examples

## Overview

The MCP Knowledge Graph server can run in different modes to avoid port conflicts when used by multiple clients:

1. **MCP-only mode**: For Claude Desktop, Cursor, and other MCP clients (no HTTP server)
2. **UI mode**: For local dashboard access (includes HTTP server)
3. **Shared data**: All instances use the same Qdrant database

## Configuration for Different Clients

### Claude Desktop Configuration

Add to your Claude Desktop config file:

```json
{
  "mcpServers": {
    "knowledge-graph": {
      "command": "node",
      "args": ["/absolute/path/to/mcp-knowledge-graph/mcp-only.js"],
      "cwd": "/absolute/path/to/mcp-knowledge-graph",
      "env": {
        "NODE_ENV": "production",
        "QDRANT_URL": "http://localhost:6333",
        "OPENAI_API_KEY": "your-openai-api-key"
      }
    }
  }
}
```

### Cursor App Configuration

Add to your Cursor settings:

```json
{
  "mcp": {
    "servers": {
      "knowledge-graph": {
        "command": "node",
        "args": ["/absolute/path/to/mcp-knowledge-graph/mcp-only.js"],
        "env": {
          "NODE_ENV": "production",
          "QDRANT_URL": "http://localhost:6333",
          "OPENAI_API_KEY": "your-openai-api-key"
        }
      }
    }
  }
}
```

### VS Code with Continue Extension

Add to your Continue config:

```json
{
  "models": [{
    "title": "Claude with Knowledge Graph",
    "provider": "anthropic",
    "model": "claude-3-opus",
    "mcpServers": [{
      "command": "node",
      "args": ["/absolute/path/to/mcp-knowledge-graph/mcp-only.js"],
      "env": {
        "NODE_ENV": "production",
        "QDRANT_URL": "http://localhost:6333",
        "OPENAI_API_KEY": "your-openai-api-key"
      }
    }]
  }]
}
```

## Running the Dashboard (UI Mode)

The dashboard runs separately and doesn't interfere with MCP clients:

```bash
# Start the dashboard on port 4000
npm run start

# Or specify a different port
UI_API_PORT=5000 npm run start
```

Access the dashboard at http://localhost:4000 (or your specified port).

## Running Everything Together

1. **Start Qdrant** (shared by all instances):
   ```bash
   npm run start:qdrant
   ```

2. **Start the Dashboard** (optional, for visual management):
   ```bash
   npm run start
   ```

3. **Configure MCP clients** using the configurations above.

## How It Works

- **MCP clients** (Claude, Cursor) spawn their own process using `mcp-only.js`
- Each MCP process communicates via stdio (no HTTP ports)
- The **dashboard** runs separately with its own HTTP server
- All instances share the same **Qdrant database**
- No port conflicts because MCP processes don't use HTTP

## Troubleshooting

### Check what's running:
```bash
npm run diagnose
```

### Port already in use:
- MCP clients don't use ports (stdio only)
- Dashboard port can be changed with `UI_API_PORT` env var

### Qdrant not accessible:
- Ensure Qdrant is running: `docker ps | grep qdrant`
- Check Qdrant health: `curl http://localhost:6333/health`

### Knowledge not shared between clients:
- Verify all clients use the same `QDRANT_URL`
- Check Qdrant is accessible from all environments

## Architecture Diagram

```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│  Claude Desktop │     │   Cursor App    │     │   VS Code       │
│   MCP Client    │     │   MCP Client    │     │   MCP Client    │
└────────┬────────┘     └────────┬────────┘     └────────┬────────┘
         │ stdio                 │ stdio                 │ stdio
         ↓                       ↓                       ↓
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│  mcp-only.js    │     │  mcp-only.js    │     │  mcp-only.js    │
│  (no HTTP)      │     │  (no HTTP)      │     │  (no HTTP)      │
└────────┬────────┘     └────────┬────────┘     └────────┬────────┘
         │                       │                       │
         └───────────────────────┴───────────────────────┘
                                 │
                                 ↓
                    ┌─────────────────────────┐
                    │    Qdrant Database      │
                    │    (localhost:6333)     │
                    └─────────────────────────┘
                                 ↑
                                 │
                    ┌─────────────────────────┐
                    │   Dashboard (Optional)  │
                    │   HTTP: localhost:4000  │
                    └─────────────────────────┘
```
