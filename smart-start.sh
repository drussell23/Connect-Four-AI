#!/bin/bash

# Smart Start Script for Connect Four Game
# Automatically handles port conflicts and starts services in the correct order

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PORT_MANAGER="$SCRIPT_DIR/port-manager.sh"

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
RED='\033[0;31m'
NC='\033[0m'

# Configuration
AUTO_CLEANUP=${AUTO_CLEANUP:-true}
FORCE_CLEANUP=${FORCE_CLEANUP:-true}
START_FRONTEND=${START_FRONTEND:-true}
START_BACKEND=${START_BACKEND:-true}
DEVELOPMENT_MODE=${DEVELOPMENT_MODE:-true}

log() {
    echo -e "${BLUE}[SMART-START]${NC} $1"
}

error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

# Check if port manager exists
check_port_manager() {
    if [[ ! -f "$PORT_MANAGER" ]]; then
        error "Port manager not found at $PORT_MANAGER"
        exit 1
    fi
    
    if [[ ! -x "$PORT_MANAGER" ]]; then
        log "Making port manager executable..."
        chmod +x "$PORT_MANAGER"
    fi
}

# Pre-flight checks
preflight_checks() {
    log "Running pre-flight checks..."
    
    # Check if we're in the right directory
    if [[ ! -d "backend" ]] || [[ ! -d "frontend" ]]; then
        error "This script must be run from the project root directory"
        exit 1
    fi
    
    # Check for required files
    local required_files=("backend/package.json" "frontend/package.json")
    for file in "${required_files[@]}"; do
        if [[ ! -f "$file" ]]; then
            error "Required file not found: $file"
            exit 1
        fi
    done
    
    # Check for Node.js
    if ! command -v node >/dev/null 2>&1; then
        error "Node.js is not installed or not in PATH"
        exit 1
    fi
    
    # Check for npm
    if ! command -v npm >/dev/null 2>&1; then
        error "npm is not installed or not in PATH"
        exit 1
    fi
    
    success "Pre-flight checks passed"
}

# Install dependencies if needed
install_dependencies() {
    log "Checking dependencies..."
    
    # Check backend dependencies
    if [[ ! -d "backend/node_modules" ]] || [[ "backend/package.json" -nt "backend/node_modules" ]]; then
        log "Installing backend dependencies..."
        cd "$SCRIPT_DIR/backend"
        npm install
        cd "$SCRIPT_DIR"
        success "Backend dependencies installed"
    fi
    
    # Check frontend dependencies
    if [[ ! -d "frontend/node_modules" ]] || [[ "frontend/package.json" -nt "frontend/node_modules" ]]; then
        log "Installing frontend dependencies..."
        cd "$SCRIPT_DIR/frontend"
        npm install
        cd "$SCRIPT_DIR"
        success "Frontend dependencies installed"
    fi
    
    log "Dependencies are up to date"
}

# Clean up ports if needed
cleanup_ports() {
    if [[ "$AUTO_CLEANUP" == "true" ]]; then
        log "Scanning for port conflicts..."
        
        # Use port manager to scan
        local scan_result
        scan_result=$("$PORT_MANAGER" scan 2>/dev/null | grep "IN USE" || true)
        
        if [[ -n "$scan_result" ]]; then
            warning "Port conflicts detected:"
            echo "$scan_result"
            
            if [[ "$FORCE_CLEANUP" == "true" ]]; then
                log "Automatically cleaning conflicted ports..."
                "$PORT_MANAGER" cleanup-force
            else
                echo -e "${YELLOW}Clean up conflicted ports? (y/N):${NC} "
                read -r response
                if [[ "$response" =~ ^[Yy]$ ]]; then
                    "$PORT_MANAGER" cleanup
                fi
            fi
        else
            log "No port conflicts detected"
        fi
    fi
}

# Start backend service
start_backend() {
    if [[ "$START_BACKEND" != "true" ]]; then
        log "Skipping backend startup (disabled)"
        return 0
    fi
    
    log "Starting backend service..."
    cd "$SCRIPT_DIR/backend"
    
    # Check if already running
    if "$PORT_MANAGER" scan 2>/dev/null | grep -q "3000.*IN USE"; then
        warning "Backend appears to be already running on port 3000"
        return 0
    fi
    
    # Start in background
    if [[ "$DEVELOPMENT_MODE" == "true" ]]; then
        log "Starting backend in development mode..."
        nohup npm run start:dev > ../logs/backend.log 2>&1 &
        local backend_pid=$!
        echo $backend_pid > ../logs/backend.pid
        
        # Wait a moment to check if it started successfully
        sleep 3
        if kill -0 $backend_pid 2>/dev/null; then
            success "Backend started successfully (PID: $backend_pid)"
        else
            error "Backend failed to start. Check logs/backend.log"
            return 1
        fi
    else
        log "Starting backend in production mode..."
        npm run build
        nohup npm run start:prod > ../logs/backend.log 2>&1 &
        local backend_pid=$!
        echo $backend_pid > ../logs/backend.pid
        success "Backend started in production mode (PID: $backend_pid)"
    fi
    
    cd "$SCRIPT_DIR"
}

# Start frontend service
start_frontend() {
    if [[ "$START_FRONTEND" != "true" ]]; then
        log "Skipping frontend startup (disabled)"
        return 0
    fi
    
    log "Starting frontend service..."
    cd "$SCRIPT_DIR/frontend"
    
    # Check if already running
    if "$PORT_MANAGER" scan 2>/dev/null | grep -q "3001.*IN USE"; then
        warning "Frontend appears to be already running on port 3001"
        return 0
    fi
    
    # Start in background
    log "Starting frontend development server..."
    nohup npm start > ../logs/frontend.log 2>&1 &
    local frontend_pid=$!
    echo $frontend_pid > ../logs/frontend.pid
    
    # Wait a moment to check if it started successfully
    sleep 5
    if kill -0 $frontend_pid 2>/dev/null; then
        success "Frontend started successfully (PID: $frontend_pid)"
    else
        error "Frontend failed to start. Check logs/frontend.log"
        return 1
    fi
    
    cd "$SCRIPT_DIR"
}

# Wait for services to be ready
wait_for_services() {
    log "Waiting for services to be ready..."
    
    local max_attempts=30
    local attempt=0
    
    # Wait for backend
    if [[ "$START_BACKEND" == "true" ]]; then
        log "Checking backend health..."
        while [[ $attempt -lt $max_attempts ]]; do
            if curl -s http://localhost:3000 >/dev/null 2>&1; then
                success "Backend is responding"
                break
            fi
            attempt=$((attempt + 1))
            sleep 2
        done
        
        if [[ $attempt -eq $max_attempts ]]; then
            warning "Backend health check timed out"
        fi
    fi
    
    # Wait for frontend
    if [[ "$START_FRONTEND" == "true" ]]; then
        log "Checking frontend health..."
        attempt=0
        while [[ $attempt -lt $max_attempts ]]; do
            if curl -s http://localhost:3001 >/dev/null 2>&1; then
                success "Frontend is responding"
                break
            fi
            attempt=$((attempt + 1))
            sleep 2
        done
        
        if [[ $attempt -eq $max_attempts ]]; then
            warning "Frontend health check timed out"
        fi
    fi
}

# Display startup summary
show_summary() {
    echo ""
    echo -e "${GREEN}🚀 Connect Four Game Services Started! 🚀${NC}"
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    
    if [[ "$START_BACKEND" == "true" ]]; then
        echo -e "  ${BLUE}Backend API:${NC}      http://localhost:3000"
        echo -e "  ${BLUE}API Docs:${NC}         http://localhost:3000/api"
    fi
    
    if [[ "$START_FRONTEND" == "true" ]]; then
        echo -e "  ${BLUE}Frontend App:${NC}     http://localhost:3001"
        echo -e "  ${BLUE}Game Interface:${NC}   http://localhost:3001"
    fi
    
    echo ""
    echo -e "  ${YELLOW}Logs Directory:${NC}   $SCRIPT_DIR/logs/"
    echo -e "  ${YELLOW}Stop Services:${NC}    ./port-manager.sh cleanup"
    echo -e "  ${YELLOW}Service Status:${NC}   ./port-manager.sh status"
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo ""
    
    if [[ "$START_FRONTEND" == "true" ]]; then
        echo -e "${GREEN}Ready to play Connect Four!${NC} Open http://localhost:3001 in your browser."
    fi
}

# Handle script interruption
cleanup_on_exit() {
    log "Received interrupt signal. Cleaning up..."
    # Don't actually stop services on Ctrl+C, just exit
    exit 0
}

# Set up signal handlers
trap cleanup_on_exit SIGINT SIGTERM

# Create logs directory
mkdir -p "$SCRIPT_DIR/logs"

# Main execution
main() {
    echo -e "${BLUE}"
    echo "╔══════════════════════════════════════════════════════════════╗"
    echo "║                    🎮 SMART START 🎮                         ║"
    echo "║              Connect Four Game Launcher                      ║"
    echo "╚══════════════════════════════════════════════════════════════╝"
    echo -e "${NC}"
    
    check_port_manager
    preflight_checks
    install_dependencies
    cleanup_ports
    
    # Start services
    start_backend
    start_frontend
    
    wait_for_services
    show_summary
    
    # Keep script running to show logs if requested
    if [[ "${1:-}" == "--follow-logs" ]] || [[ "${1:-}" == "-f" ]]; then
        log "Following logs... Press Ctrl+C to exit (services will continue running)"
        tail -f logs/*.log 2>/dev/null || true
    fi
}

# Parse command line arguments
while [[ $# -gt 0 ]]; do
    case $1 in
        --no-cleanup)
            AUTO_CLEANUP=false
            shift
            ;;
        --force-cleanup)
            FORCE_CLEANUP=true
            shift
            ;;
        --interactive-cleanup)
            FORCE_CLEANUP=false
            shift
            ;;
        --backend-only)
            START_FRONTEND=false
            shift
            ;;
        --frontend-only)
            START_BACKEND=false
            shift
            ;;
        --production)
            DEVELOPMENT_MODE=false
            shift
            ;;
        --follow-logs|-f)
            # This will be handled in main()
            shift
            ;;
        --help|-h)
            cat << EOF
Smart Start Script for Connect Four Game

USAGE:
  $0 [OPTIONS]

OPTIONS:
  --no-cleanup          Skip automatic port cleanup
  --force-cleanup       Force cleanup without prompting (default)
  --interactive-cleanup Prompt before killing each process
  --backend-only        Start only the backend service
  --frontend-only       Start only the frontend service
  --production          Start in production mode
  --follow-logs, -f     Follow logs after startup
  --help, -h            Show this help message

EXAMPLES:
  $0                        # Start all services with auto cleanup (default)
  $0 --interactive-cleanup  # Start with interactive cleanup prompts
  $0 --backend-only -f      # Start only backend and follow logs
  $0 --production           # Start in production mode
  $0 --no-cleanup           # Start without any port cleanup

EOF
            exit 0
            ;;
        *)
            error "Unknown option: $1"
            exit 1
            ;;
    esac
done

# Run main function
main "$@" 