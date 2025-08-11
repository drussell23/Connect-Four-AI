# Performance Metrics Guide

This document describes the performance monitoring and benchmarking capabilities integrated into the Connect Four AI backend.

## Memory Management System

### Overview
The system includes comprehensive memory management designed specifically for M1 Macs and resource-constrained environments.

### Key Components

1. **MemoryManagementService** (`/backend/src/game/memory-management.service.ts`)
   - Central orchestrator for all memory management
   - Monitors memory health every 10 seconds
   - Triggers cleanup at 80% heap usage
   - Integrates with AI cache and TensorFlow memory management

2. **DynamicMemoryMonitor** (`/backend/src/ai/m1-optimized/dynamic-memory-monitor.ts`)
   - Real-time memory pressure detection
   - 4 pressure levels: NORMAL, MODERATE, HIGH, CRITICAL
   - Emits events for system-wide response

3. **AdaptiveCacheManager** (`/backend/src/ai/m1-optimized/adaptive-cache-manager.ts`)
   - Dynamic cache resizing based on memory pressure
   - LRU eviction strategy
   - Hit rate tracking and optimization

4. **BackgroundLearningThrottle** (`/backend/src/ai/m1-optimized/background-learning-throttle.ts`)
   - Worker scaling: 8 workers (NORMAL) → 1 worker (CRITICAL)
   - Task prioritization and deferral
   - System load monitoring

## Performance Benchmarking

### Quick Benchmarks (Recommended)

Run simple benchmarks without complex dependencies:

```bash
# Simple memory test - tests tensor management, arrays, and caching
npm run benchmark:memory

# Simple algorithm test - tests SimpleAI performance across scenarios
npm run benchmark:algorithms
```

### Full Benchmarks (Advanced)

Run comprehensive benchmarks with full module dependencies:

```bash
# Full memory stress test suite
npm run benchmark:memory:full

# Full algorithm profiling suite  
npm run benchmark:algorithms:full

# Note: Full benchmarks require all services to be properly configured
# and may fail if there are dependency injection issues
```

### Benchmark Results

**Memory Test Results**:
- Tensor creation/cleanup efficiency
- Memory allocation patterns
- Cache performance metrics
- LRU eviction effectiveness

**Algorithm Test Results**:
- Response time per difficulty level
- Memory usage per move
- Performance across different board states
- Opening book vs computed moves

## Key Metrics

### Memory Metrics
- **Heap Usage**: Percentage of Node.js heap memory used
- **System Memory**: Available system RAM
- **TensorFlow Tensors**: Number of active tensors
- **Cache Hit Rate**: Percentage of cache hits vs misses
- **Cleanup Frequency**: How often memory cleanup is triggered

### Performance Metrics
- **AI Response Time**: Time to compute next move
- **Algorithm Duration**: Execution time per algorithm
- **Memory Per Move**: Memory allocated for each AI computation
- **Tensor Creation**: Number of tensors created per move
- **Worker Count**: Active background workers

## Monitoring Endpoints

### Emergency Cleanup
```bash
curl -X POST http://localhost:3000/api/emergency/cleanup
```

### Memory Status
```bash
curl http://localhost:3000/api/emergency/status | python3 -m json.tool
```

### Memory Dashboard
```bash
open http://localhost:3001/dashboard
```

## Performance Optimization Tips

1. **For M1 Macs**:
   - System auto-detects M1 and enables optimizations
   - Reduces worker count and cache sizes
   - Uses lightweight AI models under pressure

2. **Memory Pressure Handling**:
   - NORMAL: Full performance, all features enabled
   - MODERATE: Reduced cache, fewer workers
   - HIGH: Lightweight AI only, minimal caching
   - CRITICAL: Emergency mode, basic moves only

3. **Best Practices**:
   - Monitor memory dashboard during gameplay
   - Run benchmarks after significant changes
   - Use appropriate AI difficulty for system capacity
   - Enable M1 optimizations on Apple Silicon

## Troubleshooting

### High Memory Usage
1. Check active games: `npm run m1:status`
2. Force cleanup: `npm run m1:cleanup`
3. Reset TensorFlow: `npm run m1:reset-tf`

### Slow AI Response
1. Check memory pressure level in logs
2. Reduce AI difficulty setting
3. Clear AI cache: `npm run m1:gc`

### Running Benchmarks
1. Stop all services first: `npm run stop:all`
2. Run benchmark in isolation
3. Monitor system resources during test