'use client';

import React, { useEffect } from 'react';
import { X, AlertCircle, CheckCircle, Info, AlertTriangle } from 'lucide-react';
import { useBridge } from '@/app/context/BridgeContext';

export default function NotificationPanel() {
  const { notifications, markNotificationRead, clearNotifications } = useBridge();

  const unreadNotifications = notifications.filter((n) => !n.read);

  // Auto-dismiss notifications after 5 seconds
  useEffect(() => {
    const timers = unreadNotifications.map((notification) =>
      setTimeout(() => {
        markNotificationRead(notification.id);
      }, 5000)
    );

    return () => timers.forEach(clearTimeout);
  }, [unreadNotifications, markNotificationRead]);

  const getIcon = (type: string) => {
    switch (type) {
      case 'success':
        return <CheckCircle className="w-5 h-5 text-bridge-success" />;
      case 'warning':
        return <AlertTriangle className="w-5 h-5 text-bridge-warning" />;
      case 'error':
        return <AlertCircle className="w-5 h-5 text-bridge-error" />;
      default:
        return <Info className="w-5 h-5 text-bridge-accent" />;
    }
  };

  const getBorderColor = (type: string) => {
    switch (type) {
      case 'success':
        return 'border-bridge-success/50';
      case 'warning':
        return 'border-bridge-warning/50';
      case 'error':
        return 'border-bridge-error/50';
      default:
        return 'border-bridge-accent/50';
    }
  };

  if (notifications.length === 0) return null;

  return (
    <div className="fixed top-20 right-4 z-50 flex flex-col gap-2 max-w-xs pointer-events-none">
      {notifications.slice(0, 5).map((notification) => (
        <div
          key={notification.id}
          className={`pointer-events-auto bg-bridge-surface/95 backdrop-blur-xl border ${getBorderColor(
            notification.type
          )} rounded-lg shadow-xl shadow-black/30 p-3 flex items-start gap-3 animate-in slide-in-from-right fade-in duration-300`}
        >
          <div className="flex-shrink-0 mt-0.5">{getIcon(notification.type)}</div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-bridge-text">{notification.title}</p>
            <p className="text-xs text-bridge-textMuted mt-0.5">{notification.message}</p>
            <p className="text-[10px] text-bridge-textMuted/70 mt-1">
              {notification.timestamp.toLocaleTimeString()}
            </p>
          </div>
          <button
            onClick={() => markNotificationRead(notification.id)}
            className="flex-shrink-0 text-bridge-textMuted hover:text-bridge-text transition-colors p-0.5"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      ))}

      {notifications.length > 5 && (
        <button
          onClick={clearNotifications}
          className="pointer-events-auto text-xs text-bridge-textMuted hover:text-bridge-accent text-center py-1 transition-colors"
        >
          Clear all notifications
        </button>
      )}
    </div>
  );
}
