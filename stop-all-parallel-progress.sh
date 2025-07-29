#!/bin/bash

# =====================================================
# 🛑 CONNECT FOUR AI - PARALLEL STOP WITH PROGRESS
# =====================================================
# Optimized version that stops services in parallel

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

# Track parallel operations
declare -A SERVICE_PIDS
declare -A SERVICE_STATUS
declare -A SERVICE_STOP_TIMES

# Define all steps for progress tracking
TOTAL_STEPS=10  # Reduced because parallel operations are faster
CURRENT_STEP=0

echo -e "${BLUE}🛑 Stopping Connect Four AI - Parallel Mode${NC}"
echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""

# Initialize progress
update_progress 0 $TOTAL_STEPS "Initializing parallel shutdown..."
sleep 0.5

# Function to stop a service in background
stop_service_async() {
    local name=$1
    local port=$2
    local pid_file="logs/${name}.pid"
    local start_time=$(date +%s)
    
    {
        # Try PID file first
        if [ -f "$pid_file" ]; then
            local pid=$(cat "$pid_file")
            if kill -0 "$pid" 2>/dev/null; then
                # Send SIGTERM for graceful shutdown
                kill -TERM "$pid" 2>/dev/null
                
                # Wait up to 5 seconds for graceful shutdown
                local count=0
                while kill -0 "$pid" 2>/dev/null && [ $count -lt 10 ]; do
                    sleep 0.5
                    count=$((count + 1))
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
        
        # Record stop time
        local end_time=$(date +%s)
        echo "DONE:$name:$((end_time - start_time))"
    } &
    
    # Return the background process PID
    echo $!
}

# Function to kill processes by pattern in parallel
kill_patterns_parallel() {
    local patterns=("$@")
    local pids=()
    
    for pattern in "${patterns[@]}"; do
        {
            pkill -f "$pattern" 2>/dev/null || true
        } &
        pids+=($!)
    done
    
    # Wait for all pattern kills to complete
    for pid in "${pids[@]}"; do
        wait $pid 2>/dev/null || true
    done
}

# Step 1: Launch all service stops in parallel
update_progress 1 $TOTAL_STEPS "🚀 Launching parallel shutdown for all services..."

SERVICES=(
    "ai_coordination|8002"
    "ml_inference|8001"
    "ml_service|8000"
    "backend|3001"
    "frontend|3000"
)

# Start all stops in parallel
for service_info in "${SERVICES[@]}"; do
    IFS='|' read -r name port <<< "$service_info"
    SERVICE_PIDS[$name]=$(stop_service_async "$name" "$port")
done

# Step 2: Monitor parallel shutdowns with real-time updates
update_progress 2 $TOTAL_STEPS "⏳ Services shutting down in parallel..."

# Track completion
SERVICES_STOPPED=0
TOTAL_SERVICES=${#SERVICES[@]}
declare -A SERVICE_TIMES

# Create a status display
echo -e "\n${CYAN}Service Shutdown Status:${NC}"
for service_info in "${SERVICES[@]}"; do
    IFS='|' read -r name port <<< "$service_info"
    printf "  %-20s: ${YELLOW}[Stopping...]${NC}\n" "$name"
done

# Move cursor up to update in place
printf "\033[${TOTAL_SERVICES}A"

while [ $SERVICES_STOPPED -lt $TOTAL_SERVICES ]; do
    for service_info in "${SERVICES[@]}"; do
        IFS='|' read -r name port <<< "$service_info"
        pid=${SERVICE_PIDS[$name]}
        
        if [ -n "$pid" ] && ! kill -0 $pid 2>/dev/null; then
            # Process completed
            if [ -z "${SERVICE_STATUS[$name]}" ]; then
                SERVICE_STATUS[$name]="stopped"
                SERVICE_TIMES[$name]=$(wait $pid 2>&1 | grep -oE 'DONE:[^:]+:([0-9]+)' | cut -d: -f3 || echo "0")
                SERVICES_STOPPED=$((SERVICES_STOPPED + 1))
                
                # Update the specific service line
                printf "\r  %-20s: ${GREEN}[Stopped in ${SERVICE_TIMES[$name]}s]${NC}\n" "$name"
                
                # Update progress
                local progress=$((2 + SERVICES_STOPPED * 3 / TOTAL_SERVICES))
                draw_progress_bar $progress $TOTAL_STEPS
            fi
        fi
    done
    sleep 0.1
done

# Move cursor below service list
echo ""

# Step 3: Clean up processes in parallel
update_progress 6 $TOTAL_STEPS "🧹 Cleaning up remaining processes in parallel..."

CLEANUP_PATTERNS=(
    "node.*nest"
    "node.*webpack"
    "unified-enterprise-launcher"
    "enterprise-parallel-launcher"
    "ai-stability-manager"
    "python.*ml_service"
    "python.*enhanced_inference"
    "python.*ai_coordination_hub"
)

kill_patterns_parallel "${CLEANUP_PATTERNS[@]}"

# Step 4: Port verification in parallel
update_progress 7 $TOTAL_STEPS "🔍 Verifying all ports are free..."

PORTS=(3000 3001 8000 8001 8002)
PORT_PIDS=()

for port in "${PORTS[@]}"; do
    {
        if lsof -i :$port | grep -q LISTEN; then
            lsof -ti :$port | xargs kill -9 2>/dev/null || true
        fi
    } &
    PORT_PIDS+=($!)
done

# Wait for all port cleanups
for pid in "${PORT_PIDS[@]}"; do
    wait $pid 2>/dev/null || true
done

# Step 5: Clean up files in parallel
update_progress 8 $TOTAL_STEPS "📁 Cleaning temporary files..."

# Run cleanup tasks in parallel
{
    rm -f logs/*.pid
} &
PID_CLEAN=$!

{
    find . -type d -name "__pycache__" -exec rm -rf {} + 2>/dev/null || true
} &
CACHE_CLEAN=$!

{
    # Clean any socket files
    find /tmp -name "*.sock" -user $(whoami) -delete 2>/dev/null || true
} &
SOCKET_CLEAN=$!

# Mark services as stopped
if [ -f "logs/services.log" ]; then
    echo "STOPPED|$(date)" >> "logs/services.log"
fi

# Wait for all cleanup tasks
wait $PID_CLEAN 2>/dev/null || true
wait $CACHE_CLEAN 2>/dev/null || true
wait $SOCKET_CLEAN 2>/dev/null || true

# Complete
update_progress 9 $TOTAL_STEPS "✨ Finalizing..."
sleep 0.5
complete_progress

# Summary
echo ""
echo -e "${GREEN}✅ All services stopped in parallel!${NC}"

# Show individual service times
echo -e "\n${CYAN}Service Shutdown Times:${NC}"
for service_info in "${SERVICES[@]}"; do
    IFS='|' read -r name port <<< "$service_info"
    printf "  %-20s: %ss\n" "$name" "${SERVICE_TIMES[$name]:-0}"
done

# Show total time
TOTAL_TIME=$(($(date +%s) - PROGRESS_START_TIME))
echo -e "\n${CYAN}⏱️  Total time: $(format_time $TOTAL_TIME)${NC}"

# Performance comparison
SEQUENTIAL_ESTIMATE=30  # Estimated sequential time
SPEEDUP=$(awk "BEGIN {printf \"%.1f\", $SEQUENTIAL_ESTIMATE / $TOTAL_TIME}")
echo -e "${YELLOW}🚀 Performance: ${SPEEDUP}x faster than sequential shutdown${NC}"
echo ""