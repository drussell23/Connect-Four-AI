/**
 * Setup Memory Dashboard Listeners
 * Adds memory dashboard event listeners to an existing socket connection
 */

import { Socket } from 'socket.io-client';
import { memoryLogger } from './memory-console-logger';

export function setupMemoryListeners(socket: Socket) {
  console.log('📊 Setting up memory dashboard listeners...');

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

  // Request metrics subscription
  socket.emit('subscribe', { metrics: ['all'] });

  console.log('✅ Memory dashboard listeners set up');
}

export function removeMemoryListeners(socket: Socket) {
  socket.off('metrics:update');
  socket.off('memory:alert');
  socket.off('degradation:change');
  console.log('🔌 Memory dashboard listeners removed');
}