'use client';

import React, { useState, useMemo } from 'react';
import { Agent } from '@/types';
import { Search, Users, Activity, MoreHorizontal, Bot, Cpu, Sparkles, Shield } from 'lucide-react';

interface SidebarProps {
  agents: Agent[];
  /** Current user's agent id (Command) – excluded from list so you don't chat with yourself */
  myAgentId?: string | null;
  openAgentSession: (agent: Agent) => void;
}

const typeIcons: Record<string, React.ReactNode> = {
  Director: <Shield className="w-4 h-4" />,
  Engineer: <Cpu className="w-4 h-4" />,
  Infrastructure: <Activity className="w-4 h-4" />,
  Creative: <Sparkles className="w-4 h-4" />,
  default: <Bot className="w-4 h-4" />,
};

const statusColors: Record<string, string> = {
  online: 'bg-bridge-success shadow-[0_0_8px_rgba(16,185,129,0.6)]',
  busy: 'bg-bridge-warning shadow-[0_0_8px_rgba(245,158,11,0.6)]',
  idle: 'bg-bridge-textMuted',
  offline: 'bg-bridge-error',
  error: 'bg-bridge-error animate-pulse',
};

const statusLabels: Record<string, string> = {
  online: 'ONLINE',
  busy: 'BUSY',
  idle: 'IDLE',
  offline: 'OFFLINE',
  error: 'ERROR',
};

export default function Sidebar({ agents, myAgentId, openAgentSession }: SidebarProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [filterStatus, setFilterStatus] = useState<string | null>(null);

  /** Only show other agents – never show "Command" (you) as a chat target */
  const otherAgents = useMemo(
    () => (myAgentId ? agents.filter((a) => a.id !== myAgentId) : agents),
    [agents, myAgentId]
  );

  const filteredAgents = useMemo(() => {
    return otherAgents.filter(agent => {
      const matchesSearch = agent.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          agent.type.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesStatus = filterStatus ? agent.status === filterStatus : true;
      return matchesSearch && matchesStatus;
    });
  }, [otherAgents, searchQuery, filterStatus]);

  const stats = useMemo(() => ({
    total: otherAgents.length,
    online: otherAgents.filter(a => a.status === 'online').length,
    busy: otherAgents.filter(a => a.status === 'busy').length,
    idle: otherAgents.filter(a => a.status === 'idle').length,
    offline: otherAgents.filter(a => a.status === 'offline').length,
  }), [otherAgents]);

  return (
    <aside className="w-72 bg-bridge-surface border-r border-bridge-border flex flex-col shrink-0">
      {/* Stats bar */}
      <div className="p-3 border-b border-bridge-border">
        <div className="flex items-center justify-between text-xs mb-2">
          <div className="flex items-center gap-2 text-bridge-textMuted">
            <Users className="w-4 h-4" />
            <span className="font-medium">AGENTS</span>
          </div>
          <span className="text-bridge-accent font-bold">{stats.total}</span>
        </div>
        <div className="flex gap-2">
          {(['online', 'busy', 'idle'] as const).map((status) => (
            <button
              key={status}
              onClick={() => setFilterStatus(filterStatus === status ? null : status)}
              className={`flex-1 py-1.5 px-2 rounded text-[10px] font-bold uppercase transition-all duration-200 ${
                filterStatus === status
                  ? `bg-${status === 'online' ? 'bridge-success' : status === 'busy' ? 'bridge-warning' : 'bridge-textMuted'}/20 border border-${status === 'online' ? 'bridge-success' : status === 'busy' ? 'bridge-warning' : 'bridge-textMuted'}/50 text-white`
                  : 'bg-bridge-surface2 text-bridge-textMuted border border-transparent hover:border-bridge-border'
              }`}
            >
              <div className="flex items-center justify-center gap-1">
                <span className={`w-1.5 h-1.5 rounded-full ${
                  status === 'online' ? 'bg-bridge-success' : status === 'busy' ? 'bg-bridge-warning' : 'bg-bridge-textMuted'
                }`} />
                {status === 'online' ? stats.online : status === 'busy' ? stats.busy : stats.idle}
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Search */}
      <div className="p-3 border-b border-bridge-border">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-bridge-textMuted" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search agents..."
            className="w-full pl-9 pr-3 py-2 bg-bridge-surface2 border border-bridge-border rounded-lg text-xs text-bridge-text placeholder:text-bridge-textMuted focus:outline-none focus:border-bridge-accent transition-colors"
          />
        </div>
      </div>

      {/* Agent list */}
      <div className="flex-1 overflow-y-auto p-2 space-y-1">
        {filteredAgents.map((agent) => (
          <button
            key={agent.id}
            onClick={() => openAgentSession(agent)}
            className="w-full flex items-center gap-3 p-2.5 rounded-lg border border-transparent hover:border-bridge-accent/30 hover:bg-bridge-surface2/80 transition-all duration-200 group"
          >
            {/* Avatar */}
            <div className="relative">
              <div className="w-10 h-10 bg-gradient-to-br from-bridge-accent/20 to-bridge-accent2/20 rounded-lg border border-bridge-border group-hover:border-bridge-accent/30 flex items-center justify-center">
                {typeIcons[agent.type] || typeIcons.default}
              </div>
              {/* Status indicator */}
              <div className={`absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 rounded-full border-2 border-bridge-surface ${statusColors[agent.status] || statusColors.idle}`} />
            </div>

            {/* Info */}
            <div className="flex-1 text-left min-w-0">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-bridge-text group-hover:text-bridge-accent transition-colors truncate">
                  {agent.name}
                </span>
                <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded ${
                  agent.status === 'online' ? 'bg-bridge-success/20 text-bridge-success' :
                  agent.status === 'busy' ? 'bg-bridge-warning/20 text-bridge-warning' :
                  'bg-bridge-textMuted/20 text-bridge-textMuted'
                }`}>
                  {statusLabels[agent.status]}
                </span>
              </div>
              <div className="flex items-center gap-2 text-[10px] text-bridge-textMuted">
                <span className="capitalize">{agent.type}</span>
                <span>•</span>
                <span className="truncate">{agent.capabilities[0] || 'N/A'}</span>
              </div>
            </div>

            {/* Context menu trigger - span to avoid nested buttons */}
            <span
              role="button"
              tabIndex={0}
              className="opacity-0 group-hover:opacity-100 p-1 text-bridge-textMuted hover:text-bridge-text transition-all cursor-pointer inline-flex"
              onClick={(e) => e.stopPropagation()}
              onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') e.stopPropagation(); }}
              aria-label="Agent options"
            >
              <MoreHorizontal className="w-4 h-4" />
            </span>
          </button>
        ))}

        {filteredAgents.length === 0 && (
          <div className="flex flex-col items-center justify-center py-8 px-3 text-center text-bridge-textMuted">
            <Bot className="w-8 h-8 mb-2 opacity-50" />
            <p className="text-xs font-medium">No other agents</p>
            <p className="text-[10px] mt-2 leading-relaxed">
              Other agents appear here when they connect to the same Mission Control server (<code className="bg-bridge-surface2 px-1 rounded">ws://localhost:3001/ws</code>). Start your OpenClaw agents (or run <code className="bg-bridge-surface2 px-1 rounded">npx tsx agent-connector.ts</code>) so they register on this server.
            </p>
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="p-3 border-t border-bridge-border">
        <div className="flex items-center justify-between text-[10px] text-bridge-textMuted">
          <span>Network: <span className="text-bridge-success">OPTIMAL</span></span>
          <span>v2.0.0</span>
        </div>
      </div>
    </aside>
  );
}
