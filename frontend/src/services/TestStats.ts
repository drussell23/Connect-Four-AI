/**
 * Test utility to populate stats with sample data
 */
import { statsTracker } from './StatsTracker';

export function populateTestStats() {
  console.log('🧪 Populating test statistics...');
  
  // Simulate some completed games
  const gameScenarios = [
    { result: 'win' as const, moves: 25, duration: 120000 },
    { result: 'win' as const, moves: 30, duration: 180000 },
    { result: 'loss' as const, moves: 20, duration: 90000 },
    { result: 'win' as const, moves: 35, duration: 240000 },
    { result: 'draw' as const, moves: 42, duration: 300000 },
    { result: 'win' as const, moves: 28, duration: 150000 },
    { result: 'loss' as const, moves: 18, duration: 80000 },
    { result: 'win' as const, moves: 32, duration: 200000 },
  ];
  
  gameScenarios.forEach((scenario, index) => {
    // Start a session
    statsTracker.startSession('AI', 20 + (index * 5));
    
    // Simulate some moves
    for (let i = 0; i < scenario.moves; i++) {
      const column = Math.floor(Math.random() * 7);
      const player = i % 2 === 0 ? 'Red' : 'Yellow';
      const boardState = `test-board-${i}`;
      
      statsTracker.recordMove(column, player as 'Red' | 'Yellow', boardState);
      
      // Mark some moves as accurate
      if (Math.random() > 0.3) {
        statsTracker.markMoveAccurate();
      }
    }
    
    // End the session with the result
    setTimeout(() => {
      statsTracker.endSession(scenario.result);
    }, 100);
  });
  
  console.log('🧪 Test stats populated!');
  console.log('📊 Current stats:', statsTracker.getStats());
  
  return statsTracker.getStats();
}

// Make it available globally for testing
(window as any).populateTestStats = populateTestStats;

console.log('🧪 Test utilities loaded. Use window.populateTestStats() to add sample data.');