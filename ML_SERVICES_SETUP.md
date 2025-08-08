# 🚀 ML Services Setup Guide

This guide explains how to set up and run all ML services to make those service tiles turn green in the UI.

## 📋 Prerequisites

1. **Python 3.9+** installed
2. **pip** package manager (comes with Python)
3. **Node.js** and npm (already required for the main app)

## 🎯 Quick Start

### Fully Integrated Setup (Recommended)

```bash
# Just run this - it handles EVERYTHING automatically!
npm run start:all

# This single command will:
# 1. Check if Python is installed
# 2. Create virtual environments if needed
# 3. Install all Python dependencies
# 4. Start backend (port 3000)
# 5. Start frontend (port 3001)
# 6. Start all ML services (ports 8000-8004)
# 7. Start Integration WebSocket (port 8888)
```

**That's it!** 

### First Run vs Subsequent Runs

**First run** (takes 2-5 minutes):
```
📦 Creating virtual environment for ml_service...
📦 Installing requirements for ml_service...
📦 Creating virtual environment for python-trainer...
📦 Installing requirements for python-trainer...
✅ ml_service environment ready
✅ python-trainer environment ready
```

**Subsequent runs** (instant):
```
✅ ml_service environment already configured (skipping setup)
✅ python-trainer environment already configured (skipping setup)
```

The system intelligently detects:
- If virtual environments exist
- If dependencies are already installed
- If requirements.txt has changed since last install

This makes startup MUCH faster after the initial setup!

### Manual ML Services Control

```bash
# Start only ML services
npm run ml:start

# Stop only ML services  
npm run ml:stop

# Restart only ML services
npm run ml:restart

# Manual Python setup (usually not needed)
npm run ml:setup
```

### Option 2: Manual Setup

1. **Setup Python Environment**
   ```bash
   cd ml_service
   python3 -m venv venv
   source venv/bin/activate  # On Windows: venv\Scripts\activate
   pip install -r requirements.txt
   ```

2. **Start Services Individually**
   ```bash
   # Terminal 1: ML Service (port 8000)
   cd ml_service
   uvicorn ml_service:app --host 0.0.0.0 --port 8000

   # Terminal 2: ML Inference (port 8001)
   cd ml_service
   uvicorn enhanced_inference:app --host 0.0.0.0 --port 8001

   # Terminal 3: Continuous Learning (port 8002)
   cd backend/src/ai/hybrid-architecture/python-trainer
   uvicorn training_service_minimal:app --host 0.0.0.0 --port 8002

   # Terminal 4: AI Coordination (port 8003)
   cd ml_service
   uvicorn ai_coordination_hub:app --host 0.0.0.0 --port 8003

   # Terminal 5: Python Trainer (port 8004)
   cd backend/src/ai/hybrid-architecture/python-trainer
   uvicorn training_service:app --host 0.0.0.0 --port 8004
   ```

## 🛠️ Available Commands

| Command | Description |
|---------|-------------|
| `npm run ml:setup` | Set up Python virtual environments and install dependencies |
| `npm run ml:start` | Start all ML services |
| `npm run ml:stop` | Stop all ML services |
| `npm run ml:restart` | Restart all ML services |
| `npm run ml:status` | Check ML services status |
| `npm run start:all:ml` | Start everything including ML services |

## 🟢 Making Service Tiles Green

The UI monitors these services on the following ports:

- **ML Service** - Port 8000
- **ML Inference** - Port 8001  
- **Continuous Learning** - Port 8002
- **AI Coordination** - Port 8003
- **Python Trainer** - Port 8004
- **Integration WebSocket** - Port 8888 (provided by backend)

Each service must respond to a `/health` endpoint to show as green.

## 🔧 Troubleshooting

### Python Not Found
```bash
# Install Python 3.9+
# macOS: brew install python@3.9
# Ubuntu: sudo apt-get install python3.9
# Windows: Download from python.org
```

### Port Already in Use
```bash
# Stop specific service
lsof -ti:8000 | xargs kill -9  # Replace 8000 with the port number

# Or stop all ML services
npm run ml:stop
```

### Module Not Found Errors
```bash
# Ensure you're in the virtual environment
cd ml_service
source venv/bin/activate
pip install -r requirements.txt
```

### Services Not Starting
```bash
# Check logs
tail -f logs/ml_service.log
tail -f logs/ml_inference.log
# etc...
```

## 🏗️ Architecture

```
Frontend (3001)
    ↓
Backend API (3000)
    ↓
ML Services:
├── ML Service (8000) - Main ML API
├── ML Inference (8001) - Model inference endpoint
├── Continuous Learning (8002) - Training service
├── AI Coordination (8003) - Multi-agent coordination
├── Python Trainer (8004) - Advanced training service
└── Integration WS (8888) - WebSocket integration
```

## 🚀 Production Deployment

For production, set these environment variables in your frontend build:

```bash
REACT_APP_ML_SERVICE_URL=https://your-ml-service.com
REACT_APP_ML_INFERENCE_URL=https://your-ml-inference.com
REACT_APP_CL_SERVICE_URL=https://your-continuous-learning.com
REACT_APP_AI_COORD_URL=https://your-ai-coordination.com
REACT_APP_TRAINER_URL=https://your-trainer.com
REACT_APP_INTEGRATION_WS_URL=wss://your-websocket.com
```

## 📝 Notes

- The Integration WebSocket (8888) is automatically started by the backend when `ENABLE_SERVICE_INTEGRATION=true`
- ML services are optional - the game works without them but with reduced AI capabilities
- In development, services auto-reload when code changes
- Health checks run every 30 seconds in the UI

## 🔄 Integration with Main App

The `start-all.sh` script now includes ML services automatically unless running with `--fast-mode`. The services are started with proper health checks and logging.

To disable ML services for faster startup:
```bash
npm run start:all:fast
```

## 📊 Monitoring

Once services are running, you can monitor them:

- Health status in UI (green/red tiles)
- Logs in `logs/` directory
- Health endpoints: `http://localhost:<port>/health`
- Metrics: Some services provide `/metrics` endpoints

## 🎯 Summary

1. Run `npm run ml:setup` once to set up Python environment
2. Run `npm run start:all:ml` to start everything
3. All service tiles should turn green in the UI!

For any issues, check the logs in the `logs/` directory or run `npm run ml:status` to diagnose problems.