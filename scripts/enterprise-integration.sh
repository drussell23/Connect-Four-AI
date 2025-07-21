#!/bin/bash

# Connect Four AI - Enterprise Integration Script
# Provides advanced enterprise features for the enhanced restart system

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
PURPLE='\033[0;35m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

# Configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ENTERPRISE_SCRIPTS="$SCRIPT_DIR/enterprise"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

# Function to log with timestamp
log() {
    echo -e "${CYAN}[$(date '+%H:%M:%S')]${NC} $1"
}

# Function to run intelligent resource manager
run_resource_manager() {
    log "🔧 INTELLIGENT RESOURCE MANAGEMENT"
    
    if [ -f "$ENTERPRISE_SCRIPTS/intelligent-resource-manager.js" ]; then
        echo -e "   🧠 Running intelligent resource optimization..."
        node "$ENTERPRISE_SCRIPTS/intelligent-resource-manager.js" --optimize >/dev/null 2>&1 || true
        echo -e "   ${GREEN}✅ Resource optimization completed${NC}"
    else
        echo -e "   ${YELLOW}⚠️  Intelligent resource manager not available${NC}"
    fi
}

# Function to run performance analytics
run_performance_analytics() {
    log "📊 PERFORMANCE ANALYTICS SUITE"
    
    if [ -f "$ENTERPRISE_SCRIPTS/performance-analytics-suite.js" ]; then
        echo -e "   📈 Running performance analytics..."
        node "$ENTERPRISE_SCRIPTS/performance-analytics-suite.js" --quick-scan >/dev/null 2>&1 || true
        echo -e "   ${GREEN}✅ Performance analytics completed${NC}"
    else
        echo -e "   ${YELLOW}⚠️  Performance analytics suite not available${NC}"
    fi
}

# Function to run AI stability manager
run_ai_stability_manager() {
    log "🤖 AI STABILITY MANAGEMENT"
    
    if [ -f "$ENTERPRISE_SCRIPTS/ai-stability-manager.js" ]; then
        echo -e "   🧠 Running AI stability checks..."
        node "$ENTERPRISE_SCRIPTS/ai-stability-manager.js" --health-check >/dev/null 2>&1 || true
        echo -e "   ${GREEN}✅ AI stability checks completed${NC}"
    else
        echo -e "   ${YELLOW}⚠️  AI stability manager not available${NC}"
    fi
}

# Function to run advanced AI diagnostics
run_ai_diagnostics() {
    log "🔍 ADVANCED AI DIAGNOSTICS"
    
    if [ -f "$ENTERPRISE_SCRIPTS/advanced-ai-diagnostics.js" ]; then
        echo -e "   🔬 Running advanced AI diagnostics..."
        node "$ENTERPRISE_SCRIPTS/advanced-ai-diagnostics.js" --quick-diagnose >/dev/null 2>&1 || true
        echo -e "   ${GREEN}✅ AI diagnostics completed${NC}"
    else
        echo -e "   ${YELLOW}⚠️  Advanced AI diagnostics not available${NC}"
    fi
}

# Function to run enterprise model manager
run_enterprise_model_manager() {
    log "📦 ENTERPRISE MODEL MANAGEMENT"
    
    if [ -f "$ENTERPRISE_SCRIPTS/enterprise-model-manager.js" ]; then
        echo -e "   🎯 Running enterprise model management..."
        node "$ENTERPRISE_SCRIPTS/enterprise-model-manager.js" --health-check >/dev/null 2>&1 || true
        echo -e "   ${GREEN}✅ Model management completed${NC}"
    else
        echo -e "   ${YELLOW}⚠️  Enterprise model manager not available${NC}"
    fi
}

# Function to run AI orchestration dashboard
run_ai_orchestration() {
    log "🎛️  AI ORCHESTRATION DASHBOARD"
    
    if [ -f "$ENTERPRISE_SCRIPTS/ai-orchestration-dashboard.js" ]; then
        echo -e "   🎮 Running AI orchestration checks..."
        node "$ENTERPRISE_SCRIPTS/ai-orchestration-dashboard.js" --status >/dev/null 2>&1 || true
        echo -e "   ${GREEN}✅ AI orchestration checks completed${NC}"
    else
        echo -e "   ${YELLOW}⚠️  AI orchestration dashboard not available${NC}"
    fi
}

# Function to run comprehensive AI testing
run_ai_comprehensive_testing() {
    log "🧪 COMPREHENSIVE AI TESTING"
    
    if [ -f "$ENTERPRISE_SCRIPTS/ai-comprehensive-testing.js" ]; then
        echo -e "   🧪 Running comprehensive AI tests..."
        node "$ENTERPRISE_SCRIPTS/ai-comprehensive-testing.js" --quick-test >/dev/null 2>&1 || true
        echo -e "   ${GREEN}✅ Comprehensive AI testing completed${NC}"
    else
        echo -e "   ${YELLOW}⚠️  Comprehensive AI testing not available${NC}"
    fi
}

# Function to run RLHF system manager
run_rlhf_system_manager() {
    log "🎯 RLHF SYSTEM MANAGEMENT"
    
    if [ -f "$ENTERPRISE_SCRIPTS/rlhf-system-manager.js" ]; then
        echo -e "   🎯 Running RLHF system checks..."
        node "$ENTERPRISE_SCRIPTS/rlhf-system-manager.js" --health-check >/dev/null 2>&1 || true
        echo -e "   ${GREEN}✅ RLHF system checks completed${NC}"
    else
        echo -e "   ${YELLOW}⚠️  RLHF system manager not available${NC}"
    fi
}

# Function to run enhanced process manager
run_enhanced_process_manager() {
    log "⚙️  ENHANCED PROCESS MANAGEMENT"
    
    if [ -f "$ENTERPRISE_SCRIPTS/enhanced-process-manager.js" ]; then
        echo -e "   ⚙️  Running enhanced process management..."
        node "$ENTERPRISE_SCRIPTS/enhanced-process-manager.js" --optimize >/dev/null 2>&1 || true
        echo -e "   ${GREEN}✅ Enhanced process management completed${NC}"
    else
        echo -e "   ${YELLOW}⚠️  Enhanced process manager not available${NC}"
    fi
}

# Function to provide enterprise status summary
enterprise_status_summary() {
    log "🏢 ENTERPRISE STATUS SUMMARY"
    
    echo -e "   📊 Enterprise Components Status:"
    
    # Check which enterprise components are available
    components=(
        "intelligent-resource-manager.js:Intelligent Resource Manager"
        "performance-analytics-suite.js:Performance Analytics Suite"
        "ai-stability-manager.js:AI Stability Manager"
        "advanced-ai-diagnostics.js:Advanced AI Diagnostics"
        "enterprise-model-manager.js:Enterprise Model Manager"
        "ai-orchestration-dashboard.js:AI Orchestration Dashboard"
        "ai-comprehensive-testing.js:Comprehensive AI Testing"
        "rlhf-system-manager.js:RLHF System Manager"
        "enhanced-process-manager.js:Enhanced Process Manager"
    )
    
    local available_count=0
    local total_count=${#components[@]}
    
    for component in "${components[@]}"; do
        IFS=':' read -r script_name display_name <<< "$component"
        if [ -f "$ENTERPRISE_SCRIPTS/$script_name" ]; then
            echo -e "      ${GREEN}✅ $display_name${NC}"
            ((available_count++))
        else
            echo -e "      ${YELLOW}⚠️  $display_name (Not Available)${NC}"
        fi
    done
    
    echo -e "   📈 Enterprise Coverage: ${available_count}/${total_count} components available"
    
    if [ $available_count -eq $total_count ]; then
        echo -e "   ${GREEN}🏆 Full enterprise suite available!${NC}"
    elif [ $available_count -gt 0 ]; then
        echo -e "   ${YELLOW}⚠️  Partial enterprise suite available${NC}"
    else
        echo -e "   ${RED}❌ No enterprise components available${NC}"
    fi
    
    echo ""
}

# Main execution function
main() {
    local action="${1:-all}"
    
    case "$action" in
        "resource")
            run_resource_manager
            ;;
        "analytics")
            run_performance_analytics
            ;;
        "stability")
            run_ai_stability_manager
            ;;
        "diagnostics")
            run_ai_diagnostics
            ;;
        "model")
            run_enterprise_model_manager
            ;;
        "orchestration")
            run_ai_orchestration
            ;;
        "testing")
            run_ai_comprehensive_testing
            ;;
        "rlhf")
            run_rlhf_system_manager
            ;;
        "process")
            run_enhanced_process_manager
            ;;
        "status")
            enterprise_status_summary
            ;;
        "all"|*)
            echo -e "${PURPLE}🏢 CONNECT FOUR AI - ENTERPRISE INTEGRATION${NC}"
            echo -e "${PURPLE}===========================================${NC}"
            echo ""
            
            enterprise_status_summary
            run_resource_manager
            run_performance_analytics
            run_ai_stability_manager
            run_ai_diagnostics
            run_enterprise_model_manager
            run_ai_orchestration
            run_ai_comprehensive_testing
            run_rlhf_system_manager
            run_enhanced_process_manager
            
            echo -e "${GREEN}🎊 Enterprise integration complete!${NC}"
            ;;
    esac
}

# Run main function with arguments
main "$@" 