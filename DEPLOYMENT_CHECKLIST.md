# Deployment Checklist for Full Microservices

## Pre-Deployment Steps Completed ✅

1. **Updated render.yaml** - Added all 5 services:
   - Backend API (existing)
   - ML Service (connect-four-ml)
   - Continuous Learning (connect-four-learning)
   - AI Coordination (connect-four-coordination)
   - Python Trainer (connect-four-trainer)

2. **Updated requirements.production.txt** - Optimized for Render deployment with CPU-only PyTorch

3. **Configured environment variables** in render.yaml for service communication

4. **Verified all service files exist**

## Deployment Steps

### Step 1: Commit and Push Changes
```bash
git add render.yaml ml_service/requirements.production.txt
git commit -m "Add microservices configuration for full AI deployment"
git push origin main
```

### Step 2: Deploy on Render

1. Go to [Render Dashboard](https://dashboard.render.com)
2. Click "New" → "Blueprint"
3. Connect your GitHub repository
4. Select the branch (main)
5. Render will detect the render.yaml and show all 5 services
6. Click "Apply" to deploy all services

### Step 3: Update Frontend Environment Variables on Vercel

Add these environment variables to your Vercel project:

```
REACT_APP_ML_SERVICE_URL=https://connect-four-ml.onrender.com
REACT_APP_ML_INFERENCE_URL=https://connect-four-ml.onrender.com/inference
REACT_APP_CL_SERVICE_URL=https://connect-four-learning.onrender.com
REACT_APP_AI_COORD_URL=https://connect-four-coordination.onrender.com
REACT_APP_TRAINER_URL=https://connect-four-trainer.onrender.com
```

### Step 4: Monitor Deployment

1. Watch the Render dashboard for deployment progress
2. Each service will take 5-10 minutes to build and deploy
3. Services will show as "Live" when ready

### Step 5: Verify Services

Once deployed, test each service:

```bash
# Test ML Service
curl https://connect-four-ml.onrender.com/health

# Test Continuous Learning
curl https://connect-four-learning.onrender.com/health

# Test AI Coordination
curl https://connect-four-coordination.onrender.com/health

# Test Python Trainer
curl https://connect-four-trainer.onrender.com/health
```

## Important Notes

### Free Tier Limitations
- Services on Render free tier spin down after 15 minutes of inactivity
- First request after spin-down takes 30-60 seconds
- Consider upgrading to paid tier for production use

### Service Dependencies
- Services will attempt to connect to each other
- Initial connection errors are normal until all services are deployed
- The backend has fallback AI that works without Python services

### Monitoring
- Check Render logs for each service
- Use the frontend Integration Dashboard (Ctrl+Shift+D)
- Monitor the console for connection status

## Troubleshooting

### If services fail to deploy:
1. Check Render build logs for errors
2. Verify Python version compatibility (3.9+ required)
3. Check if memory limits are exceeded

### If services can't connect:
1. Verify CORS settings in each service
2. Check WebSocket upgrade headers
3. Ensure all services are using HTTPS/WSS in production

### To reduce costs:
- You can disable some services by setting DISABLE_EXTERNAL_SERVICES=true on the backend
- Or deploy only the ML Service initially and add others later

## Post-Deployment

Once all services are running:
1. The frontend will show all services as "Connected" ✅
2. Advanced AI features will be available
3. Continuous learning will track game outcomes
4. Model training can be triggered through the API

## Rollback Plan

If issues occur:
1. Set DISABLE_EXTERNAL_SERVICES=true on the backend
2. The game will continue working with TypeScript AI
3. Debug and redeploy services one at a time