/**
 * Orion Agent Connector
 * Connects Orion to Mission Control WebSocket as a real agent
 */
import WebSocket from 'ws';

const WS_URL = process.env.WS_URL || 'ws://localhost:3001/ws';

interface AgentConfig {
  id: string;
  name: string;
  type: string;
  status: 'online' | 'offline' | 'busy' | 'idle';
  capabilities: string[];
  metadata: Record<string, unknown>;
}

const ORION_CONFIG: AgentConfig = {
  id: 'agent-orion-main',
  name: 'Orion',
  type: 'Director',
  status: 'online',
  capabilities: ['task-assignment', 'coordination', 'monitoring', 'fleet-command'],
  metadata: { role: 'Galactic Director', version: '3.0' }
};

class AgentConnector {
  private ws: WebSocket | null = null;
  private reconnectTimer: NodeJS.Timeout | null = null;
  private heartbeatInterval: NodeJS.Timeout | null = null;
  private agentId: string;

  constructor(private config: AgentConfig) {
    this.agentId = config.id;
  }

  connect(): void {
    console.log(`[${this.config.name}] Connecting to ${WS_URL}...`);
    
    try {
      this.ws = new WebSocket(WS_URL);

      this.ws.on('open', () => {
        console.log(`[${this.config.name}] ✅ Connected`);
        this.register();
        this.startHeartbeat();
      });

      this.ws.on('message', (data: Buffer) => {
        try {
          const msg = JSON.parse(data.toString());
          this.handleMessage(msg);
        } catch (err) {
          console.error(`[${this.config.name}] Failed to parse message:`, err);
        }
      });

      this.ws.on('error', (err) => {
        console.error(`[${this.config.name}] ❌ Error:`, err.message);
      });

      this.ws.on('close', (code: number, reason: Buffer) => {
        console.log(`[${this.config.name}] 🔌 Closed (${code}): ${reason.toString()}`);
        this.cleanup();
        this.scheduleReconnect();
      });

    } catch (err) {
      console.error(`[${this.config.name}] Connection failed:`, err);
      this.scheduleReconnect();
    }
  }

  private register(): void {
    const registration = {
      type: 'register',
      agent: {
        id: this.agentId,
        name: this.config.name,
        type: this.config.type,
        status: this.config.status,
        capabilities: this.config.capabilities,
        metadata: this.config.metadata
      },
      timestamp: new Date().toISOString(),
      id: `reg-${Date.now()}`
    };
    this.ws?.send(JSON.stringify(registration));
    console.log(`[${this.config.name}] 📤 Registered`);
  }

  private startHeartbeat(): void {
    this.heartbeatInterval = setInterval(() => {
      const heartbeat = {
        type: 'heartbeat',
        agentId: this.agentId,
        status: this.config.status,
        timestamp: new Date().toISOString(),
        id: `hb-${Date.now()}`
      };
      this.ws?.send(JSON.stringify(heartbeat));
    }, 25000);
  }

  private handleMessage(msg: any): void {
    switch (msg.type) {
      case 'system':
        console.log(`[${this.config.name}] 📨 System:`, msg.content);
        break;
      case 'agent_joined':
        console.log(`[${this.config.name}] 👋 Agent joined:`, msg.agent?.name);
        break;
      case 'agent_left':
        console.log(`[${this.config.name}] 👋 Agent left:`, msg.agentId);
        break;
      case 'message': {
        console.log(`[${this.config.name}] 💬 Message from ${msg.from}:`, msg.content);
        
        // Auto-respond to broadcast or direct messages
        if (msg.to === 'broadcast' || msg.to === this.agentId) {
          // Don't reply to my own messages
          if (msg.from === this.agentId) break;
          
          setTimeout(() => {
            const response = {
              type: 'message',
              id: `msg-${Date.now()}`,
              timestamp: new Date().toISOString(),
              from: this.agentId,
              to: msg.from,
              content: `Orion copied: "${msg.content}"`,
              channel: 'main',
            };
            this.ws?.send(JSON.stringify(response));
            console.log(`[${this.config.name}] 📤 Replied to ${msg.from}`);
          }, 500);
        }
        break;
      }
      default:
        console.log(`[${this.config.name}] 📨 ${msg.type}:`, msg);
    }
  }

  private cleanup(): void {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = null;
    }
  }

  private scheduleReconnect(): void {
    console.log(`[${this.config.name}] 🔄 Reconnecting in 5s...`);
    this.reconnectTimer = setTimeout(() => this.connect(), 5000);
  }

  disconnect(): void {
    this.cleanup();
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
    }
    this.ws?.close();
    console.log(`[${this.config.name}] Disconnected`);
  }
}

// Start Orion
const orion = new AgentConnector(ORION_CONFIG);
orion.connect();

// Graceful shutdown
process.on('SIGINT', () => {
  console.log('\nShutting down...');
  orion.disconnect();
  process.exit(0);
});

console.log('Orion Agent Connector running. Press Ctrl+C to exit.');
