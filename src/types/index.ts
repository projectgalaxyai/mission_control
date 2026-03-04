/**
 * Core type definitions for Mission Control WebSocket server
 */

// Agent Types
export type AgentStatus = 'online' | 'offline' | 'busy' | 'idle' | 'error';

export interface Agent {
  id: string;
  name: string;
  type: string;
  status: AgentStatus;
  capabilities: string[];
  metadata: Record<string, unknown>;
  connectedAt: Date;
  lastHeartbeat: Date;
  socketId: string;
}

export interface AgentConnection {
  agent: Agent;
  socket: WebSocket;
  isAlive: boolean;
}

// Message Types
export type MessageType = 
  | 'heartbeat'
  | 'heartbeat_ack'
  | 'message'
  | 'broadcast'
  | 'typing'
  | 'agent_joined'
  | 'agent_left'
  | 'agent_update'
  | 'system'
  | 'error'
  | 'command'
  | 'command_response'
  | 'register';

export interface BaseMessage {
  type: MessageType;
  timestamp: string;
  id: string;
}

export interface HeartbeatMessage extends BaseMessage {
  type: 'heartbeat';
  agentId: string;
  status: AgentStatus;
  load?: number;
  memory?: number;
}

export interface HeartbeatAckMessage extends BaseMessage {
  type: 'heartbeat_ack';
  serverTime: string;
}

export interface ChatMessage extends BaseMessage {
  type: 'message';
  from: string;
  to: string | 'broadcast';
  content: string;
  channel?: string;
}

export interface BroadcastMessage extends BaseMessage {
  type: 'broadcast';
  from: string;
  content: string;
  channel?: string;
}

export interface TypingMessage extends BaseMessage {
  type: 'typing';
  agentId: string;
  isTyping: boolean;
  channel?: string;
}

export interface AgentJoinedMessage extends BaseMessage {
  type: 'agent_joined';
  agent: Agent;
}

export interface AgentLeftMessage extends BaseMessage {
  type: 'agent_left';
  agentId: string;
  reason?: string;
}

export interface AgentUpdateMessage extends BaseMessage {
  type: 'agent_update';
  agent: Partial<Agent>;
  agentId: string;
}

export interface SystemMessage extends BaseMessage {
  type: 'system';
  level: 'info' | 'warning' | 'error';
  content: string;
}

export interface ErrorMessage extends BaseMessage {
  type: 'error';
  code: string;
  message: string;
  details?: unknown;
}

export interface CommandMessage extends BaseMessage {
  type: 'command';
  command: string;
  args: Record<string, unknown>;
  from: string;
  requestId: string;
}

export interface CommandResponseMessage extends BaseMessage {
  type: 'command_response';
  requestId: string;
  success: boolean;
  result?: unknown;
  error?: string;
}

export interface RegisterMessage extends BaseMessage {
  type: 'register';
  agent: Omit<Agent, 'id' | 'connectedAt' | 'lastHeartbeat' | 'socketId'>;
}

export type Message =
  | HeartbeatMessage
  | HeartbeatAckMessage
  | ChatMessage
  | BroadcastMessage
  | TypingMessage
  | AgentJoinedMessage
  | AgentLeftMessage
  | AgentUpdateMessage
  | SystemMessage
  | ErrorMessage
  | CommandMessage
  | CommandResponseMessage
  | RegisterMessage;

// Channel Types
export interface Channel {
  id: string;
  name: string;
  description?: string;
  agentIds: Set<string>;
  createdAt: Date;
}

// Server Events
export interface ServerConfig {
  port: number;
  host: string;
  heartbeatInterval: number;
  heartbeatTimeout: number;
  maxConnections: number;
  corsOrigins: string[];
}

export interface AgentStats {
  totalAgents: number;
  onlineAgents: number;
  busyAgents: number;
  idleAgents: number;
  errorAgents: number;
}

export interface ServerMetrics {
  uptime: number;
  totalConnections: number;
  activeConnections: number;
  messagesReceived: number;
  messagesSent: number;
  agentStats: AgentStats;
}
