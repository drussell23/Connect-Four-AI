#!/bin/bash

# Connect Four AI - Comprehensive Service Health Check
# This script performs detailed health checks on all services

echo "🔍 CONNECT FOUR AI - COMPREHENSIVE SERVICE HEALTH CHECK"
echo "======================================================"
echo ""

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
PURPLE='\033[0;35m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

# Function to check service health
check_service() {
    local name=$1
    local url=$2
    local description=$3
    
    echo -e "${BLUE}🔧 $name${NC}"
    echo -e "   URL: $url"
    echo -e "   Description: $description"
    
    # Perform HTTP check with detailed metrics
    response=$(curl -s -o /dev/null -w "HTTP Status: %{http_code} | Response Time: %{time_total}s | DNS Time: %{time_namelookup}s | Connect Time: %{time_connect}s | TTFB: %{time_starttransfer}s" "$url" 2>/dev/null)
    
    if [[ $response == *"HTTP Status: 200"* ]]; then
        echo -e "   ${GREEN}✅ HEALTHY${NC} - Service responding correctly"
        echo -e "   ${CYAN}📊 Metrics: $response${NC}"
        return 0
    else
        echo -e "   ${RED}❌ UNHEALTHY${NC} - Service not responding"
        echo -e "   ${YELLOW}📊 Response: $response${NC}"
        return 1
    fi
    echo ""
}

# Function to check WebSocket availability
check_websocket() {
    echo -e "${PURPLE}🔌 WebSocket Gateway (Port 3000/game)${NC}"
    echo -e "   URL: ws://localhost:3000/game"
    echo -e "   Description: Real-time gaming and live updates"
    
    # Check if the backend API is responding (WebSocket runs on same port)
    response=$(curl -s -o /dev/null -w "HTTP Status: %{http_code}" http://localhost:3000/api/games/settings/user/demo-user 2>/dev/null)
    
    if [[ $response == *"HTTP Status: 200"* ]]; then
        echo -e "   ${GREEN}✅ HEALTHY${NC} - WebSocket gateway available"
        echo -e "   ${CYAN}📊 Backend Status: $response${NC}"
        return 0
    else
        echo -e "   ${RED}❌ UNHEALTHY${NC} - WebSocket gateway not available"
        echo -e "   ${YELLOW}📊 Backend Status: $response${NC}"
        return 1
    fi
    echo ""
}

# Function to get detailed service info
get_service_info() {
    local port=$1
    local service_name=$2
    
    echo -e "${CYAN}📋 $service_name Details:${NC}"
    
    # Check if port is listening
    if lsof -i :$port >/dev/null 2>&1; then
        echo -e "   ${GREEN}✅ Port $port is listening${NC}"
        
        # Get process info
        process_info=$(lsof -i :$port | grep LISTEN | head -1)
        if [[ -n "$process_info" ]]; then
            pid=$(echo "$process_info" | awk '{print $2}')
            process_name=$(echo "$process_info" | awk '{print $1}')
            echo -e "   📊 Process: $process_name (PID: $pid)"
        fi
    else
        echo -e "   ${RED}❌ Port $port is not listening${NC}"
    fi
    echo ""
}

# Main health check execution
echo -e "${YELLOW}🚀 Starting comprehensive health checks...${NC}"
echo ""

# Initialize counters
healthy_count=0
total_services=4

# Check Backend Service
if check_service "Backend Service (Port 3000)" "http://localhost:3000/api/games/settings/user/demo-user" "NestJS API with game logic and settings"; then
    ((healthy_count++))
fi

# Check Frontend Service
if check_service "Frontend Service (Port 3001)" "http://localhost:3001" "React development server with game UI"; then
    ((healthy_count++))
fi

# Check ML Service
if check_service "ML Service (Port 8000)" "http://localhost:8000/health" "Python AI service with ML models"; then
    ((healthy_count++))
fi

# Check WebSocket Gateway
if check_websocket; then
    ((healthy_count++))
fi

echo "======================================================"
echo -e "${YELLOW}📊 DETAILED SERVICE INFORMATION${NC}"
echo "======================================================"
echo ""

get_service_info 3000 "Backend Service"
get_service_info 3001 "Frontend Service"
get_service_info 8000 "ML Service"

echo "======================================================"
echo -e "${YELLOW}🎯 FINAL STATUS SUMMARY${NC}"
echo "======================================================"
echo ""

if [ $healthy_count -eq $total_services ]; then
    echo -e "${GREEN}🎉 SUCCESS: All $total_services/$total_services services are running successfully!${NC}"
    echo ""
    echo -e "${CYAN}🌐 Access your application:${NC}"
    echo -e "   🎮 Frontend: ${BLUE}http://localhost:3001${NC}"
    echo -e "   🔧 Backend API: ${BLUE}http://localhost:3000/api${NC}"
    echo -e "   🤖 ML Service: ${BLUE}http://localhost:8000${NC}"
    echo -e "   🔌 WebSocket: ${BLUE}ws://localhost:3000/game${NC}"
    echo ""
    echo -e "${GREEN}✨ Your Connect Four AI game is fully operational!${NC}"
    echo ""
    echo -e "${PURPLE}🎮 Ready to play? Open http://localhost:3001 in your browser!${NC}"
else
    echo -e "${RED}⚠️  WARNING: Only $healthy_count/$total_services services are healthy${NC}"
    echo ""
    echo -e "${YELLOW}🔧 Troubleshooting tips:${NC}"
    echo -e "   • Check if all services are started: ${BLUE}npm run status:detailed${NC}"
    echo -e "   • Restart services: ${BLUE}npm run restart:turbo:build:enhanced:force:clean${NC}"
    echo -e "   • Check logs: ${BLUE}npm run dev:logs${NC}"
    echo -e "   • Emergency cleanup: ${BLUE}npm run emergency${NC}"
fi

echo ""
echo -e "${CYAN}📈 Performance Summary:${NC}"
echo -e "   • Services Healthy: $healthy_count/$total_services"
echo -e "   • Success Rate: $((healthy_count * 100 / total_services))%"
echo -e "   • Check Time: $(date '+%Y-%m-%d %H:%M:%S')"

echo ""
echo -e "${GREEN}🎊 Health check complete! 🎊${NC}"

# Exit with appropriate code
if [ $healthy_count -eq $total_services ]; then
    exit 0
else
    exit 1
fi 