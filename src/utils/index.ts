/**
 * Utility functions for Mission Control server
 */
import { randomUUID } from 'crypto';
import type { Agent, AgentStatus, BaseMessage, ErrorMessage } from '../types/index.js';

/**
 * Generate a unique ID
 */
export function generateId(): string {
  return randomUUID();
}

/**
 * Create a timestamp in ISO format
 */
export function createTimestamp(): string {
  return new Date().toISOString();
}

/**
 * Create a base message with common fields
 */
export function createBaseMessage<T extends BaseMessage>(type: T['type']): BaseMessage {
  return {
    type,
    timestamp: createTimestamp(),
    id: generateId(),
  };
}

/**
 * Create an error message
 */
export function createErrorMessage(code: string, message: string, details?: unknown): ErrorMessage {
  return {
    ...createBaseMessage('error'),
    type: 'error',
    code,
    message,
    details,
  } as ErrorMessage;
}

/**
 * Safe JSON parse with error handling
 */
export function safeJsonParse<T>(data: string): { success: true; data: T } | { success: false; error: string } {
  try {
    const parsed = JSON.parse(data) as T;
    return { success: true, data: parsed };
  } catch (error) {
    return { success: false, error: (error as Error).message };
  }
}

/**
 * Safe JSON stringify with error handling
 */
export function safeJsonStringify(data: unknown): { success: true; data: string } | { success: false; error: string } {
  try {
    const stringified = JSON.stringify(data);
    return { success: true, data: stringified };
  } catch (error) {
    return { success: false, error: (error as Error).message };
  }
}

/**
 * Validate agent status
 */
export function isValidAgentStatus(status: string): status is AgentStatus {
  return ['online', 'offline', 'busy', 'idle', 'error'].includes(status);
}

/**
 * Calculate agent uptime in seconds
 */
export function calculateAgentUptime(agent: Agent): number {
  return Math.floor((Date.now() - agent.connectedAt.getTime()) / 1000);
}

/**
 * Format agent for client (removes sensitive/internal fields)
 */
export function formatAgentForClient(agent: Agent): Omit<Agent, 'socketId'> {
  const { socketId, ...clientSafe } = agent;
  return clientSafe;
}

/**
 * Format date for display
 */
export function formatDate(date: Date): string {
  return date.toISOString();
}

/**
 * Debounce function for rate limiting
 */
export function debounce<T extends (...args: unknown[]) => void>(
  func: T,
  wait: number
): (...args: Parameters<T>) => void {
  let timeout: NodeJS.Timeout | null = null;
  return (...args: Parameters<T>) => {
    if (timeout) clearTimeout(timeout);
    timeout = setTimeout(() => func(...args), wait);
  };
}

/**
 * Throttle function for rate limiting
 */
export function throttle<T extends (...args: unknown[]) => void>(
  func: T,
  limit: number
): (...args: Parameters<T>) => void {
  let inThrottle = false;
  return (...args: Parameters<T>) => {
    if (!inThrottle) {
      func(...args);
      inThrottle = true;
      setTimeout(() => (inThrottle = false), limit);
    }
  };
}

/**
 * Check if value is a valid message type
 */
export function isValidMessageType(type: unknown): type is string {
  return typeof type === 'string' && type.length > 0;
}

/**
 * Round number to decimal places
 */
export function round(num: number, decimals: number): number {
  return Math.round((num + Number.EPSILON) * Math.pow(10, decimals)) / Math.pow(10, decimals);
}

/**
 * Format bytes to human readable
 */
export function formatBytes(bytes: number): string {
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
  if (bytes === 0) return '0 Bytes';
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  return `${round(bytes / Math.pow(1024, i), 2)} ${sizes[i]}`;
}
