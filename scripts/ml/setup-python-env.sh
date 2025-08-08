#!/bin/bash

# Python Environment Setup Script
# Sets up Python virtual environment and installs dependencies

set -e

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
CYAN='\033[0;36m'
NC='\033[0m'

# Get script directory
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
PROJECT_ROOT="$( cd "$SCRIPT_DIR/../.." && pwd )"

echo -e "${CYAN}🐍 Python Environment Setup${NC}"
echo -e "${CYAN}==========================${NC}"

# Check Python version
if ! command -v python3 &> /dev/null; then
    echo -e "${RED}❌ Python 3 is not installed${NC}"
    echo -e "${YELLOW}Please install Python 3.9 or later${NC}"
    exit 1
fi

PYTHON_VERSION=$(python3 --version | cut -d' ' -f2)
echo -e "${GREEN}✅ Found Python $PYTHON_VERSION${NC}"

# Create virtual environment for ml_service
echo -e "\n${CYAN}Setting up ml_service virtual environment...${NC}"
cd "$PROJECT_ROOT/ml_service"

if [ -d "venv" ]; then
    echo -e "${YELLOW}⚠️  Virtual environment already exists${NC}"
    read -p "Do you want to recreate it? (y/N) " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        rm -rf venv
        python3 -m venv venv
    fi
else
    python3 -m venv venv
fi

# Activate virtual environment
source venv/bin/activate

# Upgrade pip
echo -e "${CYAN}Upgrading pip...${NC}"
pip install --upgrade pip setuptools wheel

# Install requirements
if [ -f "requirements.txt" ]; then
    echo -e "${CYAN}Installing ml_service requirements...${NC}"
    pip install -r requirements.txt
else
    echo -e "${YELLOW}⚠️  No requirements.txt found in ml_service${NC}"
fi

# Create virtual environment for python-trainer
echo -e "\n${CYAN}Setting up python-trainer virtual environment...${NC}"
TRAINER_DIR="$PROJECT_ROOT/backend/src/ai/hybrid-architecture/python-trainer"

if [ -d "$TRAINER_DIR" ]; then
    cd "$TRAINER_DIR"
    
    if [ ! -d "venv" ]; then
        python3 -m venv venv
    fi
    
    source venv/bin/activate
    pip install --upgrade pip
    
    if [ -f "requirements.txt" ]; then
        echo -e "${CYAN}Installing python-trainer requirements...${NC}"
        pip install -r requirements.txt
    else
        # Install common ML dependencies
        echo -e "${CYAN}Installing common ML dependencies...${NC}"
        pip install fastapi uvicorn numpy torch scikit-learn pandas
    fi
fi

# Summary
echo -e "\n${GREEN}✅ Python environment setup complete!${NC}"
echo -e "${CYAN}📌 Virtual environments created:${NC}"
echo "   • $PROJECT_ROOT/ml_service/venv"
echo "   • $TRAINER_DIR/venv"
echo ""
echo -e "${CYAN}💡 To activate ml_service environment:${NC}"
echo "   cd ml_service && source venv/bin/activate"
echo ""
echo -e "${CYAN}🚀 To start ML services:${NC}"
echo "   npm run ml:start"