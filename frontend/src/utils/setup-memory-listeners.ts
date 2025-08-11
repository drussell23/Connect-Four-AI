/**
 * Setup Memory Dashboard Listeners
 * Adds memory dashboard event listeners to an existing socket connection
 */

import { Socket } from 'socket.io-client';
import { memoryLogger } from './memory-console-logger';
import { triggerMemoryDashboard } from './trigger-memory-dashboard';

export function setupMemoryListeners(socket: Socket) {
  console.log('📊 Setting up memory dashboard listeners...');
  
  // Debug: Check if socket is connected
  console.log('   Socket connected:', socket.connected);
  console.log('   Socket ID:', socket.id);

  // Metrics event handlers
  socket.on('metrics:update', (metrics: any) => {
    console.log('📊 Received metrics update:', metrics);
    memoryLogger.logMetrics(metrics);
  });

  socket.on('memory:alert', (alert: any) => {
    console.log('🚨 Received memory alert:', alert);
    memoryLogger.logAlert(alert);
  });

  socket.on('degradation:change', (data: any) => {
    console.log('🔄 Received degradation change:', data);
    memoryLogger.logDegradation(data);
  });

  // Debug: Listen to all events temporarily
  socket.onAny((eventName: string, ...args: any[]) => {
    if (eventName.includes('metric') || eventName.includes('memory') || eventName.includes('dashboard')) {
      console.log(`📡 Socket event: ${eventName}`, args);
    }
  });

  // Request metrics subscription
  socket.emit('subscribe', { metrics: ['all'] });
  console.log('   Requested metrics subscription');

  // Also try requesting dashboard data directly
  setTimeout(() => {
    console.log('📊 Requesting dashboard metrics...');
    socket.emit('requestDashboardMetrics');
  }, 2000);

  // Trigger memory dashboard initialization via HTTP
  setTimeout(() => {
    triggerMemoryDashboard();
  }, 1000);

  console.log('✅ Memory dashboard listeners set up');
}

export function removeMemoryListeners(socket: Socket) {
  socket.off('metrics:update');
  socket.off('memory:alert');
  socket.off('degradation:change');
  console.log('🔌 Memory dashboard listeners removed');
}