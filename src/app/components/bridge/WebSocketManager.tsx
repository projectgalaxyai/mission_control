'use client';

import React, { useEffect, useRef } from 'react';
import { useBridge } from '@/app/context/BridgeContext';
import { missionControlWS, wsRef, userAgentId, isWsConnected } from '@/lib/websocket-client';
import type { Agent, Task } from '@/types';

// Re-export for consumers that still import from here
export { wsRef, userAgentId, isWsConnected };

/** Normalize agent dates from server (ISO strings) to Date for frontend */
function normalizeAgents(raw: unknown[]): Agent[] {
  return (raw || []).map((a: Record<string, unknown>) => {
    if (!a || typeof a !== 'object') return a as Agent;
    return {
      ...a,
      connectedAt: a.connectedAt instanceof Date ? a.connectedAt : new Date((a.connectedAt as string) || Date.now()),
      lastHeartbeat: a.lastHeartbeat instanceof Date ? a.lastHeartbeat : new Date((a.lastHeartbeat as string) || Date.now()),
      socketId: (a.socketId as string) ?? '',
    } as Agent;
  });
}

/** Normalize task from server (ensure timestamp strings) */
function normalizeTask(raw: Record<string, unknown>): Task {
  const now = new Date().toISOString();
  return {
    id: (raw.id as string) ?? '',
    title: (raw.title as string) ?? '',
    description: (raw.description as string) ?? '',
    assignedTo: (raw.assignedTo as string) ?? '',
    status: (raw.status as Task['status']) ?? 'pending',
    project: (raw.project as Task['project']) ?? 'General',
    createdAt: typeof raw.createdAt === 'string' ? raw.createdAt : (raw.createdAt instanceof Date ? raw.createdAt.toISOString() : now),
    updatedAt: typeof raw.updatedAt === 'string' ? raw.updatedAt : (raw.updatedAt instanceof Date ? raw.updatedAt.toISOString() : now),
  };
}

const isDev = process.env.NODE_ENV === 'development';

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
    addTask,
    updateTaskStatus,
    setTasks,
    registerSendMessage,
  } = useBridge();

  const unsubRef = useRef<(() => void)[]>([]);

  // Register send function so Bridge can send messages via the singleton
  useEffect(() => {
    const sendFn = (content: string, to: string) => {
      const agentId = missionControlWS.getAgentId();
      if (!missionControlWS.isConnected() || !agentId) return;
      missionControlWS.send({
        type: 'message',
        id: `msg-${Date.now()}`,
        timestamp: new Date().toISOString(),
        from: agentId,
        to,
        content,
        channel: to === 'broadcast' ? 'main' : 'private',
      });
    };
    registerSendMessage(sendFn);
    return () => registerSendMessage(null);
  }, [registerSendMessage]);

  // Connect on mount and subscribe to singleton events; in dev do not disconnect on unmount (survive HMR)
  useEffect(() => {
    const unsubOpen = missionControlWS.on('open', () => {
      setConnectionStatus('connected');
      addNotification({
        type: 'success',
        title: 'Connected',
        message: 'Bridge uplink established',
      });
    });

    const unsubClose = missionControlWS.on('close', ({ reason }) => {
      setRegisteredAgentId(null);
      setConnectionStatus('disconnected', reason || undefined);
    });

    const unsubError = missionControlWS.on('error', (err) => {
      const msg = err instanceof Error ? err.message : 'WebSocket error';
      setConnectionStatus('error', msg);
    });

    const unsubMessage = missionControlWS.on('message', (data: Record<string, unknown>) => {
      try {
        const type = data.type as string;
        switch (type) {
          case 'register':
            if (data.success && data.agentId) {
              setRegisteredAgentId(data.agentId as string);
              setTimeout(() => {
                missionControlWS.send({
                  type: 'command',
                  command: 'hydrate_ui',
                  from: 'user',
                  requestId: `req-${Date.now()}`,
                  timestamp: new Date().toISOString(),
                });
              }, 1000);
            }
            break;
          case 'agent_joined':
            agentJoined(normalizeAgents([data.agent])[0] ?? (data.agent as Agent));
            addNotification({
              type: 'info',
              title: 'Agent Online',
              message: `${(data.agent as { name?: string })?.name ?? 'Agent'} has connected`,
              agentId: (data.agent as { id?: string })?.id,
            });
            break;
          case 'agent_left':
            agentLeft(data.agentId as string, data.reason as string | undefined);
            addNotification({
              type: 'warning',
              title: 'Agent Offline',
              message: 'Agent disconnected',
              agentId: data.agentId as string,
            });
            break;
          case 'agent_update':
            agentUpdated(data.agentId as string, data.agent as Partial<Agent>);
            break;
          case 'message':
          case 'broadcast':
            addMessage(data as Parameters<typeof addMessage>[0]);
            break;
          case 'typing':
            setTyping(data.agentId as string, data.isTyping as boolean);
            break;
          case 'system':
            addMessage(data as Parameters<typeof addMessage>[0]);
            break;
          case 'error':
            addNotification({
              type: 'error',
              title: 'Bridge Error',
              message: (data.message as string) || 'Unknown error',
            });
            break;
          case 'agent_list':
            setAgents(normalizeAgents((data.agents as unknown[]) || []));
            break;
          case 'task_created':
            if (data.task && typeof data.task === 'object') {
              addTask(normalizeTask(data.task as Record<string, unknown>));
            }
            break;
          case 'task_updated':
            if (data.task && typeof data.task === 'object') {
              addTask(normalizeTask(data.task as Record<string, unknown>));
            } else if (typeof data.taskId === 'string' && data.status) {
              updateTaskStatus(data.taskId, data.status as Task['status']);
            }
            break;
          case 'task_completed':
            if (typeof data.taskId === 'string') {
              updateTaskStatus(data.taskId, 'completed');
            } else if (data.task && typeof data.task === 'object') {
              const t = normalizeTask(data.task as Record<string, unknown>);
              addTask({ ...t, status: 'completed', updatedAt: new Date().toISOString() });
            }
            break;
          case 'command_response':
            if (data.result && Array.isArray(data.result)) {
              setAgents(normalizeAgents(data.result));
            }
            break;
          case 'heartbeat_ack':
            break;
          default:
            break;
        }
      } catch (err) {
        console.error('[Bridge] Failed to handle message:', err);
      }
    });

    unsubRef.current = [unsubOpen, unsubClose, unsubError, unsubMessage];

    if (missionControlWS.isConnected()) {
      setConnectionStatus('connected');
      const id = missionControlWS.getAgentId();
      if (id) setRegisteredAgentId(id);
    } else {
      setConnectionStatus('connecting');
      missionControlWS.connect();
    }

    return () => {
      unsubRef.current.forEach((fn) => fn());
      unsubRef.current = [];
      // In development, do not disconnect on unmount so HMR/Strict Mode don't kill the connection
      if (!isDev) {
        missionControlWS.disconnect();
        setRegisteredAgentId(null);
      }
    };
  }, [
    setConnectionStatus,
    setRegisteredAgentId,
    agentJoined,
    agentLeft,
    agentUpdated,
    addMessage,
    setTyping,
    addNotification,
    setAgents,
    addTask,
    updateTaskStatus,
    setTasks,
  ]);

  return null;
}
