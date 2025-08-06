#!/bin/bash

# =====================================================
# 🚀 CONNECT FOUR - START ALL SERVICES WITH SELF-HEALING
# =====================================================
# This script starts all services with dependency checks and self-healing
# Usage: ./start-all.sh or npm run start:all

set -e  # Exit on error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

echo -e "${BLUE}🚀 Starting Connect Four Game Services with Self-Healing...${NC}"
echo -e "${BLUE}=======================================================${NC}"

# Check if we're in the right directory
if [ ! -f "package.json" ]; then
    echo -e "${RED}❌ Error: Must run from project root directory${NC}"
    exit 1
fi

# Function to check dependencies
check_dependencies() {
    echo -e "${CYAN}🏥 Running dependency health check...${NC}"
    
    # Check if backend node_modules exists
    if [ ! -d "backend/node_modules" ]; then
        echo -e "${YELLOW}⚠️  Backend dependencies missing${NC}"
        return 1
    fi
    
    # Check if frontend node_modules exists
    if [ ! -d "frontend/node_modules" ]; then
        echo -e "${YELLOW}⚠️  Frontend dependencies missing${NC}"
        return 1
    fi
    
    # Run health check
    if command -v node >/dev/null 2>&1; then
        node scripts/check-dependencies.js 2>/dev/null || return 1
    fi
    
    return 0
}

# Function to fix dependencies
fix_dependencies() {
    echo -e "${YELLOW}🔧 Attempting to fix dependencies...${NC}"
    
    if [ -f "scripts/self-healing-installer.sh" ]; then
        ./scripts/self-healing-installer.sh
    else
        # Fallback to basic install
        echo -e "${YELLOW}📦 Installing backend dependencies...${NC}"
        (cd backend && npm install --legacy-peer-deps) || true
        
        echo -e "${YELLOW}📦 Installing frontend dependencies...${NC}"
        (cd frontend && npm install --legacy-peer-deps) || true
    fi
}

# Check and fix dependencies before starting
if ! check_dependencies; then
    echo -e "${YELLOW}⚠️  Dependency issues detected${NC}"
    fix_dependencies
    
    # Re-check after fixing
    if ! check_dependencies; then
        echo -e "${YELLOW}⚠️  Some dependencies could not be fixed, but continuing...${NC}"
    fi
fi

# Check if backend build exists
if [ ! -f "backend/dist/main.js" ]; then
    echo -e "${YELLOW}⚠️  Backend build missing - building now...${NC}"
    (cd backend && npm run build) || {
        echo -e "${RED}❌ Failed to build backend${NC}"
        exit 1
    }
    echo -e "${GREEN}✅ Backend build completed${NC}"
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

# Function to wait for service with retry
wait_for_service() {
    local port=$1
    local name=$2
    local max_retries=${3:-20}
    local retry_delay=${4:-3}
    
    for i in $(seq 1 $max_retries); do
        if lsof -i :$port | grep -q LISTEN 2>/dev/null; then
            echo -e "${GREEN}✅ $name is running on port $port${NC}"
            return 0
        elif [ $i -lt $max_retries ]; then
            echo -e "${YELLOW}   Waiting for $name (attempt $i/$max_retries)...${NC}"
            # Show service status from logs
            if [ -f "logs/${name}.log" ]; then
                LAST_LOG=$(tail -1 "logs/${name}.log" 2>/dev/null | head -c 100)
                if [ ! -z "$LAST_LOG" ]; then
                    echo -e "${CYAN}   Status: ${LAST_LOG}...${NC}"
                fi
            fi
            sleep $retry_delay
        fi
    done
    
    echo -e "${RED}❌ $name failed to start on port $port${NC}"
    return 1
}

# Create logs directory if it doesn't exist
mkdir -p logs

# Clear old PID files
rm -f logs/*.pid

# Build backend if dist doesn't exist
if [ ! -d "backend/dist" ]; then
    echo -e "${YELLOW}📦 Building backend...${NC}"
    (cd backend && npm run build) || {
        echo -e "${RED}❌ Backend build failed${NC}"
        echo -e "${YELLOW}💡 Try running: npm run fix:dependencies${NC}"
        exit 1
    }
fi

# Start all services with proper environment variables
echo -e "${BLUE}📦 Starting Backend Service...${NC}"
start_service "backend" "backend" "PORT=3000 BACKEND_PORT=3000 ENABLE_CONTINUOUS_LEARNING=true ENABLE_PATTERN_DEFENSE=true ENABLE_DIFFICULTY_AWARE_LEARNING=true ENABLE_SERVICE_INTEGRATION=true SIMULATION_WORKERS=2 INTEGRATION_PORT=8888 npm run start:prod"

echo -e "${BLUE}⚛️  Starting Frontend Service...${NC}"
start_service "frontend" "frontend" "PORT=3001 REACT_APP_API_URL=http://localhost:3000/api npm start"

echo -e "${BLUE}🤖 Starting ML Service with Continuous Learning...${NC}"
start_service "ml_service" "ml_service" "PORT=8000 ML_WEBSOCKET_PORT=8002 ENABLE_LEARNING_MONITOR=true ENABLE_DIFFICULTY_AWARE_LEARNING=true DIFFICULTY_MODELS_COUNT=10 python3 start_with_continuous_learning.py"

echo -e "${BLUE}🧠 Starting ML Inference Service...${NC}"
start_service "ml_inference" "ml_service" "ML_INFERENCE_PORT=8001 python3 enhanced_inference.py"

echo -e "${BLUE}🔗 Starting AI Coordination Hub...${NC}"
start_service "ai_coordination" "ml_service" "AI_COORDINATION_PORT=8003 python3 ai_coordination_hub.py"

echo -e "${BLUE}🎓 Starting Python Trainer Service (Minimal)...${NC}"
start_service "python_trainer" "backend/src/ai/hybrid-architecture/python-trainer" "PORT=8004 python3 training_service_minimal.py"

echo -e "${BLUE}📚 Starting Continuous Learning Service...${NC}"
start_service "continuous_learning" "ml_service" "CONTINUOUS_LEARNING_PORT=8005 python3 continuous_learning.py"

echo -e "${BLUE}🌐 Starting Integration WebSocket Gateway...${NC}"
echo "   Integration WebSocket will start on port 8888 with backend service"

# Wait and check services
echo -e "${YELLOW}⏳ Waiting for services to start...${NC}"
sleep 3

echo ""
echo -e "${BLUE}🔍 Checking service status...${NC}"

# Check each service with appropriate timeouts
ALL_OK=true

# Backend needs more time due to ML model initialization
if ! wait_for_service 3000 "backend" 30 5; then
    ALL_OK=false
    echo -e "${YELLOW}💡 Backend startup issue. Check logs/backend.log${NC}"
fi

if ! wait_for_service 3001 "frontend" 20 3; then
    ALL_OK=false
    echo -e "${YELLOW}💡 Frontend startup issue. Check logs/frontend.log${NC}"
fi

if ! wait_for_service 8000 "ml_service" 15 3; then
    ALL_OK=false
    echo -e "${YELLOW}💡 ML Service startup issue. Check logs/ml_service.log${NC}"
fi

# Check additional services
wait_for_service 8001 "ml_inference" 10 2
wait_for_service 8002 "continuous_learning_ws" 10 2
wait_for_service 8003 "ai_coordination" 10 2
wait_for_service 8004 "python_trainer" 10 2
wait_for_service 8005 "continuous_learning" 10 2
wait_for_service 8888 "integration_ws" 15 3

echo ""
if [ "$ALL_OK" = true ]; then
    echo -e "${GREEN}✅ Core services are running successfully!${NC}"
else
    echo -e "${YELLOW}⚠️  Some services had issues starting${NC}"
    echo -e "${YELLOW}💡 Run 'npm run health:check' for diagnostics${NC}"
fi

echo ""
echo -e "${BLUE}📋 Service URLs:${NC}"
echo "   - Frontend: http://localhost:3001"
echo "   - Backend API: http://localhost:3000/api"
echo "   - Backend Health: http://localhost:3000/api/health"
echo "   - ML Service: http://localhost:8000"
echo "   - ML Inference: http://localhost:8001"
echo "   - AI Coordination: http://localhost:8003"

echo ""
echo -e "${GREEN}🎯 Available Commands:${NC}"
echo "   - ${CYAN}npm run stop:all${NC} - Stop all services"
echo "   - ${CYAN}npm run restart:all${NC} - Restart all services"
echo "   - ${CYAN}npm run health:check${NC} - Check system health"
echo "   - ${CYAN}npm run fix:dependencies${NC} - Fix dependency issues"

echo ""
echo -e "${YELLOW}📁 Logs available in:${NC}"
echo "   - logs/*.log files"

# Run post-startup health check
echo ""
echo -e "${CYAN}🏥 Running post-startup health check...${NC}"
sleep 2
node scripts/check-dependencies.js 2>/dev/null || {
    echo -e "${YELLOW}💡 Some services may not be fully initialized yet${NC}"
}