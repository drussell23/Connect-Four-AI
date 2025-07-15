# 🔧 Environment Configuration Guide

## Enterprise AI Platform Environment Setup

Your Connect Four AI platform now requires comprehensive environment configuration to support all the new enterprise features and AI enhancements.

## 📋 **Current Environment Files**

### **Backend** (`backend/.env`)
```bash
# Current basic configuration:
ENABLE_ADVANCED_AI=false
AI_TIMEOUT_MS=3000
```

### **Frontend** (`frontend/.env.local`)
```bash
# Current basic configuration:
REACT_APP_API_URL=http://localhost:3000
```

## 🚀 **Enhanced Environment Configuration**

### **1. Backend Enhanced Configuration** (`backend/.env`)

```bash
# ===================================================================
# Connect Four AI - Enterprise Backend Configuration
# Version: 3.1.0 - AI-Enhanced Health Check Intelligence
# ===================================================================

# ==================== CORE APPLICATION ====================
NODE_ENV=development
PORT=3001
HOST=0.0.0.0

# ==================== AI & MACHINE LEARNING ====================
# Enhanced AI System
ENABLE_ADVANCED_AI=true
AI_TIMEOUT_MS=30000
AI_ENHANCED_HEALTH_CHECKS=true
AI_LEARNING_ENABLED=true

# AI Health Check Intelligence
AI_HEALTH_CHECK_DATA_PATH=./logs/health-check-intelligence.json
AI_LEARNING_COEFFICIENT=0.1
AI_PREDICTION_ENABLED=true
AI_ADAPTIVE_TIMEOUTS=true

# ML Service Configuration
ML_SERVICE_URL=http://localhost:8000
ML_SERVICE_TIMEOUT=60000
ML_MODEL_PATH=./models
ML_INFERENCE_TIMEOUT=5000

# ==================== ENTERPRISE SERVICES ====================
# Service Discovery
ENTERPRISE_LAUNCHER_ENABLED=true
ENTERPRISE_MODE=production
UNIFIED_LAUNCHER_PATH=./scripts/enterprise/unified-enterprise-launcher.js

# Enterprise Scripts Configuration
AI_STABILITY_MANAGER_ENABLED=true
INTELLIGENT_RESOURCE_MANAGER_ENABLED=true
PERFORMANCE_ANALYTICS_ENABLED=true
AI_ORCHESTRATION_DASHBOARD_ENABLED=true
ADVANCED_AI_DIAGNOSTICS_ENABLED=true
ENTERPRISE_MODEL_MANAGER_ENABLED=true

# ==================== PORT MANAGEMENT ====================
# Core Service Ports
BACKEND_PORT=3001
FRONTEND_PORT=3000
ML_SERVICE_PORT=8000

# Enterprise Service Ports
AI_STABILITY_PORT=3002
RESOURCE_MANAGER_PORT=3003
ANALYTICS_SUITE_PORT=3004
DEPLOYMENT_MANAGER_PORT=3005
MODEL_MANAGER_PORT=8001
ORCHESTRATION_DASHBOARD_PORT=3006

# Port Manager Configuration
PORT_MANAGER_V2_ENABLED=true
INTELLIGENT_PORT_CLEANUP=true
ENTERPRISE_PROCESS_PROTECTION=true

# ==================== HEALTH & MONITORING ====================
# Health Check Configuration
HEALTH_CHECK_INTERVAL=30000
HEALTH_CHECK_TIMEOUT=45000
HEALTH_CHECK_RETRIES=18
ADAPTIVE_HEALTH_CHECKS=true

# Performance Monitoring
PERFORMANCE_MONITORING_ENABLED=true
METRICS_COLLECTION_INTERVAL=60000
SYSTEM_RESOURCE_MONITORING=true
PREDICTIVE_ANALYTICS_ENABLED=true

# ==================== RESOURCE MANAGEMENT ====================
# CPU & Memory Optimization
INTELLIGENT_RESOURCE_MANAGEMENT=true
DYNAMIC_CPU_ALLOCATION=true
MEMORY_OPTIMIZATION_ENABLED=true
RESOURCE_PREDICTION_ENABLED=true

# System Thresholds
MAX_CPU_USAGE=80
MAX_MEMORY_USAGE=85
RESOURCE_WARNING_THRESHOLD=70

# ==================== LOGGING & ANALYTICS ====================
# Logging Configuration
LOG_LEVEL=info
LOG_PATH=./logs
ENTERPRISE_LOGGING_ENABLED=true
AI_HEALTH_LOG_RETENTION_DAYS=30

# Analytics & Reporting
PERFORMANCE_ANALYTICS_ENABLED=true
REAL_TIME_METRICS=true
DASHBOARD_UPDATES_INTERVAL=5000
ANALYTICS_DATA_RETENTION_DAYS=90

# ==================== SECURITY & SAFETY ====================
# AI Safety Systems
AI_SAFETY_MONITORING=true
CONSTITUTIONAL_AI_ENABLED=true
HUMAN_FEEDBACK_ENABLED=true
SAFETY_CONSTRAINTS_ENABLED=true

# Enterprise Security
ENTERPRISE_SECURITY_MODE=true
PROCESS_ISOLATION=true
SECURE_COMMUNICATION=true
AUDIT_LOGGING=true

# ==================== DEVELOPMENT & DEBUGGING ====================
# Development Mode Settings
DEBUG_MODE=false
VERBOSE_LOGGING=false
AI_PREDICTION_LOGGING=true
HEALTH_CHECK_DEBUG=false

# Feature Flags
FEATURE_AI_PREDICTIONS=true
FEATURE_ENTERPRISE_DASHBOARD=true
FEATURE_INTELLIGENT_RETRY=true
FEATURE_PREDICTIVE_SCALING=true

# ==================== DEPLOYMENT & SCALING ====================
# Deployment Configuration
DEPLOYMENT_MODE=intelligent
AUTO_SCALING_ENABLED=true
HEALTH_CHECK_GRACE_PERIOD=60000
STARTUP_TIMEOUT_MULTIPLIER=1.5

# Enterprise Deployment
CANARY_DEPLOYMENT_ENABLED=false
BLUE_GREEN_DEPLOYMENT=false
HOT_SWAPPING_ENABLED=true
ZERO_DOWNTIME_DEPLOYMENT=true

# ==================== EXTERNAL SERVICES ====================
# Integration URLs
FRONTEND_URL=http://localhost:3000
ML_SERVICE_URL=http://localhost:8000
ANALYTICS_WEBHOOK_URL=

# Service Dependencies
REQUIRE_ML_SERVICE=false
REQUIRE_ANALYTICS=false
GRACEFUL_DEGRADATION=true

# ==================== EMERGENCY & RECOVERY ====================
# Emergency Configuration
EMERGENCY_MODE_ENABLED=false
EMERGENCY_CONTACT_EMAIL=
AUTOMATIC_RECOVERY=true
CIRCUIT_BREAKER_ENABLED=true

# Backup & Recovery
AUTO_BACKUP_ENABLED=true
DISASTER_RECOVERY_MODE=false
FAILOVER_ENABLED=true
```

### **2. Frontend Enhanced Configuration** (`frontend/.env.local`)

```bash
# ===================================================================
# Connect Four AI - Enterprise Frontend Configuration
# Version: 3.1.0 - Enhanced UI with Enterprise Features
# ===================================================================

# ==================== API ENDPOINTS ====================
# Core API
REACT_APP_API_URL=http://localhost:3001

# Enterprise Services
REACT_APP_ML_SERVICE_URL=http://localhost:8000
REACT_APP_ENTERPRISE_DASHBOARD_URL=http://localhost:3006
REACT_APP_ANALYTICS_URL=http://localhost:3004
REACT_APP_RESOURCE_MANAGER_URL=http://localhost:3003
REACT_APP_AI_STABILITY_URL=http://localhost:3002

# ==================== FEATURE FLAGS ====================
# AI & ML Features
REACT_APP_ENABLE_AI_INSIGHTS=true
REACT_APP_ENABLE_PERFORMANCE_MONITORING=true
REACT_APP_ENABLE_ENTERPRISE_FEATURES=true
REACT_APP_ENABLE_REAL_TIME_UPDATES=true
REACT_APP_ENABLE_AI_HEALTH_DISPLAY=true

# Enterprise Dashboard Features
REACT_APP_SHOW_SYSTEM_METRICS=true
REACT_APP_SHOW_RESOURCE_USAGE=true
REACT_APP_SHOW_AI_PREDICTIONS=true
REACT_APP_ENABLE_ADMIN_CONTROLS=true

# ==================== UI CONFIGURATION ====================
# Theme & Appearance
REACT_APP_THEME=enterprise
REACT_APP_BRAND_NAME="Connect Four AI Enterprise"
REACT_APP_SHOW_BETA_FEATURES=true

# Performance Settings
REACT_APP_UPDATE_INTERVAL=5000
REACT_APP_METRICS_REFRESH_RATE=2000
REACT_APP_HEALTH_CHECK_INTERVAL=10000

# ==================== DEVELOPMENT ====================
# Debug & Development
REACT_APP_DEBUG_MODE=false
REACT_APP_SHOW_PERFORMANCE_METRICS=true
REACT_APP_ENABLE_CONSOLE_LOGS=false

# Environment Info
REACT_APP_BUILD_VERSION=3.1.0
REACT_APP_BUILD_DATE=2025-01-15
REACT_APP_ENTERPRISE_MODE=true
```

### **3. ML Service Configuration** (`ml_service/.env`)

```bash
# ===================================================================
# Connect Four AI - ML Service Configuration
# Version: 3.1.0 - Enterprise ML Pipeline
# ===================================================================

# ==================== ML SERVICE CORE ====================
ML_SERVICE_PORT=8000
ML_SERVICE_HOST=0.0.0.0
ML_WORKER_TIMEOUT=300

# ==================== MODEL CONFIGURATION ====================
# Model Paths
MODEL_STORAGE_PATH=./models
CHECKPOINT_PATH=./checkpoints
MODEL_CACHE_PATH=./cache

# Model Loading
AUTO_LOAD_MODELS=true
MODEL_WARMUP=true
MODEL_VALIDATION=true

# ==================== ENTERPRISE INTEGRATION ====================
# Enterprise Launcher Integration
ENTERPRISE_LAUNCHER_INTEGRATION=true
REGISTER_WITH_RESOURCE_MANAGER=true
ENABLE_HEALTH_REPORTING=true

# Performance Monitoring
ML_METRICS_ENABLED=true
INFERENCE_LOGGING=true
PERFORMANCE_TRACKING=true

# ==================== TRAINING CONFIGURATION ====================
# Training Settings
ENABLE_TRAINING_API=true
MAX_CONCURRENT_TRAINING=2
TRAINING_CHECKPOINT_INTERVAL=1000

# Self-Play Configuration
SELF_PLAY_ENABLED=true
SELF_PLAY_GAMES_PER_ITERATION=100
EVALUATION_GAMES=50

# ==================== RESOURCE MANAGEMENT ====================
# CPU & GPU
USE_GPU=true
GPU_MEMORY_LIMIT=0.8
CPU_WORKERS=4

# Memory Management
MODEL_MEMORY_LIMIT=2048
CACHE_SIZE_LIMIT=1024
MEMORY_CLEANUP_INTERVAL=3600
```

## 🎯 **Environment Update Instructions**

### **Step 1: Update Backend Environment**
```bash
# Copy the enhanced backend configuration above to:
backend/.env
```

### **Step 2: Update Frontend Environment**
```bash
# Copy the enhanced frontend configuration above to:
frontend/.env.local
```

### **Step 3: Create ML Service Environment**
```bash
# Create new file with ML configuration:
ml_service/.env
```

### **Step 4: Verify Configuration**
```bash
# Test the enhanced environment
npm run system:health
npm run ports:status
npm run start:turbo:build:enhanced -- --force
```

## 🔧 **Key Environment Changes**

### **🧠 AI & ML Enhancements**
- **AI Health Check Intelligence**: Enables adaptive timeout prediction
- **ML Service Integration**: Full ML pipeline configuration
- **Resource Optimization**: CPU/GPU allocation and management
- **Performance Analytics**: Real-time monitoring and metrics

### **🏢 Enterprise Features**
- **Enterprise Launcher**: Unified system management
- **Multi-Service Coordination**: All enterprise scripts configured
- **Advanced Monitoring**: Health checks, diagnostics, analytics
- **Security & Safety**: Enterprise-grade protections

### **⚙️ System Management**
- **Port Management v2**: AI-enhanced port conflict resolution
- **Resource Management**: Intelligent CPU/memory optimization
- **Emergency Recovery**: Automatic failure detection and recovery
- **Deployment Features**: Hot-swapping, canary deployments

## 📊 **Configuration Validation**

### **Environment Health Check**
```bash
# Verify all environment variables are loaded
npm run system:health

# Check enterprise services configuration
npm run enterprise:diagnostics

# Validate AI health check settings
npm run system:ai
```

### **Feature Verification**
```bash
# Test AI-enhanced features
npm run start:turbo:build:enhanced -- --force

# Verify enterprise dashboard
npm run enterprise:dashboard

# Check ML pipeline integration
npm run ml:status
```

## 🚨 **Important Notes**

### **Security Considerations**
- **Never commit actual .env files** to version control
- **Keep sensitive values secure** (API keys, passwords, etc.)
- **Use different configurations** for development/staging/production
- **Rotate secrets regularly** for production deployments

### **Development vs Production**
- **Development**: Enable debug modes, verbose logging
- **Production**: Disable debug, enable security features, optimize performance
- **Testing**: Enable comprehensive logging, disable external services

## 🎯 **Next Steps**

1. **Copy configurations** to respective .env files
2. **Customize values** for your deployment environment
3. **Test the enhanced system** with new configurations
4. **Monitor performance** with the new analytics features
5. **Adjust settings** based on your system requirements

---

**This configuration enables all enterprise AI features and ensures optimal performance for your Connect Four AI platform!** 🚀

---

**Version**: 3.1.0 - Enterprise Environment Configuration  
**Author**: Derek J. Russell  
**Date**: January 2025 