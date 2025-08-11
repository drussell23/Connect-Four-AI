/**
 * Memory Console Commands
 * Provides global commands for controlling memory dashboard logging
 */

import { memoryLogger } from './memory-console-logger';

// Add commands to window object for console access
declare global {
  interface Window {
    memory: {
      start: () => void;
      stop: () => void;
      enable: () => void;
      disable: () => void;
      status: () => void;
      help: () => void;
    };
  }
}

// Define memory commands
const memoryCommands = {
  start: () => {
    console.log('📊 Memory dashboard is integrated with the main socket connection');
    memoryLogger.enable();
  },
  
  stop: () => {
    console.log('📊 Memory dashboard logging disabled');
    memoryLogger.disable();
  },
  
  enable: () => {
    memoryLogger.enable();
  },
  
  disable: () => {
    memoryLogger.disable();
  },
  
  status: () => {
    const trend = memoryLogger.getMemoryTrend();
    
    console.log('%c📊 Memory Dashboard Status', 'color: #2196F3; font-weight: bold; font-size: 14px');
    console.log('   Connection: ✅ Integrated with main socket');
    console.log(`   Logging: ${(memoryLogger as any).isEnabled ? '✅ Enabled' : '❌ Disabled'}`);
    console.log(`   Memory Trend: ${trend}`);
  },
  
  help: () => {
    console.log('%c📊 Memory Dashboard Commands', 'color: #2196F3; font-weight: bold; font-size: 16px');
    console.log('%cAvailable commands:', 'color: #666; font-weight: bold');
    console.log('   %cmemory.start()%c    - Connect to memory dashboard', 'color: #4CAF50', 'color: #333');
    console.log('   %cmemory.stop()%c     - Disconnect from memory dashboard', 'color: #4CAF50', 'color: #333');
    console.log('   %cmemory.enable()%c   - Enable console logging', 'color: #4CAF50', 'color: #333');
    console.log('   %cmemory.disable()%c  - Disable console logging', 'color: #4CAF50', 'color: #333');
    console.log('   %cmemory.status()%c   - Show current status', 'color: #4CAF50', 'color: #333');
    console.log('   %cmemory.help()%c     - Show this help message', 'color: #4CAF50', 'color: #333');
    console.log('');
    console.log('%cExample:', 'color: #FF9800; font-weight: bold');
    console.log('   memory.start()  // Start monitoring memory metrics');
    console.log('   memory.disable() // Stop console output but keep connection');
  }
};

// Attach to window object
window.memory = memoryCommands;

// Log availability
console.log(
  '%c📊 Memory Dashboard Commands Available',
  'color: #2196F3; font-weight: bold; font-size: 14px'
);
console.log('Type %cmemory.help()%c for available commands', 'color: #4CAF50', 'color: #333');

export default memoryCommands;