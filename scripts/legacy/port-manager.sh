#!/bin/bash

# Advanced Port Manager for Connect Four Game
# Handles port conflicts, service management, and cleanup
# Supports backend, frontend, and development services

set -e

# Configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
LOG_FILE="$SCRIPT_DIR/port-manager.log"
CONFIG_FILE="$SCRIPT_DIR/.port-config"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
PURPLE='\033[0;35m'
CYAN='\033[0;36m'
WHITE='\033[1;37m'
NC='\033[0m' # No Color

# Default port configurations
DEFAULT_BACKEND_PORT=3000
DEFAULT_FRONTEND_PORT=3001
DEFAULT_ML_SERVICE_PORT=8000
DEFAULT_ML_INFERENCE_PORT=8001

# Common development ports to check
DEV_PORTS=(3000 3001 3002 3003 3004 3005 3006 8000 8001 8002 8080 8888 5000 5001 9000)

# Service definitions (compatible with older bash)
get_service_info() {
    local service=$1
    case $service in
        "backend")
            echo "$DEFAULT_BACKEND_PORT:Backend API:npm run start:dev"
            ;;
        "frontend") 
            echo "$DEFAULT_FRONTEND_PORT:Frontend React:npm start"
            ;;
        "ml-service")
            echo "$DEFAULT_ML_SERVICE_PORT:ML Service:python ml_service.py"
            ;;
        "ml-inference")
            echo "$DEFAULT_ML_INFERENCE_PORT:ML Inference:python -m src.ml_service"
            ;;
        *)
            echo ""
            ;;
    esac
}

# List of available services
AVAILABLE_SERVICES="backend frontend ml-service ml-inference"

# Logging function
log() {
    local level=$1
    shift
    local message="$*"
    local timestamp=$(date '+%Y-%m-%d %H:%M:%S')
    echo "[$timestamp] [$level] $message" >> "$LOG_FILE"
    
    case $level in
        "ERROR")   echo -e "${RED}[ERROR]${NC} $message" ;;
        "SUCCESS") echo -e "${GREEN}[SUCCESS]${NC} $message" ;;
        "WARNING") echo -e "${YELLOW}[WARNING]${NC} $message" ;;
        "INFO")    echo -e "${BLUE}[INFO]${NC} $message" ;;
        "DEBUG")   echo -e "${PURPLE}[DEBUG]${NC} $message" ;;
        *)         echo -e "${WHITE}$message${NC}" ;;
    esac
}

# Display banner
show_banner() {
    echo -e "${CYAN}"
    echo "╔══════════════════════════════════════════════════════════════╗"
    echo "║                    🚀 PORT MANAGER 🚀                        ║"
    echo "║              Advanced Port & Service Management              ║"
    echo "║                   Connect Four Game                          ║"
    echo "╚══════════════════════════════════════════════════════════════╝"
    echo -e "${NC}"
}

# Get process info for a port
get_port_info() {
    local port=$1
    local result=""
    
    # Try different methods to get process info
    if command -v lsof >/dev/null 2>&1; then
        result=$(lsof -i :$port -sTCP:LISTEN 2>/dev/null | tail -n +2)
    elif command -v netstat >/dev/null 2>&1; then
        result=$(netstat -tlnp 2>/dev/null | grep ":$port ")
    elif command -v ss >/dev/null 2>&1; then
        result=$(ss -tlnp 2>/dev/null | grep ":$port ")
    fi
    
    echo "$result"
}

# Get PID for a port
get_port_pid() {
    local port=$1
    
    if command -v lsof >/dev/null 2>&1; then
        lsof -t -i:$port -sTCP:LISTEN 2>/dev/null
    elif command -v netstat >/dev/null 2>&1; then
        netstat -tlnp 2>/dev/null | grep ":$port " | awk '{print $7}' | cut -d'/' -f1
    elif command -v ss >/dev/null 2>&1; then
        ss -tlnp 2>/dev/null | grep ":$port " | sed 's/.*pid=\([0-9]*\).*/\1/'
    fi
}

# Get process name for PID
get_process_name() {
    local pid=$1
    if [[ -n "$pid" && "$pid" =~ ^[0-9]+$ ]]; then
        ps -p $pid -o comm= 2>/dev/null || echo "unknown"
    else
        echo "unknown"
    fi
}

# Check if port is in use
is_port_in_use() {
    local port=$1
    local pid=$(get_port_pid $port)
    [[ -n "$pid" ]]
}

# Kill process on port with safety checks
kill_port_process() {
    local port=$1
    local force=${2:-false}
    local pid=$(get_port_pid $port)
    
    if [[ -z "$pid" ]]; then
        log "INFO" "No process found on port $port"
        return 0
    fi
    
    local process_name=$(get_process_name $pid)
    local port_info=$(get_port_info $port)
    
    log "INFO" "Found process on port $port:"
    echo -e "  ${YELLOW}PID:${NC} $pid"
    echo -e "  ${YELLOW}Process:${NC} $process_name"
    echo -e "  ${YELLOW}Details:${NC} $port_info"
    
    # Safety check for system processes
    case $process_name in
        "systemd"|"init"|"kernel"|"ssh"|"sshd")
            log "ERROR" "Refusing to kill system process: $process_name (PID: $pid)"
            return 1
            ;;
    esac
    
    if [[ "$force" != "true" ]]; then
        echo -e "${YELLOW}Do you want to kill this process? (y/N):${NC} "
        read -r response
        if [[ ! "$response" =~ ^[Yy]$ ]]; then
            log "INFO" "Skipping process $pid on port $port"
            return 0
        fi
    fi
    
    log "INFO" "Attempting to kill process $pid on port $port..."
    
    # Try graceful kill first
    if kill -TERM $pid 2>/dev/null; then
        sleep 2
        if ! kill -0 $pid 2>/dev/null; then
            log "SUCCESS" "Process $pid gracefully terminated"
            return 0
        fi
    fi
    
    # Force kill if graceful failed
    if kill -KILL $pid 2>/dev/null; then
        sleep 1
        if ! kill -0 $pid 2>/dev/null; then
            log "SUCCESS" "Process $pid force-killed"
            return 0
        fi
    fi
    
    log "ERROR" "Failed to kill process $pid on port $port"
    return 1
}

# Scan and display port usage
scan_ports() {
    local ports_to_scan=("${@:-${DEV_PORTS[@]}}")
    
    log "INFO" "Scanning ports: ${ports_to_scan[*]}"
    echo -e "\n${WHITE}Port Scan Results:${NC}"
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    printf "%-8s %-10s %-15s %-20s %s\n" "PORT" "STATUS" "PID" "PROCESS" "DETAILS"
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    
    for port in "${ports_to_scan[@]}"; do
        local pid=$(get_port_pid $port)
        if [[ -n "$pid" ]]; then
            local process_name=$(get_process_name $pid)
            local port_info=$(get_port_info $port | head -1)
            printf "%-8s ${RED}%-10s${NC} %-15s %-20s %s\n" "$port" "IN USE" "$pid" "$process_name" "$port_info"
        else
            printf "%-8s ${GREEN}%-10s${NC} %-15s %-20s %s\n" "$port" "FREE" "-" "-" "-"
        fi
    done
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
}

# Clean up all development ports
cleanup_dev_ports() {
    local force=${1:-false}
    
    log "INFO" "Starting cleanup of development ports..."
    
    local cleaned_ports=()
    for port in "${DEV_PORTS[@]}"; do
        if is_port_in_use $port; then
            if kill_port_process $port $force; then
                cleaned_ports+=($port)
            fi
        fi
    done
    
    if [[ ${#cleaned_ports[@]} -gt 0 ]]; then
        log "SUCCESS" "Cleaned up ports: ${cleaned_ports[*]}"
    else
        log "INFO" "No ports needed cleanup"
    fi
}

# Clean up specific service ports
cleanup_service() {
    local service_name=$1
    local force=${2:-false}
    
    local service_info=$(get_service_info "$service_name")
    if [[ -z "$service_info" ]]; then
        log "ERROR" "Unknown service: $service_name"
        log "INFO" "Available services: $AVAILABLE_SERVICES"
        return 1
    fi
    local port=$(echo "$service_info" | cut -d':' -f1)
    local description=$(echo "$service_info" | cut -d':' -f2)
    
    log "INFO" "Cleaning up $description on port $port..."
    
    if is_port_in_use $port; then
        kill_port_process $port $force
    else
        log "INFO" "Service $service_name is not running"
    fi
}

# Start a service
start_service() {
    local service_name=$1
    local background=${2:-true}
    
    local service_info=$(get_service_info "$service_name")
    if [[ -z "$service_info" ]]; then
        log "ERROR" "Unknown service: $service_name"
        return 1
    fi
    local port=$(echo "$service_info" | cut -d':' -f1)
    local description=$(echo "$service_info" | cut -d':' -f2)
    local command=$(echo "$service_info" | cut -d':' -f3-)
    
    if is_port_in_use $port; then
        log "WARNING" "$description is already running on port $port"
        return 0
    fi
    
    log "INFO" "Starting $description on port $port..."
    
    # Determine the correct directory
    local service_dir="$SCRIPT_DIR"
    case $service_name in
        "backend")
            service_dir="$SCRIPT_DIR/backend"
            ;;
        "frontend")
            service_dir="$SCRIPT_DIR/frontend"
            ;;
        "ml-service"|"ml-inference")
            service_dir="$SCRIPT_DIR/ml_service"
            ;;
    esac
    
    if [[ ! -d "$service_dir" ]]; then
        log "ERROR" "Service directory not found: $service_dir"
        return 1
    fi
    
    cd "$service_dir"
    
    if [[ "$background" == "true" ]]; then
        log "INFO" "Starting $description in background..."
        nohup $command > "/tmp/${service_name}.log" 2>&1 &
        local pid=$!
        sleep 2
        if kill -0 $pid 2>/dev/null; then
            log "SUCCESS" "$description started successfully (PID: $pid)"
        else
            log "ERROR" "Failed to start $description"
            return 1
        fi
    else
        log "INFO" "Starting $description in foreground..."
        exec $command
    fi
}

# Restart services in correct order
restart_all_services() {
    log "INFO" "Restarting all services..."
    
    # Stop all services first
    for service in $AVAILABLE_SERVICES; do
        cleanup_service "$service" true
    done
    
    sleep 3
    
    # Start in dependency order
    start_service "ml-service" true
    sleep 2
    start_service "ml-inference" true
    sleep 2
    start_service "backend" true
    sleep 2
    start_service "frontend" true
    
    log "SUCCESS" "All services restarted"
}

# Find next available port
find_next_port() {
    local start_port=${1:-3000}
    local max_port=${2:-9999}
    
    for ((port=start_port; port<=max_port; port++)); do
        if ! is_port_in_use $port; then
            echo $port
            return 0
        fi
    done
    
    return 1
}

# Emergency cleanup - force kill all related processes
emergency_cleanup() {
    log "WARNING" "Starting emergency cleanup..."
    
    # Kill by process names
    local process_names=("node" "npm" "yarn" "python" "uvicorn" "gunicorn")
    
    for proc_name in "${process_names[@]}"; do
        local pids=$(pgrep -f "$proc_name" 2>/dev/null || true)
        if [[ -n "$pids" ]]; then
            log "INFO" "Found $proc_name processes: $pids"
            echo -e "${YELLOW}Kill all $proc_name processes? (y/N):${NC} "
            read -r response
            if [[ "$response" =~ ^[Yy]$ ]]; then
                echo "$pids" | xargs -r kill -TERM 2>/dev/null || true
                sleep 2
                echo "$pids" | xargs -r kill -KILL 2>/dev/null || true
                log "SUCCESS" "Cleaned up $proc_name processes"
            fi
        fi
    done
    
    # Force cleanup all dev ports
    cleanup_dev_ports true
}

# Save current port configuration
save_config() {
    cat > "$CONFIG_FILE" << EOF
# Port Manager Configuration
# Generated on $(date)
BACKEND_PORT=$DEFAULT_BACKEND_PORT
FRONTEND_PORT=$DEFAULT_FRONTEND_PORT
ML_SERVICE_PORT=$DEFAULT_ML_SERVICE_PORT
ML_INFERENCE_PORT=$DEFAULT_ML_INFERENCE_PORT
EOF
    log "SUCCESS" "Configuration saved to $CONFIG_FILE"
}

# Load port configuration
load_config() {
    if [[ -f "$CONFIG_FILE" ]]; then
        source "$CONFIG_FILE"
        log "INFO" "Configuration loaded from $CONFIG_FILE"
    fi
}

# Display help
show_help() {
    cat << EOF
${WHITE}Advanced Port Manager - Connect Four Game${NC}

${YELLOW}USAGE:${NC}
  $0 [COMMAND] [OPTIONS]

${YELLOW}COMMANDS:${NC}
  ${GREEN}scan${NC}              Scan and display port usage
  ${GREEN}scan [ports...]${NC}   Scan specific ports
  ${GREEN}kill <port>${NC}       Kill process on specific port
  ${GREEN}kill-service <name>${NC} Kill specific service
  ${GREEN}cleanup${NC}           Clean up all development ports
  ${GREEN}cleanup-force${NC}     Force cleanup all development ports
  ${GREEN}start <service>${NC}   Start a specific service
  ${GREEN}restart${NC}           Restart all services
  ${GREEN}emergency${NC}         Emergency cleanup (interactive)
  ${GREEN}status${NC}            Show service status
  ${GREEN}next-port [start]${NC} Find next available port
  ${GREEN}config${NC}            Save current configuration

${YELLOW}SERVICES:${NC}
  ${CYAN}backend${NC}       Backend API server (port $DEFAULT_BACKEND_PORT)
  ${CYAN}frontend${NC}      Frontend React app (port $DEFAULT_FRONTEND_PORT)
  ${CYAN}ml-service${NC}    ML service (port $DEFAULT_ML_SERVICE_PORT)
  ${CYAN}ml-inference${NC}  ML inference service (port $DEFAULT_ML_INFERENCE_PORT)

${YELLOW}EXAMPLES:${NC}
  $0 scan
  $0 kill 3000
  $0 cleanup
  $0 start backend
  $0 restart
  $0 next-port 3000

${YELLOW}FILES:${NC}
  Log file: $LOG_FILE
  Config file: $CONFIG_FILE
EOF
}

# Main function
main() {
    # Initialize log file
    mkdir -p "$(dirname "$LOG_FILE")"
    touch "$LOG_FILE"
    
    # Load configuration
    load_config
    
    case "${1:-help}" in
        "scan")
            show_banner
            shift
            scan_ports "$@"
            ;;
        "kill")
            if [[ -z "$2" ]]; then
                log "ERROR" "Port number required"
                exit 1
            fi
            kill_port_process "$2"
            ;;
        "kill-service")
            if [[ -z "$2" ]]; then
                log "ERROR" "Service name required"
                exit 1
            fi
            cleanup_service "$2" "${3:-false}"
            ;;
        "cleanup")
            show_banner
            cleanup_dev_ports false
            ;;
        "cleanup-force")
            show_banner
            cleanup_dev_ports true
            ;;
        "start")
            if [[ -z "$2" ]]; then
                log "ERROR" "Service name required"
                exit 1
            fi
            start_service "$2" "${3:-true}"
            ;;
        "restart")
            show_banner
            restart_all_services
            ;;
        "emergency")
            show_banner
            emergency_cleanup
            ;;
        "status")
            show_banner
            scan_ports
            ;;
        "next-port")
            find_next_port "${2:-3000}"
            ;;
        "config")
            save_config
            ;;
        "help"|"--help"|"-h")
            show_help
            ;;
        *)
            log "ERROR" "Unknown command: $1"
            echo ""
            show_help
            exit 1
            ;;
    esac
}

# Run main function with all arguments
main "$@" 