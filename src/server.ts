/**
 * Mission Control WebSocket Server
 * Main entry point - Express + WebSocket for real-time agent communication
 */
import express, { Request, Response, NextFunction } from 'express';
import { createServer } from 'http';
import { WebSocketServer, WebSocket } from 'ws';
import cors from 'cors';
import helmet from 'helmet';
import dotenv from 'dotenv';
import { agentRegistry } from './handlers/agent-registry.js';
import { channelManager } from './handlers/channel-manager.js';
import { handleMessage, handleDisconnect } from './handlers/message-handler.js';
import agentRoutes from './routes/agents.js';

// Load environment variables
dotenv.config();

// Server configuration
const PORT = parseInt(process.env.PORT || '3001', 10);
const HOST = process.env.HOST || '0.0.0.0';
const HEARTBEAT_INTERVAL = parseInt(process.env.HEARTBEAT_INTERVAL || '30000', 10); // 30 seconds
const CORS_ORIGINS = process.env.CORS_ORIGINS?.split(',') || ['*'];

// Express app setup
const app = express();
const server = createServer(app);

// Middleware
app.use(helmet({
  contentSecurityPolicy: false, // Disable for WebSocket compatibility
}));
app.use(cors({
  origin: CORS_ORIGINS,
  credentials: true,
}));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Request logging
app.use((req: Request, res: Response, next: NextFunction) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`);
  next();
});

// API routes
app.use('/api', agentRoutes);

// Root endpoint
app.get('/', (req: Request, res: Response) => {
  res.json({
    name: 'Mission Control Server',
    version: '1.0.0',
    status: 'running',
    uptime: process.uptime(),
    timestamp: new Date().toISOString(),
    endpoints: {
      ws: `ws://${HOST}:${PORT}`,
      api: {
        agents: '/api/agents',
        channels: '/api/channels',
        metrics: '/api/metrics',
        health: '/api/health',
      },
    },
  });
});

// Error handling
app.use((err: Error, req: Request, res: Response, _next: NextFunction) => {
  console.error('Express error:', err);
  res.status(500).json({
    success: false,
    error: err.message || 'Internal server error',
  });
});

// WebSocket server setup
const wss = new WebSocketServer({ server, path: '/ws' });

// Track connected sockets
const activeSockets = new Map<string, WebSocket>();
let socketCounter = 0;

// Generate socket ID
function generateSocketId(): string {
  return `socket_${++socketCounter}_${Date.now()}`;
}

// WebSocket connection handler
wss.on('connection', (socket: WebSocket, req: Request) => {
  const socketId = generateSocketId();
  activeSockets.set(socketId, socket);

  console.log(`[WS] New connection: ${socketId} from ${req.socket.remoteAddress}`);

  // Send welcome message
  const welcomeMessage = {
    type: 'system',
    level: 'info',
    content: 'Connected to Mission Control Server',
    socketId,
    timestamp: new Date().toISOString(),
    id: crypto.randomUUID(),
  };
  socket.send(JSON.stringify(welcomeMessage));

  // Message handler
  socket.on('message', (data: Buffer) => {
    try {
      const rawData = data.toString();
      handleMessage(socket, rawData, socketId).catch(err => {
        console.error('Error handling message:', err);
      });
    } catch (error) {
      console.error('Error processing message:', error);
      socket.send(JSON.stringify({
        type: 'error',
        code: 'PROCESSING_ERROR',
        message: 'Failed to process message',
        timestamp: new Date().toISOString(),
        id: crypto.randomUUID(),
      }));
    }
  });

  // Close handler
  socket.on('close', (code: number, reason: Buffer) => {
    console.log(`[WS] Connection closed: ${socketId} (code: ${code}, reason: ${reason.toString()})`);
    handleDisconnect(socketId);
    activeSockets.delete(socketId);
  });

  // Error handler
  socket.on('error', (error: Error) => {
    console.error(`[WS] Socket error for ${socketId}:`, error);
    handleDisconnect(socketId);
    activeSockets.delete(socketId);
  });

  // Set up ping/pong for connection health
  socket.on('pong', () => {
    const agent = agentRegistry.getAgentBySocketId(socketId);
    if (agent) {
      const connection = agentRegistry.getConnection(agent.id);
      if (connection) {
        connection.isAlive = true;
      }
    }
  });
});

// Heartbeat check interval
setInterval(() => {
  const inactiveAgents: string[] = [];

  for (const connection of agentRegistry.getAllConnections()) {
    if (!connection.isAlive) {
      inactiveAgents.push(connection.agent.id);
      try {
        (connection.socket as any).terminate();
      } catch {
        // Socket already closed
      }
    } else {
      // Mark for next check
      connection.isAlive = false;
      try {
        (connection.socket as any).ping();
      } catch {
        // Socket error
      }
    }
  }

  // Cleanup inactive agents
  for (const agentId of inactiveAgents) {
    console.log(`[HEARTBEAT] Agent ${agentId} timed out`);
    handleDisconnect(agentId);
  }
}, HEARTBEAT_INTERVAL);

// Start server
server.listen(PORT, HOST, () => {
  console.log('='.repeat(60));
  console.log('  Mission Control Server Started');
  console.log('='.repeat(60));
  console.log(`  HTTP Server: http://${HOST}:${PORT}`);
  console.log(`  WebSocket:   ws://${HOST}:${PORT}/ws`);
  console.log(`  REST API:    http://${HOST}:${PORT}/api`);
  console.log('='.repeat(60));
  console.log('  Endpoints:');
  console.log(`    GET  /api/agents       - List all agents`);
  console.log(`    GET  /api/agents/:id   - Get specific agent`);
  console.log(`    GET  /api/channels     - List all channels`);
  console.log(`    GET  /api/metrics      - Server metrics`);
  console.log(`    GET  /api/health       - Health check`);
  console.log('='.repeat(60));
});

// Graceful shutdown
process.on('SIGTERM', gracefulShutdown);
process.on('SIGINT', gracefulShutdown);

function gracefulShutdown() {
  console.log('\n[SHUTDOWN] Received shutdown signal. Closing connections...');
  
  // Close all WebSocket connections
  for (const [socketId, socket] of activeSockets) {
    try {
      socket.close(1000, 'Server shutting down');
    } catch {
      // Socket already closed
    }
    handleDisconnect(socketId);
  }
  activeSockets.clear();

  // Clear registries
  agentRegistry.clear();

  server.close(() => {
    console.log('[SHUTDOWN] Server closed');
    process.exit(0);
  });

  // Force exit after 30 seconds
  setTimeout(() => {
    console.error('[SHUTDOWN] Force exit after timeout');
    process.exit(1);
  }, 30000);
}

export { wss, server, app };
