#!/bin/bash

# =====================================================
# 🚀 CONNECT FOUR - FAST START (Minimal ML)
# =====================================================
# This script starts services with minimal ML initialization
# for faster development startup

set -e  # Exit on error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}🚀 Starting Connect Four Game Services (Fast Mode)...${NC}"

# Check if we're in the right directory
if [ ! -f "package.json" ]; then
    echo -e "${RED}❌ Error: Must run from project root directory${NC}"
    exit 1
fi

# Clean up existing services
echo -e "${YELLOW}🔧 Cleaning up existing services...${NC}"
npm run stop:simple 2>/dev/null || true
sleep 2

# Function to start services in background with proper job control
start_service() {
    local name=$1
    local dir=$2
    shift 2
    local cmd="$@"
    
    echo -e "${GREEN}🟢 Starting $name...${NC}"
    (cd "$dir" && eval "$cmd") > "logs/${name}.log" 2>&1 &
    local pid=$!
    echo "   PID: $pid"
    
    # Store PID for stop script
    echo "$pid" > "logs/${name}.pid"
}

# Create logs directory if it doesn't exist
mkdir -p logs

# Clear old PID files
rm -f logs/*.pid

# Start all services with FAST_MODE enabled
echo -e "${BLUE}📦 Starting Backend Service (Fast Mode)...${NC}"
start_service "backend" "backend" "PORT=3000 BACKEND_PORT=3000 FAST_MODE=true SKIP_ML_INIT=true npm run start:dev"

echo -e "${BLUE}⚛️  Starting Frontend Service...${NC}"
start_service "frontend" "frontend" "PORT=3001 npm start"

# Skip ML services in fast mode
echo -e "${YELLOW}⚡ Skipping ML services in fast mode${NC}"

# Wait and check services
echo -e "${YELLOW}⏳ Waiting for services to start...${NC}"
sleep 5

# Check if services are running
check_service() {
    local port=$1
    local name=$2
    if lsof -i :$port | grep -q LISTEN; then
        echo -e "${GREEN}✅ $name is running on port $port${NC}"
        return 0
    else
        echo -e "${RED}❌ $name failed to start on port $port${NC}"
        return 1
    fi
}

echo ""
echo -e "${BLUE}🔍 Checking service status...${NC}"

# Check each service
BACKEND_OK=false
FRONTEND_OK=false

# Backend should start quickly in fast mode
for i in {1..3}; do
    if check_service 3000 "Backend"; then
        BACKEND_OK=true
        break
    elif [ $i -lt 3 ]; then
        echo -e "${YELLOW}   Retrying backend check in 3 seconds...${NC}"
        sleep 3
    fi
done

check_service 3001 "Frontend" && FRONTEND_OK=true

echo ""
if [ "$BACKEND_OK" = true ] && [ "$FRONTEND_OK" = true ]; then
    echo -e "${GREEN}✅ Core services are running successfully!${NC}"
    echo ""
    echo -e "${BLUE}📋 Service URLs:${NC}"
    echo "   - Frontend: http://localhost:3001"
    echo "   - Backend API: http://localhost:3000/api"
    echo "   - Backend Health: http://localhost:3000/api/health"
    echo ""
    echo -e "${YELLOW}⚡ Running in FAST MODE:${NC}"
    echo "   - ML services are disabled"
    echo "   - AI will use simple algorithms only"
    echo "   - Perfect for frontend development"
    echo ""
    echo -e "${YELLOW}📁 Logs available in:${NC}"
    echo "   - Backend: logs/backend.log"
    echo "   - Frontend: logs/frontend.log"
    echo ""
    echo -e "${BLUE}🛑 To stop all services, run:${NC} npm run stop:all"
else
    echo -e "${RED}⚠️  Some services failed to start!${NC}"
    echo "Check the logs in the logs/ directory for details"
    exit 1
fi