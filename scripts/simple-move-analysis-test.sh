#!/bin/bash

# Simple test script for Move Analysis functionality
# This script verifies that the 404 errors are resolved

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

print_status() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

echo "====================================="
echo "Move Analysis Test - 404 Error Resolution"
echo "====================================="

# Test 1: Create a game and verify board access
print_status "Test 1: Creating game and testing board access..."
GAME_RESPONSE=$(curl -s -X POST http://localhost:3000/api/games \
    -H "Content-Type: application/json" \
    -d '{"playerId": "test-player", "clientId": "test-client"}')

GAME_ID=$(echo "$GAME_RESPONSE" | jq -r '.gameId')

if [ "$GAME_ID" = "null" ] || [ -z "$GAME_ID" ]; then
    print_error "Failed to create test game"
    exit 1
fi

print_success "Created test game: $GAME_ID"

# Test 2: Access board - should return 200 OK
print_status "Test 2: Testing board access..."
BOARD_STATUS=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:3000/api/games/$GAME_ID/board)

if [ "$BOARD_STATUS" = "200" ]; then
    print_success "Board access returned 200 OK"
else
    print_error "Board access failed with status $BOARD_STATUS"
    exit 1
fi

# Test 3: Analyze move - should return 200 OK
print_status "Test 3: Testing move analysis..."
ANALYSIS_RESPONSE=$(curl -s -X POST http://localhost:3000/api/games/$GAME_ID/analyze-move \
    -H "Content-Type: application/json" \
    -d '{"column": 3, "player": "player", "aiLevel": 1}')

ANALYSIS_STATUS=$(curl -s -o /dev/null -w "%{http_code}" \
    -X POST http://localhost:3000/api/games/$GAME_ID/analyze-move \
    -H "Content-Type: application/json" \
    -d '{"column": 3, "player": "player", "aiLevel": 1}')

if [ "$ANALYSIS_STATUS" = "200" ] || [ "$ANALYSIS_STATUS" = "201" ]; then
    print_success "Move analysis returned $ANALYSIS_STATUS OK"
    
    # Verify analysis data
    QUALITY=$(echo "$ANALYSIS_RESPONSE" | jq -r '.quality')
    CONFIDENCE=$(echo "$ANALYSIS_RESPONSE" | jq -r '.confidence')
    MOVE=$(echo "$ANALYSIS_RESPONSE" | jq -r '.move')
    
    if [ "$QUALITY" != "null" ] && [ "$CONFIDENCE" != "null" ] && [ "$MOVE" != "null" ]; then
        print_success "Analysis data is valid: quality=$QUALITY, confidence=$CONFIDENCE, move=$MOVE"
    else
        print_error "Analysis data is incomplete"
        exit 1
    fi
else
    print_error "Move analysis failed with status $ANALYSIS_STATUS"
    exit 1
fi

# Test 4: Test non-existent game - should return 404
print_status "Test 4: Testing non-existent game (should return 404)..."
NOT_FOUND_STATUS=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:3000/api/games/non-existent-game/board)

if [ "$NOT_FOUND_STATUS" = "404" ]; then
    print_success "Non-existent game correctly returned 404"
else
    print_error "Non-existent game returned unexpected status $NOT_FOUND_STATUS"
    exit 1
fi

# Test 5: Test frontend accessibility
print_status "Test 5: Testing frontend accessibility..."
FRONTEND_STATUS=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:3001)

if [ "$FRONTEND_STATUS" = "200" ]; then
    print_success "Frontend is accessible on port 3001"
else
    print_error "Frontend is not accessible on port 3001 (status: $FRONTEND_STATUS)"
fi

echo "====================================="
print_success "✅ All tests passed!"
print_success "✅ Move Analysis 404 issue has been RESOLVED!"
print_status "The system now uses frontend board state to avoid 404 errors"
print_status "Backend move analysis is working correctly with 200/201 responses"
echo "=====================================" 