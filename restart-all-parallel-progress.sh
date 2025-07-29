#!/bin/bash

# =====================================================
# 🔄 CONNECT FOUR AI - PARALLEL RESTART WITH PROGRESS
# =====================================================
# Combined restart script with parallel operations

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

# Total steps: 10 for parallel stop + 12 for parallel start = 22
TOTAL_STEPS=22
CURRENT_STEP=0

echo -e "${MAGENTA}🔄 Restarting Connect Four AI - Parallel Mode${NC}"
echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""

# Initialize progress
update_progress 0 $TOTAL_STEPS "Starting parallel restart sequence..."
sleep 0.5

# ========== STOP PHASE (Steps 0-10) ==========
echo -e "\n${BLUE}Phase 1: Parallel Service Shutdown${NC}"
echo -e "${CYAN}────────────────────────────────────────────────────────────────${NC}"

# Track parallel operations
declare -A SERVICE_PIDS
declare -A SERVICE_STATUS
declare -A SERVICE_STOP_TIMES

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

# Step 1: Launch all service stops in parallel
update_progress 1 $TOTAL_STEPS "🛑 Stopping all services in parallel..."

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

# Monitor shutdowns
SERVICES_STOPPED=0
TOTAL_SERVICES=${#SERVICES[@]}

echo -e "\n${CYAN}Shutdown Status:${NC}"
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
                SERVICE_STOP_TIMES[$name]=$(wait $pid 2>&1 | grep -oE 'DONE:[^:]+:([0-9]+)' | cut -d: -f3 || echo "0")
                SERVICES_STOPPED=$((SERVICES_STOPPED + 1))
                
                printf "\r  %-20s: ${GREEN}[Stopped in ${SERVICE_STOP_TIMES[$name]}s]${NC}\n" "$name"
                
                # Update progress
                local progress=$((1 + SERVICES_STOPPED * 3 / TOTAL_SERVICES))
                update_progress $progress $TOTAL_STEPS "Services stopped: $SERVICES_STOPPED/$TOTAL_SERVICES"
            fi
        fi
    done
    sleep 0.1
done

echo ""

# Step 2: Clean up processes in parallel
update_progress 5 $TOTAL_STEPS "🧹 Cleaning up processes..."

# Kill patterns in parallel
{
    pkill -f "node.*nest" 2>/dev/null || true
} &
PID1=$!

{
    pkill -f "unified-enterprise-launcher|enterprise-parallel-launcher|ai-stability-manager" 2>/dev/null || true
} &
PID2=$!

{
    pkill -f "python.*ml_service|python.*enhanced_inference|python.*ai_coordination_hub" 2>/dev/null || true
} &
PID3=$!

wait $PID1 $PID2 $PID3 2>/dev/null || true

# Step 3: Verify ports and clean files
update_progress 7 $TOTAL_STEPS "🔍 Verifying ports and cleaning files..."

# Clean up in parallel
{
    # Verify ports are free
    for port in 3000 3001 8000 8001 8002; do
        if lsof -i :$port | grep -q LISTEN; then
            lsof -ti :$port | xargs kill -9 2>/dev/null || true
        fi
    done
} &
PORT_CLEAN=$!

{
    # Clean files
    rm -f logs/*.pid
    find . -type d -name "__pycache__" -exec rm -rf {} + 2>/dev/null || true
} &
FILE_CLEAN=$!

wait $PORT_CLEAN $FILE_CLEAN 2>/dev/null || true

# Brief pause between phases
update_progress 9 $TOTAL_STEPS "✅ Shutdown complete. Preparing to start..."
sleep 2

# ========== START PHASE (Steps 10-22) ==========
echo -e "\n${BLUE}Phase 2: Parallel Service Startup${NC}"
echo -e "${CYAN}────────────────────────────────────────────────────────────────${NC}"

# Reset service tracking for start phase
unset SERVICE_PIDS
unset SERVICE_STATUS
declare -A SERVICE_PIDS
declare -A SERVICE_STATUS
declare -A SERVICE_START_TIMES
declare -A SERVICE_HEALTH_URLS

# Step 4: Create directories
update_progress 10 $TOTAL_STEPS "📁 Creating directories..."
mkdir -p logs backend/logs ml_service/logs ml_service/models frontend/logs

# Function to check if port is listening
check_port() {
    lsof -i :$1 | grep -q LISTEN
}

# Function to start a service in background
start_service_async() {
    local name=$1
    local port=$2
    local cmd=$3
    local dir=$4
    local health_url=$5
    local start_time=$(date +%s)
    
    {
        cd "$dir" 2>/dev/null || {
            echo "ERROR:$name:Failed to change directory"
            return 1
        }
        
        # Start the service
        eval "$cmd > ../logs/${name}.log 2>&1 &"
        local pid=$!
        echo $pid > "../logs/${name}.pid"
        
        # Wait for service to be ready
        local attempt=0
        local max_attempts=60  # 30 seconds max
        local ready=false
        
        while [ $attempt -lt $max_attempts ]; do
            if check_port $port; then
                if [ -n "$health_url" ]; then
                    if curl -s "$health_url" > /dev/null 2>&1; then
                        ready=true
                        break
                    fi
                else
                    ready=true
                    break
                fi
            fi
            
            sleep 0.5
            attempt=$((attempt + 1))
        done
        
        cd - > /dev/null
        
        # Record result
        local end_time=$(date +%s)
        if [ "$ready" = true ]; then
            echo "SUCCESS:$name:$((end_time - start_time))"
        else
            echo "FAILED:$name:$((end_time - start_time))"
        fi
    } &
    
    echo $!
}

# Step 5: Launch all services in parallel
update_progress 11 $TOTAL_STEPS "🚀 Starting all services in parallel..."

SERVICES_START=(
    "backend|3001|npm run start:dev|backend|http://localhost:3001/health"
    "frontend|3000|npm start|frontend|"
    "ml_service|8000|python3 app.py|ml_service|http://localhost:8000/health"
    "ml_inference|8001|python3 services/enhanced_inference_service.py|ml_service|http://localhost:8001/health"
    "ai_coordination|8002|python3 services/ai_coordination_hub.py|ml_service|http://localhost:8002/health"
)

# Start all services in parallel
for service_info in "${SERVICES_START[@]}"; do
    IFS='|' read -r name port cmd dir health_url <<< "$service_info"
    SERVICE_PIDS[$name]=$(start_service_async "$name" "$port" "$cmd" "$dir" "$health_url")
    SERVICE_HEALTH_URLS[$name]=$health_url
done

# Monitor startup
SERVICES_STARTED=0
SERVICES_FAILED=0

echo -e "\n${CYAN}Startup Status:${NC}"
for service_info in "${SERVICES_START[@]}"; do
    IFS='|' read -r name port cmd dir health_url <<< "$service_info"
    printf "  %-20s: ${YELLOW}[Starting...]${NC}\n" "$name"
done

# Move cursor up to update in place
printf "\033[${TOTAL_SERVICES}A"

while [ $((SERVICES_STARTED + SERVICES_FAILED)) -lt $TOTAL_SERVICES ]; do
    for service_info in "${SERVICES_START[@]}"; do
        IFS='|' read -r name port cmd dir health_url <<< "$service_info"
        pid=${SERVICE_PIDS[$name]}
        
        if [ -n "$pid" ] && ! kill -0 $pid 2>/dev/null; then
            # Process completed
            if [ -z "${SERVICE_STATUS[$name]}" ]; then
                # Get the result
                result=$(wait $pid 2>&1 | grep -oE '(SUCCESS|FAILED):[^:]+:([0-9]+)' || echo "FAILED:$name:0")
                status=$(echo "$result" | cut -d: -f1)
                time=$(echo "$result" | cut -d: -f3)
                
                SERVICE_STATUS[$name]=$status
                SERVICE_START_TIMES[$name]=$time
                
                if [ "$status" = "SUCCESS" ]; then
                    SERVICES_STARTED=$((SERVICES_STARTED + 1))
                    printf "\r  %-20s: ${GREEN}[Started in ${time}s]${NC}\n" "$name"
                else
                    SERVICES_FAILED=$((SERVICES_FAILED + 1))
                    printf "\r  %-20s: ${RED}[Failed after ${time}s]${NC}\n" "$name"
                fi
                
                # Update progress
                local progress=$((11 + (SERVICES_STARTED + SERVICES_FAILED) * 8 / TOTAL_SERVICES))
                update_progress $progress $TOTAL_STEPS "Services started: $SERVICES_STARTED/$TOTAL_SERVICES"
            fi
        fi
    done
    sleep 0.1
done

echo ""

# Step 6: Final verification
update_progress 20 $TOTAL_STEPS "✅ Verifying all services..."

ALL_HEALTHY=true
echo -e "\n${CYAN}Health Check Results:${NC}"

for service_info in "${SERVICES_START[@]}"; do
    IFS='|' read -r name port cmd dir health_url <<< "$service_info"
    
    if [ "${SERVICE_STATUS[$name]}" = "SUCCESS" ]; then
        if [ -n "$health_url" ]; then
            if curl -s "$health_url" > /dev/null 2>&1; then
                printf "  %-20s: ${GREEN}✓ Healthy${NC}\n" "$name"
            else
                printf "  %-20s: ${YELLOW}⚠ Started but health check failed${NC}\n" "$name"
                ALL_HEALTHY=false
            fi
        else
            printf "  %-20s: ${GREEN}✓ Running${NC}\n" "$name"
        fi
    else
        printf "  %-20s: ${RED}✗ Failed to start${NC}\n" "$name"
        ALL_HEALTHY=false
    fi
done

# Complete
complete_progress

# Summary
echo ""
echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"

if [ "$ALL_HEALTHY" = true ] && [ $SERVICES_FAILED -eq 0 ]; then
    echo -e "${GREEN}✅ All services restarted successfully in parallel!${NC}"
    echo ""
    echo -e "${BLUE}📊 Service URLs:${NC}"
    echo -e "  ${GREEN}✓${NC} Frontend:         ${CYAN}http://localhost:3000${NC}"
    echo -e "  ${GREEN}✓${NC} Backend API:      ${CYAN}http://localhost:3001${NC}"
    echo -e "  ${GREEN}✓${NC} ML Service:       ${CYAN}http://localhost:8000${NC}"
    echo -e "  ${GREEN}✓${NC} ML Inference:     ${CYAN}http://localhost:8001${NC}"
    echo -e "  ${GREEN}✓${NC} AI Coordination:  ${CYAN}http://localhost:8002${NC}"
else
    echo -e "${RED}❌ Some services failed to restart properly${NC}"
fi

# Show timing summary
echo -e "\n${CYAN}Performance Summary:${NC}"
echo -e "\n${BLUE}Shutdown Times:${NC}"
for service_info in "${SERVICES[@]}"; do
    IFS='|' read -r name port <<< "$service_info"
    printf "  %-20s: %ss\n" "$name" "${SERVICE_STOP_TIMES[$name]:-0}"
done

echo -e "\n${BLUE}Startup Times:${NC}"
for service_info in "${SERVICES_START[@]}"; do
    IFS='|' read -r name port cmd dir health_url <<< "$service_info"
    if [ -n "${SERVICE_START_TIMES[$name]}" ]; then
        printf "  %-20s: %ss\n" "$name" "${SERVICE_START_TIMES[$name]}"
    fi
done

# Show total time
TOTAL_TIME=$(($(date +%s) - PROGRESS_START_TIME))
echo -e "\n${CYAN}⏱️  Total restart time: $(format_time $TOTAL_TIME)${NC}"

# Performance comparison
SEQUENTIAL_ESTIMATE=80  # Estimated sequential time (stop + start)
if [ $TOTAL_TIME -gt 0 ]; then
    SPEEDUP=$(awk "BEGIN {printf \"%.1f\", $SEQUENTIAL_ESTIMATE / $TOTAL_TIME}")
    echo -e "${YELLOW}🚀 Performance: ${SPEEDUP}x faster than sequential restart${NC}"
fi

echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""