# 🌐 Connect Four AI - Website Deployment Guide

## **Overview**
This guide will help you deploy your Connect Four AI game to a public website while maintaining full control over development and updates.

## **🏗️ Architecture**
- **Frontend**: React app hosted on Vercel (static hosting)
- **Backend**: NestJS API hosted on Railway (Node.js hosting)
- **ML Service**: Python service hosted on Railway (separate service)
- **Database**: PostgreSQL on Railway (if needed)
- **Domain**: Custom domain for professional appearance

## **🚀 Step 1: Prepare Your Code**

### **Frontend Preparation**
1. **Environment Variables**: Update API endpoints for production
2. **Build Optimization**: Ensure production build works
3. **CORS Configuration**: Allow production backend URL

### **Backend Preparation**
1. **Environment Variables**: Configure production settings
2. **Database**: Set up production database (if needed)
3. **Security**: Enable rate limiting and CORS

### **ML Service Preparation**
1. **Requirements**: Ensure all dependencies are listed
2. **Environment**: Configure production ML service URL
3. **Model Storage**: Set up cloud model storage

## **📦 Step 2: Deploy Backend (Railway)**

### **Option A: Railway CLI**
```bash
# Install Railway CLI
npm install -g @railway/cli

# Login to Railway
railway login

# Initialize project
cd backend
railway init

# Deploy
railway up
```

### **Option B: Railway Dashboard**
1. Go to [railway.app](https://railway.app)
2. Create new project
3. Connect your GitHub repository
4. Select backend folder
5. Configure environment variables
6. Deploy

### **Environment Variables for Backend**
```
NODE_ENV=production
PORT=3000
CORS_ORIGIN=https://your-domain.vercel.app
ML_SERVICE_URL=https://your-ml-service.railway.app
DATABASE_URL=your-database-url
```

## **🌐 Step 3: Deploy Frontend (Vercel)**

### **Option A: Vercel CLI**
```bash
# Install Vercel CLI
npm install -g vercel

# Login to Vercel
vercel login

# Deploy
cd frontend
vercel --prod
```

### **Option B: Vercel Dashboard**
1. Go to [vercel.com](https://vercel.com)
2. Create new project
3. Import your GitHub repository
4. Configure build settings:
   - Framework Preset: Create React App
   - Build Command: `npm run build`
   - Output Directory: `build`
5. Set environment variables
6. Deploy

### **Environment Variables for Frontend**
```
    # Frontend Environment Variables
    REACT_APP_API_URL=https://connect-four-ai-roge.onrender.com
    REACT_APP_WS_URL=wss://connect-four-ai-roge.onrender.com
    REACT_APP_ML_SERVICE_URL=https://connect-four-ai-roge.onrender.com
    REACT_APP_ENVIRONMENT=production
```

## **🤖 Step 4: Deploy ML Service (Railway)**

1. Create separate Railway project for ML service
2. Configure Python environment
3. Set up model storage
4. Deploy with environment variables

## **🔗 Step 5: Connect Services**

### **Update Frontend API Calls**
Replace localhost URLs with production URLs:
```typescript
// Before
const API_URL = 'http://localhost:3000';

// After
const API_URL = process.env.REACT_APP_BACKEND_URL || 'https://your-backend.railway.app';
```

### **Update Backend CORS**
```typescript
// In main.ts
app.enableCors({
  origin: process.env.CORS_ORIGIN || 'https://your-domain.vercel.app',
  credentials: true,
});
```

## **🌍 Step 6: Custom Domain (Optional)**

### **Vercel Domain Setup**
1. Go to Vercel project settings
2. Add custom domain
3. Configure DNS records
4. Enable HTTPS

### **Railway Domain Setup**
1. Go to Railway project settings
2. Add custom domain
3. Configure DNS records

## **🔄 Step 7: Continuous Deployment**

### **Automatic Deployments**
Both Vercel and Railway support automatic deployments:
- **GitHub Integration**: Push to main branch triggers deployment
- **Preview Deployments**: Pull requests create preview environments
- **Rollback**: Easy rollback to previous versions

### **Environment Management**
- **Development**: Local development with localhost
- **Staging**: Preview deployments for testing
- **Production**: Live website with custom domain

## **🔧 Step 8: Development Workflow**

### **Local Development**
```bash
# Start local development
npm run start:development

# Test production build locally
npm run build
npm run start:production
```

### **Deploy Updates**
```bash
# Deploy backend changes
cd backend
railway up

# Deploy frontend changes
cd frontend
vercel --prod
```

### **Environment-Specific Configurations**
- **Development**: Localhost URLs, debug logging
- **Production**: Cloud URLs, optimized performance
- **Staging**: Preview URLs, testing features

## **📊 Step 9: Monitoring & Analytics**

### **Vercel Analytics**
- Built-in performance monitoring
- Real-time user analytics
- Error tracking

### **Railway Monitoring**
- Application logs
- Performance metrics
- Resource usage

### **Custom Analytics**
- Google Analytics integration
- Custom event tracking
- User behavior analysis

## **🔒 Step 10: Security & Performance**

### **Security Measures**
- HTTPS everywhere
- CORS configuration
- Rate limiting
- Input validation
- Environment variable protection

### **Performance Optimization**
- CDN for static assets
- Image optimization
- Code splitting
- Lazy loading
- Caching strategies

## **🚀 Benefits of This Setup**

### **✅ Full Control**
- Modify any part of the code
- Deploy updates instantly
- Rollback if needed
- A/B test features

### **✅ Scalability**
- Automatic scaling
- Global CDN
- Load balancing
- Database scaling

### **✅ Professional**
- Custom domain
- HTTPS security
- Professional appearance
- Reliable hosting

### **✅ Cost-Effective**
- Free tier available
- Pay-as-you-grow
- No server management
- Automatic backups

## **🎯 Next Steps**

1. **Choose hosting providers** (Vercel + Railway recommended)
2. **Set up accounts** and connect GitHub
3. **Deploy backend** first
4. **Deploy frontend** with backend URL
5. **Test thoroughly** in production
6. **Add custom domain** for professional look
7. **Set up monitoring** and analytics

## **💡 Tips for Success**

- **Start small**: Deploy basic version first
- **Test locally**: Ensure everything works before deploying
- **Use environment variables**: Keep secrets secure
- **Monitor performance**: Watch for issues
- **Backup regularly**: Protect your data
- **Document changes**: Keep track of updates

---

**Ready to go live?** Follow this guide step by step, and you'll have a professional Connect Four AI website that you can continue developing and updating! 🚀 