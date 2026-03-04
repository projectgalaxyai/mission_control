/**
 * WebSocket Message Handler - Routes messages and handles agent communication
 */
import type { WebSocket } from 'ws';
import type {
  Message,
  HeartbeatMessage,
  ChatMessage,
  TypingMessage,
  RegisterMessage,
  CommandMessage,
  CommandResponseMessage,
  Agent,
  AgentJoinedMessage,
  AgentLeftMessage,
} from '../types/index.js';
import {
  generateId,
  createTimestamp,
  safeJsonParse,
  safeJsonStringify,
  createErrorMessage,
  createBaseMessage,
} from '../utils/index.js';
import { agentRegistry } from './agent-registry.js';
import { channelManager } from './channel-manager.js';

// Metrics tracking
interface MessageMetrics {
  received: number;
  sent: number;
  byType: Map<string, number>;
}

const metrics: MessageMetrics = {
  received: 0,
  sent: 0,
  byType: new Map(),
};

/**
 * Handle incoming WebSocket messages
 */
export async function handleMessage(
  socket: WebSocket,
  rawData: string,
  socketId: string
): Promise<void> {
  metrics.received++;

  const parseResult = safeJsonParse<Message>(rawData);
  if (!parseResult.success) {
    sendError(socket, 'INVALID_JSON', 'Failed to parse message', parseResult.error);
    return;
  }

  const message = parseResult.data;
  
  // Track message type
  const currentCount = metrics.byType.get(message.type) ?? 0;
  metrics.byType.set(message.type, currentCount + 1);

  try {
    switch (message.type) {
      case 'register':
        await handleRegister(socket, message as RegisterMessage, socketId);
        break;
      case 'heartbeat':
        await handleHeartbeat(socket, message as HeartbeatMessage);
        break;
      case 'message':
        await handleChatMessage(socket, message as any);
        break;
      case 'typing':
        await handleTyping(socket, message as TypingMessage);
        break;
      case 'command':
        await handleCommand(socket, message as CommandMessage);
        break;
      case 'broadcast':
        await handleBroadcast(socket, message as any);
        break;
      default:
        sendError(socket, 'UNKNOWN_TYPE', `Unknown message type: ${message.type}`);
    }
  } catch (error) {
    sendError(socket, 'HANDLER_ERROR', 'Error processing message', (error as Error).message);
  }
}

/**
 * Handle agent registration
 */
async function handleRegister(
  socket: WebSocket,
  message: RegisterMessage,
  socketId: string
): Promise<void> {
  const { agent: agentData } = message;

  // Create agent with generated ID and metadata
  const agent: Agent = {
    ...agentData,
    id: generateId(),
    connectedAt: new Date(),
    lastHeartbeat: new Date(),
    socketId,
    status: 'online',
  };

  // Register in agent registry
  const connection = agentRegistry.registerAgent(agent, socket as any);

  // Join default channels
  channelManager.joinChannel(agent.id, 'general');
  channelManager.joinChannel(agent.id, 'system');

  // Send registration acknowledgment
  const response = {
    ...createBaseMessage('register'),
    type: 'register' as const,
    success: true,
    agentId: agent.id,
    channels: channelManager.getChannelsForAgent(agent.id).map(c => channelManager.formatChannelForClient(c)),
  };
  socket.send(JSON.stringify(response));

  // Notify all agents about new agent
  const joinedMessage: AgentJoinedMessage = {
    ...createBaseMessage('agent_joined'),
    type: 'agent_joined',
    agent: {
      id: agent.id,
      name: agent.name,
      type: agent.type,
      status: agent.status,
      capabilities: agent.capabilities,
      metadata: agent.metadata,
      connectedAt: agent.connectedAt,
      lastHeartbeat: agent.lastHeartbeat,
      socketId: '', // Empty for broadcast
    },
  };
  agentRegistry.broadcast(JSON.stringify(joinedMessage), agent.id);

  // Send current agent list to newly registered agent
  const agentListMessage = {
    ...createBaseMessage('agent_list'),
    type: 'agent_list' as const,
    agents: agentRegistry.getAllAgentsForClient().filter(a => a.id !== agent.id),
  };
  socket.send(JSON.stringify(agentListMessage));

  console.log(`[REGISTER] Agent ${agent.name} (${agent.id}) registered as ${agent.type}`);
}

/**
 * Handle heartbeat from agent
 */
async function handleHeartbeat(socket: WebSocket, message: HeartbeatMessage): Promise<void> {
  const { agentId, status } = message;

  // Update heartbeat timestamp
  agentRegistry.updateHeartbeat(agentId);

  // Update status if changed
  const agent = agentRegistry.getAgent(agentId);
  if (agent && agent.status !== status) {
    agentRegistry.updateAgentStatus(agentId, status);
    
    // Notify about status change
    const updateMessage = {
      ...createBaseMessage('agent_update'),
      type: 'agent_update' as const,
      agentId,
      agent: { status },
    };
    agentRegistry.broadcast(JSON.stringify(updateMessage));
  }

  // Send heartbeat acknowledgment
  const ack = {
    ...createBaseMessage('heartbeat_ack'),
    type: 'heartbeat_ack' as const,
    serverTime: createTimestamp(),
  };
  socket.send(JSON.stringify(ack));
}

/**
 * Handle chat message
 */
async function handleChatMessage(socket: WebSocket, message: ChatMessage): Promise<void> {
  const { from, to, content, channel } = message;

  // Validate sender
  const agent = agentRegistry.getAgent(from);
  if (!agent) {
    sendError(socket, 'AGENT_NOT_FOUND', 'Sender agent not found');
    return;
  }

  const enrichedMessage = {
    ...message,
    id: generateId(),
    timestamp: createTimestamp(),
  };

  const serialized = JSON.stringify(enrichedMessage);
  metrics.sent++;

  if (to === 'broadcast') {
    // Broadcast to all agents
    agentRegistry.broadcast(serialized, from);
  } else if (channel) {
    // Send to channel
    if (channelManager.isAgentInChannel(from, channel)) {
      channelManager.broadcastToChannel(channel, serialized, from);
    } else {
      sendError(socket, 'NOT_IN_CHANNEL', `Not a member of channel: ${channel}`);
      return;
    }
  } else {
    // Direct message to specific agent
    const success = agentRegistry.sendToAgent(to, serialized);
    if (!success) {
      sendError(socket, 'RECIPIENT_OFFLINE', `Agent ${to} is not connected`);
      return;
    }
  }

  console.log(`[MESSAGE] ${agent.name} -> ${to}: ${content.substring(0, 50)}${content.length > 50 ? '...' : ''}`);
}

/**
 * Handle broadcast message
 */
async function handleBroadcast(socket: WebSocket, message: ChatMessage): Promise<void> {
  await handleChatMessage(socket, { ...message, to: 'broadcast' });
}

/**
 * Handle typing indicator
 */
async function handleTyping(socket: WebSocket, message: TypingMessage): Promise<void> {
  const { agentId, isTyping, channel } = message;

  // Validate sender
  const agent = agentRegistry.getAgent(agentId);
  if (!agent) {
    sendError(socket, 'AGENT_NOT_FOUND', 'Agent not found');
    return;
  }

  const typingMessage = JSON.stringify({
    type: 'typing',
    agentId,
    agentName: agent.name,
    isTyping,
    channel,
    timestamp: createTimestamp(),
    id: generateId(),
  });

  if (channel) {
    // Typing in channel
    channelManager.sendTypingToChannel(channel, agentId, isTyping);
  } else {
    // Typing broadcast to all
    agentRegistry.broadcast(typingMessage, agentId);
  }
}

/**
 * Handle command execution
 */
async function handleCommand(socket: WebSocket, message: CommandMessage): Promise<void> {
  const { command, args, from, requestId } = message;

  console.log(`[COMMAND] ${from} executed: ${command}`, args);

  let result: unknown;
  let success = true;
  let error: string | undefined;

  try {
    switch (command) {
      case 'getAgents':
        result = agentRegistry.getAllAgentsForClient();
        break;
      case 'getAgent':
        result = agentRegistry.getAgent(args.agentId as string);
        break;
      case 'getChannels':
        result = channelManager.getAllChannels().map(c => channelManager.formatChannelForClient(c));
        break;
      case 'getStats':
        result = agentRegistry.getStats();
        break;
      case 'getMetrics':
        result = getMetrics();
        break;
      case 'joinChannel':
        success = channelManager.joinChannel(from, args.channelId as string);
        result = { joined: success, channelId: args.channelId };
        break;
      case 'leaveChannel':
        success = channelManager.leaveChannel(from, args.channelId as string);
        result = { left: success, channelId: args.channelId };
        break;
      case 'createChannel':
        const newChannel = channelManager.createChannel(
          args.channelId as string,
          args.name as string,
          args.description as string
        );
        result = channelManager.formatChannelForClient(newChannel);
        break;
      case 'deleteChannel':
        success = channelManager.deleteChannel(args.channelId as string);
        result = { deleted: success };
        break;
      default:
        success = false;
        error = `Unknown command: ${command}`;
    }
  } catch (err) {
    success = false;
    error = (err as Error).message;
  }

  const response: CommandResponseMessage = {
    ...createBaseMessage('command_response'),
    type: 'command_response',
    requestId,
    success,
    result: success ? result : undefined,
    error: success ? undefined : error,
  };

  socket.send(JSON.stringify(response));
}

/**
 * Send an error message to a socket
 */
function sendError(
  socket: WebSocket,
  code: string,
  message: string,
  details?: unknown
): void {
  const error = createErrorMessage(code, message, details);
  socket.send(JSON.stringify(error));
}

/**
 * Handle agent disconnection
 */
export function handleDisconnect(socketId: string): void {
  const agent = agentRegistry.getAgentBySocketId(socketId);
  if (!agent) return;

  // Leave all channels
  channelManager.leaveAllChannels(agent.id);

  // Remove from registry
  agentRegistry.unregisterAgent(agent.id);

  // Notify other agents
  const leftMessage: AgentLeftMessage = {
    ...createBaseMessage('agent_left'),
    type: 'agent_left',
    agentId: agent.id,
    reason: 'disconnected',
  };
  agentRegistry.broadcast(JSON.stringify(leftMessage));

  console.log(`[DISCONNECT] Agent ${agent.name} (${agent.id}) disconnected`);
}

/**
 * Get server metrics
 */
export function getMetrics(): { received: number; sent: number; byType: [string, number][] } {
  return {
    received: metrics.received,
    sent: metrics.sent,
    byType: Array.from(metrics.byType.entries()),
  };
}

/**
 * Get message statistics
 */
export function getMessageStats(): MessageMetrics {
  return { ...metrics };
}
