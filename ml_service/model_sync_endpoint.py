"""
🔄 MODEL SYNCHRONIZATION ENDPOINTS
==================================

Adds model synchronization endpoints to the ML service for
real-time model updates across all services.
"""

import json
import logging
from datetime import datetime
from pathlib import Path
from typing import Any, Dict, List, Optional

import torch
from fastapi import APIRouter, BackgroundTasks, HTTPException
from pydantic import BaseModel

logger = logging.getLogger(__name__)

# Create router for model sync endpoints
router = APIRouter(prefix="/models", tags=["Model Synchronization"])


class ModelSyncRequest(BaseModel):
    """Request for model synchronization"""

    modelType: str
    version: str
    weights: Optional[Dict[str, Any]] = None
    metadata: Optional[Dict[str, Any]] = None
    timestamp: datetime


class ModelVersionInfo(BaseModel):
    """Model version information"""

    version: str
    timestamp: datetime
    performance: Optional[float] = None
    metadata: Optional[Dict[str, Any]] = None


class ModelSyncResponse(BaseModel):
    """Response for model sync operations"""

    success: bool
    modelType: str
    version: str
    message: str


def setup_model_sync_routes(app, model_manager):
    """Setup model synchronization routes on the FastAPI app"""

    @router.post("/sync", response_model=ModelSyncResponse)
    async def sync_model(request: ModelSyncRequest, background_tasks: BackgroundTasks):
        """
        Synchronize a model from another service
        """
        try:
            logger.info(
                f"📥 Received model sync request: {request.modelType} v{request.version}"
            )

            # Add background task to update model
            background_tasks.add_task(
                update_model_async,
                model_manager,
                request.modelType,
                request.version,
                request.weights,
                request.metadata,
            )

            return ModelSyncResponse(
                success=True,
                modelType=request.modelType,
                version=request.version,
                message=f"Model sync initiated for {request.modelType}",
            )

        except Exception as e:
            logger.error(f"Model sync failed: {e}")
            raise HTTPException(status_code=500, detail=str(e))

    @router.get("/{model_type}/version", response_model=ModelVersionInfo)
    async def get_model_version(model_type: str):
        """
        Get current version of a specific model
        """
        try:
            if model_type not in model_manager.models:
                raise HTTPException(
                    status_code=404, detail=f"Model {model_type} not found"
                )

            # Get model metadata if available
            metadata_file = Path(f"models/{model_type}_metadata.json")
            if metadata_file.exists():
                with open(metadata_file, "r") as f:
                    metadata = json.load(f)
                    return ModelVersionInfo(
                        version=metadata.get("version", "1.0.0"),
                        timestamp=datetime.fromisoformat(
                            metadata.get("timestamp", datetime.now().isoformat())
                        ),
                        performance=metadata.get("performance"),
                        metadata=metadata,
                    )

            # Default response if no metadata
            return ModelVersionInfo(
                version="1.0.0", timestamp=datetime.now(), performance=None, metadata={}
            )

        except Exception as e:
            logger.error(f"Failed to get model version: {e}")
            raise HTTPException(status_code=500, detail=str(e))

    @router.get("/{model_type}/latest")
    async def get_latest_model(model_type: str):
        """
        Get the latest version of a model with weights
        """
        try:
            if model_type not in model_manager.models:
                raise HTTPException(
                    status_code=404, detail=f"Model {model_type} not found"
                )

            model = model_manager.models[model_type]

            # Get model state dict
            if hasattr(model, "policy_net"):
                # AlphaZero style model
                weights = {
                    "policy_net": model.policy_net.state_dict(),
                    "value_net": model.value_net.state_dict(),
                }
            elif hasattr(model, "state_dict"):
                # PyTorch model
                weights = model.state_dict()
            else:
                weights = None

            # Get metadata
            metadata_file = Path(f"models/{model_type}_metadata.json")
            metadata = {}
            version = "1.0.0"

            if metadata_file.exists():
                with open(metadata_file, "r") as f:
                    metadata = json.load(f)
                    version = metadata.get("version", "1.0.0")

            return {
                "modelType": model_type,
                "version": version,
                "weights": weights,
                "metadata": metadata,
                "timestamp": datetime.now().isoformat(),
            }

        except Exception as e:
            logger.error(f"Failed to get latest model: {e}")
            raise HTTPException(status_code=500, detail=str(e))

    @router.get("/", response_model=Dict[str, List[str]])
    async def list_models():
        """
        List all available models
        """
        try:
            available_models = list(model_manager.models.keys())

            # Group by type
            model_groups = {"standard": [], "difficulty": [], "specialized": []}

            for model in available_models:
                if model.startswith("difficulty_"):
                    model_groups["difficulty"].append(model)
                elif model in ["minimax", "mcts", "alphazero", "ensemble"]:
                    model_groups["specialized"].append(model)
                else:
                    model_groups["standard"].append(model)

            return model_groups

        except Exception as e:
            logger.error(f"Failed to list models: {e}")
            raise HTTPException(status_code=500, detail=str(e))

    @router.post("/promote/{model_type}")
    async def promote_model(model_type: str, version: str):
        """
        Promote a model version to production
        """
        try:
            logger.info(f"🌟 Promoting {model_type} to version {version}")

            # Update metadata
            metadata_file = Path(f"models/{model_type}_metadata.json")
            metadata = {
                "version": version,
                "promoted_at": datetime.now().isoformat(),
                "promoted_by": "integration_system",
            }

            with open(metadata_file, "w") as f:
                json.dump(metadata, f, indent=2)

            # Notify integration system
            if hasattr(model_manager, "integration_client"):
                await model_manager.integration_client.notify_model_update(
                    model_type=model_type, version=version, metadata={"promoted": True}
                )

            return {
                "success": True,
                "message": f"Model {model_type} promoted to version {version}",
            }

        except Exception as e:
            logger.error(f"Failed to promote model: {e}")
            raise HTTPException(status_code=500, detail=str(e))

    # Add router to app
    app.include_router(router)
    logger.info("✅ Model synchronization endpoints configured")


async def update_model_async(
    model_manager,
    model_type: str,
    version: str,
    weights: Optional[Dict[str, Any]],
    metadata: Optional[Dict[str, Any]],
):
    """
    Background task to update model
    """
    try:
        logger.info(f"🔄 Updating {model_type} to version {version}")

        # Save weights if provided
        if weights:
            model_path = Path(f"models/{model_type}_v{version}.pt")
            torch.save(weights, model_path)
            logger.info(f"💾 Saved model weights to {model_path}")

        # Update metadata
        metadata_file = Path(f"models/{model_type}_metadata.json")
        model_metadata = metadata or {}
        model_metadata.update(
            {
                "version": version,
                "updated_at": datetime.now().isoformat(),
                "sync_source": "integration_system",
            }
        )

        with open(metadata_file, "w") as f:
            json.dump(model_metadata, f, indent=2)

        # Reload model if it's currently loaded
        if model_type in model_manager.models:
            logger.info(f"🔃 Reloading {model_type} with new version")
            await model_manager.reload_model(model_type)

        logger.info(f"✅ Successfully updated {model_type} to version {version}")

    except Exception as e:
        logger.error(f"Failed to update model {model_type}: {e}")
