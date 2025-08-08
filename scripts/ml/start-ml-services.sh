#!/bin/bash

# ML Services Startup Script
# Starts all ML services on their respective ports

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
WHITE='\033[1;37m'
NC='\033[0m' # No Color

# Logging functions
log_info() {
    echo -e "${CYAN}ℹ️  $1${NC}"
}

log_success() {
    echo -e "${GREEN}✅ $1${NC}"
}

log_warning() {
    echo -e "${YELLOW}⚠️  $1${NC}"
}

log_error() {
    echo -e "${RED}❌ $1${NC}"
}

# Get script directory
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
PROJECT_ROOT="$( cd "$SCRIPT_DIR/../.." && pwd )"

# Check if running with --stop flag
if [[ "$1" == "--stop" ]]; then
    log_info "Stopping ML services..."
    
    # Kill services by port
    for port in 8000 8001 8002 8003 8004; do
        if lsof -Pi :$port -sTCP:LISTEN -t >/dev/null 2>&1; then
            lsof -Pi :$port -sTCP:LISTEN -t | xargs kill -9 2>/dev/null || true
            log_success "Stopped service on port $port"
        fi
    done
    
    # Kill any remaining Python processes
    pkill -f "uvicorn.*ml_service" 2>/dev/null || true
    pkill -f "uvicorn.*enhanced_inference" 2>/dev/null || true
    pkill -f "uvicorn.*training_service" 2>/dev/null || true
    pkill -f "uvicorn.*ai_coordination" 2>/dev/null || true
    
    exit 0
fi

# Function to check if a port is available
check_port() {
    local port=$1
    if lsof -Pi :$port -sTCP:LISTEN -t >/dev/null 2>&1; then
        log_warning "Port $port is already in use"
        return 1
    fi
    return 0
}

# Function to wait for service to be ready
wait_for_service() {
    local port=$1
    local service_name=$2
    local max_attempts=30
    local attempt=0
    
    log_info "Waiting for $service_name to be ready on port $port..."
    
    while [ $attempt -lt $max_attempts ]; do
        if curl -s "http://localhost:$port/health" >/dev/null 2>&1; then
            log_success "$service_name is ready on port $port"
            return 0
        fi
        sleep 1
        attempt=$((attempt + 1))
    done
    
    log_error "$service_name failed to start on port $port"
    return 1
}

# Function to start a service
start_service() {
    local name=$1
    local dir=$2
    local command=$3
    local port=$4
    local log_file="$PROJECT_ROOT/logs/${name}.log"
    
    log_info "Starting $name on port $port..."
    
    # Check if port is available
    if ! check_port $port; then
        log_warning "Skipping $name - port $port already in use"
        return 0
    fi
    
    # Create log directory if it doesn't exist
    mkdir -p "$PROJECT_ROOT/logs"
    
    # Start the service
    cd "$dir"
    nohup $command > "$log_file" 2>&1 &
    local pid=$!
    echo $pid > "$PROJECT_ROOT/logs/${name}.pid"
    
    # Wait for service to be ready
    if wait_for_service $port "$name"; then
        log_success "$name started successfully (PID: $pid)"
        return 0
    else
        log_error "Failed to start $name"
        return 1
    fi
}

# Main execution
echo -e "${WHITE}🚀 ML Services Startup Script${NC}"
echo -e "${WHITE}================================${NC}"

# Check Python installation
if ! command -v python3 &> /dev/null; then
    log_error "Python 3 is not installed. Please install Python 3.9+"
    exit 1
fi

# Check for virtual environment
VENV_PATH="$PROJECT_ROOT/ml_service/venv"
if [ ! -d "$VENV_PATH" ]; then
    log_warning "Virtual environment not found. Creating one..."
    cd "$PROJECT_ROOT/ml_service"
    python3 -m venv venv
    source venv/bin/activate
    pip install --upgrade pip
    pip install -r requirements.txt
else
    source "$VENV_PATH/bin/activate"
fi

# Start services
log_info "Starting ML services..."

# 1. ML Service (port 8000)
start_service "ml_service" \
    "$PROJECT_ROOT/ml_service" \
    "uvicorn ml_service:app --host 0.0.0.0 --port 8000 --reload" \
    8000

# 2. ML Inference (port 8001)
start_service "ml_inference" \
    "$PROJECT_ROOT/ml_service" \
    "uvicorn enhanced_inference:app --host 0.0.0.0 --port 8001 --reload" \
    8001

# 3. Continuous Learning (port 8002)
start_service "continuous_learning" \
    "$PROJECT_ROOT/backend/src/ai/hybrid-architecture/python-trainer" \
    "uvicorn training_service_minimal:app --host 0.0.0.0 --port 8002 --reload" \
    8002

# 4. AI Coordination (port 8003)
start_service "ai_coordination" \
    "$PROJECT_ROOT/ml_service" \
    "uvicorn ai_coordination_hub:app --host 0.0.0.0 --port 8003 --reload" \
    8003

# 5. Python Trainer (port 8004)
start_service "python_trainer" \
    "$PROJECT_ROOT/backend/src/ai/hybrid-architecture/python-trainer" \
    "uvicorn training_service:app --host 0.0.0.0 --port 8004 --reload" \
    8004

# Summary
echo ""
echo -e "${WHITE}📊 ML Services Status${NC}"
echo -e "${WHITE}=====================${NC}"

# Check all services
all_healthy=true
for port in 8000 8001 8002 8003 8004; do
    if curl -s "http://localhost:$port/health" >/dev/null 2>&1; then
        echo -e "Port $port: ${GREEN}✅ Healthy${NC}"
    else
        echo -e "Port $port: ${RED}❌ Not responding${NC}"
        all_healthy=false
    fi
done

if $all_healthy; then
    echo ""
    log_success "All ML services are running!"
    echo -e "${CYAN}📌 Service URLs:${NC}"
    echo "   • ML Service:          http://localhost:8000"
    echo "   • ML Inference:        http://localhost:8001"
    echo "   • Continuous Learning: http://localhost:8002"
    echo "   • AI Coordination:     http://localhost:8003"
    echo "   • Python Trainer:      http://localhost:8004"
    echo ""
    echo -e "${CYAN}💡 To stop all ML services, run:${NC}"
    echo "   $0 --stop"
else
    log_warning "Some services failed to start. Check logs in $PROJECT_ROOT/logs/"
fi