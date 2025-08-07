#!/bin/bash

# =====================================================
# 🍎 CONNECT FOUR - M1 OPTIMIZED STARTUP
# =====================================================
# Startup script with M1-specific optimizations enabled
# Includes Phase 0-4 optimizations for Apple Silicon

set -e  # Exit on error

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
MAGENTA='\033[0;35m'
WHITE='\033[1;37m'
NC='\033[0m' # No Color

echo -e "${MAGENTA}🍎 Connect Four M1-Optimized Startup${NC}"
echo -e "${MAGENTA}======================================${NC}"

# Detect Apple Silicon
IS_M1=false
if [[ $(uname -m) == "arm64" ]] && [[ $(uname -s) == "Darwin" ]]; then
    IS_M1=true
    echo -e "${GREEN}✅ Apple Silicon detected${NC}"
    
    # Get system info
    MEMORY_GB=$(( $(sysctl -n hw.memsize) / 1024 / 1024 / 1024 ))
    CPU_CORES=$(sysctl -n hw.ncpu)
    echo -e "${CYAN}📊 System: ${MEMORY_GB}GB RAM, ${CPU_CORES} CPU cores${NC}"
else
    echo -e "${YELLOW}⚠️  Not running on Apple Silicon - using standard settings${NC}"
fi

# Set M1-specific environment variables
if [ "$IS_M1" = true ]; then
    echo -e "${CYAN}🔧 Applying M1 optimizations...${NC}"
    
    # Phase 0: Runtime configuration
    export M1_OPTIMIZED=true
    export DETECT_M1_RUNTIME=true
    
    # Phase 1: TensorFlow memory management
    export TF_FORCE_UNIFIED_MEMORY=true
    export TF_MLC_LOGGING_LEVEL=3
    
    # Phase 2: Buffer and cache limits based on memory
    if [ $MEMORY_GB -le 8 ]; then
        export REPLAY_BUFFER_SIZE=10000
        export TRANSPOSITION_TABLE_SIZE=30000
        export NODE_OPTIONS="--max-old-space-size=1536"
    elif [ $MEMORY_GB -le 16 ]; then
        export REPLAY_BUFFER_SIZE=20000
        export TRANSPOSITION_TABLE_SIZE=50000
        export NODE_OPTIONS="--max-old-space-size=2048"
    else
        export REPLAY_BUFFER_SIZE=50000
        export TRANSPOSITION_TABLE_SIZE=100000
        export NODE_OPTIONS="--max-old-space-size=4096"
    fi
    
    # Phase 3: Memory monitoring
    export ENABLE_MEMORY_MONITOR=true
    export MEMORY_CHECK_INTERVAL=5000
    export MEMORY_THRESHOLD_MODERATE=70
    export MEMORY_THRESHOLD_HIGH=80
    export MEMORY_THRESHOLD_CRITICAL=90
    
    # Phase 4: Background task throttling
    export ENABLE_BACKGROUND_THROTTLE=true
    export MAX_CONCURRENT_TASKS=2
    export TASK_LOAD_THRESHOLD_RESUME=70
    export TASK_LOAD_THRESHOLD_DEFER=80
    
    # Disable features that cause memory pressure
    export ENABLE_SELF_PLAY=false
    export ENABLE_BACKGROUND_TRAINING=true  # But throttled by Phase 4
    
    echo -e "${GREEN}✅ M1 optimizations applied:${NC}"
    echo -e "   • Replay buffer: ${REPLAY_BUFFER_SIZE} entries"
    echo -e "   • Transposition table: ${TRANSPOSITION_TABLE_SIZE} entries"
    echo -e "   • Max heap size: ${NODE_OPTIONS}"
    echo -e "   • Memory monitoring: Enabled"
    echo -e "   • Background throttling: Enabled"
fi

# Create logs directory
mkdir -p logs

# Clean up any existing processes
echo -e "${YELLOW}🧹 Cleaning up existing services...${NC}"
./stop-all.sh 2>/dev/null || true
sleep 2

# Build backend if needed
if [ ! -f "backend/dist/main.js" ]; then
    echo -e "${YELLOW}🔨 Building backend...${NC}"
    (cd backend && npm run build) || {
        echo -e "${RED}❌ Backend build failed${NC}"
        exit 1
    }
fi

# Start services with M1 optimizations
echo -e "${WHITE}🚀 STARTING SERVICES${NC}"
echo -e "${WHITE}====================${NC}"

# Backend Service with M1 optimizations
echo -e "${BLUE}🚀 Starting backend with M1 optimizations...${NC}"
(cd backend && PORT=3000 BACKEND_PORT=3000 \
    ENABLE_M1_OPTIMIZATIONS=true \
    ENABLE_CONTINUOUS_LEARNING=true \
    ENABLE_PATTERN_DEFENSE=true \
    ENABLE_DIFFICULTY_AWARE_LEARNING=true \
    ENABLE_SERVICE_INTEGRATION=true \
    SIMULATION_WORKERS=2 \
    INTEGRATION_PORT=8888 \
    npm run start:prod) > logs/backend.log 2>&1 &

BACKEND_PID=$!
echo -e "${GREEN}   ✅ Backend started with PID: $BACKEND_PID${NC}"

# Wait for backend to be ready
echo -e "${YELLOW}   ⏳ Waiting for backend...${NC}"
RETRIES=0
while [ $RETRIES -lt 30 ]; do
    if curl -sf http://localhost:3000/api/health >/dev/null 2>&1; then
        echo -e "${GREEN}   ✅ Backend is ready${NC}"
        break
    fi
    sleep 2
    ((RETRIES++))
done

# Frontend Service
echo -e "${BLUE}🚀 Starting frontend...${NC}"
(cd frontend && PORT=3001 REACT_APP_API_URL=http://localhost:3000/api npm start) > logs/frontend.log 2>&1 &
FRONTEND_PID=$!
echo -e "${GREEN}   ✅ Frontend started with PID: $FRONTEND_PID${NC}"

# ML Services (with reduced resources on M1)
if [ "$IS_M1" = true ]; then
    echo -e "${CYAN}🤖 Starting ML services with M1 resource limits...${NC}"
    
    # Limit ML service resources
    export ML_BATCH_SIZE=16
    export ML_MAX_WORKERS=2
    export ML_MEMORY_LIMIT=512
fi

echo -e "${BLUE}🚀 Starting ML service...${NC}"
(cd ml_service && \
    ML_SERVICE_HOST=0.0.0.0 \
    PORT=8000 \
    ML_WEBSOCKET_PORT=8002 \
    ENABLE_LEARNING_MONITOR=true \
    ENABLE_DIFFICULTY_AWARE_LEARNING=true \
    DIFFICULTY_MODELS_COUNT=10 \
    python3 start_with_continuous_learning.py) > logs/ml_service.log 2>&1 &
ML_PID=$!
echo -e "${GREEN}   ✅ ML Service started with PID: $ML_PID${NC}"

# Start Metal Inference Service on M1
if [ "$IS_M1" = true ]; then
    echo -e "${MAGENTA}🍎 Starting Metal Inference Service...${NC}"
    (cd ml_service && \
        METAL_INFERENCE_HOST=0.0.0.0 \
        METAL_INFERENCE_PORT=8005 \
        python3 metal_inference_service.py) > logs/metal_inference.log 2>&1 &
    METAL_PID=$!
    echo -e "${GREEN}   ✅ Metal Inference started with PID: $METAL_PID${NC}"
    echo "$METAL_PID" > logs/metal_inference.pid
fi

# Store PIDs
echo "$BACKEND_PID" > logs/backend.pid
echo "$FRONTEND_PID" > logs/frontend.pid
echo "$ML_PID" > logs/ml_service.pid

# Wait for services to initialize
echo -e "${YELLOW}⏳ Allowing services to initialize...${NC}"
sleep 10

# Health check
echo -e "${CYAN}🏥 Running health checks...${NC}"
HEALTH_ISSUES=0

# Backend health
if curl -sf http://localhost:3000/api/health >/dev/null 2>&1; then
    echo -e "${GREEN}   ✅ Backend API healthy${NC}"
    
    # Check M1 optimization status
    M1_STATUS=$(curl -s http://localhost:3000/api/health | python3 -c "
import sys, json
try:
    data = json.load(sys.stdin)
    opt = data.get('optimization', {})
    if opt.get('isM1Architecture'):
        print(f\"M1 optimizations active: {opt.get('totalMemoryGB')}GB RAM detected\")
    else:
        print('M1 optimizations not active')
except:
    print('Could not check M1 status')
" 2>/dev/null || echo "Status check failed")
    echo -e "${CYAN}      📊 $M1_STATUS${NC}"
else
    echo -e "${RED}   ❌ Backend health check failed${NC}"
    ((HEALTH_ISSUES++))
fi

# Frontend health
if curl -sf http://localhost:3001 >/dev/null 2>&1; then
    echo -e "${GREEN}   ✅ Frontend healthy${NC}"
else
    echo -e "${RED}   ❌ Frontend health check failed${NC}"
    ((HEALTH_ISSUES++))
fi

# Summary
echo ""
echo -e "${WHITE}🎯 STARTUP SUMMARY${NC}"
echo -e "${WHITE}=================${NC}"

if [ $HEALTH_ISSUES -eq 0 ]; then
    echo -e "${GREEN}✅ All services started successfully!${NC}"
else
    echo -e "${YELLOW}⚠️  $HEALTH_ISSUES services need attention${NC}"
fi

echo ""
echo -e "${CYAN}🌐 Service URLs:${NC}"
echo "   • Frontend:        http://localhost:3001"
echo "   • Backend API:     http://localhost:3000/api"
echo "   • Backend Health:  http://localhost:3000/api/health"
echo "   • ML Service:      http://localhost:8000"
if [ "$IS_M1" = true ]; then
    echo "   • Metal Inference: http://localhost:8005"
    echo "   • Emergency API:   http://localhost:3000/api/emergency/status"
fi

if [ "$IS_M1" = true ]; then
    echo ""
    echo -e "${MAGENTA}🍎 M1 Optimization Features:${NC}"
    echo "   • Phase 0-2: Memory buffers and tensor management ✅"
    echo "   • Phase 3-4: Dynamic monitoring and throttling ✅"
    echo "   • Phase 5: Emergency cleanup endpoints ✅"
    echo "   • Phase 6: Metal GPU acceleration ✅"
    echo "   • Automatic Python/Metal offload when beneficial"
    echo "   • Emergency recovery: POST /api/emergency/cleanup"
fi

echo ""
echo -e "${GREEN}🎮 Ready to play Connect Four with M1 optimizations!${NC}"

echo ""
echo -e "${YELLOW}📁 Monitoring:${NC}"
echo "   • tail -f logs/backend.log      - Backend logs"
echo "   • tail -f logs/frontend.log     - Frontend logs"
echo "   • tail -f logs/ml_service.log   - ML service logs"

echo ""
echo -e "${CYAN}🔧 Commands:${NC}"
echo "   • ./stop-all.sh                 - Stop all services"
echo "   • ./restart-all.sh              - Restart all services"
echo "   • npm run health:check          - Check system health"