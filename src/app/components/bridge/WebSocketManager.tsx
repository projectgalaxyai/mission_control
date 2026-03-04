'use client';

import React, { useEffect } from 'react';
import { useBridge } from '@/app/context/BridgeContext';

const WS_SERVER_URL = process.env.NEXT_PUBLIC_WS_URL || 'ws://localhost:3001';

export default function WebSocketManager() {
  const {
    setConnectionStatus,
    agentJoined,
    agentLeft,
    agentUpdated,
    addMessage,
    setTyping,
    addNotification,
    setAgents,
  } = useBridge();

  useEffect(() => {
    let ws: WebSocket | null = null;
    let reconnectTimer: NodeJS.Timeout | null = null;
    let heartbeatInterval: NodeJS.Timeout | null = null;

    const connect = () => {
      setConnectionStatus('connecting');

      try {
        ws = new WebSocket(WS_SERVER_URL);

        ws.onopen = () => {
          console.log('[Bridge] WebSocket connected');
          setConnectionStatus('connected');
          addNotification({
            type: 'success',
            title: 'Connected',
            message: 'Bridge uplink established',
          });

          // Send registration as user
          ws?.send(
            JSON.stringify({
              type: 'register',
              agent: {
                name: 'Command',
                type: 'User',
                status: 'online',
                capabilities: ['command', 'monitoring'],
                metadata: { role: 'Fleet Commander' },
              },
              timestamp: new Date().toISOString(),
              id: `reg-${Date.now()}`,
            })
          );

          // Start heartbeat
          heartbeatInterval = setInterval(() => {
            ws?.send(
              JSON.stringify({
                type: 'heartbeat',
                agentId: 'user',
                status: 'online',
                timestamp: new Date().toISOString(),
                id: `hb-${Date.now()}`,
              })
            );
          }, 30000);
        };

        ws.onmessage = (event) => {
          try {
            const data = JSON.parse(event.data);

            switch (data.type) {
              case 'agent_joined':
                agentJoined(data.agent);
                addNotification({
                  type: 'info',
                  title: 'Agent Online',
                  message: `${data.agent.name} has connected`,
                  agentId: data.agent.id,
                });
                break;

              case 'agent_left':
                agentLeft(data.agentId, data.reason);
                addNotification({
                  type: 'warning',
                  title: 'Agent Offline',
                  message: `Agent disconnected`,
                  agentId: data.agentId,
                });
                break;

              case 'agent_update':
                agentUpdated(data.agentId, data.agent);
                break;

              case 'message':
              case 'broadcast':
                addMessage(data);
                break;

              case 'typing':
                setTyping(data.agentId, data.isTyping);
                break;

              case 'system':
                addMessage(data);
                break;

              case 'error':
                console.error('[Bridge] Server error:', data);
                addNotification({
                  type: 'error',
                  title: 'Bridge Error',
                  message: data.message || 'Unknown error',
                });
                break;

              case 'agent_list':
                setAgents(data.agents);
                break;

              default:
                console.log('[Bridge] Unknown message type:', data.type);
            }
          } catch (err) {
            console.error('[Bridge] Failed to parse message:', err);
          }
        };

        ws.onerror = (err) => {
          console.error('[Bridge] WebSocket error:', err);
          setConnectionStatus('error', 'Connection error');
        };

        ws.onclose = () => {
          console.log('[Bridge] WebSocket disconnected');
          setConnectionStatus('disconnected');

          if (heartbeatInterval) {
            clearInterval(heartbeatInterval);
            heartbeatInterval = null;
          }

          // Auto-reconnect after 3 seconds
          reconnectTimer = setTimeout(() => {
            console.log('[Bridge] Attempting reconnect...');
            connect();
          }, 3000);
        };
      } catch (err) {
        console.error('[Bridge] Connection failed:', err);
        setConnectionStatus('error', 'Failed to connect');

        // Retry after 3 seconds
        reconnectTimer = setTimeout(connect, 3000);
      }
    };

    connect();

    return () => {
      if (reconnectTimer) clearTimeout(reconnectTimer);
      if (heartbeatInterval) clearInterval(heartbeatInterval);
      ws?.close();
    };
  }, [
    setConnectionStatus,
    agentJoined,
    agentLeft,
    agentUpdated,
    addMessage,
    setTyping,
    addNotification,
    setAgents,
  ]);

  return null; // Invisible component
}
