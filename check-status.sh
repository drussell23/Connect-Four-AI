#!/bin/bash

# =====================================================
# 📊 CONNECT FOUR - SERVICE STATUS CHECK
# =====================================================
# Quick status check for all services
# Usage: ./check-status.sh or npm run status

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
MAGENTA='\033[0;35m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

echo -e "${BLUE}📊 Connect Four Service Status${NC}"
echo -e "${MAGENTA}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""

# Function to check if service is running
check_service() {
    local port=$1
    local name=$2
    if lsof -i :$port | grep -q LISTEN; then
        echo -e "${GREEN}✅ $name${NC} - Running on port $port"
        return 0
    else
        echo -e "${RED}❌ $name${NC} - Not running"
        return 1
    fi
}

# Check all services
echo -e "${CYAN}Core Services:${NC}"
check_service 3000 "Backend API          "
check_service 3001 "Frontend             "
check_service 8000 "ML Service           "

echo ""
echo -e "${CYAN}AI Services:${NC}"
check_service 8001 "ML Inference         "
check_service 8002 "Continuous Learning  "
check_service 8003 "AI Coordination      "
check_service 8004 "Python Trainer       "
check_service 8888 "Integration WebSocket"

# Check background simulations
echo ""
echo -e "${CYAN}Background Activity:${NC}"
if [ -f "logs/backend.log" ]; then
    SIMULATION_COUNT=$(grep -c "Simulation.*completed" logs/backend.log 2>/dev/null || echo "0")
    PATTERN_COUNT=$(grep -c "pattern.*detected" logs/backend.log 2>/dev/null || echo "0")
    MODEL_UPDATES=$(grep -c "model.*updated" logs/backend.log 2>/dev/null || echo "0")
    
    echo -e "${BLUE}🎮 Simulations completed:${NC} $SIMULATION_COUNT"
    echo -e "${BLUE}🔍 Patterns detected:${NC} $PATTERN_COUNT"
    echo -e "${BLUE}🔄 Model updates:${NC} $MODEL_UPDATES"
else
    echo -e "${YELLOW}⚠️  No backend log found${NC}"
fi

# Check memory usage
echo ""
echo -e "${CYAN}System Resources:${NC}"
TOTAL_MEM=$(ps aux | grep -E "(node|python)" | grep -v grep | awk '{sum += $6} END {print sum/1024}')
echo -e "${BLUE}💾 Total memory usage:${NC} ${TOTAL_MEM} MB"

# Integration health
echo ""
echo -e "${CYAN}Integration Health:${NC}"
if curl -s -f "http://localhost:8000/health" > /dev/null 2>&1; then
    echo -e "${GREEN}✅ ML Service API${NC} - Responding"
else
    echo -e "${RED}❌ ML Service API${NC} - Not responding"
fi

if curl -s -f "http://localhost:3000/health" > /dev/null 2>&1; then
    echo -e "${GREEN}✅ Backend API${NC} - Responding"
else
    echo -e "${RED}❌ Backend API${NC} - Not responding"
fi

echo ""
echo -e "${MAGENTA}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""
echo -e "${BLUE}Quick Commands:${NC}"
echo "  • Start all: ${YELLOW}npm run start:all${NC}"
echo "  • Stop all: ${YELLOW}npm run stop:all${NC}"
echo "  • Restart: ${YELLOW}npm run restart:integrated${NC}"
echo "  • Test: ${YELLOW}npm run test:integration${NC}"
echo "  • Logs: ${YELLOW}tail -f logs/*.log${NC}"