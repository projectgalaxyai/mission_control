'use client';

import React, { useRef, useEffect, useState } from 'react';
import { Send, ChevronDown, ChevronUp, Radio } from 'lucide-react';
import { useBridge } from '@/app/context/BridgeContext';
import { ChatMessage, SystemMessage } from '@/types';

interface GroupChatProps {
  messages: (ChatMessage | SystemMessage)[];
  isOpen: boolean;
  onSendMessage: (content: string, to: 'broadcast') => void;
}

export default function GroupChat({ messages, isOpen, onSendMessage }: GroupChatProps) {
  const [isExpanded, setIsExpanded] = useState(true);
  const [inputValue, setInputValue] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const { connectionStatus } = useBridge();

  const groupMessages = messages.filter((m): m is ChatMessage | SystemMessage => 
    m.type === 'system' || m.to === 'broadcast' || m.channel === 'main'
  );

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [groupMessages]);

  const handleSend = () => {
    const content = inputValue.trim();
    if (!content) return;
    onSendMessage(content, 'broadcast');
    setInputValue('');
    inputRef.current?.focus();
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  if (!isOpen) return null;

  return (
    <div className={`fixed bottom-0 left-0 right-0 z-40 transition-all duration-300 ${isExpanded ? 'h-64' : 'h-10'}`}>
      <div className="h-full bg-bridge-surface/95 backdrop-blur-xl border-t border-bridge-border flex flex-col">
        {/* Header */}
        <div 
          className="h-10 px-4 flex items-center justify-between bg-bridge-surface2/50 border-b border-bridge-border cursor-pointer hover:bg-bridge-surface2 transition-colors"
          onClick={() => setIsExpanded(!isExpanded)}
        >
          <div className="flex items-center gap-2">
            <Radio className={`w-4 h-4 ${connectionStatus === 'connected' ? 'text-bridge-success animate-pulse' : 'text-bridge-textMuted'}`} />
            <span className="text-sm font-semibold text-bridge-text uppercase tracking-wider">
              Fleet Channel
            </span>
            <span className="text-xs text-bridge-textMuted">
              {connectionStatus === 'connected' ? '● Uplink Active' : '○ Disconnected'}
            </span>
          </div>
          <button className="text-bridge-textMuted hover:text-bridge-text transition-colors">
            {isExpanded ? <ChevronDown className="w-4 h-4" /> : <ChevronUp className="w-4 h-4" />}
          </button>
        </div>

        {/* Messages */}
        {isExpanded && (
          <>
            <div className="flex-1 overflow-y-auto p-4 space-y-2">
              {groupMessages.length === 0 ? (
                <div className="h-full flex items-center justify-center text-bridge-textMuted">
                  <p className="text-sm">No fleet transmissions yet...</p>
                </div>
              ) : (
                groupMessages.map((msg) => (
                  <div 
                    key={msg.id} 
                    className={`flex ${msg.type === 'system' ? 'justify-center' : 'justify-start'}`}
                  >
                    {msg.type === 'system' ? (
                      <div className="text-xs text-center">
                        <span className="text-bridge-accent/70">[{new Date(msg.timestamp).toLocaleTimeString()}]</span>
                        <span className={`ml-2 ${
                          msg.level === 'error' ? 'text-bridge-error' :
                          msg.level === 'warning' ? 'text-bridge-warning' :
                          'text-bridge-textMuted'
                        }`}>
                          {msg.content}
                        </span>
                      </div>
                    ) : (
                      <div className="max-w-[80%] group">
                        <div className="flex items-baseline gap-2 mb-0.5">
                          <span className="text-xs font-semibold text-bridge-accent">
                            {msg.from === 'user' ? 'COMMAND' : msg.from.toUpperCase()}
                          </span>
                          <span className="text-[10px] text-bridge-textMuted">
                            {new Date(msg.timestamp).toLocaleTimeString()}
                          </span>
                        </div>
                        <div className="px-3 py-2 rounded-lg bg-bridge-surface2 border border-bridge-border/50 group-hover:border-bridge-accent/30 transition-colors">
                          <p className="text-sm text-bridge-text">{msg.content}</p>
                        </div>
                      </div>
                    )}
                  </div>
                ))
              )}
              <div ref={messagesEndRef} />
            </div>

            {/* Input */}
            <div className="p-3 border-t border-bridge-border bg-bridge-surface2/30">
              <div className="flex gap-2">
                <textarea
                  ref={inputRef}
                  value={inputValue}
                  onChange={(e) => setInputValue(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="Broadcast to fleet..."
                  rows={1}
                  className="flex-1 px-3 py-2 bg-bridge-bg border border-bridge-border rounded-lg text-sm text-bridge-text placeholder:text-bridge-textMuted resize-none focus:outline-none focus:border-bridge-accent focus:ring-1 focus:ring-bridge-accent/50 transition-all min-h-[38px] max-h-24"
                />
                <button
                  onClick={handleSend}
                  disabled={!inputValue.trim() || connectionStatus !== 'connected'}
                  className="px-4 py-2 bg-bridge-accent/20 hover:bg-bridge-accent/30 disabled:bg-bridge-surface2 disabled:cursor-not-allowed border border-bridge-accent/50 rounded-lg text-bridge-accent transition-colors"
                >
                  <Send className="w-4 h-4" />
                </button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
