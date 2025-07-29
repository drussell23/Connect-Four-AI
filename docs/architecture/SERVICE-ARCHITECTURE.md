# Connect Four AI - Service Architecture

## Overview

The Connect Four AI application uses a microservices architecture with multiple specialized services working together to provide an advanced AI gaming experience with full offline capabilities.

## Service Ports

| Service | Port | Description |
|---------|------|-------------|
| Frontend | 3001 | React application with PWA capabilities |
| Backend API | 3000 | NestJS API server with WebSocket support |
| ML Service | 8000 | Python FastAPI service for ML inference |
| ML Inference | 8001 | Enhanced inference service with multiple models |
| AI Coordination | 8002 | AI coordination hub for distributed processing |
| Python Trainer | 8003 | Model training service (AlphaZero, MuZero, etc.) |

## Service Descriptions

### Frontend (Port 3001)
- React 18 TypeScript application
- Progressive Web App (PWA) with offline support
- Service Worker for caching and background sync
- WebAssembly integration for high-performance AI
- Real-time WebSocket connection for multiplayer

### Backend API (Port 3000)
- NestJS framework with TypeScript
- WebSocket gateway for real-time communication
- RESTful API endpoints under `/api` prefix
- AI orchestration and model management
- Game state persistence and synchronization

### ML Service (Port 8000)
- Python FastAPI service
- Core ML inference capabilities
- Model loading and management
- Integration with TensorFlow and PyTorch

### ML Inference (Port 8001)
- Enhanced inference service
- Multiple model support
- Performance optimizations
- Batch processing capabilities

### AI Coordination Hub (Port 8002)
- Distributed AI processing
- Load balancing across models
- Performance monitoring
- Fault tolerance and failover

### Python Trainer (Port 8003)
- Advanced model training service
- Supports AlphaZero, MuZero, and Transformer architectures
- ONNX export for cross-platform deployment
- Training job management and monitoring

## Offline Architecture

### Frontend Offline Support
- **Service Worker**: Caches app shell and static assets
- **IndexedDB**: Stores game state and AI models locally
- **WebAssembly**: High-performance offline AI computation
- **Background Sync**: Synchronizes moves when connection restored

### Backend Resilience
- **Connection Manager**: Handles disconnections gracefully
- **State Recovery**: Restores game state after reconnection
- **Move Tracking**: Tracks moves during disconnections
- **Conflict Resolution**: Handles concurrent offline moves

## Starting Services

### Start All Services
```bash
npm run start:all
```

This starts all services in the correct order with proper environment variables.

### Stop All Services
```bash
npm run stop:all
```

This gracefully stops all services and cleans up resources.

### Restart All Services
```bash
npm run restart:all
```

This stops all services and starts them again, useful for applying configuration changes.

## Service Dependencies

```
Frontend
  ├── Backend API (WebSocket + REST)
  └── Service Worker (Offline)
  
Backend API
  ├── ML Service (Inference)
  ├── Python Trainer (Model Updates)
  └── Database (Game State)
  
ML Service
  ├── ML Inference (Enhanced Models)
  └── AI Coordination (Distributed Processing)
```

## Health Checks

Each service exposes health endpoints:

- Backend: `http://localhost:3000/api/health`
- ML Service: `http://localhost:8000/health`
- Python Trainer: `http://localhost:8003/health`

## Logs

Service logs are stored in the `logs/` directory:

- `logs/backend.log` - Backend API logs
- `logs/frontend.log` - Frontend build/serve logs
- `logs/ml_service.log` - ML Service logs
- `logs/ml_inference.log` - ML Inference logs
- `logs/ai_coordination.log` - AI Coordination logs
- `logs/python_trainer.log` - Python Trainer logs

## Environment Variables

### Backend
- `PORT=3000` - API server port
- `NODE_ENV=development|production` - Environment mode
- `DATABASE_URL` - PostgreSQL connection string

### Frontend
- `PORT=3001` - Development server port
- `REACT_APP_API_URL` - Backend API URL
- `REACT_APP_ENABLE_OFFLINE=true` - Enable offline features

### Python Services
- `ML_SERVICE_PORT=8000` - ML service port
- `ML_INFERENCE_PORT=8001` - Inference service port
- `AI_COORDINATION_PORT=8002` - Coordination hub port
- `PYTHON_TRAINER_PORT=8003` - Training service port

## Troubleshooting

### Port Already in Use
```bash
# Check what's using a port
lsof -i :3000

# Kill process on port
lsof -ti :3000 | xargs kill -9
```

### Service Won't Start
1. Check logs in `logs/` directory
2. Ensure all dependencies are installed
3. Verify environment variables
4. Check port availability

### Offline Mode Not Working
1. Ensure HTTPS in production (required for Service Workers)
2. Clear browser cache and re-register service worker
3. Check IndexedDB storage quota
4. Verify WebAssembly file is accessible

## Performance Optimization

### Frontend
- Service Worker caches static assets
- WebAssembly for compute-intensive AI
- React.lazy() for code splitting
- Optimized bundle size

### Backend
- Worker threads for parallel processing
- Connection pooling for database
- WebSocket compression
- Request batching

### AI Services
- Model quantization for smaller size
- ONNX optimization for inference
- GPU acceleration when available
- Intelligent caching strategies