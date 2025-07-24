#!/bin/bash

# =====================================================
# 🔄 CONNECT FOUR AI - COMPREHENSIVE RESTART WITH PROGRESS
# =====================================================
# Combined restart script with unified progress tracking

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

# Total steps: 20 for stop + 25 for start = 45
TOTAL_STEPS=45
CURRENT_STEP=0

echo -e "${MAGENTA}🔄 Restarting Connect Four AI - Comprehensive Services${NC}"
echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""

# Initialize progress
update_progress 0 $TOTAL_STEPS "Starting comprehensive restart sequence..."
sleep 1

# ========== STOP PHASE (Steps 0-20) ==========
echo -e "\n${BLUE}Phase 1: Stopping Services${NC}"
echo -e "${CYAN}────────────────────────────────────────────────────────────────${NC}"

# Function to stop a service gracefully
stop_service() {
    local name=$1
    local port=$2
    local pid_file="logs/${name}.pid"
    
    CURRENT_STEP=$((CURRENT_STEP + 1))
    update_progress $CURRENT_STEP $TOTAL_STEPS "Stopping $name..."
    
    if [ -f "$pid_file" ]; then
        local pid=$(cat "$pid_file")
        if kill -0 "$pid" 2>/dev/null; then
            kill -TERM "$pid" 2>/dev/null
            local count=0
            while kill -0 "$pid" 2>/dev/null && [ $count -lt 5 ]; do
                sleep 0.2
                count=$((count + 1))
            done
            if kill -0 "$pid" 2>/dev/null; then
                kill -9 "$pid" 2>/dev/null
            fi
            rm -f "$pid_file"
        else
            rm -f "$pid_file"
        fi
    fi
    
    if lsof -i :$port | grep -q LISTEN; then
        lsof -ti :$port | xargs kill -9 2>/dev/null || true
    fi
}

# Stop all services
stop_service "ai_coordination" 8002
stop_service "ml_inference" 8001
stop_service "ml_service" 8000
stop_service "backend" 3001
stop_service "frontend" 3000

# Clean up processes
CURRENT_STEP=6
update_progress $CURRENT_STEP $TOTAL_STEPS "Cleaning up remaining processes..."

pkill -f "node.*nest" 2>/dev/null || true
pkill -f "unified-enterprise-launcher" 2>/dev/null || true
pkill -f "enterprise-parallel-launcher" 2>/dev/null || true
sleep 1

# Clean up files
CURRENT_STEP=8
update_progress $CURRENT_STEP $TOTAL_STEPS "Cleaning temporary files..."
rm -f logs/*.pid
find . -type d -name "__pycache__" -exec rm -rf {} + 2>/dev/null || true

# Brief pause between phases
CURRENT_STEP=10
update_progress $CURRENT_STEP $TOTAL_STEPS "Services stopped. Preparing to restart..."
sleep 2

# ========== START PHASE (Steps 20-45) ==========
echo -e "\n${BLUE}Phase 2: Starting Services${NC}"
echo -e "${CYAN}────────────────────────────────────────────────────────────────${NC}"

# Create directories
CURRENT_STEP=12
update_progress $CURRENT_STEP $TOTAL_STEPS "Creating directories..."
mkdir -p logs backend/logs ml_service/logs ml_service/models frontend/logs

# Function to check port
check_port() {
    lsof -i :$1 | grep -q LISTEN
}

# Function to start and wait for service
start_service() {
    local name=$1
    local port=$2
    local cmd=$3
    local dir=$4
    local health_url=$5
    
    CURRENT_STEP=$((CURRENT_STEP + 3))
    update_progress $CURRENT_STEP $TOTAL_STEPS "Starting $name..."
    
    cd "$dir"
    eval "$cmd > ../logs/${name}.log 2>&1 &"
    local pid=$!
    echo $pid > "../logs/${name}.pid"
    cd - > /dev/null
    
    # Wait for service to start
    local attempt=0
    local max_attempts=30
    
    while [ $attempt -lt $max_attempts ]; do
        if check_port $port; then
            if [ -n "$health_url" ]; then
                if curl -s "$health_url" > /dev/null 2>&1; then
                    break
                fi
            else
                break
            fi
        fi
        
        # Show sub-progress
        local sub_progress=$((CURRENT_STEP * 100 / TOTAL_STEPS + attempt * 100 / max_attempts * 3 / TOTAL_STEPS))
        draw_progress_bar $sub_progress 100
        
        sleep 0.5
        attempt=$((attempt + 1))
    done
}

# Start all services
CURRENT_STEP=15
start_service "backend" 3001 "npm run start:dev" "backend" "http://localhost:3001/health"

CURRENT_STEP=18
start_service "frontend" 3000 "npm start" "frontend" ""

CURRENT_STEP=21
start_service "ml_service" 8000 "python3 app.py" "ml_service" "http://localhost:8000/health"

CURRENT_STEP=24
start_service "ml_inference" 8001 "python3 services/enhanced_inference_service.py" "ml_service" "http://localhost:8001/health"

CURRENT_STEP=27
start_service "ai_coordination" 8002 "python3 services/ai_coordination_hub.py" "ml_service" "http://localhost:8002/health"

# Final verification
CURRENT_STEP=42
update_progress $CURRENT_STEP $TOTAL_STEPS "Verifying all services..."
sleep 2

ALL_RUNNING=true
PORTS=(3000 3001 8000 8001 8002)
for port in "${PORTS[@]}"; do
    if ! check_port $port; then
        ALL_RUNNING=false
    fi
done

# Complete
complete_progress

# Show results
echo ""
echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"

if [ "$ALL_RUNNING" = true ]; then
    echo -e "${GREEN}✅ All services restarted successfully!${NC}"
    echo ""
    echo -e "${BLUE}📊 Service URLs:${NC}"
    echo -e "  ${GREEN}✓${NC} Frontend:         ${CYAN}http://localhost:3000${NC}"
    echo -e "  ${GREEN}✓${NC} Backend API:      ${CYAN}http://localhost:3001${NC}"
    echo -e "  ${GREEN}✓${NC} ML Service:       ${CYAN}http://localhost:8000${NC}"
    echo -e "  ${GREEN}✓${NC} ML Inference:     ${CYAN}http://localhost:8001${NC}"
    echo -e "  ${GREEN}✓${NC} AI Coordination:  ${CYAN}http://localhost:8002${NC}"
else
    echo -e "${RED}❌ Some services failed to restart${NC}"
fi

# Show total time
TOTAL_TIME=$(($(date +%s) - PROGRESS_START_TIME))
echo ""
echo -e "${CYAN}⏱️  Total restart time: $(format_time $TOTAL_TIME)${NC}"
echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""