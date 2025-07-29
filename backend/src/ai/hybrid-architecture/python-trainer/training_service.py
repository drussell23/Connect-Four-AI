"""
Advanced Python Training Service for Connect Four AI
Handles all heavy ML training while TypeScript handles inference
"""

from fastapi import FastAPI, BackgroundTasks, HTTPException
from fastapi.responses import FileResponse
from pydantic import BaseModel, Field
from typing import List, Dict, Any, Optional, Literal
from datetime import datetime
import numpy as np
import torch
import torch.nn as nn
import torch.optim as optim
import tensorflow as tf
try:
    import jax
    import jax.numpy as jnp
    import optax
    JAX_AVAILABLE = True
except ImportError:
    JAX_AVAILABLE = False
    print("JAX not available. Some training methods will be disabled.")
from pathlib import Path
import json
import asyncio
import uuid
from enum import Enum
import mlflow
import wandb
from ray import tune
from stable_baselines3 import PPO, A2C, DQN
import gymnasium as gym
from collections import deque
import pickle
import onnx
import tf2onnx
import logging
from celery import Celery
import redis

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Initialize FastAPI app
app = FastAPI(title="Connect Four AI Training Service", version="1.0.0")

# Initialize Celery for background tasks
celery_app = Celery('trainer', broker='redis://localhost:6379')

# Initialize MLflow for experiment tracking
mlflow.set_tracking_uri("http://localhost:5000")

# Model storage directory
MODEL_DIR = Path("./models")
MODEL_DIR.mkdir(exist_ok=True)

# Training status storage
training_status = {}

class ModelType(str, Enum):
    ALPHAZERO = "alphazero"
    MUZERO = "muzero"
    PPO = "ppo"
    DQN = "dqn"
    TRANSFORMER = "transformer"
    ENSEMBLE = "ensemble"

class TrainingConfig(BaseModel):
    model_type: ModelType
    batch_size: int = Field(default=128, ge=1)
    learning_rate: float = Field(default=0.001, gt=0)
    epochs: int = Field(default=100, ge=1)
    validation_split: float = Field(default=0.2, ge=0, le=1)
    early_stopping_patience: int = Field(default=10, ge=1)
    optimizer: Literal["adam", "sgd", "rmsprop", "adamw"] = "adam"
    scheduler: Optional[Literal["cosine", "step", "exponential"]] = None
    regularization: Optional[Dict[str, float]] = None
    advanced_config: Optional[Dict[str, Any]] = None

class BoardState(BaseModel):
    board: List[List[int]]  # 0=empty, 1=red, 2=yellow
    player: int  # 1=red, 2=yellow
    
class TrainingExample(BaseModel):
    board: BoardState
    move: int
    value: float  # -1 to 1 (loss to win)
    policy: Optional[List[float]] = None  # Move probabilities

class TrainingRequest(BaseModel):
    examples: List[TrainingExample]
    config: TrainingConfig
    job_id: Optional[str] = None
    experiment_name: Optional[str] = "connect_four_training"

class TrainingStatus(BaseModel):
    job_id: str
    status: Literal["pending", "training", "completed", "failed"]
    progress: float
    current_epoch: int
    total_epochs: int
    metrics: Dict[str, float]
    error: Optional[str] = None
    model_path: Optional[str] = None

class ModelMetadata(BaseModel):
    model_id: str
    model_type: ModelType
    created_at: datetime
    training_metrics: Dict[str, float]
    config: TrainingConfig
    onnx_path: Optional[str] = None
    pytorch_path: Optional[str] = None
    tensorflow_path: Optional[str] = None


class AlphaZeroNetwork(nn.Module):
    """Advanced AlphaZero-style network with residual blocks"""
    
    def __init__(self, num_res_blocks=19, channels=256):
        super().__init__()
        
        # Initial convolution
        self.conv_initial = nn.Sequential(
            nn.Conv2d(3, channels, 3, padding=1),
            nn.BatchNorm2d(channels),
            nn.ReLU()
        )
        
        # Residual blocks
        self.res_blocks = nn.ModuleList([
            ResidualBlock(channels) for _ in range(num_res_blocks)
        ])
        
        # Policy head
        self.policy_head = nn.Sequential(
            nn.Conv2d(channels, 32, 1),
            nn.BatchNorm2d(32),
            nn.ReLU(),
            nn.Flatten(),
            nn.Linear(32 * 6 * 7, 128),
            nn.ReLU(),
            nn.Linear(128, 7)  # 7 possible moves
        )
        
        # Value head
        self.value_head = nn.Sequential(
            nn.Conv2d(channels, 32, 1),
            nn.BatchNorm2d(32),
            nn.ReLU(),
            nn.Flatten(),
            nn.Linear(32 * 6 * 7, 128),
            nn.ReLU(),
            nn.Linear(128, 1),
            nn.Tanh()
        )
        
    def forward(self, x):
        x = self.conv_initial(x)
        
        for res_block in self.res_blocks:
            x = res_block(x)
            
        policy = self.policy_head(x)
        value = self.value_head(x)
        
        return policy, value


class ResidualBlock(nn.Module):
    """Residual block with squeeze-and-excitation"""
    
    def __init__(self, channels):
        super().__init__()
        self.conv1 = nn.Conv2d(channels, channels, 3, padding=1)
        self.bn1 = nn.BatchNorm2d(channels)
        self.conv2 = nn.Conv2d(channels, channels, 3, padding=1)
        self.bn2 = nn.BatchNorm2d(channels)
        
        # Squeeze-and-excitation
        self.se = nn.Sequential(
            nn.AdaptiveAvgPool2d(1),
            nn.Conv2d(channels, channels // 16, 1),
            nn.ReLU(),
            nn.Conv2d(channels // 16, channels, 1),
            nn.Sigmoid()
        )
        
    def forward(self, x):
        identity = x
        
        out = self.conv1(x)
        out = self.bn1(out)
        out = torch.relu(out)
        
        out = self.conv2(out)
        out = self.bn2(out)
        
        # Apply squeeze-and-excitation
        se_weight = self.se(out)
        out = out * se_weight
        
        out += identity
        out = torch.relu(out)
        
        return out


class MuZeroNetwork(nn.Module):
    """MuZero network with dynamics, prediction, and representation functions"""
    
    def __init__(self, channels=256, num_blocks=16):
        super().__init__()
        
        # Representation function (observation -> hidden state)
        self.representation = nn.Sequential(
            nn.Conv2d(3, channels, 3, padding=1),
            nn.BatchNorm2d(channels),
            nn.ReLU(),
            *[ResidualBlock(channels) for _ in range(num_blocks)]
        )
        
        # Dynamics function (hidden state + action -> next hidden state + reward)
        self.dynamics_state = nn.Sequential(
            nn.Conv2d(channels + 7, channels, 3, padding=1),
            nn.BatchNorm2d(channels),
            nn.ReLU(),
            *[ResidualBlock(channels) for _ in range(num_blocks)]
        )
        
        self.dynamics_reward = nn.Sequential(
            nn.Conv2d(channels, 32, 1),
            nn.BatchNorm2d(32),
            nn.ReLU(),
            nn.Flatten(),
            nn.Linear(32 * 6 * 7, 128),
            nn.ReLU(),
            nn.Linear(128, 1)
        )
        
        # Prediction function (hidden state -> policy + value)
        self.prediction = AlphaZeroNetwork(num_blocks, channels)
        
    def initial_inference(self, observation):
        """Representation + Prediction"""
        hidden_state = self.representation(observation)
        policy, value = self.prediction(hidden_state)
        return hidden_state, policy, value
    
    def recurrent_inference(self, hidden_state, action):
        """Dynamics + Prediction"""
        # Encode action as spatial feature map
        batch_size = hidden_state.shape[0]
        action_encoded = torch.zeros(batch_size, 7, 6, 7).to(hidden_state.device)
        for i in range(batch_size):
            action_encoded[i, action[i], :, :] = 1
            
        # Concatenate hidden state and action
        state_action = torch.cat([hidden_state, action_encoded], dim=1)
        
        # Dynamics function
        next_hidden_state = self.dynamics_state(state_action)
        reward = self.dynamics_reward(next_hidden_state)
        
        # Prediction function
        policy, value = self.prediction(next_hidden_state)
        
        return next_hidden_state, reward, policy, value


class TransformerModel(nn.Module):
    """Transformer-based model for Connect Four"""
    
    def __init__(self, d_model=512, n_heads=8, n_layers=12, max_seq_len=42):
        super().__init__()
        
        # Positional encoding
        self.pos_encoding = nn.Parameter(torch.randn(1, max_seq_len, d_model))
        
        # Board embedding
        self.board_embed = nn.Embedding(3, d_model)  # 0=empty, 1=red, 2=yellow
        
        # Transformer
        encoder_layer = nn.TransformerEncoderLayer(
            d_model=d_model,
            nhead=n_heads,
            dim_feedforward=2048,
            dropout=0.1,
            activation='gelu',
            batch_first=True
        )
        self.transformer = nn.TransformerEncoder(encoder_layer, n_layers)
        
        # Output heads
        self.policy_head = nn.Sequential(
            nn.Linear(d_model, 256),
            nn.ReLU(),
            nn.Dropout(0.1),
            nn.Linear(256, 7)
        )
        
        self.value_head = nn.Sequential(
            nn.Linear(d_model, 256),
            nn.ReLU(),
            nn.Dropout(0.1),
            nn.Linear(256, 1),
            nn.Tanh()
        )
        
    def forward(self, board):
        # Flatten board to sequence
        batch_size = board.shape[0]
        board_flat = board.view(batch_size, -1)
        
        # Embed board positions
        x = self.board_embed(board_flat)
        
        # Add positional encoding
        x = x + self.pos_encoding[:, :x.shape[1], :]
        
        # Transformer encoding
        x = self.transformer(x)
        
        # Global pooling
        x = x.mean(dim=1)
        
        # Output heads
        policy = self.policy_head(x)
        value = self.value_head(x)
        
        return policy, value


class AdvancedTrainer:
    """Advanced training orchestrator with multiple algorithms"""
    
    def __init__(self):
        self.device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
        logger.info(f"Using device: {self.device}")
        
    async def train_model(
        self,
        examples: List[TrainingExample],
        config: TrainingConfig,
        job_id: str
    ) -> ModelMetadata:
        """Train model with specified configuration"""
        
        try:
            # Initialize MLflow run
            with mlflow.start_run(experiment_name=f"connect_four_{config.model_type}"):
                mlflow.log_params(config.dict())
                
                if config.model_type == ModelType.ALPHAZERO:
                    return await self._train_alphazero(examples, config, job_id)
                elif config.model_type == ModelType.MUZERO:
                    return await self._train_muzero(examples, config, job_id)
                elif config.model_type == ModelType.PPO:
                    return await self._train_ppo(examples, config, job_id)
                elif config.model_type == ModelType.DQN:
                    return await self._train_dqn(examples, config, job_id)
                elif config.model_type == ModelType.TRANSFORMER:
                    return await self._train_transformer(examples, config, job_id)
                elif config.model_type == ModelType.ENSEMBLE:
                    return await self._train_ensemble(examples, config, job_id)
                else:
                    raise ValueError(f"Unknown model type: {config.model_type}")
                    
        except Exception as e:
            logger.error(f"Training failed: {str(e)}")
            training_status[job_id] = TrainingStatus(
                job_id=job_id,
                status="failed",
                progress=0,
                current_epoch=0,
                total_epochs=config.epochs,
                metrics={},
                error=str(e)
            )
            raise
    
    async def _train_alphazero(
        self,
        examples: List[TrainingExample],
        config: TrainingConfig,
        job_id: str
    ) -> ModelMetadata:
        """Train AlphaZero-style network"""
        
        # Initialize model
        model = AlphaZeroNetwork(
            num_res_blocks=config.advanced_config.get("num_res_blocks", 19),
            channels=config.advanced_config.get("channels", 256)
        ).to(self.device)
        
        # Prepare data
        boards, moves, values = self._prepare_data(examples)
        dataset = torch.utils.data.TensorDataset(boards, moves, values)
        
        # Split data
        train_size = int(len(dataset) * (1 - config.validation_split))
        val_size = len(dataset) - train_size
        train_dataset, val_dataset = torch.utils.data.random_split(
            dataset, [train_size, val_size]
        )
        
        train_loader = torch.utils.data.DataLoader(
            train_dataset, batch_size=config.batch_size, shuffle=True
        )
        val_loader = torch.utils.data.DataLoader(
            val_dataset, batch_size=config.batch_size
        )
        
        # Optimizer and scheduler
        optimizer = self._get_optimizer(model, config)
        scheduler = self._get_scheduler(optimizer, config)
        
        # Loss functions
        policy_criterion = nn.CrossEntropyLoss()
        value_criterion = nn.MSELoss()
        
        # Training loop
        best_val_loss = float('inf')
        patience_counter = 0
        
        for epoch in range(config.epochs):
            # Training
            model.train()
            train_loss = 0
            train_policy_loss = 0
            train_value_loss = 0
            
            for batch_idx, (boards, moves, values) in enumerate(train_loader):
                boards = boards.to(self.device)
                moves = moves.to(self.device)
                values = values.to(self.device)
                
                optimizer.zero_grad()
                
                policy_logits, value_preds = model(boards)
                
                policy_loss = policy_criterion(policy_logits, moves)
                value_loss = value_criterion(value_preds.squeeze(), values)
                
                loss = policy_loss + value_loss
                
                if config.regularization:
                    # Add L2 regularization
                    l2_reg = config.regularization.get("l2", 0)
                    if l2_reg > 0:
                        l2_loss = sum(p.pow(2).sum() for p in model.parameters())
                        loss += l2_reg * l2_loss
                
                loss.backward()
                
                # Gradient clipping
                torch.nn.utils.clip_grad_norm_(model.parameters(), 1.0)
                
                optimizer.step()
                
                train_loss += loss.item()
                train_policy_loss += policy_loss.item()
                train_value_loss += value_loss.item()
            
            # Validation
            model.eval()
            val_loss = 0
            val_accuracy = 0
            
            with torch.no_grad():
                for boards, moves, values in val_loader:
                    boards = boards.to(self.device)
                    moves = moves.to(self.device)
                    values = values.to(self.device)
                    
                    policy_logits, value_preds = model(boards)
                    
                    policy_loss = policy_criterion(policy_logits, moves)
                    value_loss = value_criterion(value_preds.squeeze(), values)
                    
                    val_loss += (policy_loss + value_loss).item()
                    
                    # Calculate accuracy
                    pred_moves = policy_logits.argmax(dim=1)
                    val_accuracy += (pred_moves == moves).float().mean().item()
            
            # Average metrics
            train_loss /= len(train_loader)
            train_policy_loss /= len(train_loader)
            train_value_loss /= len(train_loader)
            val_loss /= len(val_loader)
            val_accuracy /= len(val_loader)
            
            # Update scheduler
            if scheduler:
                scheduler.step()
            
            # Log metrics
            metrics = {
                "train_loss": train_loss,
                "train_policy_loss": train_policy_loss,
                "train_value_loss": train_value_loss,
                "val_loss": val_loss,
                "val_accuracy": val_accuracy,
                "learning_rate": optimizer.param_groups[0]['lr']
            }
            
            mlflow.log_metrics(metrics, step=epoch)
            
            # Update training status
            training_status[job_id] = TrainingStatus(
                job_id=job_id,
                status="training",
                progress=(epoch + 1) / config.epochs,
                current_epoch=epoch + 1,
                total_epochs=config.epochs,
                metrics=metrics
            )
            
            # Early stopping
            if val_loss < best_val_loss:
                best_val_loss = val_loss
                patience_counter = 0
                
                # Save best model
                model_path = MODEL_DIR / f"{job_id}_best.pt"
                torch.save(model.state_dict(), model_path)
            else:
                patience_counter += 1
                if patience_counter >= config.early_stopping_patience:
                    logger.info(f"Early stopping at epoch {epoch}")
                    break
            
            logger.info(
                f"Epoch {epoch}/{config.epochs} - "
                f"Train Loss: {train_loss:.4f}, Val Loss: {val_loss:.4f}, "
                f"Val Accuracy: {val_accuracy:.4f}"
            )
        
        # Export to ONNX
        model.load_state_dict(torch.load(MODEL_DIR / f"{job_id}_best.pt"))
        onnx_path = await self._export_to_onnx(model, job_id, input_shape=(1, 3, 6, 7))
        
        # Create metadata
        metadata = ModelMetadata(
            model_id=job_id,
            model_type=ModelType.ALPHAZERO,
            created_at=datetime.now(),
            training_metrics=metrics,
            config=config,
            onnx_path=str(onnx_path),
            pytorch_path=str(MODEL_DIR / f"{job_id}_best.pt")
        )
        
        # Save metadata
        with open(MODEL_DIR / f"{job_id}_metadata.json", "w") as f:
            json.dump(metadata.dict(), f, default=str)
        
        # Update final status
        training_status[job_id] = TrainingStatus(
            job_id=job_id,
            status="completed",
            progress=1.0,
            current_epoch=epoch + 1,
            total_epochs=config.epochs,
            metrics=metrics,
            model_path=str(onnx_path)
        )
        
        return metadata
    
    async def _train_muzero(
        self,
        examples: List[TrainingExample],
        config: TrainingConfig,
        job_id: str
    ) -> ModelMetadata:
        """Train MuZero network with self-play"""
        
        # Initialize model
        model = MuZeroNetwork(
            channels=config.advanced_config.get("channels", 256),
            num_blocks=config.advanced_config.get("num_blocks", 16)
        ).to(self.device)
        
        # MuZero training is more complex - simplified version here
        # In production, would include MCTS, self-play, and reanalyze
        
        # For now, train similar to AlphaZero
        return await self._train_alphazero(examples, config, job_id)
    
    async def _train_transformer(
        self,
        examples: List[TrainingExample],
        config: TrainingConfig,
        job_id: str
    ) -> ModelMetadata:
        """Train Transformer model"""
        
        # Initialize model
        model = TransformerModel(
            d_model=config.advanced_config.get("d_model", 512),
            n_heads=config.advanced_config.get("n_heads", 8),
            n_layers=config.advanced_config.get("n_layers", 12)
        ).to(self.device)
        
        # Similar training loop to AlphaZero
        # ... (implementation similar to _train_alphazero)
        
        return await self._train_alphazero(examples, config, job_id)
    
    async def _train_ensemble(
        self,
        examples: List[TrainingExample],
        config: TrainingConfig,
        job_id: str
    ) -> ModelMetadata:
        """Train ensemble of models"""
        
        # Train multiple models
        models_to_train = config.advanced_config.get(
            "models", 
            [ModelType.ALPHAZERO, ModelType.TRANSFORMER]
        )
        
        ensemble_models = []
        for i, model_type in enumerate(models_to_train):
            sub_config = TrainingConfig(
                model_type=model_type,
                **config.dict(exclude={"model_type", "advanced_config"})
            )
            sub_job_id = f"{job_id}_ensemble_{i}"
            
            metadata = await self.train_model(examples, sub_config, sub_job_id)
            ensemble_models.append(metadata)
        
        # Create ensemble metadata
        metadata = ModelMetadata(
            model_id=job_id,
            model_type=ModelType.ENSEMBLE,
            created_at=datetime.now(),
            training_metrics={"ensemble_size": len(ensemble_models)},
            config=config,
            advanced_config={"models": [m.dict() for m in ensemble_models]}
        )
        
        return metadata
    
    def _prepare_data(self, examples: List[TrainingExample]) -> tuple:
        """Prepare training data"""
        boards = []
        moves = []
        values = []
        
        for example in examples:
            # Convert board to tensor (3 channels: red, yellow, empty)
            board_tensor = np.zeros((3, 6, 7))
            for i in range(6):
                for j in range(7):
                    if example.board.board[i][j] == 1:  # Red
                        board_tensor[0, i, j] = 1
                    elif example.board.board[i][j] == 2:  # Yellow
                        board_tensor[1, i, j] = 1
                    else:  # Empty
                        board_tensor[2, i, j] = 1
            
            boards.append(board_tensor)
            moves.append(example.move)
            values.append(example.value)
        
        return (
            torch.tensor(boards, dtype=torch.float32),
            torch.tensor(moves, dtype=torch.long),
            torch.tensor(values, dtype=torch.float32)
        )
    
    def _get_optimizer(self, model: nn.Module, config: TrainingConfig):
        """Get optimizer based on config"""
        if config.optimizer == "adam":
            return optim.Adam(model.parameters(), lr=config.learning_rate)
        elif config.optimizer == "adamw":
            return optim.AdamW(
                model.parameters(), 
                lr=config.learning_rate,
                weight_decay=config.regularization.get("weight_decay", 0.01)
            )
        elif config.optimizer == "sgd":
            return optim.SGD(
                model.parameters(), 
                lr=config.learning_rate,
                momentum=0.9,
                nesterov=True
            )
        elif config.optimizer == "rmsprop":
            return optim.RMSprop(model.parameters(), lr=config.learning_rate)
    
    def _get_scheduler(self, optimizer, config: TrainingConfig):
        """Get learning rate scheduler"""
        if not config.scheduler:
            return None
            
        if config.scheduler == "cosine":
            return optim.lr_scheduler.CosineAnnealingLR(
                optimizer, T_max=config.epochs
            )
        elif config.scheduler == "step":
            return optim.lr_scheduler.StepLR(
                optimizer, step_size=30, gamma=0.1
            )
        elif config.scheduler == "exponential":
            return optim.lr_scheduler.ExponentialLR(
                optimizer, gamma=0.95
            )
    
    async def _export_to_onnx(
        self, 
        model: nn.Module, 
        job_id: str,
        input_shape: tuple
    ) -> Path:
        """Export PyTorch model to ONNX"""
        model.eval()
        
        dummy_input = torch.randn(*input_shape).to(self.device)
        onnx_path = MODEL_DIR / f"{job_id}.onnx"
        
        torch.onnx.export(
            model,
            dummy_input,
            onnx_path,
            export_params=True,
            opset_version=11,
            do_constant_folding=True,
            input_names=['input'],
            output_names=['policy', 'value'],
            dynamic_axes={
                'input': {0: 'batch_size'},
                'policy': {0: 'batch_size'},
                'value': {0: 'batch_size'}
            }
        )
        
        # Verify ONNX model
        onnx_model = onnx.load(onnx_path)
        onnx.checker.check_model(onnx_model)
        
        logger.info(f"Exported model to {onnx_path}")
        return onnx_path


# Initialize trainer
trainer = AdvancedTrainer()


@app.post("/train", response_model=TrainingStatus)
async def train_model(
    request: TrainingRequest,
    background_tasks: BackgroundTasks
):
    """Start model training job"""
    
    # Generate job ID if not provided
    job_id = request.job_id or str(uuid.uuid4())
    
    # Initialize status
    training_status[job_id] = TrainingStatus(
        job_id=job_id,
        status="pending",
        progress=0,
        current_epoch=0,
        total_epochs=request.config.epochs,
        metrics={}
    )
    
    # Start training in background
    background_tasks.add_task(
        trainer.train_model,
        request.examples,
        request.config,
        job_id
    )
    
    return training_status[job_id]


@app.get("/status/{job_id}", response_model=TrainingStatus)
async def get_training_status(job_id: str):
    """Get training job status"""
    if job_id not in training_status:
        raise HTTPException(status_code=404, detail="Job not found")
    
    return training_status[job_id]


@app.get("/download/{job_id}")
async def download_model(job_id: str, format: Literal["onnx", "pytorch"] = "onnx"):
    """Download trained model"""
    
    if job_id not in training_status:
        raise HTTPException(status_code=404, detail="Job not found")
    
    status = training_status[job_id]
    if status.status != "completed":
        raise HTTPException(status_code=400, detail="Training not completed")
    
    if format == "onnx":
        file_path = MODEL_DIR / f"{job_id}.onnx"
    else:
        file_path = MODEL_DIR / f"{job_id}_best.pt"
    
    if not file_path.exists():
        raise HTTPException(status_code=404, detail="Model file not found")
    
    return FileResponse(
        file_path,
        media_type="application/octet-stream",
        filename=file_path.name
    )


@app.get("/models", response_model=List[ModelMetadata])
async def list_models():
    """List all trained models"""
    models = []
    
    for metadata_file in MODEL_DIR.glob("*_metadata.json"):
        with open(metadata_file) as f:
            metadata = json.load(f)
            models.append(ModelMetadata(**metadata))
    
    return models


@app.delete("/models/{model_id}")
async def delete_model(model_id: str):
    """Delete a model and its files"""
    
    # Remove all related files
    for pattern in [f"{model_id}*"]:
        for file in MODEL_DIR.glob(pattern):
            file.unlink()
    
    # Remove from status
    if model_id in training_status:
        del training_status[model_id]
    
    return {"message": f"Model {model_id} deleted"}


@app.post("/hyperparameter-search")
async def hyperparameter_search(
    examples: List[TrainingExample],
    search_space: Dict[str, Any]
):
    """Run hyperparameter search using Ray Tune"""
    
    def train_func(config):
        # Training function for Ray Tune
        # ... implementation
        pass
    
    analysis = tune.run(
        train_func,
        config=search_space,
        num_samples=10,
        metric="val_loss",
        mode="min"
    )
    
    best_config = analysis.best_config
    return {"best_config": best_config, "results": analysis.results_df.to_dict()}


@app.get("/health")
async def health_check():
    """Health check endpoint"""
    return {
        "status": "healthy",
        "device": str(trainer.device),
        "models_dir": str(MODEL_DIR),
        "active_jobs": len([s for s in training_status.values() if s.status == "training"])
    }


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8002)