// frontend/src/api/socket.ts

// Import to ensure this file is treated as a module
import io from 'socket.io-client';

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:3000';

// Initialize Socket.IO client
const socket = io(`${API_URL}/game`, {
    transports: ['websocket'],
  });

// Default export for use throughout the app
export default socket;

// Empty export to satisfy --isolatedModules if needed (optional)
export {};
