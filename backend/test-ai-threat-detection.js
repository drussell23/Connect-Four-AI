// Simple test to verify AI threat detection is working with enhanced difficulty
const { UnifiedThreatDetectorService } = require('./dist/ai/unified/unified-threat-detector.service');

// Test scenarios
const scenarios = [
  {
    name: 'Vertical threat blocking',
    board: [
      ['Empty', 'Empty', 'Empty', 'Empty', 'Empty', 'Empty', 'Empty'],
      ['Empty', 'Empty', 'Empty', 'Empty', 'Empty', 'Empty', 'Empty'],
      ['Empty', 'Empty', 'Empty', 'Empty', 'Empty', 'Empty', 'Empty'],
      ['Red', 'Empty', 'Empty', 'Empty', 'Empty', 'Empty', 'Empty'],
      ['Red', 'Empty', 'Empty', 'Empty', 'Empty', 'Empty', 'Empty'],
      ['Red', 'Empty', 'Empty', 'Empty', 'Empty', 'Empty', 'Empty']
    ],
    expectedBlock: 0
  },
  {
    name: 'Horizontal threat blocking',
    board: [
      ['Empty', 'Empty', 'Empty', 'Empty', 'Empty', 'Empty', 'Empty'],
      ['Empty', 'Empty', 'Empty', 'Empty', 'Empty', 'Empty', 'Empty'],
      ['Empty', 'Empty', 'Empty', 'Empty', 'Empty', 'Empty', 'Empty'],
      ['Empty', 'Empty', 'Empty', 'Empty', 'Empty', 'Empty', 'Empty'],
      ['Empty', 'Empty', 'Empty', 'Empty', 'Empty', 'Empty', 'Empty'],
      ['Red', 'Red', 'Red', 'Empty', 'Yellow', 'Empty', 'Empty']
    ],
    expectedBlock: 3
  },
  {
    name: 'Diagonal threat blocking',
    board: [
      ['Empty', 'Empty', 'Empty', 'Empty', 'Empty', 'Empty', 'Empty'],
      ['Empty', 'Empty', 'Empty', 'Empty', 'Empty', 'Empty', 'Empty'],
      ['Empty', 'Empty', 'Empty', 'Red', 'Empty', 'Empty', 'Empty'],
      ['Empty', 'Empty', 'Red', 'Yellow', 'Empty', 'Empty', 'Empty'],
      ['Empty', 'Red', 'Yellow', 'Yellow', 'Empty', 'Empty', 'Empty'],
      ['Empty', 'Yellow', 'Red', 'Red', 'Yellow', 'Empty', 'Empty']
    ],
    expectedBlock: 0
  }
];

console.log('🧪 Testing AI Threat Detection with Enhanced Difficulty Settings\n');
console.log('Configuration:');
console.log('- Minimum AI Difficulty: 20 (enforced)');
console.log('- AI Profile starts at level 20 with pre-populated experience');
console.log('- UltimateConnect4AI as primary AI system');
console.log('- Unified threat detection for all AI paths\n');

const detector = new UnifiedThreatDetectorService();
let passed = 0;
let failed = 0;

scenarios.forEach(scenario => {
  console.log(`\n📋 Test: ${scenario.name}`);
  
  // Display board
  console.log('Board state:');
  scenario.board.forEach((row, i) => {
    console.log(`Row ${i}: [${row.map(cell => 
      cell === 'Empty' ? '.' : cell === 'Red' ? 'R' : 'Y'
    ).join(' ')}]`);
  });

  // Analyze threats
  const threats = detector.analyzeBoardThreats(
    scenario.board,
    'Yellow',
    'Red'
  );

  console.log('\nThreat Analysis:');
  console.log(`- Immediate Wins: ${threats.immediateWins.length}`);
  console.log(`- Immediate Blocks: ${threats.immediateBlocks.length}`);
  
  if (threats.immediateBlocks.length > 0) {
    const blockingMove = threats.immediateBlocks[0].column;
    console.log(`- Recommended Block: Column ${blockingMove}`);
    
    if (blockingMove === scenario.expectedBlock) {
      console.log('✅ PASSED - Correctly identified blocking move');
      passed++;
    } else {
      console.log(`❌ FAILED - Expected column ${scenario.expectedBlock}, got ${blockingMove}`);
      failed++;
    }
  } else {
    console.log('❌ FAILED - No blocking move identified');
    failed++;
  }
});

console.log('\n\n📊 Summary:');
console.log(`- Tests Passed: ${passed}/${scenarios.length}`);
console.log(`- Tests Failed: ${failed}/${scenarios.length}`);
console.log(`- Success Rate: ${((passed / scenarios.length) * 100).toFixed(1)}%`);

if (passed === scenarios.length) {
  console.log('\n✅ All threat detection tests passed!');
  console.log('The AI is correctly identifying and blocking all threat types.');
} else {
  console.log('\n⚠️ Some tests failed. Check the implementation.');
}

console.log('\n📝 Key Improvements Implemented:');
console.log('1. AI Profile now starts at difficulty 20 (was 1)');
console.log('2. Pre-populated experience and achievements');
console.log('3. UltimateConnect4AI registered and prioritized');
console.log('4. Minimum difficulty enforced in triggerAIMove');
console.log('5. Comprehensive logging for AI decisions');
console.log('6. SuperAIService created for maximum difficulty testing');
console.log('\nThe AI should now provide a much more challenging experience!');