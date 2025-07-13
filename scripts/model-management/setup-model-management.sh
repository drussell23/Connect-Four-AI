#!/bin/bash

# 🚀 MODEL MANAGEMENT SYSTEM SETUP
# =================================
# Initialize advanced model management with LFS optimization

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
PURPLE='\033[0;35m'
NC='\033[0m'

log() {
    case "$1" in
        "SUCCESS") echo -e "${GREEN}✅ $2${NC}" ;;
        "INFO")    echo -e "${BLUE}ℹ️  $2${NC}" ;;
        "WARNING") echo -e "${YELLOW}⚠️  $2${NC}" ;;
        *)         echo -e "${PURPLE}🔧 $2${NC}" ;;
    esac
}

setup_npm_scripts() {
    log "INFO" "Setting up npm scripts for model management..."
    
    # Check if package.json exists
    if [[ ! -f "$PROJECT_ROOT/package.json" ]]; then
        log "WARNING" "package.json not found in project root"
        return 1
    fi
    
    # Add model management scripts to package.json
    if command -v jq >/dev/null 2>&1; then
        # Use jq if available for JSON manipulation
        jq '.scripts |= . + {
            "models:cleanup": "./scripts/model-management/advanced-model-cleanup.sh",
            "models:cleanup:dry": "./scripts/model-management/advanced-model-cleanup.sh --dry-run",
            "models:cleanup:force": "./scripts/model-management/advanced-model-cleanup.sh --force",
            "models:monitor": "./scripts/model-management/model-monitor.sh",
            "models:health": "./scripts/model-management/model-monitor.sh",
            "models:setup": "./scripts/model-management/setup-model-management.sh"
        }' "$PROJECT_ROOT/package.json" > "$PROJECT_ROOT/package.json.tmp" && mv "$PROJECT_ROOT/package.json.tmp" "$PROJECT_ROOT/package.json"
        
        log "SUCCESS" "Added model management scripts to package.json"
    else
        log "WARNING" "jq not available - manually add scripts to package.json"
        echo "Add these scripts to your package.json:"
        cat << 'EOF'
"models:cleanup": "./scripts/model-management/advanced-model-cleanup.sh",
"models:cleanup:dry": "./scripts/model-management/advanced-model-cleanup.sh --dry-run", 
"models:cleanup:force": "./scripts/model-management/advanced-model-cleanup.sh --force",
"models:monitor": "./scripts/model-management/model-monitor.sh",
"models:health": "./scripts/model-management/model-monitor.sh",
"models:setup": "./scripts/model-management/setup-model-management.sh"
EOF
    fi
}

setup_git_hooks() {
    log "INFO" "Setting up Git hooks for model management..."
    
    local hooks_dir="$PROJECT_ROOT/.git/hooks"
    
    # Pre-commit hook to check large files
    cat > "$hooks_dir/pre-commit" << 'EOF'
#!/bin/bash
# Pre-commit hook to check for large model files

# Check for large files not in LFS
large_files=$(git diff --cached --name-only | xargs -I {} sh -c 'if [ -f "{}" ]; then echo "{} $(stat -c%s "{}" 2>/dev/null || stat -f%z "{}")"; fi' | awk '$2 > 10485760 {print $1}')

if [ -n "$large_files" ]; then
    echo "🚨 WARNING: Large files detected that should be in LFS:"
    echo "$large_files"
    echo ""
    echo "Consider adding these to Git LFS:"
    echo "  git lfs track \"*.pt\""
    echo "  git add .gitattributes"
    echo ""
    echo "Or use the model cleanup script:"
    echo "  npm run models:cleanup"
    echo ""
    read -p "Continue anyway? (y/N): " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        exit 1
    fi
fi
EOF
    
    chmod +x "$hooks_dir/pre-commit"
    log "SUCCESS" "Pre-commit hook installed"
    
    # Post-merge hook to check model status
    cat > "$hooks_dir/post-merge" << 'EOF'
#!/bin/bash
# Post-merge hook to check model repository health

echo "🔍 Checking model repository health after merge..."
if [ -f "./scripts/model-management/model-monitor.sh" ]; then
    ./scripts/model-management/model-monitor.sh | grep -E "(WARNING|ERROR)" || true
fi
EOF
    
    chmod +x "$hooks_dir/post-merge"
    log "SUCCESS" "Post-merge hook installed"
}

create_model_documentation() {
    log "INFO" "Creating model management documentation..."
    
    cat > "$PROJECT_ROOT/models/README.md" << 'EOF'
# 🧠 Model Management

This directory contains machine learning models for the Connect Four AI system.

## 📁 Directory Structure

```
models/
├── README.md                    # This file
├── best_policy_net.pt          # Production model (tracked in Git LFS)
├── current_policy_net.pt       # Current working model (tracked in Git LFS)
├── model_config.json           # Model configuration
└── .gitignore                  # Smart file filtering
```

## 🎯 Model Types

### Production Models (Tracked in Git)
- `best_policy_net.pt` - Best performing model for production
- `current_policy_net.pt` - Current model under evaluation
- `production_*.pt` - Other production-ready models

### Training Snapshots (Ignored by Git)
- `fine_tuned_*.pt` - Training checkpoint snapshots
- `checkpoint_*.pt` - Epoch-based checkpoints
- `epoch_*.pt` / `step_*.pt` - Training progress snapshots

### Development Models (Ignored by Git)
- `*_dev.pt` / `*_test.pt` - Development and testing models
- `*_experiment.pt` - Experimental models
- `*_debug.pt` - Debug models

## 🛠️ Management Commands

```bash
# Clean up old training snapshots
npm run models:cleanup

# Dry run (see what would be cleaned)
npm run models:cleanup:dry

# Force cleanup without prompts
npm run models:cleanup:force

# Monitor repository health
npm run models:monitor

# Check model health
npm run models:health
```

## 📊 Git LFS Integration

Large model files (>10MB) are automatically stored in Git LFS for:
- ✅ Faster git operations (clone, pull, push)
- ✅ Reduced repository size
- ✅ Better performance with large files

## 🔧 Manual LFS Commands

```bash
# Check LFS status
git lfs ls-files

# Track new file types
git lfs track "*.onnx"

# Migrate existing files
git lfs migrate import --include="*.pt"

# Check LFS storage usage
git lfs ls-files --size
```

## 📋 Best Practices

1. **Keep only essential models in Git**
   - Production models: ✅ Track
   - Training snapshots: ❌ Don't track

2. **Use descriptive naming**
   - `best_policy_net_v2.pt` ✅
   - `model_1234.pt` ❌

3. **Regular cleanup**
   - Run `npm run models:cleanup` weekly
   - Keep <20 model files total

4. **Backup important models**
   - Production models are auto-backed up
   - Use external storage for training data

## 🚨 Troubleshooting

### Large Repository Size
```bash
# Check what's taking space
npm run models:monitor

# Clean up training snapshots
npm run models:cleanup:force

# Optimize git repository
git gc --aggressive
```

### LFS Issues
```bash
# Re-initialize LFS
git lfs install --force

# Check LFS configuration
git lfs track

# Verify file is in LFS
git lfs ls-files | grep your_file.pt
```

---
*Auto-generated by Model Management System*
EOF
    
    log "SUCCESS" "Model documentation created"
}

setup_monitoring_cron() {
    log "INFO" "Setting up optional monitoring cron job..."
    
    cat > "$PROJECT_ROOT/scripts/model-management/cron-model-check.sh" << 'EOF'
#!/bin/bash
# Weekly model repository health check

cd "$(dirname "$0")/../.."
./scripts/model-management/model-monitor.sh > logs/model-health-$(date +%Y%m%d).log 2>&1

# Clean up old logs (keep last 4 weeks)
find logs/ -name "model-health-*.log" -mtime +28 -delete 2>/dev/null || true
EOF
    
    chmod +x "$PROJECT_ROOT/scripts/model-management/cron-model-check.sh"
    
    log "INFO" "Cron script created. To enable weekly monitoring, add to crontab:"
    echo "  0 2 * * 0 $(realpath $PROJECT_ROOT)/scripts/model-management/cron-model-check.sh"
}

make_scripts_executable() {
    log "INFO" "Making scripts executable..."
    
    chmod +x "$SCRIPT_DIR"/*.sh
    log "SUCCESS" "All model management scripts are now executable"
}

main() {
    echo -e "${BLUE}╔══════════════════════════════════════════════════════════════╗${NC}"
    echo -e "${BLUE}║            🚀 MODEL MANAGEMENT SYSTEM SETUP                  ║${NC}"
    echo -e "${BLUE}║                Advanced LFS & Performance                    ║${NC}"
    echo -e "${BLUE}╚══════════════════════════════════════════════════════════════╝${NC}"
    echo
    
    log "INFO" "Initializing advanced model management system..."
    
    make_scripts_executable
    setup_npm_scripts  
    setup_git_hooks
    create_model_documentation
    setup_monitoring_cron
    
    echo
    log "SUCCESS" "🎉 Model management system setup complete!"
    echo
    log "INFO" "Available commands:"
    log "INFO" "  npm run models:cleanup     - Clean up old model files"
    log "INFO" "  npm run models:monitor     - Check repository health"  
    log "INFO" "  npm run models:health      - Model health check"
    log "INFO" "  npm run models:setup       - Re-run this setup"
    echo
    log "INFO" "Next steps:"
    log "INFO" "  1. Run: npm run models:cleanup:dry (see what would be cleaned)"
    log "INFO" "  2. Run: npm run models:cleanup (perform actual cleanup)"
    log "INFO" "  3. Run: npm run models:monitor (check health)"
    echo
    log "SUCCESS" "Ready to optimize your model repository! 🚀"
}

main "$@" 