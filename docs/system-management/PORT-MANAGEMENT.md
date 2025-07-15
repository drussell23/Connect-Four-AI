# 🚀 Advanced Port Management System

The Connect Four Game project includes a sophisticated port management system to handle development server conflicts and streamline the development workflow.

## 🎯 Quick Start

```bash
# Start all services with smart defaults
npm start
# or
./smart-start.sh

# Start with automatic port cleanup
npm run start:force

# Check what's running on your ports
npm run status

# Stop all services
npm run stop
```

## 📦 What's Included

### 🔧 **Port Manager** (`port-manager.sh`)
Advanced port conflict resolution and service management tool.

### 🎮 **Smart Start** (`smart-start.sh`) 
Intelligent project launcher that handles dependencies, port conflicts, and service startup.

### ⚡ **Legacy Support**
Legacy npm scripts are available for backward compatibility if needed.

## 🛠️ Available Commands

### **Starting Services**
| Command | Description |
|---------|-------------|
| `npm start` | Start all services with smart defaults |
| `npm run start:force` | Force cleanup conflicts and start |
| `npm run start:backend` | Start only backend service |
| `npm run start:frontend` | Start only frontend service |
| `npm run start:production` | Start in production mode |
| `npm run start:follow` | Start and follow logs |

### **Managing Services**
| Command | Description |
|---------|-------------|
| `npm run stop` | Stop all services gracefully |
| `npm run stop:force` | Force stop all services |
| `npm run restart` | Restart all services |
| `npm run status` | Show service status |
| `npm run scan` | Scan port usage |

### **Development Workflow**
| Command | Description |
|---------|-------------|
| `npm run dev` | Start development servers |
| `npm run dev:clean` | Clean start with force cleanup |
| `npm run dev:logs` | Start and follow logs |

### **Emergency Tools**
| Command | Description |
|---------|-------------|
| `npm run emergency` | Interactive emergency cleanup |
| `npm run kill-port <port>` | Kill specific port |

## 🔍 Detailed Usage

### **Port Manager Commands**

```bash
# Scan all development ports
./port-manager.sh scan

# Scan specific ports
./port-manager.sh scan 3000 3001 8000

# Kill process on specific port
./port-manager.sh kill 3000

# Clean up all development ports
./port-manager.sh cleanup

# Force cleanup (no prompts)
./port-manager.sh cleanup-force

# Start specific service
./port-manager.sh start backend

# Restart all services
./port-manager.sh restart

# Emergency cleanup (interactive)
./port-manager.sh emergency

# Find next available port
./port-manager.sh next-port 3000
```

### **Smart Start Options**

```bash
# Basic usage
./smart-start.sh

# Skip automatic cleanup
./smart-start.sh --no-cleanup

# Force cleanup without prompting
./smart-start.sh --force-cleanup

# Start only backend
./smart-start.sh --backend-only

# Start only frontend
./smart-start.sh --frontend-only

# Production mode
./smart-start.sh --production

# Follow logs after startup
./smart-start.sh --follow-logs
```

## 🎛️ Configuration

### **Default Ports**
- **Backend API**: 3000
- **Frontend**: 3001
- **ML Service**: 8000
- **ML Inference**: 8001

### **Environment Variables**
```bash
export AUTO_CLEANUP=true        # Auto cleanup on start
export FORCE_CLEANUP=false     # Force cleanup without prompts
export START_FRONTEND=true     # Enable frontend startup
export START_BACKEND=true      # Enable backend startup
export DEVELOPMENT_MODE=true   # Development vs production mode
```

### **Configuration File**
The system creates `.port-config` to store your preferences:
```bash
./port-manager.sh config  # Save current configuration
```

## 📊 Port Scanning

The port scanner shows detailed information about what's running:

```
Port Scan Results:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
PORT     STATUS     PID             PROCESS              DETAILS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
3000     IN USE     12345           node                 Backend API
3001     FREE       -               -                    -
3002     IN USE     67890           npm                  Some other service
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

## 🛡️ Safety Features

### **Process Protection**
- Never kills system processes (systemd, init, ssh)
- Confirmation prompts for unknown processes
- Graceful termination before force killing

### **Service Detection**
- Identifies development vs production services
- Shows process details before termination
- Tracks service dependencies

### **Error Handling**
- Comprehensive error logging
- Fallback mechanisms
- Recovery suggestions

## 📁 File Structure

```
ConnectFourGame/
├── port-manager.sh       # Advanced port management
├── smart-start.sh        # Intelligent project launcher
├── logs/                 # Service logs
│   ├── backend.log
│   ├── frontend.log
│   ├── backend.pid
│   └── frontend.pid
├── .port-config          # Port configuration
└── port-manager.log      # Management logs
```

## 🚨 Common Issues & Solutions

### **Port Already in Use**
```bash
# Quick fix
npm run stop && npm start

# Force fix
npm run start:force

# Emergency fix
npm run emergency
```

### **Services Won't Start**
```bash
# Check what's running
npm run status

# Check logs
tail -f logs/*.log

# Clean restart
npm run restart
```

### **Permission Issues**
```bash
# Make scripts executable
chmod +x *.sh

# Check script permissions
ls -la *.sh
```

### **Multiple Node Processes**
```bash
# Use emergency cleanup
npm run emergency

# Or manually clean
pkill -f "node.*start:dev"
```

## 🎉 Success Indicators

When everything is working correctly, you'll see:

```
🚀 Connect Four Game Services Started! 🚀
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  Backend API:      http://localhost:3000
  API Docs:         http://localhost:3000/api
  Frontend App:     http://localhost:3001
  Game Interface:   http://localhost:3001

  Logs Directory:   ./logs/
  Stop Services:    ./port-manager.sh cleanup
  Service Status:   ./port-manager.sh status
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Ready to play Connect Four! Open http://localhost:3001 in your browser.
```

## 🔄 Migration from Old Scripts

If you were using the old workflow:

**Old Way:**
```bash
cd backend && npm run start:dev
cd frontend && npm start
# Manual port killing when conflicts occurred
```

**New Way:**
```bash
npm start
# That's it! 🎉
```

Your old commands are still available under `legacy:` prefixes if needed.

## 📞 Getting Help

```bash
# Show help for port manager
./port-manager.sh --help

# Show help for smart start
./smart-start.sh --help

# Check system status
npm run status
```

## 🎮 Ready to Play!

Once setup is complete, your Connect Four game with advanced Rival AI system will be running at:
- **Game**: http://localhost:3001
- **API**: http://localhost:3000

Enjoy your enhanced development experience! 🚀 