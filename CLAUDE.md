# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Database Management

The project uses SQLite for development with automatic initialization:
- Database is created once on first run at `./data/connect_four_dev.db`
- Tables persist across restarts - no data loss between sessions
- Run `cd backend && npm run db:init` to manually initialize
- Run `cd backend && npm run db:reset` to completely reset (WARNING: destroys all data)
- The database is NOT recreated on every startup - only missing tables are added

## Architecture Overview

Connect Four AI is an enterprise-grade AI research platform with a sophisticated microservices architecture:

- **Frontend**: React 18 TypeScript application at `/frontend/`
- **Backend**: NestJS API server with WebSocket gateway at `/backend/`
- **ML Service**: Python FastAPI service for ML inference at `/ml_service/`
- **AI Stability Architecture**: 5-tier fallback system ensuring 99.9% uptime
- **Real-Time Board Tracking**: Live capture and analysis of board states during gameplay

## Essential Commands

### Development
```bash
# Standard development - starts EVERYTHING including ML services
npm run dev

# Alternative: Start all services with automatic Python setup
npm run start:all  # Auto-detects M1 Macs and enables optimizations

# Fast mode without ML services (fastest startup)
npm run start:all:fast

# Optimized mode with ML failover (fast AI responses even with ML issues)
npm run start:all:optimized

# Force M1 optimizations (for non-M1 Macs or testing)
npm run start:m1

# Enhanced restart with comprehensive cleanup
npm run restart:turbo:build:enhanced:force:clean

# Stop everything (frontend, backend, ML services)
npm run stop:all

# Restart everything
npm run restart:all

# Emergency stop all services
npm run emergency

# Check system health
npm run system:health
```

### Apple Silicon (M1/M2/M3) Optimization

The system **automatically detects** M1/M2/M3 Macs and enables optimizations. When detected:
- Memory limits are automatically adjusted (1GB heap for backend)
- TensorFlow thread count is optimized (2 threads)
- Worker scaling based on memory pressure
- Background learning throttle with automatic pause/resume
- Lightweight inference mode during high memory pressure
- Real-time memory dashboard for monitoring

```bash
# All commands auto-detect M1 and optimize accordingly:
npm run start:all        # Auto-enables M1 optimizations on Apple Silicon
npm run restart:all      # Auto-enables M1 optimizations on Apple Silicon

# Force M1 optimizations (useful for testing or non-M1 Macs)
npm run start:m1
npm run restart:m1

# M1-specific operations
npm run m1:cleanup       # Emergency memory cleanup for M1
npm run m1:monitor       # Monitor M1-specific performance
npm run m1:benchmark     # Run M1 optimization benchmarks

# Manual control with explicit flags
./start-all.sh --m1-opt  # Force M1 optimizations
./restart-all.sh --m1-opt # Force M1 optimizations
```

When M1 optimizations are active, additional endpoints become available:
- Memory Dashboard: http://localhost:3000/api/dashboard/metrics
- Health Summary: http://localhost:3000/api/dashboard/health-summary
- Emergency API: http://localhost:3000/api/emergency/status
- Stress Testing: http://localhost:3000/api/dashboard/stress-test/start

### Testing
```bash
# Run all tests
npm run test

# Run AI-specific tests
npm run test:ai

# Run integration tests
npm run test:integration
```

### Code Quality
```bash
# No global lint/typecheck commands - run in specific directories:
cd frontend && npm run build  # TypeScript check for frontend
cd backend && npm run build   # TypeScript check for backend
```

### ML Pipeline
```bash
# Set up Python environment (one-time)
npm run ml:setup

# Start all ML services
npm run ml:start

# Stop ML services
npm run ml:stop

# Check ML service status
npm run ml:status

# Interactive ML management
npm run ml:pipeline

# Train models
npm run ml:train
```

### Complete Stack with ML Services

The main `start:all` command now includes automatic ML services setup:

```bash
# Start everything - frontend, backend, AND ML services
npm run start:all

# This automatically:
# 1. Checks for Python installation
# 2. Creates Python virtual environments (first run only)
# 3. Installs ML dependencies (first run only)
# 4. Starts all services:
#    - Backend (port 3000)
#    - Frontend (port 3001)
#    - ML Service (port 8000)
#    - ML Inference (port 8001)
#    - Continuous Learning (port 8002)
#    - AI Coordination (port 8003)
#    - Python Trainer (port 8004)
#    - Integration WebSocket (port 8888)

# To skip ML services for faster startup:
npm run start:all:fast
```

## Self-Healing Dependencies

The project includes an intelligent self-healing system for dependency issues:

### Commands
```bash
# Fix dependency issues automatically
npm run fix:dependencies

# Check dependency health
npm run health:check

# Migrate TensorFlow imports to use fallback
npm run migrate:tensorflow
```

### How It Works
1. **Auto-Detection**: Detects system architecture and known issues
2. **Multi-Strategy Installation**: Tries multiple installation approaches
3. **TensorFlow Fallback**: Automatically falls back to pure JS version if native fails
4. **Health Monitoring**: Built-in health checks for all dependencies

### TensorFlow Handling
On Apple Silicon Macs, TensorFlow native bindings often fail. The system:
- Attempts native installation first (faster)
- Falls back to pure JavaScript version (slower but works everywhere)
- Provides mock implementation for development if both fail

## Important Architecture Details

### API Configuration
The backend API uses the `/api` prefix. Frontend API calls should use:
```typescript
const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:3000/api';
```

### WebSocket Events
```typescript
// Key socket events
'dropDisc'     // Player move
'playerMove'   // Move confirmation
'aiMove'       // AI move response
'gameError'    // Error handling
```

### Board State Tracking
The frontend captures real-time board states before and after each move:
```typescript
setBoardBeforeMove(board.map(row => [...row]));
// Move happens
setBoardAfterMove(updatedBoard);
```

### AI Stability Architecture
The system uses a 5-tier stability architecture at `/backend/src/ai/stability/`:
- CRITICAL: <1ms emergency fallback
- STABLE: <100ms production game AI
- ADVANCED: <1s advanced algorithms
- EXPERIMENTAL: <5s complex systems
- RESEARCH: <30s experimental algorithms

### Async AI Architecture
New async components at `/backend/src/ai/async/`:
- **AsyncCacheManager**: Memoization and caching for AI computations
- **CircuitBreaker**: Fault tolerance with exponential backoff retry
- **RequestBatcher**: Batching and priority queuing for performance
- **DynamicStrategySelector**: Runtime AI model selection (AlphaZero, DQN, MCTS, etc.)
- **PerformanceMonitor**: Real-time metrics and error tracking
- **PrecomputationEngine**: Background move precomputation
- **AsyncAIOrchestrator**: Main orchestrator bringing all components together

### Key Service Ports
- Frontend: 3001
- Backend: 3000
- ML Service: 8000

### Memory Dashboard API
The M1-optimized memory dashboard provides real-time monitoring:
- `GET /api/dashboard/metrics` - Current system metrics
- `GET /api/dashboard/metrics/history` - Historical metrics data
- `GET /api/dashboard/health-summary` - System health status and recommendations
- `POST /api/dashboard/stress-test/start` - Start stress testing
- `GET /api/dashboard/stress-test/status` - Check active stress tests
- WebSocket: `/metrics` namespace for real-time updates

### Development Workflow
1. Always use `npm run restart:turbo:build:enhanced:force:clean` for a clean restart
2. This command handles zombie processes, cache clearing, and proper service startup
3. If you see React Suspense errors, clear browser cache: Cmd+Shift+R

### Testing Approach
- Jest for unit tests in both frontend and backend
- Integration tests for API endpoints
- AI-specific tests for algorithm performance
- Check test commands in individual package.json files

## Current Status
- All core services operational
- 15+ deep RL algorithms implemented
- Real-time multiplayer via WebSocket
- Comprehensive MLOps pipeline
- Enterprise-grade command system with tiered service levels