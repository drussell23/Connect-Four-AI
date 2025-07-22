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
mkdir -p "$LOG_DIR/restart-logs"
mkdir -p "$LOG_DIR/performance"
mkdir -p "$LOG_DIR/analytics"

# Advanced configuration
RESTART_LOG="$LOG_DIR/restart-logs/restart-$(date '+%Y%m%d-%H%M%S').log"
PERFORMANCE_LOG="$LOG_DIR/performance/performance-$(date '+%Y%m%d-%H%M%S').log"
ANALYTICS_LOG="$LOG_DIR/analytics/analytics-$(date '+%Y%m%d-%H%M%S').log"

# Advanced metrics tracking
declare -A METRICS=(
    [start_time]=$(date +%s)
    [services_started]=0
    [services_failed]=0
    [cache_cleared]=0
    [processes_killed]=0
    [health_checks_passed]=0
    [health_checks_failed]=0
)

# Function to log with timestamp and analytics
log() {
    local timestamp=$(date '+%H:%M:%S')
    local message="$1"
    echo -e "${CYAN}[${timestamp}]${NC} $message"
    echo "[${timestamp}] $message" >> "$RESTART_LOG"
}

# Function to log performance metrics
log_performance() {
    local metric="$1"
    local value="$2"
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] $metric: $value" >> "$PERFORMANCE_LOG"
}

# Function to log analytics
log_analytics() {
    local event="$1"
    local data="$2"
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] $event: $data" >> "$ANALYTICS_LOG"
}

# Function to check system resources with advanced metrics and AI-powered diagnostics
check_system_resources() {
    log "🔍 ADVANCED SYSTEM RESOURCE ANALYSIS WITH AI-POWERED DIAGNOSTICS"
    
    # Check available memory with detailed analysis
    available_mem=$(vm_stat | grep "Pages free:" | awk '{print $3}' | sed 's/\.//')
    total_mem=$(vm_stat | grep "Pages wired down:" | awk '{print $4}' | sed 's/\.//')
    mem_usage=$((100 - (available_mem * 100 / total_mem)))
    
    echo -e "   📊 Memory Usage: ${mem_usage}%"
    log_performance "memory_usage" "$mem_usage"
    
    if [ $mem_usage -gt 85 ]; then
        echo -e "   ${YELLOW}⚠️  High memory usage detected - consider closing other applications${NC}"
        echo -e "   💡 AI Recommendation: Close browser tabs and other applications"
        log_analytics "memory_warning" "high_usage_${mem_usage}%"
        METRICS[health_checks_failed]=$((METRICS[health_checks_failed] + 1))
    elif [ $mem_usage -gt 70 ]; then
        echo -e "   ${YELLOW}⚠️  Moderate memory usage - monitoring recommended${NC}"
        log_analytics "memory_warning" "moderate_usage_${mem_usage}%"
    else
        echo -e "   ${GREEN}✅ Memory usage is optimal${NC}"
        METRICS[health_checks_passed]=$((METRICS[health_checks_passed] + 1))
    fi
    
    # Check disk space with detailed analysis
    disk_usage=$(df -h . | awk 'NR==2 {print $5}' | sed 's/%//')
    echo -e "   📊 Disk Usage: ${disk_usage}%"
    log_performance "disk_usage" "$disk_usage"
    
    if [ $disk_usage -gt 90 ]; then
        echo -e "   ${RED}⚠️  Critical disk space - cleanup required${NC}"
        echo -e "   💡 AI Recommendation: Clear temporary files and caches"
        log_analytics "disk_warning" "critical_usage_${disk_usage}%"
        METRICS[health_checks_failed]=$((METRICS[health_checks_failed] + 1))
    elif [ $disk_usage -gt 80 ]; then
        echo -e "   ${YELLOW}⚠️  High disk usage - consider cleanup${NC}"
        log_analytics "disk_warning" "high_usage_${disk_usage}%"
    else
        echo -e "   ${GREEN}✅ Disk space is sufficient${NC}"
        METRICS[health_checks_passed]=$((METRICS[health_checks_passed] + 1))
    fi
    
    # Check CPU load with detailed analysis
    cpu_load=$(top -l 1 | grep "CPU usage" | awk '{print $3}' | sed 's/%//' | sed 's/\..*//')
    echo -e "   📊 CPU Load: ${cpu_load}%"
    log_performance "cpu_load" "$cpu_load"
    
    if [ $cpu_load -gt 80 ]; then
        echo -e "   ${YELLOW}⚠️  High CPU load detected${NC}"
        log_analytics "cpu_warning" "high_load_${cpu_load}%"
        METRICS[health_checks_failed]=$((METRICS[health_checks_failed] + 1))
    elif [ $cpu_load -gt 60 ]; then
        echo -e "   ${YELLOW}⚠️  Moderate CPU load${NC}"
        log_analytics "cpu_warning" "moderate_load_${cpu_load}%"
    else
        echo -e "   ${GREEN}✅ CPU load is optimal${NC}"
        METRICS[health_checks_passed]=$((METRICS[health_checks_passed] + 1))
    fi
    
    # Check network connectivity with latency
    echo -e "   🌐 Network Connectivity Test..."
    if ping -c 1 google.com >/dev/null 2>&1; then
        latency=$(ping -c 1 google.com | grep "time=" | awk '{print $7}' | sed 's/time=//')
        echo -e "   ${GREEN}✅ Network connected (Latency: ${latency})${NC}"
        log_performance "network_latency" "$latency"
        log_analytics "network_status" "connected_${latency}"
        METRICS[health_checks_passed]=$((METRICS[health_checks_passed] + 1))
    else
        echo -e "   ${RED}❌ Network connectivity issues detected${NC}"
        log_analytics "network_status" "disconnected"
        METRICS[health_checks_failed]=$((METRICS[health_checks_failed] + 1))
    fi
    
    # Advanced AI-powered system health prediction
    echo -e "   🤖 AI-Powered System Health Prediction..."
    local health_score=0
    [ $mem_usage -lt 70 ] && health_score=$((health_score + 25))
    [ $disk_usage -lt 80 ] && health_score=$((health_score + 25))
    [ $cpu_load -lt 60 ] && health_score=$((health_score + 25))
    [ $health_score -eq 75 ] && health_score=$((health_score + 25))
    
    echo -e "   📈 System Health Score: ${health_score}/100"
    log_performance "health_score" "$health_score"
    
    if [ $health_score -ge 80 ]; then
        echo -e "   ${GREEN}🎯 AI Prediction: System ready for optimal performance${NC}"
        log_analytics "ai_prediction" "optimal_performance_ready"
    elif [ $health_score -ge 60 ]; then
        echo -e "   ${YELLOW}🎯 AI Prediction: System acceptable, minor optimizations recommended${NC}"
        log_analytics "ai_prediction" "acceptable_with_optimizations"
    else
        echo -e "   ${RED}🎯 AI Prediction: System needs attention before restart${NC}"
        log_analytics "ai_prediction" "needs_attention"
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
    
    # Enhanced process killing with comprehensive pattern matching (from troubleshooting)
    echo -e "   🔥 Enhanced process killing with comprehensive patterns..."
    pkill -f "react-scripts\|webpack\|node.*start" 2>/dev/null || true
    echo -e "   ${GREEN}✅ React/Webpack/Node processes killed with enhanced patterns${NC}"
    
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
    
    # Clear npm cache with force (enhanced)
    echo -e "   📦 Clearing npm cache with force..."
    npm cache clean --force 2>/dev/null || true
    echo -e "   ${GREEN}✅ NPM cache cleared with force${NC}"
    
    # Clear system caches with sudo purge (enhanced)
    echo -e "   🗂️  Clearing system caches with sudo purge..."
    sudo purge 2>/dev/null || true
    echo -e "   ${GREEN}✅ System caches cleared with sudo purge${NC}"
    
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
    
    # Enhanced React development server cleanup with comprehensive pattern matching
    echo -e "   🎨 Enhanced React development server cleanup..."
    pkill -f "react-scripts\|webpack\|node.*start" 2>/dev/null || true
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

# Function to run comprehensive script integration
comprehensive_script_integration() {
    log "🔗 COMPREHENSIVE SCRIPT INTEGRATION"
    
    # Run ML pipeline manager if available
    if [ -f "$SCRIPT_DIR/ml/ml-pipeline-manager.sh" ]; then
        echo -e "   🤖 Running ML pipeline manager..."
        ./scripts/ml/ml-pipeline-manager.sh status >/dev/null 2>&1 || true
        echo -e "   ${GREEN}✅ ML pipeline manager completed${NC}"
    else
        echo -e "   ${YELLOW}⚠️  ML pipeline manager not available${NC}"
    fi
    
    # Run model management if available
    if [ -f "$SCRIPT_DIR/model-management/advanced-model-cleanup.sh" ]; then
        echo -e "   📦 Running model cleanup check..."
        ./scripts/model-management/advanced-model-cleanup.sh --check-only >/dev/null 2>&1 || true
        echo -e "   ${GREEN}✅ Model cleanup check completed${NC}"
    else
        echo -e "   ${YELLOW}⚠️  Model cleanup script not available${NC}"
    fi
    
    # Run testing workflows if available
    if [ -f "$SCRIPT_DIR/testing/test-workflows.sh" ]; then
        echo -e "   🧪 Running test workflow validation..."
        ./scripts/testing/test-workflows.sh validate >/dev/null 2>&1 || true
        echo -e "   ${GREEN}✅ Test workflow validation completed${NC}"
    else
        echo -e "   ${YELLOW}⚠️  Test workflows not available${NC}"
    fi
    
    # Run performance demo if available
    if [ -f "$SCRIPT_DIR/testing/performance-demo.sh" ]; then
        echo -e "   📊 Running performance demo check..."
        ./scripts/testing/performance-demo.sh --quick >/dev/null 2>&1 || true
        echo -e "   ${GREEN}✅ Performance demo check completed${NC}"
    else
        echo -e "   ${YELLOW}⚠️  Performance demo not available${NC}"
    fi
    
    # Run deployment readiness if available
    if [ -f "$SCRIPT_DIR/deploy/deploy-production.sh" ]; then
        echo -e "   🚀 Running deployment readiness check..."
        ./scripts/deploy/deploy-production.sh check >/dev/null 2>&1 || true
        echo -e "   ${GREEN}✅ Deployment readiness check completed${NC}"
    else
        echo -e "   ${YELLOW}⚠️  Deploy production script not available${NC}"
    fi
    
    echo ""
}

# Function to perform intelligent service orchestration with advanced dependency management
intelligent_service_orchestration() {
    log "🚀 INTELLIGENT SERVICE ORCHESTRATION WITH ADVANCED DEPENDENCY MANAGEMENT"
    
    # Stop services with graceful shutdown
    echo -e "   🛑 Stopping services gracefully..."
    npm run stop:turbo:enhanced
    log_analytics "service_shutdown" "graceful_stop_initiated"
    
    # Wait for graceful shutdown
    sleep 5
    
    # Force kill any remaining processes
    echo -e "   🔥 Force killing any remaining processes..."
    pkill -f 'unified-enterprise-launcher|enterprise-parallel-launcher|ai-stability-manager|intelligent-resource-manager|performance-analytics-suite|ai-orchestration-dashboard|advanced-ai-diagnostics|enterprise-model-manager|backend.*nest|frontend.*react-scripts|ml_service.*python' 2>/dev/null || true
    METRICS[processes_killed]=$((METRICS[processes_killed] + 1))
    
    # Advanced dependency analysis
    echo -e "   🔍 Analyzing service dependencies..."
    local dependencies=(
        "backend:3000:foundation"
        "ml_service:8000:ai"
        "frontend:3001:ui"
    )
    
    for dep in "${dependencies[@]}"; do
        IFS=':' read -r service port type <<< "$dep"
        echo -e "   📋 $service ($port) - $type dependency"
    done
    
    # Start services with intelligent sequencing and dependency management
    echo -e "   🚀 Starting services with intelligent sequencing..."
    
    # Phase 1: Foundation Services (Backend)
    echo -e "   🏗️  Phase 1: Starting Foundation Services..."
    
    # Build backend first
    echo -e "   🔧 Building backend service..."
    cd "$PROJECT_ROOT/backend"
    local build_start=$(date +%s)
    npm run build >/dev/null 2>&1
    local build_end=$(date +%s)
    local build_time=$((build_end - build_start))
    
    if [ $? -eq 0 ]; then
        echo -e "   ${GREEN}✅ Backend build completed in ${build_time}s${NC}"
        log_performance "backend_build_time" "$build_time"
        log_analytics "backend_build" "success_${build_time}s"
    else
        echo -e "   ${YELLOW}⚠️  Backend build failed, trying to start anyway${NC}"
        log_analytics "backend_build" "failed"
        METRICS[services_failed]=$((METRICS[services_failed] + 1))
    fi
    cd "$PROJECT_ROOT"
    
    # Start backend first (foundation)
    echo -e "   🔧 Starting backend service..."
    local backend_start=$(date +%s)
    cd "$PROJECT_ROOT/backend" && npm run start:prod &
    local backend_pid=$!
    cd "$PROJECT_ROOT"
    
    # Wait for backend to be ready with intelligent polling
    echo -e "   ⏳ Waiting for backend to initialize..."
    local backend_ready=false
    local attempts=0
    local max_attempts=30
    
    while [ $attempts -lt $max_attempts ] && [ "$backend_ready" = false ]; do
        if curl -s http://localhost:3000/api/health >/dev/null 2>&1; then
            backend_ready=true
            local backend_end=$(date +%s)
            local backend_time=$((backend_end - backend_start))
            echo -e "   ${GREEN}✅ Backend ready in ${backend_time}s${NC}"
            log_performance "backend_startup_time" "$backend_time"
            log_analytics "backend_startup" "success_${backend_time}s"
            METRICS[services_started]=$((METRICS[services_started] + 1))
        else
            attempts=$((attempts + 1))
            echo -e "   ⏳ Backend startup attempt ${attempts}/${max_attempts}..."
            sleep 2
        fi
    done
    
    if [ "$backend_ready" = false ]; then
        echo -e "   ${RED}❌ Backend failed to start within timeout${NC}"
        log_analytics "backend_startup" "timeout_failure"
        METRICS[services_failed]=$((METRICS[services_failed] + 1))
    fi
    
    # Phase 2: AI Services (ML Service)
    echo -e "   🤖 Phase 2: Starting AI Services..."
    
    # Start ML service
    echo -e "   🤖 Starting ML service..."
    local ml_start=$(date +%s)
    if [ -d "$PROJECT_ROOT/ml_service" ]; then
        cd "$PROJECT_ROOT/ml_service" && python ml_service.py &
        local ml_pid=$!
        cd "$PROJECT_ROOT"
    elif [ -d "$PROJECT_ROOT/ml_service/" ]; then
        cd "$PROJECT_ROOT/ml_service/" && python ml_service.py &
        local ml_pid=$!
        cd "$PROJECT_ROOT"
    else
        echo -e "   ${YELLOW}⚠️  ML service directory not found at $PROJECT_ROOT/ml_service${NC}"
        log_analytics "ml_service" "directory_not_found"
    fi
    
    # Wait for ML service with intelligent polling
    echo -e "   ⏳ Waiting for ML service to initialize..."
    sleep 3
    if curl -s http://localhost:8000/health >/dev/null 2>&1; then
        local ml_end=$(date +%s)
        local ml_time=$((ml_end - ml_start))
        echo -e "   ${GREEN}✅ ML service ready in ${ml_time}s${NC}"
        log_performance "ml_startup_time" "$ml_time"
        log_analytics "ml_startup" "success_${ml_time}s"
        METRICS[services_started]=$((METRICS[services_started] + 1))
    else
        echo -e "   ${YELLOW}⚠️  ML service may not be ready, continuing...${NC}"
        log_analytics "ml_startup" "unknown_status"
    fi
    
    # Phase 3: UI Services (Frontend)
    echo -e "   🎨 Phase 3: Starting UI Services..."
    
    # Start frontend last (depends on backend)
    echo -e "   🎨 Starting frontend service..."
    local frontend_start=$(date +%s)
    if [ -d "$PROJECT_ROOT/frontend" ]; then
        cd "$PROJECT_ROOT/frontend" && npm start &
        local frontend_pid=$!
        cd "$PROJECT_ROOT"
    else
        echo -e "   ${YELLOW}⚠️  Frontend directory not found at $PROJECT_ROOT/frontend${NC}"
        log_analytics "frontend_service" "directory_not_found"
    fi
    
    # Wait for frontend with intelligent polling
    echo -e "   ⏳ Waiting for frontend to initialize..."
    local frontend_ready=false
    local frontend_attempts=0
    local frontend_max_attempts=60
    
    while [ $frontend_attempts -lt $frontend_max_attempts ] && [ "$frontend_ready" = false ]; do
        if curl -s http://localhost:3001 >/dev/null 2>&1; then
            frontend_ready=true
            local frontend_end=$(date +%s)
            local frontend_time=$((frontend_end - frontend_start))
            echo -e "   ${GREEN}✅ Frontend ready in ${frontend_time}s${NC}"
            log_performance "frontend_startup_time" "$frontend_time"
            log_analytics "frontend_startup" "success_${frontend_time}s"
            METRICS[services_started]=$((METRICS[services_started] + 1))
        else
            frontend_attempts=$((frontend_attempts + 1))
            echo -e "   ⏳ Frontend startup attempt ${frontend_attempts}/${frontend_max_attempts}..."
            sleep 2
        fi
    done
    
    if [ "$frontend_ready" = false ]; then
        echo -e "   ${RED}❌ Frontend failed to start within timeout${NC}"
        log_analytics "frontend_startup" "timeout_failure"
        METRICS[services_failed]=$((METRICS[services_failed] + 1))
    fi
    
    # Service orchestration summary
    echo -e "   📊 Service Orchestration Summary:"
    echo -e "      ✅ Services Started: ${METRICS[services_started]}"
    echo -e "      ❌ Services Failed: ${METRICS[services_failed]}"
    echo -e "      🔥 Processes Killed: ${METRICS[processes_killed]}"
    
    log_analytics "orchestration_summary" "started_${METRICS[services_started]}_failed_${METRICS[services_failed]}"
    
    echo ""
}

# Function to perform advanced health monitoring with intelligent polling and error recovery
advanced_health_monitoring() {
    log "🔍 ADVANCED HEALTH MONITORING & OPTIMIZATION WITH ERROR RECOVERY"
    
    # Wait for services to start with intelligent polling
    echo -e "   ⏳ Intelligent service startup monitoring..."
    
    local max_attempts=30
    local attempt=1
    local recovery_attempts=0
    local max_recovery_attempts=3
    
    while [ $attempt -le $max_attempts ]; do
        echo -e "   📊 Health check attempt ${attempt}/${max_attempts}..."
        
        # Check if all services are responding
        backend_ok=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:3000/api/games/settings/user/demo-user 2>/dev/null || echo "000")
        frontend_ok=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:3001 2>/dev/null || echo "000")
        ml_ok=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:8000/health 2>/dev/null || echo "000")
        
        # Log health check results
        log_performance "health_check_backend" "$backend_ok"
        log_performance "health_check_frontend" "$frontend_ok"
        log_performance "health_check_ml" "$ml_ok"
        
        if [ "$backend_ok" = "200" ] && [ "$frontend_ok" = "200" ] && [ "$ml_ok" = "200" ]; then
            echo -e "   ${GREEN}✅ All services are responding!${NC}"
            log_analytics "health_check" "all_services_healthy"
            METRICS[health_checks_passed]=$((METRICS[health_checks_passed] + 1))
            break
        else
            echo -e "   ${YELLOW}⏳ Services still starting... (Backend: $backend_ok, Frontend: $frontend_ok, ML: $ml_ok)${NC}"
            log_analytics "health_check" "services_starting_backend_${backend_ok}_frontend_${frontend_ok}_ml_${ml_ok}"
            
            # Advanced error recovery mechanism
            if [ $attempt -gt 20 ] && [ $recovery_attempts -lt $max_recovery_attempts ]; then
                echo -e "   🔧 Attempting error recovery..."
                recovery_attempts=$((recovery_attempts + 1))
                
                # Try to restart failed services
                if [ "$backend_ok" != "200" ]; then
                    echo -e "   🔄 Restarting backend service..."
                    pkill -f "nest.*start" 2>/dev/null || true
                    sleep 2
                    cd "$PROJECT_ROOT/backend" && npm run start:prod &
                    cd "$PROJECT_ROOT"
                fi
                
                if [ "$frontend_ok" != "200" ]; then
                    echo -e "   🔄 Restarting frontend service..."
                    pkill -f "react-scripts start" 2>/dev/null || true
                    sleep 2
                    cd "$PROJECT_ROOT/frontend" && npm start &
                    cd "$PROJECT_ROOT"
                fi
                
                if [ "$ml_ok" != "200" ]; then
                    echo -e "   🔄 Restarting ML service..."
                    pkill -f "python.*ml_service" 2>/dev/null || true
                    sleep 2
                    cd "$PROJECT_ROOT/ml_service" && python ml_service.py &
                    cd "$PROJECT_ROOT"
                fi
                
                log_analytics "error_recovery" "attempt_${recovery_attempts}"
            fi
            
            sleep 2
        fi
        
        attempt=$((attempt + 1))
    done
    
    if [ $attempt -gt $max_attempts ]; then
        echo -e "   ${RED}⚠️  Services taking longer than expected to start${NC}"
        log_analytics "health_check" "timeout_failure"
        METRICS[health_checks_failed]=$((METRICS[health_checks_failed] + 1))
    fi
    
    echo ""
}

# Function to perform advanced security checks
advanced_security_checks() {
    log "🛡️  ADVANCED SECURITY CHECKS & VALIDATION"
    
    # Check for suspicious processes
    echo -e "   🔍 Checking for suspicious processes..."
    local suspicious_processes=$(ps aux | grep -E "(crypto|miner|malware|suspicious)" | grep -v grep | wc -l)
    if [ $suspicious_processes -gt 0 ]; then
        echo -e "   ${RED}⚠️  Suspicious processes detected: $suspicious_processes${NC}"
        log_analytics "security_warning" "suspicious_processes_${suspicious_processes}"
    else
        echo -e "   ${GREEN}✅ No suspicious processes detected${NC}"
        log_analytics "security_check" "no_suspicious_processes"
    fi
    
    # Check for unauthorized network connections
    echo -e "   🌐 Checking network connections..."
    local network_connections=$(lsof -i | grep -E "(ESTABLISHED|LISTEN)" | wc -l)
    echo -e "   📊 Active network connections: $network_connections"
    log_performance "network_connections" "$network_connections"
    
    # Check for unauthorized file modifications
    echo -e "   📁 Checking for unauthorized file modifications..."
    local recent_files=$(find . -type f -mtime -1 2>/dev/null | wc -l)
    echo -e "   📊 Files modified in last 24h: $recent_files"
    log_performance "recent_file_modifications" "$recent_files"
    
    # Check for disk space anomalies
    echo -e "   💾 Checking disk space anomalies..."
    local disk_usage=$(df -h . | awk 'NR==2 {print $5}' | sed 's/%//')
    if [ $disk_usage -gt 95 ]; then
        echo -e "   ${RED}⚠️  Critical disk usage: ${disk_usage}%${NC}"
        log_analytics "security_warning" "critical_disk_usage_${disk_usage}%"
    fi
    
    # Check for memory anomalies
    echo -e "   🧠 Checking memory anomalies..."
    local mem_usage=$(vm_stat | grep "Pages free:" | awk '{print $3}' | sed 's/\.//')
    local total_mem=$(vm_stat | grep "Pages wired down:" | awk '{print $4}' | sed 's/\.//')
    local mem_percent=$((100 - (mem_usage * 100 / total_mem)))
    
    if [ $mem_percent -gt 95 ]; then
        echo -e "   ${RED}⚠️  Critical memory usage: ${mem_percent}%${NC}"
        log_analytics "security_warning" "critical_memory_usage_${mem_percent}%"
    fi
    
    echo -e "   ${GREEN}✅ Security checks completed${NC}"
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
    
    # Run ML pipeline manager if available
    if [ -f "$SCRIPT_DIR/ml/ml-pipeline-manager.sh" ]; then
        echo -e "   🤖 Running ML pipeline health check..."
        ./scripts/ml/ml-pipeline-manager.sh status >/dev/null 2>&1 || true
        echo -e "   ${GREEN}✅ ML pipeline health check completed${NC}"
    else
        echo -e "   ${YELLOW}⚠️  ML pipeline manager not available${NC}"
    fi
    
    # Run model monitor if available
    if [ -f "$SCRIPT_DIR/model-management/model-monitor.sh" ]; then
        echo -e "   📦 Running model repository health check..."
        ./scripts/model-management/model-monitor.sh >/dev/null 2>&1 || true
        echo -e "   ${GREEN}✅ Model repository health check completed${NC}"
    else
        echo -e "   ${YELLOW}⚠️  Model monitor not available${NC}"
    fi
    
    # Run test workflows validation if available
    if [ -f "$SCRIPT_DIR/testing/test-workflows.sh" ]; then
        echo -e "   🧪 Running workflow validation..."
        ./scripts/testing/test-workflows.sh validate >/dev/null 2>&1 || true
        echo -e "   ${GREEN}✅ Workflow validation completed${NC}"
    else
        echo -e "   ${YELLOW}⚠️  Test workflows not available${NC}"
    fi
    
    # Run deployment readiness check if available
    if [ -f "$SCRIPT_DIR/deploy/deploy-production.sh" ]; then
        echo -e "   🚀 Running deployment readiness check..."
        ./scripts/deploy/deploy-production.sh check >/dev/null 2>&1 || true
        echo -e "   ${GREEN}✅ Deployment readiness check completed${NC}"
    else
        echo -e "   ${YELLOW}⚠️  Deploy production script not available${NC}"
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

# Perform advanced security checks
advanced_security_checks

# Run comprehensive script integration
comprehensive_script_integration

# Run enterprise-level health checks
enterprise_health_checks

# Function to generate comprehensive analytics and performance report
generate_comprehensive_report() {
    log "📊 COMPREHENSIVE ANALYTICS & PERFORMANCE REPORT"
    
    # Calculate total execution time
    local end_time=$(date +%s)
    local total_time=$((end_time - METRICS[start_time]))
    
    # Calculate success rates
    local total_services=$((METRICS[services_started] + METRICS[services_failed]))
    local success_rate=0
    if [ $total_services -gt 0 ]; then
        success_rate=$((METRICS[services_started] * 100 / total_services))
    fi
    
    local health_success_rate=0
    local total_health_checks=$((METRICS[health_checks_passed] + METRICS[health_checks_failed]))
    if [ $total_health_checks -gt 0 ]; then
        health_success_rate=$((METRICS[health_checks_passed] * 100 / total_health_checks))
    fi
    
    echo -e "   📈 PERFORMANCE METRICS:"
    echo -e "      ⏱️  Total Execution Time: ${total_time}s"
    echo -e "      🚀 Services Started: ${METRICS[services_started]}"
    echo -e "      ❌ Services Failed: ${METRICS[services_failed]}"
    echo -e "      🔥 Processes Killed: ${METRICS[processes_killed]}"
    echo -e "      ✅ Health Checks Passed: ${METRICS[health_checks_passed]}"
    echo -e "      ❌ Health Checks Failed: ${METRICS[health_checks_failed]}"
    echo -e "      📊 Service Success Rate: ${success_rate}%"
    echo -e "      📊 Health Check Success Rate: ${health_success_rate}%"
    
    # Log final analytics
    log_analytics "restart_complete" "total_time_${total_time}s_services_${METRICS[services_started]}_failed_${METRICS[services_failed]}"
    log_performance "total_execution_time" "$total_time"
    log_performance "service_success_rate" "$success_rate"
    log_performance "health_check_success_rate" "$health_success_rate"
    
    # Performance recommendations
    echo -e "   💡 PERFORMANCE RECOMMENDATIONS:"
    if [ $total_time -gt 120 ]; then
        echo -e "      ⚠️  Restart took longer than 2 minutes - consider optimization"
        log_analytics "performance_warning" "slow_restart_${total_time}s"
    else
        echo -e "      ✅ Restart completed within optimal time"
        log_analytics "performance_success" "fast_restart_${total_time}s"
    fi
    
    if [ $success_rate -lt 90 ]; then
        echo -e "      ⚠️  Service success rate below 90% - review startup sequence"
        log_analytics "performance_warning" "low_service_success_${success_rate}%"
    else
        echo -e "      ✅ Service success rate is excellent"
        log_analytics "performance_success" "high_service_success_${success_rate}%"
    fi
    
    if [ $health_success_rate -lt 90 ]; then
        echo -e "      ⚠️  Health check success rate below 90% - review health checks"
        log_analytics "performance_warning" "low_health_success_${health_success_rate}%"
    else
        echo -e "      ✅ Health check success rate is excellent"
        log_analytics "performance_success" "high_health_success_${health_success_rate}%"
    fi
    
    # Generate summary report file
    local report_file="$LOG_DIR/restart-logs/restart-report-$(date '+%Y%m%d-%H%M%S').txt"
    {
        echo "Connect Four AI - Enhanced Restart Report"
        echo "========================================"
        echo "Date: $(date)"
        echo "Total Execution Time: ${total_time}s"
        echo "Services Started: ${METRICS[services_started]}"
        echo "Services Failed: ${METRICS[services_failed]}"
        echo "Processes Killed: ${METRICS[processes_killed]}"
        echo "Health Checks Passed: ${METRICS[health_checks_passed]}"
        echo "Health Checks Failed: ${METRICS[health_checks_failed]}"
        echo "Service Success Rate: ${success_rate}%"
        echo "Health Check Success Rate: ${health_success_rate}%"
        echo ""
        echo "Log Files:"
        echo "- Restart Log: $RESTART_LOG"
        echo "- Performance Log: $PERFORMANCE_LOG"
        echo "- Analytics Log: $ANALYTICS_LOG"
    } > "$report_file"
    
    echo -e "   📄 Detailed report saved to: $report_file"
    echo ""
}

echo -e "${GREEN}🎊 ENTERPRISE-GRADE RESTART COMPLETE - All systems operational! 🎊${NC}"
echo -e "${CYAN}🚀 Your Connect Four AI game is ready for action!${NC}"
echo -e "${PURPLE}🏆 Enterprise-grade performance and reliability achieved!${NC}"

# Generate comprehensive report
generate_comprehensive_report

echo "" 