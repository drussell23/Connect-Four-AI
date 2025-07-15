#!/bin/bash

# 🧪 Workflow Testing Script
# This script helps validate GitHub Actions workflows locally

set -e

echo "🚀 Connect4 AI - Workflow Testing Script"
echo "========================================"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to print colored output
print_status() {
    local color=$1
    local message=$2
    echo -e "${color}${message}${NC}"
}

# Check if required tools are installed
check_dependencies() {
    print_status $BLUE "🔍 Checking dependencies..."
    
    local missing_deps=()
    
    # Check for Node.js
    if ! command -v node &> /dev/null; then
        missing_deps+=("node")
    else
        print_status $GREEN "✅ Node.js $(node --version)"
    fi
    
    # Check for npm
    if ! command -v npm &> /dev/null; then
        missing_deps+=("npm")
    else
        print_status $GREEN "✅ npm $(npm --version)"
    fi
    
    # Check for Python
    if ! command -v python3 &> /dev/null; then
        missing_deps+=("python3")
    else
        print_status $GREEN "✅ Python $(python3 --version)"
    fi
    
    # Check for Docker
    if ! command -v docker &> /dev/null; then
        missing_deps+=("docker")
    else
        print_status $GREEN "✅ Docker $(docker --version | cut -d' ' -f3)"
    fi
    
    # Check for GitHub CLI (optional but helpful)
    if ! command -v gh &> /dev/null; then
        print_status $YELLOW "⚠️  GitHub CLI not found (optional)"
    else
        print_status $GREEN "✅ GitHub CLI $(gh --version | head -n1)"
    fi
    
    # Check for act (for local workflow testing)
    if ! command -v act &> /dev/null; then
        print_status $YELLOW "⚠️  act not found (recommended for local testing)"
        print_status $YELLOW "   Install with: curl https://raw.githubusercontent.com/nektos/act/master/install.sh | sudo bash"
    else
        print_status $GREEN "✅ act $(act --version)"
    fi
    
    if [ ${#missing_deps[@]} -ne 0 ]; then
        print_status $RED "❌ Missing dependencies: ${missing_deps[*]}"
        exit 1
    fi
}

# Validate workflow syntax
validate_workflows() {
    print_status $BLUE "🔍 Validating workflow syntax..."
    
    local workflow_files=(
        ".github/workflows/main.yml"
        ".github/workflows/ci.yml"
        ".github/workflows/security.yml"
        ".github/workflows/performance.yml"
        ".github/workflows/ml_training.yml"
        ".github/workflows/deployment.yml"
    )
    
    for workflow in "${workflow_files[@]}"; do
        if [ -f "$workflow" ]; then
            # Basic YAML syntax check with Python
            if python3 -c "import yaml; yaml.safe_load(open('$workflow'))" 2>/dev/null; then
                print_status $GREEN "✅ $workflow - Valid YAML"
            else
                print_status $RED "❌ $workflow - Invalid YAML syntax"
            fi
        else
            print_status $RED "❌ $workflow - File not found"
        fi
    done
}

# Check project structure
check_project_structure() {
    print_status $BLUE "🔍 Checking project structure..."
    
    local required_dirs=(
        "backend"
        "frontend"
        "ml_service"
        ".github/workflows"
        ".github/codeql"
    )
    
    local required_files=(
        "package.json"
        "backend/package.json"
        "frontend/package.json"
        ".github/codeql/codeql-config.yml"
    )
    
    # Check directories
    for dir in "${required_dirs[@]}"; do
        if [ -d "$dir" ]; then
            print_status $GREEN "✅ Directory: $dir"
        else
            print_status $RED "❌ Missing directory: $dir"
        fi
    done
    
    # Check files
    for file in "${required_files[@]}"; do
        if [ -f "$file" ]; then
            print_status $GREEN "✅ File: $file"
        else
            print_status $RED "❌ Missing file: $file"
        fi
    done
}

# Test local builds
test_local_builds() {
    print_status $BLUE "🔨 Testing local builds..."
    
    # Test backend build
    if [ -d "backend" ] && [ -f "backend/package.json" ]; then
        print_status $YELLOW "Testing backend build..."
        cd backend
        if npm ci --silent && npm run build --silent; then
            print_status $GREEN "✅ Backend build successful"
        else
            print_status $RED "❌ Backend build failed"
        fi
        cd ..
    fi
    
    # Test frontend build
    if [ -d "frontend" ] && [ -f "frontend/package.json" ]; then
        print_status $YELLOW "Testing frontend build..."
        cd frontend
        if npm ci --silent && npm run build --silent; then
            print_status $GREEN "✅ Frontend build successful"
        else
            print_status $RED "❌ Frontend build failed"
        fi
        cd ..
    fi
}

# Test with act (if available)
test_with_act() {
    if command -v act &> /dev/null; then
        print_status $BLUE "🎭 Testing workflows with act..."
        
        # Test the main workflow
        if act --list | grep -q "Main Pipeline"; then
            print_status $YELLOW "Found Main Pipeline workflow"
            # Note: We don't actually run it as it requires secrets and can be resource intensive
            print_status $GREEN "✅ Main Pipeline workflow detected"
        fi
        
        # Test CI workflow
        if act --list | grep -q "CI"; then
            print_status $GREEN "✅ CI workflow detected"
        fi
    else
        print_status $YELLOW "⚠️  act not available - skipping local workflow tests"
    fi
}

# Generate workflow documentation
generate_docs() {
    print_status $BLUE "📝 Generating workflow documentation..."
    
    cat > WORKFLOW_STATUS.md << EOF
# Workflow System Status

Generated on: $(date)

## Workflow Files
EOF
    
    for workflow in .github/workflows/*.yml; do
        if [ -f "$workflow" ]; then
            echo "- ✅ $(basename $workflow)" >> WORKFLOW_STATUS.md
        fi
    done
    
    cat >> WORKFLOW_STATUS.md << EOF

## Project Structure
EOF
    
    echo "- Backend: $([ -d backend ] && echo "✅" || echo "❌")" >> WORKFLOW_STATUS.md
    echo "- Frontend: $([ -d frontend ] && echo "✅" || echo "❌")" >> WORKFLOW_STATUS.md
    echo "- ML Service: $([ -d ml_service ] && echo "✅" || echo "❌")" >> WORKFLOW_STATUS.md
    
    print_status $GREEN "✅ Documentation generated: WORKFLOW_STATUS.md"
}

# Main execution
main() {
    print_status $BLUE "Starting workflow validation..."
    echo ""
    
    check_dependencies
    echo ""
    
    validate_workflows
    echo ""
    
    check_project_structure
    echo ""
    
    if [ "${1:-}" != "--skip-builds" ]; then
        test_local_builds
        echo ""
    fi
    
    test_with_act
    echo ""
    
    generate_docs
    echo ""
    
    print_status $GREEN "🎉 Workflow validation complete!"
    print_status $BLUE "📚 Next steps:"
    echo "   1. Review any ❌ items above and fix them"
    echo "   2. Push to a feature branch to test CI workflow"
    echo "   3. Create a PR to test the full pipeline"
    echo "   4. Check the Actions tab in GitHub for workflow runs"
    echo ""
    print_status $YELLOW "💡 Pro tips:"
    echo "   - Use 'gh workflow run main.yml' to manually trigger the main pipeline"
    echo "   - Install 'act' for local workflow testing"
    echo "   - Check .github/workflows/README.md for detailed documentation"
}

# Handle script arguments
case "${1:-}" in
    --help|-h)
        echo "Usage: $0 [OPTIONS]"
        echo ""
        echo "Options:"
        echo "  --help, -h          Show this help message"
        echo "  --skip-builds       Skip local build testing"
        echo "  --docs-only         Only generate documentation"
        echo ""
        exit 0
        ;;
    --docs-only)
        generate_docs
        exit 0
        ;;
    *)
        main "$@"
        ;;
esac 