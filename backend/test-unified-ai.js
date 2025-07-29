// Simple test script to verify unified AI threat detection
const { UnifiedThreatDetectorService } = require('./dist/ai/unified/unified-threat-detector.service');

// Create test board with vertical threat
const board = [
  ['Empty', 'Empty', 'Empty', 'Empty', 'Empty', 'Empty', 'Empty'],
  ['Empty', 'Empty', 'Empty', 'Empty', 'Empty', 'Empty', 'Empty'],
  ['Empty', 'Empty', 'Empty', 'Empty', 'Empty', 'Empty', 'Empty'],
  ['Red', 'Empty', 'Empty', 'Empty', 'Empty', 'Empty', 'Empty'],
  ['Red', 'Empty', 'Empty', 'Empty', 'Empty', 'Empty', 'Empty'],
  ['Red', 'Empty', 'Empty', 'Empty', 'Empty', 'Empty', 'Empty']
];

console.log('🧪 Testing Unified AI Threat Detection...\n');
console.log('Board state (Red has vertical 3 in column 0):');
board.forEach((row, i) => {
  console.log(`Row ${i}: [${row.map(cell => cell === 'Empty' ? '.' : cell[0]).join(' ')}]`);
});

const detector = new UnifiedThreatDetectorService();

console.log('\n🎯 Testing threat detection...');
const threats = detector.analyzeBoardThreats(board, 'Yellow', 'Red');

console.log('\n📊 Threat Analysis Results:');
console.log(`- Immediate Wins: ${threats.immediateWins.length}`);
console.log(`- Immediate Blocks: ${threats.immediateBlocks.length}`);
threats.immediateBlocks.forEach(block => {
  console.log(`  • Column ${block.column}: ${block.reason}`);
});

console.log('\n🤖 Testing getImmediateThreat method...');
const immediateMove = detector.getImmediateThreat(board, 'Yellow', 'Red');
console.log(`Recommended move: Column ${immediateMove}`);

if (immediateMove === 0) {
  console.log('\n✅ SUCCESS: AI correctly identifies need to block column 0!');
} else {
  console.log('\n❌ FAILURE: AI did not identify the threat in column 0');
}