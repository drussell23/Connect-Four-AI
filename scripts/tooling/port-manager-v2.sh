#!/bin/bash

# ============================================================================
# Port Manager v2.0 - AI-Enhanced Enterprise Port Management
# Integrates with Unified Enterprise Launcher and AI Health Check System
# ============================================================================

set -euo pipefail

# Script configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
LOG_FILE="$PROJECT_ROOT/logs/port-manager-v2.log"
CONFIG_FILE="$PROJECT_ROOT/logs/port-config.json"
AI_HEALTH_DATA="$PROJECT_ROOT/logs/health-check-intelligence.json"

# Colors for enhanced output
declare -A COLORS=(
    [RED]='\033[0;31m'    [GREEN]='\033[0;32m'   [YELLOW]='\033[0;33m'
    [BLUE]='\033[0;34m'   [PURPLE]='\033[0;35m'  [CYAN]='\033[0;36m'
    [WHITE]='\033[0;37m'  [BOLD]='\033[1m'       [RESET]='\033[0m'
)

# Enterprise service configuration
declare -A ENTERPRISE_PORTS=(
    [backend]=3001
    [frontend]=3000
    [ml_service]=8000
    [ai_stability]=3002
    [resource_manager]=3003
    [analytics_suite]=3004
    [deployment_manager]=3005
    [model_manager]=8001
    [orchestration_dashboard]=3006
)

declare -A SERVICE_DESCRIPTIONS=(
    [backend]="Backend API Server"
    [frontend]="Frontend React App"
    [ml_service]="ML Inference Service"
    [ai_stability]="AI Stability Manager"
    [resource_manager]="Intelligent Resource Manager"
    [analytics_suite]="Performance Analytics Suite"
    [deployment_manager]="Advanced Deployment Manager"
    [model_manager]="Enterprise Model Manager"
    [orchestration_dashboard]="AI Orchestration Dashboard"
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
    info "Port Manager v2.0 - AI-Enhanced Enterprise Port Management"
    info "Log file: $LOG_FILE"
}

# Check if AI health check data exists
check_ai_integration() {
    if [[ -f "$AI_HEALTH_DATA" ]]; then
        info "AI Health Check integration available"
        return 0
    else
        warning "AI Health Check data not found - using standard mode"
        return 1
    fi
}

# Get service status from AI health check data
get_ai_service_status() {
    local service="$1"
    
    if ! check_ai_integration; then
        echo "unknown"
        return
    fi
    
    local status=$(node -e "
        try {
            const data = JSON.parse(require('fs').readFileSync('$AI_HEALTH_DATA', 'utf8'));
            const service = data.services && data.services['$service'];
            if (service) {
                console.log('ai_monitored');
            } else {
                console.log('not_monitored');
            }
        } catch (e) {
            console.log('unknown');
        }
    " 2>/dev/null || echo "unknown")
    
    echo "$status"
}

# Check if port is in use
check_port() {
    local port="$1"
    lsof -i ":$port" >/dev/null 2>&1
}

# Get process info for port
get_port_info() {
    local port="$1"
    lsof -i ":$port" 2>/dev/null | tail -n +2 | while read -r line; do
        local pid=$(echo "$line" | awk '{print $2}')
        local process=$(echo "$line" | awk '{print $1}')
        local user=$(echo "$line" | awk '{print $3}')
        echo "$pid|$process|$user"
    done
}

# Intelligent process detection
detect_enterprise_process() {
    local port="$1"
    local process_info="$2"
    local pid=$(echo "$process_info" | cut -d'|' -f1)
    local process_name=$(echo "$process_info" | cut -d'|' -f2)
    
    # Check if it's an enterprise process
    if ps -p "$pid" -o command= 2>/dev/null | grep -q "unified-enterprise-launcher\|enterprise.*\.js"; then
        echo "enterprise"
    elif ps -p "$pid" -o command= 2>/dev/null | grep -q "npm.*start\|react-scripts\|nest"; then
        echo "service"
    else
        echo "unknown"
    fi
}

# Kill process safely with enterprise awareness
kill_process_safely() {
    local pid="$1"
    local process_type="$2"
    local service_name="$3"
    
    case "$process_type" in
        enterprise)
            warning "Enterprise process detected on $service_name (PID: $pid)"
            warning "This may be managed by the unified enterprise launcher"
            read -p "Do you want to kill this enterprise process? (y/N): " -n 1 -r
            echo
            if [[ $REPLY =~ ^[Yy]$ ]]; then
                kill -TERM "$pid" 2>/dev/null || kill -KILL "$pid" 2>/dev/null
                success "Enterprise process $pid terminated"
            else
                info "Skipping enterprise process $pid"
                return 1
            fi
            ;;
        service)
            info "Killing service process $pid"
            kill -TERM "$pid" 2>/dev/null || kill -KILL "$pid" 2>/dev/null
            success "Service process $pid terminated"
            ;;
        *)
            warning "Unknown process type for PID $pid"
            read -p "Do you want to kill this unknown process? (y/N): " -n 1 -r
            echo
            if [[ $REPLY =~ ^[Yy]$ ]]; then
                kill -TERM "$pid" 2>/dev/null || kill -KILL "$pid" 2>/dev/null
                success "Process $pid terminated"
            else
                info "Skipping unknown process $pid"
                return 1
            fi
            ;;
    esac
}

# Enhanced port status with AI integration
show_port_status() {
    local detailed="${1:-false}"
    
    info "Enterprise Port Status Report"
    echo
    printf "${COLORS[BOLD]}%-20s %-8s %-15s %-20s %-15s${COLORS[RESET]}\n" \
           "SERVICE" "PORT" "STATUS" "DESCRIPTION" "AI_STATUS"
    printf "${COLORS[CYAN]}%s${COLORS[RESET]}\n" "$(printf '%.80s' "$(yes '-' | head -80 | tr -d '\n')")"
    
    for service in "${!ENTERPRISE_PORTS[@]}"; do
        local port="${ENTERPRISE_PORTS[$service]}"
        local description="${SERVICE_DESCRIPTIONS[$service]}"
        local ai_status=$(get_ai_service_status "$service")
        
        if check_port "$port"; then
            local process_info=$(get_port_info "$port" | head -1)
            local process_type=$(detect_enterprise_process "$port" "$process_info")
            local pid=$(echo "$process_info" | cut -d'|' -f1)
            
            case "$process_type" in
                enterprise)
                    printf "${COLORS[GREEN]}%-20s %-8s %-15s %-20s %-15s${COLORS[RESET]}\n" \
                           "$service" "$port" "🟢 ENTERPRISE" "$description" "$ai_status"
                    ;;
                service)
                    printf "${COLORS[YELLOW]}%-20s %-8s %-15s %-20s %-15s${COLORS[RESET]}\n" \
                           "$service" "$port" "🟡 SERVICE" "$description" "$ai_status"
                    ;;
                *)
                    printf "${COLORS[RED]}%-20s %-8s %-15s %-20s %-15s${COLORS[RESET]}\n" \
                           "$service" "$port" "🔴 CONFLICT" "$description" "$ai_status"
                    ;;
            esac
            
            if [[ "$detailed" == "true" ]]; then
                printf "   ${COLORS[WHITE]}PID: %s, Process: %s${COLORS[RESET]}\n" \
                       "$(echo "$process_info" | cut -d'|' -f1)" \
                       "$(echo "$process_info" | cut -d'|' -f2)"
            fi
        else
            printf "${COLORS[WHITE]}%-20s %-8s %-15s %-20s %-15s${COLORS[RESET]}\n" \
                   "$service" "$port" "⚪ FREE" "$description" "$ai_status"
        fi
    done
    
    echo
    info "Legend: 🟢 Enterprise Process | 🟡 Service Process | 🔴 Port Conflict | ⚪ Available"
}

# Clean up specific service
cleanup_service() {
    local service="$1"
    local port="${ENTERPRISE_PORTS[$service]}"
    
    if [[ -z "$port" ]]; then
        error "Unknown service: $service"
        return 1
    fi
    
    info "Cleaning up service: $service (port $port)"
    
    if ! check_port "$port"; then
        success "Port $port is already free"
        return 0
    fi
    
    local killed_any=false
    while IFS= read -r process_info; do
        [[ -z "$process_info" ]] && continue
        
        local pid=$(echo "$process_info" | cut -d'|' -f1)
        local process_type=$(detect_enterprise_process "$port" "$process_info")
        
        if kill_process_safely "$pid" "$process_type" "$service"; then
            killed_any=true
        fi
    done < <(get_port_info "$port")
    
    # Wait a moment and check again
    sleep 2
    
    if check_port "$port"; then
        warning "Port $port still in use after cleanup attempt"
        return 1
    else
        success "Service $service cleaned up successfully"
        return 0
    fi
}

# Emergency cleanup with enterprise awareness
emergency_cleanup() {
    warning "Emergency cleanup - this will attempt to kill all processes on enterprise ports"
    read -p "Are you sure? This may disrupt running enterprise services (y/N): " -n 1 -r
    echo
    
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        info "Emergency cleanup cancelled"
        return 0
    fi
    
    local cleaned=0
    local total=0
    
    for service in "${!ENTERPRISE_PORTS[@]}"; do
        local port="${ENTERPRISE_PORTS[$service]}"
        ((total++))
        
        if check_port "$port"; then
            info "Emergency cleanup for $service (port $port)"
            if cleanup_service "$service"; then
                ((cleaned++))
            fi
        else
            info "Port $port is already free"
            ((cleaned++))
        fi
    done
    
    success "Emergency cleanup completed: $cleaned/$total services cleaned"
}

# Intelligent health check
health_check() {
    info "Running intelligent health check..."
    
    local issues=0
    local total_services=${#ENTERPRISE_PORTS[@]}
    
    # Check enterprise launcher status
    if pgrep -f "unified-enterprise-launcher" >/dev/null; then
        success "Enterprise launcher is running"
    else
        warning "Enterprise launcher is not running"
        ((issues++))
    fi
    
    # Check AI health check integration
    if check_ai_integration; then
        success "AI health check integration is active"
    else
        warning "AI health check integration is not available"
    fi
    
    # Check port conflicts
    for service in "${!ENTERPRISE_PORTS[@]}"; do
        local port="${ENTERPRISE_PORTS[$service]}"
        
        if check_port "$port"; then
            local process_info=$(get_port_info "$port" | head -1)
            local process_type=$(detect_enterprise_process "$port" "$process_info")
            
            case "$process_type" in
                enterprise)
                    success "$service: Running as enterprise process"
                    ;;
                service)
                    info "$service: Running as standard service"
                    ;;
                *)
                    error "$service: Port conflict detected"
                    ((issues++))
                    ;;
            esac
        else
            info "$service: Port $port is available"
        fi
    done
    
    echo
    if ((issues == 0)); then
        success "Health check passed: No issues detected"
    else
        warning "Health check found $issues issue(s)"
    fi
    
    return $issues
}

# Main menu
show_menu() {
    echo
    info "AI-Enhanced Enterprise Port Manager v2.0"
    echo
    echo "1. Show port status"
    echo "2. Show detailed status"
    echo "3. Health check"
    echo "4. Clean specific service"
    echo "5. Emergency cleanup"
    echo "6. AI integration status"
    echo "0. Exit"
    echo
}

# Main execution
main() {
    init_logging
    
    case "${1:-menu}" in
        status|--status)
            show_port_status false
            ;;
        detailed|--detailed)
            show_port_status true
            ;;
        health|--health)
            health_check
            ;;
        cleanup|--cleanup)
            if [[ -n "${2:-}" ]]; then
                cleanup_service "$2"
            else
                echo "Usage: $0 cleanup <service_name>"
                echo "Available services: ${!ENTERPRISE_PORTS[*]}"
                exit 1
            fi
            ;;
        emergency|--emergency)
            emergency_cleanup
            ;;
        ai|--ai)
            check_ai_integration && success "AI integration is working" || warning "AI integration unavailable"
            ;;
        menu|--menu)
            while true; do
                show_menu
                read -p "Select option (0-6): " choice
                
                case "$choice" in
                    1) show_port_status false ;;
                    2) show_port_status true ;;
                    3) health_check ;;
                    4)
                        echo "Available services: ${!ENTERPRISE_PORTS[*]}"
                        read -p "Enter service name: " service
                        cleanup_service "$service"
                        ;;
                    5) emergency_cleanup ;;
                    6) check_ai_integration && success "AI integration is working" || warning "AI integration unavailable" ;;
                    0) info "Goodbye!"; exit 0 ;;
                    *) error "Invalid option: $choice" ;;
                esac
                
                echo
                read -p "Press Enter to continue..."
            done
            ;;
        help|--help|-h)
            echo "Port Manager v2.0 - AI-Enhanced Enterprise Port Management"
            echo
            echo "Usage: $0 [command] [options]"
            echo
            echo "Commands:"
            echo "  status      Show port status overview"
            echo "  detailed    Show detailed port status"
            echo "  health      Run intelligent health check"
            echo "  cleanup     Clean up specific service"
            echo "  emergency   Emergency cleanup of all ports"
            echo "  ai          Check AI integration status"
            echo "  menu        Interactive menu (default)"
            echo "  help        Show this help"
            echo
            echo "Examples:"
            echo "  $0 status"
            echo "  $0 cleanup backend"
            echo "  $0 health"
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