# Connect Four AI - Offline Deployment Guide

This guide provides step-by-step instructions for deploying the offline-capable Connect Four AI application.

## Prerequisites

- Node.js 16+ and npm
- HTTPS certificate (for production)
- Modern web browser with Service Worker support

## Backend Deployment

### 1. Install Dependencies

```bash
cd backend
npm install
```

### 2. Build the Backend

```bash
npm run build
```

### 3. Environment Configuration

Create a `.env` file:

```env
# Server Configuration
PORT=3000
NODE_ENV=production

# Database
DATABASE_URL=postgresql://user:password@localhost:5432/connect4

# AI Configuration
AI_MAX_DIFFICULTY=30
AI_DEFAULT_DIFFICULTY=20

# Python Trainer (optional)
PYTHON_TRAINER_URL=http://localhost:8002

# CORS
CORS_ORIGIN=https://yourdomain.com
```

### 4. Start the Backend

```bash
npm run start:prod
```

## Frontend Deployment

### 1. Install Dependencies

```bash
cd frontend
npm install
```

### 2. Configure Environment

Create `.env.production`:

```env
REACT_APP_API_URL=https://api.yourdomain.com
REACT_APP_WEBSOCKET_URL=wss://api.yourdomain.com
REACT_APP_ENABLE_OFFLINE=true
```

### 3. Build the Frontend

```bash
npm run build
```

### 4. Copy Service Worker Files

```bash
# Ensure service worker is in build directory
cp public/sw.js build/
cp public/ai-worker.js build/
cp -r public/wasm build/
```

### 5. Deploy Static Files

Deploy the `build` directory to your web server or CDN.

## Server Configuration

### Nginx Configuration

```nginx
server {
    listen 443 ssl http2;
    server_name yourdomain.com;
    
    ssl_certificate /path/to/cert.pem;
    ssl_certificate_key /path/to/key.pem;
    
    root /var/www/connect4/build;
    index index.html;
    
    # Service Worker - no cache
    location = /sw.js {
        add_header Cache-Control "no-cache, no-store, must-revalidate";
        add_header Service-Worker-Allowed "/";
    }
    
    # AI Worker
    location = /ai-worker.js {
        add_header Cache-Control "no-cache, no-store, must-revalidate";
    }
    
    # WASM files
    location ~* \.wasm$ {
        add_header Content-Type "application/wasm";
        add_header Cache-Control "public, max-age=31536000";
    }
    
    # Static assets with long cache
    location ~* \.(js|css|png|jpg|jpeg|gif|ico|woff|woff2)$ {
        expires 1y;
        add_header Cache-Control "public, immutable";
    }
    
    # API proxy
    location /api {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }
    
    # WebSocket proxy
    location /socket.io {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }
    
    # React app - serve index.html for all routes
    location / {
        try_files $uri /index.html;
        add_header Cache-Control "no-cache, no-store, must-revalidate";
    }
}

# Redirect HTTP to HTTPS
server {
    listen 80;
    server_name yourdomain.com;
    return 301 https://$server_name$request_uri;
}
```

## Post-Deployment Verification

### 1. Test Service Worker Registration

Open browser console and run:
```javascript
navigator.serviceWorker.getRegistrations()
```

Should show registered service worker.

### 2. Test Offline Mode

1. Load the application
2. Open DevTools → Network → Offline
3. Try playing a game
4. Verify AI moves work offline

### 3. Test PWA Installation

1. Visit site in Chrome/Edge
2. Look for install icon in address bar
3. Install and launch as app
4. Test offline functionality

### 4. Verify Background Sync

1. Make moves while offline
2. Go back online
3. Check network tab for sync requests
4. Verify moves synced to server

## Performance Optimization

### 1. Enable HTTP/2

Already included in nginx config above.

### 2. Enable Compression

```nginx
# In nginx http block
gzip on;
gzip_types text/plain text/css text/javascript application/javascript application/json application/wasm;
gzip_min_length 1000;
```

### 3. CDN Configuration

If using a CDN:

1. Configure cache headers properly
2. Exclude `/sw.js` from CDN caching
3. Set proper CORS headers for WASM files

### 4. Database Indexes

Create indexes for better performance:

```sql
CREATE INDEX idx_games_created_at ON games(created_at);
CREATE INDEX idx_moves_game_id ON moves(game_id);
CREATE INDEX idx_sync_jobs_status ON sync_jobs(status);
```

## Monitoring

### 1. Application Monitoring

Track key metrics:
- Service worker registration success rate
- Offline game completion rate
- Sync success/failure rate
- AI computation time (offline vs online)

### 2. Error Tracking

Monitor for:
- Service worker errors
- IndexedDB quota exceeded
- WebAssembly load failures
- Sync conflicts

### 3. Performance Monitoring

```javascript
// Add to your app
if ('connection' in navigator) {
  analytics.track('connection_quality', {
    type: navigator.connection.effectiveType,
    downlink: navigator.connection.downlink,
    rtt: navigator.connection.rtt
  });
}
```

## Troubleshooting

### Service Worker Not Updating

Clear service worker cache:
```bash
# Add version to sw.js
const CACHE_NAME = 'connect4-v2'; // Increment version
```

### WASM Loading Issues

Check Content-Type header:
```bash
curl -I https://yourdomain.com/wasm/connect4-core.wasm
```

Should show: `Content-Type: application/wasm`

### Offline Mode Not Working

1. Check Service Worker scope
2. Verify HTTPS is enabled
3. Check browser compatibility
4. Clear browser cache and retry

## Security Considerations

### 1. Content Security Policy

Add CSP headers:
```nginx
add_header Content-Security-Policy "
    default-src 'self';
    script-src 'self' 'wasm-unsafe-eval';
    connect-src 'self' wss://api.yourdomain.com;
    worker-src 'self';
" always;
```

### 2. CORS Configuration

Configure CORS properly in backend:
```typescript
app.enableCors({
  origin: process.env.CORS_ORIGIN,
  credentials: true
});
```

### 3. Rate Limiting

Implement rate limiting for API endpoints:
```typescript
app.use(rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100 // limit each IP to 100 requests
}));
```

## Rollback Plan

If issues arise:

1. **Quick Rollback**: Update nginx to serve previous build
2. **Service Worker Reset**: Force update with new cache name
3. **Database Rollback**: Keep backup before deployment

```bash
# Backup before deployment
pg_dump connect4 > backup-$(date +%Y%m%d).sql
```

## Success Metrics

After deployment, monitor:

- ✅ Service Worker registration rate > 95%
- ✅ Offline game completion rate > 90%
- ✅ Sync success rate > 98%
- ✅ Page load time < 3s
- ✅ Time to interactive < 5s
- ✅ AI move computation < 1s offline

## Conclusion

Following this guide ensures your Connect Four AI application is properly deployed with full offline capabilities. Users can enjoy uninterrupted gameplay regardless of their connection status.