"""
🍎 Metal-Optimized Inference Service

PyTorch inference service with Apple Metal Performance Shaders (MPS) support
for M1/M2 Macs, with automatic fallback to CUDA or CPU
"""

import logging
import os
import platform
import sys
import time
from dataclasses import dataclass
from enum import Enum
from typing import Dict, List, Optional, Tuple

import numpy as np
import torch
import torch.nn as nn
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


class DeviceType(str, Enum):
    MPS = "mps"
    CUDA = "cuda"
    CPU = "cpu"


class InferenceRequest(BaseModel):
    board: List[List[int]]
    model: str = "connect4_dqn"
    device: Optional[DeviceType] = None
    priority: str = "normal"


class InferenceResponse(BaseModel):
    move: int
    confidence: float
    device: DeviceType
    inferenceTimeMs: float
    modelVersion: str


@dataclass
class DeviceInfo:
    type: DeviceType
    available: bool
    name: str
    compute_capability: Optional[str] = None


class MetalInferenceService:
    """Metal-optimized inference service for Connect Four AI"""

    def __init__(self):
        self.app = FastAPI(title="Metal Inference Service")
        self.device = self._select_best_device()
        self.models: Dict[str, nn.Module] = {}
        self.device_info = self._get_device_info()

        logger.info(f"Initialized with device: {self.device}")
        self._setup_routes()
        self._setup_cors()

    def _select_best_device(self) -> torch.device:
        """Select the best available device (MPS > CUDA > CPU)"""

        # Check for Apple Silicon MPS
        if self._is_mps_available():
            logger.info("🍎 Metal Performance Shaders (MPS) available!")
            return torch.device("mps")

        # Check for CUDA
        if torch.cuda.is_available():
            logger.info("🎮 CUDA GPU available!")
            return torch.device("cuda")

        # Fallback to CPU
        logger.info("💻 Using CPU for inference")
        return torch.device("cpu")

    def _is_mps_available(self) -> bool:
        """Check if MPS is available (Apple Silicon Macs)"""
        if not torch.backends.mps.is_available():
            return False

        if not torch.backends.mps.is_built():
            logger.warning("MPS not built into PyTorch")
            return False

        # Additional check for macOS version
        if platform.system() != "Darwin":
            return False

        try:
            # Try to create a tensor on MPS
            test_tensor = torch.zeros(1).to("mps")
            del test_tensor
            return True
        except Exception as e:
            logger.warning(f"MPS test failed: {e}")
            return False

    def _get_device_info(self) -> List[DeviceInfo]:
        """Get information about available devices"""
        devices = []

        # Check MPS
        devices.append(
            DeviceInfo(
                type=DeviceType.MPS,
                available=self._is_mps_available(),
                name="Apple Metal Performance Shaders",
                compute_capability="Metal 3" if platform.machine() == "arm64" else None,
            )
        )

        # Check CUDA
        if torch.cuda.is_available():
            for i in range(torch.cuda.device_count()):
                prop = torch.cuda.get_device_properties(i)
                devices.append(
                    DeviceInfo(
                        type=DeviceType.CUDA,
                        available=True,
                        name=prop.name,
                        compute_capability=f"{prop.major}.{prop.minor}",
                    )
                )
        else:
            devices.append(
                DeviceInfo(
                    type=DeviceType.CUDA, available=False, name="No CUDA devices"
                )
            )

        # CPU is always available
        devices.append(
            DeviceInfo(
                type=DeviceType.CPU,
                available=True,
                name=platform.processor() or "Unknown CPU",
            )
        )

        return devices

    def _setup_routes(self):
        """Setup FastAPI routes"""

        @self.app.get("/health")
        async def health():
            return {
                "status": "healthy",
                "device": str(self.device),
                "device_type": self.device.type,
                "models_loaded": list(self.models.keys()),
                "torch_version": torch.__version__,
                "platform": platform.platform(),
            }

        @self.app.get("/device-capabilities")
        async def device_capabilities():
            device_priority = []

            if self._is_mps_available():
                device_priority.append(DeviceType.MPS)
            if torch.cuda.is_available():
                device_priority.append(DeviceType.CUDA)
            device_priority.append(DeviceType.CPU)

            return {
                "hasMPS": self._is_mps_available(),
                "hasCUDA": torch.cuda.is_available(),
                "devicePriority": device_priority,
                "systemInfo": {
                    "platform": platform.platform(),
                    "gpuInfo": self._get_gpu_info(),
                    "pythonVersion": sys.version.split()[0],
                    "torchVersion": torch.__version__,
                },
            }

        @self.app.post("/inference", response_model=InferenceResponse)
        async def inference(request: InferenceRequest):
            try:
                start_time = time.time()

                # Convert board to tensor
                board_tensor = self._prepare_board_tensor(request.board)

                # Select device
                device = self._get_inference_device(request.device)
                board_tensor = board_tensor.to(device)

                # Get or load model
                model = await self._get_model(request.model, device)

                # Perform inference
                with torch.no_grad():
                    if device.type == "mps":
                        # MPS-specific optimizations
                        with torch.autocast(device_type="cpu", dtype=torch.float16):
                            output = model(board_tensor)
                    else:
                        output = model(board_tensor)

                # Get best move
                move, confidence = self._extract_best_move(output, request.board)

                inference_time_ms = (time.time() - start_time) * 1000

                return InferenceResponse(
                    move=move,
                    confidence=confidence,
                    device=DeviceType(device.type),
                    inferenceTimeMs=inference_time_ms,
                    modelVersion="1.0.0",
                )

            except Exception as e:
                logger.error(f"Inference failed: {e}")
                raise HTTPException(status_code=500, detail=str(e))

    def _setup_cors(self):
        """Setup CORS middleware"""
        self.app.add_middleware(
            CORSMiddleware,
            allow_origins=["*"],
            allow_credentials=True,
            allow_methods=["*"],
            allow_headers=["*"],
        )

    def _get_gpu_info(self) -> str:
        """Get GPU information string"""
        if self._is_mps_available():
            # Get Apple Silicon info
            try:
                import subprocess

                result = subprocess.run(
                    ["sysctl", "-n", "machdep.cpu.brand_string"],
                    capture_output=True,
                    text=True,
                )
                return result.stdout.strip()
            except (OSError, subprocess.SubprocessError) as e:
                logger.warning(f"Failed to get CPU info: {e}")
                return "Apple Silicon (MPS)"

        elif torch.cuda.is_available():
            return torch.cuda.get_device_name(0)

        return "CPU only"

    def _prepare_board_tensor(self, board: List[List[int]]) -> torch.Tensor:
        """Convert board state to tensor"""
        # Convert to numpy first
        board_np = np.array(board, dtype=np.float32)

        # Reshape for CNN input (1, 1, 6, 7)
        board_np = board_np.reshape(1, 1, 6, 7)

        # Convert to tensor
        return torch.from_numpy(board_np)

    def _get_inference_device(
        self, requested_device: Optional[DeviceType]
    ) -> torch.device:
        """Get the device to use for inference"""
        if requested_device:
            if requested_device == DeviceType.MPS and self._is_mps_available():
                return torch.device("mps")
            elif requested_device == DeviceType.CUDA and torch.cuda.is_available():
                return torch.device("cuda")
            elif requested_device == DeviceType.CPU:
                return torch.device("cpu")

        # Use default device
        return self.device

    async def _get_model(self, model_name: str, device: torch.device) -> nn.Module:
        """Get or load the specified model"""
        if model_name not in self.models:
            # Load model (simplified for example)
            model = self._create_simple_cnn_model()
            model = model.to(device)
            model.eval()

            # Optimize for MPS if applicable
            if device.type == "mps":
                model = torch.jit.script(model)

            self.models[model_name] = model
            logger.info(f"Loaded model {model_name} on {device}")

        return self.models[model_name]

    def _create_simple_cnn_model(self) -> nn.Module:
        """Create a simple CNN model for Connect Four"""

        class SimpleCNN(nn.Module):
            def __init__(self):
                super().__init__()
                self.conv1 = nn.Conv2d(1, 32, kernel_size=3, padding=1)
                self.conv2 = nn.Conv2d(32, 64, kernel_size=3, padding=1)
                self.fc1 = nn.Linear(64 * 6 * 7, 128)
                self.fc2 = nn.Linear(128, 7)  # 7 columns

            def forward(self, x):
                x = torch.relu(self.conv1(x))
                x = torch.relu(self.conv2(x))
                x = x.view(x.size(0), -1)
                x = torch.relu(self.fc1(x))
                x = self.fc2(x)
                return x

        return SimpleCNN()

    def _extract_best_move(
        self, output: torch.Tensor, board: List[List[int]]
    ) -> Tuple[int, float]:
        """Extract the best valid move from model output"""
        # Get probabilities
        probs = torch.softmax(output, dim=1).squeeze().cpu().numpy()

        # Get valid moves (columns not full)
        valid_moves = []
        for col in range(7):
            if board[0][col] == 0:  # Top row empty = valid move
                valid_moves.append(col)

        # Find best valid move
        best_move = -1
        best_confidence = -1.0

        for move in valid_moves:
            if probs[move] > best_confidence:
                best_confidence = probs[move]
                best_move = move

        if best_move == -1:
            # No valid moves (shouldn't happen in normal game)
            raise ValueError("No valid moves available")

        return best_move, float(best_confidence)


def main():
    """Run the Metal inference service"""
    import uvicorn

    service = MetalInferenceService()

    host = os.getenv("METAL_INFERENCE_HOST", "0.0.0.0")
    port = int(os.getenv("METAL_INFERENCE_PORT", "8005"))

    logger.info(f"Starting Metal Inference Service on {host}:{port}")

    uvicorn.run(service.app, host=host, port=port, log_level="info", access_log=True)


if __name__ == "__main__":
    main()
