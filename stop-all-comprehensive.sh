#!/bin/bash

# =====================================================
# 🛑 CONNECT FOUR AI - COMPREHENSIVE STOP ALL SERVICES
# =====================================================
# This script stops ALL services for the Connect Four AI system
# including advanced AI services, monitoring, and coordination
# Usage: ./stop-all-comprehensive.sh or npm run stop:all:comprehensive

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
MAGENTA='\033[0;35m'
NC='\033[0m' # No Color

echo -e "${BLUE}🛑 Stopping Connect Four AI - Comprehensive Services...${NC}"

# Function to stop a service gracefully
stop_service() {
    local name=$1
    local port=$2
    local pid_file="logs/${name}.pid"
    
    echo -e "${YELLOW}⏹️  Stopping $name (Port: $port)...${NC}"
    
    # Try PID file first
    if [ -f "$pid_file" ]; then
        local pid=$(cat "$pid_file")
        if kill -0 "$pid" 2>/dev/null; then
            # Send SIGTERM for graceful shutdown
            kill -TERM "$pid" 2>/dev/null
            
            # Wait up to 5 seconds for graceful shutdown
            local count=0
            while kill -0 "$pid" 2>/dev/null && [ $count -lt 5 ]; do
                sleep 1
                count=$((count + 1))
            done
            
            # Force kill if still running
            if kill -0 "$pid" 2>/dev/null; then
                echo -e "${YELLOW}   Force stopping $name...${NC}"
                kill -9 "$pid" 2>/dev/null
            fi
            
            rm -f "$pid_file"
            echo -e "${GREEN}✅ $name stopped${NC}"
        else
            echo -e "${YELLOW}⚠️  $name was not running (stale PID file)${NC}"
            rm -f "$pid_file"
        fi
    fi
    
    # Also check port and clean up
    if lsof -i :$port | grep -q LISTEN; then
        echo -e "${YELLOW}🔓 Releasing port $port...${NC}"
        lsof -ti :$port | xargs kill -9 2>/dev/null || true
    fi
}

# Function to kill processes by pattern
kill_by_pattern() {
    local pattern=$1
    local name=$2
    
    local pids=$(pgrep -f "$pattern" 2>/dev/null || true)
    if [ -n "$pids" ]; then
        echo -e "${YELLOW}🔍 Found $name processes: $pids${NC}"
        echo "$pids" | xargs kill -TERM 2>/dev/null || true
        sleep 1
        # Force kill if still running
        echo "$pids" | xargs kill -9 2>/dev/null || true
    fi
}

echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${BLUE}📋 Stopping services gracefully...${NC}"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"

# Stop services in reverse order (dependencies first)
stop_service "ai_coordination" 8002
stop_service "ml_inference" 8001
stop_service "ml_service" 8000
stop_service "frontend" 3000
stop_service "backend" 3001

echo ""
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${YELLOW}🔧 Cleaning up any remaining processes...${NC}"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"

# Kill by process patterns
kill_by_pattern "node.*backend.*3001" "Backend"
kill_by_pattern "react-scripts.*3000" "Frontend"
kill_by_pattern "python.*ml_service" "ML Service"
kill_by_pattern "python.*enhanced_inference" "ML Inference"
kill_by_pattern "python.*ai_coordination_hub" "AI Coordination"

# Additional cleanup for Node processes
kill_by_pattern "node.*nest" "NestJS"
kill_by_pattern "node.*webpack" "Webpack"

# Clean up specific enterprise launcher processes
kill_by_pattern "unified-enterprise-launcher" "Enterprise Launcher"
kill_by_pattern "enterprise-parallel-launcher" "Parallel Launcher"
kill_by_pattern "ai-stability-manager" "AI Stability Manager"
kill_by_pattern "intelligent-resource-manager" "Resource Manager"

echo ""
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${CYAN}🔓 Verifying port cleanup...${NC}"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"

# Ensure all ports are free
PORTS=(3000 3001 8000 8001 8002)
ALL_CLEAR=true

for port in "${PORTS[@]}"; do
    if lsof -i :$port | grep -q LISTEN; then
        echo -e "${RED}❌ Port $port is still in use!${NC}"
        ALL_CLEAR=false
        # Force cleanup
        lsof -ti :$port | xargs kill -9 2>/dev/null || true
    else
        echo -e "${GREEN}✅ Port $port is free${NC}"
    fi
done

# Clean up files
echo ""
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${YELLOW}🧹 Cleaning up temporary files...${NC}"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"

# Clean up PID files
rm -f logs/*.pid

# Mark services as stopped in log
if [ -f "logs/services.log" ]; then
    echo "STOPPED|$(date)" >> "logs/services.log"
fi

# Optional: Clean up Python cache
find . -type d -name "__pycache__" -exec rm -rf {} + 2>/dev/null || true

echo ""
if [ "$ALL_CLEAR" = true ]; then
    echo -e "${GREEN}✅ All services stopped successfully!${NC}"
else
    echo -e "${YELLOW}⚠️  Some services may still be running${NC}"
    echo -e "${YELLOW}   Run 'npm run ports:status' to check${NC}"
fi

echo ""
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${CYAN}💡 Next steps:${NC}"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "   ${GREEN}To start services again:${NC} npm run start:all:comprehensive"
echo -e "   ${YELLOW}To check port status:${NC} npm run ports:status"
echo -e "   ${CYAN}To view logs:${NC} tail -f logs/*.log"