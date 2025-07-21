#!/bin/bash

# Connect Four AI - Advanced System Monitor
# Provides real-time monitoring and intelligent alerts

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
PURPLE='\033[0;35m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

# Function to get timestamp
timestamp() {
    date '+%H:%M:%S'
}

# Function to monitor system resources
monitor_system() {
    echo -e "${CYAN}[$(timestamp)] 📊 SYSTEM MONITORING${NC}"
    
    # Memory usage
    mem_usage=$(vm_stat | grep "Pages free:" | awk '{print $3}' | sed 's/\.//')
    echo -e "   🧠 Memory: ${mem_usage}% free"
    
    # CPU usage
    cpu_usage=$(top -l 1 | grep "CPU usage" | awk '{print $3}' | sed 's/%//')
    echo -e "   ⚡ CPU: ${cpu_usage}%"
    
    # Disk usage
    disk_usage=$(df -h . | awk 'NR==2 {print $5}' | sed 's/%//')
    echo -e "   💾 Disk: ${disk_usage}% used"
    
    # Network connectivity
    if ping -c 1 google.com >/dev/null 2>&1; then
        echo -e "   🌐 Network: ${GREEN}Connected${NC}"
    else
        echo -e "   🌐 Network: ${RED}Disconnected${NC}"
    fi
}

# Function to monitor service health
monitor_services() {
    echo -e "${CYAN}[$(timestamp)] 🔍 SERVICE HEALTH MONITORING${NC}"
    
    # Backend health
    backend_status=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:3000/api/games/settings/user/demo-user 2>/dev/null || echo "000")
    if [ "$backend_status" = "200" ]; then
        echo -e "   🔧 Backend: ${GREEN}Healthy (${backend_status})${NC}"
    else
        echo -e "   🔧 Backend: ${RED}Unhealthy (${backend_status})${NC}"
    fi
    
    # Frontend health
    frontend_status=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:3001 2>/dev/null || echo "000")
    if [ "$frontend_status" = "200" ]; then
        echo -e "   🎨 Frontend: ${GREEN}Healthy (${frontend_status})${NC}"
    else
        echo -e "   🎨 Frontend: ${RED}Unhealthy (${frontend_status})${NC}"
    fi
    
    # ML service health
    ml_status=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:8000/health 2>/dev/null || echo "000")
    if [ "$ml_status" = "200" ]; then
        echo -e "   🤖 ML Service: ${GREEN}Healthy (${ml_status})${NC}"
    else
        echo -e "   🤖 ML Service: ${RED}Unhealthy (${ml_status})${NC}"
    fi
}

# Function to monitor process status
monitor_processes() {
    echo -e "${CYAN}[$(timestamp)] 🔄 PROCESS MONITORING${NC}"
    
    # Check for Node.js processes
    node_processes=$(ps aux | grep -E 'node.*(react-scripts|nest|start)' | grep -v grep | wc -l)
    echo -e "   📦 Node.js processes: ${node_processes}"
    
    # Check for Python processes
    python_processes=$(ps aux | grep -E 'python.*ml_service' | grep -v grep | wc -l)
    echo -e "   🐍 Python processes: ${python_processes}"
    
    # Check for npm processes
    npm_processes=$(ps aux | grep -E 'npm.*(start|run)' | grep -v grep | wc -l)
    echo -e "   📦 NPM processes: ${npm_processes}"
}

# Function to monitor port usage
monitor_ports() {
    echo -e "${CYAN}[$(timestamp)] 🔌 PORT MONITORING${NC}"
    
    # Port 3000 (Backend)
    if lsof -i :3000 >/dev/null 2>&1; then
        echo -e "   🔧 Port 3000: ${GREEN}In Use${NC}"
    else
        echo -e "   🔧 Port 3000: ${RED}Not In Use${NC}"
    fi
    
    # Port 3001 (Frontend)
    if lsof -i :3001 >/dev/null 2>&1; then
        echo -e "   🎨 Port 3001: ${GREEN}In Use${NC}"
    else
        echo -e "   🎨 Port 3001: ${RED}Not In Use${NC}"
    fi
    
    # Port 8000 (ML Service)
    if lsof -i :8000 >/dev/null 2>&1; then
        echo -e "   🤖 Port 8000: ${GREEN}In Use${NC}"
    else
        echo -e "   🤖 Port 8000: ${RED}Not In Use${NC}"
    fi
}

# Function to provide intelligent recommendations
intelligent_recommendations() {
    echo -e "${CYAN}[$(timestamp)] 🧠 INTELLIGENT RECOMMENDATIONS${NC}"
    
    # Check if all services are healthy
    backend_ok=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:3000/api/games/settings/user/demo-user 2>/dev/null || echo "000")
    frontend_ok=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:3001 2>/dev/null || echo "000")
    ml_ok=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:8000/health 2>/dev/null || echo "000")
    
    if [ "$backend_ok" = "200" ] && [ "$frontend_ok" = "200" ] && [ "$ml_ok" = "200" ]; then
        echo -e "   ${GREEN}✅ All systems operational! Ready to play!${NC}"
        echo -e "   🎮 Open: http://localhost:3001"
    else
        echo -e "   ${YELLOW}⚠️  Some services may need attention${NC}"
        if [ "$backend_ok" != "200" ]; then
            echo -e "   🔧 Backend service needs restart"
        fi
        if [ "$frontend_ok" != "200" ]; then
            echo -e "   🎨 Frontend service needs restart"
        fi
        if [ "$ml_ok" != "200" ]; then
            echo -e "   🤖 ML service needs restart"
        fi
        echo -e "   💡 Try: npm run restart:turbo:build:enhanced:force:clean"
    fi
}

# Main monitoring loop
echo -e "${PURPLE}🎮 CONNECT FOUR AI - ADVANCED SYSTEM MONITOR${NC}"
echo -e "${PURPLE}===============================================${NC}"
echo ""

# Run monitoring once
monitor_system
echo ""
monitor_services
echo ""
monitor_processes
echo ""
monitor_ports
echo ""
intelligent_recommendations
echo ""

echo -e "${CYAN}📊 Monitoring complete. Run again for real-time updates.${NC}" 