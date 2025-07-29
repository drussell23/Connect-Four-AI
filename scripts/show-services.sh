#!/bin/bash

# =====================================================
# 📋 CONNECT FOUR AI - SERVICE OVERVIEW
# =====================================================
# This script displays all available services and their status

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
MAGENTA='\033[0;35m'
NC='\033[0m' # No Color

echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${BLUE}🎮 Connect Four AI - Service Architecture${NC}"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""

echo -e "${CYAN}📦 Core Services:${NC}"
echo "┌─────────────────────┬──────────┬────────────────────────────────┐"
echo "│ Service             │ Port     │ Description                    │"
echo "├─────────────────────┼──────────┼────────────────────────────────┤"
echo "│ Frontend (React)    │ 3000     │ Web UI for the game           │"
echo "│ Backend (NestJS)    │ 3001     │ REST API & WebSocket server   │"
echo "└─────────────────────┴──────────┴────────────────────────────────┘"
echo ""

echo -e "${MAGENTA}🤖 AI/ML Services:${NC}"
echo "┌─────────────────────┬──────────┬────────────────────────────────┐"
echo "│ Service             │ Port     │ Description                    │"
echo "├─────────────────────┼──────────┼────────────────────────────────┤"
echo "│ ML Service          │ 8000     │ Model training & management    │"
echo "│ ML Inference        │ 8001     │ Fast predictions & analysis    │"
echo "│ AI Coordination     │ 8002     │ Multi-agent coordination       │"
echo "└─────────────────────┴──────────┴────────────────────────────────┘"
echo ""

echo -e "${GREEN}✨ AI Features Integrated:${NC}"
echo "• Constitutional AI with safety monitoring"
echo "• Rainbow DQN (Deep Q-Network) with experience replay"
echo "• Neural architecture search"
echo "• Opponent modeling and adaptation"
echo "• Multi-agent debate system"
echo "• 10-step lookahead with MCTS"
echo "• Real-time learning from games"
echo "• Resource monitoring and throttling"
echo "• Async AI orchestration with caching"
echo "• Circuit breaker for fault tolerance"
echo ""

echo -e "${YELLOW}🔍 Current Service Status:${NC}"
echo "─────────────────────────────────────────────────────────────────"

# Function to check port status
check_port() {
    local port=$1
    local name=$2
    if lsof -i :$port 2>/dev/null | grep -q LISTEN; then
        echo -e "│ $name │ Port $port │ ${GREEN}● Running${NC}"
    else
        echo -e "│ $name │ Port $port │ ${RED}○ Stopped${NC}"
    fi
}

check_port 3000 "Frontend        "
check_port 3001 "Backend         "
check_port 8000 "ML Service      "
check_port 8001 "ML Inference    "
check_port 8002 "AI Coordination "

echo "─────────────────────────────────────────────────────────────────"
echo ""

echo -e "${BLUE}🚀 Quick Commands:${NC}"
echo "• Start all services:        npm run start:all"
echo "• Stop all services:         npm run stop:all"
echo "• Restart all services:      npm run restart:all"
echo "• Check port status:         npm run ports:status"
echo "• View AI resource usage:    curl http://localhost:3001/api/games/ai/resources"
echo ""

echo -e "${CYAN}📊 Monitoring:${NC}"
echo "• Health check:              http://localhost:3001/api/health"
echo "• AI resources:              http://localhost:3001/api/games/ai/resources"
echo "• ML service health:         http://localhost:8000/health"
echo "• View logs:                 tail -f logs/*.log"