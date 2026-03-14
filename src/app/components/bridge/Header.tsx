'use client';

import React from 'react';
import { useBridge } from '@/app/context/BridgeContext';
import { useUser } from '@auth0/nextjs-auth0/client';
import { Menu, Bell, Zap, Wifi, WifiOff, AlertCircle, LogOut, User } from 'lucide-react';

export default function Header() {
  const { user, isLoading: authLoading } = useUser();
  const { connectionStatus, toggleSidebar, sidebarOpen, notifications, toggleGroupChat, groupChatOpen } = useBridge();

  const unreadNotifications = notifications.filter(n => !n.read).length;

  const getConnectionIcon = () => {
    switch (connectionStatus) {
      case 'connected':
        return <Wifi className="w-5 h-5 text-bridge-success connection-pulse" />;
      case 'connecting':
        return <Zap className="w-5 h-5 text-bridge-warning animate-pulse" />;
      case 'error':
        return <AlertCircle className="w-5 h-5 text-bridge-error" />;
      default:
        return <WifiOff className="w-5 h-5 text-bridge-textMuted" />;
    }
  };

  const getConnectionText = () => {
    switch (connectionStatus) {
      case 'connected':
        return 'ONLINE';
      case 'connecting':
        return 'CONNECTING...';
      case 'error':
        return 'ERROR';
      default:
        return 'OFFLINE';
    }
  };

  return (
    <header className="h-14 bg-bridge-surface border-b border-bridge-border flex items-center justify-between px-4 z-50 shrink-0">
      {/* Left section */}
      <div className="flex items-center gap-4">
        {/* Sidebar toggle */}
        <button
          onClick={toggleSidebar}
          className={`bridge-btn p-2 rounded-lg border border-transparent transition-all duration-200 ${
            sidebarOpen ? 'bg-bridge-accent/10 border-bridge-accent/30 text-bridge-accent' : 'text-bridge-textMuted hover:text-bridge-text hover:bg-bridge-surface2'
          }`}
          title={sidebarOpen ? 'Hide Agent List' : 'Show Agent List'}
        >
          <Menu className="w-5 h-5" />
        </button>

        {/* Title */}
        <div className="flex items-center gap-3">
          <div className="relative">
            <div className="w-8 h-8 bg-gradient-to-br from-bridge-accent to-bridge-accent2 rounded-lg flex items-center justify-center">
              <span className="text-white font-bold text-sm">B</span>
            </div>
            <div className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-bridge-success rounded-full animate-ping" />
            <div className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-bridge-success rounded-full" />
          </div>
          <div>
            <h1 className="text-lg font-bold tracking-wider text-glow">
              <span className="text-bridge-accent">THE</span>
              <span className="text-bridge-text"> BRIDGE</span>
            </h1>
            <p className="text-[10px] text-bridge-textMuted tracking-widest">MISSION CONTROL v2.0</p>
          </div>
        </div>
      </div>

      {/* Center - Navigation breadcrumbs */}
      <div className="hidden md:flex items-center gap-2 text-xs text-bridge-textMuted">
        <span className="text-bridge-accent">&gt;</span>
        <span>dashboard</span>
        <span className="text-bridge-accent">/</span>
        <span>agents</span>
      </div>

      {/* Right section */}
      <div className="flex items-center gap-3">
        {/* Group Chat Toggle */}
        <button
          onClick={toggleGroupChat}
          className={`bridge-btn flex items-center gap-2 px-3 py-1.5 rounded-lg transition-all duration-200 ${
            groupChatOpen 
              ? 'bg-bridge-accent/10 border border-bridge-accent/30 text-bridge-accent' 
              : 'text-bridge-textMuted hover:text-bridge-text border border-transparent'
          }`}
        >
          <Zap className={`w-4 h-4 ${groupChatOpen ? 'fill-current' : ''}`} />
          <span className="text-xs font-medium hidden sm:inline">GROUP CHAT</span>
        </button>

        {/* Notifications */}
        <button className="relative p-2 text-bridge-textMuted hover:text-bridge-text transition-colors">
          <Bell className="w-5 h-5" />
          {unreadNotifications > 0 && (
            <span className="absolute -top-0.5 -right-0.5 w-5 h-5 bg-bridge-error rounded-full flex items-center justify-center text-[10px] font-bold text-white animate-pulse">
              {unreadNotifications > 9 ? '9+' : unreadNotifications}
            </span>
          )}
        </button>

        {/* Connection status */}
        <div className="flex items-center gap-2 px-3 py-1.5 bg-bridge-surface2 rounded-lg border border-bridge-border">
          {getConnectionIcon()}
          <span className={`text-xs font-medium ${
            connectionStatus === 'connected' ? 'text-bridge-success' :
            connectionStatus === 'connecting' ? 'text-bridge-warning' :
            connectionStatus === 'error' ? 'text-bridge-error' : 'text-bridge-textMuted'
          }`}>
            {getConnectionText()}
          </span>
        </div>

        {/* Auth: user + logout */}
        {!authLoading && user && (
          <div className="flex items-center gap-2 pl-2 border-l border-bridge-border">
            <span className="flex items-center gap-1.5 text-xs text-bridge-textMuted max-w-[120px] truncate" title={user.email ?? user.name ?? 'User'}>
              <User className="w-4 h-4 shrink-0" />
              {user.name ?? user.email ?? 'You'}
            </span>
            <a
              href="/auth/logout"
              className="p-2 text-bridge-textMuted hover:text-bridge-text rounded-lg transition-colors"
              title="Sign out"
            >
              <LogOut className="w-4 h-4" />
            </a>
          </div>
        )}
      </div>
    </header>
  );
}
