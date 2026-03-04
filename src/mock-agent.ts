/**
 * Mock Agent Simulator
 * Simulates agents connecting and interacting with the Mission Control server
 * for testing purposes.
 */
import WebSocket from 'ws';

const SERVER_URL = process.env.SERVER_URL || 'ws://localhost:3001/ws';

// Mock agent configurations
interface MockAgentConfig {
  count: number;
  baseName: string;
  type: string;
  capabilities: string[];
  messageInterval: number; // ms between messages
  messageChance: number; // 0-1 chance to send message
}

const MOCK_AGENTS: MockAgentConfig[] = [
  {
    count: 2,
    baseName: 'Dev',
    type: 'developer',
    capabilities: ['coding', 'debugging', 'refactoring'],
    messageInterval: 15000,
    messageChance: 0.3,
  },
  {
    count: 2,
    baseName: 'Tester',
    type: 'tester',
    capabilities: ['testing', 'quality-assurance', 'reporting'],
    messageInterval: 20000,
    messageChance: 0.2,
  },
  {
    count: 1,
    baseName: 'Coordinator',
    type: 'coordinator',
    capabilities: ['coordination', 'planning', 'scheduling'],
    messageInterval: 30000,
    messageChance: 0.4,
  },
];

// Sample messages agents might send
const SAMPLE_MESSAGES = [
  'Working on task...',
  'Task completed successfully',
  'Need assistance with debugging',
  'Running tests...',
  'All systems operational',
  'Found a potential issue',
  'Analyzing data...',
  'Reporting status update',
  'Synchronizing with team...',
  'Reviewing code changes',
  'Deploying update...',
  'Monitoring performance metrics',
  'Validating configuration...',
  'Processing batch job',
  'Updating documentation',
];

interface MockAgent {
  id: string;
  name: string;
  type: string;
  capabilities: string[];
  socket: WebSocket | null;
  registered: boolean;
  connected: boolean;
  messageInterval: NodeJS.Timeout | null;
  heartbeatInterval: NodeJS.Timeout | null;
}

const agents: MockAgent[] = [];

/**
 * Create a mock agent
 */
function createMockAgent(config: MockAgentConfig, index: number): MockAgent {
  return {
    id: '',
    name: `${config.baseName}-${index + 1}`,
    type: config.type,
    capabilities: config.capabilities,
    socket: null,
    registered: false,
    connected: false,
    messageInterval: null,
    heartbeatInterval: null,
  };
}

/**
 * Send a message through the WebSocket
 */
function sendMessage(socket: WebSocket, message: unknown): void {
  if (socket.readyState === WebSocket.OPEN) {
    socket.send(JSON.stringify(message));
  }
}

/**
 * Register agent with server
 */
function registerAgent(agent: MockAgent): void {
  const registerMessage = {
    type: 'register',
    agent: {
      name: agent.name,
      type: agent.type,
      capabilities: agent.capabilities,
      metadata: {
        mock: true,
        version: '1.0.0',
      },
    },
    timestamp: new Date().toISOString(),
    id: crypto.randomUUID(),
  };
  sendMessage(agent.socket!, registerMessage);
}

/**
 * Send heartbeat
 */
function sendHeartbeat(agent: MockAgent): void {
  const heartbeatMessage = {
    type: 'heartbeat',
    agentId: agent.id,
    status: 'online',
    timestamp: new Date().toISOString(),
    id: crypto.randomUUID(),
  };
  sendMessage(agent.socket!, heartbeatMessage);
}

/**
 * Send random message
 */
function sendRandomMessage(agent: MockAgent): void {
  const message = SAMPLE_MESSAGES[Math.floor(Math.random() * SAMPLE_MESSAGES.length)];
  const chatMessage = {
    type: 'message',
    from: agent.id,
    to: 'broadcast',
    content: message,
    timestamp: new Date().toISOString(),
    id: crypto.randomUUID(),
  };
  sendMessage(agent.socket!, chatMessage);
  console.log(`[${agent.name}] ${message}`);
}

/**
 * Send typing indicator
 */
function sendTypingIndicator(agent: MockAgent, isTyping: boolean): void {
  const typingMessage = {
    type: 'typing',
    agentId: agent.id,
    isTyping,
    timestamp: new Date().toISOString(),
    id: crypto.randomUUID(),
  };
  sendMessage(agent.socket!, typingMessage);
}

/**
 * Connect a mock agent to the server
 */
async function connectAgent(agent: MockAgent, config: MockAgentConfig): Promise<void> {
  return new Promise((resolve, reject) => {
    try {
      const socket = new WebSocket(SERVER_URL);
      agent.socket = socket;

      socket.on('open', () => {
        agent.connected = true;
        console.log(`[CONNECT] ${agent.name} connected`);
        registerAgent(agent);
        resolve();
      });

      socket.on('message', (data: Buffer) => {
        try {
          const message = JSON.parse(data.toString());
          handleServerMessage(agent, message, config);
        } catch (error) {
          console.error(`[ERROR] ${agent.name} failed to parse message:`, error);
        }
      });

      socket.on('close', (code: number, reason: Buffer) => {
        agent.connected = false;
        agent.registered = false;
        if (agent.heartbeatInterval) clearInterval(agent.heartbeatInterval);
        if (agent.messageInterval) clearInterval(agent.messageInterval);
        console.log(`[DISCONNECT] ${agent.name} disconnected (code: ${code})`);
      });

      socket.on('error', (error: Error) => {
        console.error(`[ERROR] ${agent.name} connection error:`, error.message);
        reject(error);
      });
    } catch (error) {
      reject(error);
    }
  });
}

/**
 * Handle messages from the server
 */
function handleServerMessage(agent: MockAgent, message: any, config: MockAgentConfig): void {
  switch (message.type) {
    case 'register':
      if (message.success) {
        agent.id = message.agentId;
        agent.registered = true;
        console.log(`[REGISTERED] ${agent.name} assigned ID: ${agent.id}`);
        
        // Start sending heartbeats
        agent.heartbeatInterval = setInterval(() => {
          if (agent.connected) {
            sendHeartbeat(agent);
          }
        }, 25000); // 25 second heartbeat interval

        // Start sending random messages
        agent.messageInterval = setInterval(() => {
          if (agent.connected && Math.random() < config.messageChance) {
            // Send typing indicator
            sendTypingIndicator(agent, true);
            
            // Actually send message after typing delay
            setTimeout(() => {
              sendRandomMessage(agent);
              sendTypingIndicator(agent, false);
            }, 1000 + Math.random() * 2000);
          }
        }, config.messageInterval);
      }
      break;

    case 'heartbeat_ack':
      // Heartbeat acknowledged
      break;

    case 'message':
      // Received a message from another agent
      if (message.from !== agent.id) {
        console.log(`[${agent.name}] Received from ${message.from}: ${message.content.substring(0, 30)}...`);
      }
      break;

    case 'system':
      console.log(`[${agent.name}] System: ${message.content}`);
      break;

    case 'error':
      console.error(`[${agent.name}] Error: ${message.message}`);
      break;

    case 'agent_joined':
      console.log(`[${agent.name}] Agent joined: ${message.agent?.name || message.agentId}`);
      break;

    case 'agent_left':
      console.log(`[${agent.name}] Agent left: ${message.agentId}`);
      break;

    case 'agent_update':
      console.log(`[${agent.name}] Agent update: ${message.agentId} status: ${message.agent?.status}`);
      break;

    default:
      // Ignore other message types
      break;
  }
}

/**
 * Initialize mock agents
 */
async function initializeAgents(): Promise<void> {
  console.log('='.repeat(60));
  console.log('  Mission Control Mock Agent Simulator');
  console.log('='.repeat(60));
  console.log(`  Server: ${SERVER_URL}`);
  console.log('='.repeat(60));


async function initializeAgents(): Promise<void> {
  console.log("=".repeat(60));
  console.log("  Mission Control Mock Agent Simulator");
  console.log("=".repeat(60));
  console.log(`  Server: ${SERVER_URL}`);
  console.log("=".repeat(60));
  console.log();

  for (const config of MOCK_AGENTS) {
    for (let i = 0; i < config.count; i++) {
      const agent = createMockAgent(config, i);
      agents.push(agent);

      try {
        await connectAgent(agent, config);
        await new Promise(resolve => setTimeout(resolve, 500));
      } catch (error) {
        console.error(`[ERROR] Failed to connect ${agent.name}:`, error);
      }
    }
  }

  console.log();
  console.log("=".repeat(60));
  console.log(`  Agents connected: ${agents.filter(a => a.connected).length}/${agents.length}`);
  console.log("  Press Ctrl+C to stop");
  console.log("=".repeat(60));
  console.log();
}

async function main(): Promise<void> {
  await initializeAgents();

  process.on("SIGINT", () => {
    console.log("\n[SHUTDOWN] Closing all agent connections...");
    for (const agent of agents) {
      if (agent.connected && agent.socket) {
        agent.socket.close();
      }
    }
    process.exit(0);
  });
}

main().catch(console.error);
