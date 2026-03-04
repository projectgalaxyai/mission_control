'use client';

import React, { useRef, useState, useCallback, useEffect } from 'react';
import { AgentSession } from '@/app/context/BridgeContext';
import { ChatMessage } from '@/types';
import { useBridge } from '@/app/context/BridgeContext';
import { X, Minus, Send } from 'lucide-react';

interface ChatCanvasProps {
  openSessions: Record<string, AgentSession>;
  messages: ChatMessage[];
  onSendMessage: (content: string, to: string) => void;
}

interface DragState {
  isDragging: boolean;
  agentId: string | null;
  offsetX: number;
  offsetY: number;
}

export default function ChatCanvas({ openSessions, messages, onSendMessage }: ChatCanvasProps) {
  const canvasRef = useRef<HTMLDivElement>(null);
  const [dragState, setDragState] = useState<DragState>({
    isDragging: false,
    agentId: null,
    offsetX: 0,
    offsetY: 0,
  });
  const [inputValues, setInputValues] = useState<Record<string, string>>({});
  const messagesEndRef = useRef<Record<string, HTMLDivElement | null>>({});

  const { closeAgentSession, minimizeAgentSession, updateWindowPosition, bringToFront, sidebarOpen } = useBridge();
  const activeSessions = Object.entries(openSessions).filter(([_, s]) => !s.isMinimized);

  useEffect(() => {
    Object.entries(messagesEndRef.current).forEach(([_, el]) => {
      if (el) el.scrollIntoView({ behavior: 'smooth' });
    });
  }, [messages]);

  const handleMouseDown = useCallback((e: React.MouseEvent, agentId: string) => {
    const session = openSessions[agentId];
    if (!session) return;
    setDragState({
      isDragging: true,
      agentId,
      offsetX: e.clientX - session.position.x,
      offsetY: e.clientY - session.position.y,
    });
    bringToFront(agentId);
  }, [openSessions, bringToFront]);

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!dragState.isDragging || !dragState.agentId) return;
      const newX = Math.max(250, Math.min(window.innerWidth - 340, e.clientX - dragState.offsetX));
      const newY = Math.max(60, Math.min(window.innerHeight - 400, e.clientY - dragState.offsetY));
      updateWindowPosition(dragState.agentId, { x: newX, y: newY });
    };
    const handleMouseUp = () => setDragState({ isDragging: false, agentId: null, offsetX: 0, offsetY: 0 });
    if (dragState.isDragging) {
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
    }
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [dragState, updateWindowPosition]);

  const handleSend = useCallback((agentId: string) => {
    const content = inputValues[agentId]?.trim();
    if (content) {
      onSendMessage(content, agentId);
      setInputValues(prev => ({ ...prev, [agentId]: '' }));
    }
  }, [inputValues, onSendMessage]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent, agentId: string) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend(agentId);
    }
  }, [handleSend]);

  return (
    <div ref={canvasRef} className="flex-1 relative overflow-hidden" style={{ marginLeft: sidebarOpen ? 0 : '-288px' }}>
      <div className="absolute inset-0 opacity-10 pointer-events-none">
        <div className="absolute inset-0" style={{ backgroundImage: `radial-gradient(circle at 2px 2px, rgba(0,212,255,0.3) 1px, transparent 0)`, backgroundSize: '40px 40px' }} />
      </div>
      {activeSessions.length === 0 && (
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="text-center">
            <div className="w-20 h-20 mx-auto mb-4 relative">
              <div className="absolute inset-0 bg-gradient-to-br from-bridge-accent/20 to-bridge-accent2/20 rounded-2xl animate-pulse" />
              <div className="absolute inset-2 border border-bridge-accent/30 rounded-xl" />
              <div className="absolute inset-0 flex items-center justify-center text-bridge-accent text-2xl font-bold">✦</div>
            </div>
            <h3 className="text-xl font-bold text-bridge-text mb-2">Select an Agent</h3>
            <p className="text-sm text-bridge-textMuted max-w-xs">Click any agent in the sidebar</p>
          </div>
        </div>
      )}
      {activeSessions.map(([agentId, session]) => {
        const agentMessages = messages.filter(m => (m.from === agentId && m.to === 'user') || (m.to === agentId && m.from === 'user')).slice(-50);
        return (
          <div key={agentId} className="absolute flex flex-col bg-bridge-surface border border-bridge-border rounded-lg shadow-2xl shadow-black/50 overflow-hidden"
               style={{ left: session.position.x, top: session.position.y, width: 320, height: 380, zIndex: session.position.zIndex }}
               onMouseDown={() => bringToFront(agentId)}>
            <div className="h-10 px-3 flex items-center justify-between bg-bridge-surface2 border-b border-bridge-border cursor-move select-none"
                 onMouseDown={(e) => handleMouseDown(e, agentId)}>
              <div className="flex items-center gap-2">
                <div className={`w-2 h-2 rounded-full ${session.agent.status === 'online' ? 'bg-bridge-success animate-pulse' : session.agent.status === 'busy' ? 'bg-bridge-warning' : 'bg-bridge-textMuted'}`} />
                <span className="text-sm font-medium text-bridge-text">{session.agent.name}</span>
              </div>
              <div className="flex items-center gap-1">
                <button onClick={() => minimizeAgentSession(agentId)} className="p-1.5 text-bridge-textMuted hover:text-bridge-text"><Minus className="w-4 h-4" /></button>
                <button onClick={() => closeAgentSession(agentId)} className="p-1.5 text-bridge-textMuted hover:text-bridge-error"><X className="w-4 h-4" /></button>
              </div>
            </div>
            <div className="flex-1 overflow-y-auto p-3 space-y-2 bg-bridge-bg/50">
              {agentMessages.map((msg) => (
                <div key={msg.id} className={`flex ${msg.from === 'user' ? 'justify-end' : 'justify-start'}`}>
                  <div className={`max-w-[80%] px-3 py-2 rounded-lg text-xs ${msg.from === 'user' ? 'bg-bridge-accent/20 border border-bridge-accent/30' : 'bg-bridge-surface2 border border-bridge-border'}`}>
                    <p className="text-bridge-text">{msg.content}</p>
                    <span className="text-[9px] text-bridge-textMuted mt-1 block">{new Date(msg.timestamp).toLocaleTimeString()}</span>
                  </div>
                </div>
              ))}
            </div>
            <div className="p-3 border-t border-bridge-border bg-bridge-surface2/30">
              <div className="flex gap-2">
                <input value={inputValues[agentId] || ''} onChange={(e) => setInputValues(prev => ({ ...prev, [agentId]: e.target.value }))}
                       onKeyDown={(e) => handleKeyDown(e, agentId)} placeholder="Message..."
                       className="flex-1 px-3 py-2 bg-bridge-bg border border-bridge-border rounded-lg text-sm text-bridge-text placeholder:text-bridge-textMuted focus:outline-none focus:border-bridge-accent" />
                <button onClick={() => handleSend(agentId)} className="p-2 bg-bridge-accent/20 hover:bg-bridge-accent/30 border border-bridge-accent/50 rounded-lg text-bridge-accent">
                  <Send className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
