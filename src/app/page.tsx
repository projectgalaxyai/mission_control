'use client';

import React, { useEffect, useCallback } from 'react';
import { useBridge } from '@/app/context/BridgeContext';
import Header from '@/app/components/bridge/Header';
import Sidebar from '@/app/components/bridge/Sidebar';
import ChatCanvas from '@/app/components/bridge/ChatCanvas';
import GroupChat from '@/app/components/bridge/GroupChat';
import NotificationPanel from '@/app/components/bridge/NotificationPanel';
import WebSocketManager from '@/app/components/bridge/WebSocketManager';
import type { Agent, ChatMessage, SystemMessage } from '@/types';

// Mock data for initial development
const MOCK_AGENTS: Agent[] = [
  {
    id: 'agent-1',
    name: 'Orion',
    type: 'Director',
    status: 'online',
    capabilities: ['task-assignment', 'coordination', 'monitoring'],
    metadata: { role: 'Mission Director' },
    connectedAt: new Date(),
    lastHeartbeat: new Date(),
    socketId: 'ws-1',
  },
  {
    id: 'agent-2',
    name: 'Dev',
    type: 'Engineer',
    status: 'busy',
    capabilities: ['coding', 'debugging', 'architecture'],
    metadata: { role: 'Lead Engineer' },
    connectedAt: new Date(),
    lastHeartbeat: new Date(),
    socketId: 'ws-2',
  },
  {
    id: 'agent-3',
    name: 'Hestia',
    type: 'Infrastructure',
    status: 'idle',
    capabilities: ['deployment', 'monitoring', 'maintenance'],
    metadata: { role: 'System Administrator' },
    connectedAt: new Date(),
    lastHeartbeat: new Date(),
    socketId: 'ws-3',
  },
  {
    id: 'agent-4',
    name: 'Pixel',
    type: 'Creative',
    status: 'online',
    capabilities: ['design', 'ui-ux', 'branding'],
    metadata: { role: 'Visual Designer' },
    connectedAt: new Date(),
    lastHeartbeat: new Date(),
    socketId: 'ws-4',
  },
];

const MOCK_MESSAGES: (ChatMessage | SystemMessage)[] = [
  {
    type: 'system',
    level: 'info',
    content: 'Welcome to THE BRIDGE. Session initialized.',
    timestamp: new Date(Date.now() - 3600000).toISOString(),
    id: 'sys-1',
  } as SystemMessage,
  {
    type: 'message',
    from: 'agent-1',
    to: 'broadcast',
    content: 'All systems nominal. Standing by for mission directives.',
    channel: 'main',
    timestamp: new Date(Date.now() - 1800000).toISOString(),
    id: 'msg-1',
  } as ChatMessage,
  {
    type: 'message',
    from: 'agent-2',
    to: 'broadcast',
    content: 'Codebase synced. Ready for deployment.',
    channel: 'main',
    timestamp: new Date(Date.now() - 900000).toISOString(),
    id: 'msg-2',
  } as ChatMessage,
];

export default function BridgePage() {
  const {
    connectionStatus,
    agents,
    openAgentSessions,
    groupChatOpen,
    messages,
    setConnectionStatus,
    setAgents,
    addMessage,
    addNotification,
    openAgentSession,
  } = useBridge();

  // Initialize mock data on mount
  useEffect(() => {
    setAgents(MOCK_AGENTS);
    MOCK_MESSAGES.forEach((msg) => addMessage(msg));

    // Simulate connection
    setConnectionStatus('connecting');
    const timer = setTimeout(() => {
      setConnectionStatus('connected');
      addNotification({
        type: 'success',
        title: 'Connected',
        message: 'Successfully connected to Mission Control server',
      });
    }, 1500);
    return () => clearTimeout(timer);
  }, []);

  const handleSendMessage = useCallback(
    (content: string, to: string | 'broadcast' = 'broadcast') => {
      const message: ChatMessage = {
        type: 'message',
        id: `msg-${Date.now()}`,
        timestamp: new Date().toISOString(),
        from: 'user',
        to,
        content,
        channel: to === 'broadcast' ? 'main' : 'private',
      };
      addMessage(message);
    },
    [addMessage]
  );

  return (
    <div className="h-screen w-screen bg-bridge-bg bridge-grid-bg neural-bg flex flex-col overflow-hidden">
      {/* WebSocket connection manager */}
      <WebSocketManager />

      {/* Header */}
      <Header />

      {/* Main content area */}
      <div className="flex-1 flex overflow-hidden">
        {/* Sidebar - Agent List */}
        <Sidebar agents={agents} openAgentSession={openAgentSession} />

        {/* Chat Canvas - Floating windows */}
        <ChatCanvas
          openSessions={openAgentSessions}
          messages={messages.filter((m) => m.type === 'message') as ChatMessage[]}
          onSendMessage={handleSendMessage}
        />
      </div>

      {/* Bottom Group Chat Panel */}
      <GroupChat
        messages={messages}
        isOpen={groupChatOpen}
        onSendMessage={handleSendMessage}
      />

      {/* Notification Panel */}
      <NotificationPanel />

      {/* Connection status overlay */}
      {connectionStatus === 'connecting' && (
        <div className="fixed inset-0 bg-bridge-bg/90 flex items-center justify-center z-50">
          <div className="text-center">
            <div className="w-16 h-16 border-4 border-bridge-accent/20 border-t-bridge-accent rounded-full animate-spin mb-4 mx-auto" />
            <h2 className="text-xl font-bold text-glow">ESTABLISHING UPLINK...</h2>
            <p className="text-bridge-textMuted mt-2">Connecting to Mission Control</p>
          </div>
        </div>
      )}
    </div>
  );
}
