/**
 * Agent Registry - Manages all connected agents
 */
import type { Agent, AgentConnection, AgentStats } from '../types/index.js';
import { formatAgentForClient } from '../utils/index.js';

export class AgentRegistry {
  private agents: Map<string, Agent> = new Map();
  private connections: Map<string, AgentConnection> = new Map();
  private socketToAgent: Map<string, string> = new Map();

  /**
   * Register a new agent
   */
  registerAgent(agent: Agent, socket: WebSocket): AgentConnection {
    this.agents.set(agent.id, agent);
    const connection: AgentConnection = {
      agent,
      socket,
      isAlive: true,
    };
    this.connections.set(agent.id, connection);
    this.socketToAgent.set(agent.socketId, agent.id);
    return connection;
  }

  /**
   * Unregister an agent
   */
  unregisterAgent(agentId: string): boolean {
    const agent = this.agents.get(agentId);
    if (!agent) return false;

    this.socketToAgent.delete(agent.socketId);
    this.connections.delete(agentId);
    this.agents.delete(agentId);
    return true;
  }

  /**
   * Get agent by ID
   */
  getAgent(agentId: string): Agent | undefined {
    return this.agents.get(agentId);
  }

  /**
   * Get connection by agent ID
   */
  getConnection(agentId: string): AgentConnection | undefined {
    return this.connections.get(agentId);
  }

  /**
   * Get agent by socket ID
   */
  getAgentBySocketId(socketId: string): Agent | undefined {
    const agentId = this.socketToAgent.get(socketId);
    if (agentId) {
      return this.agents.get(agentId);
    }
    return undefined;
  }

  /**
   * Get connection by socket ID
   */
  getConnectionBySocketId(socketId: string): AgentConnection | undefined {
    const agentId = this.socketToAgent.get(socketId);
    if (agentId) {
      return this.connections.get(agentId);
    }
    return undefined;
  }

  /**
   * Update agent status
   */
  updateAgentStatus(agentId: string, status: Agent['status']): boolean {
    const agent = this.agents.get(agentId);
    if (!agent) return false;

    agent.status = status;
    agent.lastHeartbeat = new Date();
    return true;
  }

  /**
   * Update agent data
   */
  updateAgent(agentId: string, updates: Partial<Agent>): boolean {
    const agent = this.agents.get(agentId);
    if (!agent) return false;

    Object.assign(agent, updates);
    return true;
  }

  /**
   * Update last heartbeat
   */
  updateHeartbeat(agentId: string): boolean {
    const agent = this.agents.get(agentId);
    if (!agent) return false;

    agent.lastHeartbeat = new Date();
    const connection = this.connections.get(agentId);
    if (connection) {
      connection.isAlive = true;
    }
    return true;
  }

  /**
   * Mark connection as inactive (failed heartbeat)
   */
  markInactive(agentId: string): boolean {
    const connection = this.connections.get(agentId);
    if (!connection) return false;

    connection.isAlive = false;
    return true;
  }

  /**
   * Check if connection is alive
   */
  isAlive(agentId: string): boolean {
    const connection = this.connections.get(agentId);
    return connection?.isAlive ?? false;
  }

  /**
   * Get all agents
   */
  getAllAgents(): Agent[] {
    return Array.from(this.agents.values());
  }

  /**
   * Get all agents formatted for client
   */
  getAllAgentsForClient(): Omit<Agent, 'socketId'>[] {
    return this.getAllAgents().map(formatAgentForClient);
  }

  /**
   * Get all connections
   */
  getAllConnections(): AgentConnection[] {
    return Array.from(this.connections.values());
  }

  /**
   * Get agents by status
   */
  getAgentsByStatus(status: Agent['status']): Agent[] {
    return this.getAllAgents().filter(agent => agent.status === status);
  }

  /**
   * Get agents by type
   */
  getAgentsByType(type: string): Agent[] {
    return this.getAllAgents().filter(agent => agent.type === type);
  }

  /**
   * Get agent statistics
   */
  getStats(): AgentStats {
    const all = this.getAllAgents();
    return {
      totalAgents: all.length,
      onlineAgents: all.filter(a => a.status === 'online').length,
      busyAgents: all.filter(a => a.status === 'busy').length,
      idleAgents: all.filter(a => a.status === 'idle').length,
      errorAgents: all.filter(a => a.status === 'error').length,
    };
  }

  /**
   * Get total count
   */
  getCount(): number {
    return this.agents.size;
  }

  /**
   * Send message to specific agent
   */
  sendToAgent(agentId: string, message: string): boolean {
    const connection = this.connections.get(agentId);
    if (!connection) return false;

    try {
      connection.socket.send(message);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Broadcast message to all agents
   */
  broadcast(message: string, excludeAgentId?: string): void {
    for (const [agentId, connection] of this.connections) {
      if (excludeAgentId && agentId === excludeAgentId) continue;
      try {
        connection.socket.send(message);
      } catch {
        // Socket error - will be cleaned up on next heartbeat check
      }
    }
  }

  /**
   * Broadcast message to agents by type
   */
  broadcastToType(type: string, message: string, excludeAgentId?: string): void {
    for (const [agentId, connection] of this.connections) {
      if (connection.agent.type === type) {
        if (excludeAgentId && agentId === excludeAgentId) continue;
        try {
          connection.socket.send(message);
        } catch {
          // Socket error
        }
      }
    }
  }

  /**
   * Cleanup stale connections
   */
  cleanupInactive(): string[] {
    const removed: string[] = [];
    for (const [agentId, connection] of this.connections) {
      if (!connection.isAlive) {
        this.unregisterAgent(agentId);
        removed.push(agentId);
      }
    }
    return removed;
  }

  /**
   * Clear all agents (for shutdown)
   */
  clear(): void {
    this.agents.clear();
    this.connections.clear();
    this.socketToAgent.clear();
  }
}

// Singleton instance
export const agentRegistry = new AgentRegistry();
