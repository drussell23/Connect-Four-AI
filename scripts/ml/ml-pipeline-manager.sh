#!/bin/bash

# ============================================================================
# ML Pipeline Manager v2.0 - AI-Enhanced Enterprise ML Management
# Integrates with Unified Enterprise Launcher and AI Stability System
# ============================================================================

set -euo pipefail

# Script configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
LOG_FILE="$PROJECT_ROOT/logs/ml-pipeline-v2.log"
CONFIG_FILE="$PROJECT_ROOT/logs/ml-config.json"
ENTERPRISE_LAUNCHER="$PROJECT_ROOT/scripts/enterprise/unified-enterprise-launcher.js"

# Colors for enhanced output
declare -A COLORS=(
    [RED]='\033[0;31m'    [GREEN]='\033[0;32m'   [YELLOW]='\033[0;33m'
    [BLUE]='\033[0;34m'   [PURPLE]='\033[0;35m'  [CYAN]='\033[0;36m'
    [WHITE]='\033[0;37m'  [BOLD]='\033[1m'       [RESET]='\033[0m'
)

# ML Pipeline Configuration
declare -A ML_SERVICES=(
    [ml_service]=8000
    [model_manager]=8001
    [training_service]=8002
    [inference_api]=8003
    [monitoring_service]=8004
)

declare -A ML_COMPONENTS=(
    [policy_net]="AI Policy Network"
    [value_network]="Value Function Network"
    [opponent_model]="Opponent Modeling System"
    [self_play]="Self-Play Training Engine"
    [evaluation]="Model Evaluation System"
    [deployment]="Model Deployment Pipeline"
)

# Logging functions
log() {
    local level="$1" && shift
    local color_key="$1" && shift
    local timestamp=$(date '+%Y-%m-%d %H:%M:%S')
    printf "${COLORS[$color_key]}[%s] %s${COLORS[RESET]} %s\n" "$level" "$timestamp" "$*"
    echo "[$level] $timestamp $*" >> "$LOG_FILE"
}

info()    { log "INFO"    "BLUE"   "$@"; }
success() { log "SUCCESS" "GREEN"  "$@"; }
warning() { log "WARN"    "YELLOW" "$@"; }
error()   { log "ERROR"   "RED"    "$@"; }

# Initialize logging
init_logging() {
    mkdir -p "$(dirname "$LOG_FILE")"
    info "ML Pipeline Manager v2.0 - AI-Enhanced Enterprise ML Management"
    info "Log file: $LOG_FILE"
}

# Check enterprise launcher integration
check_enterprise_integration() {
    if [[ -f "$ENTERPRISE_LAUNCHER" ]]; then
        info "Enterprise launcher integration available"
        return 0
    else
        warning "Enterprise launcher not found - using standalone mode"
        return 1
    fi
}

# Check if enterprise launcher is running
is_enterprise_running() {
    if pgrep -f "unified-enterprise-launcher" >/dev/null; then
        return 0
    else
        return 1
    fi
}

# Start ML service through enterprise launcher
start_ml_enterprise() {
    local profile="${1:-development}"
    
    info "Starting ML services through enterprise launcher (profile: $profile)"
    
    if is_enterprise_running; then
        warning "Enterprise launcher already running"
        return 0
    fi
    
    if check_enterprise_integration; then
        node "$ENTERPRISE_LAUNCHER" --profile "$profile" &
        local launcher_pid=$!
        
        info "Enterprise launcher started (PID: $launcher_pid)"
        
        # Wait for ML service to be ready
        local retries=0
        local max_retries=30
        
        while ((retries < max_retries)); do
            if check_ml_service_health; then
                success "ML services ready through enterprise launcher"
                return 0
            fi
            
            sleep 2
            ((retries++))
            info "Waiting for ML services... ($retries/$max_retries)"
        done
        
        error "ML services failed to start through enterprise launcher"
        return 1
    else
        error "Enterprise launcher not available"
        return 1
    fi
}

# Check ML service health
check_ml_service_health() {
    local ml_port="${ML_SERVICES[ml_service]}"
    
    if command -v curl >/dev/null 2>&1; then
        curl -s "http://localhost:$ml_port/health" >/dev/null 2>&1
    else
        # Fallback to port check
        lsof -i ":$ml_port" >/dev/null 2>&1
    fi
}

# Enhanced ML pipeline status
show_ml_status() {
    local detailed="${1:-false}"
    
    info "ML Pipeline Status Report"
    echo
    printf "${COLORS[BOLD]}%-20s %-8s %-15s %-30s${COLORS[RESET]}\n" \
           "SERVICE" "PORT" "STATUS" "DESCRIPTION"
    printf "${COLORS[CYAN]}%s${COLORS[RESET]}\n" "$(printf '%.75s' "$(yes '-' | head -75 | tr -d '\n')")"
    
    # Check enterprise launcher status
    if is_enterprise_running; then
        printf "${COLORS[GREEN]}%-20s %-8s %-15s %-30s${COLORS[RESET]}\n" \
               "enterprise" "N/A" "🟢 RUNNING" "Unified Enterprise Launcher"
    else
        printf "${COLORS[RED]}%-20s %-8s %-15s %-30s${COLORS[RESET]}\n" \
               "enterprise" "N/A" "🔴 STOPPED" "Unified Enterprise Launcher"
    fi
    
    # Check ML services
    for service in "${!ML_SERVICES[@]}"; do
        local port="${ML_SERVICES[$service]}"
        local description="ML Service: $service"
        
        if lsof -i ":$port" >/dev/null 2>&1; then
            local process_info=$(lsof -i ":$port" 2>/dev/null | tail -n +2 | head -1)
            local pid=$(echo "$process_info" | awk '{print $2}')
            
            if ps -p "$pid" -o command= 2>/dev/null | grep -q "enterprise"; then
                printf "${COLORS[GREEN]}%-20s %-8s %-15s %-30s${COLORS[RESET]}\n" \
                       "$service" "$port" "🟢 ENTERPRISE" "$description"
            else
                printf "${COLORS[YELLOW]}%-20s %-8s %-15s %-30s${COLORS[RESET]}\n" \
                       "$service" "$port" "🟡 STANDALONE" "$description"
            fi
            
            if [[ "$detailed" == "true" ]]; then
                printf "   ${COLORS[WHITE]}PID: %s${COLORS[RESET]}\n" "$pid"
            fi
        else
            printf "${COLORS[WHITE]}%-20s %-8s %-15s %-30s${COLORS[RESET]}\n" \
                   "$service" "$port" "⚪ AVAILABLE" "$description"
        fi
    done
    
    echo
    info "Legend: 🟢 Enterprise Managed | 🟡 Standalone | ⚪ Available"
}

# Show ML component status
show_ml_components() {
    info "ML Component Status"
    echo
    printf "${COLORS[BOLD]}%-20s %-50s %-15s${COLORS[RESET]}\n" \
           "COMPONENT" "DESCRIPTION" "STATUS"
    printf "${COLORS[CYAN]}%s${COLORS[RESET]}\n" "$(printf '%.85s' "$(yes '-' | head -85 | tr -d '\n')")"
    
    for component in "${!ML_COMPONENTS[@]}"; do
        local description="${ML_COMPONENTS[$component]}"
        local status="⚪ READY"
        local color="WHITE"
        
        # Check if component models exist
        if [[ -d "$PROJECT_ROOT/models" ]]; then
            if find "$PROJECT_ROOT/models" -name "*$component*" -type f | grep -q .; then
                status="🟢 TRAINED"
                color="GREEN"
            fi
        fi
        
        printf "${COLORS[$color]}%-20s %-50s %-15s${COLORS[RESET]}\n" \
               "$component" "$description" "$status"
    done
    
    echo
}

# Start training pipeline
start_training() {
    local algorithm="${1:-ppo}"
    local episodes="${2:-1000}"
    
    info "Starting training pipeline: $algorithm ($episodes episodes)"
    
    # Check if enterprise launcher is available for resource management
    if check_enterprise_integration && is_enterprise_running; then
        info "Using enterprise resource management for training"
        
        # Use enterprise model manager if available
        if [[ -f "$PROJECT_ROOT/scripts/enterprise/enterprise-model-manager.js" ]]; then
            node "$PROJECT_ROOT/scripts/enterprise/enterprise-model-manager.js" train \
                --algorithm "$algorithm" \
                --episodes "$episodes" \
                --enterprise-managed
        else
            warning "Enterprise model manager not found, using legacy training"
            start_legacy_training "$algorithm" "$episodes"
        fi
    else
        warning "Enterprise launcher not available, using standalone training"
        start_legacy_training "$algorithm" "$episodes"
    fi
}

# Legacy training fallback
start_legacy_training() {
    local algorithm="$1"
    local episodes="$2"
    
    info "Starting legacy training mode"
    
    # Use the legacy enhanced-pipeline.sh if available
    if [[ -f "$SCRIPT_DIR/enhanced-pipeline.sh" ]]; then
        cd "$PROJECT_ROOT"
        bash "$SCRIPT_DIR/enhanced-pipeline.sh" train --algorithm "$algorithm" --episodes "$episodes"
    else
        error "Legacy training pipeline not found"
        return 1
    fi
}

# Deploy model using enterprise system
deploy_model() {
    local model_name="${1:-latest}"
    local environment="${2:-development}"
    
    info "Deploying model: $model_name to $environment environment"
    
    if check_enterprise_integration; then
        # Use enterprise deployment manager
        if [[ -f "$PROJECT_ROOT/scripts/enterprise/advanced-deployment-manager.js" ]]; then
            node "$PROJECT_ROOT/scripts/enterprise/advanced-deployment-manager.js" deploy-model \
                --model "$model_name" \
                --environment "$environment" \
                --ai-enhanced
            
            success "Model deployment initiated through enterprise system"
        else
            warning "Enterprise deployment manager not found"
            deploy_model_standalone "$model_name"
        fi
    else
        deploy_model_standalone "$model_name"
    fi
}

# Standalone model deployment
deploy_model_standalone() {
    local model_name="$1"
    
    info "Deploying model in standalone mode: $model_name"
    
    # Check if model exists
    if [[ -f "$PROJECT_ROOT/models/$model_name.pkl" ]] || [[ -f "$PROJECT_ROOT/models/$model_name.h5" ]]; then
        # Copy model to deployment directory
        mkdir -p "$PROJECT_ROOT/ml_service/models/deployed"
        cp "$PROJECT_ROOT/models/$model_name"* "$PROJECT_ROOT/ml_service/models/deployed/" 2>/dev/null || true
        
        success "Model $model_name deployed successfully"
    else
        error "Model $model_name not found in models directory"
        return 1
    fi
}

# Run ML evaluation
run_evaluation() {
    local model_name="${1:-latest}"
    local games="${2:-100}"
    
    info "Running evaluation: $model_name ($games games)"
    
    if check_ml_service_health; then
        # Use ML service API for evaluation
        local ml_port="${ML_SERVICES[ml_service]}"
        
        if command -v curl >/dev/null 2>&1; then
            curl -X POST "http://localhost:$ml_port/evaluate" \
                -H "Content-Type: application/json" \
                -d "{\"model\":\"$model_name\", \"games\":$games}" \
                2>/dev/null || {
                warning "API evaluation failed, using fallback method"
                run_evaluation_fallback "$model_name" "$games"
            }
        else
            run_evaluation_fallback "$model_name" "$games"
        fi
    else
        error "ML service not available for evaluation"
        return 1
    fi
}

# Fallback evaluation method
run_evaluation_fallback() {
    local model_name="$1"
    local games="$2"
    
    info "Running evaluation in fallback mode"
    
    # Use Python evaluation script if available
    if [[ -f "$PROJECT_ROOT/ml_service/src/evaluate.py" ]]; then
        cd "$PROJECT_ROOT/ml_service"
        python src/evaluate.py --model "$model_name" --games "$games"
    else
        error "Evaluation script not found"
        return 1
    fi
}

# Stop ML services
stop_ml_services() {
    info "Stopping ML services..."
    
    if is_enterprise_running; then
        warning "Enterprise launcher is running - services are managed by enterprise system"
        read -p "Do you want to stop the entire enterprise system? (y/N): " -n 1 -r
        echo
        
        if [[ $REPLY =~ ^[Yy]$ ]]; then
            pkill -f "unified-enterprise-launcher" || true
            success "Enterprise system stopped"
        else
            info "Leaving enterprise system running"
            return 0
        fi
    fi
    
    # Stop individual ML services
    local stopped=0
    for service in "${!ML_SERVICES[@]}"; do
        local port="${ML_SERVICES[$service]}"
        
        if lsof -i ":$port" >/dev/null 2>&1; then
            local pids=$(lsof -t -i ":$port" 2>/dev/null || true)
            
            for pid in $pids; do
                if [[ -n "$pid" ]]; then
                    kill -TERM "$pid" 2>/dev/null || kill -KILL "$pid" 2>/dev/null
                    info "Stopped $service (PID: $pid)"
                    ((stopped++))
                fi
            done
        fi
    done
    
    success "Stopped $stopped ML service(s)"
}

# Main menu
show_menu() {
    echo
    info "AI-Enhanced ML Pipeline Manager v2.0"
    echo
    echo "1. Show ML status"
    echo "2. Show ML components"
    echo "3. Start ML services (enterprise)"
    echo "4. Start training pipeline"
    echo "5. Deploy model"
    echo "6. Run evaluation"
    echo "7. Stop ML services"
    echo "8. Enterprise integration status"
    echo "0. Exit"
    echo
}

# Main execution
main() {
    init_logging
    
    case "${1:-menu}" in
        status|--status)
            show_ml_status false
            ;;
        detailed|--detailed)
            show_ml_status true
            ;;
        components|--components)
            show_ml_components
            ;;
        start|--start)
            local profile="${2:-development}"
            start_ml_enterprise "$profile"
            ;;
        train|--train)
            local algorithm="${2:-ppo}"
            local episodes="${3:-1000}"
            start_training "$algorithm" "$episodes"
            ;;
        deploy|--deploy)
            local model="${2:-latest}"
            local env="${3:-development}"
            deploy_model "$model" "$env"
            ;;
        evaluate|--evaluate)
            local model="${2:-latest}"
            local games="${3:-100}"
            run_evaluation "$model" "$games"
            ;;
        stop|--stop)
            stop_ml_services
            ;;
        enterprise|--enterprise)
            if check_enterprise_integration; then
                success "Enterprise integration available"
                if is_enterprise_running; then
                    success "Enterprise launcher is running"
                else
                    info "Enterprise launcher is available but not running"
                fi
            else
                warning "Enterprise integration not available"
            fi
            ;;
        menu|--menu)
            while true; do
                show_menu
                read -p "Select option (0-8): " choice
                
                case "$choice" in
                    1) show_ml_status false ;;
                    2) show_ml_components ;;
                    3) 
                        read -p "Enter profile (minimal/development/production/enterprise): " profile
                        profile=${profile:-development}
                        start_ml_enterprise "$profile"
                        ;;
                    4)
                        read -p "Enter algorithm (ppo/dqn/a2c): " algorithm
                        read -p "Enter episodes (default 1000): " episodes
                        algorithm=${algorithm:-ppo}
                        episodes=${episodes:-1000}
                        start_training "$algorithm" "$episodes"
                        ;;
                    5)
                        read -p "Enter model name (default latest): " model
                        read -p "Enter environment (development/production): " env
                        model=${model:-latest}
                        env=${env:-development}
                        deploy_model "$model" "$env"
                        ;;
                    6)
                        read -p "Enter model name (default latest): " model
                        read -p "Enter number of games (default 100): " games
                        model=${model:-latest}
                        games=${games:-100}
                        run_evaluation "$model" "$games"
                        ;;
                    7) stop_ml_services ;;
                    8) main enterprise ;;
                    0) info "Goodbye!"; exit 0 ;;
                    *) error "Invalid option: $choice" ;;
                esac
                
                echo
                read -p "Press Enter to continue..."
            done
            ;;
        help|--help|-h)
            echo "ML Pipeline Manager v2.0 - AI-Enhanced Enterprise ML Management"
            echo
            echo "Usage: $0 [command] [options]"
            echo
            echo "Commands:"
            echo "  status          Show ML services status"
            echo "  components      Show ML components status"
            echo "  start [profile] Start ML services through enterprise launcher"
            echo "  train [alg] [ep] Start training pipeline"
            echo "  deploy [model] [env] Deploy model to environment"
            echo "  evaluate [model] [games] Run model evaluation"
            echo "  stop            Stop ML services"
            echo "  enterprise      Check enterprise integration"
            echo "  menu            Interactive menu (default)"
            echo "  help            Show this help"
            echo
            echo "Examples:"
            echo "  $0 start development"
            echo "  $0 train ppo 2000"
            echo "  $0 deploy best_model production"
            echo "  $0 evaluate latest 500"
            echo
            ;;
        *)
            error "Unknown command: $1"
            echo "Use '$0 help' for usage information"
            exit 1
            ;;
    esac
}

# Execute main function with all arguments
main "$@" 