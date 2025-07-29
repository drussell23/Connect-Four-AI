# 🧠 Continuous Learning System Guide

## Overview

The Connect Four AI now features an advanced continuous learning system that enables the AI to learn from every game, especially from losses. This system implements pattern-specific learning, prioritized experience replay, and real-time model updates without service interruption.

## Architecture

### Components

1. **TypeScript Backend Components** (`/backend/src/ai/`)
   - **ContinuousLearningService**: Manages WebSocket connection to ML service and coordinates learning
   - **PatternDefenseService**: Analyzes loss patterns and develops defensive strategies
   - **GameService Integration**: Logs all games with detailed loss pattern analysis

2. **Python ML Components** (`/ml_service/`)
   - **continuous_learning.py**: Main learning pipeline with experience replay
   - **learning_monitor.py**: Monitors stability and prevents catastrophic forgetting
   - **WebSocket Server**: Real-time communication on port 8002

### Data Flow

```
Game Ends → GameService analyzes loss patterns → ML Client logs game
     ↓
WebSocket → Continuous Learning Pipeline → Experience Buffer
     ↓                                           ↓
Pattern Analysis ← Model Update ← Prioritized Sampling
     ↓
Pattern Defense Service ← Real-time Updates → TypeScript Backend
```

## Features

### 1. Loss Pattern Analysis
- **Horizontal**: Detects horizontal four-in-a-row losses
- **Vertical**: Identifies column-based defeats
- **Diagonal**: Tracks diagonal pattern losses
- **Anti-diagonal**: Monitors reverse diagonal threats

### 2. Prioritized Experience Replay
- Losses have 2x priority over wins
- Pattern-specific sampling for targeted improvement
- Configurable buffer size (default: 100,000 games)

### 3. Real-time Model Updates
- Updates every 100 games (configurable)
- No service interruption during updates
- Automatic rollback if validation fails

### 4. Learning Stability Monitoring
- Prevents catastrophic forgetting
- Tracks pattern-specific performance
- Generates stability reports and alerts

## Configuration

### Backend Environment Variables
```bash
# ML Service Configuration
ML_SERVICE_URL=http://localhost:8000
ML_WEBSOCKET_URL=ws://localhost:8002/ws

# Feature Flags
ENABLE_CONTINUOUS_LEARNING=true
ENABLE_PATTERN_DEFENSE=true
```

### Continuous Learning Configuration
```javascript
// In continuous_learning.py
config = {
    'buffer_capacity': 100000,
    'learning_rate': 0.0001,
    'batch_size': 32,
    'update_frequency': 100,  // Update every 100 games
    'min_games': 50,          // Minimum games before first update
    'validation_threshold': 0.95,
    'catastrophic_threshold': 0.15
}
```

## Usage

### Starting the System

1. **Option 1: Integrated Startup (Recommended)**
   ```bash
   cd ml_service
   python start_with_continuous_learning.py
   ```

2. **Option 2: Separate Services**
   ```bash
   # Terminal 1: Main ML Service
   cd ml_service
   python ml_service.py

   # Terminal 2: Continuous Learning
   python -c "from continuous_learning import *; asyncio.run(run_continuous_learning(model_manager, config))"
   ```

### Monitoring Progress

The system provides real-time metrics through:

1. **WebSocket Messages**
   - Connect to `ws://localhost:8002/ws`
   - Receive updates on learning progress, model updates, and pattern insights

2. **Backend Logs**
   ```bash
   # Watch for learning events
   tail -f backend/logs/app.log | grep -i "learning\|pattern\|defense"
   ```

3. **Metrics Endpoint**
   ```bash
   # Get current learning metrics
   curl http://localhost:3000/api/ai/learning-metrics
   ```

## How It Works

### 1. Game Logging
When a game ends, the GameService:
- Analyzes the final board state
- Identifies loss patterns if AI lost
- Logs the game with pattern information to ML service

### 2. Experience Processing
The continuous learning pipeline:
- Stores game data in prioritized experience buffer
- Samples experiences with focus on losses
- Extracts training examples from game moves

### 3. Model Updates
Every 100 games (configurable):
- Fine-tunes the model on recent experiences
- Validates improvement on test positions
- Deploys updated model or rolls back

### 4. Pattern Defense
The PatternDefenseService:
- Learns from specific loss patterns
- Develops targeted defensive strategies
- Provides real-time defense recommendations

## Monitoring and Debugging

### Check Learning Status
```javascript
// In backend console
const learningService = app.get(ContinuousLearningService);
console.log(learningService.getLearningMetrics());
```

### View Pattern Defense Metrics
```javascript
const defenseService = app.get(PatternDefenseService);
console.log(defenseService.getDefenseMetrics());
```

### Force Model Update
```javascript
await learningService.forceModelUpdateCheck();
```

## Performance Impact

- **Memory**: ~100MB for experience buffer
- **CPU**: Minimal during gameplay, spikes during model updates
- **Network**: WebSocket connection uses <1KB/s
- **Model Updates**: ~5-10 seconds every 100 games

## Troubleshooting

### WebSocket Connection Failed
```bash
# Check if continuous learning is running
curl -I http://localhost:8002/ws

# Check logs
tail -f ml_service/logs/continuous_learning.log
```

### Model Not Improving
1. Check experience buffer size
2. Verify loss patterns are being detected
3. Review validation threshold settings
4. Check for catastrophic forgetting alerts

### High Memory Usage
- Reduce `buffer_capacity` in config
- Increase `update_frequency` to process games more often
- Enable memory monitoring in learning monitor

## Best Practices

1. **Let It Learn**: The system needs at least 50 games before first update
2. **Monitor Stability**: Watch for catastrophic forgetting alerts
3. **Pattern Balance**: Ensure AI faces diverse opponents for balanced learning
4. **Regular Backups**: Model history keeps last 10 versions automatically

## Future Enhancements

- [ ] Distributed learning across multiple instances
- [ ] Transfer learning from professional games
- [ ] Adaptive learning rate scheduling
- [ ] Multi-agent self-play training
- [ ] Neural architecture search for optimal model structure