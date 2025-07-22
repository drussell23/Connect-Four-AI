const axios = require('axios');

async function testAIStatus() {
    try {
        console.log('🔍 Testing AI Status...');
        
        // Test 1: Basic health check
        console.log('\n1. Testing basic health...');
        const healthResponse = await axios.get('http://localhost:3000/api/health');
        console.log('✅ Health check passed:', healthResponse.data.status);
        
        // Test 2: Create a game
        console.log('\n2. Creating a test game...');
        const gameResponse = await axios.post('http://localhost:3000/api/games', {
            playerId: 'test-ai',
            clientId: 'test-ai'
        });
        console.log('✅ Game created:', gameResponse.data);
        
        const gameId = gameResponse.data.gameId;
        
        // Test 3: Get AI move (this should trigger AI initialization)
        console.log('\n3. Requesting AI move...');
        const aiMoveResponse = await axios.get(`http://localhost:3000/api/games/${gameId}/ai-move?aiDisc=Yellow`);
        console.log('✅ AI move response:', aiMoveResponse.data);
        
        console.log('\n🎉 All tests passed! AI should be working.');
        
    } catch (error) {
        console.error('❌ Test failed:', error.response?.data || error.message);
        
        if (error.response?.status === 404) {
            console.log('💡 This might indicate the AI endpoint is not working properly.');
        }
    }
}

testAIStatus(); 