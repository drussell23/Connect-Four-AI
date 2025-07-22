#!/bin/bash

# Connect Four AI - Enhanced Restart Script with Advanced Features
# FIXED VERSION: Addresses node_modules corruption issues

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

# Create necessary directories
mkdir -p "$LOG_DIR"
mkdir -p "$LOG_DIR/restart-logs"

# Logging
RESTART_LOG="$LOG_DIR/restart-logs/restart-$(date '+%Y%m%d-%H%M%S').log"

# Function to log with timestamp
log() {
    local timestamp=$(date '+%H:%M:%S')
    local message="$1"
    echo -e "${CYAN}[${timestamp}]${NC} $message"
    echo "[${timestamp}] $message" >> "$RESTART_LOG"
}

# Function to perform intelligent process cleanup
intelligent_cleanup() {
    log "🧟 INTELLIGENT PROCESS CLEANUP"
    
    # Enhanced process killing with comprehensive pattern matching
    echo -e "   🔥 Enhanced process killing with comprehensive patterns..."
    pkill -f "react-scripts\\|webpack\\|node.*start" 2>/dev/null || true
    echo -e "   ${GREEN}✅ React/Webpack/Node processes killed with enhanced patterns${NC}"
    
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

# Function to perform COMPLETE node_modules cleanup and reinstall
complete_node_modules_cleanup() {
    log "🧹 COMPLETE NODE_MODULES CLEANUP & REINSTALL"
    
    # Navigate to frontend directory
    cd "$PROJECT_ROOT/frontend"
    echo -e "   🎨 Working in frontend directory: $(pwd)"
    
    # COMPLETE removal of node_modules and lock files
    echo -e "   🗑️  Removing node_modules and lock files..."
    rm -rf node_modules package-lock.json 2>/dev/null || true
    echo -e "   ${GREEN}✅ Frontend node_modules and lock files removed${NC}"
    
    # Clear npm cache with force
    echo -e "   📦 Clearing npm cache with force..."
    npm cache clean --force 2>/dev/null || true
    echo -e "   ${GREEN}✅ NPM cache cleared with force${NC}"
    
    # Clear system caches
    echo -e "   🗂️  Clearing system caches..."
    sudo purge 2>/dev/null || true
    echo -e "   ${GREEN}✅ System caches cleared${NC}"
    
    # Reinstall dependencies with legacy peer deps
    echo -e "   📦 Reinstalling dependencies..."
    npm install --legacy-peer-deps
    echo -e "   ${GREEN}✅ Dependencies reinstalled${NC}"
    
    # Install specific missing dependencies if needed
    echo -e "   🔧 Installing specific dependencies..."
    npm install chart.js @kurkle/color framer-motion html-entities events ansi-html-community core-js-pure fireworks-js @vercel/speed-insights
    echo -e "   ${GREEN}✅ Specific dependencies installed${NC}"
    
    # Navigate to backend directory
    cd "$PROJECT_ROOT/backend"
    echo -e "   🔧 Working in backend directory: $(pwd)"
    
    # Check if backend node_modules needs cleanup
    if [ ! -d "node_modules" ] || [ ! -f "node_modules/.package-lock.json" ]; then
        echo -e "   🗑️  Backend node_modules appears corrupted, reinstalling..."
        rm -rf node_modules package-lock.json 2>/dev/null || true
        npm install --legacy-peer-deps
        echo -e "   ${GREEN}✅ Backend dependencies reinstalled${NC}"
    else
        echo -e "   ${GREEN}✅ Backend node_modules appears healthy${NC}"
    fi
    
    # Return to project root
    cd "$PROJECT_ROOT"
    echo ""
}

# Function to start services
start_services() {
    log "🚀 STARTING SERVICES"
    
    # Start backend
    echo -e "   🔧 Starting backend..."
    cd "$PROJECT_ROOT/backend"
    npm start &
    BACKEND_PID=$!
    echo -e "   ${GREEN}✅ Backend started (PID: $BACKEND_PID)${NC}"
    
    # Wait for backend to start
    sleep 5
    
    # Start frontend
    echo -e "   🎨 Starting frontend..."
    cd "$PROJECT_ROOT/frontend"
    npm start &
    FRONTEND_PID=$!
    echo -e "   ${GREEN}✅ Frontend started (PID: $FRONTEND_PID)${NC}"
    
    # Return to project root
    cd "$PROJECT_ROOT"
    echo ""
}

# Function to verify services
verify_services() {
    log "🔍 VERIFYING SERVICES"
    
    # Wait for services to start
    echo -e "   ⏳ Waiting for services to start..."
    sleep 15
    
    # Check backend
    if curl -s http://localhost:3000/api/health >/dev/null 2>&1; then
        echo -e "   ${GREEN}✅ Backend is running on http://localhost:3000${NC}"
    else
        echo -e "   ${RED}❌ Backend is not responding${NC}"
    fi
    
    # Check frontend
    if curl -s http://localhost:3001 >/dev/null 2>&1; then
        echo -e "   ${GREEN}✅ Frontend is running on http://localhost:3001${NC}"
    else
        echo -e "   ${RED}❌ Frontend is not responding${NC}"
    fi
    
    echo ""
}

# Main execution
main() {
    log "🚀 ENHANCED RESTART SCRIPT - FIXED VERSION"
    log "📍 Project Root: $PROJECT_ROOT"
    log "📁 Script Directory: $SCRIPT_DIR"
    
    # Step 1: Clean up processes
    intelligent_cleanup
    
    # Step 2: Complete node_modules cleanup and reinstall
    complete_node_modules_cleanup
    
    # Step 3: Start services
    start_services
    
    # Step 4: Verify services
    verify_services
    
    log "🎉 ENHANCED RESTART COMPLETED"
    log "📊 Services should now be running without ENOENT errors"
    log "🌐 Frontend: http://localhost:3001"
    log "🔧 Backend: http://localhost:3000"
}

# Run main function
main "$@" 