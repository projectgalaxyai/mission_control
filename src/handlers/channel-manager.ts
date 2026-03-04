/**
 * Channel Manager - Manages group chat channels
 */
import type { Channel } from '../types/index.js';
import { generateId, createTimestamp } from '../utils/index.js';
import { agentRegistry } from './agent-registry.js';

export class ChannelManager {
  private channels: Map<string, Channel> = new Map();
  private agentChannels: Map<string, Set<string>> = new Map(); // agentId -> channelIds

  constructor() {
    // Create default channels
    this.createChannel('general', 'General', 'General discussion for all agents');
    this.createChannel('system', 'System', 'System notifications and alerts');
    this.createChannel('debug', 'Debug', 'Debug messages and logs');
  }

  /**
   * Create a new channel
   */
  createChannel(id: string, name: string, description?: string): Channel {
    const channel: Channel = {
      id,
      name,
      description,
      agentIds: new Set(),
      createdAt: new Date(),
    };
    this.channels.set(id, channel);
    return channel;
  }

  /**
   * Get channel by ID
   */
  getChannel(channelId: string): Channel | undefined {
    return this.channels.get(channelId);
  }

  /**
   * Delete a channel
   */
  deleteChannel(channelId: string): boolean {
    const channel = this.channels.get(channelId);
    if (!channel || channel.id === 'general' || channel.id === 'system') {
      return false; // Can't delete default channels
    }

    // Remove all agents from channel
    for (const agentId of channel.agentIds) {
      this.leaveChannel(agentId, channelId);
    }

    return this.channels.delete(channelId);
  }

  /**
   * Join a channel
   */
  joinChannel(agentId: string, channelId: string): boolean {
    const channel = this.channels.get(channelId);
    if (!channel) return false;

    channel.agentIds.add(agentId);
    
    // Track agent's channels
    if (!this.agentChannels.has(agentId)) {
      this.agentChannels.set(agentId, new Set());
    }
    this.agentChannels.get(agentId)!.add(channelId);

    return true;
  }

  /**
   * Leave a channel
   */
  leaveChannel(agentId: string, channelId: string): boolean {
    const channel = this.channels.get(channelId);
    if (!channel) return false;

    channel.agentIds.delete(agentId);
    
    // Update agent's channels
    this.agentChannels.get(agentId)?.delete(channelId);

    return true;
  }

  /**
   * Leave all channels (when agent disconnects)
   */
  leaveAllChannels(agentId: string): void {
    const channelIds = this.agentChannels.get(agentId);
    if (channelIds) {
      for (const channelId of channelIds) {
        this.leaveChannel(agentId, channelId);
      }
    }
    this.agentChannels.delete(agentId);
  }

  /**
   * Check if agent is in channel
   */
  isAgentInChannel(agentId: string, channelId: string): boolean {
    const channel = this.channels.get(channelId);
    return channel ? channel.agentIds.has(agentId) : false;
  }

  /**
   * Get all channels
   */
  getAllChannels(): Channel[] {
    return Array.from(this.channels.values());
  }

  /**
   * Get channels for agent
   */
  getChannelsForAgent(agentId: string): Channel[] {
    const channelIds = this.agentChannels.get(agentId);
    if (!channelIds) return [];
    
    return Array.from(channelIds)
      .map(id => this.channels.get(id))
      .filter((c): c is Channel => c !== undefined);
  }

  /**
   * Get agents in channel
   */
  getAgentsInChannel(channelId: string): string[] {
    const channel = this.channels.get(channelId);
    return channel ? Array.from(channel.agentIds) : [];
  }

  /**
   * Broadcast message to channel
   */
  broadcastToChannel(channelId: string, message: string, excludeAgentId?: string): void {
    const channel = this.channels.get(channelId);
    if (!channel) return;

    for (const agentId of channel.agentIds) {
      if (excludeAgentId && agentId === excludeAgentId) continue;
      agentRegistry.sendToAgent(agentId, message);
    }
  }

  /**
   * Send typing indicator to channel
   */
  sendTypingToChannel(channelId: string, agentId: string, isTyping: boolean): void {
    const typingMessage = JSON.stringify({
      type: 'typing',
      agentId,
      isTyping,
      channel: channelId,
      timestamp: createTimestamp(),
      id: generateId(),
    });

    this.broadcastToChannel(channelId, typingMessage, agentId);
  }

  /**
   * Get channel count
   */
  getChannelCount(): number {
    return this.channels.size;
  }

  /**
   * Format channel for client (converts Set to Array)
   */
  formatChannelForClient(channel: Channel): Omit<Channel, 'agentIds'> & { agentIds: string[]; memberCount: number } {
    return {
      id: channel.id,
      name: channel.name,
      description: channel.description,
      createdAt: channel.createdAt,
      agentIds: Array.from(channel.agentIds),
      memberCount: channel.agentIds.size,
    };
  }
}

// Singleton instance
export const channelManager = new ChannelManager();
