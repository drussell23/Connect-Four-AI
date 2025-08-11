#!/bin/bash

# =====================================================
# 🛑 CONNECT FOUR - STOP ALL SERVICES WITH CLEANUP
# =====================================================
# This script stops all services and performs cleanup
# Usage: ./stop-all.sh or npm run stop:all

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

echo -e "${RED}🛑 Stopping Connect Four Game Services...${NC}"

# Function to stop service by PID file
stop_service_by_pid() {
    local name=$1
    local pid_file="logs/${name}.pid"
    
    if [ -f "$pid_file" ]; then
        PID=$(cat "$pid_file")
        if kill -0 $PID 2>/dev/null; then
            echo -e "${YELLOW}   Stopping $name (PID: $PID)...${NC}"
            kill $PID 2>/dev/null
            
            # Wait for graceful shutdown
            local count=0
            while kill -0 $PID 2>/dev/null && [ $count -lt 10 ]; do
                sleep 0.5
                count=$((count + 1))
            done
            
            # Force kill if still running
            if kill -0 $PID 2>/dev/null; then
                echo -e "${YELLOW}   Force stopping $name...${NC}"
                kill -9 $PID 2>/dev/null
            fi
            
            echo -e "${GREEN}   ✅ $name stopped${NC}"
        else
            echo -e "${YELLOW}   ⚠️  $name was not running (stale PID file)${NC}"
        fi
        rm -f "$pid_file"
    fi
}

# Function to stop service by port
stop_service_by_port() {
    local port=$1
    local name=$2
    
    # Find process using the port
    PID=$(lsof -ti :$port 2>/dev/null)
    
    if [ ! -z "$PID" ]; then
        echo -e "${YELLOW}   Stopping $name on port $port (PID: $PID)...${NC}"
        kill $PID 2>/dev/null
        
        # Wait for graceful shutdown
        local count=0
        while lsof -i :$port >/dev/null 2>&1 && [ $count -lt 10 ]; do
            sleep 0.5
            count=$((count + 1))
        done
        
        # Force kill if still running
        if lsof -i :$port >/dev/null 2>&1; then
            echo -e "${YELLOW}   Force stopping $name...${NC}"
            kill -9 $PID 2>/dev/null
        fi
        
        echo -e "${GREEN}   ✅ Port $port cleared${NC}"
    fi
}

# Stop services gracefully using PID files first
echo -e "${CYAN}📋 Stopping services gracefully...${NC}"
stop_service_by_pid "performance_monitor"
stop_service_by_pid "python_trainer"
stop_service_by_pid "ai_coordination"
stop_service_by_pid "ml_inference"
stop_service_by_pid "ml_service"
stop_service_by_pid "frontend"
stop_service_by_pid "backend"

# Clean up any remaining processes by port
echo -e "${CYAN}🔧 Cleaning up any remaining processes...${NC}"
stop_service_by_port 3000 "Backend"
stop_service_by_port 3001 "Frontend"
stop_service_by_port 8000 "ML Service"
stop_service_by_port 8001 "ML Inference"
stop_service_by_port 8002 "Continuous Learning WS"
stop_service_by_port 8003 "AI Coordination"
stop_service_by_port 8004 "Python Trainer"
stop_service_by_port 8888 "Integration WebSocket"

# Kill any remaining Node.js and Python processes
echo -e "${CYAN}🧹 Final cleanup...${NC}"

# Kill Node.js processes
pkill -f 'node.*backend' 2>/dev/null && echo -e "${GREEN}   ✅ Killed remaining backend processes${NC}"
pkill -f 'react-scripts' 2>/dev/null && echo -e "${GREEN}   ✅ Killed remaining frontend processes${NC}"
pkill -f 'nest start' 2>/dev/null && echo -e "${GREEN}   ✅ Killed remaining NestJS processes${NC}"

# Kill Python processes
pkill -f 'python.*ml_service' 2>/dev/null && echo -e "${GREEN}   ✅ Killed remaining ML service processes${NC}"
pkill -f 'python.*enhanced_inference' 2>/dev/null && echo -e "${GREEN}   ✅ Killed remaining inference processes${NC}"
pkill -f 'python.*ai_coordination' 2>/dev/null && echo -e "${GREEN}   ✅ Killed remaining coordination processes${NC}"
pkill -f 'python.*continuous_learning' 2>/dev/null && echo -e "${GREEN}   ✅ Killed remaining learning processes${NC}"
pkill -f 'python.*training_service' 2>/dev/null && echo -e "${GREEN}   ✅ Killed remaining training processes${NC}"
pkill -f 'python.*metal_inference' 2>/dev/null && echo -e "${GREEN}   ✅ Killed remaining Metal inference processes${NC}"

# Kill uvicorn processes specifically
pkill -f 'uvicorn' 2>/dev/null && echo -e "${GREEN}   ✅ Killed remaining uvicorn processes${NC}"

# Extra aggressive cleanup for ML service ports
for port in 8000 8001 8002 8003 8004; do
    if lsof -i :$port | grep -q LISTEN 2>/dev/null; then
        echo -e "${YELLOW}   Port $port still in use, performing aggressive cleanup...${NC}"
        lsof -ti:$port | xargs kill -9 2>/dev/null || true
        sleep 0.5
    fi
done

# Clean up PID files
echo -e "${CYAN}🗑️  Cleaning up PID files...${NC}"
rm -f logs/*.pid

# M1-specific memory cleanup
if [[ "$(uname -m)" == "arm64" ]] && [[ "$OSTYPE" == "darwin"* ]]; then
    echo -e "${CYAN}🍎 Running M1-specific memory cleanup...${NC}"
    # Trigger emergency cleanup if available
    curl -X POST http://localhost:3000/api/emergency/cleanup 2>/dev/null || true
    # Force garbage collection by clearing node caches
    npm cache clean --force 2>/dev/null || true
    echo -e "${GREEN}   ✅ M1 memory cleanup completed${NC}"
fi

# Optional: Clean up log files (commented out by default)
# echo -e "${CYAN}📄 Cleaning up log files...${NC}"
# rm -f logs/*.log

# Wait a moment for processes to fully terminate
sleep 1

# Check if all services are stopped
echo ""
echo -e "${CYAN}🔍 Verifying all services are stopped...${NC}"
SERVICES_RUNNING=false

for port in 3000 3001 8000 8001 8002 8003 8004 8888; do
    if lsof -i :$port | grep -q LISTEN 2>/dev/null; then
        echo -e "${RED}   ❌ Port $port is still in use${NC}"
        SERVICES_RUNNING=true
    fi
done

if [ "$SERVICES_RUNNING" = false ]; then
    echo -e "${GREEN}✅ All services stopped successfully!${NC}"
else
    echo -e "${YELLOW}⚠️  Some services may still be running${NC}"
    echo -e "${YELLOW}💡 Try running this script again or use 'npm run emergency'${NC}"
fi

echo ""
echo -e "${BLUE}💡 To start services again, run:${NC} npm run start:all"
echo -e "${BLUE}💡 To check system health, run:${NC} npm run health:check"

# Check if M1 Mac and suggest memory cleanup
if [[ "$(uname -m)" == "arm64" ]] && [[ "$OSTYPE" == "darwin"* ]]; then
    echo -e "${CYAN}🍎 M1 Mac detected${NC}"
fi