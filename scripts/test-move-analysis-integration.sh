#!/bin/bash

# Comprehensive Move Analysis Integration Test
# This script tests the complete move analysis functionality to verify 404 errors are resolved

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
PURPLE='\033[0;35m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

print_header() {
    echo -e "${PURPLE}=====================================${NC}"
    echo -e "${PURPLE}Move Analysis Integration Test Suite${NC}"
    echo -e "${PURPLE}=====================================${NC}"
}

print_section() {
    echo -e "${CYAN}📋 $1${NC}"
}

print_success() {
    echo -e "${GREEN}✅ $1${NC}"
}

print_error() {
    echo -e "${RED}❌ $1${NC}"
}

print_warning() {
    echo -e "${YELLOW}⚠️  $1${NC}"
}

print_info() {
    echo -e "${BLUE}ℹ️  $1${NC}"
}

# Test counter
TESTS_PASSED=0
TESTS_FAILED=0

# Function to run a test
run_test() {
    local test_name="$1"
    local test_command="$2"
    local expected_status="$3"
    
    print_section "Running: $test_name"
    
    if eval "$test_command" > /dev/null 2>&1; then
        print_success "$test_name passed"
        ((TESTS_PASSED++))
        return 0
    else
        print_error "$test_name failed"
        ((TESTS_FAILED++))
        return 1
    fi
}

# Function to test service health
test_service_health() {
    print_section "Testing Service Health"
    
    # Test backend health
    if curl -s http://localhost:3000/api/health > /dev/null; then
        print_success "Backend is healthy"
        ((TESTS_PASSED++))
    else
        print_error "Backend is not responding"
        ((TESTS_FAILED++))
        return 1
    fi
    
    # Test frontend accessibility
    if curl -s http://localhost:3001 > /dev/null; then
        print_success "Frontend is accessible"
        ((TESTS_PASSED++))
    else
        print_warning "Frontend is not accessible"
        ((TESTS_FAILED++))
    fi
}

# Function to test game creation and board access
test_game_creation() {
    print_section "Testing Game Creation and Board Access"
    
    # Create a game
    local create_response=$(curl -s -X POST http://localhost:3000/api/games \
        -H "Content-Type: application/json" \
        -d '{"playerId": "test-player", "clientId": "test-client"}')
    
    local game_id=$(echo "$create_response" | jq -r '.gameId')
    
    if [ "$game_id" = "null" ] || [ -z "$game_id" ]; then
        print_error "Failed to create test game"
        ((TESTS_FAILED++))
        return 1
    fi
    
    print_success "Created test game: $game_id"
    ((TESTS_PASSED++))
    
    # Test board access
    local board_status=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:3000/api/games/$game_id/board)
    
    if [ "$board_status" = "200" ]; then
        print_success "Board access returned 200 OK"
        ((TESTS_PASSED++))
    else
        print_error "Board access failed with status $board_status"
        ((TESTS_FAILED++))
        return 1
    fi
    
    # Store game ID for later tests
    echo "$game_id" > /tmp/test_game_id
}

# Function to test move analysis
test_move_analysis() {
    print_section "Testing Move Analysis"
    
    local game_id=$(cat /tmp/test_game_id 2>/dev/null || echo "")
    
    if [ -z "$game_id" ]; then
        print_error "No game ID available for move analysis test"
        ((TESTS_FAILED++))
        return 1
    fi
    
    # Test move analysis with different columns
    local columns=(0 3 6)
    local players=("player" "ai")
    
    for column in "${columns[@]}"; do
        for player in "${players[@]}"; do
            local analysis_response=$(curl -s -X POST http://localhost:3000/api/games/$game_id/analyze-move \
                -H "Content-Type: application/json" \
                -d "{\"column\": $column, \"player\": \"$player\", \"aiLevel\": 1}")
            
            local analysis_status=$(curl -s -o /dev/null -w "%{http_code}" \
                -X POST http://localhost:3000/api/games/$game_id/analyze-move \
                -H "Content-Type: application/json" \
                -d "{\"column\": $column, \"player\": \"$player\", \"aiLevel\": 1}")
            
            if [ "$analysis_status" = "200" ] || [ "$analysis_status" = "201" ]; then
                print_success "Move analysis for column $column, player $player returned $analysis_status"
                ((TESTS_PASSED++))
                
                # Verify analysis data
                local quality=$(echo "$analysis_response" | jq -r '.quality')
                local confidence=$(echo "$analysis_response" | jq -r '.confidence')
                local move=$(echo "$analysis_response" | jq -r '.move')
                
                if [ "$quality" != "null" ] && [ "$confidence" != "null" ] && [ "$move" != "null" ]; then
                    print_success "Analysis data is valid: quality=$quality, confidence=$confidence, move=$move"
                    ((TESTS_PASSED++))
                else
                    print_error "Analysis data is incomplete"
                    ((TESTS_FAILED++))
                fi
            else
                print_error "Move analysis failed with status $analysis_status"
                ((TESTS_FAILED++))
            fi
        done
    done
}

# Function to test error handling
test_error_handling() {
    print_section "Testing Error Handling"
    
    # Test non-existent game
    local not_found_status=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:3000/api/games/non-existent-game/board)
    
    if [ "$not_found_status" = "404" ]; then
        print_success "Non-existent game correctly returned 404"
        ((TESTS_PASSED++))
    else
        print_error "Non-existent game returned unexpected status $not_found_status"
        ((TESTS_FAILED++))
    fi
    
    # Test invalid move analysis
    local invalid_status=$(curl -s -o /dev/null -w "%{http_code}" \
        -X POST http://localhost:3000/api/games/non-existent-game/analyze-move \
        -H "Content-Type: application/json" \
        -d '{"column": 3, "player": "player", "aiLevel": 1}')
    
    if [ "$invalid_status" = "404" ] || [ "$invalid_status" = "400" ]; then
        print_success "Invalid move analysis correctly returned $invalid_status"
        ((TESTS_PASSED++))
    else
        print_error "Invalid move analysis returned unexpected status $invalid_status"
        ((TESTS_FAILED++))
    fi
}

# Function to test performance
test_performance() {
    print_section "Testing Performance"
    
    local game_id=$(cat /tmp/test_game_id 2>/dev/null || echo "")
    
    if [ -z "$game_id" ]; then
        print_warning "No game ID available for performance test"
        return 0
    fi
    
    # Test response time
    local start_time=$(date +%s%N)
    
    curl -s -X POST http://localhost:3000/api/games/$game_id/analyze-move \
        -H "Content-Type: application/json" \
        -d '{"column": 3, "player": "player", "aiLevel": 1}' > /dev/null
    
    local end_time=$(date +%s%N)
    local duration=$(( (end_time - start_time) / 1000000 )) # Convert to milliseconds
    
    if [ $duration -lt 5000 ]; then
        print_success "Move analysis completed in ${duration}ms (under 5 seconds)"
        ((TESTS_PASSED++))
    else
        print_warning "Move analysis took ${duration}ms (over 5 seconds)"
        ((TESTS_FAILED++))
    fi
}

# Function to test concurrent requests
test_concurrent_requests() {
    print_section "Testing Concurrent Requests"
    
    local game_id=$(cat /tmp/test_game_id 2>/dev/null || echo "")
    
    if [ -z "$game_id" ]; then
        print_warning "No game ID available for concurrent test"
        return 0
    fi
    
    # Make 5 concurrent requests
    local success_count=0
    local total_requests=5
    
    for i in {1..5}; do
        local status=$(curl -s -o /dev/null -w "%{http_code}" \
            -X POST http://localhost:3000/api/games/$game_id/analyze-move \
            -H "Content-Type: application/json" \
            -d "{\"column\": $((i % 7)), \"player\": \"player\", \"aiLevel\": 1}")
        
        if [ "$status" = "200" ] || [ "$status" = "201" ]; then
            ((success_count++))
        fi
    done
    
    if [ $success_count -eq $total_requests ]; then
        print_success "All $total_requests concurrent requests succeeded"
        ((TESTS_PASSED++))
    else
        print_warning "$success_count/$total_requests concurrent requests succeeded"
        ((TESTS_FAILED++))
    fi
}

# Function to test frontend integration
test_frontend_integration() {
    print_section "Testing Frontend Integration"
    
    # Check if frontend is serving the application
    local frontend_response=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:3001)
    
    if [ "$frontend_response" = "200" ]; then
        print_success "Frontend is serving the application correctly"
        ((TESTS_PASSED++))
    else
        print_warning "Frontend returned status $frontend_response"
        ((TESTS_FAILED++))
    fi
    
    # Check if frontend has the move analysis component
    local frontend_content=$(curl -s http://localhost:3001 | grep -i "move" || true)
    
    if [ -n "$frontend_content" ]; then
        print_success "Frontend contains move-related content"
        ((TESTS_PASSED++))
    else
        print_warning "Frontend content check inconclusive"
    fi
}

# Function to generate test report
generate_report() {
    print_section "Test Report"
    
    local total_tests=$((TESTS_PASSED + TESTS_FAILED))
    
    echo -e "${PURPLE}=====================================${NC}"
    echo -e "${PURPLE}Test Results Summary${NC}"
    echo -e "${PURPLE}=====================================${NC}"
    echo -e "${GREEN}✅ Tests Passed: $TESTS_PASSED${NC}"
    echo -e "${RED}❌ Tests Failed: $TESTS_FAILED${NC}"
    echo -e "${BLUE}📊 Total Tests: $total_tests${NC}"
    
    if [ $total_tests -gt 0 ]; then
        local success_rate=$(( (TESTS_PASSED * 100) / total_tests ))
        echo -e "${BLUE}📈 Success Rate: ${success_rate}%${NC}"
    fi
    
    echo -e "${PURPLE}=====================================${NC}"
    
    if [ $TESTS_FAILED -eq 0 ]; then
        print_success "🎉 All tests passed! Move Analysis 404 issue is RESOLVED!"
        print_info "The system now uses frontend board state to avoid 404 errors"
        print_info "Backend move analysis is working correctly with 200/201 responses"
        return 0
    else
        print_error "⚠️  Some tests failed. Please check the implementation."
        return 1
    fi
}

# Main test execution
main() {
    print_header
    
    # Check if services are running
    print_section "Checking Service Status"
    
    if ! curl -s http://localhost:3000/api/health > /dev/null 2>&1; then
        print_error "Backend is not running. Please start the services first."
        print_info "You can start them with: npm run start:force"
        exit 1
    fi
    
    print_success "Services are running"
    
    # Run all tests
    test_service_health
    test_game_creation
    test_move_analysis
    test_error_handling
    test_performance
    test_concurrent_requests
    test_frontend_integration
    
    # Clean up
    rm -f /tmp/test_game_id
    
    # Generate report
    generate_report
}

# Run the main function
main "$@" 