#!/bin/bash

# =====================================================
# 🍎 CONNECT FOUR - M1-OPTIMIZED RESTART
# =====================================================
# Restart script with M1-specific optimizations

set -e  # Exit on error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
MAGENTA='\033[0;35m'
NC='\033[0m' # No Color

echo -e "${MAGENTA}🍎 M1-Optimized Restart${NC}"
echo -e "${MAGENTA}======================${NC}"

# Stop all services
echo -e "${BLUE}Phase 1: Stopping all services...${NC}"
./stop-all.sh

# Wait for cleanup
echo -e "${YELLOW}⏳ Waiting for cleanup...${NC}"
sleep 3

# Start with M1 optimizations
echo -e "${BLUE}Phase 2: Starting with M1 optimizations...${NC}"
./start-all-m1.sh

echo -e "${GREEN}✅ Restart complete!${NC}"