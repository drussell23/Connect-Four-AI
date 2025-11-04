/**
 * Memory Dashboard WebSocket Connection
 * Connects to the /metrics namespace for real-time memory monitoring
 */

import { io, Socket } from 'socket.io-client';
import { memoryLogger } from '../utils/memory-console-logger';

const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:3000';

// Create socket connection to default namespace
const memorySocket: Socket = io(API_BASE_URL, {
  autoConnect: false,
  reconnection: true,
  reconnectionDelay: 1000,
  reconnectionDelayMax: 5000,
  timeout: 20000,
});

// Debug logging
console.log('🔍 Memory socket created with URL:', API_BASE_URL);

// Connection event handlers
memorySocket.on('connect', () => {
  console.log('%c🔗 Memory Dashboard Connected', 'color: #4CAF50; font-weight: bold');
  console.log('   Socket ID:', memorySocket.id);
  console.log('   Connected:', memorySocket.connected);
  memoryLogger.enable();
});

memorySocket.on('disconnect', () => {
  console.log('%c❌ Memory Dashboard Disconnected', 'color: #f44336; font-weight: bold');
});

memorySocket.on('connect_error', (error: Error) => {
  console.error('Memory dashboard connection error:', error.message);
  console.error('   Type:', (error as any).type || 'unknown');
  console.error('   Stack:', error.stack);
});

// Add debug for initial connection event
memorySocket.on('connected', (data: any) => {
  console.log('📊 Memory dashboard initial data:', data);
});

// Metrics event handlers
memorySocket.on('metrics:update', (metrics: any) => {
  console.log('📊 Received metrics update:', metrics);
  memoryLogger.logMetrics(metrics);
});

memorySocket.on('memory:alert', (alert: any) => {
  console.log('🚨 Received memory alert:', alert);
  memoryLogger.logAlert(alert);
});

memorySocket.on('degradation:change', (data: any) => {
  console.log('🔄 Received degradation change:', data);
  memoryLogger.logDegradation(data);
});

// Debug all events
memorySocket.onAny((eventName: string, ...args: any[]) => {
  console.log('📡 Memory socket event:', eventName, args);
});

// Export functions to control the connection
export const connectMemoryDashboard = () => {
  if (!memorySocket.connected) {
    memorySocket.connect();
  }
};

export const disconnectMemoryDashboard = () => {
  if (memorySocket.connected) {
    memorySocket.disconnect();
  }
};

export const isMemoryDashboardConnected = () => memorySocket.connected;

export default memorySocket;