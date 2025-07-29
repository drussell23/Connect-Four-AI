# Microservices Deployment Guide for Connect Four AI

## Current Architecture

Your application has a sophisticated microservices architecture with the following services:

### Services and Their Purposes

1. **Backend API** (Port 3000) - ✅ Already deployed on Render
   - Main game logic
   - WebSocket connections
   - Database operations
   - AI orchestration

2. **ML Service** (Port 8000) - ❌ Not deployed
   - Main ML inference service
   - Model management
   - Prediction API
   - Located in: `/ml_service/`

3. **ML Inference** (Port 8001) - ❌ Not deployed
   - Dedicated inference endpoint
   - Optimized for fast predictions

4. **Continuous Learning** (Port 8002/8005) - ❌ Not deployed
   - Real-time learning from games
   - Model improvement pipeline
   - Located in: `/ml_service/continuous_learning.py`

5. **AI Coordination** (Port 8003) - ❌ Not deployed
   - Multi-AI coordination hub
   - Strategy selection
   - Located in: `/ml_service/ai_coordination_hub.py`

6. **Python Trainer** (Port 8004) - ❌ Not deployed
   - Model training service
   - Located in: `/backend/src/ai/hybrid-architecture/python-trainer/`

## Deployment Options

### Option 1: Deploy All Services on Render (Recommended)

Update your `render.yaml` to include all services:

```yaml
services:
  # Backend API (already exists)
  - type: web
    name: connect-four-backend
    runtime: node
    rootDir: backend
    buildCommand: npm install --legacy-peer-deps && npm run build
    startCommand: npm start
    envVars:
      - key: NODE_ENV
        value: production
      - key: PORT
        value: 3000
      - key: CORS_ENABLED
        value: "true"
      - key: CORS_ORIGINS
        value: https://connect-four-ai-derek.vercel.app
      - key: FRONTEND_URL
        value: https://connect-four-ai-derek.vercel.app
      # Update these to point to the deployed services
      - key: ML_SERVICE_URL
        value: https://connect-four-ml.onrender.com
      - key: CONTINUOUS_LEARNING_WS_URL
        value: wss://connect-four-learning.onrender.com
      - key: AI_COORDINATION_WS_URL
        value: wss://connect-four-coordination.onrender.com

  # ML Service
  - type: web
    name: connect-four-ml
    runtime: python
    rootDir: ml_service
    buildCommand: pip install -r requirements.production.txt
    startCommand: python ml_service.py
    envVars:
      - key: PORT
        value: 8000
      - key: ENVIRONMENT
        value: production
      - key: BACKEND_URL
        value: https://connect-four-ai-roge.onrender.com
      - key: CORS_ORIGINS
        value: https://connect-four-ai-derek.vercel.app,https://connect-four-ai-roge.onrender.com

  # Continuous Learning Service
  - type: web
    name: connect-four-learning
    runtime: python
    rootDir: ml_service
    buildCommand: pip install -r requirements.production.txt
    startCommand: python continuous_learning.py
    envVars:
      - key: PORT
        value: 8002
      - key: ENVIRONMENT
        value: production
      - key: ML_SERVICE_URL
        value: https://connect-four-ml.onrender.com
      - key: BACKEND_URL
        value: https://connect-four-ai-roge.onrender.com

  # AI Coordination Service
  - type: web
    name: connect-four-coordination
    runtime: python
    rootDir: ml_service
    buildCommand: pip install -r requirements.production.txt
    startCommand: python ai_coordination_hub.py
    envVars:
      - key: PORT
        value: 8003
      - key: ENVIRONMENT
        value: production
      - key: BACKEND_URL
        value: https://connect-four-ai-roge.onrender.com
```

### Option 2: Simplify Architecture (Single ML Service)

If deploying multiple services is too complex/expensive, you can create a unified ML service:

1. Create a new file `ml_service/unified_service.py` that combines all services
2. Update the backend to use a single ML service endpoint
3. Deploy only one additional service on Render

### Option 3: Use Backend-Only AI (Temporary Solution)

The backend already has TypeScript-based AI implementations that can work without the Python services:

1. The game will automatically fall back to TypeScript AI when ML services are unavailable
2. You'll lose advanced features like continuous learning and model training
3. But the game will be fully functional

## Step-by-Step Deployment Instructions

### For Option 1 (Full Microservices):

1. **Update Frontend Environment Variables**
   Add to your Vercel environment variables:
   ```
   REACT_APP_ML_SERVICE_URL=https://connect-four-ml.onrender.com
   REACT_APP_CL_SERVICE_URL=https://connect-four-learning.onrender.com
   REACT_APP_AI_COORD_URL=https://connect-four-coordination.onrender.com
   ```

2. **Update render.yaml** with the configuration above

3. **Create requirements.production.txt** in ml_service/:
   ```txt
   fastapi==0.104.1
   uvicorn[standard]==0.24.0
   torch==2.1.0
   numpy==1.24.3
   pydantic==2.4.2
   python-multipart==0.0.6
   websockets==12.0
   aiofiles==23.2.1
   ```

4. **Deploy to Render**
   ```bash
   git add .
   git commit -m "Add microservices deployment configuration"
   git push origin main
   ```

5. **In Render Dashboard**
   - Go to Blueprints
   - Create new Blueprint
   - Connect your repo
   - Select render.yaml
   - Deploy

### For Option 3 (Immediate Fix):

No changes needed! The backend will automatically use TypeScript AI when ML services are unavailable. The errors in the console are just connection attempts that can be ignored.

## Cost Considerations

- Each Render service on free tier sleeps after 15 minutes of inactivity
- You might need to upgrade to paid tier for always-on services
- Consider using Render's autoscaling for ML services

## Alternative Platforms

If Render becomes too expensive with multiple services:

1. **Railway** - Better for microservices, usage-based pricing
2. **Fly.io** - Good for distributed services
3. **Google Cloud Run** - Pay per request, good for ML workloads
4. **AWS Lambda + API Gateway** - Serverless option for ML inference

## Monitoring

Once deployed, monitor your services:
- Check Render dashboard for service health
- Use the Integration Dashboard in the frontend (Ctrl+Shift+D)
- Monitor logs for any errors

Would you like me to help you implement any of these options?