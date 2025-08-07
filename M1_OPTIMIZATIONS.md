# 🍎 M1 Mac Optimizations for Connect Four AI

This document describes the comprehensive optimizations implemented to ensure smooth performance on Apple Silicon (M1/M2/M3) Macs without sacrificing AI capabilities.

## 🎯 Overview

The M1 optimization system intelligently detects system resources and automatically configures the AI to run smoothly based on available memory and CPU cores. Instead of removing features, we make them adaptive.

## 🚀 Quick Start

```bash
# Enable M1 optimizations automatically
npm run start:m1

# Or manually with flag
./start-all.sh --m1-opt

# M1-specific commands
npm run m1:cleanup      # Emergency memory cleanup
npm run m1:monitor      # Monitor M1 performance
npm run m1:benchmark    # Run performance benchmarks
```

## ✨ Latest Updates

### Conditional Module Loading
- M1 optimizations are now **opt-in** rather than automatic
- System detects M1 Mac but doesn't enable optimizations unless requested
- All M1 modules are lazy-loaded only when `--m1-opt` flag is used
- Prevents unnecessary memory overhead when not needed

### Improved Startup Scripts
- `start-all.sh`, `stop-all.sh`, and `restart-all.sh` now support `--m1-opt` flag
- Helpful tips shown when M1 Mac is detected
- Environment variables properly set: `M1_OPTIMIZED=true`, `ENABLE_M1_FEATURES=true`

## 🚀 Key Optimizations Implemented

### Phase 1: Clean Tensor Management
- **Shared Tensor Operations Helper** (`tensor-ops.ts`)
  - All model inference wrapped in `tf.tidy()` for automatic cleanup
  - Batch prediction with memory-efficient processing
  - Training batch creation with proper tensor disposal
  - Board-to-tensor conversion with cleanup

### Phase 2: Adaptive Runtime for M1 (16GB)
- **DRL Replay Buffers**: Reduced from 100k → 20k for 16GB M1
- **Per-Agent Buffer Caps**: Limited to 50k entries maximum
- **Cache Sizes**: Hard limit of 50k entries for all caches
- **Agent-Specific Configuration** (`m1-agent-config.ts`)
  - DQN/DoubleDQN: 20k buffer for 16GB
  - DDPG/SAC/TD3: 30k buffer (two networks need more memory)
  - PPO/A3C: 10k buffer (policy gradient methods)
  - AlphaZero/MuZero: 20k with compression

### 1. **Runtime Architecture Detection** (`m1-performance-optimizer.ts`)
- Automatically detects Apple Silicon vs Intel architecture
- Detects available RAM and CPU cores
- Generates optimal configuration based on system resources

### 2. **Memory Management** (`tensorflow-memory-manager.ts`)
- Automatic tensor disposal to prevent memory leaks
- Batch cleanup of TensorFlow.js resources
- Memory pressure monitoring with automatic cleanup
- GPU texture cleanup for WebGL/WebGPU backends

### 3. **Adaptive Replay Buffer** (`adaptive-replay-buffer.ts`)
- Dynamically resizes based on available memory
- Compression for M1 Macs with ≤8GB RAM
- Priority sampling for important experiences
- Automatic cleanup when memory pressure is high

### 4. **Smart Caching** (`adaptive-cache-manager.ts`)
- LRU eviction policy with adaptive sizing
- Separate caches for predictions, transpositions, and evaluations
- TTL-based cleanup (shorter on M1)
- Automatic cache reduction under memory pressure

### 5. **Configurable AI Features** (`m1-ai-config.service.ts`)
- Background training: OFF by default on 8GB M1, ON for 16GB+
- Self-play: OFF by default on M1 to reduce background load
- Continuous learning: Only enabled on 16GB+ systems
- All features can be overridden via environment variables

## 📊 Configuration Presets

### M1 Base (8GB RAM)
```typescript
{
  maxOldSpaceSize: 1024MB,
  tfNumThreads: 2,
  replayBufferSize: 2000,
  enableBackgroundTraining: false,
  enableSelfPlay: false,
  predictionCacheSize: 100,
  transpositionTableSize: 20000
}
```

### M1 (16GB RAM) - Your Configuration
```typescript
{
  maxOldSpaceSize: 2048MB,
  tfNumThreads: 4,
  replayBufferSize: 20000,  // Phase 2: 20k for 16GB
  enableBackgroundTraining: true,
  enableSelfPlay: false,    // Disabled to reduce load
  predictionCacheSize: 200,
  transpositionTableSize: 50000  // Phase 2: Capped at 50k
}
```

### M1 Pro/Max (32GB+ RAM)
```typescript
{
  maxOldSpaceSize: 4096MB,
  tfNumThreads: 8,
  replayBufferSize: 50000,  // Still capped at 50k
  enableBackgroundTraining: true,
  enableSelfPlay: true,
  predictionCacheSize: 500,
  transpositionTableSize: 50000  // Consistent 50k cap
}
```

## 🔧 Environment Variables

Override automatic detection with these environment variables:

```bash
# Memory limits
BACKEND_MEMORY_LIMIT=1024      # Max heap size in MB
MAX_MEMORY_MB=1024             # Max memory for AI operations

# Feature toggles
ENABLE_BACKGROUND_TRAINING=false
ENABLE_SELF_PLAY=false
ENABLE_CONTINUOUS_LEARNING=false

# TensorFlow optimization
TF_NUM_INTRAOP_THREADS=2       # Threads for operations
TF_NUM_INTEROP_THREADS=1       # Threads between operations

# Cache sizes
PREDICTION_CACHE_SIZE=100
TRANSPOSITION_TABLE_SIZE=20000
```

## 🚀 Startup Commands

### Standard startup (auto-detects and optimizes):
```bash
npm run start:all
```

### M1-optimized startup (forces M1 settings):
```bash
cd backend && npm run start:m1
```

### Fast mode (skips ML initialization):
```bash
npm run start:all -- --fast-mode
```

### Memory-optimized mode:
```bash
npm run start:all -- --memory-opt
```

## 📈 Performance Monitoring

The system continuously monitors:
- Heap memory usage
- TensorFlow tensor count
- Cache hit rates
- Replay buffer size

When memory pressure exceeds 80%:
1. Background features are automatically disabled
2. Caches are reduced or cleared
3. Replay buffer size is decreased
4. Garbage collection is triggered

## 🎮 User Experience

### What users will notice:
- ✅ Smooth, responsive gameplay
- ✅ Fast AI move calculations
- ✅ No system slowdowns or beach balls
- ✅ Adaptive difficulty that learns from games

### What happens behind the scenes:
- 🔄 Memory is actively managed
- 📊 Caches resize based on usage
- 🧹 Automatic cleanup prevents leaks
- 🎯 Features toggle based on resources

## 🐛 Debugging

Check optimization status:
```bash
# View current configuration
curl http://localhost:3000/api/health

# Check memory usage
curl http://localhost:3000/api/tensorflow/status
```

Enable debug logging:
```bash
DEBUG=* npm run start:all
```

## 🔮 Future Enhancements

1. **Metal Performance Shaders** integration for M1 GPU acceleration
2. **Unified Memory** architecture optimization
3. **Neural Engine** support for inference
4. **Dynamic batch sizing** based on memory
5. **Predictive memory management** using usage patterns

## 📝 Summary

These optimizations ensure that Connect Four AI runs smoothly on M1 Macs by:
- Detecting system resources at runtime
- Adapting features and memory usage dynamically
- Preventing memory leaks through active management
- Maintaining gameplay quality while reducing background load

The result is a responsive, intelligent AI that respects system resources while providing an excellent gaming experience.