# Connect Four Game - Quick Start

## Prerequisites
- **Node.js** (18.0.0+) - [Download here](https://nodejs.org/)
- **Python** (3.9+) - [Download here](https://python.org/)

## Installation & Setup

1. **Clone and install:**
   ```bash
   git clone https://github.com/your-username/ConnectFourGame.git
   cd ConnectFourGame
   npm install
   ```

2. **Install Python dependencies:**
   ```bash
   cd ml_service
   pip install -r requirements.txt
   cd ..
   ```

## Running the Game

### ✨ Single Command (Recommended)
```bash
npm start
```

This automatically:
- Resolves port conflicts
- Starts backend (port 3000)
- Starts ML service (port 8000)  
- Builds and serves frontend

### 🎮 Play the Game
Visit: **http://localhost:3000**

## Alternative Commands

```bash
npm run dev          # Same as npm start
npm run start:force  # Force cleanup ports first
npm run stop         # Stop all services
npm run status       # Check service status
```

## Manual Setup (if needed)

**Terminal 1 - ML Service:**
```bash
cd ml_service
uvicorn ml_service:app --reload --host 0.0.0.0 --port 8000
```

**Terminal 2 - Backend + Frontend:**
```bash
cd backend
npm run start:dev
```

## Troubleshooting

**Port conflicts:**
```bash
npm run start:force
```

**Services not working:**
```bash
npm run stop
npm run start
```

**Check logs:**
```bash
tail -f logs/*.log
```

---

**That's it!** Run `npm start` and visit http://localhost:3000 to play! 