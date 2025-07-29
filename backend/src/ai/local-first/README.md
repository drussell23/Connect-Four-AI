# Local-First AI Implementation

This module provides offline-capable AI for Connect Four with progressive enhancement and multiple fallback strategies.

## Features

### 1. **IndexedDB Model Storage**
- Persistent storage for AI models
- Compression and encryption support
- Query and filtering capabilities
- Automatic cache management

### 2. **Service Worker Background Computation**
- Offload AI computations to background thread
- Precomputation of likely positions
- Request batching and prioritization
- WebAssembly integration for performance

### 3. **WebAssembly Performance Module**
- High-performance minimax implementation
- Alpha-beta pruning optimization
- Transposition table support
- ~10x faster than JavaScript implementation

### 4. **Offline Prediction Strategies**
- Pattern matching
- Opening book
- Neural network inference
- Monte Carlo tree search
- Minimax with alpha-beta pruning

### 5. **Model Synchronization**
- Delta sync with server
- Conflict resolution strategies
- Bandwidth limiting
- Progress tracking

## Architecture

```
┌─────────────────────────────────────────────────────────┐
│                   Frontend Application                   │
├─────────────────────────────────────────────────────────┤
│                  Local-First AI Service                  │
├──────────────┬────────────────┬────────────────────────┤
│              │                │                         │
│   IndexedDB  │ Service Worker │    WebAssembly         │
│   Storage    │   Compute      │     Engine             │
│              │                │                         │
├──────────────┴────────────────┴────────────────────────┤
│                   Offline Prediction                     │
│          (Pattern, NN, MCTS, Minimax, etc.)            │
├─────────────────────────────────────────────────────────┤
│                    Model Sync Service                    │
│              (When online connection available)          │
└─────────────────────────────────────────────────────────┘
```

## Usage

### Basic Usage

```typescript
import { LocalFirstAIService } from './local-first-ai.service';

// Get best move
const move = await localAI.getBestMove(board, 'Red');

// Set offline mode
localAI.setOfflineMode(true);

// Download models for offline
await localAI.downloadModelsForOffline();
```

### Advanced Configuration

```typescript
const config = {
  enableOffline: true,
  enableServiceWorker: true,
  enableWebAssembly: true,
  cacheSize: 10000,
  syncInterval: 300000, // 5 minutes
  modelStorageQuota: 100 * 1024 * 1024 // 100MB
};
```

### Service Worker Setup

```javascript
// Register service worker
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('/ai-worker.js');
}
```

### WebAssembly Module

The WASM module provides:
- Minimax with alpha-beta pruning
- Board evaluation functions
- Move ordering optimizations
- Transposition tables

Build the WASM module:
```bash
cd src/ai/local-first/wasm
npm run build-wasm
```

## Performance

### Benchmarks

| Method | Avg Time | Nodes/sec | Offline |
|--------|----------|-----------|---------|
| WASM | 12ms | 500K | ✅ |
| Service Worker | 25ms | 200K | ✅ |
| Cached Model | 8ms | N/A | ✅ |
| Heuristic | 2ms | N/A | ✅ |

### Memory Usage

- IndexedDB: Up to 100MB for models
- WASM: 16MB initial, 256MB max
- Cache: 10,000 positions
- Service Worker: Minimal overhead

## Offline Capabilities

### Available Offline
- ✅ Move computation
- ✅ Pattern recognition
- ✅ Opening book lookup
- ✅ Neural network inference
- ✅ Position evaluation

### Requires Connection
- ❌ Model training
- ❌ New model downloads
- ❌ Sync with server
- ❌ Multiplayer features

## Development

### Testing

```bash
# Run tests
npm test src/ai/local-first

# Run demo
npm run demo:local-first
```

### Building WebAssembly

```bash
# Install dependencies
npm install -g wabt

# Build WASM
cd src/ai/local-first/wasm
node build-wasm.js
```

### Debugging

Enable debug logging:
```typescript
localStorage.setItem('DEBUG_LOCAL_AI', 'true');
```

View IndexedDB:
- Chrome: DevTools > Application > Storage > IndexedDB
- Firefox: DevTools > Storage > IndexedDB

## Future Enhancements

1. **Federated Learning**
   - Train models across devices
   - Privacy-preserving aggregation
   - Decentralized model updates

2. **P2P Model Sharing**
   - WebRTC model exchange
   - Distributed storage
   - Collaborative learning

3. **Advanced Compression**
   - Model quantization
   - Pruning and distillation
   - Dynamic compression

4. **Edge Computing**
   - Deploy to edge devices
   - IoT integration
   - Real-time inference

## Troubleshooting

### Service Worker Not Loading
- Check HTTPS/localhost requirement
- Verify service worker scope
- Clear browser cache

### WASM Module Errors
- Ensure WASM is supported
- Check memory limits
- Verify module compilation

### IndexedDB Quota Exceeded
- Clear old models
- Increase quota request
- Implement cleanup policy

### Sync Failures
- Check network connectivity
- Verify server endpoint
- Review CORS settings