/**
 * Singleton WebSocket client for Mission Control Bridge.
 * Persists outside the React tree so Strict Mode and HMR do not kill the connection.
 */

const DEFAULT_URL = process.env.NEXT_PUBLIC_WS_URL || 'ws://localhost:3001/ws';
const MAX_RECONNECT_DELAY = 30000;
const HEARTBEAT_INTERVAL_MS = 30000;
const GET_AGENTS_DELAY_MS = 500;

export type WSClientEvent = 'open' | 'close' | 'error' | 'message';

type Listener<T = unknown> = (payload: T) => void;

class MissionControlWSClient {
  private ws: WebSocket | null = null;
  private url = DEFAULT_URL;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private heartbeatTimer: ReturnType<typeof setInterval> | null = null;
  private agentId: string | null = null;
  private reconnectAttempts = 0;
  private isConnecting = false;
  private listeners: { [K in WSClientEvent]: Set<Listener> } = {
    open: new Set(),
    close: new Set(),
    error: new Set(),
    message: new Set(),
  };

  /** Subscribe to an event. Returns unsubscribe function. */
  on(event: 'open', handler: Listener<void>): () => void;
  on(event: 'close', handler: Listener<{ code?: number; reason?: string }>): () => void;
  on(event: 'error', handler: Listener<unknown>): () => void;
  on(event: 'message', handler: Listener<Record<string, unknown>>): () => void;
  on(event: WSClientEvent, handler: Listener): () => void {
    this.listeners[event].add(handler as Listener);
    return () => this.listeners[event].delete(handler as Listener);
  }

  private emit(event: 'open'): void;
  private emit(event: 'close', payload: { code?: number; reason?: string }): void;
  private emit(event: 'error', payload: unknown): void;
  private emit(event: 'message', payload: Record<string, unknown>): void;
  private emit(event: WSClientEvent, payload?: unknown): void {
    this.listeners[event].forEach((fn) => {
      try {
        (fn as Listener)(payload);
      } catch (err) {
        console.error(`[Bridge WS] Listener error for ${event}:`, err);
      }
    });
  }

  /** Connect to the server. Idempotent if already connected/connecting. */
  connect(url?: string): void {
    if (typeof window === 'undefined') return;
    if (this.ws?.readyState === WebSocket.OPEN) return;
    if (this.isConnecting) return;

    this.isConnecting = true;
    this.url = url ?? this.url ?? DEFAULT_URL;
    this.clearTimers();

    try {
      console.log('[Bridge] Connecting to', this.url);
      this.ws = new WebSocket(this.url);

      if (typeof window !== 'undefined') {
        (window as unknown as { __missionControlWS?: WebSocket }).__missionControlWS = this.ws;
        (window as unknown as { __missionControlWSRef?: { current: WebSocket | null } }).__missionControlWSRef = {
          get current() {
            return missionControlWS.getSocket();
          },
        };
      }

      this.ws.onopen = () => {
        console.log('[Bridge] WebSocket connected');
        this.isConnecting = false;
        this.reconnectAttempts = 0;
        this.emit('open');
        this.sendRegister();
        setTimeout(() => this.sendGetAgents(), GET_AGENTS_DELAY_MS);
        this.startHeartbeat();
      };

      this.ws.onmessage = (event: MessageEvent) => {
        try {
          const data = JSON.parse(event.data) as Record<string, unknown>;
          if (data?.type === 'register' && data.success && typeof data.agentId === 'string') {
            this.agentId = data.agentId;
          }
          this.emit('message', data);
        } catch {
          this.emit('message', { type: 'unknown', raw: event.data } as Record<string, unknown>);
        }
      };

      this.ws.onerror = (err) => {
        this.emit('error', err);
      };

      this.ws.onclose = (code: number, reason: Buffer | string) => {
        console.log('[Bridge] WebSocket disconnected');
        this.ws = null;
        this.isConnecting = false;
        this.agentId = null;
        this.clearTimers();
        const reasonStr = typeof reason === 'string' ? reason : reason?.toString?.() ?? '';
        this.emit('close', { code, reason: reasonStr });

        this.reconnectAttempts++;
        const delay = Math.min(
          3000 * Math.pow(2, this.reconnectAttempts - 1),
          MAX_RECONNECT_DELAY
        );
        this.reconnectTimer = setTimeout(() => this.connect(), delay);
      };
    } catch (err) {
      this.isConnecting = false;
      this.emit('error', err);
      this.reconnectAttempts++;
      const delay = Math.min(
        3000 * Math.pow(2, this.reconnectAttempts - 1),
        MAX_RECONNECT_DELAY
      );
      this.reconnectTimer = setTimeout(() => this.connect(), delay);
    }
  }

  private clearTimers(): void {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = null;
    }
  }

  private sendRegister(): void {
    this.send({
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
    });
  }

  private sendGetAgents(): void {
    this.send({
      type: 'command',
      command: 'getAgents',
      from: 'user',
      requestId: `req-${Date.now()}`,
      args: {},
      timestamp: new Date().toISOString(),
      id: `cmd-${Date.now()}`,
    });
  }

  private startHeartbeat(): void {
    this.heartbeatTimer = setInterval(() => {
      const id = this.getAgentId();
      if (id && this.ws?.readyState === WebSocket.OPEN) {
        this.send({
          type: 'heartbeat',
          agentId: id,
          status: 'online',
          timestamp: new Date().toISOString(),
          id: `hb-${Date.now()}`,
        });
      }
    }, HEARTBEAT_INTERVAL_MS);
  }

  /** Disconnect and clear reconnect timer. */
  disconnect(): void {
    this.clearTimers();
    this.reconnectAttempts = 0;
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
    this.agentId = null;
    this.isConnecting = false;
  }

  /** Send a JSON-serializable object or raw string. */
  send(data: object | string): void {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return;
    const raw = typeof data === 'string' ? data : JSON.stringify(data);
    this.ws.send(raw);
  }

  getAgentId(): string | null {
    return this.agentId;
  }

  getSocket(): WebSocket | null {
    return this.ws ?? null;
  }

  getReadyState(): number {
    return this.ws?.readyState ?? WebSocket.CLOSED;
  }

  isConnected(): boolean {
    return this.ws?.readyState === WebSocket.OPEN;
  }
}

// Singleton instance
export const missionControlWS = new MissionControlWSClient();

// Legacy refs for code that still imports from WebSocketManager
export const wsRef = {
  get current() {
    return missionControlWS.getSocket();
  },
};

export const userAgentId = {
  get current() {
    return missionControlWS.getAgentId();
  },
};

export function isWsConnected(): boolean {
  return missionControlWS.isConnected();
}
