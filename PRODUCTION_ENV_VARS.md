# Production Environment Variables

## Backend Environment Variables

To disable external microservices in production (Render deployment), add these environment variables:

### Option 1: Disable All External Services
```bash
DISABLE_EXTERNAL_SERVICES=true
```

### Option 2: Disable Individual Services
```bash
# Disable ML Service (port 8000)
ENABLE_ML_SERVICE=false

# Disable Continuous Learning Service (port 8002/8005)
ENABLE_CONTINUOUS_LEARNING=false

# Disable AI Coordination Service (port 8003)
ENABLE_AI_COORDINATION=false
```

### Additional Configuration
```bash
# Set environment to production
NODE_ENV=production

# Optional: Configure service URLs if services are deployed elsewhere
ML_SERVICE_URL=https://your-ml-service.com
CONTINUOUS_LEARNING_WS_URL=wss://your-cl-service.com
AI_COORDINATION_WS_URL=wss://your-coordination-service.com
ML_WEBSOCKET_URL=wss://your-ml-websocket.com
AI_COORDINATION_HUB_URL=wss://your-coordination-hub.com
```

## Frontend Environment Variables

The frontend already handles missing services gracefully in production mode. No additional configuration needed.

## Render Deployment Instructions

1. Go to your Render dashboard
2. Select your backend service
3. Go to Environment tab
4. Add the following environment variable:
   - Key: `DISABLE_EXTERNAL_SERVICES`
   - Value: `true`
5. Save and deploy

This will prevent the backend from attempting to connect to the microservices that aren't deployed, eliminating the connection errors in the logs.