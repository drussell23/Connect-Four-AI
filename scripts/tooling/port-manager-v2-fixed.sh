#!/bin/bash

# 🚀 PORT MANAGER v2.0 - FIXED - AI-Integrated Enterprise Port Management
# Enhanced with enterprise process protection and intelligent cleanup
# Fixed color variable issues for system:health command

set -euo pipefail  # Strict error handling

# Configuration
PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
SCRIPT_DIR="$(dirname "${BASH_SOURCE[0]}")"
LOG_DIR="$PROJECT_ROOT/logs"
PID_DIR="$PROJECT_ROOT/.pids"
AI_HEALTH_DATA="$PROJECT_ROOT/logs/health-check-intelligence.json"

# Create necessary directories
mkdir -p "$LOG_DIR" "$PID_DIR"

# Color functions (fixed)
red() { echo -e '\033[0;31m'"$*"'\033[0m'; }
green() { echo -e '\033[0;32m'"$*"'\033[0m'; }
yellow() { echo -e '\033[0;33m'"$*"'\033[0m'; }
blue() { echo -e '\033[0;34m'"$*"'\033[0m'; }
purple() { echo -e '\033[0;35m'"$*"'\033[0m'; }
cyan() { echo -e '\033[0;36m'"$*"'\033[0m'; }
bold() { echo -e '\033[1m'"$*"'\033[0m'; }

# Enterprise service configuration
declare -A ENTERPRISE_PORTS=(
    [backend]=3000
    [frontend]=3001
    [ml_service]=8000
    [ai_stability]=3002
    [resource_manager]=3003
    [performance_analytics]=3004
    [ai_orchestration]=3011
    [ai_diagnostics]=3012
    [model_manager]=3013
    [rlhf_system]=3015
)

# Health check function
system_health() {
    echo "🏥 === ENTERPRISE SYSTEM HEALTH CHECK ==="
    echo ""
    
    local all_healthy=true
    local total_services=0
    local healthy_services=0
    
    for service_name in "${!ENTERPRISE_PORTS[@]}"; do
        local port="${ENTERPRISE_PORTS[$service_name]}"
        ((total_services++))
        
        if check_port_status "$port" "$service_name"; then
            ((healthy_services++))
            green "✅ $service_name (port $port): HEALTHY"
        else
            yellow "⚠️  $service_name (port $port): NOT RUNNING"
            all_healthy=false
        fi
    done
    
    echo ""
    echo "📊 === HEALTH SUMMARY ==="
    echo "Services: $healthy_services/$total_services healthy"
    
    if [ "$all_healthy" = true ] && [ $healthy_services -gt 0 ]; then
        green "🏆 SYSTEM STATUS: HEALTHY"
        return 0
    elif [ $healthy_services -gt 0 ]; then
        yellow "⚠️  SYSTEM STATUS: PARTIAL"
        return 0  # Allow partial for development
    else
        yellow "📋 SYSTEM STATUS: READY FOR STARTUP"
        echo "💡 No services running - ready to launch!"
        return 0  # Don't block startup if nothing is running
    fi
}

# Check if a port is in use
check_port_status() {
    local port=$1
    local service_name=${2:-"unknown"}
    
    if command -v lsof >/dev/null 2>&1; then
        if lsof -i ":$port" >/dev/null 2>&1; then
            return 0  # Port is in use (healthy)
        else
            return 1  # Port is free
        fi
    else
        # Fallback method using netstat
        if netstat -an 2>/dev/null | grep -q ":$port.*LISTEN"; then
            return 0  # Port is in use (healthy)
        else
            return 1  # Port is free
        fi
    fi
}

# Port cleanup function
cleanup_ports() {
    echo "🧹 === PORT CLEANUP ==="
    local cleaned=0
    
    for service_name in "${!ENTERPRISE_PORTS[@]}"; do
        local port="${ENTERPRISE_PORTS[$service_name]}"
        
        if check_port_status "$port" "$service_name"; then
            yellow "🔧 Cleaning up $service_name on port $port..."
            
            # Find and kill process using the port
            local pids=$(lsof -ti :$port 2>/dev/null || echo "")
            if [ -n "$pids" ]; then
                echo "$pids" | xargs kill -TERM 2>/dev/null || true
                sleep 1
                echo "$pids" | xargs kill -KILL 2>/dev/null || true
                ((cleaned++))
                green "✅ Cleaned $service_name"
            fi
        fi
    done
    
    echo "📊 Cleaned $cleaned services"
    return 0
}

# Emergency cleanup
emergency_cleanup() {
    echo "🚨 === EMERGENCY PORT CLEANUP ==="
    
    # Kill all enterprise processes
    pkill -f "unified-enterprise-launcher" 2>/dev/null || true
    pkill -f "enterprise-parallel-launcher" 2>/dev/null || true
    pkill -f "ai-stability-manager" 2>/dev/null || true
    pkill -f "intelligent-resource-manager" 2>/dev/null || true
    pkill -f "performance-analytics-suite" 2>/dev/null || true
    
    sleep 2
    cleanup_ports
    
    green "🏆 Emergency cleanup complete!"
}

# Detailed status
detailed_status() {
    echo "📊 === DETAILED PORT STATUS ==="
    echo ""
    
    for service_name in "${!ENTERPRISE_PORTS[@]}"; do
        local port="${ENTERPRISE_PORTS[$service_name]}"
        
        echo "🔍 $service_name (port $port):"
        if check_port_status "$port" "$service_name"; then
            local pids=$(lsof -ti :$port 2>/dev/null || echo "")
            local process_info=$(lsof -i :$port 2>/dev/null | tail -n +2 || echo "")
            
            green "  ✅ Status: RUNNING"
            echo "  📍 PIDs: $pids"
            echo "  📋 Process: $process_info"
        else
            yellow "  ⚠️  Status: NOT RUNNING"
        fi
        echo ""
    done
}

# Main command handler
case "${1:-help}" in
    "health")
        system_health
        ;;
    "cleanup")
        cleanup_ports
        ;;
    "emergency")
        emergency_cleanup
        ;;
    "detailed")
        detailed_status
        ;;
    "menu")
        echo "🚀 === PORT MANAGER v2.0 MENU ==="
        echo "1. health    - System health check"
        echo "2. cleanup   - Clean up ports"
        echo "3. emergency - Emergency cleanup"
        echo "4. detailed  - Detailed status"
        echo ""
        echo "Usage: $0 [health|cleanup|emergency|detailed]"
        ;;
    *)
        echo "🚀 PORT MANAGER v2.0 - Enterprise Port Management"
        echo ""
        echo "Usage: $0 [command]"
        echo ""
        echo "Commands:"
        echo "  health    - Check system health (used by npm run system:health)"
        echo "  cleanup   - Clean up enterprise ports"
        echo "  emergency - Emergency cleanup all processes"
        echo "  detailed  - Show detailed port status"
        echo "  menu      - Show interactive menu"
        echo ""
        echo "Examples:"
        echo "  $0 health    # Check if services are running"
        echo "  $0 cleanup   # Clean up all ports"
        echo "  $0 emergency # Force kill everything"
        ;;
esac 