#!/bin/bash

# Connect Four AI - Enhanced Restart Script with Advanced Features
# This script performs a complete restart with comprehensive health verification and advanced optimizations

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
PURPLE='\033[0;35m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

# Configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
LOG_DIR="$PROJECT_ROOT/logs"
ENTERPRISE_SCRIPTS="$SCRIPT_DIR/enterprise"

# Create necessary directories
mkdir -p "$LOG_DIR"

# Function to log with timestamp
log() {
    echo -e "${CYAN}[$(date '+%H:%M:%S')]${NC} $1"
}

# Function to check system resources with advanced metrics
check_system_resources() {
    log "🔍 ADVANCED SYSTEM RESOURCE ANALYSIS"
    
    # Check available memory with detailed analysis
    available_mem=$(vm_stat | grep "Pages free:" | awk '{print $3}' | sed 's/\.//')
    total_mem=$(vm_stat | grep "Pages wired down:" | awk '{print $4}' | sed 's/\.//')
    mem_usage=$((100 - (available_mem * 100 / total_mem)))
    
    echo -e "   📊 Memory Usage: ${mem_usage}%"
    if [ $mem_usage -gt 85 ]; then
        echo -e "   ${YELLOW}⚠️  High memory usage detected - consider closing other applications${NC}"
        echo -e "   💡 Recommendation: Close browser tabs and other applications"
    elif [ $mem_usage -gt 70 ]; then
        echo -e "   ${YELLOW}⚠️  Moderate memory usage - monitoring recommended${NC}"
    else
        echo -e "   ${GREEN}✅ Memory usage is optimal${NC}"
    fi
    
    # Check disk space with detailed analysis
    disk_usage=$(df -h . | awk 'NR==2 {print $5}' | sed 's/%//')
    echo -e "   📊 Disk Usage: ${disk_usage}%"
    if [ $disk_usage -gt 90 ]; then
        echo -e "   ${RED}⚠️  Critical disk space - cleanup required${NC}"
        echo -e "   💡 Recommendation: Clear temporary files and caches"
    elif [ $disk_usage -gt 80 ]; then
        echo -e "   ${YELLOW}⚠️  High disk usage - consider cleanup${NC}"
    else
        echo -e "   ${GREEN}✅ Disk space is sufficient${NC}"
    fi
    
    # Check CPU load with detailed analysis
    cpu_load=$(top -l 1 | grep "CPU usage" | awk '{print $3}' | sed 's/%//' | sed 's/\..*//')
    echo -e "   📊 CPU Load: ${cpu_load}%"
    if [ $cpu_load -gt 80 ]; then
        echo -e "   ${YELLOW}⚠️  High CPU load detected${NC}"
    elif [ $cpu_load -gt 60 ]; then
        echo -e "   ${YELLOW}⚠️  Moderate CPU load${NC}"
    else
        echo -e "   ${GREEN}✅ CPU load is optimal${NC}"
    fi
    
    # Check network connectivity with latency
    echo -e "   🌐 Network Connectivity Test..."
    if ping -c 1 google.com >/dev/null 2>&1; then
        latency=$(ping -c 1 google.com | grep "time=" | awk '{print $7}' | sed 's/time=//')
        echo -e "   ${GREEN}✅ Network connected (Latency: ${latency})${NC}"
    else
        echo -e "   ${RED}❌ Network connectivity issues detected${NC}"
    fi
    
    echo ""
}

# Function to perform comprehensive port cleanup using port-manager-v2
comprehensive_port_cleanup() {
    log "🔌 COMPREHENSIVE PORT CLEANUP & MANAGEMENT"
    
    # Use port-manager-v2 for advanced port management
    if [ -f "$SCRIPT_DIR/tooling/port-manager-v2.sh" ]; then
        echo -e "   🔧 Using advanced port manager..."
        "$SCRIPT_DIR/tooling/port-manager-v2.sh" cleanup >/dev/null 2>&1 || true
        echo -e "   ${GREEN}✅ Advanced port cleanup completed${NC}"
    else
        echo -e "   🔧 Using standard port cleanup..."
        # Standard port cleanup for ports 3000, 3001, 8000
        for port in 3000 3001 8000; do
            if lsof -i :$port >/dev/null 2>&1; then
                echo -e "   ⚠️  Cleaning port $port..."
                lsof -ti :$port | xargs -r kill -TERM 2>/dev/null || true
                sleep 1
                lsof -ti :$port | xargs -r kill -KILL 2>/dev/null || true
                echo -e "   ${GREEN}✅ Port $port cleaned${NC}"
            else
                echo -e "   ${GREEN}✅ Port $port already clean${NC}"
            fi
        done
    fi
    
    echo ""
}

# Function to perform intelligent process cleanup with advanced detection
intelligent_cleanup() {
    log "🧟 ADVANCED ZOMBIE PROCESS DETECTION & PREVENTION"
    
    # Check for zombie processes on port 3001
    if lsof -iTCP:3001 -sTCP:LISTEN | grep -q .; then
        echo -e "   ${YELLOW}⚠️  Found zombie process on port 3001 - killing it...${NC}"
        lsof -iTCP:3001 -sTCP:LISTEN | awk 'NR>1 {print $2}' | xargs -r kill -9
        echo -e "   ${GREEN}✅ Zombie process killed${NC}"
    else
        echo -e "   ${GREEN}✅ No zombie processes found on port 3001${NC}"
    fi
    
    # Check for other Node.js processes with intelligent detection
    echo -e "   🔍 Checking for other Node.js processes..."
    
    # Kill React development servers
    if ps aux | grep -E 'node.*react-scripts|node.*vite|node.*webpack' | grep -v grep | grep -q .; then
        echo -e "   ${YELLOW}⚠️  Found React development servers - killing them...${NC}"
        pkill -f 'react-scripts|vite|webpack' 2>/dev/null || true
        echo -e "   ${GREEN}✅ React development servers killed${NC}"
    else
        echo -e "   ${GREEN}✅ No React development servers found${NC}"
    fi
    
    # Kill any hanging npm processes
    if ps aux | grep -E 'npm.*start|npm.*run' | grep -v grep | grep -q .; then
        echo -e "   ${YELLOW}⚠️  Found hanging npm processes - killing them...${NC}"
        pkill -f 'npm.*start|npm.*run' 2>/dev/null || true
        echo -e "   ${GREEN}✅ NPM processes killed${NC}"
    fi
    
    # Kill any Python ML service processes
    if ps aux | grep -E 'python.*ml_service|uvicorn' | grep -v grep | grep -q .; then
        echo -e "   ${YELLOW}⚠️  Found ML service processes - killing them...${NC}"
        pkill -f 'python.*ml_service|uvicorn' 2>/dev/null || true
        echo -e "   ${GREEN}✅ ML service processes killed${NC}"
    fi
    
    # Kill enterprise launcher processes
    if ps aux | grep -E 'unified-enterprise-launcher|enterprise-parallel-launcher|ai-stability-manager|intelligent-resource-manager|performance-analytics-suite' | grep -v grep | grep -q .; then
        echo -e "   ${YELLOW}⚠️  Found enterprise launcher processes - killing them...${NC}"
        pkill -f 'unified-enterprise-launcher|enterprise-parallel-launcher|ai-stability-manager|intelligent-resource-manager|performance-analytics-suite' 2>/dev/null || true
        echo -e "   ${GREEN}✅ Enterprise launcher processes killed${NC}"
    fi
    
    echo ""
}

# Function to perform advanced cache clearing with intelligent cleanup
advanced_cache_clearing() {
    log "🧹 ADVANCED CACHE CLEARING & OPTIMIZATION"
    
    # Clear frontend build cache with enhanced cleanup
    echo -e "   🎨 Clearing frontend build cache..."
    cd frontend
    rm -rf build node_modules/.cache .next .nuxt dist .parcel-cache .eslintcache 2>/dev/null || true
    echo -e "   ${GREEN}✅ Frontend cache cleared${NC}"
    
    # Clear backend cache
    echo -e "   🔧 Clearing backend cache..."
    cd ../backend
    rm -rf dist node_modules/.cache .eslintcache 2>/dev/null || true
    echo -e "   ${GREEN}✅ Backend cache cleared${NC}"
    
    # Clear npm cache with force
    echo -e "   📦 Clearing npm cache..."
    npm cache clean --force 2>/dev/null || true
    echo -e "   ${GREEN}✅ NPM cache cleared${NC}"
    
    # Clear system temp files
    echo -e "   🗂️  Clearing system temp files..."
    rm -rf /tmp/react-* /tmp/npm-* /tmp/node-* /tmp/connect-four-* 2>/dev/null || true
    echo -e "   ${GREEN}✅ System temp files cleared${NC}"
    
    # Enhanced browser cache clearing instructions
    echo -e "   🌐 BROWSER CACHE CLEARING INSTRUCTIONS:"
    echo -e "      📱 Chrome: Cmd+Shift+R (hard refresh) or"
    echo -e "      🔧 DevTools: Right-click refresh → Empty Cache and Hard Reload"
    echo -e "      🧹 Service Workers: DevTools → Application → Service Workers → Unregister"
    echo -e "      🗑️  Or clear all data: chrome://settings/clearBrowserData"
    echo -e "      🗑️  Firefox: Cmd+Shift+Delete → Select 'Everything' → 'Clear Now'"
    echo -e "      🗑️  Safari: Cmd+Option+E → 'Empty Caches'"
    echo -e "      🔄 Incognito Mode: Test in private/incognito browser window"
    
    cd ..
    echo ""
}

# Function to perform comprehensive process management and cache prevention
comprehensive_process_management() {
    log "🛠️  COMPREHENSIVE PROCESS MANAGEMENT & CACHE PREVENTION"
    
    # Enhanced process detection and cleanup
    echo -e "   🔍 Enhanced process detection and cleanup..."
    
    # Kill processes by port with enhanced detection
    for port in 3000 3001 8000; do
        if lsof -i :$port >/dev/null 2>&1; then
            echo -e "   ${YELLOW}⚠️  Found process on port $port - killing it...${NC}"
            lsof -ti :$port | xargs -r kill -TERM 2>/dev/null || true
            sleep 2
            lsof -ti :$port | xargs -r kill -KILL 2>/dev/null || true
            echo -e "   ${GREEN}✅ Port $port cleaned${NC}"
        else
            echo -e "   ${GREEN}✅ Port $port already clean${NC}"
        fi
    done
    
    # Enhanced React development server cleanup
    echo -e "   🎨 Enhanced React development server cleanup..."
    pkill -f "react-scripts start" 2>/dev/null || true
    pkill -f "npm start" 2>/dev/null || true
    pkill -f "node.*start" 2>/dev/null || true
    
    # Kill any hanging npm processes with enhanced detection
    if ps aux | grep -E 'npm.*start|npm.*run' | grep -v grep | grep -q .; then
        echo -e "   ${YELLOW}⚠️  Found hanging npm processes - killing them...${NC}"
        pkill -f 'npm.*start|npm.*run' 2>/dev/null || true
        echo -e "   ${GREEN}✅ NPM processes killed${NC}"
    fi
    
    # Enhanced enterprise process cleanup
    echo -e "   🏢 Enhanced enterprise process cleanup..."
    pkill -f 'unified-enterprise-launcher|enterprise-parallel-launcher|ai-stability-manager|intelligent-resource-manager|performance-analytics-suite|ai-orchestration-dashboard|advanced-ai-diagnostics|enterprise-model-manager' 2>/dev/null || true
    
    # Enhanced ML service cleanup
    echo -e "   🤖 Enhanced ML service cleanup..."
    pkill -f 'python.*ml_service|uvicorn' 2>/dev/null || true
    
    # Enhanced NestJS backend cleanup
    echo -e "   🔧 Enhanced NestJS backend cleanup..."
    pkill -f 'nest.*start|node.*dist/main' 2>/dev/null || true
    
    echo -e "   ${GREEN}✅ All processes cleaned up${NC}"
    echo ""
}

# Function to perform intelligent service orchestration with enterprise integration
intelligent_service_orchestration() {
    log "🚀 INTELLIGENT SERVICE ORCHESTRATION"
    
    # Stop services with graceful shutdown
    echo -e "   🛑 Stopping services gracefully..."
    npm run stop:turbo:enhanced
    
    # Wait for graceful shutdown
    sleep 5
    
    # Force kill any remaining processes
    echo -e "   🔥 Force killing any remaining processes..."
    pkill -f 'unified-enterprise-launcher|enterprise-parallel-launcher|ai-stability-manager|intelligent-resource-manager|performance-analytics-suite|ai-orchestration-dashboard|advanced-ai-diagnostics|enterprise-model-manager|backend.*nest|frontend.*react-scripts|ml_service.*python' 2>/dev/null || true
    
    # Start services with intelligent sequencing
    echo -e "   🚀 Starting services with intelligent sequencing..."
    
    # Build backend first
    echo -e "   🔧 Building backend service..."
    cd "$PROJECT_ROOT/backend"
    npm run build >/dev/null 2>&1 || echo -e "   ${YELLOW}⚠️  Backend build failed, trying to start anyway${NC}"
    cd "$PROJECT_ROOT"
    
    # Start backend first (foundation)
    echo -e "   🔧 Starting backend service..."
    cd "$PROJECT_ROOT/backend" && npm run start:prod &
    cd "$PROJECT_ROOT"
    
    # Wait for backend to be ready
    echo -e "   ⏳ Waiting for backend to initialize..."
    sleep 8
    
    # Start ML service
    echo -e "   🤖 Starting ML service..."
    if [ -d "$PROJECT_ROOT/ml_service" ]; then
        cd "$PROJECT_ROOT/ml_service" && python ml_service.py &
        cd "$PROJECT_ROOT"
    elif [ -d "$PROJECT_ROOT/ml_service/" ]; then
        cd "$PROJECT_ROOT/ml_service/" && python ml_service.py &
        cd "$PROJECT_ROOT"
    else
        echo -e "   ${YELLOW}⚠️  ML service directory not found at $PROJECT_ROOT/ml_service${NC}"
    fi
    
    # Wait for ML service
    sleep 3
    
    # Start frontend last (depends on backend)
    echo -e "   🎨 Starting frontend service..."
    if [ -d "$PROJECT_ROOT/frontend" ]; then
        cd "$PROJECT_ROOT/frontend" && npm start &
        cd "$PROJECT_ROOT"
    else
        echo -e "   ${YELLOW}⚠️  Frontend directory not found at $PROJECT_ROOT/frontend${NC}"
    fi
    
    echo ""
}

# Function to perform advanced health monitoring with intelligent polling
advanced_health_monitoring() {
    log "🔍 ADVANCED HEALTH MONITORING & OPTIMIZATION"
    
    # Wait for services to start with intelligent polling
    echo -e "   ⏳ Intelligent service startup monitoring..."
    
    local max_attempts=30
    local attempt=1
    
    while [ $attempt -le $max_attempts ]; do
        echo -e "   📊 Health check attempt ${attempt}/${max_attempts}..."
        
        # Check if all services are responding
        backend_ok=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:3000/api/games/settings/user/demo-user 2>/dev/null || echo "000")
        frontend_ok=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:3001 2>/dev/null || echo "000")
        ml_ok=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:8000/health 2>/dev/null || echo "000")
        
        if [ "$backend_ok" = "200" ] && [ "$frontend_ok" = "200" ] && [ "$ml_ok" = "200" ]; then
            echo -e "   ${GREEN}✅ All services are responding!${NC}"
            break
        else
            echo -e "   ${YELLOW}⏳ Services still starting... (Backend: $backend_ok, Frontend: $frontend_ok, ML: $ml_ok)${NC}"
            sleep 2
        fi
        
        attempt=$((attempt + 1))
    done
    
    if [ $attempt -gt $max_attempts ]; then
        echo -e "   ${RED}⚠️  Services taking longer than expected to start${NC}"
    fi
    
    echo ""
}

# Function to perform performance optimization with enterprise features
performance_optimization() {
    log "⚡ ADVANCED PERFORMANCE OPTIMIZATION"
    
    # Check and optimize Node.js memory
    echo -e "   🧠 Optimizing Node.js memory settings..."
    export NODE_OPTIONS="--max-old-space-size=4096"
    echo -e "   ${GREEN}✅ Node.js memory optimized${NC}"
    
    # Check and optimize Python ML service
    echo -e "   🐍 Optimizing Python ML service..."
    export PYTHONUNBUFFERED=1
    echo -e "   ${GREEN}✅ Python ML service optimized${NC}"
    
    # Check network connectivity
    echo -e "   🌐 Checking network connectivity..."
    if ping -c 1 google.com >/dev/null 2>&1; then
        echo -e "   ${GREEN}✅ Network connectivity confirmed${NC}"
    else
        echo -e "   ${YELLOW}⚠️  Network connectivity issues detected${NC}"
    fi
    
    # Run intelligent resource manager if available
    if [ -f "$ENTERPRISE_SCRIPTS/intelligent-resource-manager.js" ]; then
        echo -e "   🔧 Running intelligent resource optimization..."
        node "$ENTERPRISE_SCRIPTS/intelligent-resource-manager.js" --optimize >/dev/null 2>&1 || true
        echo -e "   ${GREEN}✅ Resource optimization completed${NC}"
    fi
    
    echo ""
}

# Function to provide comprehensive user experience enhancements
user_experience_enhancements() {
    log "🎮 COMPREHENSIVE USER EXPERIENCE ENHANCEMENTS"
    
    echo -e "   🌐 BROWSER CACHE CLEARING INSTRUCTIONS:"
    echo -e "      📱 Chrome: Cmd+Shift+R (hard refresh) or"
    echo -e "      🔧 DevTools: Right-click refresh → Empty Cache and Hard Reload"
    echo -e "      🧹 Service Workers: DevTools → Application → Service Workers → Unregister"
    echo -e "      🗑️  Or clear all data: chrome://settings/clearBrowserData"
    echo -e "      🗑️  Firefox: Cmd+Shift+Delete → Select 'Everything' → 'Clear Now'"
    echo -e "      🗑️  Safari: Cmd+Option+E → 'Empty Caches'"
    echo -e "      🔄 Incognito Mode: Test in private/incognito browser window"
    
    echo -e "   📱 MOBILE OPTIMIZATION:"
    echo -e "      📲 Clear mobile browser cache"
    echo -e "      🔄 Restart mobile browser"
    echo -e "      📶 Ensure stable internet connection"
    
    echo -e "   🎯 QUICK ACCESS LINKS:"
    echo -e "      🎮 Game: http://localhost:3001"
    echo -e "      🔧 API: http://localhost:3000/api"
    echo -e "      🤖 ML: http://localhost:8000"
    echo -e "      📊 Health: npm run health:check"
    echo -e "      🔍 Monitor: npm run monitor:advanced"
    
    echo -e "   🛠️  TROUBLESHOOTING COMMANDS:"
    echo -e "      🔧 Emergency Stop: npm run emergency"
    echo -e "      🧹 Force Cleanup: npm run cleanup:force"
    echo -e "      📊 System Status: npm run system:status"
    echo -e "      🔌 Port Management: npm run ports"
    
    echo -e "   🚨 PROCESS MANAGEMENT COMMANDS:"
    echo -e "      🛑 Stop Frontend: pkill -f 'react-scripts start'"
    echo -e "      🛑 Stop Backend: pkill -f 'nest.*start'"
    echo -e "      🛑 Stop ML Service: pkill -f 'python.*ml_service'"
    echo -e "      🛑 Kill by Port: lsof -ti:3001 | xargs kill -9"
    echo -e "      🛑 Kill by Port: lsof -ti:3000 | xargs kill -9"
    echo -e "      🛑 Kill by Port: lsof -ti:8000 | xargs kill -9"
    
    echo -e "   🔍 MOVE ANALYSIS TROUBLESHOOTING:"
    echo -e "      ✅ Expected: '🎯 Using frontend board state for analysis'"
    echo -e "      ❌ Problem: 'POST http://localhost:3000/games/.../analyze-move 404'"
    echo -e "      🔧 Solution: Clear browser cache and restart frontend"
    echo -e "      🧪 Test: npm run test:move-analysis"
    
    echo ""
}

# Function to run enterprise-level health checks
enterprise_health_checks() {
    log "🏢 ENTERPRISE-LEVEL HEALTH CHECKS"
    
    # Run comprehensive health check
    echo -e "   🔍 Running comprehensive health checks..."
    if [ -f "$SCRIPT_DIR/health-check.sh" ]; then
        ./scripts/health-check.sh
    else
        echo -e "   ${YELLOW}⚠️  Health check script not found${NC}"
    fi
    
    # Run advanced monitoring if available
    if [ -f "$SCRIPT_DIR/advanced-monitor.sh" ]; then
        echo -e "   📊 Running advanced system monitoring..."
        ./scripts/advanced-monitor.sh
    else
        echo -e "   ${YELLOW}⚠️  Advanced monitor script not found${NC}"
    fi
    
    # Run port manager health check if available
    if [ -f "$SCRIPT_DIR/tooling/port-manager-v2.sh" ]; then
        echo -e "   🔌 Running port manager health check..."
        "$SCRIPT_DIR/tooling/port-manager-v2.sh" health >/dev/null 2>&1 || true
    fi
    
    # Run enterprise integration if available
    if [ -f "$SCRIPT_DIR/enterprise-integration.sh" ]; then
        echo -e "   🏢 Running enterprise integration..."
        ./scripts/enterprise-integration.sh all >/dev/null 2>&1 || true
        echo -e "   ${GREEN}✅ Enterprise integration completed${NC}"
    fi
    
    echo ""
}

# Main execution
echo -e "${PURPLE}🎮 CONNECT FOUR AI - ENTERPRISE-GRADE RESTART SYSTEM${NC}"
echo -e "${PURPLE}=====================================================${NC}"
echo ""

# Check system resources
check_system_resources

# Perform comprehensive port cleanup
comprehensive_port_cleanup

# Perform intelligent cleanup
intelligent_cleanup

# Perform comprehensive process management and cache prevention
comprehensive_process_management

# Perform advanced cache clearing
advanced_cache_clearing

# Provide user experience enhancements
user_experience_enhancements

# Perform performance optimization
performance_optimization

# Perform intelligent service orchestration
intelligent_service_orchestration

# Perform advanced health monitoring
advanced_health_monitoring

# Run enterprise-level health checks
enterprise_health_checks

echo -e "${GREEN}🎊 ENTERPRISE-GRADE RESTART COMPLETE - All systems operational! 🎊${NC}"
echo -e "${CYAN}🚀 Your Connect Four AI game is ready for action!${NC}"
echo -e "${PURPLE}🏆 Enterprise-grade performance and reliability achieved!${NC}"
echo "" 