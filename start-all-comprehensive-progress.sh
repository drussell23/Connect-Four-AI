#!/bin/bash

# =====================================================
# 🚀 CONNECT FOUR AI - COMPREHENSIVE START WITH PROGRESS
# =====================================================
# Enhanced version with progress bar and time estimation

# Source the progress bar utilities
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$SCRIPT_DIR/scripts/progress-bar.sh"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
MAGENTA='\033[0;35m'
NC='\033[0m' # No Color

# Define all steps for progress tracking
TOTAL_STEPS=25
CURRENT_STEP=0

echo -e "${BLUE}🚀 Starting Connect Four AI - Comprehensive Services${NC}"
echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""

# Initialize progress
update_progress 0 $TOTAL_STEPS "Preparing environment..."
sleep 1

# Create necessary directories
update_progress 1 $TOTAL_STEPS "Creating directories..."
mkdir -p logs
mkdir -p backend/logs
mkdir -p ml_service/logs
mkdir -p ml_service/models
mkdir -p frontend/logs

# Function to check if a port is in use
check_port() {
    local port=$1
    if lsof -i :$port | grep -q LISTEN; then
        return 0
    else
        return 1
    fi
}

# Function to wait for service with progress
wait_for_service() {
    local name=$1
    local port=$2
    local url=$3
    local max_attempts=30
    local attempt=0
    
    update_progress $CURRENT_STEP $TOTAL_STEPS "Waiting for $name to start..."
    
    while [ $attempt -lt $max_attempts ]; do
        if check_port $port; then
            # Port is open, now check health endpoint if URL provided
            if [ -n "$url" ]; then
                if curl -s "$url" > /dev/null 2>&1; then
                    CURRENT_STEP=$((CURRENT_STEP + 3))
                    return 0
                fi
            else
                CURRENT_STEP=$((CURRENT_STEP + 3))
                return 0
            fi
        fi
        
        # Update progress during wait
        local sub_progress=$((CURRENT_STEP * 100 / TOTAL_STEPS + attempt * 100 / max_attempts * 3 / TOTAL_STEPS))
        draw_progress_bar $sub_progress 100
        
        sleep 1
        attempt=$((attempt + 1))
    done
    
    return 1
}

# Check prerequisites
update_progress 2 $TOTAL_STEPS "Checking Node.js..."
if ! command -v node &> /dev/null; then
    echo -e "\n${RED}❌ Node.js is not installed${NC}"
    exit 1
fi

update_progress 3 $TOTAL_STEPS "Checking Python..."
if ! command -v python3 &> /dev/null; then
    echo -e "\n${RED}❌ Python 3 is not installed${NC}"
    exit 1
fi

# Check for port conflicts
update_progress 4 $TOTAL_STEPS "Checking for port conflicts..."
PORTS=(3000 3001 8000 8001 8002)
PORTS_IN_USE=()

for port in "${PORTS[@]}"; do
    if check_port $port; then
        PORTS_IN_USE+=($port)
    fi
done

if [ ${#PORTS_IN_USE[@]} -gt 0 ]; then
    echo -e "\n${YELLOW}⚠️  Ports in use: ${PORTS_IN_USE[@]}${NC}"
    echo -e "${YELLOW}   Attempting to clean up...${NC}"
    for port in "${PORTS_IN_USE[@]}"; do
        lsof -ti :$port | xargs kill -9 2>/dev/null || true
    done
    sleep 2
fi

# Start Backend (NestJS)
CURRENT_STEP=5
update_progress $CURRENT_STEP $TOTAL_STEPS "Starting Backend Service..."
echo ""

cd backend
npm run start:dev > ../logs/backend.log 2>&1 &
BACKEND_PID=$!
echo $BACKEND_PID > ../logs/backend.pid
cd ..

wait_for_service "Backend" 3001 "http://localhost:3001/health"

# Start Frontend (React)
CURRENT_STEP=8
update_progress $CURRENT_STEP $TOTAL_STEPS "Starting Frontend Service..."
echo ""

cd frontend
npm start > ../logs/frontend.log 2>&1 &
FRONTEND_PID=$!
echo $FRONTEND_PID > ../logs/frontend.pid
cd ..

wait_for_service "Frontend" 3000 ""

# Start ML Service
CURRENT_STEP=11
update_progress $CURRENT_STEP $TOTAL_STEPS "Starting ML Service..."
echo ""

cd ml_service
python3 app.py > ../logs/ml_service.log 2>&1 &
ML_PID=$!
echo $ML_PID > ../logs/ml_service.pid
cd ..

wait_for_service "ML Service" 8000 "http://localhost:8000/health"

# Start ML Inference Service
CURRENT_STEP=14
update_progress $CURRENT_STEP $TOTAL_STEPS "Starting ML Inference Service..."
echo ""

cd ml_service
python3 services/enhanced_inference_service.py > ../logs/ml_inference.log 2>&1 &
INFERENCE_PID=$!
echo $INFERENCE_PID > ../logs/ml_inference.pid
cd ..

wait_for_service "ML Inference" 8001 "http://localhost:8001/health"

# Start AI Coordination Hub
CURRENT_STEP=17
update_progress $CURRENT_STEP $TOTAL_STEPS "Starting AI Coordination Hub..."
echo ""

cd ml_service
python3 services/ai_coordination_hub.py > ../logs/ai_coordination.log 2>&1 &
COORD_PID=$!
echo $COORD_PID > ../logs/ai_coordination.pid
cd ..

wait_for_service "AI Coordination" 8002 "http://localhost:8002/health"

# Verify all services
CURRENT_STEP=20
update_progress $CURRENT_STEP $TOTAL_STEPS "Verifying all services..."
sleep 2

ALL_RUNNING=true
SERVICES=(
    "Backend|3001|http://localhost:3001/health"
    "Frontend|3000|"
    "ML Service|8000|http://localhost:8000/health"
    "ML Inference|8001|http://localhost:8001/health"
    "AI Coordination|8002|http://localhost:8002/health"
)

for service in "${SERVICES[@]}"; do
    IFS='|' read -r name port url <<< "$service"
    if ! check_port $port; then
        ALL_RUNNING=false
    fi
done

# Complete progress
complete_progress

echo ""
echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"

if [ "$ALL_RUNNING" = true ]; then
    echo -e "${GREEN}✅ All services started successfully!${NC}"
    echo ""
    echo -e "${BLUE}📊 Service Status:${NC}"
    echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo -e "  ${GREEN}✓${NC} Frontend:         ${CYAN}http://localhost:3000${NC}"
    echo -e "  ${GREEN}✓${NC} Backend API:      ${CYAN}http://localhost:3001${NC}"
    echo -e "  ${GREEN}✓${NC} ML Service:       ${CYAN}http://localhost:8000${NC}"
    echo -e "  ${GREEN}✓${NC} ML Inference:     ${CYAN}http://localhost:8001${NC}"
    echo -e "  ${GREEN}✓${NC} AI Coordination:  ${CYAN}http://localhost:8002${NC}"
else
    echo -e "${RED}❌ Some services failed to start${NC}"
    echo -e "${YELLOW}Check logs in ./logs/ for details${NC}"
fi

# Show total time
TOTAL_TIME=$(($(date +%s) - PROGRESS_START_TIME))
echo ""
echo -e "${CYAN}⏱️  Total startup time: $(format_time $TOTAL_TIME)${NC}"
echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""
echo -e "${BLUE}💡 Next steps:${NC}"
echo -e "   ${GREEN}View logs:${NC} tail -f logs/*.log"
echo -e "   ${YELLOW}Check status:${NC} npm run services:show"
echo -e "   ${CYAN}Open app:${NC} http://localhost:3000"
echo ""