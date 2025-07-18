#!/bin/bash

# Connect Four AI - Production Deployment Script
# This script automates the deployment process for production

set -e  # Exit on any error

echo "🚀 Connect Four AI - Production Deployment"
echo "=========================================="

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
BACKEND_DIR="backend"
FRONTEND_DIR="frontend"
ML_SERVICE_DIR="ml_service"

# Function to print colored output
print_status() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Function to check if command exists
command_exists() {
    command -v "$1" >/dev/null 2>&1
}

# Function to check prerequisites
check_prerequisites() {
    print_status "Checking prerequisites..."
    
    # Check for Node.js
    if ! command_exists node; then
        print_error "Node.js is not installed. Please install Node.js first."
        exit 1
    fi
    
    # Check for npm
    if ! command_exists npm; then
        print_error "npm is not installed. Please install npm first."
        exit 1
    fi
    
    # Check for Railway CLI
    if ! command_exists railway; then
        print_warning "Railway CLI not found. Installing..."
        npm install -g @railway/cli
    fi
    
    # Check for Vercel CLI
    if ! command_exists vercel; then
        print_warning "Vercel CLI not found. Installing..."
        npm install -g vercel
    fi
    
    print_success "Prerequisites check completed"
}

# Function to build backend
build_backend() {
    print_status "Building backend..."
    
    cd "$BACKEND_DIR"
    
    # Install dependencies
    npm install
    
    # Build the application
    npm run build
    
    if [ $? -eq 0 ]; then
        print_success "Backend build completed"
    else
        print_error "Backend build failed"
        exit 1
    fi
    
    cd ..
}

# Function to build frontend
build_frontend() {
    print_status "Building frontend..."
    
    cd "$FRONTEND_DIR"
    
    # Install dependencies
    npm install
    
    # Build the application
    npm run build
    
    if [ $? -eq 0 ]; then
        print_success "Frontend build completed"
    else
        print_error "Frontend build failed"
        exit 1
    fi
    
    cd ..
}

# Function to deploy backend to Railway
deploy_backend() {
    print_status "Deploying backend to Railway..."
    
    cd "$BACKEND_DIR"
    
    # Check if Railway project is initialized
    if [ ! -f "railway.json" ]; then
        print_warning "Railway project not initialized. Please run 'railway init' first."
        return 1
    fi
    
    # Deploy to Railway
    railway up
    
    if [ $? -eq 0 ]; then
        print_success "Backend deployed to Railway"
    else
        print_error "Backend deployment failed"
        return 1
    fi
    
    cd ..
}

# Function to deploy frontend to Vercel
deploy_frontend() {
    print_status "Deploying frontend to Vercel..."
    
    cd "$FRONTEND_DIR"
    
    # Deploy to Vercel
    vercel --prod --yes
    
    if [ $? -eq 0 ]; then
        print_success "Frontend deployed to Vercel"
    else
        print_error "Frontend deployment failed"
        return 1
    fi
    
    cd ..
}

# Function to run tests
run_tests() {
    print_status "Running tests..."
    
    # Backend tests
    cd "$BACKEND_DIR"
    npm test
    cd ..
    
    # Frontend tests
    cd "$FRONTEND_DIR"
    npm test -- --watchAll=false
    cd ..
    
    print_success "Tests completed"
}

# Function to show deployment status
show_status() {
    print_status "Deployment Status:"
    echo "=================="
    
    # Check Railway status
    if command_exists railway; then
        print_status "Railway CLI: Available"
    else
        print_warning "Railway CLI: Not installed"
    fi
    
    # Check Vercel status
    if command_exists vercel; then
        print_status "Vercel CLI: Available"
    else
        print_warning "Vercel CLI: Not installed"
    fi
    
    # Check if builds exist
    if [ -d "$BACKEND_DIR/dist" ]; then
        print_success "Backend build: Ready"
    else
        print_warning "Backend build: Not found"
    fi
    
    if [ -d "$FRONTEND_DIR/build" ]; then
        print_success "Frontend build: Ready"
    else
        print_warning "Frontend build: Not found"
    fi
}

# Function to show help
show_help() {
    echo "Connect Four AI - Deployment Script"
    echo "=================================="
    echo ""
    echo "Usage: $0 [OPTION]"
    echo ""
    echo "Options:"
    echo "  build       Build both frontend and backend"
    echo "  deploy      Deploy to production"
    echo "  test        Run tests"
    echo "  status      Show deployment status"
    echo "  help        Show this help message"
    echo ""
    echo "Examples:"
    echo "  $0 build     # Build applications"
    echo "  $0 deploy    # Deploy to production"
    echo "  $0 test      # Run tests"
    echo ""
}

# Main script logic
case "${1:-help}" in
    "build")
        check_prerequisites
        build_backend
        build_frontend
        print_success "Build process completed successfully!"
        ;;
    "deploy")
        check_prerequisites
        build_backend
        build_frontend
        deploy_backend
        deploy_frontend
        print_success "Deployment completed successfully!"
        ;;
    "test")
        run_tests
        ;;
    "status")
        show_status
        ;;
    "help"|*)
        show_help
        ;;
esac

echo ""
print_success "Script execution completed!" 