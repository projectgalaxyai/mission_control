'use client';

import React, { useEffect, useRef } from 'react';
import { useBridge } from '@/app/context/BridgeContext';

const WS_SERVER_URL = process.env.NEXT_PUBLIC_WS_URL || 'ws://localhost:3001/ws';

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

  // Prevent StrictMode double-mount from creating duplicate connections
  const isConnecting = useRef(false);
  const hasConnected = useRef(false);
  const reconnectAttempts = useRef(0);

  useEffect(() => {
    // StrictMode guard - don't connect twice
    if (isConnecting.current || hasConnected.current) {
      console.log('[Bridge] Already connecting or connected, skipping...');
      return;
    }

    let ws: WebSocket | null = null;
    let reconnectTimer: NodeJS.Timeout | null = null;
    let heartbeatInterval: NodeJS.Timeout | null = null;
    const MAX_RECONNECT_DELAY = 30000;

    const connect = () => {
      if (isConnecting.current) return;
      isConnecting.current = true;
      
      setConnectionStatus('connecting');
      console.log('[Bridge] Connecting to', WS_SERVER_URL);

      try {
        ws = new WebSocket(WS_SERVER_URL);

        ws.onopen = () => {
          console.log('[Bridge] WebSocket connected');
          isConnecting.current = false;
          hasConnected.current = true;
          reconnectAttempts.current = 0;
          
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

          // Explicitly request agent list after registration
          setTimeout(() => {
            ws?.send(
              JSON.stringify({
                type: 'command',
                command: 'getAgents',
                from: 'user',
                requestId: `req-${Date.now()}`,
                args: {},
                timestamp: new Date().toISOString(),
                id: `cmd-${Date.now()}`,
              })
            );
            console.log('[Bridge] Requested agent list');
          }, 500);

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
                setAgents(data.agents || []);
                break;
              case 'command_response':
                if (data.result && Array.isArray(data.result)) {
                  // getAgents response
                  setAgents(data.result);
                  console.log('[Bridge] Loaded', data.result.length, 'agents');
                }
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
          setConnectionStatus('error');
        };

        ws.onclose = () => {
          console.log('[Bridge] WebSocket disconnected');
          setConnectionStatus('disconnected');
          isConnecting.current = false;
          
          if (heartbeatInterval) {
            clearInterval(heartbeatInterval);
            heartbeatInterval = null;
          }

          // Exponential backoff for reconnect
          reconnectAttempts.current++;
          const delay = Math.min(
            3000 * Math.pow(2, reconnectAttempts.current - 1),
            MAX_RECONNECT_DELAY
          );
          console.log(`[Bridge] Reconnecting in ${delay}ms (attempt ${reconnectAttempts.current})...`);
          
          reconnectTimer = setTimeout(() => {
            connect();
          }, delay);
        };
      } catch (err) {
        console.error('[Bridge] Connection failed:', err);
        isConnecting.current = false;
        setConnectionStatus('error');
        
        // Retry with backoff
        reconnectAttempts.current++;
        const delay = Math.min(
          3000 * Math.pow(2, reconnectAttempts.current - 1),
          MAX_RECONNECT_DELAY
        );
        reconnectTimer = setTimeout(connect, delay);
      }
    };

    connect();

    return () => {
      if (reconnectTimer) clearTimeout(reconnectTimer);
      if (heartbeatInterval) clearInterval(heartbeatInterval);
      ws?.close();
    };
  }, []); // Empty deps - only run once on mount

  return null;
}
