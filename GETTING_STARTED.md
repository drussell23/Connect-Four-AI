# Connect Four Game - Quick Start Guide

A sophisticated Connect Four game with advanced AI featuring 25 progressive difficulty levels, real-time gameplay, and machine learning-powered opponents.

## Prerequisites

Before running the application, ensure you have the following installed:

### Required Software
- **Node.js** (version 18.0.0 or higher) - [Download here](https://nodejs.org/)
- **Python** (version 3.9 or higher) - [Download here](https://python.org/)
- **Git** - [Download here](https://git-scm.com/)

### System Requirements
- **RAM**: 8GB minimum (16GB recommended)
- **Storage**: 5GB free space
- **OS**: Windows 10+, macOS 10.15+, or Linux

## Installation

1. **Clone the repository:**
   ```bash
   git clone https://github.com/your-username/ConnectFourGame.git
   cd ConnectFourGame
   ```

2. **Install dependencies:**
   ```bash
   npm install
   ```

3. **Set up Python environment:**
   ```bash
   cd ml_service
   pip install -r requirements.txt
   cd ..
   ```

## Running the Application

### Option 1: Single Command (Recommended)
Run everything with one command:
```bash
npm start
```

This will automatically:
- ✅ Check for port conflicts and resolve them
- ✅ Install any missing dependencies
- ✅ Start the backend server (port 3000)
- ✅ Build and serve the frontend (port 3000)
- ✅ Launch the ML service (port 8000)
- ✅ Perform health checks

### Option 2: Manual Service Management
If you prefer to run services individually:

**Start the ML Service:**
```bash
cd ml_service
uvicorn ml_service:app --reload --host 0.0.0.0 --port 8000
```

**Start the Backend (serves both API and frontend):**
```bash
cd backend
npm install
npm run start:dev
```

## Alternative Single-Command Options

The project includes several convenient npm scripts:

```bash
# Basic startup (same as npm start)
npm run dev

# Force cleanup conflicted ports and start
npm run start:force

# Start with log following
npm run dev:logs

# Start only backend
npm run start:backend

# Production mode
npm run start:production
```

## Accessing the Game

Once all services are running:

- **🎮 Play the Game**: http://localhost:3000
- **🔧 Backend API**: http://localhost:3000/api
- **🧠 ML Service**: http://localhost:8000
- **📊 API Documentation**: http://localhost:3000/api

## Service Management

### Check Service Status
```bash
npm run status
```

### Stop All Services
```bash
npm run stop
```

### Force Stop (if services are stuck)
```bash
npm run stop:force
```

### Restart Services
```bash
npm run restart
```

## Troubleshooting

### Common Issues

**Port Already in Use:**
```bash
# Check what's using the ports
npm run scan

# Force cleanup and restart
npm run start:force
```

**Services Won't Start:**
```bash
# Check logs
tail -f logs/*.log

# Emergency cleanup
npm run emergency
```

**Dependencies Issues:**
```bash
# Clean install
rm -rf node_modules package-lock.json
npm install

# For Python dependencies
cd ml_service
pip install -r requirements.txt --force-reinstall
```

**Can't Connect to AI:**
Make sure both services are running:
- Backend + Frontend (port 3000) ✅
- ML Service (port 8000) ✅

### Getting Help

- **View all available commands**: `npm run`
- **Service status**: `npm run status`
- **Port management**: `npm run scan`
- **Logs location**: `./logs/` directory

## Game Features

### 🎯 Progressive AI System
- **25 Difficulty Levels**: From beginner-friendly to unbeatable
- **5 AI Personalities**: Genesis, Prometheus, Athena, Nemesis, and more
- **Real-time Adaptation**: AI learns and adapts to your playing style

### 🎮 Enhanced Gameplay
- **Spectacular Animations**: Physics-based disc dropping with visual effects
- **Victory Celebrations**: Fireworks, sound effects, and level progression
- **Statistics Tracking**: Win/loss ratios, streaks, and performance metrics
- **Responsive Design**: Works on desktop, tablet, and mobile

### 🧠 Advanced AI Features
- **Machine Learning Models**: Neural networks trained on millions of games
- **Multiple Algorithms**: Minimax, MCTS, Deep Q-Learning, and more
- **Continuous Learning**: AI improves through self-play and human games
- **Difficulty Scaling**: Gradual increase in challenge as you improve

## Next Steps

1. **Start Playing**: Visit http://localhost:3000 and choose your difficulty
2. **Challenge Yourself**: Work your way up through the 25 AI levels
3. **Explore Features**: Try different AI personalities and game modes
4. **Track Progress**: Monitor your statistics and improvement over time

## Advanced Configuration

For advanced users who want to customize the experience:

- **Environment Variables**: Copy `.env.example` to `.env` and modify settings
- **AI Training**: Use `npm run train` to retrain AI models
- **Custom Models**: Place custom models in the `models/` directory
- **Database Setup**: Configure PostgreSQL for persistent game storage

---

**Ready to play?** Run `npm start` and visit http://localhost:3000 to begin your Connect Four journey! 