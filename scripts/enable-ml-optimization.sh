#!/bin/bash

# Enable ML optimization flag for backend
echo "🚀 Enabling ML optimization for faster AI response times..."

# Create or update .env file to enable ML optimization
if [ -f "backend/.env" ]; then
    # Check if ML_OPTIMIZATION is already set
    if grep -q "ML_OPTIMIZATION=" "backend/.env"; then
        sed -i.bak 's/ML_OPTIMIZATION=.*/ML_OPTIMIZATION=true/' "backend/.env"
    else
        echo "ML_OPTIMIZATION=true" >> "backend/.env"
    fi
else
    echo "ML_OPTIMIZATION=true" > "backend/.env"
fi

# Also set for root .env if exists
if [ -f ".env" ]; then
    if grep -q "ML_OPTIMIZATION=" ".env"; then
        sed -i.bak 's/ML_OPTIMIZATION=.*/ML_OPTIMIZATION=true/' ".env"
    else
        echo "ML_OPTIMIZATION=true" >> ".env"
    fi
fi

echo "✅ ML optimization enabled"
echo ""
echo "📝 The optimized ML client will:"
echo "   • Use 1-second timeouts for health checks"
echo "   • Use 3-second timeouts for ML requests"
echo "   • Cache ML service availability"
echo "   • Fallback immediately to local AI when ML is unavailable"
echo ""
echo "🎮 To apply changes, restart services with:"
echo "   npm run restart:all"
echo ""
echo "⚡ For even faster startup without ML services:"
echo "   npm run restart:all:fast"