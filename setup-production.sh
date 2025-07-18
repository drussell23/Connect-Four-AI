#!/bin/bash

# Connect Four AI - Production Setup Script
echo "🌐 Setting up Connect Four AI for Production Deployment"
echo "======================================================"

# Create production environment files
echo "📝 Creating production configuration files..."

# Frontend production config
cat > frontend/env.production << EOF
# Production Environment Variables
REACT_APP_API_URL=https://connect-four-ai-roge.onrender.com
REACT_APP_WS_URL=wss://connect-four-ai-roge.onrender.com
REACT_APP_ML_SERVICE_URL=https://connect-four-ai-roge.onrender.com
REACT_APP_ENVIRONMENT=production
REACT_APP_VERSION=1.0.0
REACT_APP_ANALYTICS_ENABLED=true
EOF

# Backend production config
cat > backend/.env.production << EOF
# Production Environment Variables
NODE_ENV=production
PORT=3000
CORS_ORIGIN=https://your-domain.vercel.app
ML_SERVICE_URL=https://your-ml-service.railway.app
DATABASE_URL=your-database-url
EOF

# ML Service production config
cat > ml_service/requirements.production.txt << EOF
# Production Requirements
fastapi==0.104.1
uvicorn==0.24.0
numpy==1.24.3
torch==2.1.0
transformers==4.35.0
python-dotenv==1.0.0
requests==2.31.0
gunicorn==21.2.0
EOF

echo "✅ Production configuration files created!"
echo ""
echo "🚀 Next Steps:"
echo "1. Install Railway CLI: npm install -g @railway/cli"
echo "2. Install Vercel CLI: npm install -g vercel"
echo "3. Login to Railway: railway login"
echo "4. Login to Vercel: vercel login"
echo "5. Update environment variables with your actual URLs"
echo "6. Run: ./scripts/deploy/deploy-production.sh deploy"
echo ""
echo "📚 For detailed instructions, see: deployment-guide.md" 