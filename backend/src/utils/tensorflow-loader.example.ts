// Example usage of the advanced TensorFlow loader
import { 
    loadTensorFlow, 
    getTensorFlow, 
    getTensorFlowInfo,
    disposeTensorFlow 
} from './tensorflow-loader';

async function demonstrateTensorFlowLoader() {
    console.log('🚀 TensorFlow Loader Demo\n');
    
    // Example 1: Basic usage with default configuration
    console.log('1️⃣ Basic Usage:');
    try {
        const tf = await getTensorFlow();
        console.log('✅ TensorFlow loaded successfully');
        
        // Perform a simple operation
        const tensor = tf.tensor([1, 2, 3, 4]);
        const mean = tensor.mean();
        console.log(`Mean of [1,2,3,4]: ${await mean.data()}`);
        
        // Clean up
        tensor.dispose();
        mean.dispose();
    } catch (error) {
        console.error('❌ Failed to load TensorFlow:', error.message);
    }
    
    // Example 2: Custom configuration
    console.log('\n2️⃣ Custom Configuration:');
    try {
        const tf = await loadTensorFlow({
            preferredBackend: 'cpu',
            maxRetries: 5,
            retryDelay: 2000,
            enablePerformanceMonitoring: true
        });
        
        console.log('✅ TensorFlow loaded with custom config');
    } catch (error) {
        console.error('❌ Failed with custom config:', error.message);
    }
    
    // Example 3: Get backend information
    console.log('\n3️⃣ Backend Information:');
    const info = getTensorFlowInfo();
    console.log('Current backend:', info.current);
    console.log('Available backends:', info.available);
    console.log('Failed backends:', info.failed);
    console.log('Performance metrics:', info.performance);
    
    // Example 4: Using in a Connect Four AI context
    console.log('\n4️⃣ Connect Four AI Example:');
    try {
        const tf = await getTensorFlow();
        
        // Create a simple neural network for Connect Four
        const model = tf.sequential({
            layers: [
                tf.layers.dense({
                    inputShape: [42], // 7x6 board
                    units: 128,
                    activation: 'relu'
                }),
                tf.layers.dropout({ rate: 0.2 }),
                tf.layers.dense({
                    units: 64,
                    activation: 'relu'
                }),
                tf.layers.dense({
                    units: 7, // 7 possible columns
                    activation: 'softmax'
                })
            ]
        });
        
        // Compile the model
        model.compile({
            optimizer: tf.train.adam(0.001),
            loss: 'categoricalCrossentropy',
            metrics: ['accuracy']
        });
        
        console.log('✅ Created Connect Four neural network');
        model.summary();
        
        // Example prediction
        const boardState = tf.zeros([1, 42]); // Empty board
        const prediction = model.predict(boardState) as any;
        const moves = await prediction.data();
        console.log('Predicted move probabilities:', moves);
        
        // Clean up
        boardState.dispose();
        prediction.dispose();
        model.dispose();
    } catch (error) {
        console.error('❌ Connect Four AI example failed:', error.message);
    }
    
    // Example 5: Memory management
    console.log('\n5️⃣ Memory Management:');
    try {
        const tf = await getTensorFlow();
        
        console.log('Memory before:', tf.memory());
        
        // Create some tensors
        const tensors = [];
        for (let i = 0; i < 10; i++) {
            tensors.push(tf.randomNormal([100, 100]));
        }
        
        console.log('Memory after creating tensors:', tf.memory());
        
        // Dispose tensors
        tensors.forEach(t => t.dispose());
        
        console.log('Memory after disposal:', tf.memory());
    } catch (error) {
        console.error('❌ Memory management example failed:', error.message);
    }
    
    // Example 6: Error handling and fallback
    console.log('\n6️⃣ Error Handling:');
    try {
        // Force a specific backend that might not be available
        const tf = await loadTensorFlow({
            preferredBackend: 'webgl',
            enableMockFallback: true
        });
        
        console.log('Loaded with backend:', getTensorFlowInfo().current);
        
        // If mock backend is used, operations will still work
        const result = tf.tensor([1, 2, 3]).mean();
        console.log('Mean calculation worked even with fallback');
        result.dispose();
    } catch (error) {
        console.error('❌ Error handling example failed:', error.message);
    }
    
    // Cleanup
    console.log('\n7️⃣ Cleanup:');
    await disposeTensorFlow();
    console.log('✅ TensorFlow disposed');
}

// Helper function to create a board state tensor from game state
function boardToTensor(board: number[][], tf: any): any {
    // Flatten the 7x6 board to a 1D array
    const flat = board.flat();
    // Convert to tensor and reshape
    return tf.tensor2d([flat], [1, 42]);
}

// Helper function to get best move from prediction
function getBestMove(prediction: Float32Array): number {
    let bestMove = 0;
    let bestScore = prediction[0];
    
    for (let i = 1; i < prediction.length; i++) {
        if (prediction[i] > bestScore) {
            bestScore = prediction[i];
            bestMove = i;
        }
    }
    
    return bestMove;
}

// Export for use in other modules
export { 
    demonstrateTensorFlowLoader,
    boardToTensor,
    getBestMove
};

// Run demo if this file is executed directly
if (require.main === module) {
    demonstrateTensorFlowLoader().catch(console.error);
}