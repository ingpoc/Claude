# Troubleshooting Guide

## Common Issues and Solutions

### 1. Projects Page Shows 0 Projects

**Symptoms:**
- Dashboard home page shows projects correctly
- Projects page displays "0" for total projects
- API calls return 404 or fail

**Solutions:**

1. **Rebuild the TypeScript server:**
   ```bash
   npm run build:server
   ```

2. **Clear browser cache and restart:**
   ```bash
   # Stop the server (Ctrl+C)
   # Clear browser cache/cookies for localhost:4000
   # Restart the server
   npm run start:all
   ```

3. **Check API connectivity:**
   ```bash
   # Test the API directly
   curl http://localhost:4000/api/ui/projects
   ```

### 2. Browser Console Errors

**Symptoms:**
- Multiple POST errors to `_next/original-stack-frames`
- 404 errors in browser console

**Solution:**
These are Next.js development mode errors and can be safely ignored. They don't affect functionality.

### 3. Port Conflicts

**Symptoms:**
- "EADDRINUSE" errors
- Server fails to start

**Solutions:**

1. **Kill processes on the port:**
   ```bash
   lsof -ti:4000 | xargs kill -9
   ```

2. **Use a different port:**
   ```bash
   UI_API_PORT=5000 npm run start
   ```

### 4. MCP Clients Not Working

**Symptoms:**
- Claude/Cursor can't connect to MCP server
- Tools not showing up

**Solution:**
Update your MCP client configuration to use the new `mcp-only.js`:

```json
{
  "mcpServers": {
    "knowledge-graph": {
      "command": "node",
      "args": ["/absolute/path/to/mcp-only.js"],
      "env": {
        "OPENAI_API_KEY": "your-key"
      }
    }
  }
}
```

### 5. Qdrant Connection Issues

**Symptoms:**
- "Failed to initialize Qdrant" errors
- Random embeddings warning

**Solutions:**

1. **Ensure Qdrant is running:**
   ```bash
   docker ps | grep qdrant
   # If not running:
   npm run start:qdrant
   ```

2. **Check Qdrant health:**
   ```bash
   curl http://localhost:6333/health
   ```

### 6. Projects Not Syncing Between Clients

**Symptoms:**
- Projects created in one client don't appear in others
- Data seems isolated

**Solution:**
All clients should use the same Qdrant instance. Verify:
- All clients have `QDRANT_URL=http://localhost:6333`
- Qdrant is accessible from all environments

## Quick Diagnostic Commands

Run these to quickly diagnose issues:

```bash
# Full system diagnostic
npm run diagnose

# Check what's running
ps aux | grep -E "node|next|qdrant"

# Test API endpoints
curl http://localhost:4000/api/ui/projects
curl http://localhost:4000/api/ui/cache/stats

# Check Qdrant
curl http://localhost:6333/collections

# View server logs
tail -f logs/*.log
```

## Architecture Overview

```
Dashboard (Browser) 
    ↓ (HTTP)
Next.js App (port 4000)
    ↓ (Internal API calls)
Express API Routes (/api/ui/*)
    ↓
Qdrant Database (port 6333)
    ↑
MCP Clients (stdio, no HTTP)
```

## Still Having Issues?

1. **Clear everything and restart:**
   ```bash
   # Stop all services
   docker stop $(docker ps -q --filter ancestor=qdrant/qdrant)
   lsof -ti:4000 | xargs kill -9
   
   # Clear build artifacts
   rm -rf .next dist
   
   # Rebuild and start
   npm run setup
   npm run start:all
   ```

2. **Check the logs:**
   - Server logs: Look for errors in the terminal
   - Browser console: Check for API call failures
   - Network tab: Verify API endpoints are being called correctly

3. **Verify environment:**
   - Node.js version 18+
   - Docker running
   - Ports 4000 and 6333 available
   - `.env.local` configured correctly
