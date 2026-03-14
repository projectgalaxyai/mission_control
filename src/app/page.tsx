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
    connectionError,
    agents,
    registeredAgentId,
    openAgentSessions,
    groupChatOpen,
    messages,
    addMessage,
    openAgentSession,
    sendMessage,
  } = useBridge();

  // Initialize mock messages on mount
  useEffect(() => {
    MOCK_MESSAGES.forEach((msg) => addMessage(msg));
  }, [addMessage]);

  const handleSendMessage = useCallback(
    (content: string, to: string | 'broadcast' = 'broadcast') => {
      sendMessage(content, to);
    },
    [sendMessage]
  );

  return (
    <div className="h-screen w-screen bg-bridge-bg bridge-grid-bg neural-bg flex flex-col overflow-hidden">
      {/* WebSocket connection manager */}
      <WebSocketManager />

      {/* Header */}
      <Header />

      {/* Main content area */}
      <div className="flex-1 flex overflow-hidden">
        {/* Sidebar - Agent List (other agents only; never show "Command" / you) */}
        <Sidebar
          agents={agents}
          myAgentId={registeredAgentId}
          openAgentSession={openAgentSession}
        />

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
          <div className="text-center max-w-sm px-4">
            <div className="w-16 h-16 border-4 border-bridge-accent/20 border-t-bridge-accent rounded-full animate-spin mb-4 mx-auto" />
            <h2 className="text-xl font-bold text-glow">ESTABLISHING UPLINK...</h2>
            <p className="text-bridge-textMuted mt-2">Connecting to Mission Control</p>
            <p className="text-bridge-textMuted/80 text-xs mt-4">Open this app at <strong>http://localhost:3000</strong>. Server runs on port 3001.</p>
          </div>
        </div>
      )}
      {connectionStatus === 'error' && (
        <div className="fixed bottom-4 left-4 right-4 md:left-auto md:right-4 md:max-w-sm bg-bridge-surface border border-bridge-error/50 rounded-lg p-3 shadow-lg z-50">
          <p className="text-sm font-medium text-bridge-error">Connection error</p>
          {connectionError && <p className="text-xs text-bridge-textMuted mt-1">{connectionError}</p>}
          <p className="text-xs text-bridge-textMuted mt-2">
            Start the Mission Control server in another terminal: <code className="bg-bridge-surface2 px-1 rounded">npm run server</code>
          </p>
        </div>
      )}
    </div>
  );
}
