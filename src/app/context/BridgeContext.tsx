'use client';

import React, { createContext, useContext, useReducer, useCallback, useRef, ReactNode } from 'react';
import type { Agent, ChatMessage, SystemMessage } from '@/types';

export interface WindowPosition {
  x: number; y: number; width: number; height: number; zIndex: number;
}

export interface AgentSession {
  agent: Agent;
  isMinimized: boolean;
  isMaximized: boolean;
  position: WindowPosition;
  unreadCount: number;
}

export interface UserPreferences {
  sidebarOpen: boolean; soundEnabled: boolean; notificationsEnabled: boolean;
  theme: 'dark' | 'light'; compactMode: boolean;
}

export type ConnectionStatus = 'connected' | 'connecting' | 'disconnected' | 'error';

export interface Notification {
  id: string; type: 'info' | 'success' | 'warning' | 'error';
  title: string; message: string; timestamp: Date; read: boolean; agentId?: string;
}

export interface BridgeState {
  connectionStatus: ConnectionStatus; connectionError?: string; serverUrl: string;
  registeredAgentId: string | null;
  agents: Agent[]; openAgentSessions: Record<string, AgentSession>;
  selectedAgentId: string | null; messages: (ChatMessage | SystemMessage)[];
  typingAgents: Record<string, boolean>; sidebarOpen: boolean;
  notifications: Notification[]; groupChatOpen: boolean; preferences: UserPreferences;
}

type BridgeAction =
  | { type: 'SET_CONNECTION_STATUS'; payload: { status: ConnectionStatus; error?: string } }
  | { type: 'SET_REGISTERED_AGENT_ID'; payload: string | null }
  | { type: 'SET_AGENTS'; payload: Agent[] }
  | { type: 'AGENT_JOINED'; payload: Agent }
  | { type: 'AGENT_LEFT'; payload: { agentId: string; reason?: string } }
  | { type: 'AGENT_UPDATED'; payload: Partial<Agent> & { id: string } }
  | { type: 'OPEN_AGENT_SESSION'; payload: Agent }
  | { type: 'CLOSE_AGENT_SESSION'; payload: string }
  | { type: 'MINIMIZE_AGENT_SESSION'; payload: string }
  | { type: 'RESTORE_AGENT_SESSION'; payload: string }
  | { type: 'UPDATE_WINDOW_POSITION'; payload: { agentId: string; position: Partial<WindowPosition> } }
  | { type: 'SELECT_AGENT'; payload: string | null }
  | { type: 'ADD_MESSAGE'; payload: ChatMessage | SystemMessage }
  | { type: 'SET_TYPING'; payload: { agentId: string; isTyping: boolean } }
  | { type: 'TOGGLE_SIDEBAR' }
  | { type: 'ADD_NOTIFICATION'; payload: Omit<Notification, 'id' | 'timestamp' | 'read'> }
  | { type: 'MARK_NOTIFICATION_READ'; payload: string }
  | { type: 'CLEAR_NOTIFICATIONS' }
  | { type: 'TOGGLE_GROUP_CHAT' }
  | { type: 'MARK_SESSION_READ'; payload: string }
  | { type: 'REORDER_WINDOWS'; payload: { agentId: string; zIndex: number } };

const initialState: BridgeState = {
  connectionStatus: 'disconnected', serverUrl: '', registeredAgentId: null, agents: [],
  openAgentSessions: {}, selectedAgentId: null, messages: [], typingAgents: {},
  sidebarOpen: true, notifications: [], groupChatOpen: true,
  preferences: { sidebarOpen: true, soundEnabled: true, notificationsEnabled: true, theme: 'dark', compactMode: false },
};

function bridgeReducer(state: BridgeState, action: BridgeAction): BridgeState {
  switch (action.type) {
    case 'SET_CONNECTION_STATUS': return { ...state, connectionStatus: action.payload.status, connectionError: action.payload.error };
    case 'SET_REGISTERED_AGENT_ID': return { ...state, registeredAgentId: action.payload };
    case 'SET_AGENTS': return { ...state, agents: action.payload };
    case 'AGENT_JOINED': return { ...state, agents: [...state.agents.filter(a => a.id !== action.payload.id), action.payload] };
    case 'AGENT_LEFT': { const { [action.payload.agentId]: _, ...s } = state.openAgentSessions; return { ...state, agents: state.agents.filter(a => a.id !== action.payload.agentId), openAgentSessions: s }; }
    case 'AGENT_UPDATED': return { ...state, agents: state.agents.map(a => a.id === action.payload.id ? { ...a, ...action.payload } : a) };
    case 'OPEN_AGENT_SESSION': {
      const { id } = action.payload;
      if (state.openAgentSessions[id]) return { ...state, openAgentSessions: { ...state.openAgentSessions, [id]: { ...state.openAgentSessions[id], isMinimized: false, unreadCount: 0 } }, selectedAgentId: id };
      const c = Object.keys(state.openAgentSessions).length;
      return { ...state, openAgentSessions: { ...state.openAgentSessions, [id]: { agent: action.payload, isMinimized: false, isMaximized: false, position: { x: 350 + (c % 3) * 340, y: 80 + Math.floor(c / 3) * 400, width: 320, height: 380, zIndex: c + 10 }, unreadCount: 0 } }, selectedAgentId: id };
    }
    case 'CLOSE_AGENT_SESSION': { const { [action.payload]: _, ...r } = state.openAgentSessions; return { ...state, openAgentSessions: r, selectedAgentId: state.selectedAgentId === action.payload ? null : state.selectedAgentId }; }
    case 'MINIMIZE_AGENT_SESSION': return { ...state, openAgentSessions: { ...state.openAgentSessions, [action.payload]: { ...state.openAgentSessions[action.payload], isMinimized: true } } };
    case 'RESTORE_AGENT_SESSION': return { ...state, openAgentSessions: { ...state.openAgentSessions, [action.payload]: { ...state.openAgentSessions[action.payload], isMinimized: false, isMaximized: false } } };
    case 'UPDATE_WINDOW_POSITION': return { ...state, openAgentSessions: { ...state.openAgentSessions, [action.payload.agentId]: { ...state.openAgentSessions[action.payload.agentId], position: { ...state.openAgentSessions[action.payload.agentId].position, ...action.payload.position } } } };
    case 'SELECT_AGENT': return { ...state, selectedAgentId: action.payload };
    case 'ADD_MESSAGE': return { ...state, messages: [...state.messages, action.payload] };
    case 'SET_TYPING': return { ...state, typingAgents: { ...state.typingAgents, [action.payload.agentId]: action.payload.isTyping } };
    case 'TOGGLE_SIDEBAR': return { ...state, sidebarOpen: !state.sidebarOpen };
    case 'ADD_NOTIFICATION': { const n: Notification = { ...action.payload, id: `notif-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`, timestamp: new Date(), read: false }; return { ...state, notifications: [n, ...state.notifications.slice(0, 49)] }; }
    case 'MARK_NOTIFICATION_READ': return { ...state, notifications: state.notifications.map(n => n.id === action.payload ? { ...n, read: true } : n) };
    case 'CLEAR_NOTIFICATIONS': return { ...state, notifications: [] };
    case 'TOGGLE_GROUP_CHAT': return { ...state, groupChatOpen: !state.groupChatOpen };
    case 'MARK_SESSION_READ': return state.openAgentSessions[action.payload] ? { ...state, openAgentSessions: { ...state.openAgentSessions, [action.payload]: { ...state.openAgentSessions[action.payload], unreadCount: 0 } } } : state;
    case 'REORDER_WINDOWS': return { ...state, openAgentSessions: { ...state.openAgentSessions, [action.payload.agentId]: { ...state.openAgentSessions[action.payload.agentId], position: { ...state.openAgentSessions[action.payload.agentId].position, zIndex: action.payload.zIndex } } } };
    default: return state;
  }
}

export type SendMessageFn = (content: string, to: string) => void;

interface BridgeContextType extends BridgeState {
  dispatch: React.Dispatch<BridgeAction>;
  openAgentSession: (agent: Agent) => void; closeAgentSession: (agentId: string) => void;
  minimizeAgentSession: (agentId: string) => void; restoreAgentSession: (agentId: string) => void;
  updateWindowPosition: (agentId: string, position: Partial<WindowPosition>) => void;
  selectAgent: (agentId: string | null) => void;
  addMessage: (message: ChatMessage | SystemMessage) => void;
  setTyping: (agentId: string, isTyping: boolean) => void;
  toggleSidebar: () => void; toggleGroupChat: () => void;
  addNotification: (notification: Omit<Notification, 'id' | 'timestamp' | 'read'>) => void;
  markNotificationRead: (id: string) => void; clearNotifications: () => void;
  markSessionRead: (agentId: string) => void; setConnectionStatus: (status: ConnectionStatus, error?: string) => void;
  setRegisteredAgentId: (id: string | null) => void;
  setAgents: (agents: Agent[]) => void; agentJoined: (agent: Agent) => void;
  agentLeft: (agentId: string, reason?: string) => void; agentUpdated: (agentId: string, updates: Partial<Agent>) => void;
  bringToFront: (agentId: string) => void;
  registerSendMessage: (fn: SendMessageFn | null) => void;
  sendMessage: (content: string, to: string) => void;
}

const BridgeContext = createContext<BridgeContextType | null>(null);

export function BridgeProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(bridgeReducer, initialState);

  const openAgentSession = useCallback((agent: Agent) => dispatch({ type: 'OPEN_AGENT_SESSION', payload: agent }), []);
  const closeAgentSession = useCallback((agentId: string) => dispatch({ type: 'CLOSE_AGENT_SESSION', payload: agentId }), []);
  const minimizeAgentSession = useCallback((agentId: string) => dispatch({ type: 'MINIMIZE_AGENT_SESSION', payload: agentId }), []);
  const restoreAgentSession = useCallback((agentId: string) => dispatch({ type: 'RESTORE_AGENT_SESSION', payload: agentId }), []);
  const updateWindowPosition = useCallback((agentId: string, position: Partial<WindowPosition>) => dispatch({ type: 'UPDATE_WINDOW_POSITION', payload: { agentId, position } }), []);
  const selectAgent = useCallback((agentId: string | null) => dispatch({ type: 'SELECT_AGENT', payload: agentId }), []);
  const addMessage = useCallback((message: ChatMessage | SystemMessage) => dispatch({ type: 'ADD_MESSAGE', payload: message }), []);
  const setTyping = useCallback((agentId: string, isTyping: boolean) => dispatch({ type: 'SET_TYPING', payload: { agentId, isTyping } }), []);
  const toggleSidebar = useCallback(() => dispatch({ type: 'TOGGLE_SIDEBAR' }), []);
  const toggleGroupChat = useCallback(() => dispatch({ type: 'TOGGLE_GROUP_CHAT' }), []);
  const addNotification = useCallback((notification: Omit<Notification, 'id' | 'timestamp' | 'read'>) => dispatch({ type: 'ADD_NOTIFICATION', payload: notification }), []);
  const markNotificationRead = useCallback((id: string) => dispatch({ type: 'MARK_NOTIFICATION_READ', payload: id }), []);
  const clearNotifications = useCallback(() => dispatch({ type: 'CLEAR_NOTIFICATIONS' }), []);
  const markSessionRead = useCallback((agentId: string) => dispatch({ type: 'MARK_SESSION_READ', payload: agentId }), []);
  const setConnectionStatus = useCallback((status: ConnectionStatus, error?: string) => dispatch({ type: 'SET_CONNECTION_STATUS', payload: { status, error } }), []);
  const setRegisteredAgentId = useCallback((id: string | null) => dispatch({ type: 'SET_REGISTERED_AGENT_ID', payload: id }), []);
  const setAgents = useCallback((agents: Agent[]) => dispatch({ type: 'SET_AGENTS', payload: agents }), []);
  const agentJoined = useCallback((agent: Agent) => dispatch({ type: 'AGENT_JOINED', payload: agent }), []);
  const agentLeft = useCallback((agentId: string, reason?: string) => dispatch({ type: 'AGENT_LEFT', payload: { agentId, reason } }), []);
  const agentUpdated = useCallback((agentId: string, agent: Partial<Agent>) => dispatch({ type: 'AGENT_UPDATED', payload: { id: agentId, ...agent } }), []);
  const bringToFront = useCallback((agentId: string) => {
    const maxZ = Math.max(10, ...Object.values(state.openAgentSessions).map(s => s.position.zIndex));
    dispatch({ type: 'REORDER_WINDOWS', payload: { agentId, zIndex: maxZ + 1 } });
  }, [state.openAgentSessions]);

  const sendMessageRef = useRef<SendMessageFn | null>(null);
  const registerSendMessage = useCallback((fn: SendMessageFn | null) => {
    sendMessageRef.current = fn;
  }, []);
  const sendMessage = useCallback((content: string, to: string) => {
    if (!state.registeredAgentId) {
      addNotification({
        type: 'warning',
        title: 'Not ready',
        message: 'Still connecting to Mission Control. Please wait a moment.',
      });
      return;
    }
    const localMessage: ChatMessage = {
      type: 'message',
      id: `msg-${Date.now()}`,
      timestamp: new Date().toISOString(),
      from: state.registeredAgentId,
      to: to as ChatMessage['to'],
      content,
      channel: to === 'broadcast' ? 'main' : 'private',
    };
    addMessage(localMessage);
    if (sendMessageRef.current) {
      sendMessageRef.current(content, to);
    } else {
      addNotification({
        type: 'error',
        title: 'Connection error',
        message: 'WebSocket send is not available.',
      });
    }
  }, [state.registeredAgentId, addMessage, addNotification]);

  const value: BridgeContextType = {
    ...state, dispatch, openAgentSession, closeAgentSession, minimizeAgentSession,
    restoreAgentSession, updateWindowPosition, selectAgent, addMessage, setTyping,
    toggleSidebar, toggleGroupChat, addNotification, markNotificationRead, clearNotifications,
    markSessionRead, setConnectionStatus, setRegisteredAgentId, setAgents, agentJoined, agentLeft, agentUpdated, bringToFront,
    registerSendMessage, sendMessage,
  };

  return <BridgeContext.Provider value={value}>{children}</BridgeContext.Provider>;
}

export function useBridge() {
  const context = useContext(BridgeContext);
  if (!context) throw new Error('useBridge must be used within a BridgeProvider');
  return context;
}