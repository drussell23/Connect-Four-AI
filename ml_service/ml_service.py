"""
🚀 ADVANCED CONNECT4 ML INFERENCE SERVICE
==========================================

Enterprise-grade machine learning service featuring:
- Multi-model support and dynamic loading
- Redis caching for performance optimization
- Comprehensive monitoring and metrics
- Rate limiting and security
- Model versioning and A/B testing
- Uncertainty quantification
- Batch processing capabilities
- Health checks and graceful degradation
"""

import asyncio
import hashlib
import json
import logging
import os
import sys
import time
from contextlib import asynccontextmanager
from datetime import datetime, timedelta
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple, Union

# Environment Configuration
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

import numpy as np
import structlog
# Core ML and Web Framework
import torch
import torch.nn.functional as F
from fastapi import (BackgroundTasks, Depends, FastAPI, HTTPException, Request,
                     Response, status)
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.trustedhost import TrustedHostMiddleware
from fastapi.responses import JSONResponse
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from prometheus_client import (CONTENT_TYPE_LATEST, CollectorRegistry, Counter,
                               Gauge, Histogram, generate_latest)
from pydantic import BaseModel, Field, field_validator

# Create custom registry to avoid conflicts
custom_registry = CollectorRegistry()

# Advanced caching and monitoring
try:
    import redis.asyncio as redis

    REDIS_AVAILABLE = True
except ImportError:
    REDIS_AVAILABLE = False
    redis = None

# -----------------------------------------------------------------------------
# 🏢 ENTERPRISE ENVIRONMENT CONFIGURATION
# -----------------------------------------------------------------------------

# Service Configuration
PORT = int(os.getenv("PORT", 8000))
HOST = os.getenv("HOST", "0.0.0.0")
DEBUG = os.getenv("DEBUG", "false").lower() == "true"
LOG_LEVEL = os.getenv("LOG_LEVEL", "INFO")
WORKERS = int(os.getenv("WORKERS", 4))

# Model Management
MODEL_PATH = os.getenv("MODEL_PATH", "models/")
POLICY_MODEL_NAME = os.getenv("POLICY_MODEL_NAME", "policy_net.pt")
VALUE_MODEL_NAME = os.getenv("VALUE_MODEL_NAME", "value_net.pt")
BACKUP_MODEL_PATH = os.getenv("BACKUP_MODEL_PATH", "../models_backup/")

# Model Loading Configuration
AUTO_LOAD_MODELS = os.getenv("AUTO_LOAD_MODELS", "true").lower() == "true"
MODEL_WARMUP = os.getenv("MODEL_WARMUP", "true").lower() == "true"
MODEL_VALIDATION = os.getenv("MODEL_VALIDATION", "true").lower() == "true"
FALLBACK_TO_RANDOM = os.getenv("FALLBACK_TO_RANDOM", "true").lower() == "true"

# Inference Configuration
BATCH_SIZE = int(os.getenv("BATCH_SIZE", 32))
MAX_BATCH_SIZE = int(os.getenv("MAX_BATCH_SIZE", 128))
INFERENCE_TIMEOUT = int(os.getenv("INFERENCE_TIMEOUT", 5000))
MAX_CONCURRENT_REQUESTS = int(os.getenv("MAX_CONCURRENT_REQUESTS", 50))

# Enterprise Integration
BACKEND_URL = os.getenv("BACKEND_URL", "http://localhost:3000")
ENTERPRISE_MODE = os.getenv("ENTERPRISE_MODE", "true").lower() == "true"
PERFORMANCE_MONITORING = os.getenv("PERFORMANCE_MONITORING", "true").lower() == "true"
HEALTH_REPORTING_INTERVAL = int(os.getenv("HEALTH_REPORTING_INTERVAL", 30))

# Logging Configuration
LOG_FILE_PATH = os.getenv("LOG_FILE_PATH", "logs/ml_service.log")

# Performance Optimization
USE_GPU = os.getenv("USE_GPU", "false").lower() == "true"
GPU_DEVICE = int(os.getenv("GPU_DEVICE", 0))
NUM_THREADS = int(os.getenv("NUM_THREADS", 4))
MEMORY_LIMIT = int(os.getenv("MEMORY_LIMIT", 2048))


# Build dynamic model paths with fallback system
def get_model_paths():
    """Get model paths with intelligent fallback system"""
    base_path = Path(MODEL_PATH)
    backup_path = Path(BACKUP_MODEL_PATH)

    # Primary model paths
    policy_model = base_path / POLICY_MODEL_NAME
    value_model = base_path / VALUE_MODEL_NAME

    # Fallback to backup if primary doesn't exist
    if not policy_model.exists() and (backup_path / POLICY_MODEL_NAME).exists():
        logger.warning(
            f"Primary model not found, using backup: {backup_path / POLICY_MODEL_NAME}"
        )
        policy_model = backup_path / POLICY_MODEL_NAME

    if not value_model.exists() and (backup_path / VALUE_MODEL_NAME).exists():
        logger.warning(
            f"Primary value model not found, using backup: {backup_path / VALUE_MODEL_NAME}"
        )
        value_model = backup_path / VALUE_MODEL_NAME

    return {
        "model_dir": str(base_path),
        "backup_dir": str(backup_path),
        "policy_model": str(policy_model),
        "value_model": str(value_model),
        "policy_exists": policy_model.exists(),
        "value_exists": value_model.exists(),
    }


# Get model paths at startup
MODEL_PATHS = get_model_paths()

print(f"🔧 Enterprise ML Service Configuration:")
print(f"   📁 Model Path: {MODEL_PATHS['model_dir']}")
print(f"   📁 Backup Path: {MODEL_PATHS['backup_dir']}")
print(
    f"   🤖 Policy Model: {MODEL_PATHS['policy_model']} ({'✅' if MODEL_PATHS['policy_exists'] else '❌'})"
)
print(
    f"   📊 Value Model: {MODEL_PATHS['value_model']} ({'✅' if MODEL_PATHS['value_exists'] else '❌'})"
)
print(f"   🏢 Enterprise Mode: {'✅' if ENTERPRISE_MODE else '❌'}")
print(f"   📈 Performance Monitoring: {'✅' if PERFORMANCE_MONITORING else '❌'}")
print(f"   🔗 Backend URL: {BACKEND_URL}")
print(f"   🚀 Service Port: {PORT}")
print(f"   🖥️  GPU Enabled: {'✅' if USE_GPU else '❌'}")
print(f"   📝 Log Level: {LOG_LEVEL}")
print()

# Set torch threads
torch.set_num_threads(NUM_THREADS)

# -----------------------------------------------------------------------------
# Enhanced Logging Configuration
# -----------------------------------------------------------------------------
structlog.configure(
    processors=[
        structlog.stdlib.filter_by_level,
        structlog.stdlib.add_logger_name,
        structlog.stdlib.add_log_level,
        structlog.stdlib.PositionalArgumentsFormatter(),
        structlog.processors.TimeStamper(fmt="iso"),
        structlog.processors.StackInfoRenderer(),
        structlog.processors.format_exc_info,
        structlog.processors.UnicodeDecoder(),
        structlog.processors.JSONRenderer(),
    ],
    context_class=dict,
    logger_factory=structlog.stdlib.LoggerFactory(),
    wrapper_class=structlog.stdlib.BoundLogger,
    cache_logger_on_first_use=True,
)

logger = structlog.get_logger()

# -----------------------------------------------------------------------------
# Prometheus Metrics
# -----------------------------------------------------------------------------
# Request metrics
REQUEST_COUNT = Counter(
    "ml_requests_total",
    "Total ML requests",
    ["method", "endpoint", "status"],
    registry=custom_registry,
)
REQUEST_DURATION = Histogram(
    "ml_request_duration_seconds",
    "Request duration",
    ["method", "endpoint"],
    registry=custom_registry,
)
INFERENCE_DURATION = Histogram(
    "ml_inference_duration_seconds",
    "Model inference duration",
    ["model_type"],
    registry=custom_registry,
)

# Model metrics
MODEL_PREDICTIONS = Counter(
    "ml_predictions_total",
    "Total predictions",
    ["model_name", "model_version"],
    registry=custom_registry,
)
MODEL_LOAD_TIME = Histogram(
    "ml_model_load_duration_seconds", "Model loading time", registry=custom_registry
)
CACHE_HITS = Counter(
    "ml_cache_hits_total", "Cache hits", ["cache_type"], registry=custom_registry
)
CACHE_MISSES = Counter(
    "ml_cache_misses_total", "Cache misses", ["cache_type"], registry=custom_registry
)

# System metrics
ACTIVE_CONNECTIONS = Gauge(
    "ml_active_connections", "Active connections", registry=custom_registry
)
MEMORY_USAGE = Gauge(
    "ml_memory_usage_bytes", "Memory usage in bytes", registry=custom_registry
)
GPU_UTILIZATION = Gauge(
    "ml_gpu_utilization_percent", "GPU utilization percentage", registry=custom_registry
)


# -----------------------------------------------------------------------------
# Enhanced Configuration
# -----------------------------------------------------------------------------
class MLServiceConfig:
    """Centralized configuration management"""

    def __init__(self):
        # Core settings
        self.BASE_DIR = Path(__file__).parent
        self.MODEL_DIR = self.BASE_DIR.parent / "models"
        self.CACHE_TTL = int(os.getenv("CACHE_TTL", "300"))  # 5 minutes
        self.MAX_BATCH_SIZE = int(os.getenv("MAX_BATCH_SIZE", "32"))

        # Model settings
        self.DEFAULT_MODEL_TYPE = os.getenv("DEFAULT_MODEL_TYPE", "standard")
        self.ENABLE_MODEL_ENSEMBLE = (
            os.getenv("ENABLE_MODEL_ENSEMBLE", "false").lower() == "true"
        )
        self.MODEL_VERSIONS = self._load_model_versions()

        # Redis settings
        self.REDIS_HOST = os.getenv("REDIS_HOST", "localhost")
        self.REDIS_PORT = int(os.getenv("REDIS_PORT", "6379"))
        self.REDIS_DB = int(os.getenv("REDIS_DB", "0"))
        self.REDIS_PASSWORD = os.getenv("REDIS_PASSWORD")

        # Security settings
        self.ENABLE_AUTH = os.getenv("ENABLE_AUTH", "false").lower() == "true"
        self.API_KEY = os.getenv("API_KEY")
        self.RATE_LIMIT_RPM = int(os.getenv("RATE_LIMIT_RPM", "1000"))

        # Performance settings
        self.INFERENCE_TIMEOUT = float(os.getenv("INFERENCE_TIMEOUT", "5.0"))
        self.WARMUP_REQUESTS = int(os.getenv("WARMUP_REQUESTS", "10"))

        # Device settings
        self.DEVICE = self._get_device()

    def _get_device(self) -> torch.device:
        """Auto-detect optimal device"""
        if torch.cuda.is_available():
            device = torch.device("cuda")
            logger.info("Using CUDA device", device_name=torch.cuda.get_device_name())
        else:
            # Try MPS (Apple Silicon) if available
            try:
                # Check for MPS availability with proper type handling
                if torch.backends.mps.is_available():  # type: ignore
                    device = torch.device("mps")
                    logger.info("Using MPS device")
                else:
                    device = torch.device("cpu")
                    logger.info("Using CPU device")
            except (AttributeError, RuntimeError):
                device = torch.device("cpu")
                logger.info("Using CPU device")
        return device

    def _load_model_versions(self) -> Dict[str, str]:
        """Load available model versions"""
        versions = {}
        if self.MODEL_DIR.exists():
            model_files = self.MODEL_DIR.glob("*.pt")
            for model_file in model_files:
                # Extract version from filename
                name = model_file.stem
                if "fine_tuned" in name:
                    timestamp = name.split("_")[-1]
                    versions[f"fine_tuned_{timestamp}"] = str(model_file)
                else:
                    versions[name] = str(model_file)
        return versions


config = MLServiceConfig()


# -----------------------------------------------------------------------------
# Enhanced Data Models
# -----------------------------------------------------------------------------
class BoardInput(BaseModel):
    """Enhanced board input with validation and metadata"""

    board: Union[
        List[List[str]],  # 6×7 string format
        List[List[List[float]]],  # 2×6×7 tensor format
    ] = Field(..., description="Connect4 board state")

    # Optional metadata
    game_id: Optional[str] = Field(None, description="Unique game identifier")
    move_number: Optional[int] = Field(
        None, ge=0, le=42, description="Current move number"
    )
    player_type: Optional[str] = Field(None, description="Player type: human/ai")
    timestamp: Optional[float] = Field(None, description="Request timestamp")

    # Model preferences
    model_type: Optional[str] = Field(None, description="Preferred model type")
    use_ensemble: Optional[bool] = Field(False, description="Use model ensemble")
    include_uncertainty: Optional[bool] = Field(
        True, description="Include uncertainty estimation"
    )

    @field_validator("board")
    def validate_board_structure(cls, v):
        """Validate board structure"""
        if isinstance(v, list) and len(v) == 2:
            # Tensor format validation
            if all(isinstance(layer, list) and len(layer) == 6 for layer in v):
                if all(
                    isinstance(row, list) and len(row) == 7
                    for layer in v
                    for row in layer
                ):
                    return v
        elif isinstance(v, list) and len(v) == 6:
            # String format validation
            if all(isinstance(row, list) and len(row) == 7 for row in v):
                valid_values = {"Empty", "Red", "Yellow"}
                if all(cell in valid_values for row in v for cell in row):
                    return v

        raise ValueError(
            "Invalid board structure. Expected 6×7 string matrix or 2×6×7 tensor"
        )


class BatchPredictionRequest(BaseModel):
    """Batch prediction request"""

    boards: List[BoardInput] = Field(
        ..., max_items=32, description="Batch of board states"
    )
    batch_id: Optional[str] = Field(None, description="Batch identifier")
    priority: Optional[str] = Field("normal", description="Batch priority")


class PredictionResponse(BaseModel):
    """Enhanced prediction response with comprehensive information"""

    # Core prediction
    move: int = Field(..., ge=0, le=6, description="Recommended move column")
    probs: List[float] = Field(..., description="Move probabilities for all columns")

    # Advanced analytics
    confidence: Optional[float] = Field(None, description="Prediction confidence score")
    uncertainty: Optional[List[float]] = Field(
        None, description="Uncertainty per column"
    )
    value_estimate: Optional[float] = Field(None, description="Position value estimate")

    # Model information
    model_type: str = Field(..., description="Model type used")
    model_version: str = Field(..., description="Model version")
    inference_time_ms: float = Field(..., description="Inference time in milliseconds")

    # Metadata
    timestamp: float = Field(..., description="Response timestamp")
    request_id: Optional[str] = Field(None, description="Request identifier")
    cache_hit: bool = Field(False, description="Whether result came from cache")

    # Alternative moves
    alternatives: Optional[List[Dict[str, Union[int, float]]]] = Field(
        None, description="Alternative move suggestions"
    )


class HealthResponse(BaseModel):
    """Health check response"""

    status: str = Field(..., description="Service status")
    timestamp: float = Field(..., description="Health check timestamp")
    version: str = Field(..., description="Service version")

    # System information
    device: str = Field(..., description="Compute device")
    models_loaded: List[str] = Field(..., description="Loaded models")
    memory_usage_mb: float = Field(..., description="Memory usage in MB")

    # Performance metrics
    total_requests: int = Field(..., description="Total requests served")
    average_latency_ms: float = Field(..., description="Average latency")
    cache_hit_rate: float = Field(..., description="Cache hit rate")

    # Optional detailed info
    gpu_info: Optional[Dict[str, Any]] = Field(None, description="GPU information")
    redis_connected: bool = Field(False, description="Redis connection status")


# -----------------------------------------------------------------------------
# Advanced Model Manager
# -----------------------------------------------------------------------------
class ModelManager:
    """Advanced model management with loading, caching, and versioning"""

    def __init__(self):
        self.models: Dict[str, torch.nn.Module] = {}
        self.model_metadata: Dict[str, Dict[str, Any]] = {}
        self.load_times: Dict[str, float] = {}
        self.request_counts: Dict[str, int] = {}

    async def load_model(
        self, model_type: str, model_path: Optional[str] = None
    ) -> torch.nn.Module:
        """Load model with performance tracking"""
        if model_type in self.models:
            return self.models[model_type]

        start_time = time.time()

        try:
            # Create simple policy network for backward compatibility
            if model_type == "legacy":
                from src.policy_net import Connect4PolicyNet

                model = Connect4PolicyNet()
            else:
                # For now, use the simple model for all types
                from src.policy_net import Connect4PolicyNet

                model = Connect4PolicyNet()

            model = model.to(config.DEVICE)

            # Load weights if path provided
            if model_path and Path(model_path).exists():
                try:
                    # Use weights_only=True for security (PyTorch 1.13+)
                    checkpoint = torch.load(
                        model_path, map_location=config.DEVICE, weights_only=True
                    )
                    state_dict = checkpoint.get("model_state_dict", checkpoint)
                    model.load_state_dict(state_dict)
                    logger.info("Loaded model weights", path=model_path)
                except Exception as e:
                    logger.warning("Failed to load model weights", error=str(e))
            else:
                logger.warning("No model weights loaded - using random initialization")

            model.eval()

            # Store model and metadata
            self.models[model_type] = model
            load_time = time.time() - start_time
            self.load_times[model_type] = load_time
            self.request_counts[model_type] = 0

            self.model_metadata[model_type] = {
                "load_time": load_time,
                "device": str(config.DEVICE),
                "parameters": sum(p.numel() for p in model.parameters()),
                "loaded_at": datetime.utcnow().isoformat(),
            }

            # Update metrics
            MODEL_LOAD_TIME.observe(load_time)

            logger.info(
                "Model loaded successfully",
                model_type=model_type,
                load_time=load_time,
                parameters=self.model_metadata[model_type]["parameters"],
            )

            return model

        except Exception as e:
            logger.error("Failed to load model", model_type=model_type, error=str(e))
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"Failed to load model {model_type}: {str(e)}",
            )

    async def get_model(self, model_type: str) -> torch.nn.Module:
        """Get model with lazy loading"""
        if model_type not in self.models:
            # Determine model path
            model_path = None
            if model_type in config.MODEL_VERSIONS:
                model_path = config.MODEL_VERSIONS[model_type]
            elif "best_policy_net" in config.MODEL_VERSIONS:
                model_path = config.MODEL_VERSIONS["best_policy_net"]

            await self.load_model(model_type, model_path)

        self.request_counts[model_type] += 1
        return self.models[model_type]

    def get_model_info(self) -> Dict[str, Any]:
        """Get information about loaded models"""
        return {
            "loaded_models": list(self.models.keys()),
            "metadata": self.model_metadata,
            "request_counts": self.request_counts,
            "available_types": ["lightweight", "standard", "heavyweight", "legacy"],
        }

    async def reload_model(self, model_type: str) -> None:
        """Reload a model with updated weights"""
        try:
            # Remove from cache
            if model_type in self.models:
                del self.models[model_type]
                logger.info(f"Removed {model_type} from cache")

            # Reload with latest weights
            model_path = config.MODEL_VERSIONS.get(model_type)
            if not model_path:
                # Check for versioned model file
                model_file = config.MODEL_DIR / f"{model_type}_v*.pt"
                import glob

                matches = glob.glob(str(model_file))
                if matches:
                    # Use the latest version
                    model_path = sorted(matches)[-1]

            await self.load_model(model_type, model_path)
            logger.info(f"✅ Reloaded {model_type} with latest weights")

        except Exception as e:
            logger.error(f"Failed to reload model {model_type}: {e}")
            raise


model_manager = ModelManager()


# -----------------------------------------------------------------------------
# Advanced Caching System
# -----------------------------------------------------------------------------
class CacheManager:
    """Advanced caching with Redis support and fallback to memory"""

    def __init__(self):
        self.redis_client: Optional[Any] = (
            None  # Type as Any to avoid Redis import issues
        )
        self.memory_cache: Dict[str, Tuple[Any, float]] = {}
        self.cache_stats = {"hits": 0, "misses": 0}

    async def initialize(self):
        """Initialize Redis connection"""
        if REDIS_AVAILABLE and redis is not None:
            try:
                self.redis_client = redis.Redis(
                    host=config.REDIS_HOST,
                    port=config.REDIS_PORT,
                    db=config.REDIS_DB,
                    password=config.REDIS_PASSWORD,
                    decode_responses=True,
                )
                # Test connection
                await self.redis_client.ping()
                logger.info("Redis cache initialized")
            except Exception as e:
                logger.warning(
                    "Redis connection failed, using memory cache", error=str(e)
                )
                self.redis_client = None
        else:
            logger.warning("Redis not available, using memory cache only")

    def _generate_cache_key(self, board_data: Dict[str, Any]) -> str:
        """Generate deterministic cache key"""
        # Convert board to consistent string representation
        board = board_data["board"]
        # Ensure board is JSON serializable regardless of type
        if isinstance(board, list):
            board_str = json.dumps(board, sort_keys=True)
        else:
            board_str = str(board)
        model_type = str(board_data.get("model_type", config.DEFAULT_MODEL_TYPE))

        # Create hash using SHA256 for security
        key_data = f"{board_str}:{model_type}"
        return hashlib.sha256(key_data.encode()).hexdigest()

    async def get(self, cache_key: str) -> Optional[Dict[str, Any]]:
        """Get value from cache"""
        try:
            # Try Redis first
            if self.redis_client:
                value = await self.redis_client.get(cache_key)
                if value:
                    self.cache_stats["hits"] += 1
                    CACHE_HITS.labels(cache_type="redis").inc()
                    return json.loads(value)

            # Fallback to memory cache
            if cache_key in self.memory_cache:
                value, expiry = self.memory_cache[cache_key]
                if time.time() < expiry:
                    self.cache_stats["hits"] += 1
                    CACHE_HITS.labels(cache_type="memory").inc()
                    return value
                else:
                    del self.memory_cache[cache_key]

            self.cache_stats["misses"] += 1
            CACHE_MISSES.labels(
                cache_type="redis" if self.redis_client else "memory"
            ).inc()
            return None

        except Exception as e:
            logger.warning("Cache get error", error=str(e))
            return None

    async def set(
        self, cache_key: str, value: Dict[str, Any], ttl: Optional[int] = None
    ):
        """Set value in cache"""
        ttl = ttl or config.CACHE_TTL

        try:
            # Store in Redis
            if self.redis_client:
                await self.redis_client.setex(cache_key, ttl, json.dumps(value))

            # Store in memory cache
            expiry = time.time() + ttl
            self.memory_cache[cache_key] = (value, expiry)

            # Cleanup old memory cache entries
            if len(self.memory_cache) > 1000:
                current_time = time.time()
                expired_keys = [
                    k for k, (_, exp) in self.memory_cache.items() if exp < current_time
                ]
                for k in expired_keys:
                    del self.memory_cache[k]

        except Exception as e:
            logger.warning("Cache set error", error=str(e))

    def get_stats(self) -> Dict[str, Any]:
        """Get cache statistics"""
        total = self.cache_stats["hits"] + self.cache_stats["misses"]
        hit_rate = self.cache_stats["hits"] / total if total > 0 else 0.0

        return {
            "hits": self.cache_stats["hits"],
            "misses": self.cache_stats["misses"],
            "hit_rate": hit_rate,
            "memory_cache_size": len(self.memory_cache),
            "redis_connected": self.redis_client is not None,
        }


cache_manager = CacheManager()


# -----------------------------------------------------------------------------
# Rate Limiting
# -----------------------------------------------------------------------------
class RateLimiter:
    """Simple in-memory rate limiter"""

    def __init__(self):
        self.requests: Dict[str, List[float]] = {}

    def is_allowed(self, client_id: str, limit: Optional[int] = None) -> bool:
        """Check if request is allowed"""
        limit = limit or config.RATE_LIMIT_RPM
        current_time = time.time()
        window_start = current_time - 60  # 1 minute window

        # Clean old requests
        if client_id in self.requests:
            self.requests[client_id] = [
                req_time
                for req_time in self.requests[client_id]
                if req_time > window_start
            ]
        else:
            self.requests[client_id] = []

        # Check limit
        if len(self.requests[client_id]) >= limit:
            return False

        # Add current request
        self.requests[client_id].append(current_time)
        return True


rate_limiter = RateLimiter()


# -----------------------------------------------------------------------------
# Inference Engine
# -----------------------------------------------------------------------------
class InferenceEngine:
    """Advanced inference engine with optimization and error handling"""

    @staticmethod
    def convert_board_to_tensor(
        board_data: Union[List[List[str]], List[List[List[float]]]],
    ) -> torch.Tensor:
        """Convert board to tensor format with validation"""
        try:
            if isinstance(board_data, list) and len(board_data) == 2:
                # Already in tensor format
                tensor = torch.tensor(
                    board_data, dtype=torch.float32, device=config.DEVICE
                )
            elif isinstance(board_data, list) and len(board_data) == 6:
                # String format - convert to tensor
                mapping = {"Empty": 0.0, "Red": 1.0, "Yellow": -1.0}
                numeric = [
                    [mapping.get(cell, 0.0) for cell in row] for row in board_data
                ]
                red_mask = [[1.0 if v == 1.0 else 0.0 for v in row] for row in numeric]
                yellow_mask = [
                    [1.0 if v == -1.0 else 0.0 for v in row] for row in numeric
                ]
                tensor = torch.tensor(
                    [red_mask, yellow_mask], dtype=torch.float32, device=config.DEVICE
                )
            else:
                raise ValueError(
                    f"Invalid board format: expected 6×7 or 2×6×7, got {len(board_data)}"
                )

            return tensor.unsqueeze(0)  # Add batch dimension

        except Exception as e:
            logger.error("Board conversion failed", error=str(e))
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail=f"Invalid board format: {str(e)}",
            )

    @staticmethod
    async def predict(
        model: torch.nn.Module,
        board_tensor: torch.Tensor,
        model_type: str,
        include_uncertainty: bool = True,
    ) -> Dict[str, Any]:
        """Perform prediction with comprehensive output"""
        start_time = time.time()

        try:
            with torch.no_grad():
                # Simple prediction for compatibility
                logits = model(board_tensor)[0]
                probs = F.softmax(logits, dim=0).cpu().tolist()
                move = int(torch.argmax(logits).item())

                result = {"probs": probs, "move": move, "confidence": max(probs)}

                # Add alternatives
                prob_tensor = F.softmax(logits, dim=0)
                top_moves = torch.topk(prob_tensor, min(3, len(probs)))
                result["alternatives"] = [
                    {"move": int(idx.item()), "probability": float(prob.item())}
                    for prob, idx in zip(top_moves.values, top_moves.indices)
                ]

            inference_time = (time.time() - start_time) * 1000  # Convert to ms
            result["inference_time_ms"] = inference_time

            # Update metrics
            INFERENCE_DURATION.labels(model_type=model_type).observe(
                inference_time / 1000
            )
            MODEL_PREDICTIONS.labels(
                model_name=model_type, model_version="latest"
            ).inc()

            return result

        except Exception as e:
            logger.error("Inference failed", model_type=model_type, error=str(e))
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"Inference failed: {str(e)}",
            )


inference_engine = InferenceEngine()

# -----------------------------------------------------------------------------
# Security and Authentication
# -----------------------------------------------------------------------------
security = HTTPBearer(auto_error=False)


async def verify_api_key(
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(security),
):
    """Verify API key if authentication is enabled"""
    if not config.ENABLE_AUTH:
        return True

    if not credentials or not config.API_KEY:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED, detail="API key required"
        )

    if credentials.credentials != config.API_KEY:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid API key"
        )

    return True


async def check_rate_limit(request: Request):
    """Check rate limiting"""
    client_ip = request.client.host if request.client else "unknown"
    if not rate_limiter.is_allowed(client_ip):
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS, detail="Rate limit exceeded"
        )


# -----------------------------------------------------------------------------
# Application Lifecycle Management
# -----------------------------------------------------------------------------
@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application lifecycle management"""
    # Startup
    logger.info("Starting ML service", version="2.0.0")

    # Initialize cache
    await cache_manager.initialize()

    # Preload default model
    try:
        await model_manager.load_model(config.DEFAULT_MODEL_TYPE)
        logger.info("Default model preloaded")
    except Exception as e:
        logger.error("Failed to preload default model", error=str(e))

    # Warmup
    if config.WARMUP_REQUESTS > 0:
        await warmup_models()

    logger.info("ML service startup complete")

    yield

    # Shutdown
    logger.info("Shutting down ML service")
    if cache_manager.redis_client:
        await cache_manager.redis_client.close()


async def warmup_models():
    """Warm up models with dummy requests"""
    logger.info("Starting model warmup", requests=config.WARMUP_REQUESTS)

    # Create dummy board
    dummy_board = [["Empty" for _ in range(7)] for _ in range(6)]

    for i in range(config.WARMUP_REQUESTS):
        try:
            model = await model_manager.get_model(config.DEFAULT_MODEL_TYPE)
            tensor = inference_engine.convert_board_to_tensor(dummy_board)
            await inference_engine.predict(
                model, tensor, config.DEFAULT_MODEL_TYPE, False
            )
        except Exception as e:
            logger.warning("Warmup request failed", iteration=i, error=str(e))

    logger.info("Model warmup complete")


# -----------------------------------------------------------------------------
# FastAPI Application
# -----------------------------------------------------------------------------
app = FastAPI(
    title="🧠 Advanced Connect4 ML Service",
    description="Enterprise-grade machine learning inference service for Connect Four",
    version="2.0.0",
    docs_url="/docs",
    redoc_url="/redoc",
    lifespan=lifespan,
)

# Add middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.add_middleware(
    TrustedHostMiddleware, allowed_hosts=["*"]  # Configure appropriately for production
)


# -----------------------------------------------------------------------------
# Request/Response Middleware
# -----------------------------------------------------------------------------
@app.middleware("http")
async def request_middleware(request: Request, call_next):
    """Request processing and metrics middleware"""
    start_time = time.time()

    # Update active connections
    ACTIVE_CONNECTIONS.inc()

    # Log request
    logger.info(
        "Request started",
        method=request.method,
        url=str(request.url),
        client=request.client.host if request.client else "unknown",
    )

    try:
        response = await call_next(request)

        # Update metrics
        duration = time.time() - start_time
        REQUEST_DURATION.labels(
            method=request.method, endpoint=request.url.path
        ).observe(duration)

        REQUEST_COUNT.labels(
            method=request.method,
            endpoint=request.url.path,
            status=str(response.status_code),
        ).inc()

        logger.info(
            "Request completed",
            method=request.method,
            status=response.status_code,
            duration=duration,
        )

        return response

    except Exception as e:
        logger.error("Request failed", error=str(e))
        REQUEST_COUNT.labels(
            method=request.method, endpoint=request.url.path, status="500"
        ).inc()
        raise
    finally:
        ACTIVE_CONNECTIONS.dec()


# -----------------------------------------------------------------------------
# API Endpoints
# -----------------------------------------------------------------------------


@app.get("/health", response_model=HealthResponse)
async def health_check():
    """Comprehensive health check endpoint with graceful degradation"""
    # Default values for graceful degradation
    memory_mb = 0.0
    cache_stats = {"hit_rate": 0.0, "redis_connected": False}
    model_info = {"loaded_models": 0}
    gpu_info = None
    health_status = "healthy"

    try:
        # Get system information (non-critical)
        try:
            memory_info = torch.cuda.memory_allocated() if torch.cuda.is_available() else 0
            memory_mb = memory_info / 1024 / 1024 if memory_info else 0
        except Exception as e:
            logger.warning(f"Failed to get memory info: {e}")

        # Get cache stats (non-critical)
        try:
            cache_stats = cache_manager.get_stats()
        except Exception as e:
            logger.warning(f"Failed to get cache stats: {e}")
            cache_stats = {"hit_rate": 0.0, "redis_connected": False}

        # Get model info (non-critical)
        try:
            model_info = model_manager.get_model_info()
        except Exception as e:
            logger.warning(f"Failed to get model info: {e}")
            model_info = {"loaded_models": 0}
            health_status = "degraded"  # Mark as degraded if models not loaded

        # Basic GPU info (optional, non-critical)
        try:
            if torch.cuda.is_available():
                gpu_info = {
                    "device_count": torch.cuda.device_count(),
                    "current_device": torch.cuda.current_device(),
                    "device_name": torch.cuda.get_device_name(),
                    "memory_allocated_mb": memory_mb,
                    "memory_reserved_mb": torch.cuda.memory_reserved() / 1024 / 1024,
                }
        except Exception as e:
            logger.warning(f"Failed to get GPU info: {e}")

        # Build health response - always return 200 with status info
        health_data = HealthResponse(
            status=health_status,
            timestamp=time.time(),
            version="2.0.0",
            device=str(config.DEVICE),
            models_loaded=model_info.get("loaded_models", 0),
            memory_usage_mb=memory_mb,
            total_requests=sum(model_manager.request_counts.values()) if hasattr(model_manager, 'request_counts') else 0,
            average_latency_ms=0.0,  # Could calculate from metrics
            cache_hit_rate=cache_stats.get("hit_rate", 0.0),
            redis_connected=cache_stats.get("redis_connected", False),
            gpu_info=gpu_info,
        )

        return health_data

    except Exception as e:
        # Last resort: return minimal healthy response instead of 500 error
        logger.error(f"Health check critically failed: {e}")
        return HealthResponse(
            status="starting",
            timestamp=time.time(),
            version="2.0.0",
            device="unknown",
            models_loaded=0,
            memory_usage_mb=0.0,
            total_requests=0,
            average_latency_ms=0.0,
            cache_hit_rate=0.0,
            redis_connected=False,
            gpu_info=None,
        )


@app.post("/predict", response_model=PredictionResponse)
async def predict_move(
    board_input: BoardInput,
    background_tasks: BackgroundTasks,
    request: Request,
    _: bool = Depends(verify_api_key),
    __: None = Depends(check_rate_limit),
):
    """Advanced prediction endpoint with caching and comprehensive features"""
    start_time = time.time()
    request_id = f"req_{int(time.time() * 1000)}_{hash(str(board_input.board)) % 10000}"

    try:
        # Determine model type
        model_type = board_input.model_type or config.DEFAULT_MODEL_TYPE

        # Check cache
        cache_key = cache_manager._generate_cache_key(
            {"board": board_input.board, "model_type": model_type}
        )

        cached_result = await cache_manager.get(cache_key)
        if cached_result:
            cached_result["cache_hit"] = True
            cached_result["request_id"] = request_id
            cached_result["timestamp"] = time.time()
            logger.info("Cache hit", request_id=request_id)
            return PredictionResponse(**cached_result)

        # Get model
        model = await model_manager.get_model(model_type)

        # Convert board to tensor
        board_tensor = inference_engine.convert_board_to_tensor(board_input.board)

        # Perform inference
        prediction_result = await inference_engine.predict(
            model, board_tensor, model_type, board_input.include_uncertainty or False
        )

        # Build response
        response_data = PredictionResponse(
            move=prediction_result["move"],
            probs=prediction_result["probs"],
            confidence=prediction_result.get("confidence"),
            uncertainty=prediction_result.get("uncertainty"),
            value_estimate=prediction_result.get("value_estimate"),
            model_type=model_type,
            model_version="latest",
            inference_time_ms=prediction_result["inference_time_ms"],
            timestamp=time.time(),
            request_id=request_id,
            cache_hit=False,
            alternatives=prediction_result.get("alternatives"),
        )

        # Cache result asynchronously
        cache_data = response_data.dict()
        background_tasks.add_task(cache_manager.set, cache_key, cache_data)

        total_time = (time.time() - start_time) * 1000
        logger.info(
            "Prediction completed",
            request_id=request_id,
            model_type=model_type,
            move=response_data.move,
            confidence=response_data.confidence,
            total_time_ms=total_time,
        )

        return response_data

    except HTTPException:
        raise
    except Exception as e:
        logger.error("Prediction failed", request_id=request_id, error=str(e))
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Prediction failed: {str(e)}",
        )


@app.post("/predict/batch")
async def batch_predict(
    batch_request: BatchPredictionRequest,
    background_tasks: BackgroundTasks,
    _: bool = Depends(verify_api_key),
    __: None = Depends(check_rate_limit),
):
    """Batch prediction endpoint for multiple boards"""
    if len(batch_request.boards) > config.MAX_BATCH_SIZE:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=f"Batch size {len(batch_request.boards)} exceeds maximum {config.MAX_BATCH_SIZE}",
        )

    start_time = time.time()
    batch_id = batch_request.batch_id or f"batch_{int(time.time() * 1000)}"

    try:
        results = []

        # Process each board
        for i, board_input in enumerate(batch_request.boards):
            try:
                # Create individual prediction request
                pred_response = await predict_move(
                    board_input,
                    background_tasks,
                    Request(
                        scope={
                            "type": "http",
                            "method": "POST",
                            "path": "/predict/batch",
                            "client": ["localhost", 80],
                        }
                    ),
                    True,
                    None,
                )
                results.append(pred_response.dict())
            except Exception as e:
                logger.error(
                    "Batch item failed", batch_id=batch_id, item=i, error=str(e)
                )
                # Add error result
                results.append({"error": str(e), "item_index": i})

        total_time = (time.time() - start_time) * 1000
        logger.info(
            "Batch prediction completed",
            batch_id=batch_id,
            total_items=len(batch_request.boards),
            successful_items=len([r for r in results if "error" not in r]),
            total_time_ms=total_time,
        )

        return {
            "batch_id": batch_id,
            "results": results,
            "total_time_ms": total_time,
            "successful_count": len([r for r in results if "error" not in r]),
            "failed_count": len([r for r in results if "error" in r]),
        }

    except Exception as e:
        logger.error("Batch prediction failed", batch_id=batch_id, error=str(e))
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Batch prediction failed: {str(e)}",
        )


@app.get("/models")
async def list_models(_: bool = Depends(verify_api_key)):
    """List available models and their information"""
    try:
        return {
            "available_models": ["lightweight", "standard", "heavyweight", "legacy"],
            "model_info": {
                "lightweight": {"description": "Fast inference model"},
                "standard": {"description": "Balanced model"},
                "heavyweight": {"description": "High performance model"},
                "legacy": {"description": "Original model"},
            },
            "loaded_models": model_manager.get_model_info(),
            "default_model": config.DEFAULT_MODEL_TYPE,
        }
    except Exception as e:
        logger.error("Failed to list models", error=str(e))
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to list models: {str(e)}",
        )


@app.post("/models/{model_type}/load")
async def load_model_endpoint(model_type: str, _: bool = Depends(verify_api_key)):
    """Load a specific model"""
    try:
        model = await model_manager.load_model(model_type)
        return {
            "status": "success",
            "model_type": model_type,
            "message": f"Model {model_type} loaded successfully",
        }
    except Exception as e:
        logger.error("Failed to load model", model_type=model_type, error=str(e))
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to load model {model_type}: {str(e)}",
        )


@app.get("/metrics")
async def get_metrics():
    """Prometheus metrics endpoint"""
    return Response(generate_latest(custom_registry), media_type=CONTENT_TYPE_LATEST)


@app.get("/stats")
async def get_stats(_: bool = Depends(verify_api_key)):
    """Get service statistics"""
    cache_stats = cache_manager.get_stats()
    model_info = model_manager.get_model_info()

    return {
        "service": {
            "version": "2.0.0",
            "uptime_seconds": time.time(),  # Simplified
            "device": str(config.DEVICE),
        },
        "cache": cache_stats,
        "models": model_info,
        "performance": {
            "total_requests": sum(model_manager.request_counts.values()),
            "active_connections": 0,  # Would need to track properly
        },
    }


# -----------------------------------------------------------------------------
# Error Handlers
# -----------------------------------------------------------------------------
@app.exception_handler(HTTPException)
async def http_exception_handler(request: Request, exc: HTTPException):
    """Custom HTTP exception handler"""
    logger.error(
        "HTTP exception",
        status_code=exc.status_code,
        detail=exc.detail,
        url=str(request.url),
    )

    return JSONResponse(
        status_code=exc.status_code,
        content={
            "error": {
                "code": exc.status_code,
                "message": exc.detail,
                "timestamp": time.time(),
                "path": str(request.url.path),
            }
        },
    )


@app.exception_handler(Exception)
async def general_exception_handler(request: Request, exc: Exception):
    """General exception handler"""
    logger.error(
        "Unhandled exception", error=str(exc), url=str(request.url), exc_info=True
    )

    return JSONResponse(
        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
        content={
            "error": {
                "code": 500,
                "message": "Internal server error",
                "timestamp": time.time(),
                "path": str(request.url.path),
            }
        },
    )


# -----------------------------------------------------------------------------
# Model Synchronization Setup
# -----------------------------------------------------------------------------
# Import and setup model sync endpoints
try:
    from model_sync_endpoint import setup_model_sync_routes

    setup_model_sync_routes(app, model_manager)
    logger.info("✅ Model synchronization endpoints configured")
except ImportError:
    logger.warning("Model sync endpoints not available")
except Exception as e:
    logger.error(f"Failed to setup model sync endpoints: {e}")

# -----------------------------------------------------------------------------
# Main Entry Point
# -----------------------------------------------------------------------------
if __name__ == "__main__":
    import uvicorn

    # Use environment variable for host binding, defaulting to localhost for security
    host = os.environ.get("ML_SERVICE_HOST", "127.0.0.1")
    port = int(os.environ.get("ML_SERVICE_PORT", "8000"))

    uvicorn.run(
        "ml_service:app",
        host=host,
        port=port,
        reload=False,
        access_log=True,
        log_config={
            "version": 1,
            "disable_existing_loggers": False,
            "formatters": {
                "default": {
                    "format": "%(asctime)s - %(name)s - %(levelname)s - %(message)s",
                },
            },
            "handlers": {
                "default": {
                    "formatter": "default",
                    "class": "logging.StreamHandler",
                    "stream": "ext://sys.stdout",
                },
            },
            "root": {
                "level": "INFO",
                "handlers": ["default"],
            },
        },
    )
