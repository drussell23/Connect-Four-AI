// frontend/src/api/socket.ts
import io from 'socket.io-client';

// API configuration
const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:3000';

console.log('🔌 Initializing WebSocket connection to:', `${API_URL}/game`);

// Enhanced Socket.IO client with robust connection handling
const socket = io(`${API_URL}/game`, {
  transports: ['websocket', 'polling'], // Allow fallback to polling
  autoConnect: true,
  reconnection: true,
  reconnectionDelay: 1000,
  reconnectionDelayMax: 5000,
  reconnectionAttempts: 5, // Changed from maxReconnectionAttempts
  timeout: 20000,
  forceNew: false,
  upgrade: true
});

// Connection event handlers
socket.on('connect', () => {
  console.log('✅ WebSocket connected to backend');
  console.log('🔗 Socket ID:', socket.id);
});

socket.on('disconnect', (reason: string) => {
  console.log('❌ WebSocket disconnected:', reason);
  if (reason === 'io server disconnect') {
    // The disconnection was initiated by the server, reconnect manually
    console.log('🔄 Attempting manual reconnection...');
    socket.connect();
  }
});

socket.on('connect_error', (error: any) => {
  console.error('🚨 WebSocket connection error:', error.message);
  console.log('🔄 Will attempt to reconnect...');
});

socket.on('reconnect', (attemptNumber: number) => {
  console.log(`✅ WebSocket reconnected after ${attemptNumber} attempts`);
});

socket.on('reconnect_attempt', (attemptNumber: number) => {
  console.log(`🔄 WebSocket reconnection attempt ${attemptNumber}`);
});

socket.on('reconnect_error', (error: any) => {
  console.error('🚨 WebSocket reconnection error:', error.message);
});

socket.on('reconnect_failed', () => {
  console.error('💥 WebSocket reconnection failed - giving up');
});

// Game-specific event listeners
socket.on('gameCreated', (data: any) => {
  console.log('🎮 Game created:', data);
});

socket.on('aiThinking', (data: any) => {
  console.log('🤖 AI thinking:', data);
});

socket.on('aiMove', (data: any) => {
  console.log('🤖 AI move:', data);
});

socket.on('playerMove', (data: any) => {
  console.log('👤 Player move:', data);
});

socket.on('error', (data: any) => {
  console.error('🎮 Game error:', data);
});

// Add connection status helper
export const getConnectionStatus = () => ({
  connected: socket.connected,
  id: socket.id,
  transport: socket.connected ? 'websocket' : 'none'
});

// Add manual reconnection helper
export const forceReconnect = () => {
  console.log('🔄 Forcing WebSocket reconnection...');
  socket.disconnect();
  setTimeout(() => socket.connect(), 1000);
};

export default socket;
