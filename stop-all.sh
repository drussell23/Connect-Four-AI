#!/bin/bash

# =====================================================
# 🛑 CONNECT FOUR - STOP ALL SERVICES
# =====================================================
# This script stops all services for the Connect Four game
# Usage: ./stop-all.sh or npm run stop:all

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}🛑 Stopping Connect Four Game Services...${NC}"

# Function to stop a service
stop_service() {
    local name=$1
    local pid_file="logs/${name}.pid"
    
    if [ -f "$pid_file" ]; then
        local pid=$(cat "$pid_file")
        if kill -0 "$pid" 2>/dev/null; then
            echo -e "${YELLOW}⏹️  Stopping $name (PID: $pid)...${NC}"
            kill "$pid"
            rm -f "$pid_file"
            echo -e "${GREEN}✅ $name stopped${NC}"
        else
            echo -e "${YELLOW}⚠️  $name was not running (stale PID file)${NC}"
            rm -f "$pid_file"
        fi
    else
        echo -e "${YELLOW}⚠️  No PID file found for $name${NC}"
    fi
}

# Stop services using PID files
echo -e "${BLUE}📋 Stopping services gracefully...${NC}"
stop_service "ai_coordination"
stop_service "ml_inference"
stop_service "ml_service"
stop_service "frontend"
stop_service "backend"

# Additional cleanup for any orphaned processes
echo -e "${YELLOW}🔧 Cleaning up any remaining processes...${NC}"

# Kill processes by pattern (as fallback)
pkill -f "node.*backend.*3001" 2>/dev/null || true
pkill -f "react-scripts.*3000" 2>/dev/null || true
pkill -f "python.*ml_service" 2>/dev/null || true
pkill -f "python.*enhanced_inference" 2>/dev/null || true
pkill -f "python.*ai_coordination_hub" 2>/dev/null || true

# Clean up port usage if needed
for port in 3000 3001 8000 8001 8002; do
    if lsof -i :$port | grep -q LISTEN; then
        echo -e "${YELLOW}🔓 Releasing port $port...${NC}"
        lsof -ti :$port | xargs kill -9 2>/dev/null || true
    fi
done

# Clean up PID files
rm -f logs/*.pid

echo ""
echo -e "${GREEN}✅ All services stopped!${NC}"
echo ""
echo -e "${BLUE}💡 To start services again, run:${NC} npm run start:all" 