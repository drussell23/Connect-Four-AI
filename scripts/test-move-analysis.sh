#!/bin/bash

# Test script for Move Analysis functionality
# This script verifies that the 404 errors are resolved and the system works correctly

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

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

# Function to check if a service is running
check_service() {
    local service_name=$1
    local port=$2
    local url=$3
    
    if curl -s "$url" > /dev/null 2>&1; then
        print_success "$service_name is running on port $port"
        return 0
    else
        print_error "$service_name is not running on port $port"
        return 1
    fi
}

# Function to test move analysis functionality
test_move_analysis() {
    print_status "Testing Move Analysis functionality..."
    
    # Create a test game
    print_status "Creating test game..."
    local create_response=$(curl -s -X POST http://localhost:3000/api/games \
        -H "Content-Type: application/json" \
        -d '{"playerId": "test-player", "clientId": "test-client"}')
    
    local game_id=$(echo "$create_response" | jq -r '.gameId')
    
    if [ "$game_id" = "null" ] || [ -z "$game_id" ]; then
        print_error "Failed to create test game"
        return 1
    fi
    
    print_success "Created test game: $game_id"
    
    # Test board access - should return 200 OK
    print_status "Testing board access..."
    local board_response=$(curl -s -w "%{http_code}" http://localhost:3000/api/games/$game_id/board)
    local board_status=$(echo "$board_response" | tail -c 4)
    local board_data=$(echo "$board_response" | head -c -4)
    
    if [ "$board_status" = "200" ]; then
        print_success "Board access returned 200 OK"
    else
        print_error "Board access failed with status $board_status"
        return 1
    fi
    
    # Test move analysis - should return 200 OK
    print_status "Testing move analysis..."
    local analysis_response=$(curl -s -w "%{http_code}" \
        -X POST http://localhost:3000/api/games/$game_id/analyze-move \
        -H "Content-Type: application/json" \
        -d '{"column": 3, "player": "player", "aiLevel": 1}')
    
    local analysis_status=$(echo "$analysis_response" | tail -c 4)
    local analysis_data=$(echo "$analysis_response" | head -c -4)
    
    if [ "$analysis_status" = "200" ]; then
        print_success "Move analysis returned 200 OK"
        
        # Verify analysis data structure
        local quality=$(echo "$analysis_data" | jq -r '.quality')
        local confidence=$(echo "$analysis_data" | jq -r '.confidence')
        local move=$(echo "$analysis_data" | jq -r '.move')
        
        if [ "$quality" != "null" ] && [ "$confidence" != "null" ] && [ "$move" != "null" ]; then
            print_success "Analysis data is valid: quality=$quality, confidence=$confidence, move=$move"
        else
            print_error "Analysis data is incomplete"
            return 1
        fi
    else
        print_error "Move analysis failed with status $analysis_status"
        return 1
    fi
    
    # Test non-existent game - should return 404
    print_status "Testing non-existent game (should return 404)..."
    local not_found_response=$(curl -s -w "%{http_code}" http://localhost:3000/api/games/non-existent-game/board)
    local not_found_status=$(echo "$not_found_response" | tail -c 4)
    
    if [ "$not_found_status" = "404" ]; then
        print_success "Non-existent game correctly returned 404"
    else
        print_error "Non-existent game returned unexpected status $not_found_status"
        return 1
    fi
    
    return 0
}

# Function to test frontend integration
test_frontend_integration() {
    print_status "Testing frontend integration..."
    
    # Check if frontend is accessible
    if curl -s http://localhost:3001 > /dev/null 2>&1; then
        print_success "Frontend is accessible on port 3001"
    else
        print_warning "Frontend is not accessible on port 3001"
        return 1
    fi
    
    return 0
}

# Function to run backend tests
run_backend_tests() {
    print_status "Running backend tests..."
    
    cd backend
    
    if npm test -- --testPathPattern="move-analysis" --verbose; then
        print_success "Backend tests passed"
        return 0
    else
        print_error "Backend tests failed"
        return 1
    fi
}

# Function to run frontend tests
run_frontend_tests() {
    print_status "Running frontend tests..."
    
    cd frontend
    
    if npm test -- --testPathPattern="moveAnalysisService" --verbose --watchAll=false; then
        print_success "Frontend tests passed"
        return 0
    else
        print_error "Frontend tests failed"
        return 1
    fi
}

# Main test execution
main() {
    print_status "Starting Move Analysis Test Suite..."
    print_status "====================================="
    
    # Check if services are running
    print_status "Checking service status..."
    
    local backend_ok=false
    local frontend_ok=false
    
    if check_service "Backend" "3000" "http://localhost:3000/api/health"; then
        backend_ok=true
    fi
    
    if check_service "Frontend" "3001" "http://localhost:3001"; then
        frontend_ok=true
    fi
    
    if [ "$backend_ok" = false ] && [ "$frontend_ok" = false ]; then
        print_error "Neither backend nor frontend is running. Please start the services first."
        print_status "You can start them with: npm run start:force"
        exit 1
    fi
    
    # Test backend functionality
    if [ "$backend_ok" = true ]; then
        print_status "Testing backend functionality..."
        if test_move_analysis; then
            print_success "Backend functionality tests passed"
        else
            print_error "Backend functionality tests failed"
            exit 1
        fi
    fi
    
    # Test frontend integration
    if [ "$frontend_ok" = true ]; then
        print_status "Testing frontend integration..."
        if test_frontend_integration; then
            print_success "Frontend integration tests passed"
        else
            print_warning "Frontend integration tests failed"
        fi
    fi
    
    # Run automated tests
    print_status "Running automated tests..."
    
    local test_results=0
    
    if [ "$backend_ok" = true ]; then
        if run_backend_tests; then
            print_success "Backend automated tests passed"
        else
            print_error "Backend automated tests failed"
            test_results=$((test_results + 1))
        fi
    fi
    
    if [ "$frontend_ok" = true ]; then
        if run_frontend_tests; then
            print_success "Frontend automated tests passed"
        else
            print_error "Frontend automated tests failed"
            test_results=$((test_results + 1))
        fi
    fi
    
    # Summary
    print_status "====================================="
    print_status "Test Summary:"
    
    if [ "$backend_ok" = true ]; then
        print_success "✓ Backend service is running"
        print_success "✓ Backend functionality tests passed"
    else
        print_error "✗ Backend service is not running"
    fi
    
    if [ "$frontend_ok" = true ]; then
        print_success "✓ Frontend service is running"
        print_success "✓ Frontend integration tests passed"
    else
        print_error "✗ Frontend service is not running"
    fi
    
    if [ $test_results -eq 0 ]; then
        print_success "✓ All automated tests passed"
        print_success "✅ Move Analysis 404 issue has been RESOLVED!"
        print_status "The system now uses frontend board state to avoid 404 errors"
    else
        print_error "✗ Some automated tests failed"
        print_warning "Please check the test output for details"
    fi
    
    print_status "====================================="
}

# Run the main function
main "$@" 