#!/bin/bash

# =====================================================
# 🍎 M1 Optimization Dependencies Installer
# =====================================================

echo "Installing M1 optimization dependencies..."

# Frontend dependencies
echo "📦 Installing frontend dependencies..."
cd frontend
npm install recharts
cd ..

# Backend dependencies (if any new ones needed)
echo "📦 Checking backend dependencies..."
cd backend
# All backend dependencies should already be installed
cd ..

echo "✅ Dependencies installed!"
echo ""
echo "Next steps:"
echo "1. Run: npm run restart:all"
echo "2. Access dashboard at: http://localhost:3001/dashboard"