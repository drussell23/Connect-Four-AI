// Test script to verify the Ultimate AI integration is working properly
const { UltimateConnect4AI } = require('./dist/ai/connect4AI');
const { UnifiedThreatDetectorService } = require('./dist/ai/unified/unified-threat-detector.service');
const { SuperAIService } = require('./dist/ai/super-ai.service');
const { EventEmitter2 } = require('@nestjs/event-emitter');

// Test boards
const testScenarios = [
  {
    name: 'Vertical threat - AI must block',
    board: [
      ['Empty', 'Empty', 'Empty', 'Empty', 'Empty', 'Empty', 'Empty'],
      ['Empty', 'Empty', 'Empty', 'Empty', 'Empty', 'Empty', 'Empty'],
      ['Empty', 'Empty', 'Empty', 'Empty', 'Empty', 'Empty', 'Empty'],
      ['Red', 'Empty', 'Empty', 'Empty', 'Empty', 'Empty', 'Empty'],
      ['Red', 'Empty', 'Empty', 'Empty', 'Empty', 'Empty', 'Empty'],
      ['Red', 'Empty', 'Empty', 'Empty', 'Empty', 'Empty', 'Empty']
    ],
    expectedMove: 0,
    description: 'Red has 3 in column 0, AI must block'
  },
  {
    name: 'Horizontal threat - AI must block',
    board: [
      ['Empty', 'Empty', 'Empty', 'Empty', 'Empty', 'Empty', 'Empty'],
      ['Empty', 'Empty', 'Empty', 'Empty', 'Empty', 'Empty', 'Empty'],
      ['Empty', 'Empty', 'Empty', 'Empty', 'Empty', 'Empty', 'Empty'],
      ['Empty', 'Empty', 'Empty', 'Empty', 'Empty', 'Empty', 'Empty'],
      ['Empty', 'Empty', 'Empty', 'Empty', 'Empty', 'Empty', 'Empty'],
      ['Red', 'Red', 'Red', 'Empty', 'Yellow', 'Empty', 'Empty']
    ],
    expectedMove: 3,
    description: 'Red has 3 horizontally, AI must block at column 3'
  },
  {
    name: 'Diagonal threat - AI must block',
    board: [
      ['Empty', 'Empty', 'Empty', 'Empty', 'Empty', 'Empty', 'Empty'],
      ['Empty', 'Empty', 'Empty', 'Empty', 'Empty', 'Empty', 'Empty'],
      ['Empty', 'Empty', 'Empty', 'Red', 'Empty', 'Empty', 'Empty'],
      ['Empty', 'Empty', 'Red', 'Yellow', 'Empty', 'Empty', 'Empty'],
      ['Empty', 'Red', 'Yellow', 'Yellow', 'Empty', 'Empty', 'Empty'],
      ['Empty', 'Yellow', 'Red', 'Red', 'Yellow', 'Empty', 'Empty']
    ],
    expectedMove: 0,
    description: 'Red has diagonal threat, AI must block at column 0'
  },
  {
    name: 'AI winning opportunity',
    board: [
      ['Empty', 'Empty', 'Empty', 'Empty', 'Empty', 'Empty', 'Empty'],
      ['Empty', 'Empty', 'Empty', 'Empty', 'Empty', 'Empty', 'Empty'],
      ['Empty', 'Empty', 'Empty', 'Empty', 'Empty', 'Empty', 'Empty'],
      ['Empty', 'Empty', 'Empty', 'Empty', 'Empty', 'Empty', 'Empty'],
      ['Empty', 'Yellow', 'Yellow', 'Empty', 'Empty', 'Empty', 'Empty'],
      ['Red', 'Yellow', 'Yellow', 'Red', 'Red', 'Empty', 'Empty']
    ],
    expectedMove: 3,
    description: 'AI (Yellow) can win by playing column 3'
  }
];

async function runTests() {
  console.log('🚀 Testing Ultimate AI Integration with Enhanced Difficulty\n');

  // Create services
  const eventEmitter = new EventEmitter2();
  const threatDetector = new UnifiedThreatDetectorService();
  const superAI = new SuperAIService(eventEmitter);

  // Create UltimateConnect4AI instance with maximum settings
  const ultimateConfig = {
    maxDepth: 20,
    timeLimit: 5000,
    useOpeningBook: true,
    useEndgameTablebase: true,
    useMCTS: true,
    useNeuralNetworks: true,
    agentConfigs: {
      dqn: { enabled: true },
      alphaZero: { enabled: true, simulations: 1000 }
    },
    multiAgentDebate: {
      enabled: true,
      numAgents: 3,
      debateRounds: 2
    }
  };
  const ultimateAI = new UltimateConnect4AI(ultimateConfig);

  console.log('Configuration:');
  console.log('- Minimum AI Difficulty: 20');
  console.log('- UltimateConnect4AI: Enabled');
  console.log('- Multi-Agent Debate: Enabled');
  console.log('- Neural Networks: Enabled');
  console.log('- MCTS: Enabled\n');

  // Test each scenario
  for (const scenario of testScenarios) {
    console.log(`\n📋 Test: ${scenario.name}`);
    console.log(`Description: ${scenario.description}`);
    
    // Display board
    console.log('Board state:');
    scenario.board.forEach((row, i) => {
      console.log(`Row ${i}: [${row.map(cell => 
        cell === 'Empty' ? '.' : cell === 'Red' ? 'R' : 'Y'
      ).join(' ')}]`);
    });

    try {
      // Test with UltimateConnect4AI
      console.log('\n🤖 Testing UltimateConnect4AI...');
      const ultimateMove = await ultimateAI.getBestMove(
        scenario.board,
        'Yellow',
        3000,
        {
          explainMove: true,
          useMultiAgentDebate: true,
          useMCTS: true
        }
      );

      console.log(`\nUltimate AI Decision:`);
      console.log(`- Move: Column ${ultimateMove.move}`);
      console.log(`- Confidence: ${(ultimateMove.confidence * 100).toFixed(1)}%`);
      console.log(`- Strategy: ${ultimateMove.strategy}`);
      console.log(`- Reasoning: ${ultimateMove.reasoning}`);
      console.log(`- Nodes Explored: ${ultimateMove.nodesExplored}`);

      const ultimateSuccess = ultimateMove.move === scenario.expectedMove;
      console.log(`Result: ${ultimateSuccess ? '✅ PASSED' : '❌ FAILED'} (expected column ${scenario.expectedMove})`);

      // Test with SuperAI service
      console.log('\n🚀 Testing SuperAI Service...');
      const superDecision = await superAI.getBestMove(scenario.board, 'Yellow', {
        maxTimeMs: 3000,
        enableMultiAgentDebate: true,
        enableExplainability: true
      });

      console.log(`\nSuperAI Decision:`);
      console.log(`- Move: Column ${superDecision.move}`);
      console.log(`- Confidence: ${(superDecision.confidence * 100).toFixed(1)}%`);
      console.log(`- Algorithm: ${superDecision.algorithm}`);
      console.log(`- Reasoning: ${superDecision.reasoning}`);

      const superSuccess = superDecision.move === scenario.expectedMove;
      console.log(`Result: ${superSuccess ? '✅ PASSED' : '❌ FAILED'} (expected column ${scenario.expectedMove})`);

      // Verify threat detection
      console.log('\n🔍 Verifying threat detection...');
      const threatResult = await superAI.verifyThreatDetection(
        scenario.board,
        scenario.expectedMove
      );
      console.log(`Threat Detection: ${threatResult.success ? '✅ PASSED' : '❌ FAILED'}`);

    } catch (error) {
      console.error(`❌ Test failed with error: ${error.message}`);
      console.error(error.stack);
    }
  }

  // Run comprehensive test on the first scenario
  console.log('\n\n🔬 Running Comprehensive Test Suite on First Scenario...');
  try {
    const testResult = await superAI.runComprehensiveTest(
      testScenarios[0].board,
      'Yellow'
    );

    console.log('\n📊 Comprehensive Test Results:');
    console.log(`- Best Move: Column ${testResult.comparison.bestMove}`);
    console.log(`- Consensus: ${(testResult.comparison.consensus * 100).toFixed(1)}%`);
    console.log(`- Average Confidence: ${(testResult.comparison.averageConfidence * 100).toFixed(1)}%`);
    console.log(`- Total Time: ${testResult.comparison.totalTime}ms`);
    
  } catch (error) {
    console.error(`Comprehensive test error: ${error.message}`);
  }

  console.log('\n✅ All tests completed!');
}

// Run the tests
runTests().catch(console.error);