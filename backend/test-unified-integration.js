// Test the full unified AI integration
const { UnifiedAISystem } = require('./dist/ai/unified/unified-ai-system-simple');
const { UnifiedThreatDetectorService } = require('./dist/ai/unified/unified-threat-detector.service');
const { EventEmitter2 } = require('@nestjs/event-emitter');

// Create test boards
const boards = [
  {
    name: 'Vertical threat',
    board: [
      ['Empty', 'Empty', 'Empty', 'Empty', 'Empty', 'Empty', 'Empty'],
      ['Empty', 'Empty', 'Empty', 'Empty', 'Empty', 'Empty', 'Empty'],
      ['Empty', 'Empty', 'Empty', 'Empty', 'Empty', 'Empty', 'Empty'],
      ['Red', 'Empty', 'Empty', 'Empty', 'Empty', 'Empty', 'Empty'],
      ['Red', 'Empty', 'Empty', 'Empty', 'Empty', 'Empty', 'Empty'],
      ['Red', 'Empty', 'Empty', 'Empty', 'Empty', 'Empty', 'Empty']
    ],
    expectedColumn: 0
  },
  {
    name: 'Horizontal threat',
    board: [
      ['Empty', 'Empty', 'Empty', 'Empty', 'Empty', 'Empty', 'Empty'],
      ['Empty', 'Empty', 'Empty', 'Empty', 'Empty', 'Empty', 'Empty'],
      ['Empty', 'Empty', 'Empty', 'Empty', 'Empty', 'Empty', 'Empty'],
      ['Empty', 'Empty', 'Empty', 'Empty', 'Empty', 'Empty', 'Empty'],
      ['Empty', 'Empty', 'Empty', 'Empty', 'Empty', 'Empty', 'Empty'],
      ['Red', 'Red', 'Red', 'Empty', 'Yellow', 'Empty', 'Empty']
    ],
    expectedColumn: 3
  },
  {
    name: 'Diagonal threat',
    board: [
      ['Empty', 'Empty', 'Empty', 'Empty', 'Empty', 'Empty', 'Empty'],
      ['Empty', 'Empty', 'Empty', 'Empty', 'Empty', 'Empty', 'Empty'],
      ['Empty', 'Empty', 'Empty', 'Red', 'Empty', 'Empty', 'Empty'],
      ['Empty', 'Empty', 'Red', 'Yellow', 'Empty', 'Empty', 'Empty'],
      ['Empty', 'Red', 'Yellow', 'Yellow', 'Empty', 'Empty', 'Empty'],
      ['Empty', 'Yellow', 'Red', 'Red', 'Yellow', 'Empty', 'Empty']
    ],
    expectedColumn: 0
  }
];

async function runTests() {
  console.log('🚀 Testing Unified AI System Integration...\n');

  // Create services
  const eventEmitter = new EventEmitter2();
  const threatDetector = new UnifiedThreatDetectorService();
  const unifiedAI = new UnifiedAISystem(threatDetector, eventEmitter);

  // Initialize
  await unifiedAI.onModuleInit();

  const config = {
    difficulty: 8,
    useCache: false,
    learningEnabled: false
  };

  let passed = 0;
  let failed = 0;

  for (const test of boards) {
    console.log(`\n🧪 Test: ${test.name}`);
    console.log('Board state:');
    test.board.forEach((row, i) => {
      console.log(`Row ${i}: [${row.map(cell => cell === 'Empty' ? '.' : cell[0]).join(' ')}]`);
    });

    try {
      const decision = await unifiedAI.makeMove(test.board, 'Yellow', config);
      console.log(`\n📊 AI Decision:`);
      console.log(`- Move: Column ${decision.move}`);
      console.log(`- Strategy: ${decision.strategy}`);
      console.log(`- Confidence: ${(decision.confidence * 100).toFixed(1)}%`);
      console.log(`- Explanation: ${decision.explanation}`);

      if (decision.move === test.expectedColumn) {
        console.log(`✅ PASSED: AI correctly chose column ${test.expectedColumn}`);
        passed++;
      } else {
        console.log(`❌ FAILED: Expected column ${test.expectedColumn}, got ${decision.move}`);
        failed++;
      }
    } catch (error) {
      console.log(`❌ ERROR: ${error.message}`);
      failed++;
    }
  }

  console.log(`\n\n📈 Test Results:`);
  console.log(`- Passed: ${passed}/${boards.length}`);
  console.log(`- Failed: ${failed}/${boards.length}`);
  console.log(`- Success Rate: ${((passed / boards.length) * 100).toFixed(1)}%`);

  // Test system status
  const status = unifiedAI.getSystemStatus();
  console.log('\n🔍 System Status:');
  console.log(`- Version: ${status.version}`);
  console.log(`- Cache Size: ${status.cacheSize}`);
  console.log(`- Components: ${JSON.stringify(status.components, null, 2)}`);
}

runTests().catch(console.error);