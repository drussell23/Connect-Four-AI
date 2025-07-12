# 🧠 Enhanced Connect4 ML Service

**Enterprise-grade machine learning inference service for Connect Four game intelligence**

## 🚀 Overview

This is a significantly enhanced ML service that provides state-of-the-art Connect Four game intelligence with advanced features including:

- **Advanced Neural Networks**: Multi-scale feature extraction, self-attention mechanisms, and uncertainty quantification
- **Multiple Model Types**: Lightweight, standard, heavyweight, and legacy models for different use cases
- **High Performance**: Redis caching, batch processing, and optimized inference
- **Production Ready**: Comprehensive monitoring, rate limiting, authentication, and health checks
- **Robust Architecture**: Error handling, graceful degradation, and comprehensive logging

## 📈 Key Improvements

### Before vs After
- **Before**: Simple 214-line service with basic prediction endpoint
- **After**: Enterprise-grade 1,100+ line service with advanced features

### New Features
- 🎯 **4 Model Types**: Lightweight, standard, heavyweight, legacy
- 🧠 **Advanced Neural Network**: Self-attention, multi-scale features, uncertainty estimation
- 💾 **Smart Caching**: Redis + memory cache with hit rate monitoring
- 📦 **Batch Processing**: Process multiple boards simultaneously
- 📊 **Comprehensive Monitoring**: Prometheus metrics, health checks, performance stats
- 🔒 **Security**: API key authentication, rate limiting, input validation
- 🚀 **Performance**: Optimized inference, model warmup, connection pooling

## 🏗️ Architecture

```
ml_service/
├── ml_service.py         # Main service (1,100+ lines)
├── src/
│   ├── __init__.py      # Model registry and exports
│   └── policy_net.py    # Advanced neural networks (500+ lines)
├── requirements.txt     # Comprehensive dependencies
├── start_service.py     # Enhanced startup script
├── test_service.py      # Comprehensive test suite
└── README.md           # This file
```

## 🎮 Model Types

### 1. Lightweight Model
- **Use case**: Fast inference, mobile/edge deployment
- **Channels**: 64, **Blocks**: 4, **Attention**: 1
- **Features**: Basic CNN + minimal attention

### 2. Standard Model (Default)
- **Use case**: Balanced performance and speed
- **Channels**: 128, **Blocks**: 8, **Attention**: 3
- **Features**: CNN + self-attention + uncertainty estimation

### 3. Heavyweight Model
- **Use case**: Maximum performance, tournament play
- **Channels**: 256, **Blocks**: 16, **Attention**: 6
- **Features**: Full architecture with all advanced features

### 4. Legacy Model
- **Use case**: Backward compatibility
- **Features**: Simple CNN matching original implementation

## 🚀 Quick Start

### 1. Install Dependencies
```bash
pip install -r requirements.txt
```

### 2. Start Development Server
```bash
python start_service.py --dev
```

### 3. Start Production Server
```bash
python start_service.py --api-key your-secret-key
```

### 4. Test the Service
```bash
python start_service.py --test
# OR
python test_service.py
```

## 📝 API Endpoints

### Core Endpoints

#### `POST /predict`
Enhanced prediction with comprehensive features:
```json
{
  "board": [["Empty", "Red", ...], ...],
  "model_type": "standard",
  "include_uncertainty": true,
  "game_id": "optional_game_id"
}
```

**Response:**
```json
{
  "move": 3,
  "probs": [0.1, 0.2, 0.3, 0.4, ...],
  "confidence": 0.85,
  "uncertainty": [0.1, 0.05, ...],
  "value_estimate": 0.23,
  "model_type": "standard",
  "inference_time_ms": 12.5,
  "alternatives": [...],
  "cache_hit": false
}
```

#### `POST /predict/batch`
Batch processing for multiple boards:
```json
{
  "boards": [{"board": [...], ...}, ...],
  "batch_id": "optional_batch_id"
}
```

#### `GET /health`
Comprehensive health check:
```json
{
  "status": "healthy",
  "device": "cuda",
  "models_loaded": ["standard"],
  "memory_usage_mb": 1024.5,
  "cache_hit_rate": 0.85,
  "gpu_info": {...}
}
```

#### `GET /models`
List available models and their capabilities

#### `GET /metrics`
Prometheus metrics endpoint

#### `GET /stats`
Detailed service statistics

## 🔧 Configuration

### Environment Variables
```bash
# Core settings
DEFAULT_MODEL_TYPE=standard
CACHE_TTL=300
MAX_BATCH_SIZE=32

# Security
ENABLE_AUTH=true
API_KEY=your-secure-api-key
RATE_LIMIT_RPM=1000

# Performance
INFERENCE_TIMEOUT=5.0
WARMUP_REQUESTS=10

# Redis caching
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_DB=0
```

### Command Line Options
```bash
# Development mode
python start_service.py --dev

# Production with custom settings
python start_service.py \
  --api-key your-key \
  --model-type heavyweight \
  --workers 4 \
  --redis-host redis.example.com

# High performance mode
python start_service.py \
  --model-type heavyweight \
  --workers 8 \
  --cache-ttl 600 \
  --max-batch-size 64
```

## 📊 Monitoring & Metrics

### Prometheus Metrics
- **Request metrics**: Count, duration, status codes
- **Model metrics**: Predictions, load times, inference duration
- **Cache metrics**: Hit/miss rates, cache sizes
- **System metrics**: Memory, GPU utilization, connections

### Health Checks
- Model loading status
- Cache connectivity
- Memory usage
- GPU information
- Performance statistics

## 🚀 Performance Features

### Caching Strategy
- **Redis**: Primary cache with TTL
- **Memory**: Fallback local cache
- **Smart Keys**: Content-based cache keys
- **Metrics**: Hit/miss rate tracking

### Optimization
- **Model Warmup**: Pre-load models with dummy requests
- **Batch Processing**: Process multiple boards efficiently
- **Device Selection**: Auto-detect CUDA/MPS/CPU
- **Connection Pooling**: Reuse HTTP connections

## 🔒 Security Features

### Authentication
- **API Key**: Optional authentication
- **Rate Limiting**: Per-client request limits
- **Input Validation**: Comprehensive request validation
- **Trusted Hosts**: Configurable host allowlist

### Error Handling
- **Graceful Degradation**: Fallback mechanisms
- **Comprehensive Logging**: Structured logging with context
- **Exception Handling**: Proper HTTP error responses
- **Timeout Protection**: Request timeout handling

## 🧪 Testing

### Comprehensive Test Suite
```bash
python test_service.py
```

**Tests include:**
- Health check validation
- Basic prediction functionality
- Different model types
- Caching behavior
- Batch processing
- Performance under load
- Error handling

### Test Results
- **Functionality**: All endpoints and features
- **Performance**: Latency, throughput, memory usage
- **Reliability**: Error handling, edge cases
- **Caching**: Hit rates, speedup measurements

## 📈 Usage Examples

### Basic Usage
```python
import httpx

async with httpx.AsyncClient() as client:
    response = await client.post(
        "http://localhost:8001/predict",
        json={
            "board": [["Empty" for _ in range(7)] for _ in range(6)],
            "model_type": "standard"
        }
    )
    prediction = response.json()
    print(f"Recommended move: {prediction['move']}")
```

### Batch Processing
```python
boards = [
    {"board": board1, "game_id": "game1"},
    {"board": board2, "game_id": "game2"},
    # ... more boards
]

response = await client.post(
    "http://localhost:8001/predict/batch",
    json={"boards": boards}
)
```

### Health Monitoring
```python
health = await client.get("http://localhost:8001/health")
print(f"Status: {health.json()['status']}")
print(f"Models: {health.json()['models_loaded']}")
```

## 🔧 Integration

### Backend Integration
The service is designed to integrate seamlessly with the existing Node.js backend:

```typescript
// In game-ai.service.ts
const response = await this.httpClient.post('/predict', {
  board: boardState,
  model_type: 'standard',
  include_uncertainty: true
});
```

### Docker Deployment
```dockerfile
FROM python:3.9-slim

WORKDIR /app
COPY requirements.txt .
RUN pip install -r requirements.txt

COPY . .
EXPOSE 8001

CMD ["python", "start_service.py", "--api-key", "$API_KEY"]
```

## 📚 API Documentation

Once running, visit:
- **Interactive docs**: http://localhost:8001/docs
- **ReDoc**: http://localhost:8001/redoc
- **OpenAPI spec**: http://localhost:8001/openapi.json

## 🎯 Next Steps

1. **Install dependencies**: `pip install -r requirements.txt`
2. **Start service**: `python start_service.py --dev`
3. **Run tests**: `python test_service.py`
4. **Check docs**: Visit http://localhost:8001/docs
5. **Monitor metrics**: Visit http://localhost:8001/metrics

## 📄 License

This enhanced ML service is part of the Connect4 game project and follows the same license terms. 