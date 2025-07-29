#!/bin/bash

# Demo script to show progress bar capabilities

source scripts/progress-bar.sh

# Colors
BLUE='\033[0;34m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

echo -e "${BLUE}📊 Progress Bar Demo${NC}"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""

# Example 1: Simple progress
echo -e "${GREEN}Example 1: Simple Task Progress${NC}"
TOTAL=10
for i in $(seq 1 $TOTAL); do
    update_progress $i $TOTAL "Processing item $i of $TOTAL"
    sleep 0.5
done
complete_progress
echo ""

# Example 2: Varying speeds
echo -e "${GREEN}Example 2: Variable Speed Tasks${NC}"
TASKS=("Fast task" "Medium task" "Slow task" "Quick task")
SPEEDS=(0.2 0.5 1.0 0.1)
TOTAL=${#TASKS[@]}

for i in "${!TASKS[@]}"; do
    update_progress $((i)) $TOTAL "${TASKS[$i]}"
    sleep ${SPEEDS[$i]}
done
complete_progress
echo ""

# Example 3: Simulated service startup
echo -e "${GREEN}Example 3: Service Startup Simulation${NC}"
SERVICES=("Database" "Cache" "API Server" "Frontend" "ML Engine")
TOTAL=${#SERVICES[@]}

for i in "${!SERVICES[@]}"; do
    update_progress $i $TOTAL "Starting ${SERVICES[$i]}..."
    # Simulate varying startup times
    sleep $((RANDOM % 3 + 1))
done
complete_progress

echo ""
echo -e "${BLUE}✅ Demo completed!${NC}"
echo -e "${YELLOW}Total time: $(format_time $(($(date +%s) - PROGRESS_START_TIME)))${NC}"