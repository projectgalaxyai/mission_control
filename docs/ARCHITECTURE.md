# The Bridge Mission Control - Architecture Document

> **Project**: The Bridge - Multi-Agent Chat Interface  
> **Version**: 1.0.0  
> **Last Updated**: 2026-03-03  
> **Owner**: Project Galaxy

---

## Executive Summary

The Bridge Mission Control is a real-time multi-agent chat interface that bridges local LLM agents with the Mission Control dashboard. It enables seamless communication between agents, human operators, and autonomous systems through a unified, windowed interface resembling a classic desktop environment with draggable, minimizable chat windows.

---

## Tech Stack

### Core Framework

| Layer | Technology | Version | Purpose |
|-------|------------|---------|---------|
| Framework | Next.js | 15.x | App Router, Server Components, API Routes, Edge Runtime |
| Runtime | React | 19.x | Concurrent Rendering, Server Components, Actions |
| Language | TypeScript | 5.x | Strict Mode, Path Aliases, Decorators |
| Styling | Tailwind CSS | 4.x | Utility-First CSS, JIT Compiler, Custom Themes |
| UI Components | Radix UI | Latest | Headless accessible primitives |
| Animation | Framer Motion | 11.x | Gestures, Layout animations, Spring physics |
| Icons | Lucide React | Latest | Consistent, tree-shakeable iconography |
| Utilities | date-fns | 3.x | Date/time manipulation, timezone aware |

### Real-Time Communication Stack

| Technology | Role | Selection Criteria |
|------------|------|-------------------|
| **Socket.io** | Primary transport | Bidirectional events, automatic fallback, room support, ACK mechanisms |
| **Server-Sent Events (SSE)** | Fallback/Status streams | HTTP/1.1 compatible, unidirectional, simpler infrastructure |
| **WebSocket (Native)** | Low-level control | Direct control, minimal overhead, custom protocols |

**Decision Matrix**:
- Start with **Socket.io** for agent-to-dashboard communication
- SSE as fallback for simple status streaming (agent heartbeats)
- Native WebSocket reserved for binary data (file transfers, audio)

**Current implementation (as of 2026-03)**: The Bridge uses **native WebSocket** (`ws` on Node, browser `WebSocket`) for real-time communication, not Socket.io. The Mission Control server is an Express + `ws` server (`src/server.ts`) with a custom JSON protocol (register, heartbeat, message, command, etc.). Agents and the dashboard connect to `ws://host:3001/ws`. The topology and message flows below are aspirational; refer to `src/server.ts` and `src/handlers/message-handler.ts` for the actual implementation.

### State Management Architecture

| Library | Scope | Use Case |
|---------|-------|----------|
| **Zustand** | Global | Window positions, UI state, preferences |
| **TanStack Query** | Server | Agent status, history, logs (caching, refetching) |
| **Zustand + Immer** | Complex nested | Chat threads, message drafts, window layouts |
| **React Context** | Hierarchical | Theme, auth, feature flags, user preferences |
| **URL State** | Shareable | Open windows, selected agents, filters |

---

## System Architecture

### High-Level Topology

```
AGENT LAYER (Local)
  Dev        Orion      Assistant     Cron Jobs
  (Builder)  (Manager)  (General)     (Scheduler)
     |          |           |              |
     |          |           |              |
     +----------+-----+-----+--------------+
                     |
                     v
         MESSAGE BROKER (Socket.io)
         +-------------------------+
         |  Namespaces |  Rooms     |
         |  /bridge    | /agent/:id |
         |  /agents   | /user/:id  |
         |  /events   | /task/:id  |
         +-------------------------+
                     |
                     v
       MISSION CONTROL (Next.js 15)
         API Routes   App Router   Edge Runtime
                     |
        +------------+------------+
        |            |            |
        v            v            v
     Web UI      Mobile        Native
    (Browser)    (PWA)       (Tauri)
```

### Message Flow

#### Agent to Mission Control (Push Model)
```
Agent Emit → Socket.io Server → Redis Pub/Sub → Next.js API → Client
```

#### User to Agent (Command Model)
```
Client → Zustand Store → Socket Emit → Message Broker → Agent Queue → Agent
```

---

## Message Broker Pattern

### Event Schema

```typescript
// Core Event Interface
interface BridgeEvent<T = unknown> {
  id: string;                    // UUID v4
  type: EventType;               // Event category
  source: AgentId;               // Sender identifier
  target?: TargetType;           // Recipient(s)
  timestamp: ISO8601DateTime;
  correlationId?: string;        // Trace/request chain
  payload: T;
  qos: {
    priority: 1 | 2 | 3 | 4;   // 1=urgent, 4=low
    ttl: number;                 // Milliseconds
    encrypted: boolean;
    compressed: boolean;
  };
}

type EventType = 
  // Agent Lifecycle
  | 'agent.connect'
  | 'agent.disconnect'
  | 'agent.status_change'
  | 'agent.heartbeat'
  // Messaging
  | 'message.incoming'
  | 'message.outgoing'
  | 'message.typing'
  | 'message.read'
  | 'message.edit'
  | 'message.delete'
  // Tasks
  | 'task.assigned'
  | 'task.started'
  | 'task.progress'
  | 'task.completed'
  | 'task.failed'
  | 'task.cancelled'
  // Window Management
  | 'window.open'
  | 'window.close'
  | 'window.minimize'
  | 'window.maximize'
  | 'window.restore'
  | 'window.move'
  | 'window.resize'
  | 'window.focus'
  // System
  | 'system.notification'
  | 'system.error'
  | 'system.command';
```

### Socket.io Room Strategy

```typescript
// Server-side room management
io.of('/bridge').on('connection', (socket) => {
  const { agentId, userId } = socket.handshake.query;
  
  // Agent-specific private room
  socket.join(`agent:${agentId}`);
  
  // User-specific room (for multi-device sync)
  socket.join(`user:${userId}`);
  
  // Broadcast channels
  socket.join('agents:all');
  socket.join('agents:status');
  
  // Task subscription
  socket.on('task:subscribe', (taskId) => {
    socket.join(`task:${taskId}`);
  });
  
  // Window sync room
  socket.on('window:sync', () => {
    socket.join(`windows:${userId}`);
  });
});
```

### Message Routing Rules

| Source | Target | Room Pattern | Delivery |
|--------|--------|--------------|----------|
| Agent A | Agent B | `agent:${agentB}` | Direct |
| Agent | Mission Control | `agents:status` | Broadcast |
| Agent | Task members | `task:${taskId}` | Group |
| User | Agent | `agent:${agentId}` | Direct |
| System | All users | `agents:all` | Broadcast |

---

## State Management Strategy

### Zustand Store Architecture

```typescript
// stores/bridgeStore.ts
import { create } from 'zustand';
import { immer } from 'zustand/middleware/immer';

interface BridgeState {
  // Window Management
  windows: Record<string, WindowState>;
  activeWindowId: string | null;
  windowOrder: string[];          // Z-index stack
  
  // Chat State
  chats: Record<string, ChatState>;
  activeChatId: string | null;
  
  // Agent Registry
  agents: Record<string, AgentInfo>;
  onlineAgents: string[];
  
  // UI State
  sidebarOpen: boolean;
  themeMode: 'light' | 'dark' | 'system';
  soundEnabled: boolean;
  
  // Network
  connectionStatus: 'connected' | 'connecting' | 'disconnected';
  lastSyncedAt: number;
}

interface WindowState {
  id: string;
  agentId: string;
  chatId: string;
  position: { x: number; y: number };
  size: { width: number; height: number };
  minimized: boolean;
  maximized: boolean;
  zIndex: number;
  isFocused: boolean;
  snapped?: 'left' | 'right' | 'top' | 'bottom' | null;
}

interface ChatState {
  id: string;
  agentId: string;
  messages: Message[];
  unreadCount: number;
  lastReadAt: string;
  typingAgents: string[];
  draft?: string;
}

// Actions
interface BridgeActions {
  // Window operations
  createWindow: (agentId: string) => string;  // Returns windowId
  closeWindow: (windowId: string) => void;
  minimizeWindow: (windowId: string) => void;
  restoreWindow: (windowId: string) => void;
  maximizeWindow: (windowId: string) => void;
  moveWindow: (windowId: string, position: Point) => void;
  resizeWindow: (windowId: string, size: Size) => void;
  focusWindow: (windowId: string) => void;
  snapWindow: (windowId: string, direction: SnapDirection) => void;
  
  // Chat operations
  sendMessage: (chatId: string, content: string) => Promise<Message>;
  receiveMessage: (message: Message) => void;
  startTyping: (chatId: string) => void;
  stopTyping: (chatId: string) => void;
  markAsRead: (chatId: string) => void;
  editDraft: (chatId: string, draft: string) => void;
  
  // Agent operations
  registerAgent: (agent: AgentInfo) => void;
  updateAgentStatus: (agentId: string, status: AgentStatus) => void;
  setAgentTask: (agentId: string, taskId?: string) => void;
  
  // Network operations
  setConnectionStatus: (status: BridgeState['connectionStatus']) => void;
  syncState: () => Promise<void>;
  hydrateFromStorage: () => void;
}

export const useBridgeStore = create<BridgeState & BridgeActions>()(
  immer((set, get) => ({
    windows: {},
    activeWindowId: null,
    windowOrder: [],
    chats: {},
    activeChatId: null,
    agents: {},
    onlineAgents: [],
    sidebarOpen: true,
    themeMode: 'system',
    soundEnabled: true,
    connectionStatus: 'connecting',
    lastSyncedAt: 0,
    
    createWindow: (agentId) => {
      const windowId = `win_${nanoid()}`;
      const chatId = `chat_${agentId}`;
      
      set((state) => {
        state.windows[windowId] = {
          id: windowId,
          agentId,
          chatId,
          position: getInitialPosition(state),
          size: { width: 400, height: 500 },
          minimized: false,
          maximized: false,
          zIndex: state.windowOrder.length + 1,
          isFocused: true,
          snapped: null,
        };
        
        state.windowOrder.push(windowId);
        state.activeWindowId = windowId;
        
        if (!state.chats[chatId]) {
          state.chats[chatId] = {
            id: chatId,
            agentId,
            messages: [],
            unreadCount: 0,
            lastReadAt: new Date().toISOString(),
            typingAgents: [],
          };
        }
      });
      
      return windowId;
    },
    
    closeWindow: (windowId) => {
      set((state) => {
        delete state.windows[windowId];
        state.windowOrder = state.windowOrder.filter((id) => id !== windowId);
        
        if (state.activeWindowId === windowId) {
          state.activeWindowId = state.windowOrder[state.windowOrder.length - 1] || null;
        }
      });
    },
    
    focusWindow: (windowId) => {
      set((state) => {
        const window = state.windows[windowId];
        if (!window) return;
        
        // Update z-order
        state.windowOrder = [
          ...state.windowOrder.filter((id) => id !== windowId),
          windowId,
        ];
        
        // Reassign z-indexes
        state.windowOrder.forEach((id, index) => {
          state.windows[id].zIndex = index + 1;
        });
        
        // Focus target, blur others
        Object.values(state.windows).forEach((w) => {
          w.isFocused = w.id === windowId;
        });
        
        state.activeWindowId = windowId;
      });
    },
    
    // ... additional actions implemented similarly
  }))
);
```

### Persistence Strategy

```typescript
// lib/persistence.ts
import { useBridgeStore } from '@/stores/bridgeStore';

const STORAGE_KEY = 'bridge-window-state';

export const persistMiddleware = (config) => (set, get, api) =>
  config(
    (args) => {
      set(args);
      debouncedSave(get());
    },
    get,
    api
  );

const debouncedSave = debounce((state) => {
  const persistenceData = {
    windows: state.windows,
    sidebarOpen: state.sidebarOpen,
    themeMode: state.themeMode,
    soundEnabled: state.soundEnabled,
  };
  
  localStorage.setItem(STORAGE_KEY, JSON.stringify(persistenceData));
}, 500);

export const hydrateState = () => {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      const parsed = JSON.parse(stored);
      useBridgeStore.setState(parsed);
    }
  } catch (e) {
    console.error('Failed to hydrate bridge state:', e);
  }
};
```

---

## API Endpoints

### REST API

| Endpoint | Method | Description | Auth |
|----------|--------|-------------|------|
| `/api/agents` | GET | List all registered agents | Required |
| `/api/agents/:id` | GET | Get agent details | Required |
| `/api/agents/:id/status` | PATCH | Update agent status | Agent Token |
| `/api/chats/:id` | GET | Get chat history | Required |
| `/api/chats/:id/messages` | POST | Send message to chat | Required |
| `/api/chats/:id/read` | POST | Mark chat as read | Required |
| `/api/tasks` | GET | List tasks | Required |
| `/api/tasks` | POST | Create new task | Required |
| `/api/events` | GET | Poll events (SSE fallback) | Required |

### WebSocket Events

| Event | Direction | Payload | Description |
|-------|-----------|---------|-------------|
| `agent:connect` | C->S | `{ agentId }` | Agent authentication |
| `agent:status` | S<->C | `{ agentId, status }` | Status update |
| `message:send` | C->S | `{ chatId, content }` | Send message |
| `message:receive` | S->C | `Message` | Incoming message |
| `message:typing` | C->S | `{ chatId }` | Typing indicator |
| `task:update` | S->C | `TaskEvent` | Task status change |
| `window:sync` | C->S | `{ windows }` | Sync window state |
| `error` | S->C | `{ code, message }` | Error notification |

---

## Security Considerations

### Authentication

```typescript
// lib/auth.ts
interface AgentAuth {
  agentId: string;       // Unique identifier
  secret: string;        // HMAC secret
  permissions: string[]; // Allowed actions
  rateLimit: number;     // Messages per minute
}

// Socket.io authentication
io.use(async (socket, next) => {
  const token = socket.handshake.auth.token;
  const agent = await verifyAgentToken(token);
  
  if (!agent) {
    return next(new Error('Authentication failed'));
  }
  
  socket.data.agent = agent;
  next();
});
```

### Message Validation

```typescript
// lib/validation.ts
import { z } from 'zod';

const MessageSchema = z.object({
  id: z.string().uuid(),
  type: z.enum(['text', 'code', 'image', 'file']),
  content: z.string().max(10000),
  metadata: z.object({
    language: z.string().optional(), // For code blocks
    fileName: z.string().optional(),
    fileSize: z.number().optional(),
  }).optional(),
});

export const validateMessage = (data: unknown) => {
  return MessageSchema.safeParse(data);
};
```

### Rate Limiting

| Action | Limit | Window |
|--------|-------|--------|
| Messages per agent | 60 | 1 minute |
| Window operations | 30 | 1 minute |
| Connection attempts | 5 | 1 minute |
| API requests | 100 | 1 minute |

---

## Performance Optimizations

### 1. Virtual Scrolling
```typescript
// components/Chat/VirtualMessageList.tsx
import { Virtuoso } from 'react-virtuoso';

<Virtuoso
  data={messages}
  itemContent={(index, message) => (
    <MessageBubble key={message.id} {...message} />
  )}
  overscan={200}
/>
```

### 2. Message Batching
```typescript
// batched message processing
const messageQueue: Message[] = [];

const processBatch = () => {
  if (messageQueue.length === 0) return;
  
  const batch = messageQueue.splice(0, BATCH_SIZE);
  updateMessages(batch);
};

setInterval(processBatch, 50); // 20fps max
```

### 3. Selective Reflow
```typescript
// Only update changed windows
const useWindow = (windowId: string) => {
  return useBridgeStore(
    (state) => state.windows[windowId],
    shallow // Deep equality check on nested state
  );
};
```

---

## Deployment Architecture

### Docker Compose Stack

```yaml
# docker-compose.yml
version: '3.8'
services:
  nextjs:
    build: .
    ports:
      - "3000:3000"
    environment:
      - REDIS_URL=redis://redis:6379
      - SOCKET_PORT=4000
    
  redis:
    image: