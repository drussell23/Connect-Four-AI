// frontend/src/api/socket.ts

// Import to ensure this file is treated as a module
import io from 'socket.io-client';

// Initialize Socket.IO client
const socket = io('http://localhost:3000/game');

// Default export for use throughout the app
export default socket;

// Empty export to satisfy --isolatedModules if needed (optional)
export {};
