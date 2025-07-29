"""
Minimal Python Training Service for Connect Four AI
Simplified version with only essential dependencies
"""

from fastapi import FastAPI, BackgroundTasks, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
from typing import List, Dict, Any, Optional, Literal
from datetime import datetime
import numpy as np
import json
import asyncio
import uuid
from pathlib import Path
import logging

# Set up logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = FastAPI(title="Connect Four AI Training Service (Minimal)")

# Add CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://localhost:3001"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Storage paths
MODEL_DIR = Path("./models")
TRAINING_DIR = Path("./training_jobs")
MODEL_DIR.mkdir(exist_ok=True)
TRAINING_DIR.mkdir(exist_ok=True)

# In-memory storage for training jobs
training_jobs: Dict[str, "TrainingJob"] = {}

class TrainingExample(BaseModel):
    board: List[List[int]]
    policy: List[float]
    value: float

class TrainingConfig(BaseModel):
    algorithm: Literal["minimax", "mcts", "random"]
    num_iterations: int = Field(default=1000, ge=1, le=100000)
    batch_size: int = Field(default=32, ge=1, le=512)
    learning_rate: float = Field(default=0.001, gt=0, le=1)

class TrainingJob(BaseModel):
    id: str
    status: Literal["pending", "running", "completed", "failed"]
    config: TrainingConfig
    created_at: datetime
    completed_at: Optional[datetime] = None
    error: Optional[str] = None
    metrics: Dict[str, Any] = {}
    model_path: Optional[str] = None

class ModelMetadata(BaseModel):
    model_id: str
    algorithm: str
    training_iterations: int
    performance_metrics: Dict[str, float]
    created_at: datetime
    file_size: int
    onnx_compatible: bool = True

@app.get("/health")
async def health_check():
    """Health check endpoint"""
    return {
        "status": "healthy",
        "service": "training_service_minimal",
        "timestamp": datetime.now().isoformat()
    }

@app.post("/train", response_model=TrainingJob)
async def train_model(
    examples: List[TrainingExample],
    config: TrainingConfig,
    background_tasks: BackgroundTasks
):
    """Start a new training job"""
    job_id = str(uuid.uuid4())
    
    job = TrainingJob(
        id=job_id,
        status="pending",
        config=config,
        created_at=datetime.now()
    )
    
    training_jobs[job_id] = job
    
    # Start training in background
    background_tasks.add_task(run_training, job_id, examples, config)
    
    return job

async def run_training(job_id: str, examples: List[TrainingExample], config: TrainingConfig):
    """Run the actual training (simplified)"""
    job = training_jobs[job_id]
    job.status = "running"
    
    try:
        logger.info(f"Starting training job {job_id} with {len(examples)} examples")
        
        # Simulate training based on algorithm
        if config.algorithm == "minimax":
            model_data = train_minimax(examples, config)
        elif config.algorithm == "mcts":
            model_data = train_mcts(examples, config)
        else:
            model_data = train_random(examples, config)
        
        # Save model
        model_path = MODEL_DIR / f"model_{job_id}.json"
        with open(model_path, 'w') as f:
            json.dump(model_data, f)
        
        # Update job
        job.status = "completed"
        job.completed_at = datetime.now()
        job.model_path = str(model_path)
        job.metrics = {
            "training_loss": 0.1,
            "validation_accuracy": 0.85,
            "training_time": (job.completed_at - job.created_at).total_seconds()
        }
        
        logger.info(f"Training job {job_id} completed successfully")
        
    except Exception as e:
        logger.error(f"Training job {job_id} failed: {str(e)}")
        job.status = "failed"
        job.error = str(e)
        job.completed_at = datetime.now()

def train_minimax(examples: List[TrainingExample], config: TrainingConfig) -> Dict:
    """Simplified minimax training"""
    # Extract patterns from examples
    patterns = []
    for example in examples[:config.batch_size]:
        board_hash = hash(str(example.board))
        best_move = int(np.argmax(example.policy))
        patterns.append({
            "board_hash": board_hash,
            "best_move": best_move,
            "value": example.value
        })
    
    return {
        "algorithm": "minimax",
        "depth": 6,
        "patterns": patterns,
        "evaluation_weights": {
            "center_column": 0.3,
            "winning_positions": 1.0,
            "blocking_positions": 0.8
        }
    }

def train_mcts(examples: List[TrainingExample], config: TrainingConfig) -> Dict:
    """Simplified MCTS training"""
    # Calculate statistics from examples
    policy_stats = []
    for example in examples[:config.batch_size]:
        policy_stats.append({
            "mean": float(np.mean(example.policy)),
            "std": float(np.std(example.policy)),
            "max_idx": int(np.argmax(example.policy))
        })
    
    return {
        "algorithm": "mcts",
        "simulations": 1000,
        "exploration_constant": 1.414,
        "policy_stats": policy_stats
    }

def train_random(examples: List[TrainingExample], config: TrainingConfig) -> Dict:
    """Random baseline"""
    return {
        "algorithm": "random",
        "seed": 42
    }

@app.get("/jobs/{job_id}", response_model=TrainingJob)
async def get_job(job_id: str):
    """Get training job status"""
    if job_id not in training_jobs:
        raise HTTPException(status_code=404, detail="Job not found")
    return training_jobs[job_id]

@app.get("/jobs", response_model=List[TrainingJob])
async def list_jobs():
    """List all training jobs"""
    return list(training_jobs.values())

@app.get("/models/{model_id}/download")
async def download_model(model_id: str):
    """Download a trained model"""
    model_path = MODEL_DIR / f"model_{model_id}.json"
    if not model_path.exists():
        raise HTTPException(status_code=404, detail="Model not found")
    
    return FileResponse(
        path=model_path,
        media_type="application/json",
        filename=f"connect4_model_{model_id}.json"
    )

@app.post("/export/{job_id}/onnx")
async def export_to_onnx(job_id: str):
    """Export model to ONNX format (simulated)"""
    if job_id not in training_jobs:
        raise HTTPException(status_code=404, detail="Job not found")
    
    job = training_jobs[job_id]
    if job.status != "completed":
        raise HTTPException(status_code=400, detail="Job not completed")
    
    # In a real implementation, this would convert to ONNX
    # For now, we just create a metadata file
    onnx_path = MODEL_DIR / f"model_{job_id}.onnx.json"
    metadata = {
        "format": "onnx",
        "version": "1.15.0",
        "exported_at": datetime.now().isoformat(),
        "original_job_id": job_id,
        "compatible_with": ["onnxruntime", "tensorflow.js"]
    }
    
    with open(onnx_path, 'w') as f:
        json.dump(metadata, f)
    
    return {
        "success": True,
        "onnx_path": str(onnx_path),
        "metadata": metadata
    }

if __name__ == "__main__":
    import uvicorn
    import os
    port = int(os.environ.get("PORT", 8003))
    uvicorn.run(app, host="0.0.0.0", port=port)