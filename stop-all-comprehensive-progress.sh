#!/bin/bash

# =====================================================
# 🛑 CONNECT FOUR AI - COMPREHENSIVE STOP WITH PROGRESS
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
TOTAL_STEPS=20
CURRENT_STEP=0

echo -e "${BLUE}🛑 Stopping Connect Four AI - Comprehensive Services${NC}"
echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""

# Initialize progress
update_progress 0 $TOTAL_STEPS "Initializing shutdown sequence..."
sleep 1

# Function to stop a service gracefully with progress
stop_service() {
    local name=$1
    local port=$2
    local pid_file="logs/${name}.pid"
    
    update_progress $CURRENT_STEP $TOTAL_STEPS "Stopping $name (Port: $port)..."
    
    # Try PID file first
    if [ -f "$pid_file" ]; then
        local pid=$(cat "$pid_file")
        if kill -0 "$pid" 2>/dev/null; then
            # Send SIGTERM for graceful shutdown
            kill -TERM "$pid" 2>/dev/null
            
            # Wait up to 5 seconds for graceful shutdown with mini progress
            local count=0
            while kill -0 "$pid" 2>/dev/null && [ $count -lt 5 ]; do
                sleep 0.5
                count=$((count + 1))
                # Update progress bar during wait
                local sub_progress=$((CURRENT_STEP * 100 / TOTAL_STEPS + count * 10 / TOTAL_STEPS))
                draw_progress_bar $sub_progress 100
            done
            
            # Force kill if still running
            if kill -0 "$pid" 2>/dev/null; then
                kill -9 "$pid" 2>/dev/null
            fi
            
            rm -f "$pid_file"
        else
            rm -f "$pid_file"
        fi
    fi
    
    # Also check port and clean up
    if lsof -i :$port | grep -q LISTEN; then
        lsof -ti :$port | xargs kill -9 2>/dev/null || true
    fi
    
    CURRENT_STEP=$((CURRENT_STEP + 2))
}

# Function to kill processes by pattern with progress
kill_by_pattern() {
    local pattern=$1
    local name=$2
    
    update_progress $CURRENT_STEP $TOTAL_STEPS "Cleaning up $name processes..."
    
    local pids=$(pgrep -f "$pattern" 2>/dev/null || true)
    if [ -n "$pids" ]; then
        echo "$pids" | xargs kill -TERM 2>/dev/null || true
        sleep 0.5
        echo "$pids" | xargs kill -9 2>/dev/null || true
    fi
    
    CURRENT_STEP=$((CURRENT_STEP + 1))
}

# Stop services in reverse order (2 steps each, total 10 steps)
echo ""
update_progress 1 $TOTAL_STEPS "Starting graceful service shutdown..."
sleep 0.5

CURRENT_STEP=2
stop_service "ai_coordination" 8002
stop_service "ml_inference" 8001
stop_service "ml_service" 8000
stop_service "backend" 3001
stop_service "frontend" 3000

# Clean up remaining processes (1 step each, total 5 steps)
echo ""
update_progress 12 $TOTAL_STEPS "Cleaning up remaining processes..."
sleep 0.5

CURRENT_STEP=12
kill_by_pattern "node.*nest" "NestJS"
kill_by_pattern "node.*webpack" "Webpack"
kill_by_pattern "unified-enterprise-launcher" "Enterprise Launcher"
kill_by_pattern "enterprise-parallel-launcher" "Parallel Launcher"
kill_by_pattern "ai-stability-manager" "AI Stability Manager"

# Port verification (2 steps)
echo ""
CURRENT_STEP=17
update_progress $CURRENT_STEP $TOTAL_STEPS "Verifying port cleanup..."

PORTS=(3000 3001 8000 8001 8002)
ALL_CLEAR=true

for port in "${PORTS[@]}"; do
    if lsof -i :$port | grep -q LISTEN; then
        ALL_CLEAR=false
        lsof -ti :$port | xargs kill -9 2>/dev/null || true
    fi
done

CURRENT_STEP=18

# Clean up files (2 steps)
update_progress $CURRENT_STEP $TOTAL_STEPS "Cleaning temporary files..."

# Clean up PID files
rm -f logs/*.pid

# Mark services as stopped in log
if [ -f "logs/services.log" ]; then
    echo "STOPPED|$(date)" >> "logs/services.log"
fi

CURRENT_STEP=19

# Clean up Python cache
update_progress $CURRENT_STEP $TOTAL_STEPS "Removing Python cache files..."
find . -type d -name "__pycache__" -exec rm -rf {} + 2>/dev/null || true

# Complete
complete_progress
echo ""

if [ "$ALL_CLEAR" = true ]; then
    echo -e "${GREEN}✅ All services stopped successfully!${NC}"
else
    echo -e "${YELLOW}⚠️  Some services may still be running${NC}"
fi

# Show total time
TOTAL_TIME=$(($(date +%s) - PROGRESS_START_TIME))
echo -e "${CYAN}⏱️  Total time: $(format_time $TOTAL_TIME)${NC}"
echo ""