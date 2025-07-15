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
START_ML_SERVICE=${START_ML_SERVICE:-true}
START_ML_INFERENCE=${START_ML_INFERENCE:-true}
START_AI_COORDINATION=${START_AI_COORDINATION:-true}
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
    
    # Check for ML service if enabled
    if [[ "$START_ML_SERVICE" == "true" || "$START_ML_INFERENCE" == "true" ]]; then
        if [[ ! -d "ml_service" ]]; then
            error "ML service directory not found: ml_service"
            exit 1
        fi
        
        if [[ ! -f "ml_service/ml_service.py" ]]; then
            error "ML service not found: ml_service/ml_service.py"
            exit 1
        fi
        
        # Check for Python
        if ! command -v python3 >/dev/null 2>&1; then
            error "Python 3 is not installed or not in PATH"
            exit 1
        fi
    fi
    
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
    
    # Check ML service dependencies
    if [[ "$START_ML_SERVICE" == "true" || "$START_ML_INFERENCE" == "true" ]]; then
        if [[ ! -f "ml_service/requirements.txt" ]]; then
            warning "ML service requirements.txt not found, skipping Python dependencies"
        else
            log "Checking ML service dependencies..."
            cd "$SCRIPT_DIR/ml_service"
            if ! python3 -c "import torch, fastapi, pydantic, numpy" >/dev/null 2>&1; then
                log "Installing ML service dependencies..."
                pip3 install -r requirements.txt
                success "ML service dependencies installed"
            else
                log "ML service dependencies are up to date"
            fi
            cd "$SCRIPT_DIR"
        fi
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

# Start ML service
start_ml_service() {
    if [[ "$START_ML_SERVICE" != "true" ]]; then
        log "Skipping ML service startup (disabled)"
        return 0
    fi
    
    log "Starting ML service..."
    cd "$SCRIPT_DIR/ml_service"
    
    # Check if already running
    if "$PORT_MANAGER" scan 2>/dev/null | grep -q "8000.*IN USE"; then
        warning "ML service appears to be already running on port 8000"
        return 0
    fi
    
    # Start in background
    log "Starting ML service on port 8000..."
    nohup python3 ml_service.py > ../logs/ml_service.log 2>&1 &
    local ml_service_pid=$!
    echo $ml_service_pid > ../logs/ml_service.pid
    
    # Wait a moment to check if it started successfully
    sleep 5
    if kill -0 $ml_service_pid 2>/dev/null; then
        success "ML service started successfully (PID: $ml_service_pid)"
    else
        error "ML service failed to start. Check logs/ml_service.log"
        return 1
    fi
    
    cd "$SCRIPT_DIR"
}

# Start ML inference service
start_ml_inference() {
    if [[ "$START_ML_INFERENCE" != "true" ]]; then
        log "Skipping ML inference startup (disabled)"
        return 0
    fi
    
    log "Starting ML inference service..."
    cd "$SCRIPT_DIR/ml_service"
    
    # Check if already running
    if "$PORT_MANAGER" scan 2>/dev/null | grep -q "8001.*IN USE"; then
        warning "ML inference appears to be already running on port 8001"
        return 0
    fi
    
    # Start in background
    log "Starting Enhanced ML inference service on port 8001..."
    nohup python3 enhanced_inference.py > ../logs/ml_inference.log 2>&1 &
    local ml_inference_pid=$!
    echo $ml_inference_pid > ../logs/ml_inference.pid
    
    # Wait a moment to check if it started successfully
    sleep 3
    if kill -0 $ml_inference_pid 2>/dev/null; then
        success "Enhanced ML inference started successfully (PID: $ml_inference_pid)"
    else
        error "Enhanced ML inference failed to start. Check logs/ml_inference.log"
        return 1
    fi
    
    cd "$SCRIPT_DIR"
}

# Start AI coordination hub
start_ai_coordination() {
    if [[ "$START_AI_COORDINATION" != "true" ]]; then
        log "Skipping AI coordination hub startup (disabled)"
        return 0
    fi
    
    log "Starting AI coordination hub..."
    cd "$SCRIPT_DIR/ml_service"
    
    # Check if already running
    if "$PORT_MANAGER" scan 2>/dev/null | grep -q "8002.*IN USE"; then
        warning "AI coordination hub appears to be already running on port 8002"
        return 0
    fi
    
    # Start in background
    log "Starting AI coordination hub on port 8002..."
    nohup python3 ai_coordination_hub.py > ../logs/ai_coordination.log 2>&1 &
    local coordination_pid=$!
    echo $coordination_pid > ../logs/ai_coordination.pid
    
    # Wait a moment to check if it started successfully
    sleep 3
    if kill -0 $coordination_pid 2>/dev/null; then
        success "AI coordination hub started successfully (PID: $coordination_pid)"
    else
        error "AI coordination hub failed to start. Check logs/ai_coordination.log"
        return 1
    fi
    
    cd "$SCRIPT_DIR"
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
    
    # Wait for ML service
    if [[ "$START_ML_SERVICE" == "true" ]]; then
        log "Checking ML service health..."
        while [[ $attempt -lt $max_attempts ]]; do
            if curl -s http://localhost:8000/health >/dev/null 2>&1; then
                success "ML service is responding"
                break
            fi
            attempt=$((attempt + 1))
            sleep 2
        done
        
        if [[ $attempt -eq $max_attempts ]]; then
            warning "ML service health check timed out"
        fi
    fi
    
    # Wait for ML inference
    if [[ "$START_ML_INFERENCE" == "true" ]]; then
        log "Checking ML inference health..."
        attempt=0
        while [[ $attempt -lt $max_attempts ]]; do
            if curl -s http://localhost:8001/health >/dev/null 2>&1; then
                success "ML inference is responding"
                break
            fi
            attempt=$((attempt + 1))
            sleep 2
        done
        
        if [[ $attempt -eq $max_attempts ]]; then
            warning "ML inference health check timed out"
        fi
    fi
    
    # Wait for AI coordination hub
    if [[ "$START_AI_COORDINATION" == "true" ]]; then
        log "Checking AI coordination hub health..."
        attempt=0
        while [[ $attempt -lt $max_attempts ]]; do
            if curl -s http://localhost:8002/coordination/stats >/dev/null 2>&1; then
                success "AI coordination hub is responding"
                break
            fi
            attempt=$((attempt + 1))
            sleep 2
        done
        
        if [[ $attempt -eq $max_attempts ]]; then
            warning "AI coordination hub health check timed out"
        fi
    fi
    
    # Wait for backend
    if [[ "$START_BACKEND" == "true" ]]; then
        log "Checking backend health..."
        attempt=0
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
    
    if [[ "$START_ML_SERVICE" == "true" ]]; then
        echo -e "  ${BLUE}ML Service:${NC}       http://localhost:8000"
        echo -e "  ${BLUE}ML Service API:${NC}   http://localhost:8000/docs"
        echo -e "  ${BLUE}ML Metrics:${NC}       http://localhost:8000/metrics"
    fi
    
    if [[ "$START_ML_INFERENCE" == "true" ]]; then
        echo -e "  ${BLUE}Enhanced ML-Inference:${NC} http://localhost:8001"
        echo -e "  ${BLUE}ML-Inference Health:${NC}  http://localhost:8001/health"
    fi
    
    if [[ "$START_AI_COORDINATION" == "true" ]]; then
        echo -e "  ${BLUE}AI Coordination Hub:${NC}  http://localhost:8002"
        echo -e "  ${BLUE}AI Coordination Stats:${NC} http://localhost:8002/coordination/stats"
    fi
    
    if [[ "$START_BACKEND" == "true" ]]; then
        echo -e "  ${BLUE}Backend API:${NC}      http://localhost:3000"
        echo -e "  ${BLUE}API Docs:${NC}         http://localhost:3000/api"
    fi
    
    if [[ "$START_FRONTEND" == "true" ]]; then
        echo -e "  ${BLUE}Frontend App:${NC}     http://localhost:3001"
        echo -e "  ${BLUE}Game Interface:${NC}   http://localhost:3001"
    fi
    
    echo ""
    echo -e "  ${YELLOW}Revolutionary AI Features:${NC}"
    echo -e "  ${YELLOW}├─ Multi-Brain Architecture${NC}     (Tactical + Strategic AI)"
    echo -e "  ${YELLOW}├─ Real-time AI Collaboration${NC}   (AI-to-AI Communication)"
    echo -e "  ${YELLOW}├─ Opponent Psychological Profiling${NC} (Adaptive Strategy)"
    echo -e "  ${YELLOW}├─ Uncertainty-Guided Decisions${NC}  (Smart Exploration)"
    echo -e "  ${YELLOW}└─ Emergency Coordination${NC}       (< 50ms Crisis Response)"
    echo ""
    echo -e "  ${YELLOW}Logs Directory:${NC}   $SCRIPT_DIR/logs/"
    echo -e "  ${YELLOW}Stop Services:${NC}    ./port-manager.sh cleanup"
    echo -e "  ${YELLOW}Service Status:${NC}   ./port-manager.sh status"
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo ""
    
    if [[ "$START_FRONTEND" == "true" ]]; then
        echo -e "${GREEN}🧠 Revolutionary AI System Ready!${NC} Open http://localhost:3001 to experience the future of Connect Four AI!"
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
    
    # Start services in correct order (ML services first, then backend, then frontend)
    start_ml_service
    start_ml_inference
    start_ai_coordination
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
            START_ML_SERVICE=false
            START_ML_INFERENCE=false
            shift
            ;;
        --frontend-only)
            START_BACKEND=false
            START_ML_SERVICE=false
            START_ML_INFERENCE=false
            shift
            ;;
        --ml-only)
            START_BACKEND=false
            START_FRONTEND=false
            shift
            ;;
        --no-ml)
            START_ML_SERVICE=false
            START_ML_INFERENCE=false
            shift
            ;;
        --no-ml-inference)
            START_ML_INFERENCE=false
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
  --ml-only             Start only ML services (ml-service + ml-inference)
  --no-ml               Skip ML services (backend + frontend only)
  --no-ml-inference     Skip ML inference service (keep ml-service)
  --production          Start in production mode
  --follow-logs, -f     Follow logs after startup
  --help, -h            Show this help message

EXAMPLES:
  $0                        # Start all services (default)
  $0 --interactive-cleanup  # Start with interactive cleanup prompts
  $0 --backend-only -f      # Start only backend and follow logs
  $0 --no-ml               # Start without ML services
  $0 --ml-only             # Start only ML services
  $0 --production          # Start in production mode
  $0 --no-cleanup          # Start without any port cleanup

SERVICES:
  Backend:       http://localhost:3000 (Node.js API)
  Frontend:      http://localhost:3001 (React App)
  ML Service:    http://localhost:8000 (FastAPI ML API)
  ML Inference:  http://localhost:8001 (PyTorch Inference)

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