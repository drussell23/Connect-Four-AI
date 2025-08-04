/**
 * Debug utility for checking stats
 */
import { statsTracker } from './StatsTracker';

export function debugStats() {
  const stats = statsTracker.getStats();
  const detailed = statsTracker.getDetailedStats();
  const currentSession = statsTracker.getCurrentSession();
  
  console.group('📊 Stats Debug Info');
  console.log('Basic Stats:', stats);
  console.log('Total Games:', stats.totalGames);
  console.log('Wins:', stats.wins);
  console.log('Losses:', stats.losses);
  console.log('Current Session:', currentSession);
  console.log('Game History Length:', detailed.gameHistory.length);
  console.log('Daily Stats:', Array.from(detailed.dailyStats.entries()));
  console.log('LocalStorage Data:', localStorage.getItem('connectfour_player_stats'));
  console.groupEnd();
  
  return {
    stats,
    detailed,
    currentSession,
    localStorageData: localStorage.getItem('connectfour_player_stats')
  };
}

// Make it available globally for console debugging
(window as any).debugStats = debugStats;
(window as any).statsTracker = statsTracker;

console.log('🔧 Debug utilities loaded. Use window.debugStats() to check stats.');