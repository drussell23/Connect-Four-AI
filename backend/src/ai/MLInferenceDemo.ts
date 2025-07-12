/**
 * 🎯 ADVANCED ML INFERENCE CLIENT DEMONSTRATION SUITE
 * 
 * Comprehensive demonstration of all advanced features:
 * - Circuit breaker pattern testing
 * - Caching performance analysis
 * - Batch processing capabilities
 * - Real-time streaming
 * - Health monitoring
 * - Metrics and performance profiling
 * - Error handling and recovery
 * - Load testing and benchmarks
 */

import {
    MLInferenceClient, ProductionMLInferenceClient, DevelopmentMLInferenceClient,
    BoardState, BatchPredictRequest, HealthCheckResult, InferenceMetrics
} from './MLInferenceClient';

// 🎨 Visual Output Helpers
class DemoVisualizer {
    static header(title: string): void {
        console.log('\n' + '🎯'.repeat(20));
        console.log(`🚀 ${title.toUpperCase()}`);
        console.log('🎯'.repeat(20));
    }

    static section(title: string): void {
        console.log(`\n📊 ${title}`);
        console.log('─'.repeat(50));
    }

    static success(message: string): void {
        console.log(`✅ ${message}`);
    }

    static error(message: string): void {
        console.log(`❌ ${message}`);
    }

    static info(message: string): void {
        console.log(`💡 ${message}`);
    }

    static metrics(metrics: InferenceMetrics): void {
        console.log('\n📈 PERFORMANCE METRICS:');
        console.log(`   🎯 Total Requests: ${metrics.totalRequests}`);
        console.log(`   ✅ Successful: ${metrics.successfulRequests}`);
        console.log(`   ❌ Failed: ${metrics.failedRequests}`);
        console.log(`   📊 Success Rate: ${((metrics.successfulRequests / metrics.totalRequests) * 100).toFixed(1)}%`);
        console.log(`   ⏱️  Average Latency: ${metrics.averageLatency.toFixed(2)}ms`);
        console.log(`   📈 P95 Latency: ${metrics.p95Latency.toFixed(2)}ms`);
        console.log(`   🔥 P99 Latency: ${metrics.p99Latency.toFixed(2)}ms`);
        console.log(`   💾 Cache Hit Rate: ${(metrics.cacheHitRate * 100).toFixed(1)}%`);
        console.log(`   🔄 Circuit Breaker Trips: ${metrics.circuitBreakerTrips}`);
        console.log(`   🚀 Throughput: ${metrics.throughputRpm} RPM`);
    }

    static health(health: HealthCheckResult): void {
        const statusEmoji = {
            healthy: '🟢',
            degraded: '🟡',
            unhealthy: '🔴'
        };

        console.log('\n🏥 HEALTH STATUS:');
        console.log(`   Status: ${statusEmoji[health.status]} ${health.status.toUpperCase()}`);
        console.log(`   Latency: ${health.latency.toFixed(2)}ms`);
        console.log(`   Model: ${health.modelVersion || 'Unknown'}`);
        if (health.capabilities) {
            console.log(`   Capabilities: ${health.capabilities.join(', ')}`);
        }
        if (health.errors && health.errors.length > 0) {
            console.log(`   Errors: ${health.errors.join(', ')}`);
        }
    }
}

// 🎮 Test Data Generator
class TestDataGenerator {
    static createEmptyBoard(): BoardState {
        return {
            board: Array(6).fill(null).map(() => Array(7).fill('Empty' as const)),
            metadata: {
                gameId: 'test-game',
                moveNumber: 0,
                timestamp: Date.now(),
                playerType: 'human'
            }
        };
    }

    static createRandomBoard(): BoardState {
        const board = Array(6).fill(null).map(() => Array(7).fill('Empty' as const));
        const colors: ('Empty' | 'Red' | 'Yellow')[] = ['Empty', 'Red', 'Yellow'];

        for (let r = 0; r < 6; r++) {
            for (let c = 0; c < 7; c++) {
                if (Math.random() < 0.3) { // 30% chance of piece
                    board[r][c] = colors[Math.floor(Math.random() * 2) + 1]; // Red or Yellow
                }
            }
        }

        return {
            board,
            metadata: {
                gameId: `test-${Math.random().toString(36).substr(2, 9)}`,
                moveNumber: Math.floor(Math.random() * 20),
                timestamp: Date.now(),
                playerType: Math.random() > 0.5 ? 'human' : 'ai'
            }
        };
    }

    static createBatchRequest(size: number): BatchPredictRequest {
        return {
            boards: Array(size).fill(null).map(() => this.createRandomBoard()),
            requestId: `batch-${Date.now()}`,
            priority: 'normal'
        };
    }

    static async* createBoardStream(count: number, delayMs: number = 100): AsyncGenerator<BoardState> {
        for (let i = 0; i < count; i++) {
            yield this.createRandomBoard();
            if (delayMs > 0) {
                await new Promise(resolve => setTimeout(resolve, delayMs));
            }
        }
    }

    static createInvalidBoard(): BoardState {
        return {
            board: [] as any, // Invalid board structure
            metadata: {
                gameId: 'invalid-test',
                moveNumber: -1,
                timestamp: Date.now(),
                playerType: 'human'
            }
        };
    }
}

// 🎯 Main Demo Class
export class MLInferenceDemo {
    /**
     * 🚀 Run comprehensive demonstration of all features
     */
    static async runFullDemo(): Promise<void> {
        DemoVisualizer.header('ML Inference Client Advanced Demo');

        try {
            await this.demoBasicPrediction();
            await this.demoCachingPerformance();
            await this.demoBatchProcessing();
            await this.demoStreamingPredictions();
            await this.demoCircuitBreakerPattern();
            await this.demoHealthMonitoring();
            await this.demoLoadTesting();
            await this.demoConfigurationManagement();
            await this.demoErrorHandling();

            DemoVisualizer.header('Demo Complete - All Systems Operational!');

        } catch (error) {
            DemoVisualizer.error(`Demo failed: ${error.message}`);
            throw error;
        }
    }

    /**
     * 🎯 Basic prediction demonstration
     */
    static async demoBasicPrediction(): Promise<void> {
        DemoVisualizer.section('Basic Prediction Demo');

        const client = new DevelopmentMLInferenceClient();

        try {
            const board = TestDataGenerator.createEmptyBoard();
            DemoVisualizer.info('Making basic prediction request...');

            const prediction = await client.predict(board);

            DemoVisualizer.success(`Prediction received: Move ${prediction.move}`);
            DemoVisualizer.info(`Probabilities: [${prediction.probs.map(p => p.toFixed(3)).join(', ')}]`);
            DemoVisualizer.info(`Inference Time: ${prediction.inferenceTime?.toFixed(2)}ms`);
            DemoVisualizer.info(`Model Version: ${prediction.modelVersion}`);

            const metrics = client.getMetrics();
            DemoVisualizer.metrics(metrics);

        } catch (error) {
            DemoVisualizer.error(`Basic prediction failed: ${error.message}`);
        }
    }

    /**
     * 💾 Caching performance demonstration
     */
    static async demoCachingPerformance(): Promise<void> {
        DemoVisualizer.section('Caching Performance Demo');

        const client = new MLInferenceClient({
            baseUrl: 'http://localhost:8000',
            enableCaching: true,
            cache: {
                enablePositionCache: true,
                maxEntries: 1000,
                ttlMs: 60000,
                enablePredictiveCache: true
            }
        });

        try {
            const board = TestDataGenerator.createRandomBoard();

            // First request - should be cached
            DemoVisualizer.info('Making first request (cache miss expected)...');
            const start1 = performance.now();
            await client.predict(board);
            const time1 = performance.now() - start1;

            // Second request - should be from cache
            DemoVisualizer.info('Making second request (cache hit expected)...');
            const start2 = performance.now();
            await client.predict(board);
            const time2 = performance.now() - start2;

            DemoVisualizer.success(`Cache speedup: ${(time1 / time2).toFixed(1)}x faster`);
            DemoVisualizer.info(`First request: ${time1.toFixed(2)}ms`);
            DemoVisualizer.info(`Second request: ${time2.toFixed(2)}ms`);

            const metrics = client.getMetrics();
            DemoVisualizer.metrics(metrics);

        } catch (error) {
            DemoVisualizer.error(`Caching demo failed: ${error.message}`);
        }
    }

    /**
     * 📦 Batch processing demonstration
     */
    static async demoBatchProcessing(): Promise<void> {
        DemoVisualizer.section('Batch Processing Demo');

        const client = new ProductionMLInferenceClient('http://localhost:8000');

        try {
            const batchRequest = TestDataGenerator.createBatchRequest(5);

            DemoVisualizer.info(`Processing batch of ${batchRequest.boards.length} boards...`);
            const start = performance.now();

            const batchResponse = await client.batchPredict(batchRequest);
            const totalTime = performance.now() - start;

            DemoVisualizer.success(`Batch processed successfully!`);
            DemoVisualizer.info(`Total Time: ${totalTime.toFixed(2)}ms`);
            DemoVisualizer.info(`Average per Board: ${(totalTime / batchResponse.processedCount).toFixed(2)}ms`);
            DemoVisualizer.info(`Throughput: ${(batchResponse.processedCount / totalTime * 1000).toFixed(1)} boards/sec`);

            // Show sample predictions
            batchResponse.predictions.slice(0, 3).forEach((pred, i) => {
                DemoVisualizer.info(`Board ${i + 1}: Move ${pred.move}, Confidence: ${pred.confidence?.toFixed(2) || 'N/A'}`);
            });

        } catch (error) {
            DemoVisualizer.error(`Batch processing failed: ${error.message}`);
        }
    }

    /**
     * 🌊 Streaming predictions demonstration
     */
    static async demoStreamingPredictions(): Promise<void> {
        DemoVisualizer.section('Streaming Predictions Demo');

        const client = new DevelopmentMLInferenceClient();

        try {
            DemoVisualizer.info('Starting streaming prediction demo...');

            const boardStream = TestDataGenerator.createBoardStream(3, 200);
            const predictions: any[] = [];

            for await (const prediction of client.streamPredictions(boardStream)) {
                predictions.push(prediction);
                DemoVisualizer.info(`Stream prediction ${predictions.length}: Move ${prediction.move}`);
            }

            DemoVisualizer.success(`Processed ${predictions.length} streaming predictions`);

        } catch (error) {
            DemoVisualizer.error(`Streaming demo failed: ${error.message}`);
        }
    }

    /**
     * 🔄 Circuit breaker demonstration
     */
    static async demoCircuitBreakerPattern(): Promise<void> {
        DemoVisualizer.section('Circuit Breaker Pattern Demo');

        const client = new MLInferenceClient({
            baseUrl: 'http://invalid-url:9999', // Intentionally invalid
            enableCircuitBreaker: true,
            circuitBreaker: {
                failureThreshold: 2,
                recoveryTimeMs: 5000,
                monitoringWindowMs: 10000,
                minimumRequests: 1
            },
            maxRetries: 1
        });

        try {
            const board = TestDataGenerator.createEmptyBoard();

            DemoVisualizer.info('Testing circuit breaker with failing requests...');

            // Make requests that will fail to trigger circuit breaker
            for (let i = 1; i <= 4; i++) {
                try {
                    await client.predict(board);
                } catch (error) {
                    DemoVisualizer.info(`Request ${i} failed: ${error.message}`);
                }
            }

            const metrics = client.getMetrics();
            DemoVisualizer.info(`Circuit breaker trips: ${metrics.circuitBreakerTrips}`);

            if (metrics.circuitBreakerTrips > 0) {
                DemoVisualizer.success('Circuit breaker successfully activated!');
            }

        } catch (error) {
            DemoVisualizer.info('Circuit breaker demo completed with expected failures');
        }
    }

    /**
     * 🏥 Health monitoring demonstration
     */
    static async demoHealthMonitoring(): Promise<void> {
        DemoVisualizer.section('Health Monitoring Demo');

        const client = new ProductionMLInferenceClient('http://localhost:8000');

        try {
            DemoVisualizer.info('Performing health check...');

            const health = await client.performHealthCheck();
            DemoVisualizer.health(health);

            if (health.status === 'healthy') {
                DemoVisualizer.success('Service is healthy and ready!');
            } else {
                DemoVisualizer.error(`Service health issue detected: ${health.status}`);
            }

        } catch (error) {
            DemoVisualizer.error(`Health check failed: ${error.message}`);
        }
    }

    /**
     * 🚀 Load testing demonstration
     */
    static async demoLoadTesting(): Promise<void> {
        DemoVisualizer.section('Load Testing Demo');

        const client = new ProductionMLInferenceClient('http://localhost:8000');

        try {
            const concurrentRequests = 10;
            const requestsPerThread = 5;

            DemoVisualizer.info(`Starting load test: ${concurrentRequests} concurrent threads, ${requestsPerThread} requests each`);

            const startTime = performance.now();

            const promises = Array(concurrentRequests).fill(null).map(async () => {
                const results = [];
                for (let i = 0; i < requestsPerThread; i++) {
                    try {
                        const board = TestDataGenerator.createRandomBoard();
                        const prediction = await client.predict(board);
                        results.push(prediction);
                    } catch (error) {
                        results.push({ error: error.message });
                    }
                }
                return results;
            });

            const allResults = await Promise.all(promises);
            const totalTime = performance.now() - startTime;
            const totalRequests = allResults.flat().length;
            const successfulRequests = allResults.flat().filter(r => !r.error).length;

            DemoVisualizer.success('Load test completed!');
            DemoVisualizer.info(`Total Requests: ${totalRequests}`);
            DemoVisualizer.info(`Successful: ${successfulRequests}`);
            DemoVisualizer.info(`Success Rate: ${(successfulRequests / totalRequests * 100).toFixed(1)}%`);
            DemoVisualizer.info(`Total Time: ${totalTime.toFixed(2)}ms`);
            DemoVisualizer.info(`Throughput: ${(totalRequests / totalTime * 1000).toFixed(1)} requests/sec`);
            DemoVisualizer.info(`Average Latency: ${(totalTime / totalRequests).toFixed(2)}ms`);

            const finalMetrics = client.getMetrics();
            DemoVisualizer.metrics(finalMetrics);

        } catch (error) {
            DemoVisualizer.error(`Load testing failed: ${error.message}`);
        }
    }

    /**
     * ⚙️ Configuration management demonstration
     */
    static async demoConfigurationManagement(): Promise<void> {
        DemoVisualizer.section('Configuration Management Demo');

        const client = new DevelopmentMLInferenceClient();

        try {
            DemoVisualizer.info('Initial configuration:');
            const initialConfig = client.getConfig();
            console.log('   Cache enabled:', initialConfig.enableCaching);
            console.log('   Max retries:', initialConfig.maxRetries);
            console.log('   Timeout:', initialConfig.timeoutMs + 'ms');

            DemoVisualizer.info('Updating configuration...');
            client.updateConfig({
                maxRetries: 5,
                timeoutMs: 8000,
                enableCaching: false
            });

            const updatedConfig = client.getConfig();
            DemoVisualizer.success('Configuration updated!');
            console.log('   Cache enabled:', updatedConfig.enableCaching);
            console.log('   Max retries:', updatedConfig.maxRetries);
            console.log('   Timeout:', updatedConfig.timeoutMs + 'ms');

        } catch (error) {
            DemoVisualizer.error(`Configuration demo failed: ${error.message}`);
        }
    }

    /**
     * ❌ Error handling demonstration
     */
    static async demoErrorHandling(): Promise<void> {
        DemoVisualizer.section('Error Handling Demo');

        const client = new MLInferenceClient({
            baseUrl: 'http://localhost:8000',
            maxRetries: 2,
            retryDelayMs: 100
        });

        try {
            // Listen for error events
            client.on('error', (errorEvent) => {
                DemoVisualizer.info(`Error event received: ${errorEvent.error.message}`);
            });

            client.on('prediction', (predEvent) => {
                DemoVisualizer.info(`Prediction event: ${predEvent.fromCache ? 'from cache' : 'fresh'}`);
            });

            const board = TestDataGenerator.createInvalidBoard(); // This should cause errors

            try {
                await client.predict(board);
                DemoVisualizer.success('Request succeeded unexpectedly');
            } catch (error) {
                DemoVisualizer.info(`Expected error caught: ${error.message}`);
            }

            const metrics = client.getMetrics();
            DemoVisualizer.info(`Error types recorded: ${Object.keys(metrics.errorsByType).join(', ')}`);

        } catch (error) {
            DemoVisualizer.info('Error handling demo completed with expected errors');
        }
    }

    /**
     * 📊 Performance benchmark
     */
    static async runPerformanceBenchmark(): Promise<void> {
        DemoVisualizer.header('Performance Benchmark');

        const scenarios = [
            { name: 'Basic Client', client: new DevelopmentMLInferenceClient() },
            { name: 'Production Client', client: new ProductionMLInferenceClient('http://localhost:8000') },
            {
                name: 'Caching Enabled', client: new MLInferenceClient({
                    baseUrl: 'http://localhost:8000',
                    enableCaching: true
                })
            },
            {
                name: 'High Performance', client: new MLInferenceClient({
                    baseUrl: 'http://localhost:8000',
                    enableCaching: true,
                    enableConnectionPooling: true,
                    enableCircuitBreaker: true,
                    timeoutMs: 2000,
                    maxRetries: 1
                })
            }
        ];

        for (const scenario of scenarios) {
            DemoVisualizer.section(`Benchmarking: ${scenario.name}`);

            try {
                const testCount = 5;
                const times: number[] = [];

                for (let i = 0; i < testCount; i++) {
                    const board = TestDataGenerator.createRandomBoard();
                    const start = performance.now();

                    try {
                        await scenario.client.predict(board);
                        times.push(performance.now() - start);
                    } catch (error) {
                        DemoVisualizer.error(`Request ${i + 1} failed: ${error.message}`);
                    }
                }

                if (times.length > 0) {
                    const avgTime = times.reduce((sum, time) => sum + time, 0) / times.length;
                    const minTime = Math.min(...times);
                    const maxTime = Math.max(...times);

                    DemoVisualizer.success(`Benchmark completed!`);
                    DemoVisualizer.info(`Average: ${avgTime.toFixed(2)}ms`);
                    DemoVisualizer.info(`Min: ${minTime.toFixed(2)}ms`);
                    DemoVisualizer.info(`Max: ${maxTime.toFixed(2)}ms`);

                    const metrics = scenario.client.getMetrics();
                    DemoVisualizer.info(`Success Rate: ${(metrics.successfulRequests / metrics.totalRequests * 100).toFixed(1)}%`);
                }

            } catch (error) {
                DemoVisualizer.error(`Benchmark failed: ${error.message}`);
            }
        }
    }
}

// 🧪 Test Helpers
class TestHelpers {
    static async waitForEvent(client: MLInferenceClient, eventName: string, timeoutMs: number = 5000): Promise<any> {
        return new Promise((resolve, reject) => {
            const timeout = setTimeout(() => {
                reject(new Error(`Event ${eventName} not received within ${timeoutMs}ms`));
            }, timeoutMs);

            client.once(eventName, (data) => {
                clearTimeout(timeout);
                resolve(data);
            });
        });
    }
}

// 🎯 Export demo functions
export {
    DemoVisualizer,
    TestDataGenerator,
    TestHelpers
};

// 🚀 Quick demo runner
export async function runQuickDemo(): Promise<void> {
    console.log('🚀 Running Quick ML Inference Demo...\n');

    try {
        await MLInferenceDemo.demoBasicPrediction();
        await MLInferenceDemo.demoCachingPerformance();
        await MLInferenceDemo.demoHealthMonitoring();

        console.log('\n✅ Quick demo completed successfully!');
    } catch (error) {
        console.error('\n❌ Quick demo failed:', error.message);
    }
}

// 🎯 Comprehensive demo runner
export async function runComprehensiveDemo(): Promise<void> {
    console.log('🎯 Running Comprehensive ML Inference Demo...\n');

    try {
        await MLInferenceDemo.runFullDemo();
        await MLInferenceDemo.runPerformanceBenchmark();

        console.log('\n🎉 Comprehensive demo completed successfully!');
    } catch (error) {
        console.error('\n💥 Comprehensive demo failed:', error.message);
    }
} 