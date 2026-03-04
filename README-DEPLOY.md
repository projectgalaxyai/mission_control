# THE BRIDGE - Mission Control v2.0

🚀 **DEPLOYMENT READY** - 2026-03-04

## Quick Start
```bash
npm install --legacy-peer-deps
npm run build

# Terminal 1 - WebSocket Server
npm run server

# Terminal 2 - Next.js Frontend (or use static export)
npm start  # or: npx serve out/
```

## Endpoints
- Frontend: http://localhost:3000
- WebSocket: ws://localhost:3001/ws
- Health: http://localhost:3001/api/health

## Features
✅ Draggable agent chat windows
✅ Real-time WebSocket messaging
✅ Group broadcast channel
✅ Agent presence/heartbeat
✅ Dark futuristic UI (cyberpunk aesthetic)

## Architecture
- Next.js 15 + React 19 + TypeScript
- Express + WebSocket (ws) backend
- Custom drag implementation
- Context-based state management
