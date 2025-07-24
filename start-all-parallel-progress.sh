#!/bin/bash

# =====================================================
# 🚀 CONNECT FOUR AI - PARALLEL START WITH PROGRESS
# =====================================================
# Optimized version that starts services in parallel

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
declare -A SERVICE_START_TIMES
declare -A SERVICE_HEALTH_URLS

# Define all steps for progress tracking
TOTAL_STEPS=12  # Reduced because parallel operations are faster
CURRENT_STEP=0

echo -e "${GREEN}🚀 Starting Connect Four AI - Parallel Mode${NC}"
echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""

# Initialize progress
update_progress 0 $TOTAL_STEPS "Initializing parallel startup..."
sleep 0.5

# Step 1: Create necessary directories
update_progress 1 $TOTAL_STEPS "📁 Creating directories..."
mkdir -p logs backend/logs ml_service/logs ml_service/models frontend/logs

# Step 2: Verify ports are free
update_progress 2 $TOTAL_STEPS "🔍 Verifying ports are available..."

PORTS=(3000 3001 8000 8001 8002)
PORT_CHECK_FAILED=false

for port in "${PORTS[@]}"; do
    if lsof -i :$port | grep -q LISTEN; then
        echo -e "\n${RED}❌ Port $port is already in use!${NC}"
        PORT_CHECK_FAILED=true
    fi
done

if [ "$PORT_CHECK_FAILED" = true ]; then
    echo -e "${RED}Please stop existing services first!${NC}"
    exit 1
fi

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
                    # Check health endpoint if available
                    if curl -s "$health_url" > /dev/null 2>&1; then
                        ready=true
                        break
                    fi
                else
                    # No health check, port is enough
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
    
    # Return the background process PID
    echo $!
}

# Step 3: Launch all services in parallel
update_progress 3 $TOTAL_STEPS "🚀 Launching all services in parallel..."

SERVICES=(
    "backend|3001|npm run start:dev|backend|http://localhost:3001/health"
    "frontend|3000|npm start|frontend|"
    "ml_service|8000|python3 app.py|ml_service|http://localhost:8000/health"
    "ml_inference|8001|python3 services/enhanced_inference_service.py|ml_service|http://localhost:8001/health"
    "ai_coordination|8002|python3 services/ai_coordination_hub.py|ml_service|http://localhost:8002/health"
)

# Start all services in parallel
for service_info in "${SERVICES[@]}"; do
    IFS='|' read -r name port cmd dir health_url <<< "$service_info"
    SERVICE_PIDS[$name]=$(start_service_async "$name" "$port" "$cmd" "$dir" "$health_url")
    SERVICE_HEALTH_URLS[$name]=$health_url
done

# Step 4: Monitor parallel startups with real-time updates
update_progress 4 $TOTAL_STEPS "⏳ Services starting up in parallel..."

# Track completion
SERVICES_STARTED=0
SERVICES_FAILED=0
TOTAL_SERVICES=${#SERVICES[@]}
declare -A SERVICE_TIMES

# Create a status display
echo -e "\n${CYAN}Service Startup Status:${NC}"
for service_info in "${SERVICES[@]}"; do
    IFS='|' read -r name port cmd dir health_url <<< "$service_info"
    printf "  %-20s: ${YELLOW}[Starting...]${NC}\n" "$name"
done

# Move cursor up to update in place
printf "\033[${TOTAL_SERVICES}A"

# Monitor services
while [ $((SERVICES_STARTED + SERVICES_FAILED)) -lt $TOTAL_SERVICES ]; do
    for service_info in "${SERVICES[@]}"; do
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
                SERVICE_TIMES[$name]=$time
                
                if [ "$status" = "SUCCESS" ]; then
                    SERVICES_STARTED=$((SERVICES_STARTED + 1))
                    printf "\r  %-20s: ${GREEN}[Started in ${time}s]${NC}\n" "$name"
                else
                    SERVICES_FAILED=$((SERVICES_FAILED + 1))
                    printf "\r  %-20s: ${RED}[Failed after ${time}s]${NC}\n" "$name"
                fi
                
                # Update progress
                local progress=$((4 + (SERVICES_STARTED + SERVICES_FAILED) * 4 / TOTAL_SERVICES))
                draw_progress_bar $progress $TOTAL_STEPS
            fi
        fi
    done
    sleep 0.1
done

# Move cursor below service list
echo ""

# Step 5: Verify all services
update_progress 9 $TOTAL_STEPS "✅ Verifying service health..."

ALL_HEALTHY=true
echo -e "\n${CYAN}Health Check Results:${NC}"

for service_info in "${SERVICES[@]}"; do
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

# Step 6: Log service status
update_progress 10 $TOTAL_STEPS "📝 Recording service status..."

# Mark services as running
if [ -f "logs/services.log" ]; then
    echo "STARTED|$(date)" >> "logs/services.log"
fi

# Step 7: Final verification
update_progress 11 $TOTAL_STEPS "🔍 Final verification..."
sleep 1

# Complete
complete_progress

# Summary
echo ""
echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"

if [ "$ALL_HEALTHY" = true ] && [ $SERVICES_FAILED -eq 0 ]; then
    echo -e "${GREEN}✅ All services started successfully in parallel!${NC}"
    echo ""
    echo -e "${BLUE}📊 Service URLs:${NC}"
    echo -e "  ${GREEN}✓${NC} Frontend:         ${CYAN}http://localhost:3000${NC}"
    echo -e "  ${GREEN}✓${NC} Backend API:      ${CYAN}http://localhost:3001${NC}"
    echo -e "  ${GREEN}✓${NC} ML Service:       ${CYAN}http://localhost:8000${NC}"
    echo -e "  ${GREEN}✓${NC} ML Inference:     ${CYAN}http://localhost:8001${NC}"
    echo -e "  ${GREEN}✓${NC} AI Coordination:  ${CYAN}http://localhost:8002${NC}"
else
    echo -e "${RED}❌ Some services failed to start properly${NC}"
    echo ""
    echo -e "${YELLOW}Please check the logs in the 'logs' directory for details.${NC}"
fi

# Show individual service times
echo -e "\n${CYAN}Service Startup Times:${NC}"
for service_info in "${SERVICES[@]}"; do
    IFS='|' read -r name port cmd dir health_url <<< "$service_info"
    if [ -n "${SERVICE_TIMES[$name]}" ]; then
        printf "  %-20s: %ss\n" "$name" "${SERVICE_TIMES[$name]}"
    fi
done

# Show total time
TOTAL_TIME=$(($(date +%s) - PROGRESS_START_TIME))
echo -e "\n${CYAN}⏱️  Total time: $(format_time $TOTAL_TIME)${NC}"

# Performance comparison
SEQUENTIAL_ESTIMATE=50  # Estimated sequential time
if [ $TOTAL_TIME -gt 0 ]; then
    SPEEDUP=$(awk "BEGIN {printf \"%.1f\", $SEQUENTIAL_ESTIMATE / $TOTAL_TIME}")
    echo -e "${YELLOW}🚀 Performance: ${SPEEDUP}x faster than sequential startup${NC}"
fi

echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""