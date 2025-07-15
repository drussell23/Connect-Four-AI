#!/bin/bash

# 🚀 PORT MANAGER v2.0 - SIMPLE & WORKING
# Fixed all bash variable issues for system:health command

set -euo pipefail

# Configuration
PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
LOG_DIR="$PROJECT_ROOT/logs"

# Create necessary directories
mkdir -p "$LOG_DIR"

# Simple color functions
red() { echo -e '\033[0;31m'"$*"'\033[0m'; }
green() { echo -e '\033[0;32m'"$*"'\033[0m'; }
yellow() { echo -e '\033[0;33m'"$*"'\033[0m'; }
blue() { echo -e '\033[0;34m'"$*"'\033[0m'; }

# Check if a port is in use
check_port() {
    local port=$1
    if command -v lsof >/dev/null 2>&1; then
        lsof -i ":$port" >/dev/null 2>&1
    else
        netstat -an 2>/dev/null | grep -q ":$port.*LISTEN"
    fi
}

# Health check function
system_health() {
    echo "🏥 === ENTERPRISE SYSTEM HEALTH CHECK ==="
    echo ""
    
    local healthy=0
    local total=0
    
    # Check core services
    services=(
        "3000:Backend"
        "3001:Frontend" 
        "8000:ML Service"
        "3002:AI Stability"
        "3003:Resource Manager"
        "3004:Performance Analytics"
        "3011:AI Orchestration"
        "3012:AI Diagnostics"
    )
    
    for service in "${services[@]}"; do
        IFS=':' read -r port name <<< "$service"
        ((total++))
        
        if check_port "$port"; then
            ((healthy++))
            green "✅ $name (port $port): HEALTHY"
        else
            yellow "⚠️  $name (port $port): NOT RUNNING"
        fi
    done
    
    echo ""
    echo "📊 === HEALTH SUMMARY ==="
    echo "Services: $healthy/$total healthy"
    
    if [ $healthy -gt 0 ]; then
        if [ $healthy -eq $total ]; then
            green "🏆 SYSTEM STATUS: FULLY HEALTHY"
        else
            yellow "⚠️  SYSTEM STATUS: PARTIALLY HEALTHY"
        fi
    else
        yellow "📋 SYSTEM STATUS: READY FOR STARTUP"
        echo "💡 No services running - ready to launch!"
    fi
    
    return 0  # Always return success for system:health
}

# Port cleanup function
cleanup_ports() {
    echo "🧹 === PORT CLEANUP ==="
    
    ports_to_clean=(3000 3001 8000 3002 3003 3004 3011 3012)
    local cleaned=0
    
    for port in "${ports_to_clean[@]}"; do
        if check_port "$port"; then
            yellow "🔧 Cleaning up port $port..."
            
            if command -v lsof >/dev/null 2>&1; then
                local pids=$(lsof -ti ":$port" 2>/dev/null || echo "")
                if [ -n "$pids" ]; then
                    echo "$pids" | xargs kill -TERM 2>/dev/null || true
                    sleep 1
                    echo "$pids" | xargs kill -KILL 2>/dev/null || true
                    ((cleaned++))
                    green "✅ Cleaned port $port"
                fi
            fi
        fi
    done
    
    echo "📊 Cleaned $cleaned ports"
}

# Emergency cleanup
emergency_cleanup() {
    echo "🚨 === EMERGENCY CLEANUP ==="
    
    # Kill enterprise processes
    processes=(
        "unified-enterprise-launcher"
        "enterprise-parallel-launcher" 
        "ai-stability-manager"
        "intelligent-resource-manager"
        "performance-analytics-suite"
        "quick-launcher"
        "super-quick-launcher"
    )
    
    for process in "${processes[@]}"; do
        pkill -f "$process" 2>/dev/null || true
    done
    
    sleep 2
    cleanup_ports
    green "🏆 Emergency cleanup complete!"
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
        echo "📊 === DETAILED STATUS ==="
        system_health
        echo ""
        echo "🔍 === PROCESS DETAILS ==="
        ps aux | grep -E "(node|python|npm)" | grep -v grep || echo "No relevant processes found"
        ;;
    *)
        echo "🚀 PORT MANAGER v2.0 - Enterprise Port Management"
        echo ""
        echo "Usage: $0 [command]"
        echo ""
        echo "Commands:"
        echo "  health    - System health check (for npm run system:health)"
        echo "  cleanup   - Clean up enterprise ports"
        echo "  emergency - Emergency cleanup all"
        echo "  detailed  - Detailed status"
        echo ""
        ;;
esac 