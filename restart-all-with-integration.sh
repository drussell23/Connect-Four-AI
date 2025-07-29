#!/bin/bash

# =====================================================
# 🔄 CONNECT FOUR - RESTART ALL WITH INTEGRATION
# =====================================================
# Enhanced restart script that verifies service integration
# Usage: ./restart-all-with-integration.sh or npm run restart:integrated

set -e  # Exit on error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
MAGENTA='\033[0;35m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

echo -e "${BLUE}🔄 Restarting Connect Four with Full Integration...${NC}"
echo ""

# Step 1: Stop all services
echo -e "${CYAN}Step 1/4: Stopping all services...${NC}"
./stop-all.sh
sleep 3

# Step 2: Clear logs for fresh start
echo ""
echo -e "${CYAN}Step 2/4: Clearing old logs...${NC}"
rm -f logs/*.log
echo -e "${GREEN}✅ Logs cleared${NC}"

# Step 3: Start all services
echo ""
echo -e "${CYAN}Step 3/4: Starting all services...${NC}"
./start-all.sh

# Wait for initial startup
echo ""
echo -e "${YELLOW}⏳ Waiting for services to fully initialize...${NC}"
sleep 15

# Step 4: Verify integration
echo ""
echo -e "${CYAN}Step 4/4: Verifying service integration...${NC}"

# Function to check integration endpoint
check_integration() {
    local service=$1
    local port=$2
    local endpoint=$3
    local name=$4
    
    if curl -s -f "http://localhost:${port}${endpoint}" > /dev/null 2>&1; then
        echo -e "${GREEN}✅ $name is integrated${NC}"
        return 0
    else
        echo -e "${RED}❌ $name integration failed${NC}"
        return 1
    fi
}

# Check all integration points
INTEGRATION_OK=true

echo -e "${BLUE}🔍 Checking integration endpoints...${NC}"
check_integration "backend" 3000 "/api/health" "Backend API" || INTEGRATION_OK=false
check_integration "ml_service" 8000 "/health" "ML Service" || INTEGRATION_OK=false
check_integration "ml_service" 8000 "/models" "Model Manager" || INTEGRATION_OK=false
check_integration "ml_inference" 8001 "/health" "ML Inference" || INTEGRATION_OK=false
check_integration "ai_coordination" 8003 "/health" "AI Coordination" || INTEGRATION_OK=false

# Check WebSocket connectivity
echo ""
echo -e "${BLUE}🌐 Checking WebSocket connections...${NC}"

# Check if Integration WebSocket is listening
if lsof -i :8888 | grep -q LISTEN; then
    echo -e "${GREEN}✅ Integration WebSocket is active on port 8888${NC}"
else
    echo -e "${RED}❌ Integration WebSocket is not listening${NC}"
    INTEGRATION_OK=false
fi

# Check if Continuous Learning WebSocket is active
if lsof -i :8002 | grep -q LISTEN; then
    echo -e "${GREEN}✅ Continuous Learning WebSocket is active${NC}"
else
    echo -e "${RED}❌ Continuous Learning WebSocket is not active${NC}"
    INTEGRATION_OK=false
fi

# Check background simulations
echo ""
echo -e "${BLUE}🎮 Checking background simulations...${NC}"
sleep 5  # Give simulations time to start

SIMULATION_COUNT=$(grep -c "Simulation.*completed" logs/backend.log 2>/dev/null || echo "0")
if [ "$SIMULATION_COUNT" -gt "0" ]; then
    echo -e "${GREEN}✅ Background simulations are running ($SIMULATION_COUNT completed)${NC}"
else
    echo -e "${YELLOW}⚠️  Background simulations not yet started (this is normal)${NC}"
fi

# Check model synchronization
echo ""
echo -e "${BLUE}🔄 Checking model synchronization...${NC}"
if curl -s "http://localhost:8000/models/standard/version" 2>/dev/null | grep -q "version"; then
    echo -e "${GREEN}✅ Model sync endpoints are available${NC}"
else
    echo -e "${YELLOW}⚠️  Model sync endpoints not fully ready${NC}"
fi

# Final status
echo ""
echo -e "${MAGENTA}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""

if [ "$INTEGRATION_OK" = true ]; then
    echo -e "${GREEN}✅ All services restarted with full integration!${NC}"
    echo ""
    echo -e "${BLUE}📊 Integration Features Active:${NC}"
    echo "  • Real-time data flow between services"
    echo "  • Background AI vs AI simulations"
    echo "  • Pattern sharing across learning services"
    echo "  • Model synchronization"
    echo "  • Cross-service event bus"
    echo ""
    echo -e "${CYAN}🎯 Quick Commands:${NC}"
    echo "  • Test integration: ${YELLOW}npm run test:integration${NC}"
    echo "  • Check status: ${YELLOW}npm run integration:status${NC}"
    echo "  • View simulations: ${YELLOW}npm run simulations:status${NC}"
    echo "  • Watch logs: ${YELLOW}tail -f logs/*.log${NC}"
    echo ""
    echo -e "${GREEN}🎮 Ready to play at: ${BLUE}http://localhost:3001${NC}"
else
    echo -e "${RED}⚠️  Some integration checks failed!${NC}"
    echo "Services are running but may not be fully integrated."
    echo ""
    echo -e "${YELLOW}Debug commands:${NC}"
    echo "  • Check logs: tail -f logs/*.log"
    echo "  • Test manually: npm run test:integration"
    echo "  • Restart again: npm run restart:integrated"
fi

echo -e "${MAGENTA}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"