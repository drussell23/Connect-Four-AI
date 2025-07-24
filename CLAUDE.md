# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

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
# Standard development (RECOMMENDED)
npm run dev

# Enhanced restart with comprehensive cleanup
npm run restart:turbo:build:enhanced:force:clean

# Emergency stop all services
npm run emergency

# Check system health
npm run system:health
```

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
# Interactive ML management
npm run ml:pipeline

# Check ML service status
npm run ml:status

# Train models
npm run ml:train
```

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