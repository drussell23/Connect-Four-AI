#!/bin/bash

# =====================================================
# 🚀 CONNECT FOUR - ENTERPRISE START ALL SERVICES
# =====================================================
# Enhanced startup script with advanced monitoring, health checks, and recovery
# Usage: ./start-all.sh [options]
# Options:
#   --fast-mode     Skip ML initialization for faster startup
#   --debug         Enable verbose debugging output
#   --no-health     Skip post-startup health checks
#   --memory-opt    Use memory-optimized settings
#   --dev           Development mode with hot reload

set -e  # Exit on error

# =====================================================
# CONFIGURATION & ENVIRONMENT
# =====================================================

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
MAGENTA='\033[0;35m'
WHITE='\033[1;37m'
NC='\033[0m' # No Color

# Script configuration
SCRIPT_START_TIME=$(date +%s)
FAST_MODE=${FAST_MODE:-false}
DEBUG_MODE=false
SKIP_HEALTH_CHECK=false
MEMORY_OPTIMIZED=false
DEV_MODE=false
M1_OPTIMIZED=false
MAX_STARTUP_TIME=300  # 5 minutes max startup time
HEALTH_CHECK_RETRIES=3
SERVICE_START_DELAY=2

# Detect M1 Mac and auto-enable optimization
IS_M1_MAC=false
if [[ "$(uname -m)" == "arm64" ]] && [[ "$OSTYPE" == "darwin"* ]]; then
    IS_M1_MAC=true
    M1_OPTIMIZED=true
    MEMORY_OPTIMIZED=true
    echo -e "${CYAN}🍎 M1 Mac detected - Auto-enabling optimizations${NC}"
fi

# Parse command line arguments
while [[ $# -gt 0 ]]; do
    case $1 in
        --fast-mode|--fast)
            FAST_MODE=true
            echo -e "${CYAN}⚡ Fast mode enabled${NC}"
            shift
            ;;
        --debug)
            DEBUG_MODE=true
            echo -e "${CYAN}🐛 Debug mode enabled${NC}"
            shift
            ;;
        --no-health)
            SKIP_HEALTH_CHECK=true
            echo -e "${CYAN}🏥 Health checks disabled${NC}"
            shift
            ;;
        --memory-opt)
            MEMORY_OPTIMIZED=true
            echo -e "${CYAN}🧠 Memory optimization enabled${NC}"
            shift
            ;;
        --dev)
            DEV_MODE=true
            echo -e "${CYAN}👨‍💻 Development mode enabled${NC}"
            shift
            ;;
        --m1-opt)
            M1_OPTIMIZED=true
            echo -e "${CYAN}🍎 M1 optimization enabled${NC}"
            shift
            ;;
        --help|-h)
            echo "Usage: $0 [options]"
            echo "Options:"
            echo "  --fast-mode     Skip ML initialization for faster startup"
            echo "  --debug         Enable verbose debugging output"
            echo "  --no-health     Skip post-startup health checks"
            echo "  --memory-opt    Use memory-optimized settings"
            echo "  --m1-opt        Enable M1 Mac optimizations"
            echo "  --dev           Development mode with hot reload"
            echo "  --help, -h      Show this help message"
            exit 0
            ;;
        *)
            echo "Unknown option: $1"
            echo "Use --help for available options"
            exit 1
            ;;
    esac
done

# =====================================================
# UTILITY FUNCTIONS
# =====================================================

# Debug logging function
debug_log() {
    if [ "$DEBUG_MODE" = true ]; then
        echo -e "${MAGENTA}[DEBUG]${NC} $1"
    fi
}

# Error handling with cleanup
error_exit() {
    echo -e "${RED}❌ Error: $1${NC}"
    echo -e "${YELLOW}🧹 Cleaning up processes...${NC}"
    cleanup_on_error
    exit 1
}

# Cleanup function for error states
cleanup_on_error() {
    debug_log "Starting error cleanup"
    pkill -f "npm start" 2>/dev/null || true
    pkill -f "nest start" 2>/dev/null || true
    pkill -f "python3.*ml_service" 2>/dev/null || true
    sleep 2
}

# System resource check
check_system_resources() {
    echo -e "${CYAN}🔍 Checking system resources...${NC}"
    
    # Check available memory (cross-platform)
    if command -v free >/dev/null 2>&1; then
        # Linux
        AVAILABLE_MEM=$(free -m | awk 'NR==2{printf "%d", $7}')
        debug_log "Available memory: ${AVAILABLE_MEM}MB (Linux)"
    elif command -v vm_stat >/dev/null 2>&1; then
        # macOS
        local page_size=$(vm_stat | grep "Mach Virtual Memory Statistics" | head -1 || echo "4096")
        local free_pages=$(vm_stat | grep "Pages free" | awk '{print $3}' | sed 's/\.//')
        local inactive_pages=$(vm_stat | grep "Pages inactive" | awk '{print $3}' | sed 's/\.//')
        AVAILABLE_MEM=$(((free_pages + inactive_pages) * 4096 / 1024 / 1024))
        debug_log "Available memory: ${AVAILABLE_MEM}MB (macOS)"
    else
        debug_log "Memory check not available on this system"
        AVAILABLE_MEM=4096  # Assume 4GB available
    fi
    
    if [ "$AVAILABLE_MEM" -lt 2048 ]; then
        echo -e "${YELLOW}⚠️  Low memory detected (${AVAILABLE_MEM}MB available)${NC}"
        echo -e "${CYAN}💡 Automatically enabling memory optimization${NC}"
        MEMORY_OPTIMIZED=true
    fi
    
    # Check disk space
    AVAILABLE_DISK=$(df . | awk 'NR==2 {print int($4/1024)}')
    debug_log "Available disk space: ${AVAILABLE_DISK}MB"
    
    if [ "$AVAILABLE_DISK" -lt 1024 ]; then
        echo -e "${YELLOW}⚠️  Low disk space (${AVAILABLE_DISK}MB available)${NC}"
    fi
    
    # Check CPU cores
    CPU_CORES=$(nproc 2>/dev/null || sysctl -n hw.ncpu 2>/dev/null || echo "4")
    debug_log "CPU cores: $CPU_CORES"
    
    echo -e "${GREEN}✅ System resources checked${NC}"
}

# Enhanced dependency checking
check_dependencies() {
    echo -e "${CYAN}🏥 Running comprehensive dependency health check...${NC}"
    
    local issues_found=0
    
    # Check Node.js version
    if ! command -v node >/dev/null 2>&1; then
        echo -e "${RED}❌ Node.js not found${NC}"
        return 1
    fi
    
    NODE_VERSION=$(node --version | sed 's/v//')
    debug_log "Node.js version: $NODE_VERSION"
    
    # Check npm version
    if ! command -v npm >/dev/null 2>&1; then
        echo -e "${RED}❌ npm not found${NC}"
        return 1
    fi
    
    NPM_VERSION=$(npm --version)
    debug_log "npm version: $NPM_VERSION"
    
    # Check Python version
    if ! command -v python3 >/dev/null 2>&1; then
        echo -e "${YELLOW}⚠️  Python3 not found - ML services may not work${NC}"
        ((issues_found++))
    else
        PYTHON_VERSION=$(python3 --version | cut -d' ' -f2)
        debug_log "Python version: $PYTHON_VERSION"
    fi
    
    # Check backend dependencies
    if [ ! -d "backend/node_modules" ]; then
        echo -e "${YELLOW}⚠️  Backend dependencies missing${NC}"
        ((issues_found++))
    fi
    
    # Check frontend dependencies
    if [ ! -d "frontend/node_modules" ]; then
        echo -e "${YELLOW}⚠️  Frontend dependencies missing${NC}"
        ((issues_found++))
    fi
    
    # Check backend build
    if [ ! -f "backend/dist/main.js" ]; then
        echo -e "${YELLOW}⚠️  Backend build missing${NC}"
        ((issues_found++))
    fi
    
    # Run detailed health check if available
    if [ -f "scripts/check-dependencies.js" ] && command -v node >/dev/null 2>&1; then
        debug_log "Running detailed dependency check"
        node scripts/check-dependencies.js 2>/dev/null || ((issues_found++))
    fi
    
    if [ $issues_found -eq 0 ]; then
        echo -e "${GREEN}✅ All dependencies healthy${NC}"
        return 0
    else
        echo -e "${YELLOW}⚠️  Found $issues_found dependency issues${NC}"
        return 1
    fi
}

# Enhanced dependency fixing with progress
fix_dependencies() {
    echo -e "${YELLOW}🔧 Auto-fixing dependencies with progress tracking...${NC}"
    
    local start_time=$(date +%s)
    
    # Check if self-healing installer exists
    if [ -f "scripts/self-healing-installer.sh" ]; then
        echo -e "${CYAN}🔄 Running self-healing installer...${NC}"
        ./scripts/self-healing-installer.sh || {
            echo -e "${YELLOW}⚠️  Self-healing installer failed, trying manual fix${NC}"
        }
    fi
    
    # Backend dependencies
    if [ ! -d "backend/node_modules" ]; then
        echo -e "${YELLOW}📦 Installing backend dependencies...${NC}"
        (cd backend && npm install --legacy-peer-deps --progress=true) || {
            echo -e "${RED}❌ Backend dependency installation failed${NC}"
            return 1
        }
    fi
    
    # Frontend dependencies
    if [ ! -d "frontend/node_modules" ]; then
        echo -e "${YELLOW}📦 Installing frontend dependencies...${NC}"
        (cd frontend && npm install --legacy-peer-deps --progress=true) || {
            echo -e "${RED}❌ Frontend dependency installation failed${NC}"
            return 1
        }
    fi
    
    # Backend build
    if [ ! -f "backend/dist/main.js" ]; then
        echo -e "${YELLOW}🔨 Building backend...${NC}"
        (cd backend && npm run build) || {
            echo -e "${RED}❌ Backend build failed${NC}"
            return 1
        }
    fi
    
    local end_time=$(date +%s)
    local duration=$((end_time - start_time))
    echo -e "${GREEN}✅ Dependencies fixed in ${duration}s${NC}"
    
    return 0
}

# Enhanced service starter with resource management
start_service() {
    local service_name=$1
    local working_dir=$2
    local start_command=$3
    local expected_port=$4
    local timeout=${5:-60}
    
    echo -e "${BLUE}🚀 Starting ${service_name}...${NC}"
    debug_log "Service: $service_name, Dir: $working_dir, Command: $start_command, Port: $expected_port"
    
    # Create log file path
    local log_file="logs/${service_name}.log"
    local pid_file="logs/${service_name}.pid"
    
    # Apply memory optimization if enabled
    local optimized_command="$start_command"
    if [ "$MEMORY_OPTIMIZED" = true ]; then
        case $service_name in
            backend)
                optimized_command="BACKEND_MEMORY_LIMIT=512 NODE_OPTIONS='--max-old-space-size=512' $start_command"
                debug_log "Applied memory optimization: 512MB limit for backend"
                ;;
            frontend)
                optimized_command="NODE_OPTIONS='--max-old-space-size=512' $start_command"
                debug_log "Applied memory optimization: 512MB limit for frontend"
                ;;
        esac
    fi
    
    # Apply M1 optimization if enabled
    if [ "$M1_OPTIMIZED" = true ]; then
        case $service_name in
            backend)
                # If memory optimization is already applied, don't override NODE_OPTIONS
                if [ "$MEMORY_OPTIMIZED" = true ]; then
                    optimized_command="M1_OPTIMIZED=true ENABLE_M1_FEATURES=true LIGHTWEIGHT_MODE=true $optimized_command"
                    debug_log "Applied M1 optimization with memory constraints"
                else
                    optimized_command="M1_OPTIMIZED=true ENABLE_M1_FEATURES=true NODE_OPTIONS='--max-old-space-size=2048' $optimized_command"
                    debug_log "Applied M1 optimization for backend"
                fi
                ;;
            frontend)
                optimized_command="REACT_APP_M1_OPTIMIZED=true $optimized_command"
                debug_log "Applied M1 optimization for frontend"
                ;;
        esac
    fi
    
    # Apply fast mode settings
    if [ "$FAST_MODE" = true ]; then
        optimized_command="FAST_MODE=true SKIP_ML_INIT=true $optimized_command"
    fi
    
    # Apply dev mode settings
    if [ "$DEV_MODE" = true ]; then
        optimized_command="NODE_ENV=development DEBUG=* $optimized_command"
    fi
    
    # Start the service
    (cd "$working_dir" && eval "$optimized_command") > "$log_file" 2>&1 &
    local service_pid=$!
    
    # Store PID
    echo "$service_pid" > "$pid_file"
    echo -e "${GREEN}   ✅ Started with PID: $service_pid${NC}"
    
    # Wait for service to be ready if port is specified
    if [ ! -z "$expected_port" ]; then
        local retries=0
        local max_retries=$((timeout / 3))
        
        while [ $retries -lt $max_retries ]; do
            if lsof -i ":$expected_port" | grep -q LISTEN 2>/dev/null; then
                echo -e "${GREEN}   ✅ ${service_name} is ready on port ${expected_port}${NC}"
                return 0
            fi
            
            # Check if process is still running
            if ! kill -0 $service_pid 2>/dev/null; then
                echo -e "${RED}   ❌ ${service_name} process died${NC}"
                echo -e "${YELLOW}   📋 Last 10 lines of log:${NC}"
                tail -10 "$log_file" 2>/dev/null || echo "   No log available"
                return 1
            fi
            
            if [ $((retries % 5)) -eq 0 ]; then
                echo -e "${YELLOW}   ⏳ Waiting for ${service_name} (attempt $((retries/3 + 1))/$((max_retries/3)))...${NC}"
                
                # Show status from logs
                if [ -f "$log_file" ]; then
                    local last_log=$(tail -1 "$log_file" 2>/dev/null | head -c 80)
                    if [ ! -z "$last_log" ]; then
                        echo -e "${CYAN}      Status: ${last_log}...${NC}"
                    fi
                fi
            fi
            
            sleep 3
            ((retries++))
        done
        
        echo -e "${RED}   ❌ ${service_name} failed to start on port ${expected_port} within ${timeout}s${NC}"
        return 1
    fi
    
    return 0
}

# Enhanced health check with detailed reporting
run_health_checks() {
    if [ "$SKIP_HEALTH_CHECK" = true ]; then
        echo -e "${CYAN}🏥 Skipping health checks as requested${NC}"
        return 0
    fi
    
    echo -e "${CYAN}🏥 Running comprehensive health checks...${NC}"
    
    local health_results=()
    local overall_health=0
    
    # Backend health check
    echo -e "${CYAN}   🔍 Checking backend health...${NC}"
    if curl -sf http://localhost:3000/api/health >/dev/null 2>&1; then
        health_results+=("Backend: ✅ Healthy")
        echo -e "${GREEN}      ✅ Backend API responding${NC}"
        
        # Get detailed backend status
        local backend_status=$(curl -s http://localhost:3000/api/health | python3 -c "
import sys, json
try:
    data = json.load(sys.stdin)
    print(f\"Version: {data.get('version', 'unknown')}, Uptime: {data.get('system', {}).get('uptime', 'unknown')}s\")
except:
    print('Status unavailable')
" 2>/dev/null || echo "Status unavailable")
        echo -e "${CYAN}      📊 $backend_status${NC}"
    else
        health_results+=("Backend: ❌ Failed")
        echo -e "${RED}      ❌ Backend health check failed${NC}"
        ((overall_health++))
    fi
    
    # Frontend health check
    echo -e "${CYAN}   🔍 Checking frontend...${NC}"
    if curl -sf http://localhost:3001 >/dev/null 2>&1; then
        health_results+=("Frontend: ✅ Healthy")
        echo -e "${GREEN}      ✅ Frontend responding${NC}"
    else
        health_results+=("Frontend: ❌ Failed")
        echo -e "${RED}      ❌ Frontend health check failed${NC}"
        ((overall_health++))
    fi
    
    # ML Service health check
    echo -e "${CYAN}   🔍 Checking ML service...${NC}"
    if curl -sf http://localhost:8000/health >/dev/null 2>&1; then
        health_results+=("ML Service: ✅ Healthy")
        echo -e "${GREEN}      ✅ ML Service responding${NC}"
        
        # Get ML service details
        local ml_status=$(curl -s http://localhost:8000/health | python3 -c "
import sys, json
try:
    data = json.load(sys.stdin)
    print(f\"Device: {data.get('device', 'unknown')}, Models: {len(data.get('models', []))}\")
except:
    print('Status unavailable')
" 2>/dev/null || echo "Status unavailable")
        echo -e "${CYAN}      📊 $ml_status${NC}"
    else
        health_results+=("ML Service: ⚠️ Unavailable")
        echo -e "${YELLOW}      ⚠️ ML Service not responding (may still be initializing)${NC}"
    fi
    
    # Additional service checks
    local services=(
        "8001:ML Inference"
        "8002:Continuous Learning WS"
        "8003:AI Coordination"
        "8004:Python Trainer"
        "8888:Integration WebSocket"
    )
    
    for service in "${services[@]}"; do
        local port="${service%%:*}"
        local name="${service##*:}"
        
        if lsof -i ":$port" | grep -q LISTEN 2>/dev/null; then
            health_results+=("$name: ✅ Running")
        else
            health_results+=("$name: ❌ Not running")
            ((overall_health++))
        fi
    done
    
    # Display health summary
    echo ""
    echo -e "${WHITE}📊 HEALTH SUMMARY${NC}"
    echo -e "${WHITE}=================${NC}"
    for result in "${health_results[@]}"; do
        echo -e "   $result"
    done
    
    if [ $overall_health -eq 0 ]; then
        echo -e "${GREEN}🎉 All systems are healthy!${NC}"
        return 0
    else
        echo -e "${YELLOW}⚠️  $overall_health issues detected${NC}"
        return 1
    fi
}

# Performance monitoring
start_performance_monitoring() {
    if [ "$DEBUG_MODE" = false ]; then
        return 0
    fi
    
    echo -e "${CYAN}📊 Starting performance monitoring...${NC}"
    
    # Start resource monitoring in background (cross-platform)
    (
        while true; do
            local timestamp=$(date '+%Y-%m-%d %H:%M:%S')
            
            # CPU usage (cross-platform)
            if command -v top >/dev/null 2>&1; then
                if [[ "$OSTYPE" == "darwin"* ]]; then
                    # macOS
                    local cpu_usage=$(top -l 1 -n 0 | grep "CPU usage" | awk '{print $3}' | cut -d'%' -f1 2>/dev/null || echo "N/A")
                else
                    # Linux
                    local cpu_usage=$(top -bn1 | grep "Cpu(s)" | awk '{print $2}' | cut -d'%' -f1 2>/dev/null || echo "N/A")
                fi
            else
                cpu_usage="N/A"
            fi
            
            # Memory usage (cross-platform)
            if command -v free >/dev/null 2>&1; then
                # Linux
                local mem_usage=$(free | awk 'FNR == 2 {printf "%.1f", ($3/$2)*100}' 2>/dev/null || echo "N/A")
            elif command -v vm_stat >/dev/null 2>&1; then
                # macOS
                local total_pages=$(sysctl -n hw.memsize | awk '{print int($1/4096)}')
                local free_pages=$(vm_stat | grep "Pages free" | awk '{print $3}' | sed 's/\.//')
                local mem_usage=$(awk "BEGIN {printf \"%.1f\", ((${total_pages:-0} - ${free_pages:-0}) / ${total_pages:-1}) * 100}")
            else
                mem_usage="N/A"
            fi
            
            echo "[$timestamp] CPU: ${cpu_usage}%, Memory: ${mem_usage}%" >> logs/performance.log
            sleep 30
        done
    ) &
    
    echo "$!" > logs/performance_monitor.pid
}

# =====================================================
# MAIN STARTUP SEQUENCE
# =====================================================

echo -e "${BLUE}🚀 Connect Four Enterprise Service Launcher${NC}"
echo -e "${BLUE}==============================================${NC}"
echo -e "${CYAN}⏰ Started at: $(date)${NC}"

# Check if we're in the right directory
if [ ! -f "package.json" ]; then
    error_exit "Must run from project root directory"
fi

# Create logs directory
mkdir -p logs
rm -f logs/*.pid

# System checks
check_system_resources

# Dependency checks and fixes
if ! check_dependencies; then
    echo -e "${YELLOW}🔧 Attempting to fix dependencies...${NC}"
    if ! fix_dependencies; then
        error_exit "Failed to fix dependencies"
    fi
    
    # Re-check after fixing
    if ! check_dependencies; then
        echo -e "${YELLOW}⚠️  Some dependencies could not be fixed, but continuing...${NC}"
    fi
fi

# Clean up existing services
echo -e "${YELLOW}🧹 Cleaning up existing services...${NC}"
npm run stop:simple 2>/dev/null || true
sleep $SERVICE_START_DELAY

# Start performance monitoring in debug mode
start_performance_monitoring

# =====================================================
# SERVICE STARTUP
# =====================================================

echo -e "${WHITE}🚀 STARTING SERVICES${NC}"
echo -e "${WHITE}====================${NC}"

# Backend Service (most critical)
if [ "$M1_OPTIMIZED" = true ]; then
    # M1-optimized backend with memory limits and thread optimization
    start_service "backend" "backend" \
        "PORT=3000 BACKEND_PORT=3000 ENABLE_CONTINUOUS_LEARNING=true ENABLE_PATTERN_DEFENSE=true ENABLE_DIFFICULTY_AWARE_LEARNING=true ENABLE_SERVICE_INTEGRATION=true SIMULATION_WORKERS=2 INTEGRATION_PORT=8888 M1_OPTIMIZED=true ENABLE_M1_FEATURES=true npm run start:m1" \
        "3000" 90
else
    # Standard backend
    start_service "backend" "backend" \
        "PORT=3000 BACKEND_PORT=3000 ENABLE_CONTINUOUS_LEARNING=true ENABLE_PATTERN_DEFENSE=true ENABLE_DIFFICULTY_AWARE_LEARNING=true ENABLE_SERVICE_INTEGRATION=true SIMULATION_WORKERS=2 INTEGRATION_PORT=8888 npm run start:prod" \
        "3000" 90
fi

# Frontend Service
start_service "frontend" "frontend" \
    "PORT=3001 REACT_APP_API_URL=http://localhost:3000/api npm start" \
    "3001" 60

# ML Services (only if not in fast mode)
if [ "$FAST_MODE" != true ]; then
    echo -e "${CYAN}🐍 Checking Python environment...${NC}"
    
    # Check if Python is available
    if command -v python3 &> /dev/null; then
        PYTHON_VERSION=$(python3 --version | cut -d' ' -f2)
        echo -e "${GREEN}✅ Found Python $PYTHON_VERSION${NC}"
        
        # Setup Python environment if needed
        setup_python_env() {
            local venv_path="$1"
            local requirements_file="$2"
            local service_name="$3"
            local needs_setup=false
            
            # Check if venv exists
            if [ ! -d "$venv_path" ]; then
                echo -e "${YELLOW}📦 Creating virtual environment for $service_name...${NC}"
                python3 -m venv "$venv_path" || return 1
                needs_setup=true
            fi
            
            # Activate venv
            source "$venv_path/bin/activate"
            
            # Check if dependencies need to be installed
            local marker_file="$venv_path/.deps_installed"
            local requirements_changed=false
            
            # Check if requirements file has changed since last install
            if [ -f "$requirements_file" ] && [ -f "$marker_file" ]; then
                if [ "$requirements_file" -nt "$marker_file" ]; then
                    requirements_changed=true
                    echo -e "${YELLOW}📝 Requirements file has been updated${NC}"
                fi
            fi
            
            # Install dependencies if needed
            if [ "$needs_setup" = true ] || [ "$requirements_changed" = true ] || [ ! -f "$marker_file" ] || ! python3 -c "import uvicorn, fastapi" &> /dev/null 2>&1; then
                echo -e "${YELLOW}📦 Installing requirements for $service_name...${NC}"
                pip install --upgrade pip >/dev/null 2>&1
                if [ -f "$requirements_file" ]; then
                    pip install -r "$requirements_file" >/dev/null 2>&1 || {
                        echo -e "${RED}❌ Failed to install requirements for $service_name${NC}"
                        deactivate
                        return 1
                    }
                else
                    # Install minimal requirements
                    pip install fastapi uvicorn >/dev/null 2>&1
                fi
                # Mark dependencies as installed
                touch "$marker_file"
                echo -e "${GREEN}✅ $service_name environment ready${NC}"
            else
                echo -e "${GREEN}✅ $service_name environment already configured (skipping setup)${NC}"
            fi
            
            deactivate
            return 0
        }
        
        # Setup ml_service environment
        if [ -d "ml_service" ]; then
            setup_python_env "ml_service/venv" "ml_service/requirements.txt" "ml_service" || {
                echo -e "${YELLOW}⚠️ ML service setup failed, continuing without ML services${NC}"
                SKIP_ML=true
            }
        fi
        
        # Setup python-trainer environment
        TRAINER_DIR="backend/src/ai/hybrid-architecture/python-trainer"
        if [ -d "$TRAINER_DIR" ] && [ "$SKIP_ML" != true ]; then
            setup_python_env "$TRAINER_DIR/venv" "$TRAINER_DIR/requirements.txt" "python-trainer" || {
                echo -e "${YELLOW}⚠️ Python trainer setup failed${NC}"
            }
        fi
        
        # Start ML services if setup succeeded
        if [ "$SKIP_ML" != true ]; then
            echo ""
            echo -e "${CYAN}🚀 Starting ML services...${NC}"
            
            # ML Service
            if [ -d "ml_service/venv" ]; then
                start_service "ml_service" "ml_service" \
                    "source venv/bin/activate && uvicorn ml_service:app --host 0.0.0.0 --port 8000 --reload" \
                    "8000" 120
                
                start_service "ml_inference" "ml_service" \
                    "source venv/bin/activate && uvicorn enhanced_inference:app --host 0.0.0.0 --port 8001 --reload" \
                    "8001" 60
                
                start_service "ai_coordination" "ml_service" \
                    "source venv/bin/activate && uvicorn ai_coordination_hub:app --host 0.0.0.0 --port 8003 --reload" \
                    "8003" 60
            fi
            
            # Python Trainer services
            if [ -d "$TRAINER_DIR/venv" ]; then
                start_service "continuous_learning" "$TRAINER_DIR" \
                    "source venv/bin/activate && uvicorn training_service_minimal:app --host 0.0.0.0 --port 8002 --reload" \
                    "8002" 60
                
                # Use minimal version for python_trainer too (TensorFlow issues)
                start_service "python_trainer" "$TRAINER_DIR" \
                    "source venv/bin/activate && uvicorn training_service_minimal:app --host 0.0.0.0 --port 8004 --reload" \
                    "8004" 60
            fi
        fi
    else
        echo -e "${YELLOW}⚠️ Python not found. ML services will not start.${NC}"
        echo -e "${CYAN}💡 To enable ML services:${NC}"
        echo -e "   • Install Python 3.9 or later"
        echo -e "   • Run: npm run start:all (it will set up everything automatically)"
    fi
else
    echo -e "${CYAN}⚡ Skipping ML services in fast mode${NC}"
fi

# =====================================================
# POST-STARTUP VERIFICATION
# =====================================================

echo ""
echo -e "${WHITE}🔍 POST-STARTUP VERIFICATION${NC}"
echo -e "${WHITE}============================${NC}"

# Wait for services to fully initialize
echo -e "${YELLOW}⏳ Allowing services to fully initialize...${NC}"
sleep 10

# Run health checks
run_health_checks

# Calculate total startup time
SCRIPT_END_TIME=$(date +%s)
TOTAL_STARTUP_TIME=$((SCRIPT_END_TIME - SCRIPT_START_TIME))

# =====================================================
# STARTUP SUMMARY
# =====================================================

echo ""
echo -e "${WHITE}🎯 STARTUP SUMMARY${NC}"
echo -e "${WHITE}=================${NC}"

echo -e "${GREEN}✅ Startup completed in ${TOTAL_STARTUP_TIME}s${NC}"
echo -e "${CYAN}🌐 Service URLs:${NC}"
echo "   • Frontend:        http://localhost:3001"
echo "   • Backend API:     http://localhost:3000/api"
echo "   • Backend Health:  http://localhost:3000/api/health"
if [ "$M1_OPTIMIZED" = true ]; then
    echo ""
    echo -e "${CYAN}🍎 M1 Optimization Endpoints:${NC}"
    echo "   • Memory Dashboard: http://localhost:3000/api/dashboard/metrics"
    echo "   • Dashboard Health: http://localhost:3000/api/dashboard/health-summary"
    echo "   • Emergency API:    http://localhost:3000/api/emergency/status"
    echo "   • Stress Testing:   http://localhost:3000/api/dashboard/stress-test/status"
    echo "   • WebSocket Metrics: ws://localhost:3000/metrics"
fi
if [ "$FAST_MODE" != true ]; then
    echo "   • ML Service:      http://localhost:8000"
    echo "   • ML Inference:    http://localhost:8001"
    echo "   • AI Coordination: http://localhost:8003"
fi

echo ""
echo -e "${GREEN}🎮 Ready to play Connect Four!${NC}"
echo -e "${CYAN}🔧 Management Commands:${NC}"
echo "   • npm run stop:all              - Stop all services"
echo "   • npm run restart:all           - Restart all services"
echo "   • npm run restart:all:fast      - Fast restart"
echo "   • npm run health:check          - Check system health"
echo "   • npm run fix:dependencies      - Fix dependency issues"
if [ "$M1_OPTIMIZED" = true ]; then
    echo "   • npm run emergency:cleanup     - Emergency memory cleanup"
    echo "   • npm run m1:monitor            - Monitor M1 performance"
fi

# Show M1 optimization suggestion if on M1 but not enabled
if [ "$IS_M1_MAC" = true ] && [ "$M1_OPTIMIZED" != true ]; then
    echo ""
    echo -e "${YELLOW}💡 Tip: You're on an M1 Mac. To enable optimizations, run:${NC}"
    echo -e "   ${CYAN}npm run start:m1${NC} or ${CYAN}./start-all.sh --m1-opt${NC}"
fi

echo ""
echo -e "${YELLOW}📁 Logs and Monitoring:${NC}"
echo "   • logs/*.log                    - Service logs"
echo "   • logs/performance.log          - Performance metrics (debug mode)"
echo "   • tail -f logs/backend.log      - Follow backend logs"

if [ "$DEBUG_MODE" = true ]; then
    echo ""
    echo -e "${MAGENTA}🐛 Debug Information:${NC}"
    echo "   • Fast Mode:        $FAST_MODE"
    echo "   • Memory Optimized: $MEMORY_OPTIMIZED"
    echo "   • Dev Mode:         $DEV_MODE"
    echo "   • CPU Cores:        $CPU_CORES"
    echo "   • Node Version:     $(node --version)"
    echo "   • NPM Version:      $(npm --version)"
    if command -v python3 >/dev/null 2>&1; then
        echo "   • Python Version:   $(python3 --version)"
    fi
fi

echo ""
echo -e "${WHITE}🎉 Connect Four AI Enterprise System is ready!${NC}"

# Final health check reminder
if run_health_checks >/dev/null 2>&1; then
    echo -e "${GREEN}💚 All systems operational!${NC}"
else
    echo -e "${YELLOW}⚠️  Some services need attention - check logs for details${NC}"
fi