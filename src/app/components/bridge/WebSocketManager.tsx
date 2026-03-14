'use client';

import React, { useEffect, useRef } from 'react';
import { useBridge } from '@/app/context/BridgeContext';
import type { Agent } from '@/types';

const WS_SERVER_URL = process.env.NEXT_PUBLIC_WS_URL || 'ws://localhost:3001/ws';

// Global ref to WebSocket for sending messages from other components
export const wsRef: { current: WebSocket | null } = { current: null };

// Store the current user's agent ID
export const userAgentId: { current: string | null } = { current: null };

// Helper to check connection
export const isWsConnected = (): boolean => {
  return wsRef.current?.readyState === WebSocket.OPEN;
};

/** Normalize agent dates from server (ISO strings) to Date for frontend */
function normalizeAgents(raw: unknown[]): Agent[] {
  return (raw || []).map((a: any) => {
    if (!a || typeof a !== 'object') return a;
    return {
      ...a,
      connectedAt: a.connectedAt instanceof Date ? a.connectedAt : new Date(a.connectedAt || Date.now()),
      lastHeartbeat: a.lastHeartbeat instanceof Date ? a.lastHeartbeat : new Date(a.lastHeartbeat || Date.now()),
      socketId: a.socketId ?? '',
    };
  });
}

export default function WebSocketManager() {
  const {
    setConnectionStatus,
    setRegisteredAgentId,
    agentJoined,
    agentLeft,
    agentUpdated,
    addMessage,
    setTyping,
    addNotification,
    setAgents,
    registerSendMessage,
  } = useBridge();

  // Prevent StrictMode double-mount from creating duplicate connections
  const isConnecting = useRef(false);
  const hasConnected = useRef(false);
  const reconnectAttempts = useRef(0);

  // Register send function so Bridge can send messages without require()
  useEffect(() => {
    const sendFn = (content: string, to: string) => {
      if (wsRef.current?.readyState !== WebSocket.OPEN || !userAgentId.current) return;
      wsRef.current.send(
        JSON.stringify({
          type: 'message',
          id: `msg-${Date.now()}`,
          timestamp: new Date().toISOString(),
          from: userAgentId.current,
          to,
          content,
          channel: to === 'broadcast' ? 'main' : 'private',
        })
      );
    };
    registerSendMessage(sendFn);
    return () => registerSendMessage(null);
  }, [registerSendMessage]);

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
        wsRef.current = ws;
        // Also expose globally for debugging and cross-module access
        if (typeof window !== 'undefined') {
          (window as any).__missionControlWS = ws;
          (window as any).__missionControlWSRef = wsRef;
        } // Expose for sending messages

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

          // Start heartbeat (use actual agentId once we have it from register response)
          heartbeatInterval = setInterval(() => {
            const aid = userAgentId.current;
            if (aid && ws?.readyState === WebSocket.OPEN) {
              ws.send(
                JSON.stringify({
                  type: 'heartbeat',
                  agentId: aid,
                  status: 'online',
                  timestamp: new Date().toISOString(),
                  id: `hb-${Date.now()}`,
                })
              );
            }
          }, 30000);
        };

        ws.onmessage = (event) => { console.log("[Bridge WS] Raw message received");
          try {
            const data = JSON.parse(event.data);
            switch (data.type) {
              case 'register':
                // Capture our agent ID from server response
                if (data.success && data.agentId) {
                  userAgentId.current = data.agentId;
                  setRegisteredAgentId(data.agentId);
                  console.log('[Bridge] Registered with agentId:', data.agentId);
                }
                break;
              case 'agent_joined':
                agentJoined(normalizeAgents([data.agent])[0] ?? data.agent);
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
                setAgents(normalizeAgents(data.agents || []));
                break;
              case 'command_response':
                if (data.result && Array.isArray(data.result)) {
                  setAgents(normalizeAgents(data.result));
                  console.log('[Bridge] Loaded', data.result.length, 'agents');
                }
                break;
              case 'heartbeat_ack':
                // Server acknowledged our heartbeat; no UI update needed
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
          const msg = err instanceof Error ? err.message : 'WebSocket error';
          setConnectionStatus('error', msg);
        };

        ws.onclose = (code: number, reason: Buffer | string) => {
          console.log('[Bridge] WebSocket disconnected');
          setRegisteredAgentId(null);
          userAgentId.current = null;
          const reasonStr = typeof reason === 'string' ? reason : reason?.toString?.() || '';
          setConnectionStatus('disconnected', reasonStr || undefined);
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
        const errMsg = err instanceof Error ? err.message : 'Connection failed';
        setConnectionStatus('error', errMsg);

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
      setRegisteredAgentId(null);
      userAgentId.current = null;
      isConnecting.current = false;
      hasConnected.current = false;
      ws?.close();
      wsRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- connect once on mount; cleanup clears state so StrictMode re-run can reconnect
  }, []);

  return null;
}
