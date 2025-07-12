# Connect Four - Advanced AI Training Platform

![License: MIT](https://img.shields.io/badge/license-MIT-green) ![Node.js](https://img.shields.io/badge/node.js->=16-blue) ![Python](https://img.shields.io/badge/python->=3.8-yellow) ![AI: Advanced](https://img.shields.io/badge/AI-Advanced%20ML%20Pipeline-purple) ![Research](https://img.shields.io/badge/Research-Grade%20AI-orange) ![Performance](https://img.shields.io/badge/Performance-4x%20Faster-brightgreen)

A sophisticated, web-based Connect Four game featuring a **revolutionary AI training system** that creates progressively stronger opponents through advanced machine learning, parallel processing, and continuous learning capabilities. This platform serves as both an engaging game and a comprehensive research environment for developing superhuman AI systems.

---

## Table of Contents

### **Core Documentation**
* [Project Overview](#project-overview)
* [🚀 Enhanced Features](#-enhanced-features)
* [🧠 Advanced AI System](#-advanced-ai-system)
* [Architecture & Tech Stack](#architecture--tech-stack)
* [Prerequisites](#prerequisites)
* [🎯 Quick Start](#-quick-start)

### **Training & AI Development**
* [🏋️ Enhanced ML Training Pipeline](#️-enhanced-ml-training-pipeline)
* [🎮 AI Training Modes](#-ai-training-modes)
* [🧪 Advanced Configuration](#-advanced-configuration)
* [⚙️ Performance Tuning](#️-performance-tuning)
* [📊 Monitoring & Analytics](#-monitoring--analytics)

### **Technical Deep Dive**
* [🏗️ System Architecture Details](#️-system-architecture-details)
* [🔬 AI Algorithm Implementation](#-ai-algorithm-implementation)
* [📡 API Reference](#-api-reference)
* [🗄️ Database & Model Management](#️-database--model-management)

### **Research & Development**
* [🔬 Research Applications](#-research-applications)
* [📈 Benchmarking & Evaluation](#-benchmarking--evaluation)
* [🧬 Experimental Features](#-experimental-features)

### **Development & Deployment**
* [Development](#development)
* [Testing](#testing)
* [Deployment](#deployment)
* [🔧 Troubleshooting](#-troubleshooting)
* [Contributing](#contributing)
* [License](#license)

---

## Project Overview

Connect Four has evolved into an **advanced AI research platform** that pushes the boundaries of game-playing AI development. The system integrates state-of-the-art machine learning techniques including:

- **Multi-Algorithm AI Architecture**: Seamlessly combines traditional algorithms (Minimax, MCTS) with modern deep learning approaches
- **Adaptive Learning Systems**: Real-time player profiling and strategy adaptation using advanced pattern recognition
- **Parallel Training Infrastructure**: Distributed computing architecture for efficient model training and evaluation
- **Continuous Integration Pipeline**: Automated model testing, validation, and deployment systems
- **Research-Grade Analytics**: Comprehensive data collection and analysis tools for AI behavior studies

The platform demonstrates how traditional board games can serve as testbeds for developing general-purpose AI systems, with applications extending to strategic decision-making, adversarial learning, and human-AI interaction research.

## 🚀 Enhanced Features

### **Game Experience & User Interface**
* **🎨 Advanced Animation Engine**: 
  - Physics-based disc dropping with realistic gravity simulation
  - Smooth CSS3 transitions with hardware acceleration
  - Dynamic visual feedback for AI thinking processes
  - Responsive design with adaptive layouts for all screen sizes
* **🔊 Immersive Audio System**: 
  - Spatial audio positioning for disc drops
  - Contextual sound effects based on game state
  - Dynamic music adaptation to game tension
  - Accessibility support with audio cues for screen readers
* **📱 Cross-Platform Compatibility**: 
  - Progressive Web App (PWA) capabilities
  - Touch gestures and haptic feedback on mobile devices
  - Keyboard navigation for accessibility
  - Offline play capabilities with service workers

### **AI Innovation & Intelligence**
* **🧠 Multi-Personality AI System**: 
  - **Genesis**: Learning-focused AI that adapts gradually to player patterns
  - **Prometheus**: Aggressive AI with advanced tactical planning
  - **Athena**: Defensive specialist with perfect threat recognition
  - **Hermes**: Speed-oriented AI optimized for rapid decision-making
* **📊 Dynamic Difficulty Scaling**: 
  - Real-time performance analysis and adjustment
  - Personalized challenge curves based on player skill progression
  - Adaptive hint systems for learning enhancement
  - Handicap systems for balanced gameplay
* **🔄 Advanced Learning Mechanisms**: 
  - **Meta-Learning**: AI learns how to learn faster from new opponents
  - **Transfer Learning**: Knowledge sharing between different AI agents
  - **Curriculum Learning**: Progressive training from simple to complex scenarios
  - **Few-Shot Learning**: Rapid adaptation with minimal training data

### **Technical Excellence & Performance**
* **⚡ High-Performance Computing**: 
  - WebAssembly acceleration for critical algorithms
  - Multi-threaded processing with Web Workers
  - GPU acceleration via WebGL for neural network inference
  - Optimized memory management with object pooling
* **📈 Real-Time Analytics**: 
  - Live performance metrics and resource monitoring
  - Predictive analytics for system optimization
  - Anomaly detection for system health monitoring
  - Custom metric collection and visualization

## 🧠 Advanced AI System

### **Detailed AI Progression Framework**

```
🎯 Levels 1-3: Enhanced Minimax Engine
├── 🔍 Neural-guided heuristics with learned position evaluation
├── 📊 Adaptive depth control based on time constraints and position complexity
├── 🧩 Pattern recognition for common tactical motifs
├── ⚡ Alpha-beta pruning with history heuristics
├── 🎲 Quiescence search for tactical stability
└── 📝 Transposition tables for move ordering optimization

🧠 Levels 4-6: Advanced Monte Carlo Tree Search
├── 🎯 ML-guided simulations with neural network rollouts
├── 🔄 Progressive widening for exploration-exploitation balance
├── 📈 Upper Confidence bounds applied to Trees (UCT)
├── 🎲 Progressive bias and RAVE (Rapid Action Value Estimation)
├── 🧭 Strategic planning with multi-step lookahead
└── 🎮 Virtual loss for parallel MCTS implementation

🚀 Levels 7-8: Hybrid Intelligence Architecture
├── 🤖 Neural network ensemble with voting mechanisms
├── 👥 Population-based learning with genetic algorithms
├── 🎯 Meta-strategy adaptation using reinforcement learning
├── 🧬 Experience replay with prioritized sampling
├── 📊 Multi-objective optimization for balanced play
└── 🔄 Online learning with catastrophic forgetting prevention

🔥 Level 9+: Superhuman AI Capabilities
├── 👁️ Perfect tactical vision with exhaustive search
├── 🧠 Psychological profiling and opponent modeling
├── 🎯 Unbeatable endgame play with tablebase integration
├── ⚡ Real-time counter-strategies and adaptation
├── 🔮 Predictive modeling for long-term strategic planning
└── 🎪 Advanced opening book with theoretical knowledge
```

### **Neural Network Architecture Specifications**

#### **Convolutional Neural Networks (CNN)**
```python
# Architecture: Connect4CNN
Input Layer: [batch_size, 6, 7, 3]  # Height x Width x Channels
├── Conv2D: 32 filters, 3x3 kernel, ReLU activation
├── BatchNorm2D + Dropout(0.1)
├── Conv2D: 64 filters, 3x3 kernel, ReLU activation
├── BatchNorm2D + Dropout(0.1)
├── Conv2D: 128 filters, 3x3 kernel, ReLU activation
├── GlobalAveragePooling2D
├── Dense: 256 units, ReLU activation
├── Dropout(0.2)
└── Output: [Policy: 7 units, Value: 1 unit]

# Optimization: Adam with learning rate scheduling
# Loss: Combined policy (cross-entropy) + value (MSE) + L2 regularization
```

#### **Residual Networks (ResNet)**
```python
# Architecture: Connect4ResNet
Input Layer: [batch_size, 6, 7, 3]
├── Initial Conv2D: 64 filters, 3x3 kernel
├── Residual Block x8:
│   ├── Conv2D: 64 filters, 3x3 kernel
│   ├── BatchNorm2D
│   ├── ReLU
│   ├── Conv2D: 64 filters, 3x3 kernel
│   ├── BatchNorm2D
│   └── Skip Connection + ReLU
├── Global Average Pooling
├── Policy Head: Dense(256) -> Dense(7)
└── Value Head: Dense(256) -> Dense(1)

# Training: Self-play with AlphaZero-style loss function
```

#### **Attention Networks (Transformer-based)**
```python
# Architecture: Connect4AttentionNetwork
Input Layer: [batch_size, 42, 3]  # Flattened board representation
├── Positional Encoding
├── Multi-Head Attention x6:
│   ├── Self-Attention (8 heads, 64 dim each)
│   ├── Layer Normalization
│   ├── Feed-Forward Network
│   └── Residual Connection
├── Global Token Aggregation
├── Policy Head: Linear(512) -> Linear(7)
└── Value Head: Linear(512) -> Linear(1)

# Innovation: Board position embeddings with geometric understanding
```

### **Training Algorithm Deep Dive**

#### **Deep Q-Network (DQN) Variants**
- **Standard DQN**: Experience replay with epsilon-greedy exploration
- **Double DQN**: Reduces overestimation bias with target network decoupling
- **Dueling DQN**: Separate value and advantage streams for better state evaluation
- **Rainbow DQN**: Combines distributional RL, noisy networks, and prioritized replay

#### **AlphaZero Implementation**
- **Self-Play Engine**: Generates training data through competitive self-play
- **MCTS Integration**: Neural network guides tree search with policy and value predictions
- **Training Pipeline**: Continuous model updates with performance-based promotion
- **Evaluation Protocol**: Rigorous testing against previous versions for strength validation

#### **Multi-Agent Systems**
- **MADDPG**: Multi-Agent Deep Deterministic Policy Gradient for competitive training
- **QMIX**: Value-based multi-agent coordination with centralized training
- **Population-Based Training**: Diverse agent ecosystem with skill evolution

## Architecture & Tech Stack

### **Comprehensive System Architecture**

```plaintext
┌─────────────────────────────────────────────────────────────────────────────────────┐
│                                 Client Layer                                        │
├─────────────────┬─────────────────┬─────────────────┬─────────────────────────────┤
│ Web Browser     │ Mobile App      │ Desktop App     │ API Clients                 │
│ • React 18+     │ • PWA Support   │ • Electron      │ • REST/GraphQL              │
│ • TypeScript    │ • Service Workers│ • Tauri         │ • WebSocket                 │
│ • Tailwind CSS  │ • Offline Mode  │ • Native Feel   │ • SDK Integration           │
└─────────────────┴─────────────────┴─────────────────┴─────────────────────────────┘
                                        │
                                   WebSocket/HTTP
                                        │
┌─────────────────────────────────────────────────────────────────────────────────────┐
│                              Application Layer                                      │
├─────────────────┬─────────────────┬─────────────────┬─────────────────────────────┤
│ Game Server     │ API Gateway     │ WebSocket Hub   │ Authentication              │
│ • NestJS        │ • Rate Limiting │ • Socket.IO     │ • JWT/OAuth2                │
│ • TypeScript    │ • Load Balancing│ • Real-time     │ • Session Management        │
│ • Dependency    │ • API Versioning│ • Event Routing │ • Role-based Access         │
│   Injection     │ • Documentation │ • Broadcasting  │ • Security Middleware       │
└─────────────────┴─────────────────┴─────────────────┴─────────────────────────────┘
                                        │
                                    HTTP/gRPC
                                        │
┌─────────────────────────────────────────────────────────────────────────────────────┐
│                               AI/ML Layer                                           │
├─────────────────┬─────────────────┬─────────────────┬─────────────────────────────┤
│ Training Engine │ Inference Server│ Model Registry  │ Experiment Tracking         │
│ • PyTorch       │ • FastAPI       │ • MLflow        │ • Weights & Biases          │
│ • Distributed   │ • Model Serving │ • Version Control│ • Hyperparameter Tuning    │
│ • GPU Clusters  │ • Batch/Stream  │ • A/B Testing   │ • Performance Metrics       │
│ • Auto-scaling  │ • Auto-scaling  │ • Model Lineage │ • Visualization             │
└─────────────────┴─────────────────┴─────────────────┴─────────────────────────────┘
                                        │
                                    Message Queue
                                        │
┌─────────────────────────────────────────────────────────────────────────────────────┐
│                               Data Layer                                            │
├─────────────────┬─────────────────┬─────────────────┬─────────────────────────────┤
│ Game Database   │ ML Data Store   │ Analytics DB    │ Cache Layer                 │
│ • PostgreSQL    │ • MongoDB       │ • ClickHouse    │ • Redis                     │
│ • ACID Compliance│ • Document Store│ • Time Series   │ • Session Store             │
│ • Replication   │ • Flexible Schema│ • Real-time     │ • Rate Limiting             │
│ • Backup/Recovery│ • Horizontal Scale│ • Aggregations │ • Pub/Sub                  │
└─────────────────┴─────────────────┴─────────────────┴─────────────────────────────┘
                                        │
                                    File System/S3
                                        │
┌─────────────────────────────────────────────────────────────────────────────────────┐
│                            Infrastructure Layer                                     │
├─────────────────┬─────────────────┬─────────────────┬─────────────────────────────┤
│ Orchestration   │ Monitoring      │ CI/CD Pipeline  │ Security                    │
│ • Kubernetes    │ • Prometheus    │ • GitHub Actions│ • WAF/Firewall              │
│ • Docker        │ • Grafana       │ • Automated Tests│ • Encryption                │
│ • Helm Charts   │ • Alerting      │ • Blue/Green    │ • Compliance                │
│ • Auto-scaling  │ • Log Aggregation│ • Rollback     │ • Audit Logging             │
└─────────────────┴─────────────────┴─────────────────┴─────────────────────────────┘
```

### **Advanced Technology Stack**

#### **Frontend Technologies**
```typescript
// Core Framework
React 18.2+ with Concurrent Features
TypeScript 5.0+ with strict mode
Next.js 13+ with App Router (optional)

// Styling & UI
Tailwind CSS 3.0+ with JIT compilation
Framer Motion for advanced animations
React Spring for physics-based animations
Headless UI for accessible components

// State Management
Zustand for lightweight state management
React Query for server state synchronization
Jotai for atomic state management

// Real-time Communication
Socket.IO Client 4.7+ with binary support
WebRTC for peer-to-peer gameplay
Server-Sent Events for live updates

// Performance & Optimization
React.memo and useMemo for rendering optimization
Code splitting with dynamic imports
Service Workers for offline functionality
WebAssembly for compute-intensive operations
```

#### **Backend Technologies**
```typescript
// Core Framework
NestJS 10+ with TypeScript
Express.js with security middleware
Fastify for high-performance APIs

// Real-time & Communication
Socket.IO 4.7+ with clustering support
GraphQL with Apollo Server
gRPC for service-to-service communication
Message queues with Redis/RabbitMQ

// Database & ORM
TypeORM with PostgreSQL
Prisma for type-safe database access
MongoDB with Mongoose
Redis for caching and sessions

// Authentication & Security
Passport.js with multiple strategies
JWT with refresh token rotation
Rate limiting with express-rate-limit
CORS configuration
Helmet.js for security headers
```

#### **AI/ML Technologies**
```python
# Core ML Frameworks
PyTorch 2.0+ with torch.compile
TensorFlow 2.13+ with eager execution
JAX for high-performance computing
ONNX for model interoperability

# Training & Optimization
Optuna for hyperparameter optimization
Ray for distributed training
Weights & Biases for experiment tracking
MLflow for model lifecycle management

# Serving & Deployment
FastAPI with async support
TorchServe for PyTorch model serving
TensorFlow Serving for production deployment
ONNX Runtime for optimized inference

# Data Processing
NumPy for numerical computing
Pandas for data manipulation
Polars for high-performance data processing
Apache Arrow for columnar data
```

## Prerequisites

### **System Requirements**

#### **Development Environment**
```bash
# Required Software
Node.js >= 18.0.0 (LTS recommended)
Python >= 3.9 (3.11 recommended for performance)
Git >= 2.30.0
Bash/Zsh shell with modern features

# Recommended Hardware
CPU: 8+ cores (Intel i7/AMD Ryzen 7 or better)
RAM: 16GB+ (32GB recommended for training)
Storage: 10GB+ free space (SSD recommended)
Network: Stable internet connection (50+ Mbps for cloud training)

# Optional for GPU Acceleration
NVIDIA GPU with 8GB+ VRAM
CUDA Toolkit 11.8+
cuDNN 8.6+
```

#### **Production Environment**
```yaml
# Container Requirements
Docker: 24.0+
Docker Compose: 2.20+
Kubernetes: 1.27+ (for orchestration)

# Cloud Provider Support
AWS: ECS, EKS, SageMaker
Google Cloud: GKE, AI Platform
Azure: AKS, ML Studio
DigitalOcean: Kubernetes

# Database Requirements
PostgreSQL: 14+
Redis: 7.0+
MongoDB: 6.0+ (optional)
```

### **Development Tools Setup**

#### **IDE Configuration**
```json
// VS Code Extensions
{
  "recommendations": [
    "ms-vscode.vscode-typescript-next",
    "bradlc.vscode-tailwindcss",
    "ms-python.python",
    "ms-python.pylint",
    "esbenp.prettier-vscode",
    "ms-playwright.playwright",
    "ms-vscode.test-adapter-converter"
  ]
}

// ESLint Configuration
{
  "extends": [
    "@typescript-eslint/recommended",
    "next/core-web-vitals",
    "prettier"
  ],
  "rules": {
    "prefer-const": "error",
    "no-unused-vars": "error",
    "@typescript-eslint/no-explicit-any": "warn"
  }
}
```

## 🎯 Quick Start

### **Automated Setup Script**
```bash
#!/bin/bash
# setup.sh - Automated development environment setup

echo "🚀 Setting up Connect Four AI Platform..."

# Check prerequisites
command -v node >/dev/null 2>&1 || { echo "Node.js is required"; exit 1; }
command -v python3 >/dev/null 2>&1 || { echo "Python 3 is required"; exit 1; }
command -v git >/dev/null 2>&1 || { echo "Git is required"; exit 1; }

# Clone repository
git clone https://github.com/drussell23/Connect-Four.git
cd Connect-Four

# Install dependencies
echo "📦 Installing dependencies..."
npm install

# Setup Python environment
echo "🐍 Setting up Python environment..."
python3 -m venv venv
source venv/bin/activate  # Linux/Mac
pip install -r ml_service/requirements.txt

# Setup environment files
echo "⚙️ Creating environment files..."
cp .env.example .env
cp frontend/.env.example frontend/.env
cp backend/.env.example backend/.env
cp ml_service/.env.example ml_service/.env

# Initialize database
echo "🗄️ Setting up database..."
npm run db:setup

# Build initial models
echo "🧠 Building initial AI models..."
npm run train:init

echo "✅ Setup complete! Run 'npm run start' to begin."
```

### **Docker Quick Start**
```yaml
# docker-compose.quick.yml
version: '3.8'
services:
  game:
    build: .
    ports:
      - "3001:3001"  # Frontend
      - "3000:3000"  # Backend
      - "8000:8000"  # ML Service
    environment:
      - NODE_ENV=development
      - QUICK_START=true
    volumes:
      - ./models:/app/models
    depends_on:
      - redis
      - postgres
  
  redis:
    image: redis:alpine
    ports:
      - "6379:6379"
  
  postgres:
    image: postgres:15
    environment:
      POSTGRES_DB: connect4
      POSTGRES_USER: game
      POSTGRES_PASSWORD: development
    ports:
      - "5432:5432"
```

```bash
# Quick start with Docker
curl -fsSL https://raw.githubusercontent.com/drussell23/Connect-Four/main/docker-compose.quick.yml -o docker-compose.yml
docker-compose up -d
echo "🎮 Game available at: http://localhost:3001"
echo "📊 Monitoring at: http://localhost:8001/status"
```

## 🏋️ Enhanced ML Training Pipeline

### **Training Pipeline Architecture**

```mermaid
graph TD
    A[Data Generation] --> B[Preprocessing]
    B --> C[Model Training]
    C --> D[Evaluation]
    D --> E{Performance Check}
    E -->|Pass| F[Model Promotion]
    E -->|Fail| G[Hyperparameter Tuning]
    G --> C
    F --> H[Deployment]
    H --> I[Online Learning]
    I --> J[Performance Monitoring]
    J --> K{Drift Detection}
    K -->|Drift| A
    K -->|Stable| I
```

### **Advanced Training Configuration**

```yaml
# training_config.yaml
training:
  # Global Settings
  seed: 42
  deterministic: true
  mixed_precision: true
  compile_model: true
  
  # Data Generation
  data_generation:
    parallel_workers: 8
    games_per_worker: 250
    total_games: 2000
    game_types:
      - self_play: 0.6
      - human_games: 0.3
      - random_games: 0.1
    
  # Model Architecture
  model:
    architecture: "ensemble"
    networks:
      cnn:
        filters: [32, 64, 128, 256]
        kernel_sizes: [3, 3, 3, 3]
        dropout: 0.1
        batch_norm: true
      resnet:
        blocks: 8
        filters: 64
        dropout: 0.15
      attention:
        heads: 8
        layers: 6
        dim_model: 512
        dropout: 0.1
  
  # Training Parameters
  optimization:
    optimizer: "adamw"
    learning_rate: 0.001
    weight_decay: 0.0001
    lr_scheduler:
      type: "cosine_annealing"
      T_max: 100
      eta_min: 1e-6
    gradient_clipping: 1.0
    
  # Training Process
  training_loop:
    epochs: 100
    batch_size: 128
    validation_split: 0.15
    early_stopping:
      patience: 15
      min_delta: 0.001
      restore_best_weights: true
    
  # Experience Replay
  replay_buffer:
    size: 100000
    prioritized: true
    alpha: 0.6
    beta: 0.4
    beta_annealing: 0.001

  # Evaluation
  evaluation:
    tournament_games: 1000
    baseline_models: 5
    win_rate_threshold: 0.55
    statistical_significance: 0.05
```

### **Distributed Training Setup**

```python
# distributed_training.py
import torch
import torch.distributed as dist
from torch.nn.parallel import DistributedDataParallel as DDP

class DistributedTrainer:
    def __init__(self, config):
        self.config = config
        self.setup_distributed()
    
    def setup_distributed(self):
        """Initialize distributed training environment"""
        dist.init_process_group(
            backend='nccl',
            init_method='env://',
            world_size=self.config.world_size,
            rank=self.config.rank
        )
        
        torch.cuda.set_device(self.config.local_rank)
        self.device = torch.device(f'cuda:{self.config.local_rank}')
    
    def create_model(self):
        """Create and wrap model for distributed training"""
        model = self.config.model_class(**self.config.model_params)
        model = model.to(self.device)
        
        # Enable mixed precision training
        model = torch.compile(model) if self.config.compile else model
        
        # Wrap with DDP
        model = DDP(
            model,
            device_ids=[self.config.local_rank],
            output_device=self.config.local_rank,
            find_unused_parameters=False
        )
        
        return model
    
    def train_epoch(self, model, dataloader, optimizer, scaler):
        """Training loop with automatic mixed precision"""
        model.train()
        total_loss = 0.0
        
        for batch_idx, (data, target) in enumerate(dataloader):
            data, target = data.to(self.device), target.to(self.device)
            
            optimizer.zero_grad()
            
            with torch.autocast(device_type='cuda', dtype=torch.float16):
                output = model(data)
                loss = self.compute_loss(output, target)
            
            scaler.scale(loss).backward()
            scaler.step(optimizer)
            scaler.update()
            
            total_loss += loss.item()
            
            if batch_idx % self.config.log_interval == 0:
                self.log_progress(batch_idx, len(dataloader), loss.item())
        
        return total_loss / len(dataloader)

# Launch distributed training
# torchrun --nproc_per_node=4 distributed_training.py
```

## 🧪 Advanced Configuration

### **Environment Variables Reference**

```bash
# Frontend Configuration
REACT_APP_WS_URL=ws://localhost:3000/game
REACT_APP_API_URL=http://localhost:3000
REACT_APP_ML_API_URL=http://localhost:8000
REACT_APP_ENVIRONMENT=development
REACT_APP_DEBUG_MODE=true
REACT_APP_FEATURE_FLAGS=ai_explanations,advanced_stats,experimental_ui
REACT_APP_ANALYTICS_ID=your_analytics_id
REACT_APP_SENTRY_DSN=your_sentry_dsn

# Backend Configuration
NODE_ENV=development
PORT=3000
WS_NAMESPACE=/game
CORS_ORIGINS=http://localhost:3001,http://localhost:3000
RATE_LIMIT_WINDOW_MS=60000
RATE_LIMIT_MAX_REQUESTS=100

# Database Configuration
DATABASE_URL=postgresql://user:password@localhost:5432/connect4
REDIS_URL=redis://localhost:6379
MONGODB_URL=mongodb://localhost:27017/connect4

# AI/ML Configuration
USE_ML_MODEL=true
ML_SERVICE_URL=http://localhost:8000
ML_TIMEOUT_MS=5000
ML_RETRY_ATTEMPTS=3
ML_BATCH_SIZE=32
TRAINING_ENABLED=true
PARALLEL_WORKERS=4
CUDA_VISIBLE_DEVICES=0,1,2,3

# Security Configuration
JWT_SECRET=your_super_secret_jwt_key
JWT_EXPIRATION=24h
REFRESH_TOKEN_EXPIRATION=7d
BCRYPT_ROUNDS=12
RATE_LIMIT_ENABLED=true

# Monitoring Configuration
PROMETHEUS_ENABLED=true
PROMETHEUS_PORT=9090
GRAFANA_PORT=3001
LOG_LEVEL=info
STRUCTURED_LOGGING=true
```

### **Advanced Training Parameters**

```json
{
  "hyperparameters": {
    "neural_networks": {
      "cnn": {
        "architecture": "custom",
        "input_shape": [6, 7, 3],
        "conv_layers": [
          {"filters": 32, "kernel_size": 3, "activation": "relu"},
          {"filters": 64, "kernel_size": 3, "activation": "relu"},
          {"filters": 128, "kernel_size": 3, "activation": "relu"}
        ],
        "dense_layers": [256, 128],
        "dropout_rate": 0.1,
        "batch_normalization": true,
        "l2_regularization": 0.0001
      },
      "transformer": {
        "num_layers": 6,
        "num_heads": 8,
        "hidden_size": 512,
        "intermediate_size": 2048,
        "attention_dropout": 0.1,
        "hidden_dropout": 0.1,
        "position_embedding_type": "learned"
      }
    },
    "training": {
      "optimizer": {
        "type": "adamw",
        "learning_rate": 0.001,
        "weight_decay": 0.01,
        "betas": [0.9, 0.999],
        "eps": 1e-8
      },
      "scheduler": {
        "type": "cosine_annealing_warm_restarts",
        "T_0": 10,
        "T_mult": 2,
        "eta_min": 1e-6
      },
      "loss_function": {
        "policy_loss": "cross_entropy",
        "value_loss": "mse",
        "policy_weight": 1.0,
        "value_weight": 1.0,
        "entropy_weight": 0.01
      }
    },
    "reinforcement_learning": {
      "algorithm": "ppo",
      "gamma": 0.99,
      "gae_lambda": 0.95,
      "clip_ratio": 0.2,
      "entropy_coef": 0.01,
      "value_coef": 0.5,
      "max_grad_norm": 0.5,
      "update_epochs": 4,
      "minibatch_size": 64
    }
  }
}
```

## ⚙️ Performance Tuning

### **System Optimization Guide**

#### **Memory Optimization**
```bash
# Node.js Memory Settings
export NODE_OPTIONS="--max-old-space-size=8192 --max-semi-space-size=256"

# Python Memory Settings
export PYTHONMALLOC=pymalloc
export MALLOC_TRIM_THRESHOLD_=100000

# GPU Memory Settings
export CUDA_MEMORY_FRACTION=0.8
export TF_FORCE_GPU_ALLOW_GROWTH=true
```

#### **CPU Optimization**
```yaml
# CPU Affinity Configuration
training:
  cpu_affinity:
    data_workers: [0, 1, 2, 3]
    training_process: [4, 5, 6, 7]
    inference_service: [8, 9, 10, 11]
  
  threading:
    torch_threads: 4
    openblas_threads: 1
    mkl_threads: 1
```

#### **GPU Optimization**
```python
# GPU Performance Settings
import torch

# Enable optimized attention
torch.backends.cuda.enable_flash_sdp(True)

# Enable tensor core usage
torch.backends.cuda.matmul.allow_tf32 = True
torch.backends.cudnn.allow_tf32 = True

# Optimize memory allocation
torch.cuda.empty_cache()
torch.cuda.memory.set_per_process_memory_fraction(0.8)

# Enable compilation
model = torch.compile(model, mode="reduce-overhead")
```

### **Performance Benchmarking**

```bash
# Training Performance Benchmark
npm run train:benchmark -- --mode=comprehensive
# Expected Results:
# Game Generation: 500+ games/second
# Training Throughput: 1000+ samples/second
# Model Inference: <10ms latency
# Memory Usage: <8GB RAM, <4GB VRAM

# System Resource Monitoring
npm run monitor:resources -- --duration=3600  # 1 hour monitoring
```

## 📊 Monitoring & Analytics

### **Comprehensive Monitoring Dashboard**

Access the real-time monitoring system at: **http://localhost:8001/status**

#### **Key Metrics Tracked**
```typescript
interface SystemMetrics {
  // Performance Metrics
  training: {
    gamesPerSecond: number;
    samplesPerSecond: number;
    averageGameLength: number;
    trainingLoss: number[];
    validationAccuracy: number[];
    modelConvergence: boolean;
  };
  
  // Resource Utilization
  system: {
    cpuUsage: number;
    memoryUsage: number;
    gpuUtilization: number;
    diskIo: number;
    networkBandwidth: number;
  };
  
  // AI Performance
  ai: {
    winRateProgression: number[];
    averageThinkingTime: number;
    moveAccuracy: number;
    strategicStrength: number;
    adaptationRate: number;
  };
  
  // Game Analytics
  gameplay: {
    totalGamesPlayed: number;
    playerRetention: number;
    averageSessionLength: number;
    difficultyDistribution: Record<string, number>;
  };
}
```

#### **Custom Metric Collection**
```python
# metrics_collector.py
from prometheus_client import Counter, Histogram, Gauge
import logging

# Define custom metrics
GAMES_PLAYED = Counter('games_total', 'Total games played', ['player_type', 'difficulty'])
MOVE_TIME = Histogram('move_duration_seconds', 'Time taken for AI moves')
AI_STRENGTH = Gauge('ai_strength_rating', 'Current AI strength rating')
TRAINING_LOSS = Gauge('training_loss', 'Current training loss')

class MetricsCollector:
    def __init__(self):
        self.logger = logging.getLogger(__name__)
    
    def record_game_completion(self, player_type: str, difficulty: int, winner: str):
        """Record game completion metrics"""
        GAMES_PLAYED.labels(player_type=player_type, difficulty=difficulty).inc()
        self.logger.info(f"Game completed: {player_type} vs AI (difficulty {difficulty}), winner: {winner}")
    
    def record_move_time(self, duration: float):
        """Record AI move calculation time"""
        MOVE_TIME.observe(duration)
    
    def update_ai_strength(self, rating: float):
        """Update current AI strength rating"""
        AI_STRENGTH.set(rating)
    
    def update_training_metrics(self, loss: float, accuracy: float):
        """Update training performance metrics"""
        TRAINING_LOSS.set(loss)
        self.logger.info(f"Training metrics - Loss: {loss:.4f}, Accuracy: {accuracy:.4f}")
```

## 🏗️ System Architecture Details

### **Microservices Architecture**

```typescript
// Service Registry and Discovery
interface ServiceRegistry {
  gameService: {
    endpoint: "http://game-service:3000";
    healthCheck: "/health";
    metrics: "/metrics";
    capabilities: ["game_logic", "websocket", "real_time"];
  };
  
  aiService: {
    endpoint: "http://ai-service:8000";
    healthCheck: "/health";
    metrics: "/metrics";
    capabilities: ["inference", "training", "model_management"];
  };
  
  analyticsService: {
    endpoint: "http://analytics-service:9000";
    healthCheck: "/health";
    metrics: "/metrics";
    capabilities: ["data_collection", "reporting", "dashboards"];
  };
}

// Inter-service Communication
class ServiceMesh {
  private registry: ServiceRegistry;
  
  async callService(service: string, endpoint: string, data?: any) {
    const serviceConfig = this.registry[service];
    const response = await fetch(`${serviceConfig.endpoint}${endpoint}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Service-Token': process.env.SERVICE_TOKEN,
        'X-Correlation-ID': this.generateCorrelationId(),
      },
      body: JSON.stringify(data),
    });
    
    if (!response.ok) {
      throw new Error(`Service ${service} error: ${response.statusText}`);
    }
    
    return response.json();
  }
}
```

### **Event-Driven Architecture**

```typescript
// Event System
interface GameEvent {
  id: string;
  type: 'MOVE_MADE' | 'GAME_STARTED' | 'GAME_ENDED' | 'AI_TRAINED';
  timestamp: number;
  data: any;
  metadata: {
    source: string;
    version: string;
    correlationId: string;
  };
}

class EventBus {
  private subscribers: Map<string, Function[]> = new Map();
  
  subscribe(eventType: string, handler: Function) {
    if (!this.subscribers.has(eventType)) {
      this.subscribers.set(eventType, []);
    }
    this.subscribers.get(eventType)!.push(handler);
  }
  
  async publish(event: GameEvent) {
    const handlers = this.subscribers.get(event.type) || [];
    await Promise.all(handlers.map(handler => handler(event)));
    
    // Persist event for replay capability
    await this.persistEvent(event);
  }
  
  private async persistEvent(event: GameEvent) {
    // Store in event store for audit trail and replay
    await this.eventStore.save(event);
  }
}
```

## 🔬 AI Algorithm Implementation

### **Advanced Minimax with Neural Guidance**

```typescript
// Enhanced Minimax Implementation
class NeuralGuidedMinimax {
  constructor(
    private neuralNet: NeuralNetwork,
    private maxDepth: number = 8,
    private useQuiescence: boolean = true
  ) {}
  
  async getBestMove(board: Board, player: Player): Promise<Move> {
    // Get neural network evaluation for move ordering
    const networkEval = await this.neuralNet.evaluate(board);
    const moveOrdering = this.orderMoves(board.getLegalMoves(), networkEval);
    
    let bestMove: Move | null = null;
    let bestValue = -Infinity;
    
    for (const move of moveOrdering) {
      const newBoard = board.makeMove(move);
      const value = await this.minimax(
        newBoard,
        this.maxDepth - 1,
        -Infinity,
        Infinity,
        false,
        networkEval
      );
      
      if (value > bestValue) {
        bestValue = value;
        bestMove = move;
      }
    }
    
    return bestMove!;
  }
  
  private async minimax(
    board: Board,
    depth: number,
    alpha: number,
    beta: number,
    maximizing: boolean,
    parentEval: NetworkEvaluation
  ): Promise<number> {
    // Terminal conditions
    if (depth === 0 || board.isTerminal()) {
      if (this.useQuiescence && this.isTactical(board)) {
        return this.quiescenceSearch(board, alpha, beta, maximizing);
      }
      return this.evaluatePosition(board, parentEval);
    }
    
    const moves = board.getLegalMoves();
    const networkEval = await this.neuralNet.evaluate(board);
    const orderedMoves = this.orderMoves(moves, networkEval);
    
    if (maximizing) {
      let maxEval = -Infinity;
      for (const move of orderedMoves) {
        const newBoard = board.makeMove(move);
        const eval = await this.minimax(newBoard, depth - 1, alpha, beta, false, networkEval);
        maxEval = Math.max(maxEval, eval);
        alpha = Math.max(alpha, eval);
        if (beta <= alpha) break; // Alpha-beta pruning
      }
      return maxEval;
    } else {
      let minEval = Infinity;
      for (const move of orderedMoves) {
        const newBoard = board.makeMove(move);
        const eval = await this.minimax(newBoard, depth - 1, alpha, beta, true, networkEval);
        minEval = Math.min(minEval, eval);
        beta = Math.min(beta, eval);
        if (beta <= alpha) break; // Alpha-beta pruning
      }
      return minEval;
    }
  }
  
  private quiescenceSearch(board: Board, alpha: number, beta: number, maximizing: boolean): number {
    // Extended search for tactical positions
    const standPat = this.staticEvaluate(board);
    
    if (maximizing) {
      if (standPat >= beta) return beta;
      alpha = Math.max(alpha, standPat);
    } else {
      if (standPat <= alpha) return alpha;
      beta = Math.min(beta, standPat);
    }
    
    const tacticalMoves = this.getTacticalMoves(board);
    for (const move of tacticalMoves) {
      const newBoard = board.makeMove(move);
      const score = this.quiescenceSearch(newBoard, alpha, beta, !maximizing);
      
      if (maximizing) {
        if (score >= beta) return beta;
        alpha = Math.max(alpha, score);
      } else {
        if (score <= alpha) return alpha;
        beta = Math.min(beta, score);
      }
    }
    
    return maximizing ? alpha : beta;
  }
}
```

### **MCTS with Neural Network Integration**

```typescript
// Advanced MCTS Implementation
class NeuralMCTS {
  private root: MCTSNode;
  private explorationConstant: number = 1.414;
  private neuralNet: NeuralNetwork;
  
  constructor(neuralNet: NeuralNetwork) {
    this.neuralNet = neuralNet;
  }
  
  async search(board: Board, simulations: number): Promise<Move> {
    this.root = new MCTSNode(board, null, null);
    
    for (let i = 0; i < simulations; i++) {
      await this.runSimulation();
    }
    
    return this.selectBestMove();
  }
  
  private async runSimulation(): Promise<void> {
    // Selection
    let node = this.root;
    const path: MCTSNode[] = [node];
    
    while (!node.isTerminal() && node.isFullyExpanded()) {
      node = this.selectChild(node);
      path.push(node);
    }
    
    // Expansion
    if (!node.isTerminal() && !node.isFullyExpanded()) {
      const newChild = await this.expandNode(node);
      path.push(newChild);
      node = newChild;
    }
    
    // Evaluation with Neural Network
    const value = await this.evaluateNode(node);
    
    // Backpropagation
    this.backpropagate(path, value);
  }
  
  private selectChild(node: MCTSNode): MCTSNode {
    let bestChild: MCTSNode | null = null;
    let bestValue = -Infinity;
    
    for (const child of node.children) {
      const ucbValue = this.calculateUCB(child, node.visits);
      if (ucbValue > bestValue) {
        bestValue = ucbValue;
        bestChild = child;
      }
    }
    
    return bestChild!;
  }
  
  private calculateUCB(node: MCTSNode, parentVisits: number): number {
    if (node.visits === 0) return Infinity;
    
    const exploitation = node.totalValue / node.visits;
    const exploration = this.explorationConstant * Math.sqrt(Math.log(parentVisits) / node.visits);
    const priorBonus = node.priorProbability * Math.sqrt(parentVisits) / (1 + node.visits);
    
    return exploitation + exploration + priorBonus;
  }
  
  private async expandNode(node: MCTSNode): Promise<MCTSNode> {
    const legalMoves = node.board.getLegalMoves();
    const networkOutput = await this.neuralNet.evaluate(node.board);
    
    // Add all legal moves as children
    for (let i = 0; i < legalMoves.length; i++) {
      const move = legalMoves[i];
      const newBoard = node.board.makeMove(move);
      const priorProb = networkOutput.policy[move.column];
      const child = new MCTSNode(newBoard, node, move, priorProb);
      node.addChild(child);
    }
    
    // Return first unvisited child
    return node.children.find(child => child.visits === 0)!;
  }
  
  private async evaluateNode(node: MCTSNode): Promise<number> {
    if (node.board.isTerminal()) {
      return node.board.getWinner() === 'player' ? 1 : -1;
    }
    
    const networkOutput = await this.neuralNet.evaluate(node.board);
    return networkOutput.value;
  }
  
  private backpropagate(path: MCTSNode[], value: number): void {
    for (let i = path.length - 1; i >= 0; i--) {
      const node = path[i];
      node.visits++;
      node.totalValue += value;
      value = -value; // Flip value for opponent
    }
  }
}

class MCTSNode {
  public visits: number = 0;
  public totalValue: number = 0;
  public children: MCTSNode[] = [];
  
  constructor(
    public board: Board,
    public parent: MCTSNode | null,
    public move: Move | null,
    public priorProbability: number = 0
  ) {}
  
  isTerminal(): boolean {
    return this.board.isTerminal();
  }
  
  isFullyExpanded(): boolean {
    return this.children.length === this.board.getLegalMoves().length;
  }
  
  addChild(child: MCTSNode): void {
    this.children.push(child);
  }
}
```

## 📡 API Reference

### **Game API Endpoints**

```typescript
// Game Management API
interface GameAPI {
  // Game Operations
  POST /api/games              // Create new game
  GET /api/games/:id          // Get game state
  PUT /api/games/:id/move     // Make a move
  DELETE /api/games/:id       // End game
  
  // AI Operations
  POST /api/ai/move           // Get AI move
  GET /api/ai/analysis        // Get position analysis
  PUT /api/ai/difficulty      // Set AI difficulty
  GET /api/ai/personality     // Get AI personality info
  
  // Player Management
  POST /api/players           // Create player profile
  GET /api/players/:id        // Get player data
  PUT /api/players/:id        // Update player profile
  GET /api/players/:id/stats  // Get player statistics
  
  // Training & Models
  POST /api/training/start    // Start training
  GET /api/training/status    // Get training status
  POST /api/models/deploy     // Deploy new model
  GET /api/models/metrics     // Get model performance
}

// WebSocket Events
interface WebSocketEvents {
  // Client to Server
  'join-game': { gameId: string; playerId: string };
  'make-move': { gameId: string; column: number };
  'request-hint': { gameId: string };
  'leave-game': { gameId: string };
  
  // Server to Client
  'game-updated': GameState;
  'player-joined': PlayerInfo;
  'player-left': PlayerInfo;
  'ai-thinking': { estimatedTime: number };
  'ai-move': { column: number; reasoning: string };
  'game-ended': { winner: string; reason: string };
  'error': { message: string; code: string };
}
```

### **ML API Endpoints**

```python
# ML Service API Documentation
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
from typing import List, Optional

app = FastAPI(title="Connect4 ML API", version="2.0.0")

class BoardState(BaseModel):
    board: List[List[int]]  # 6x7 grid with 0=empty, 1=player1, 2=player2
    player: int             # Current player (1 or 2)
    
class PredictionRequest(BaseModel):
    board_state: BoardState
    model_version: Optional[str] = "latest"
    explain: Optional[bool] = False

class PredictionResponse(BaseModel):
    move: int                    # Recommended column (0-6)
    confidence: float           # Confidence score (0-1)
    move_probabilities: List[float]  # Probability for each column
    position_value: float       # Estimated position value (-1 to 1)
    thinking_time_ms: int      # Time taken for computation
    explanation: Optional[str]  # Human-readable explanation

@app.post("/predict", response_model=PredictionResponse)
async def predict_move(request: PredictionRequest):
    """
    Get AI move prediction for current board state
    
    Args:
        request: Board state and prediction parameters
        
    Returns:
        Predicted move with confidence and explanation
        
    Raises:
        HTTPException: If board state is invalid
    """
    try:
        # Validate board state
        if not is_valid_board(request.board_state.board):
            raise HTTPException(status_code=400, detail="Invalid board state")
        
        # Get prediction from model
        result = await ml_service.predict(request)
        return result
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/analyze")
async def analyze_position(request: PredictionRequest):
    """Comprehensive position analysis"""
    analysis = await ml_service.analyze_position(request.board_state)
    return {
        "threats": analysis.threats,
        "opportunities": analysis.opportunities,
        "strategic_assessment": analysis.strategy,
        "tactical_motifs": analysis.tactics,
        "position_evaluation": analysis.evaluation
    }

@app.get("/models")
async def list_models():
    """List available models and their performance metrics"""
    models = await model_registry.list_models()
    return {
        "models": [
            {
                "name": model.name,
                "version": model.version,
                "performance": model.metrics,
                "created_at": model.created_at,
                "is_active": model.is_active
            }
            for model in models
        ]
    }

@app.post("/training/start")
async def start_training(config: TrainingConfig):
    """Start new training session"""
    job_id = await training_service.start_training(config)
    return {"job_id": job_id, "status": "started"}

@app.get("/training/{job_id}/status")
async def get_training_status(job_id: str):
    """Get training job status and metrics"""
    status = await training_service.get_status(job_id)
    return {
        "job_id": job_id,
        "status": status.status,
        "progress": status.progress,
        "metrics": status.metrics,
        "estimated_completion": status.eta
    }
```

## 🗄️ Database & Model Management

### **Database Schema**

```sql
-- Game Management Schema
CREATE TABLE games (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    player1_id UUID NOT NULL,
    player2_id UUID NULL, -- NULL for AI games
    board_state JSONB NOT NULL,
    current_player INTEGER NOT NULL CHECK (current_player IN (1, 2)),
    status VARCHAR(20) NOT NULL DEFAULT 'active',
    winner INTEGER NULL CHECK (winner IN (1, 2)),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    ended_at TIMESTAMP WITH TIME ZONE NULL,
    
    CONSTRAINT valid_status CHECK (status IN ('active', 'completed', 'abandoned')),
    INDEX idx_games_status (status),
    INDEX idx_games_created_at (created_at),
    INDEX idx_games_player1 (player1_id),
    INDEX idx_games_player2 (player2_id)
);

-- Player Profiles
CREATE TABLE players (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    username VARCHAR(50) UNIQUE NOT NULL,
    email VARCHAR(255) UNIQUE NULL,
    password_hash VARCHAR(255) NULL, -- NULL for anonymous players
    ai_difficulty_preference INTEGER DEFAULT 1,
    total_games INTEGER DEFAULT 0,
    games_won INTEGER DEFAULT 0,
    current_rating INTEGER DEFAULT 1200,
    peak_rating INTEGER DEFAULT 1200,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    last_active TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    INDEX idx_players_username (username),
    INDEX idx_players_rating (current_rating),
    INDEX idx_players_last_active (last_active)
);

-- Game Moves History
CREATE TABLE moves (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    game_id UUID NOT NULL REFERENCES games(id) ON DELETE CASCADE,
    player_id UUID NOT NULL REFERENCES players(id),
    column_index INTEGER NOT NULL CHECK (column_index BETWEEN 0 AND 6),
    row_index INTEGER NOT NULL CHECK (row_index BETWEEN 0 AND 5),
    move_number INTEGER NOT NULL,
    thinking_time_ms INTEGER NULL, -- For AI moves
    evaluation_score DECIMAL(10,6) NULL, -- Position evaluation
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    UNIQUE(game_id, move_number),
    INDEX idx_moves_game_id (game_id),
    INDEX idx_moves_created_at (created_at)
);

-- AI Training Data
CREATE TABLE training_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    model_name VARCHAR(100) NOT NULL,
    model_version VARCHAR(20) NOT NULL,
    config JSONB NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'running',
    progress DECIMAL(5,2) DEFAULT 0.0,
    metrics JSONB NULL,
    started_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    completed_at TIMESTAMP WITH TIME ZONE NULL,
    
    CONSTRAINT valid_training_status CHECK (status IN ('pending', 'running', 'completed', 'failed', 'cancelled')),
    INDEX idx_training_status (status),
    INDEX idx_training_started_at (started_at)
);

-- Model Registry
CREATE TABLE models (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(100) NOT NULL,
    version VARCHAR(20) NOT NULL,
    architecture VARCHAR(50) NOT NULL,
    file_path VARCHAR(500) NOT NULL,
    file_size_bytes BIGINT NOT NULL,
    training_session_id UUID REFERENCES training_sessions(id),
    performance_metrics JSONB NULL,
    is_active BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    UNIQUE(name, version),
    INDEX idx_models_name_version (name, version),
    INDEX idx_models_active (is_active),
    INDEX idx_models_created_at (created_at)
);
```

### **Model Versioning & Management**

```python
# model_registry.py
from dataclasses import dataclass
from typing import Dict, List, Optional
import asyncpg
import json

@dataclass
class ModelMetadata:
    id: str
    name: str
    version: str
    architecture: str
    file_path: str
    performance_metrics: Dict
    is_active: bool
    created_at: str

class ModelRegistry:
    def __init__(self, db_pool: asyncpg.Pool):
        self.db_pool = db_pool
    
    async def register_model(
        self,
        name: str,
        version: str,
        architecture: str,
        file_path: str,
        file_size: int,
        training_session_id: str,
        performance_metrics: Dict
    ) -> str:
        """Register a new model in the registry"""
        async with self.db_pool.acquire() as conn:
            model_id = await conn.fetchval("""
                INSERT INTO models (name, version, architecture, file_path, 
                                  file_size_bytes, training_session_id, performance_metrics)
                VALUES ($1, $2, $3, $4, $5, $6, $7)
                RETURNING id
            """, name, version, architecture, file_path, file_size, 
                training_session_id, json.dumps(performance_metrics))
            
            return model_id
    
    async def activate_model(self, model_id: str) -> None:
        """Activate a model (deactivate others)"""
        async with self.db_pool.acquire() as conn:
            async with conn.transaction():
                # Deactivate all models
                await conn.execute("UPDATE models SET is_active = FALSE")
                
                # Activate specified model
                await conn.execute(
                    "UPDATE models SET is_active = TRUE WHERE id = $1",
                    model_id
                )
    
    async def get_active_model(self) -> Optional[ModelMetadata]:
        """Get currently active model"""
        async with self.db_pool.acquire() as conn:
            row = await conn.fetchrow("""
                SELECT id, name, version, architecture, file_path, 
                       performance_metrics, is_active, created_at
                FROM models 
                WHERE is_active = TRUE 
                LIMIT 1
            """)
            
            if row:
                return ModelMetadata(**dict(row))
            return None
    
    async def list_models(
        self, 
        limit: int = 50, 
        architecture: Optional[str] = None
    ) -> List[ModelMetadata]:
        """List models with optional filtering"""
        query = """
            SELECT id, name, version, architecture, file_path, 
                   performance_metrics, is_active, created_at
            FROM models 
        """
        params = []
        
        if architecture:
            query += " WHERE architecture = $1"
            params.append(architecture)
        
        query += " ORDER BY created_at DESC LIMIT $" + str(len(params) + 1)
        params.append(limit)
        
        async with self.db_pool.acquire() as conn:
            rows = await conn.fetch(query, *params)
            return [ModelMetadata(**dict(row)) for row in rows]
    
    async def compare_models(self, model_ids: List[str]) -> Dict:
        """Compare performance of multiple models"""
        async with self.db_pool.acquire() as conn:
            rows = await conn.fetch("""
                SELECT name, version, performance_metrics
                FROM models 
                WHERE id = ANY($1)
            """, model_ids)
            
            comparison = {}
            for row in rows:
                metrics = row['performance_metrics']
                comparison[f"{row['name']}-{row['version']}"] = metrics
            
            return comparison
```

## 🔬 Research Applications

### **Academic Research Integration**

This platform serves as a comprehensive research environment for multiple areas of AI and computer science research:

#### **Game Theory & Strategic AI**
```python
# research_framework.py
class GameTheoryResearch:
    """Framework for studying strategic decision-making"""
    
    def __init__(self):
        self.game_tree_analyzer = GameTreeAnalyzer()
        self.strategy_classifier = StrategyClassifier()
        
    async def analyze_strategic_patterns(self, games: List[Game]) -> StrategyAnalysis:
        """Analyze strategic patterns in gameplay data"""
        patterns = {
            'opening_preferences': self.analyze_openings(games),
            'tactical_themes': self.identify_tactical_themes(games),
            'endgame_techniques': self.analyze_endgames(games),
            'psychological_factors': self.analyze_psychology(games)
        }
        
        return StrategyAnalysis(patterns)
    
    def study_nash_equilibria(self, position: Position) -> NashEquilibrium:
        """Compute Nash equilibria for given positions"""
        strategies = self.enumerate_strategies(position)
        equilibria = self.compute_equilibria(strategies)
        return equilibria
    
    def analyze_bounded_rationality(self, human_games: List[Game]) -> BoundedRationalityModel:
        """Study human decision-making under cognitive constraints"""
        deviations = self.find_optimal_deviations(human_games)
        cognitive_model = self.fit_cognitive_model(deviations)
        return cognitive_model

# Usage for research
researcher = GameTheoryResearch()
results = await researcher.analyze_strategic_patterns(tournament_games)
publish_results("Strategic Patterns in Connect Four", results)
```

#### **Human-AI Interaction Studies**
```python
class HumanAIInteractionStudy:
    """Framework for studying human-AI collaborative intelligence"""
    
    def __init__(self):
        self.interaction_tracker = InteractionTracker()
        self.adaptation_analyzer = AdaptationAnalyzer()
        
    async def study_adaptation_patterns(self, sessions: List[GameSession]) -> AdaptationStudy:
        """Study how humans adapt to AI behavior"""
        adaptation_metrics = {
            'learning_curves': self.compute_learning_curves(sessions),
            'strategy_evolution': self.track_strategy_changes(sessions),
            'trust_dynamics': self.analyze_trust_patterns(sessions),
            'collaboration_effectiveness': self.measure_collaboration(sessions)
        }
        
        return AdaptationStudy(adaptation_metrics)
    
    def measure_ai_interpretability(self, explanations: List[Explanation]) -> InterpretabilityMetrics:
        """Measure effectiveness of AI explanations"""
        return InterpretabilityMetrics({
            'comprehension_rate': self.compute_comprehension(explanations),
            'trust_impact': self.measure_trust_impact(explanations),
            'learning_acceleration': self.measure_learning_boost(explanations)
        })

# Research protocol
study = HumanAIInteractionStudy()
results = await study.study_adaptation_patterns(user_sessions)
correlation = study.correlate_explanation_effectiveness(results)
```

#### **Meta-Learning & Transfer Learning**
```python
class MetaLearningResearch:
    """Research framework for studying learning-to-learn"""
    
    def __init__(self):
        self.meta_learner = MAMLAgent()
        self.transfer_analyzer = TransferAnalyzer()
        
    async def study_few_shot_adaptation(self, tasks: List[Task]) -> FewShotStudy:
        """Study rapid adaptation to new game variants"""
        adaptation_results = []
        
        for task in tasks:
            # Test adaptation with limited samples
            adaptation_curve = await self.meta_learner.adapt_to_task(
                task, 
                shots=[1, 5, 10, 25, 50]
            )
            adaptation_results.append(adaptation_curve)
        
        return FewShotStudy(adaptation_results)
    
    def analyze_knowledge_transfer(self, source_domain: Domain, target_domain: Domain) -> TransferAnalysis:
        """Analyze transfer of strategic knowledge between domains"""
        shared_representations = self.extract_shared_features(source_domain, target_domain)
        transfer_effectiveness = self.measure_transfer_performance(shared_representations)
        
        return TransferAnalysis({
            'shared_features': shared_representations,
            'transfer_coefficient': transfer_effectiveness,
            'domain_similarity': self.compute_domain_similarity(source_domain, target_domain)
        })

# Multi-domain transfer study
domains = [ConnectFour(), TicTacToe(), Checkers(), Chess()]
transfer_matrix = researcher.build_transfer_matrix(domains)
```

### **Benchmarking & Evaluation Framework**

```python
# benchmark_framework.py
class AIBenchmarkSuite:
    """Comprehensive benchmarking for game-playing AI"""
    
    def __init__(self):
        self.test_positions = PositionDatabase()
        self.reference_engines = ReferenceEngines()
        self.evaluation_metrics = EvaluationMetrics()
    
    async def run_tactical_benchmark(self, ai_agent: AIAgent) -> TacticalBenchmark:
        """Test tactical problem-solving abilities"""
        tactical_problems = await self.test_positions.get_tactical_problems()
        results = []
        
        for problem in tactical_problems:
            start_time = time.time()
            solution = await ai_agent.solve_position(problem.position)
            solve_time = time.time() - start_time
            
            results.append(TacticalResult(
                problem_id=problem.id,
                difficulty=problem.difficulty,
                correct=solution == problem.best_move,
                time_taken=solve_time,
                depth_searched=solution.depth
            ))
        
        return TacticalBenchmark(results)
    
    async def run_strategic_benchmark(self, ai_agent: AIAgent) -> StrategicBenchmark:
        """Test long-term strategic understanding"""
        strategic_positions = await self.test_positions.get_strategic_positions()
        evaluations = []
        
        for position in strategic_positions:
            ai_evaluation = await ai_agent.evaluate_position(position)
            expert_evaluation = position.expert_annotation
            
            evaluations.append(StrategicEvaluation(
                position_id=position.id,
                ai_assessment=ai_evaluation,
                expert_assessment=expert_evaluation,
                alignment_score=self.compute_alignment(ai_evaluation, expert_evaluation)
            ))
        
        return StrategicBenchmark(evaluations)
    
    async def run_endgame_benchmark(self, ai_agent: AIAgent) -> EndgameBenchmark:
        """Test perfect play in endgame positions"""
        endgame_positions = await self.test_positions.get_endgame_positions()
        perfect_play_results = []
        
        for position in endgame_positions:
            game_result = await self.play_to_completion(ai_agent, position)
            tablebase_result = position.tablebase_result
            
            perfect_play_results.append(EndgameResult(
                position_id=position.id,
                moves_to_win=game_result.moves_to_win,
                optimal_moves=tablebase_result.optimal_moves,
                played_optimally=game_result.moves_to_win == tablebase_result.optimal_moves
            ))
        
        return EndgameBenchmark(perfect_play_results)

# Comprehensive evaluation
benchmark_suite = AIBenchmarkSuite()
results = await benchmark_suite.run_full_evaluation(new_ai_model)
performance_report = benchmark_suite.generate_report(results)
```

## 📈 Benchmarking & Evaluation

### **Performance Evaluation Metrics**

```python
# evaluation_metrics.py
from dataclasses import dataclass
from typing import List, Dict
import numpy as np

@dataclass
class PerformanceMetrics:
    # Playing Strength
    elo_rating: float
    win_rate_vs_humans: float
    win_rate_vs_previous_version: float
    
    # Technical Performance
    average_thinking_time: float
    nodes_per_second: int
    memory_usage_mb: float
    
    # Quality Metrics
    tactical_accuracy: float
    strategic_understanding: float
    endgame_precision: float
    
    # Learning Metrics
    sample_efficiency: float
    adaptation_speed: float
    knowledge_retention: float

class BenchmarkRunner:
    def __init__(self):
        self.reference_models = self.load_reference_models()
        self.test_suites = self.load_test_suites()
    
    async def run_comprehensive_benchmark(self, model: AIModel) -> PerformanceMetrics:
        """Run complete evaluation suite"""
        
        # Playing strength evaluation
        elo_rating = await self.compute_elo_rating(model)
        human_winrate = await self.test_against_humans(model, games=1000)
        
        # Technical performance
        performance_stats = await self.measure_technical_performance(model)
        
        # Quality assessment
        tactical_score = await self.run_tactical_tests(model)
        strategic_score = await self.run_strategic_tests(model)
        endgame_score = await self.run_endgame_tests(model)
        
        # Learning evaluation
        learning_metrics = await self.evaluate_learning_capabilities(model)
        
        return PerformanceMetrics(
            elo_rating=elo_rating,
            win_rate_vs_humans=human_winrate,
            win_rate_vs_previous_version=await self.compare_with_previous(model),
            average_thinking_time=performance_stats.thinking_time,
            nodes_per_second=performance_stats.nodes_per_second,
            memory_usage_mb=performance_stats.memory_usage,
            tactical_accuracy=tactical_score,
            strategic_understanding=strategic_score,
            endgame_precision=endgame_score,
            sample_efficiency=learning_metrics.sample_efficiency,
            adaptation_speed=learning_metrics.adaptation_speed,
            knowledge_retention=learning_metrics.retention
        )
    
    async def compute_elo_rating(self, model: AIModel) -> float:
        """Compute ELO rating through tournament play"""
        tournament_results = await self.run_tournament(
            participants=[model] + self.reference_models,
            games_per_pairing=100
        )
        
        elo_ratings = self.calculate_elo_from_results(tournament_results)
        return elo_ratings[model.id]
    
    async def run_ablation_study(self, model: AIModel) -> Dict[str, float]:
        """Study impact of individual components"""
        baseline_performance = await self.evaluate_model(model)
        
        ablation_results = {}
        
        # Test without neural network guidance
        model_without_nn = model.disable_component('neural_network')
        nn_performance = await self.evaluate_model(model_without_nn)
        ablation_results['neural_network_impact'] = baseline_performance - nn_performance
        
        # Test without experience replay
        model_without_replay = model.disable_component('experience_replay')
        replay_performance = await self.evaluate_model(model_without_replay)
        ablation_results['experience_replay_impact'] = baseline_performance - replay_performance
        
        # Test without meta-learning
        model_without_meta = model.disable_component('meta_learning')
        meta_performance = await self.evaluate_model(model_without_meta)
        ablation_results['meta_learning_impact'] = baseline_performance - meta_performance
        
        return ablation_results

# Automated benchmark reporting
async def generate_benchmark_report(model: AIModel) -> str:
    runner = BenchmarkRunner()
    metrics = await runner.run_comprehensive_benchmark(model)
    ablation = await runner.run_ablation_study(model)
    
    report = f"""
    # AI Model Performance Report
    
    ## Overall Performance
    - ELO Rating: {metrics.elo_rating:.0f}
    - Win Rate vs Humans: {metrics.win_rate_vs_humans:.1%}
    - Win Rate vs Previous: {metrics.win_rate_vs_previous_version:.1%}
    
    ## Technical Performance
    - Average Thinking Time: {metrics.average_thinking_time:.2f}s
    - Search Speed: {metrics.nodes_per_second:,} nodes/sec
    - Memory Usage: {metrics.memory_usage_mb:.1f} MB
    
    ## Game Understanding
    - Tactical Accuracy: {metrics.tactical_accuracy:.1%}
    - Strategic Understanding: {metrics.strategic_understanding:.1%}
    - Endgame Precision: {metrics.endgame_precision:.1%}
    
    ## Learning Capabilities
    - Sample Efficiency: {metrics.sample_efficiency:.2f}
    - Adaptation Speed: {metrics.adaptation_speed:.2f}
    - Knowledge Retention: {metrics.knowledge_retention:.2f}
    
    ## Component Analysis
    {format_ablation_results(ablation)}
    """
    
    return report
```

## 🧬 Experimental Features

### **Advanced Research Capabilities**

```python
# experimental_features.py
class ExperimentalAI:
    """Cutting-edge AI techniques under development"""
    
    def __init__(self):
        self.curiosity_module = CuriosityDrivenLearning()
        self.causal_reasoner = CausalReasoningEngine()
        self.meta_cognitive = MetaCognitiveAgent()
    
    async def curiosity_driven_exploration(self, position: Position) -> ExplorationResult:
        """AI explores positions based on intrinsic curiosity"""
        novelty_score = self.curiosity_module.compute_novelty(position)
        learning_potential = self.curiosity_module.estimate_learning_value(position)
        
        if novelty_score > self.curiosity_threshold:
            detailed_analysis = await self.deep_analyze_position(position)
            self.curiosity_module.update_world_model(position, detailed_analysis)
            
            return ExplorationResult(
                position=position,
                novelty=novelty_score,
                insights=detailed_analysis.insights,
                world_model_update=detailed_analysis.model_changes
            )
    
    async def causal_game_understanding(self, game_sequence: List[Move]) -> CausalModel:
        """Build causal model of game dynamics"""
        causal_graph = self.causal_reasoner.infer_causal_structure(game_sequence)
        interventions = self.causal_reasoner.plan_interventions(causal_graph)
        
        # Test interventions to understand causality
        intervention_results = []
        for intervention in interventions:
            result = await self.test_intervention(intervention, game_sequence)
            intervention_results.append(result)
        
        refined_model = self.causal_reasoner.update_model(causal_graph, intervention_results)
        return refined_model
    
    def meta_cognitive_monitoring(self, decision_process: DecisionProcess) -> MetaCognition:
        """Monitor and improve AI's thinking process"""
        confidence_assessment = self.meta_cognitive.assess_confidence(decision_process)
        error_prediction = self.meta_cognitive.predict_errors(decision_process)
        
        if confidence_assessment.low_confidence_areas:
            additional_analysis = self.meta_cognitive.request_deeper_analysis(
                decision_process, 
                confidence_assessment.low_confidence_areas
            )
            decision_process = self.meta_cognitive.refine_decision(
                decision_process, 
                additional_analysis
            )
        
        return MetaCognition(
            confidence=confidence_assessment,
            error_prediction=error_prediction,
            refined_decision=decision_process
        )

# Experimental training techniques
class AdvancedTrainingTechniques:
    """Next-generation training methodologies"""
    
    def __init__(self):
        self.curriculum_designer = AutomaticCurriculumDesign()
        self.diversity_optimizer = DiversityOptimizer()
        self.few_shot_learner = FewShotGameLearner()
    
    async def automated_curriculum_learning(self, base_model: AIModel) -> CurriculumResults:
        """Automatically design optimal learning curriculum"""
        
        # Start with current skill assessment
        skill_assessment = await self.assess_current_skills(base_model)
        
        # Design curriculum based on zone of proximal development
        curriculum = self.curriculum_designer.design_curriculum(
            current_skills=skill_assessment,
            target_skills=self.define_target_skills(),
            learning_rate=base_model.learning_rate
        )
        
        # Execute curriculum with continuous adaptation
        results = []
        for stage in curriculum.stages:
            stage_result = await self.execute_curriculum_stage(base_model, stage)
            results.append(stage_result)
            
            # Adapt curriculum based on progress
            if stage_result.progress < stage.expected_progress:
                curriculum = self.curriculum_designer.adapt_curriculum(
                    curriculum, stage_result
                )
        
        return CurriculumResults(results)
    
    async def diversity_driven_training(self, population: List[AIModel]) -> DiversePopulation:
        """Maintain diverse population of AI agents"""
        
        # Measure behavioral diversity
        diversity_metrics = self.diversity_optimizer.measure_diversity(population)
        
        # Identify under-represented behaviors
        diversity_gaps = self.diversity_optimizer.find_gaps(diversity_metrics)
        
        # Evolve population to fill gaps
        new_agents = []
        for gap in diversity_gaps:
            specialized_agent = await self.diversity_optimizer.create_specialist(
                gap, population
            )
            new_agents.append(specialized_agent)
        
        # Combine and select diverse population
        combined_population = population + new_agents
        diverse_population = self.diversity_optimizer.select_diverse_subset(
            combined_population, target_size=len(population)
        )
        
        return DiversePopulation(diverse_population, diversity_metrics)

# Integration with main system
class ExperimentalIntegration:
    """Integration of experimental features with main system"""
    
    def __init__(self, main_ai: UltimateConnect4AI):
        self.main_ai = main_ai
        self.experimental_ai = ExperimentalAI()
        self.advanced_training = AdvancedTrainingTechniques()
    
    async def enhanced_decision_making(self, position: Position) -> EnhancedDecision:
        """Combine standard and experimental approaches"""
        
        # Get standard AI decision
        standard_decision = await self.main_ai.get_best_move(position)
        
        # Apply experimental enhancements
        curiosity_insights = await self.experimental_ai.curiosity_driven_exploration(position)
        meta_cognitive_analysis = self.experimental_ai.meta_cognitive_monitoring(
            standard_decision.decision_process
        )
        
        # Combine insights for enhanced decision
        enhanced_decision = self.combine_insights(
            standard_decision,
            curiosity_insights,
            meta_cognitive_analysis
        )
        
        return enhanced_decision
    
    def enable_experimental_mode(self, features: List[str]):
        """Enable specific experimental features"""
        if 'curiosity_learning' in features:
            self.main_ai.enable_curiosity_module(self.experimental_ai.curiosity_module)
        
        if 'causal_reasoning' in features:
            self.main_ai.enable_causal_reasoning(self.experimental_ai.causal_reasoner)
        
        if 'meta_cognition' in features:
            self.main_ai.enable_meta_cognition(self.experimental_ai.meta_cognitive)

# Usage
experimental_integration = ExperimentalIntegration(ultimate_ai)
experimental_integration.enable_experimental_mode([
    'curiosity_learning', 
    'meta_cognition'
])

enhanced_move = await experimental_integration.enhanced_decision_making(current_position)
```

---

**Ready to challenge an AI that learns from every move? Start training now with `npm run train`!**

This comprehensive documentation provides everything needed to understand, deploy, and extend the Connect Four AI training platform. Whether you're a researcher studying game-playing AI, a developer building intelligent systems, or a player seeking the ultimate challenge, this platform offers cutting-edge capabilities and extensive customization options.
