#!/bin/bash

# =====================================================
# 🔄 CONNECT FOUR - RESTART ALL SERVICES WITH HEALTH CHECKS
# =====================================================
# This script restarts all services with health checks
# Usage: ./restart-all.sh [options]
# Options:
#   --fast-mode     Skip ML initialization for faster startup
#   --debug         Enable verbose debugging output
#   --no-health     Skip post-startup health checks
#   --memory-opt    Use memory-optimized settings
#   --dev           Development mode with hot reload

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
MAGENTA='\033[0;35m'
NC='\033[0m' # No Color

# Detect M1 Mac and auto-enable optimization
IS_M1_MAC=false
START_FLAGS=""
if [[ "$(uname -m)" == "arm64" ]] && [[ "$OSTYPE" == "darwin"* ]]; then
    IS_M1_MAC=true
    echo -e "${CYAN}🍎 M1 Mac detected - Auto-enabling optimizations${NC}"
    # Pass M1 optimization flags to start script
    START_FLAGS="--m1-opt --memory-opt"
fi

echo -e "${MAGENTA}🔄 Restarting Connect Four Game Services...${NC}"
echo -e "${MAGENTA}=========================================${NC}"

# Pre-restart health check
echo -e "${CYAN}🏥 Pre-restart health check...${NC}"
if [ -f "scripts/check-dependencies.js" ]; then
    node scripts/check-dependencies.js 2>/dev/null || {
        echo -e "${YELLOW}⚠️  Some issues detected before restart${NC}"
    }
fi

# Stop all services
echo ""
echo -e "${BLUE}Phase 1: Stopping all services...${NC}"
./stop-all.sh

# Wait for services to fully stop
echo ""
echo -e "${YELLOW}⏳ Waiting for services to fully stop...${NC}"
sleep 3

# Check if any services are still running
PORTS_CLEAR=true
for port in 3000 3001 8000 8001 8002 8003 8004 8005 8888; do
    if lsof -i :$port | grep -q LISTEN 2>/dev/null; then
        echo -e "${RED}❌ Port $port is still occupied${NC}"
        PORTS_CLEAR=false
    fi
done

if [ "$PORTS_CLEAR" = false ]; then
    echo -e "${YELLOW}🔧 Forcing cleanup of remaining processes...${NC}"
    npm run emergency 2>/dev/null || true
    sleep 2
fi

# Clear logs for fresh start (optional)
echo -e "${CYAN}📄 Rotating logs...${NC}"
if [ -d "logs" ]; then
    # Archive old logs with timestamp
    TIMESTAMP=$(date +%Y%m%d_%H%M%S)
    mkdir -p "logs/archive"
    
    for logfile in logs/*.log; do
        if [ -f "$logfile" ]; then
            filename=$(basename "$logfile" .log)
            mv "$logfile" "logs/archive/${filename}_${TIMESTAMP}.log" 2>/dev/null || true
        fi
    done
    echo -e "${GREEN}   ✅ Logs archived${NC}"
fi

# Check and fix dependencies if needed
echo ""
echo -e "${BLUE}Phase 2: Checking dependencies...${NC}"
if [ -f "scripts/self-healing-installer.sh" ]; then
    # Quick dependency check
    DEPS_OK=true
    
    if [ ! -d "backend/node_modules" ]; then
        echo -e "${YELLOW}⚠️  Backend dependencies missing${NC}"
        DEPS_OK=false
    fi
    
    if [ ! -d "frontend/node_modules" ]; then
        echo -e "${YELLOW}⚠️  Frontend dependencies missing${NC}"
        DEPS_OK=false
    fi
    
    if [ ! -f "backend/dist/main.js" ]; then
        echo -e "${YELLOW}⚠️  Backend build missing - building now...${NC}"
        cd backend && npm run build && cd ..
        echo -e "${GREEN}✅ Backend build completed${NC}"
    fi
    
    if [ "$DEPS_OK" = false ]; then
        echo -e "${YELLOW}🔧 Running self-healing installer...${NC}"
        ./scripts/self-healing-installer.sh
    else
        echo -e "${GREEN}✅ Dependencies look good${NC}"
    fi
fi

# Start all services
echo ""
echo -e "${BLUE}Phase 3: Starting all services...${NC}"

# Pass through all command line arguments to start-all.sh
# Include auto-detected M1 optimization flags
./start-all.sh $START_FLAGS "$@"

# Post-restart verification
echo ""
echo -e "${BLUE}Phase 4: Post-restart verification...${NC}"
sleep 5

# Final health check
echo -e "${CYAN}🏥 Running final health check...${NC}"
HEALTH_STATUS=0

# Check critical services
echo -e "${CYAN}🔍 Checking backend health...${NC}"
if ! curl -s http://localhost:3000/api/health >/dev/null 2>&1; then
    echo -e "${RED}❌ Backend health check failed (check logs/backend.log)${NC}"
    HEALTH_STATUS=1
else
    echo -e "${GREEN}✅ Backend is healthy${NC}"
fi

echo -e "${CYAN}🔍 Checking frontend...${NC}"
if ! curl -s http://localhost:3001 >/dev/null 2>&1; then
    echo -e "${RED}❌ Frontend health check failed (check logs/frontend.log)${NC}"
    HEALTH_STATUS=1
else
    echo -e "${GREEN}✅ Frontend is healthy${NC}"
fi

echo -e "${CYAN}🔍 Checking ML service...${NC}"
if ! curl -s http://localhost:8000/health >/dev/null 2>&1; then
    echo -e "${YELLOW}⚠️  ML Service health check failed (may still be initializing - check logs/ml_service.log)${NC}"
else
    echo -e "${GREEN}✅ ML Service is healthy${NC}"
fi

# Summary
echo ""
echo -e "${MAGENTA}=======================================${NC}"
if [ $HEALTH_STATUS -eq 0 ]; then
    echo -e "${GREEN}✅ Restart completed successfully!${NC}"
    echo ""
    echo -e "${GREEN}🎮 Game available at: http://localhost:3001${NC}"
    echo -e "${GREEN}📊 Backend API at: http://localhost:3000/api${NC}"
else
    echo -e "${YELLOW}⚠️  Restart completed with warnings${NC}"
    echo -e "${YELLOW}💡 Check logs in the logs/ directory for details${NC}"
    echo -e "${YELLOW}💡 Run 'npm run health:check' for diagnostics${NC}"
fi

echo ""
echo -e "${CYAN}📋 Quick Commands:${NC}"
echo "   - ${CYAN}npm run health:check${NC} - Check system health"
echo "   - ${CYAN}npm run status${NC} - View service status"
echo "   - ${CYAN}npm run stop:all${NC} - Stop all services"
echo "   - ${CYAN}npm run fix:dependencies${NC} - Fix dependency issues"
# Show M1 tip if on M1 but not using M1 optimizations
if [ "$IS_M1_MAC" = true ] && [[ "$@" != *"--m1-opt"* ]]; then
    echo ""
    echo -e "${YELLOW}💡 Tip: To enable M1 optimizations, use:${NC}"
    echo -e "   ${CYAN}npm run restart:m1${NC} or ${CYAN}./restart-all.sh --m1-opt${NC}"
fi