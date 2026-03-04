# Mission Control Server

A WebSocket server for real-time agent communication and management. Built with Express and ws for Project Galaxy.

## Features

- 🔌 **WebSocket Communication** - Real-time bidirectional messaging
- 👥 **Agent Management** - Registry with heartbeat monitoring
- 💬 **Group Chat Channels** - Multi-room chat system
- 📡 **Message Broadcasting** - Target specific agents or broadcast to all
- ⌨️ **Typing Indicators** - Real-time typing status
- 📊 **REST API** - HTTP endpoints for management
- 📈 **Metrics & Monitoring** - Server health and message statistics
- 🧪 **Mock Agent Simulator** - Test the system with simulated agents
- 🐳 **Docker Support** - Easy deployment with docker-compose

## Quick Start

### Install Dependencies

```bash
npm install
```

### Development Mode

```bash
npm run dev
```

The server will start on:
- HTTP: `http://localhost:3001`
- WebSocket: `ws://localhost:3001/ws`
- REST API: `http://localhost:3001/api`

### Test with Mock Agents

In a separate terminal:

```bash
npm run mock:agent
```

This will spawn simulated agents that connect to the server and exchange messages.

## WebSocket Protocol

### Connect

```javascript
const ws = new WebSocket('ws://localhost:3001/ws');
```

### Register Agent

```javascript
ws.send(JSON.stringify({
  type: 'register',
  agent: {
    name: 'MyAgent',
    type: 'developer',
    capabilities: ['coding', 'debugging'],
    metadata: { slot: 'dev-1' }
  },
  timestamp: new Date().toISOString(),
  id: crypto.randomUUID()
}));
```

### Send Message

```javascript
// Broadcast to all agents
ws.send(JSON.stringify({
  type: 'message',
  from: 'agent-id',
  to: 'broadcast',
  content: 'Hello everyone!',
  timestamp: new Date().toISOString(),
  id: crypto.randomUUID()
}));

// Send to specific channel
ws.send(JSON.stringify({
  type: 'message',
  from: 'agent-id',
  to: 'broadcast',
  content: 'Hello channel!',
  channel: 'general',
  timestamp: new Date().toISOString(),
  id: crypto.randomUUID()
}));
```

### Typing Indicator

```javascript
ws.send(JSON.stringify({
  type: 'typing',
  agentId: 'agent-id',
  isTyping: true,
  channel: 'general',
  timestamp: new Date().toISOString(),
  id: crypto.randomUUID()
}));
```

### Heartbeat

```javascript
// Send every 25-30 seconds
ws.send(JSON.stringify({
  type: 'heartbeat',
  agentId: 'agent-id',
  status: 'online',
  timestamp: new Date().toISOString(),
  id: crypto.randomUUID()
}));
```

## REST API Endpoints

### Agents

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/agents` | List all agents |
| GET | `/api/agents/stats` | Get agent statistics |
| GET | `/api/agents/:id` | Get specific agent |
| GET | `/api/agents/:id/channels` | Get agent's channels |
| POST | `/api/agents/:id/kick` | Kick an agent |

### Channels

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/channels` | List all channels |
| GET | `/api/channels/:id` | Get specific channel |
| POST | `/api/channels` | Create new channel |
| DELETE | `/api/channels/:id` | Delete channel |

### System

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/metrics` | Server metrics & statistics |
| GET | `/api/health` | Health check |

## Docker Deployment

### Using Docker Compose

```bash
docker-compose up -d
```

To stop:
```bash
docker-compose down
```

### Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `PORT` | 3001 | Server port |
| `HOST` | 0.0.0.0 | Server host |
| `HEARTBEAT_INTERVAL` | 30000 | Heartbeat check interval (ms) |
| `CORS_ORIGINS` | * | Allowed CORS origins (comma-separated) |
| `LOG_LEVEL` | info | Logging level |

## Message Types

### Incoming (Client → Server)

- `register` - Register new agent
- `heartbeat` - Agent heartbeat
- `message` - Chat message
- `broadcast` - Broadcast message
- `typing` - Typing indicator
- `command` - Execute command

### Outgoing (Server → Client)

- `register` - Registration response
- `heartbeat_ack` - Heartbeat acknowledgment
- `message` - Incoming chat message
- `broadcast` - Incoming broadcast
- `typing` - Typing notification
- `agent_joined` - Agent connected
- `agent_left` - Agent disconnected
- `agent_update` - Agent status changed
- `system` - System message
- `error` - Error notification
- `command_response` - Command result

## Project Structure

```
src/
├── handlers/
│   ├── agent-registry.ts      # Agent connection management
│   ├── channel-manager.ts     # Channel/group management
│   └── message-handler.ts     # Message routing & processing
├── routes/
│   └── agents.ts              # REST API endpoints
├── types/
│   └── index.ts               # TypeScript types
├── utils/
│   └── index.ts               # Utility functions
├── server.ts                  # Main server entry point
└── mock-agent.ts              # Mock agent simulator
```

## Commands

Agents can execute commands via WebSocket:

```javascript
ws.send(JSON.stringify({
  type: 'command',
  command: 'getAgents',
  args: {},
  from: 'agent-id',
  requestId: crypto.randomUUID(),
  timestamp: new Date().toISOString(),
  id: crypto.randomUUID()
}));
```

Available commands:
- `getAgents` - List all connected agents
- `getAgent` - Get specific agent (`args: { agentId }`)
- `getChannels` - List all channels
- `getStats` - Get agent statistics
- `getMetrics` - Get message metrics
- `joinChannel` - Join a channel
- `leaveChannel` - Leave a channel

## License

MIT
