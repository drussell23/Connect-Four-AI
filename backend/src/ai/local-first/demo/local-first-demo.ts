/**
 * Local-First AI Demo
 * Demonstrates offline-capable AI with progressive enhancement
 */

import { LocalFirstAIService } from '../local-first-ai.service';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { CellValue } from '../../connect4AI';

async function runDemo() {
  console.log('🎮 Connect Four Local-First AI Demo\n');
  
  // Create service instance
  const eventEmitter = new EventEmitter2();
  const localAI = new LocalFirstAIService(eventEmitter);
  
  // Initialize
  console.log('📦 Initializing Local-First AI...');
  await localAI.onModuleInit();
  
  // Demo 1: Online Mode
  console.log('\n📶 Demo 1: Online Mode');
  console.log('======================');
  
  const emptyBoard: CellValue[][] = Array(6).fill(null).map(() => 
    Array(7).fill('Empty' as CellValue)
  );
  
  console.time('Online move');
  const onlineMove = await localAI.getBestMove(emptyBoard, 'Red');
  console.timeEnd('Online move');
  console.log(`Best move: Column ${onlineMove}`);
  
  // Demo 2: Download models for offline
  console.log('\n📥 Demo 2: Downloading Models for Offline Use');
  console.log('============================================');
  
  try {
    await localAI.downloadModelsForOffline();
    console.log('✅ Models downloaded successfully');
  } catch (error) {
    console.log('⚠️  Model download simulated (no server available)');
  }
  
  // Demo 3: Offline Mode
  console.log('\n📴 Demo 3: Offline Mode');
  console.log('======================');
  
  localAI.setOfflineMode(true);
  
  console.time('Offline move');
  const offlineMove = await localAI.getBestMove(emptyBoard, 'Red');
  console.timeEnd('Offline move');
  console.log(`Best move (offline): Column ${offlineMove}`);
  
  // Demo 4: Complex Position
  console.log('\n🧩 Demo 4: Complex Position Analysis');
  console.log('===================================');
  
  const complexBoard: CellValue[][] = [
    ['Empty', 'Empty', 'Empty', 'Empty', 'Empty', 'Empty', 'Empty'],
    ['Empty', 'Empty', 'Empty', 'Empty', 'Empty', 'Empty', 'Empty'],
    ['Empty', 'Empty', 'Empty', 'Red', 'Empty', 'Empty', 'Empty'],
    ['Empty', 'Yellow', 'Empty', 'Red', 'Empty', 'Empty', 'Empty'],
    ['Empty', 'Yellow', 'Empty', 'Red', 'Empty', 'Empty', 'Empty'],
    ['Red', 'Yellow', 'Empty', 'Yellow', 'Red', 'Empty', 'Empty']
  ];
  
  console.time('Complex position');
  const complexMove = await localAI.getBestMove(complexBoard, 'Red');
  console.timeEnd('Complex position');
  console.log(`Best move for complex position: Column ${complexMove}`);
  
  // Demo 5: Cache Performance
  console.log('\n⚡ Demo 5: Cache Performance');
  console.log('===========================');
  
  // First call (cache miss)
  console.time('First call');
  await localAI.getBestMove(complexBoard, 'Red');
  console.timeEnd('First call');
  
  // Second call (cache hit)
  console.time('Cached call');
  await localAI.getBestMove(complexBoard, 'Red');
  console.timeEnd('Cached call');
  
  // Demo 6: Storage Statistics
  console.log('\n📊 Demo 6: Storage Statistics');
  console.log('=============================');
  
  const stats = await localAI.getStorageStats();
  console.log('Storage Stats:');
  console.log(`- Models: ${stats.models.totalModels}`);
  console.log(`- Cache Size: ${stats.cache.moveCache}/${stats.cache.maxCacheSize}`);
  console.log(`- WASM Metrics: ${JSON.stringify(stats.wasm, null, 2)}`);
  console.log(`- Offline Mode: ${stats.offline}`);
  console.log(`- Service Worker: ${stats.serviceWorker ? 'Ready' : 'Not Available'}`);
  
  // Demo 7: Progressive Enhancement
  console.log('\n🚀 Demo 7: Progressive Enhancement');
  console.log('=================================');
  
  const strategies = [
    { name: 'WebAssembly', available: stats.wasm.compilationTime > 0 },
    { name: 'Service Worker', available: stats.serviceWorker },
    { name: 'IndexedDB Models', available: stats.models.totalModels > 0 },
    { name: 'Heuristic Fallback', available: true }
  ];
  
  console.log('Available Strategies:');
  strategies.forEach(s => {
    console.log(`- ${s.name}: ${s.available ? '✅ Available' : '❌ Not Available'}`);
  });
  
  // Demo 8: Sync Capabilities
  console.log('\n🔄 Demo 8: Sync Capabilities');
  console.log('===========================');
  
  localAI.setOfflineMode(false);
  
  try {
    console.log('Attempting to sync with server...');
    await localAI.syncWithServer();
    console.log('✅ Sync completed successfully');
  } catch (error) {
    console.log('⚠️  Sync failed (expected in demo environment)');
  }
  
  // Performance Summary
  console.log('\n📈 Performance Summary');
  console.log('=====================');
  
  eventEmitter.on('localai.move.computed', (event) => {
    console.log(`Move computed:
    - Method: ${event.method}
    - Latency: ${event.latency.toFixed(2)}ms
    - Offline: ${event.offline}
    - Confidence: ${event.confidence}`);
  });
  
  // Final test with timing
  const testBoard: CellValue[][] = Array(6).fill(null).map(() => 
    Array(7).fill('Empty' as CellValue)
  );
  
  console.log('\nRunning 10 move computations...');
  const times: number[] = [];
  
  for (let i = 0; i < 10; i++) {
    const start = performance.now();
    await localAI.getBestMove(testBoard, i % 2 === 0 ? 'Red' : 'Yellow');
    times.push(performance.now() - start);
  }
  
  const avgTime = times.reduce((a, b) => a + b) / times.length;
  console.log(`\nAverage computation time: ${avgTime.toFixed(2)}ms`);
  console.log(`Min time: ${Math.min(...times).toFixed(2)}ms`);
  console.log(`Max time: ${Math.max(...times).toFixed(2)}ms`);
  
  console.log('\n✅ Demo completed!');
}

// Run demo if called directly
if (require.main === module) {
  runDemo().catch(console.error);
}

export { runDemo };