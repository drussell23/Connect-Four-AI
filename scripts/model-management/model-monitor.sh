#!/bin/bash

# 📊 MODEL REPOSITORY MONITOR
# ===========================
# Monitor Git LFS usage, repository health, and model file status

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
RED='\033[0;31m'
PURPLE='\033[0;35m'
NC='\033[0m'

log() {
    local level="$1"
    shift
    case "$level" in
        "SUCCESS") echo -e "${GREEN}✅ $*${NC}" ;;
        "WARNING") echo -e "${YELLOW}⚠️  $*${NC}" ;;
        "INFO")    echo -e "${BLUE}ℹ️  $*${NC}" ;;
        "ERROR")   echo -e "${RED}❌ $*${NC}" ;;
        *)         echo -e "${PURPLE}📊 $*${NC}" ;;
    esac
}

check_lfs_status() {
    log "INFO" "Git LFS Status Check"
    echo "===================="
    
    # Check if LFS is installed
    if command -v git >/dev/null 2>&1 && git lfs version >/dev/null 2>&1; then
        local lfs_version=$(git lfs version | head -n1)
        log "SUCCESS" "Git LFS installed: $lfs_version"
    else
        log "ERROR" "Git LFS not installed or not working"
        return 1
    fi
    
    # Check LFS tracking
    echo
    log "INFO" "LFS Tracking Configuration:"
    git lfs track || log "WARNING" "No LFS tracking configured"
    
    # Check LFS files
    echo
    log "INFO" "Files tracked by LFS:"
    local lfs_files=$(git lfs ls-files 2>/dev/null || echo "")
    if [[ -n "$lfs_files" ]]; then
        echo "$lfs_files"
        local lfs_count=$(echo "$lfs_files" | wc -l)
        log "SUCCESS" "Total LFS files: $lfs_count"
    else
        log "WARNING" "No files currently tracked by LFS"
    fi
    
    echo
}

analyze_repository_size() {
    log "INFO" "Repository Size Analysis"
    echo "========================"
    
    # Total repository size
    local repo_size=$(du -sh "$PROJECT_ROOT" 2>/dev/null | cut -f1 || echo "Unknown")
    log "INFO" "Total repository size: $repo_size"
    
    # Models directory size
    if [[ -d "$PROJECT_ROOT/models" ]]; then
        local models_size=$(du -sh "$PROJECT_ROOT/models" 2>/dev/null | cut -f1 || echo "Unknown")
        local models_count=$(find "$PROJECT_ROOT/models" -name "*.pt" 2>/dev/null | wc -l || echo "0")
        log "INFO" "Models directory: $models_size ($models_count .pt files)"
    else
        log "WARNING" "Models directory not found"
    fi
    
    # Git objects size
    if [[ -d ".git/objects" ]]; then
        local git_objects_size=$(du -sh ".git/objects" 2>/dev/null | cut -f1 || echo "Unknown")
        log "INFO" "Git objects size: $git_objects_size"
    fi
    
    # LFS objects size
    if [[ -d ".git/lfs/objects" ]]; then
        local lfs_objects_size=$(du -sh ".git/lfs/objects" 2>/dev/null | cut -f1 || echo "0B")
        local lfs_objects_count=$(find ".git/lfs/objects" -type f 2>/dev/null | wc -l || echo "0")
        log "INFO" "LFS objects: $lfs_objects_size ($lfs_objects_count files)"
    else
        log "WARNING" "No LFS objects directory found"
    fi
    
    echo
}

check_model_health() {
    log "INFO" "Model Health Check"
    echo "=================="
    
    if [[ ! -d "$PROJECT_ROOT/models" ]]; then
        log "ERROR" "Models directory not found"
        return 1
    fi
    
    local total_models=0
    local lfs_models=0
    local large_models=0
    local corrupted_models=0
    
    for model_file in "$PROJECT_ROOT/models"/*.pt; do
        [[ -f "$model_file" ]] || continue
        
        total_models=$((total_models + 1))
        local filename=$(basename "$model_file")
        local filesize_bytes
        if [[ "$OSTYPE" == "darwin"* ]]; then
            filesize_bytes=$(stat -f%z "$model_file")
        else
            filesize_bytes=$(stat -c%s "$model_file")
        fi
        local filesize_mb=$((filesize_bytes / 1024 / 1024))
        
        # Check if file is tracked by LFS
        if git lfs ls-files | grep -q "$filename"; then
            lfs_models=$((lfs_models + 1))
            log "SUCCESS" "$filename ($filesize_mb MB) - LFS tracked"
        else
            if [[ $filesize_mb -gt 10 ]]; then
                large_models=$((large_models + 1))
                log "WARNING" "$filename ($filesize_mb MB) - Large file NOT in LFS"
            else
                log "INFO" "$filename ($filesize_mb MB) - Small file, LFS optional"
            fi
        fi
        
        # Basic corruption check (try to read file header)
        if ! head -c 100 "$model_file" >/dev/null 2>&1; then
            corrupted_models=$((corrupted_models + 1))
            log "ERROR" "$filename - Potentially corrupted (cannot read)"
        fi
    done
    
    echo
    log "INFO" "Summary:"
    log "INFO" "  Total models: $total_models"
    log "INFO" "  LFS tracked: $lfs_models"
    
    if [[ $large_models -gt 0 ]]; then
        log "WARNING" "  Large files not in LFS: $large_models"
    fi
    
    if [[ $corrupted_models -gt 0 ]]; then
        log "ERROR" "  Potentially corrupted: $corrupted_models"
    fi
    
    echo
}

performance_recommendations() {
    log "INFO" "Performance Recommendations"
    echo "============================"
    
    local recommendations=()
    
    # Check for large files not in LFS
    local large_files_count=0
    if [[ -d "$PROJECT_ROOT/models" ]]; then
        for file in "$PROJECT_ROOT/models"/*.pt; do
            [[ -f "$file" ]] || continue
            local filename=$(basename "$file")
            local filesize_bytes
            if [[ "$OSTYPE" == "darwin"* ]]; then
                filesize_bytes=$(stat -f%z "$file")
            else
                filesize_bytes=$(stat -c%s "$file")
            fi
            local filesize_mb=$((filesize_bytes / 1024 / 1024))
            
            if [[ $filesize_mb -gt 10 ]] && ! git lfs ls-files | grep -q "$filename"; then
                large_files_count=$((large_files_count + 1))
            fi
        done
    fi
    
    if [[ $large_files_count -gt 0 ]]; then
        recommendations+=("🔄 Migrate $large_files_count large model files to LFS")
    fi
    
    # Check repository size
    local repo_size_mb=$(du -sm "$PROJECT_ROOT" 2>/dev/null | cut -f1 || echo "0")
    if [[ $repo_size_mb -gt 500 ]]; then
        recommendations+=("📦 Repository is large (${repo_size_mb}MB) - consider cleaning up old files")
    fi
    
    # Check for many model files
    local model_count=$(find "$PROJECT_ROOT/models" -name "*.pt" 2>/dev/null | wc -l || echo "0")
    if [[ $model_count -gt 20 ]]; then
        recommendations+=("🧹 Many model files ($model_count) - consider cleanup of old training snapshots")
    fi
    
    # Check .git/objects size
    local git_objects_mb=$(du -sm ".git/objects" 2>/dev/null | cut -f1 || echo "0")
    if [[ $git_objects_mb -gt 100 ]]; then
        recommendations+=("🗜️  Large git objects (${git_objects_mb}MB) - consider 'git gc --aggressive'")
    fi
    
    if [[ ${#recommendations[@]} -eq 0 ]]; then
        log "SUCCESS" "No performance issues detected! Repository is well optimized."
    else
        log "WARNING" "Found ${#recommendations[@]} optimization opportunities:"
        for rec in "${recommendations[@]}"; do
            echo "  $rec"
        done
    fi
    
    echo
}

generate_monitor_report() {
    local report_file="$PROJECT_ROOT/MODEL_HEALTH_REPORT.md"
    
    cat > "$report_file" << EOF
# 📊 Model Repository Health Report

**Generated:** $(date)  
**Git Branch:** $(git branch --show-current)  
**Git Commit:** $(git rev-parse --short HEAD)

## 🎯 Quick Status

$(check_lfs_status 2>&1 | grep -E "(SUCCESS|WARNING|ERROR)" | head -5)

## 📊 Repository Metrics

$(analyze_repository_size 2>&1 | grep -E "Total repository size|Models directory|LFS objects")

## 🏥 Model Health

$(check_model_health 2>&1 | grep -E "Total models|LFS tracked|Large files not in LFS|corrupted")

## 🚀 Recommendations

$(performance_recommendations 2>&1 | tail -n +3)

## 🔧 Maintenance Commands

\`\`\`bash
# Run cleanup
./scripts/model-management/advanced-model-cleanup.sh

# Check LFS status
git lfs ls-files

# Optimize git repository
git gc --aggressive

# Check repository size
du -sh .
\`\`\`

---
*Generated by Model Repository Monitor*
EOF
    
    log "SUCCESS" "Health report saved to: $report_file"
}

main() {
    echo -e "${BLUE}╔══════════════════════════════════════════════════════════════╗${NC}"
    echo -e "${BLUE}║                📊 MODEL REPOSITORY MONITOR                   ║${NC}"
    echo -e "${BLUE}║                   Health & Performance                       ║${NC}"
    echo -e "${BLUE}╚══════════════════════════════════════════════════════════════╝${NC}"
    echo
    
    check_lfs_status
    analyze_repository_size  
    check_model_health
    performance_recommendations
    generate_monitor_report
    
    echo
    log "SUCCESS" "🎉 Monitoring complete! Check MODEL_HEALTH_REPORT.md for details"
}

# Handle command line arguments
case "${1:-}" in
    --help|-h)
        echo "Usage: $0 [--help]"
        echo "Monitor Git LFS usage and repository health"
        exit 0
        ;;
    *)
        main "$@"
        ;;
esac 