#!/usr/bin/env bash
set -euo pipefail

# ============================================================================
# ML Manager - Companion script for smart-ml-pipeline.sh
# Provides control, monitoring, and management capabilities
# ============================================================================

# Color definitions
declare -A COLORS=(
    [RED]='\033[0;31m'    [GREEN]='\033[0;32m'   [YELLOW]='\033[0;33m'
    [BLUE]='\033[0;34m'   [PURPLE]='\033[0;35m'  [CYAN]='\033[0;36m'
    [WHITE]='\033[0;37m'  [BOLD]='\033[1m'       [RESET]='\033[0m'
)

# Configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PID_FILE="$SCRIPT_DIR/ml-pipeline.pid"
LOG_FILE="$SCRIPT_DIR/ml-pipeline.log"
MONITOR_PORT=8001
API_PORT=8000

# Logging functions
log() {
    local level="$1" && shift
    local color_key="$1" && shift
    printf "${COLORS[$color_key]}[%s] %s${COLORS[RESET]}\n" "$level" "$*"
}

info()    { log "INFO"    "BLUE"   "$@"; }
warn()    { log "WARN"    "YELLOW" "$@"; }
error()   { log "ERROR"   "RED"    "$@"; }
success() { log "SUCCESS" "GREEN"  "$@"; }

# ============================================================================
# Core Functions
# ============================================================================

check_status() {
    info "🔍 Checking ML Pipeline status..."
    
    local status="STOPPED"
    local pid=""
    local uptime=""
    local memory_usage=""
    local cpu_usage=""
    
    # Check if PID file exists and process is running
    if [[ -f "$PID_FILE" ]]; then
        pid=$(cat "$PID_FILE" 2>/dev/null || echo "")
        if [[ -n "$pid" ]] && kill -0 "$pid" 2>/dev/null; then
            status="RUNNING"
            
            # Get uptime
            if command -v ps >/dev/null 2>&1; then
                local start_time=$(ps -o lstart= -p "$pid" 2>/dev/null || echo "")
                if [[ -n "$start_time" ]]; then
                    uptime="Started: $start_time"
                fi
            fi
            
            # Get resource usage
            if command -v ps >/dev/null 2>&1; then
                memory_usage=$(ps -o rss= -p "$pid" 2>/dev/null | awk '{print $1/1024 " MB"}' || echo "N/A")
                cpu_usage=$(ps -o %cpu= -p "$pid" 2>/dev/null | awk '{print $1"%"}' || echo "N/A")
            fi
        else
            warn "PID file exists but process not running, cleaning up..."
            rm -f "$PID_FILE"
        fi
    fi
    
    # Check ports
    local api_status="STOPPED"
    local monitor_status="STOPPED"
    
    if lsof -ti tcp:"$API_PORT" >/dev/null 2>&1; then
        api_status="RUNNING"
    fi
    
    if lsof -ti tcp:"$MONITOR_PORT" >/dev/null 2>&1; then
        monitor_status="RUNNING"
    fi
    
    # Display status
    echo
    printf "${COLORS[BOLD]}${COLORS[CYAN]}ML Pipeline Status${COLORS[RESET]}\n"
    printf "${COLORS[CYAN]}%s${COLORS[RESET]}\n" "$(printf '=%.0s' {1..50})"
    printf "%-20s: %s\n" "Overall Status" "$(
        if [[ "$status" == "RUNNING" ]]; then
            printf "${COLORS[GREEN]}%s${COLORS[RESET]}" "$status"
        else
            printf "${COLORS[RED]}%s${COLORS[RESET]}" "$status"
        fi
    )"
    
    if [[ "$status" == "RUNNING" ]]; then
        printf "%-20s: %s\n" "Process ID" "$pid"
        [[ -n "$uptime" ]] && printf "%-20s: %s\n" "Uptime" "$uptime"
        [[ -n "$memory_usage" ]] && printf "%-20s: %s\n" "Memory Usage" "$memory_usage"
        [[ -n "$cpu_usage" ]] && printf "%-20s: %s\n" "CPU Usage" "$cpu_usage"
    fi
    
    printf "%-20s: %s\n" "API Server" "$(
        if [[ "$api_status" == "RUNNING" ]]; then
            printf "${COLORS[GREEN]}%s${COLORS[RESET]} (port %d)" "$api_status" "$API_PORT"
        else
            printf "${COLORS[RED]}%s${COLORS[RESET]}" "$api_status"
        fi
    )"
    
    printf "%-20s: %s\n" "Monitor Dashboard" "$(
        if [[ "$monitor_status" == "RUNNING" ]]; then
            printf "${COLORS[GREEN]}%s${COLORS[RESET]} (port %d)" "$monitor_status" "$MONITOR_PORT"
        else
            printf "${COLORS[RED]}%s${COLORS[RESET]}" "$monitor_status"
        fi
    )"
    
    # Show recent logs
    if [[ -f "$LOG_FILE" ]] && [[ "$status" == "RUNNING" ]]; then
        echo
        printf "${COLORS[CYAN]}Recent Activity (last 5 lines):${COLORS[RESET]}\n"
        tail -n 5 "$LOG_FILE" 2>/dev/null | while IFS= read -r line; do
            printf "${COLORS[DIM]}%s${COLORS[RESET]}\n" "$line"
        done
    fi
    
    echo
}

stop_pipeline() {
    info "🛑 Stopping ML Pipeline..."
    
    local stopped=false
    
    # Stop main process
    if [[ -f "$PID_FILE" ]]; then
        local pid=$(cat "$PID_FILE" 2>/dev/null || echo "")
        if [[ -n "$pid" ]] && kill -0 "$pid" 2>/dev/null; then
            info "Terminating main process (PID: $pid)..."
            kill -TERM "$pid" 2>/dev/null || true
            
            # Wait for graceful shutdown
            local count=0
            while kill -0 "$pid" 2>/dev/null && [[ $count -lt 10 ]]; do
                sleep 1
                ((count++))
            done
            
            # Force kill if still running
            if kill -0 "$pid" 2>/dev/null; then
                warn "Force killing process..."
                kill -KILL "$pid" 2>/dev/null || true
            fi
            
            stopped=true
        fi
        rm -f "$PID_FILE"
    fi
    
    # Stop API server
    local api_pid=$(lsof -ti tcp:"$API_PORT" 2>/dev/null || echo "")
    if [[ -n "$api_pid" ]]; then
        info "Stopping API server (PID: $api_pid)..."
        kill -TERM "$api_pid" 2>/dev/null || true
        sleep 2
        kill -KILL "$api_pid" 2>/dev/null || true
        stopped=true
    fi
    
    # Stop monitor
    local monitor_pid=$(lsof -ti tcp:"$MONITOR_PORT" 2>/dev/null || echo "")
    if [[ -n "$monitor_pid" ]]; then
        info "Stopping monitor dashboard (PID: $monitor_pid)..."
        kill -TERM "$monitor_pid" 2>/dev/null || true
        sleep 2
        kill -KILL "$monitor_pid" 2>/dev/null || true
        stopped=true
    fi
    
    if [[ "$stopped" == "true" ]]; then
        success "✅ ML Pipeline stopped successfully"
    else
        info "ℹ️  No running processes found"
    fi
}

show_logs() {
    if [[ -f "$LOG_FILE" ]]; then
        info "📄 Showing ML Pipeline logs (press Ctrl+C to exit):"
        echo
        tail -f "$LOG_FILE"
    else
        warn "No log file found at: $LOG_FILE"
    fi
}

show_metrics() {
    info "📊 Fetching ML Pipeline metrics..."
    
    if ! command -v curl >/dev/null 2>&1; then
        error "curl not found. Please install curl to view metrics."
        return 1
    fi
    
    local url="http://localhost:$MONITOR_PORT/metrics"
    
    if curl -s --connect-timeout 5 "$url" >/dev/null 2>&1; then
        echo
        printf "${COLORS[CYAN]}ML Pipeline Metrics:${COLORS[RESET]}\n"
        curl -s "$url" | python3 -m json.tool 2>/dev/null || curl -s "$url"
        echo
    else
        warn "Monitoring dashboard not accessible at: $url"
        info "Start monitoring with: npm run train:monitor"
    fi
}

restart_pipeline() {
    info "🔄 Restarting ML Pipeline..."
    stop_pipeline
    sleep 2
    
    info "🚀 Starting ML Pipeline in background..."
    cd "$SCRIPT_DIR"
    nohup ./smart-ml-pipeline.sh --monitor > ml-pipeline-startup.log 2>&1 &
    echo $! > "$PID_FILE"
    
    sleep 3
    check_status
}

cleanup_resources() {
    info "🧹 Cleaning up ML resources..."
    
    # Remove temporary files
    rm -f ml-pipeline.log ml-pipeline.pid resource-monitor.log worker_*.log
    rm -rf backend/src/ml/data/parallel/
    rm -f backend/src/ml/data/raw_games.json.*
    
    # Clean up old model files
    find models/ -name "fine_tuned_*.pt" -mtime +7 -delete 2>/dev/null || true
    
    success "✅ Resources cleaned up"
}

emergency_stop() {
    error "🚨 Emergency stop initiated!"
    
    # Kill all related processes
    pkill -f "smart-ml-pipeline" 2>/dev/null || true
    pkill -f "generate_game_data" 2>/dev/null || true
    pkill -f "train_policy" 2>/dev/null || true
    
    # Kill processes on our ports
    for port in "$API_PORT" "$MONITOR_PORT"; do
        lsof -ti tcp:"$port" | xargs -r kill -9 2>/dev/null || true
    done
    
    # Clean up files
    rm -f "$PID_FILE"
    
    success "✅ Emergency stop completed"
}

show_help() {
    cat << EOF
${COLORS[BOLD]}ML Manager - Control and monitor ML Pipeline${COLORS[RESET]}

${COLORS[CYAN]}USAGE:${COLORS[RESET]}
    $0 <command>

${COLORS[CYAN]}COMMANDS:${COLORS[RESET]}
    status              Show pipeline status and resource usage
    stop               Stop the ML pipeline gracefully
    restart            Restart the ML pipeline
    logs               Show and follow log output
    metrics            Display real-time metrics
    cleanup            Clean up temporary files and resources
    emergency          Emergency stop (force kill all processes)
    help               Show this help message

${COLORS[CYAN]}EXAMPLES:${COLORS[RESET]}
    $0 status          # Check current status
    $0 logs            # Follow logs in real-time
    $0 restart         # Restart the pipeline
    $0 emergency       # Emergency stop all processes

${COLORS[CYAN]}MONITORING:${COLORS[RESET]}
    Dashboard: http://localhost:$MONITOR_PORT/metrics
    Logs:      $LOG_FILE
EOF
}

# ============================================================================
# Main Entry Point
# ============================================================================

main() {
    local command="${1:-help}"
    
    case "$command" in
        status)     check_status ;;
        stop)       stop_pipeline ;;
        restart)    restart_pipeline ;;
        logs)       show_logs ;;
        metrics)    show_metrics ;;
        cleanup)    cleanup_resources ;;
        emergency)  emergency_stop ;;
        help|-h)    show_help ;;
        *)          error "Unknown command: $command"; show_help; exit 1 ;;
    esac
}

# Execute if run directly
if [[ "${BASH_SOURCE[0]}" == "${0}" ]]; then
    main "$@"
fi 