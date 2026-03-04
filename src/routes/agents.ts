/**
 * Agent Routes - REST API endpoints for agent management
 */
import { Router, Request, Response } from 'express';
import { agentRegistry } from '../handlers/agent-registry.js';
import { channelManager } from '../handlers/channel-manager.js';
import { getMetrics } from '../handlers/message-handler.js';
import { formatAgentForClient } from '../utils/index.js';

const router = Router();

/**
 * GET /api/agents - List all agents
 */
router.get('/agents', (req: Request, res: Response) => {
  const agents = agentRegistry.getAllAgentsForClient();
  res.json({
    success: true,
    data: agents,
    count: agents.length,
  });
});

/**
 * GET /api/agents/stats - Get agent statistics
 */
router.get('/agents/stats', (req: Request, res: Response) => {
  const stats = agentRegistry.getStats();
  res.json({
    success: true,
    data: stats,
  });
});

/**
 * GET /api/agents/:id - Get specific agent
 */
router.get('/agents/:id', (req: Request, res: Response) => {
  const { id } = req.params;
  const agent = agentRegistry.getAgent(id);
  
  if (!agent) {
    res.status(404).json({
      success: false,
      error: 'Agent not found',
    });
    return;
  }

  res.json({
    success: true,
    data: formatAgentForClient(agent),
  });
});

/**
 * GET /api/agents/:id/channels - Get agent's channels
 */
router.get('/agents/:id/channels', (req: Request, res: Response) => {
  const { id } = req.params;
  const agent = agentRegistry.getAgent(id);
  
  if (!agent) {
    res.status(404).json({
      success: false,
      error: 'Agent not found',
    });
    return;
  }

  const channels = channelManager.getChannelsForAgent(id).map(c => 
    channelManager.formatChannelForClient(c)
  );

  res.json({
    success: true,
    data: channels,
    count: channels.length,
  });
});

/**
 * POST /api/agents/:id/kick - Kick an agent from the server
 */
router.post('/agents/:id/kick', (req: Request, res: Response) => {
  const { id } = req.params;
  const { reason } = req.body || {};
  
  const agent = agentRegistry.getAgent(id);
  if (!agent) {
    res.status(404).json({
      success: false,
      error: 'Agent not found',
    });
    return;
  }

  // Send kick message to agent
  const connection = agentRegistry.getConnection(id);
  if (connection) {
    const kickMessage = JSON.stringify({
      type: 'system',
      level: 'error',
      content: `You have been kicked from the server: ${reason || 'No reason provided'}`,
      timestamp: new Date().toISOString(),
      id: crypto.randomUUID(),
    });
    try {
      connection.socket.close(1000, 'Kicked by admin');
    } catch {
      // Socket already closed
    }
  }

  // Remove from registry
  agentRegistry.unregisterAgent(id);
  channelManager.leaveAllChannels(id);

  res.json({
    success: true,
    message: `Agent ${agent.name} has been kicked`,
    agentId: id,
  });
});

/**
 * GET /api/channels - List all channels
 */
router.get('/channels', (req: Request, res: Response) => {
  const channels = channelManager.getAllChannels().map(c => 
    channelManager.formatChannelForClient(c)
  );
  
  res.json({
    success: true,
    data: channels,
    count: channels.length,
  });
});

/**
 * GET /api/channels/:id - Get specific channel
 */
router.get('/channels/:id', (req: Request, res: Response) => {
  const { id } = req.params;
  const channel = channelManager.getChannel(id);
  
  if (!channel) {
    res.status(404).json({
      success: false,
      error: 'Channel not found',
    });
    return;
  }

  // Get agent details for each member
  const members = Array.from(channel.agentIds).map(agentId => {
    const agent = agentRegistry.getAgent(agentId);
    return agent ? formatAgentForClient(agent) : null;
  }).filter(Boolean);

  res.json({
    success: true,
    data: {
      ...channelManager.formatChannelForClient(channel),
      members,
    },
  });
});

/**
 * POST /api/channels - Create new channel
 */
router.post('/channels', (req: Request, res: Response) => {
  const { id, name, description } = req.body;
  
  if (!id || !name) {
    res.status(400).json({
      success: false,
      error: 'Channel ID and name are required',
    });
    return;
  }

  // Check if channel already exists
  if (channelManager.getChannel(id)) {
    res.status(409).json({
      success: false,
      error: 'Channel with this ID already exists',
    });
    return;
  }

  const channel = channelManager.createChannel(id, name, description);
  
  res.status(201).json({
    success: true,
    data: channelManager.formatChannelForClient(channel),
  });
});

/**
 * DELETE /api/channels/:id - Delete a channel
 */
router.delete('/channels/:id', (req: Request, res: Response) => {
  const { id } = req.params;
  
  if (id === 'general' || id === 'system') {
    res.status(403).json({
      success: false,
      error: 'Cannot delete default channels',
    });
    return;
  }

  const success = channelManager.deleteChannel(id);
  
  if (!success) {
    res.status(404).json({
      success: false,
      error: 'Channel not found or cannot be deleted',
    });
    return;
  }

  res.json({
    success: true,
    message: 'Channel deleted',
  });
});

/**
 * GET /api/metrics - Get server metrics
 */
router.get('/metrics', (req: Request, res: Response) => {
  const messageMetrics = getMetrics();
  const agentStats = agentRegistry.getStats();
  
  res.json({
    success: true,
    data: {
      messages: messageMetrics,
      agents: agentStats,
      uptime: process.uptime(),
      timestamp: new Date().toISOString(),
    },
  });
});

/**
 * GET /api/health - Health check
 */
router.get('/health', (req: Request, res: Response) => {
  res.json({
    success: true,
    status: 'healthy',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
  });
});

export default router;
