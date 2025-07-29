#!/bin/bash

# =====================================================
# 🚀 CONNECT FOUR AI - COMPREHENSIVE START ALL SERVICES
# =====================================================
# This script starts ALL services for the Connect Four AI system
# including advanced AI services, monitoring, and coordination
# Usage: ./start-all-comprehensive.sh or npm run start:all:comprehensive

set -e  # Exit on error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
MAGENTA='\033[0;35m'
NC='\033[0m' # No Color

echo -e "${BLUE}🚀 Starting Connect Four AI - Comprehensive Services...${NC}"
echo -e "${CYAN}   Including: Backend, Frontend, ML Service, ML Inference, AI Coordination${NC}"

# Check if we're in the right directory
if [ ! -f "package.json" ]; then
    echo -e "${RED}❌ Error: Must run from project root directory${NC}"
    exit 1
fi

# Function to check if a command exists
command_exists() {
    command -v "$1" >/dev/null 2>&1
}

# Check prerequisites
echo -e "${YELLOW}🔍 Checking prerequisites...${NC}"
MISSING_DEPS=()

if ! command_exists node; then
    MISSING_DEPS+=("Node.js")
fi

if ! command_exists python3; then
    MISSING_DEPS+=("Python 3")
fi

if ! command_exists npm; then
    MISSING_DEPS+=("npm")
fi

if [ ${#MISSING_DEPS[@]} -ne 0 ]; then
    echo -e "${RED}❌ Missing required dependencies: ${MISSING_DEPS[*]}${NC}"
    exit 1
fi

# Clean up existing services
echo -e "${YELLOW}🔧 Cleaning up existing services...${NC}"
npm run stop:all 2>/dev/null || true
sleep 2

# Function to start services in background with proper job control
start_service() {
    local name=$1
    local dir=$2
    local port=$3
    shift 3
    local cmd="$@"
    
    echo -e "${GREEN}🟢 Starting $name on port $port...${NC}"
    
    # Create log directory if it doesn't exist
    mkdir -p "logs/$dir"
    
    # Start the service
    (cd "$dir" && eval "$cmd") > "logs/${name}.log" 2>&1 &
    local pid=$!
    echo "   PID: $pid"
    
    # Store PID for stop script
    echo "$pid" > "logs/${name}.pid"
    
    # Store service info
    echo "$name|$port|$pid|$(date)" >> "logs/services.log"
}

# Create logs directory structure
mkdir -p logs/{backend,frontend,ml_service}

# Clear old files
rm -f logs/*.pid
> logs/services.log

# Set up environment variables
export NODE_ENV=development
export USE_ML_MODEL=true
export ML_SERVICE_URL=http://localhost:8000
export ML_INFERENCE_URL=http://localhost:8001
export AI_COORDINATION_URL=http://localhost:8002

# Start core services
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${BLUE}📦 Starting Core Services...${NC}"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"

# 1. Backend Service (NestJS)
start_service "backend" "backend" 3001 \
    "PORT=3001 BACKEND_PORT=3001 npm run start:dev"

# 2. Frontend Service (React)
start_service "frontend" "frontend" 3000 \
    "PORT=3000 REACT_APP_API_URL=http://localhost:3001 npm start"

echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${MAGENTA}🤖 Starting AI/ML Services...${NC}"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"

# 3. ML Service (Training & Model Management)
start_service "ml_service" "ml_service" 8000 \
    "PORT=8000 python3 ml_service.py"

# 4. ML Inference Service (Fast Predictions)
start_service "ml_inference" "ml_service" 8001 \
    "ML_INFERENCE_PORT=8001 python3 enhanced_inference.py"

# 5. AI Coordination Hub (Multi-Agent Coordination)
start_service "ai_coordination" "ml_service" 8002 \
    "AI_COORDINATION_PORT=8002 python3 ai_coordination_hub.py"

# Wait for services to initialize
echo -e "${YELLOW}⏳ Waiting for services to initialize...${NC}"
echo -e "${CYAN}   Backend needs extra time for TypeScript compilation...${NC}"
sleep 10

# Health check function with retries
check_service_health() {
    local port=$1
    local name=$2
    local endpoint=${3:-""}
    local max_retries=${4:-3}
    local retry_delay=${5:-5}
    
    for i in $(seq 1 $max_retries); do
        if lsof -i :$port | grep -q LISTEN; then
            if [ -n "$endpoint" ]; then
                # Check HTTP endpoint if provided
                if curl -s -f "http://localhost:$port$endpoint" > /dev/null 2>&1; then
                    echo -e "${GREEN}✅ $name is healthy on port $port${NC}"
                    return 0
                else
                    echo -e "${YELLOW}⚠️  $name is running but health check failed${NC}"
                    if [ $i -lt $max_retries ]; then
                        echo -e "${YELLOW}   Retrying in $retry_delay seconds...${NC}"
                        sleep $retry_delay
                        continue
                    fi
                fi
            else
                echo -e "${GREEN}✅ $name is running on port $port${NC}"
                return 0
            fi
        else
            if [ $i -lt $max_retries ]; then
                echo -e "${YELLOW}⚠️  $name not ready yet, retrying in $retry_delay seconds...${NC}"
                sleep $retry_delay
            fi
        fi
    done
    
    echo -e "${RED}❌ $name failed to start on port $port${NC}"
    return 1
}

# Check all services
echo ""
echo -e "${BLUE}🔍 Checking service health...${NC}"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"

SERVICES_OK=true

# Check core services
check_service_health 3001 "Backend" "/api/health" 5 5 || SERVICES_OK=false
check_service_health 3000 "Frontend" "" 3 3 || SERVICES_OK=false

# Check AI/ML services
check_service_health 8000 "ML Service" "/health" 3 5 || SERVICES_OK=false
check_service_health 8001 "ML Inference" "/health" 3 5 || SERVICES_OK=false
check_service_health 8002 "AI Coordination" "/health" 3 5 || SERVICES_OK=false

# Display results
echo ""
if [ "$SERVICES_OK" = true ]; then
    echo -e "${GREEN}✅ All services are running successfully!${NC}"
    echo ""
    echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo -e "${BLUE}📋 Service URLs:${NC}"
    echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo -e "   ${CYAN}Frontend:${NC} http://localhost:3000"
    echo -e "   ${CYAN}Backend API:${NC} http://localhost:3001/api"
    echo -e "   ${CYAN}Backend Health:${NC} http://localhost:3001/api/health"
    echo -e "   ${CYAN}AI Resources:${NC} http://localhost:3001/api/games/ai/resources"
    echo ""
    echo -e "   ${MAGENTA}ML Service:${NC} http://localhost:8000"
    echo -e "   ${MAGENTA}ML Inference:${NC} http://localhost:8001"
    echo -e "   ${MAGENTA}AI Coordination:${NC} http://localhost:8002"
    echo ""
    echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo -e "${YELLOW}📁 Logs available in:${NC}"
    echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo "   - Backend: logs/backend.log"
    echo "   - Frontend: logs/frontend.log"
    echo "   - ML Service: logs/ml_service.log"
    echo "   - ML Inference: logs/ml_inference.log"
    echo "   - AI Coordination: logs/ai_coordination.log"
    echo "   - Service Info: logs/services.log"
    echo ""
    echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo -e "${CYAN}🎮 AI Features Enabled:${NC}"
    echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo "   • Constitutional AI with safety monitoring"
    echo "   • Rainbow DQN with experience replay"
    echo "   • Neural architecture search"
    echo "   • Opponent modeling and adaptation"
    echo "   • Multi-agent debate system"
    echo "   • Resource monitoring and throttling"
    echo "   • Real-time learning from games"
    echo ""
    echo -e "${BLUE}🛑 To stop all services, run:${NC} npm run stop:all:comprehensive"
    
    # Optional: Show real-time logs
    echo ""
    echo -e "${YELLOW}💡 Tip:${NC} To monitor logs in real-time, run:"
    echo "   tail -f logs/*.log"
else
    echo -e "${RED}⚠️  Some services failed to start!${NC}"
    echo ""
    echo -e "${YELLOW}🔍 Troubleshooting tips:${NC}"
    echo "   1. Check if ports are already in use: npm run ports:status"
    echo "   2. Check individual service logs in the logs/ directory"
    echo "   3. Ensure Python dependencies are installed:"
    echo "      cd ml_service && pip install -r requirements.txt"
    echo "   4. Ensure Node dependencies are installed:"
    echo "      npm install && cd backend && npm install && cd ../frontend && npm install"
    echo ""
    echo -e "${RED}🛑 Stopping any partial services...${NC}"
    npm run stop:all 2>/dev/null || true
    exit 1
fi