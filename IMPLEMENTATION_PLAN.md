npm # MCP–Memvid Integration – Implementation Plan

_Last updated: 2025-06-13_

## 🎯 Goals
1. Improve protocol compliance and resilience of `src/server/mcp-host.ts`.
2. Surface Memvid data as first-class MCP Resources.
3. Provide richer diagnostics (logging, ping) for Claude Desktop.
4. Enable resumable client sessions.
5. Modularise tool registration for easier extension.

## 🗂️ High-Level Work Breakdown

| Priority | Task | Owner | Notes |
| -------- | ---- | ----- | ----- |
| ⭐⭐⭐ | **P1 – Session Persistence** | BE | • Generate/accept `sessionId` in `initialize`.<br/>• Store minimal context (e.g. clientInfo, timestamp) in an on-disk JSON cache (`.mcp-sessions/`). |
| ⭐⭐⭐ | **P1 – Capabilities in Initialize** | BE | • Return full `capabilities` block per spec:<br/>  – `logging`, `resources`, `prompts`, `tools` (with `listChanged`, `subscribe` flags). |
| ⭐⭐⭐ | **P1 – Dynamic Tool List in Initialize** | BE | • Compute tool descriptors once at boot.<br/>• Embed them directly in Initialize response's `capabilities.tools`.<br/>• Continue supporting `tools/list` for backward compatibility. |
| ⭐⭐ | **P2 – Pre-flight Dependency Checks** | BE | • Move health check for Python service into the Initialize handler (retry each connection).<br/>• Fail with MCP error if backend is unavailable. |
| ⭐⭐ | **P2 – Logging & Ping Utilities** | BE | • Implement trivial `ping` request handler that returns `{}`.<br/>• Declare `logging` capability and send startup + error logs via `notifications/message`. |
| ⭐⭐ | **P2 – Expose Memvid Index as Resource** | PY | • Add `/resources/memvid-index` endpoint or direct file read in Node.<br/>• Register resource descriptor in `resources/list` handler with URI `file://{index_path}` and `mimeType: application/json`. |
| ⭐ | **P3 – Modular Tool Registration** | BE | • Move each tool spec + handler into `src/tools/{name}.ts`.<br/>• Auto-import and register at server boot. |
| ⭐ | **P3 – HTTP Transport (Optional)** | BE | • Expose Streamable HTTP endpoint alongside stdio (low priority). |
| ⭐ | **P3 – Richer `serverInfo` Metadata** | BE | • Inject git commit hash & Memvid version. |

## 📐 Design Details

### Session Cache Structure (`.mcp-sessions/<sessionId>.json`)
```jsonc
{
  "sessionId": "uuid",
  "createdAt": "2025-06-13T12:34:56Z",
  "clientInfo": { "name": "Claude Desktop", "version": "..." },
  "lastSeen": "2025-06-13T12:35:40Z"
}
```
• TTL: 7 days; clean up expired sessions on startup.

### Initialize Response (Example)
```jsonc
{
  "protocolVersion": "2024-11-05",
  "capabilities": {
    "logging": {},
    "resources": { "listChanged": true, "subscribe": false },
    "prompts":   { "listChanged": true },
    "tools":     { "listChanged": true }
  },
  "serverInfo": {
    "name": "knowledge-graph",
    "version": "1.0.0",
    "build": "{gitSHA}"
  },
  "sessionInfo": {
    "sessionId": "{uuid}",
    "resumeSupported": true
  }
}
```

### Logging Notification Example
```jsonc
{
  "jsonrpc": "2.0",
  "method": "notifications/message",
  "params": {
    "level": "info",
    "logger": "startup",
    "data": { "message": "Connected to backend", "port": 8000 }
  }
}
```

## 🛠️ Implementation Steps
1. **Refactor `mcp-host.ts`**
   • Extract tool definitions to `src/tools/`.
   • Add session cache helper.
   • Enhance Initialize handler (steps above).
   • Add ping & logging handlers.
2. **Python Service**
   • Ensure `/health` endpoint is robust (already exists).
   • Export Memvid index path via new `/meta` if easier than file URI.
3. **Resource Registration**
   • On Node side, read `settings.index_path` from `/meta` or env and create resource descriptor.
4. **Testing**
   • Use `npx @modelcontextprotocol/inspector` to verify Initialize, ping, resource listing.
   • Regression test existing UI flows.
5. **Docs & Config**
   • Update README and example `claude_desktop_config.json` to note new capabilities.

## ⏳ Timeline (Rough)
| Day | Deliverable |
| --- | ----------- |
| D0  | Plan approved ✅ |
| D1  | Session cache + Capabilities response |
| D2  | Ping & logging utilities |
| D3  | Memvid resource exposure |
| D4  | Modular tool refactor |
| D5  | QA & README updates |

---
**End of Plan**
