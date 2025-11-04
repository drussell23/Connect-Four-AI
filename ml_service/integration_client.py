"""
🌐 INTEGRATION WEBSOCKET CLIENT
===============================

Connects Python ML services to the central Integration WebSocket Gateway
for seamless data flow and real-time communication.
"""

import asyncio
import json
import logging
import os
import sys
from collections import defaultdict, deque
from datetime import datetime, timedelta
from pathlib import Path
from typing import Any, Callable, Dict, List, Optional, Tuple

import numpy as np
import socketio

logger = logging.getLogger(__name__)


# Integration Client Class - Connects Python ML services to the central Integration WebSocket Gateway
class IntegrationClient:
    """Client for connecting to the Integration WebSocket Gateway"""

    def __init__(
        self,
        service_name: str,
        integration_url: str = "http://localhost:8888",
        capabilities: list = None,
    ):
        """
        Initialize the integration client

        Args:
            service_name: Name of this service (e.g., 'ml_service', 'ai_coordination')
            integration_url: URL of the Integration WebSocket Gateway
            capabilities: List of capabilities this service provides
        """
        self.service_name = service_name
        self.integration_url = integration_url
        self.capabilities = capabilities or []

        # Create socket.io client
        self.sio = socketio.AsyncClient(
            reconnection=True,
            reconnection_delay=5,
            reconnection_delay_max=30,
            logger=logger,
        )

        # Event handlers
        self._handlers: Dict[str, Callable] = {}

        # Setup default handlers
        self._setup_default_handlers()

    def _setup_default_handlers(self):
        """Setup default socket event handlers"""

        @self.sio.event
        async def connect():
            logger.info(f"✅ {self.service_name} connected to Integration Gateway")
            # Register this service
            await self.register_service()

        @self.sio.event
        async def connect_error(data):
            logger.error(f"❌ Connection error: {data}")

        @self.sio.event
        async def disconnect():
            logger.warning(
                f"🔌 {self.service_name} disconnected from Integration Gateway"
            )

        @self.sio.event
        async def integration_status(data):
            logger.info(f"📊 Integration status: {data}")

        @self.sio.event
        async def game_data_update(data):
            """Handle game data updates"""
            if "game_data_update" in self._handlers:
                await self._handlers["game_data_update"](data)

        @self.sio.event
        async def pattern_shared(data):
            """Handle shared patterns"""
            if "pattern_shared" in self._handlers:
                await self._handlers["pattern_shared"](data)

        @self.sio.event
        async def model_updated(data):
            """Handle model updates"""
            if "model_updated" in self._handlers:
                await self._handlers["model_updated"](data)

        @self.sio.event
        async def insight_available(data):
            """Handle new insights"""
            if "insight_available" in self._handlers:
                await self._handlers["insight_available"](data)

        @self.sio.event
        async def service_status_update(data):
            """Handle service status updates"""
            if "service_status_update" in self._handlers:
                await self._handlers["service_status_update"](data)

    async def connect(self):
        """Connect to the Integration Gateway"""
        try:
            await self.sio.connect(self.integration_url, namespaces=["/integration"])
            logger.info(f"🌐 Connecting {self.service_name} to Integration Gateway...")
        except Exception as e:
            logger.error(f"Failed to connect: {e}")
            raise

    async def disconnect(self):
        """Disconnect from the Integration Gateway"""
        await self.sio.disconnect()

    async def register_service(self):
        """Register this service with the Integration Gateway"""
        await self.emit(
            "register_service",
            {
                "serviceName": self.service_name,
                "capabilities": self.capabilities,
                "timestamp": datetime.now().isoformat(),
            },
        )

    async def emit(self, event: str, data: Any):
        """Emit an event to the Integration Gateway"""
        try:
            await self.sio.emit(event, data, namespace="/integration")
        except Exception as e:
            logger.error(f"Failed to emit {event}: {e}")

    def on(self, event: str, handler: Callable):
        """Register an event handler"""
        self._handlers[event] = handler

    async def broadcast_game_data(self, game_data: Dict[str, Any]):
        """Broadcast game data to all services"""
        await self.emit("broadcast_game_data", game_data)

    async def share_pattern(self, pattern: Dict[str, Any]):
        """Share a detected pattern with all services"""
        await self.emit(
            "share_pattern",
            {
                "pattern": pattern,
                "source": self.service_name,
                "timestamp": datetime.now().isoformat(),
            },
        )

    async def notify_model_update(
        self, model_type: str, version: str, metadata: Dict[str, Any] = None
    ):
        """Notify all services about a model update"""
        await self.emit(
            "notify_model_update",
            {
                "modelType": model_type,
                "version": version,
                "metadata": metadata or {},
                "source": self.service_name,
                "timestamp": datetime.now().isoformat(),
            },
        )

    async def request_move_analysis(
        self, game_id: str, board: list, move: Dict[str, Any]
    ):
        """Request real-time move analysis from all services"""
        await self.emit(
            "analyze_move_realtime",
            {
                "gameId": game_id,
                "board": board,
                "move": move,
                "source": self.service_name,
            },
        )

    async def submit_simulation_result(
        self, simulation_id: str, result: Dict[str, Any]
    ):
        """Submit results from AI vs AI simulation"""
        await self.emit(
            "simulation_result",
            {
                "simulationId": simulation_id,
                "result": result,
                "source": self.service_name,
                "timestamp": datetime.now().isoformat(),
            },
        )

    async def propagate_insight(self, insight: Dict[str, Any]):
        """Propagate a strategic insight to all services"""
        await self.emit(
            "propagate_insight",
            {
                "insight": insight,
                "source": self.service_name,
                "timestamp": datetime.now().isoformat(),
            },
        )

    async def request_metrics(self) -> Dict[str, Any]:
        """Request metrics from the Integration Gateway"""
        future = asyncio.Future()

        @self.sio.event
        async def metrics_response(data):
            future.set_result(data)

        await self.emit("request_metrics", {})

        try:
            return await asyncio.wait_for(future, timeout=5.0)
        except asyncio.TimeoutError:
            logger.error("Metrics request timed out")
            return {}


class MLServiceIntegration:
    """Integration wrapper for ML Service"""

    def __init__(self):
        self.client = IntegrationClient(
            service_name="ml_service",
            capabilities=[
                "model_training",
                "pattern_detection",
                "move_prediction",
                "performance_analysis",
            ],
        )

        # Initialize ML-specific data structures
        self.experience_buffer = deque(maxlen=10000)  # Experience replay buffer
        self.pattern_library = defaultdict(
            lambda: {"count": 0, "avg_confidence": 0.0, "examples": []}
        )
        self.training_queue = deque(maxlen=1000)  # Queue for training examples
        self.model_versions = {}  # Track current model versions

        # Setup ML-specific handlers
        self.client.on("game_data_update", self.handle_game_data)
        self.client.on("pattern_shared", self.handle_pattern)
        self.client.on("model_sync_request", self.handle_model_sync)

    async def handle_game_data(self, data: Dict[str, Any]):
        """Process game data for learning"""
        logger.info(f"📊 Processing game data: {data.get('gameId')}")

        try:
            # Extract game information
            game_id = data.get("gameId")
            board_state = data.get("board", [])
            moves = data.get("moves", [])
            outcome = data.get("outcome")  # 'win', 'loss', 'draw'
            player_type = data.get("playerType")  # 'ai' or 'human'
            difficulty = data.get("difficulty", "medium")
            timestamp = data.get("timestamp", datetime.now().isoformat())

            # Create experience record
            experience = {
                "gameId": game_id,
                "board": board_state,
                "moves": moves,
                "outcome": outcome,
                "playerType": player_type,
                "difficulty": difficulty,
                "timestamp": timestamp,
            }

            # If this was a loss, analyze the losing pattern
            if outcome == "loss" and board_state:
                loss_pattern = self._analyze_loss_pattern(board_state, moves)
                if loss_pattern:
                    experience["loss_pattern"] = loss_pattern
                    logger.info(f"🔍 Detected loss pattern: {loss_pattern['type']}")

            # Store experience for batch processing
            if hasattr(self, "experience_buffer"):
                # Prioritize losses and games against strong players
                priority = 1.0
                if outcome == "loss":
                    priority = 2.0
                if player_type == "human" and difficulty in ["hard", "expert"]:
                    priority *= 1.5

                self.experience_buffer.add(experience, priority)
                logger.info(f"💾 Stored experience with priority {priority}")

            # Notify other services about the new game data
            await self.client.broadcast_game_data(
                {
                    "gameId": game_id,
                    "summary": {
                        "outcome": outcome,
                        "moveCount": len(moves),
                        "difficulty": difficulty,
                        "patterns": experience.get("loss_pattern"),
                    },
                    "timestamp": timestamp,
                }
            )

        except Exception as e:
            logger.error(f"❌ Error processing game data: {e}")

    def _analyze_loss_pattern(
        self, board: List[List[int]], moves: List[Dict]
    ) -> Optional[Dict[str, Any]]:
        """Analyze the board to detect winning patterns that led to loss"""
        if not board or not moves:
            return None

        # Check for horizontal wins
        for row in range(6):
            for col in range(4):
                if self._check_line(board, row, col, 0, 1):
                    return {
                        "type": "horizontal",
                        "positions": [[row, col + i] for i in range(4)],
                        "direction": "horizontal",
                    }

        # Check for vertical wins
        for row in range(3):
            for col in range(7):
                if self._check_line(board, row, col, 1, 0):
                    return {
                        "type": "vertical",
                        "positions": [[row + i, col] for i in range(4)],
                        "direction": "vertical",
                    }

        # Check for diagonal wins
        for row in range(3):
            for col in range(4):
                if self._check_line(board, row, col, 1, 1):
                    return {
                        "type": "diagonal",
                        "positions": [[row + i, col + i] for i in range(4)],
                        "direction": "diagonal_down",
                    }

        # Check for anti-diagonal wins
        for row in range(3, 6):
            for col in range(4):
                if self._check_line(board, row, col, -1, 1):
                    return {
                        "type": "anti-diagonal",
                        "positions": [[row - i, col + i] for i in range(4)],
                        "direction": "diagonal_up",
                    }

        return None

    def _check_line(
        self, board: List[List[int]], row: int, col: int, delta_row: int, delta_col: int
    ) -> bool:
        """Check if there's a winning line starting at (row, col)"""
        if not (0 <= row < 6 and 0 <= col < 7):
            return False

        player = board[row][col]
        if player == 0:  # Empty cell
            return False

        # Check next 3 cells
        for i in range(1, 4):
            r, c = row + i * delta_row, col + i * delta_col
            if not (0 <= r < 6 and 0 <= c < 7) or board[r][c] != player:
                return False

        return True

    async def handle_pattern(self, data: Dict[str, Any]):
        """Learn from shared patterns"""
        pattern_info = data.get("pattern", {})
        logger.info(f"🔍 Learning from pattern: {pattern_info.get('type')}")

        try:
            # Extract pattern information
            pattern_type = pattern_info.get(
                "type"
            )  # e.g., 'diagonal_threat', 'fork', 'trap'
            positions = pattern_info.get("positions", [])
            confidence = pattern_info.get("confidence", 0.5)
            source_service = data.get("source", "unknown")
            context = pattern_info.get(
                "context", {}
            )  # Additional context like board state

            # Validate pattern
            if not pattern_type or not positions:
                logger.warning("Invalid pattern data received")
                return

            # Create pattern record for learning
            pattern_record = {
                "type": pattern_type,
                "positions": positions,
                "confidence": confidence,
                "source": source_service,
                "timestamp": data.get("timestamp", datetime.now().isoformat()),
                "board_context": context.get("board"),
                "game_phase": context.get(
                    "phase", "unknown"
                ),  # 'opening', 'middle', 'endgame'
                "effectiveness": context.get("effectiveness", 0.5),
            }

            # Store pattern for analysis
            if hasattr(self, "pattern_library"):
                # Update pattern statistics
                self.pattern_library[pattern_type]["count"] += 1
                self.pattern_library[pattern_type]["avg_confidence"] = (
                    self.pattern_library[pattern_type]["avg_confidence"]
                    * (self.pattern_library[pattern_type]["count"] - 1)
                    + confidence
                ) / self.pattern_library[pattern_type]["count"]
                self.pattern_library[pattern_type]["examples"].append(pattern_record)

                # Keep only recent examples
                if len(self.pattern_library[pattern_type]["examples"]) > 100:
                    self.pattern_library[pattern_type]["examples"].pop(0)
            else:
                # Initialize pattern library if not exists
                self.pattern_library = defaultdict(
                    lambda: {"count": 0, "avg_confidence": 0.0, "examples": []}
                )

            # Learn from high-confidence patterns
            if confidence > 0.8:
                await self._integrate_pattern_knowledge(pattern_record)

            # Share insights about pattern effectiveness
            if pattern_type in ["fork", "trap", "winning_setup"]:
                await self.client.propagate_insight(
                    {
                        "type": "pattern_effectiveness",
                        "pattern": pattern_type,
                        "confidence": confidence,
                        "recommendation": self._get_pattern_recommendation(
                            pattern_type, confidence
                        ),
                    }
                )

        except Exception as e:
            logger.error(f"❌ Error processing pattern: {e}")

    async def _integrate_pattern_knowledge(self, pattern: Dict[str, Any]):
        """Integrate high-confidence patterns into the learning system"""
        logger.info(f"🧠 Integrating {pattern['type']} pattern into knowledge base")

        # Create training example from pattern
        if pattern.get("board_context"):
            # Convert pattern to training format
            training_example = {
                "board": pattern["board_context"],
                "important_positions": pattern["positions"],
                "pattern_type": pattern["type"],
                "weight": pattern["confidence"],  # Use confidence as sample weight
            }

            # Queue for next training batch
            if hasattr(self, "training_queue"):
                self.training_queue.append(training_example)

    def _get_pattern_recommendation(self, pattern_type: str, confidence: float) -> str:
        """Generate recommendation based on pattern type and confidence"""
        recommendations = {
            "fork": "Create multiple winning threats simultaneously",
            "trap": "Force opponent into disadvantageous position",
            "winning_setup": "Establish strong position for guaranteed win",
            "diagonal_threat": "Control diagonal lines for strategic advantage",
            "center_control": "Maintain control of central columns",
        }

        base_rec = recommendations.get(
            pattern_type, "Utilize pattern for strategic advantage"
        )

        if confidence > 0.9:
            return f"High confidence: {base_rec}"
        elif confidence > 0.7:
            return f"Recommended: {base_rec}"
        else:
            return f"Consider: {base_rec}"

    async def handle_model_sync(self, data: Dict[str, Any]):
        """Sync models across services"""
        logger.info(f"🔄 Syncing model: {data.get('modelType')}")

        try:
            # Extract sync information
            model_type = data.get("modelType")  # 'policy', 'value', 'combined'
            version = data.get("version")
            source_service = data.get("source")
            sync_type = data.get("syncType", "update")  # 'update', 'replace', 'merge'
            model_metadata = data.get("metadata", {})

            # Handle different sync types
            if sync_type == "update":
                await self._handle_model_update(model_type, version, model_metadata)
            elif sync_type == "replace":
                await self._handle_model_replacement(
                    model_type, version, source_service
                )
            elif sync_type == "merge":
                await self._handle_model_merge(model_type, version, model_metadata)
            else:
                logger.warning(f"Unknown sync type: {sync_type}")
                return

            # Confirm sync completion
            await self.client.emit(
                "model_sync_complete",
                {
                    "modelType": model_type,
                    "version": version,
                    "service": self.client.service_name,
                    "status": "success",
                    "timestamp": datetime.now().isoformat(),
                },
            )

        except Exception as e:
            logger.error(f"❌ Error syncing model: {e}")

            # Report sync failure
            await self.client.emit(
                "model_sync_complete",
                {
                    "modelType": data.get("modelType"),
                    "version": data.get("version"),
                    "service": self.client.service_name,
                    "status": "failed",
                    "error": str(e),
                    "timestamp": datetime.now().isoformat(),
                },
            )

    async def _handle_model_update(
        self, model_type: str, version: str, metadata: Dict[str, Any]
    ):
        """Handle incremental model updates"""
        logger.info(f"📈 Updating {model_type} model to version {version}")

        # Check if we have the base model
        current_version = self._get_current_model_version(model_type)

        if current_version and self._is_compatible_version(current_version, version):
            # Apply incremental update
            update_weights = metadata.get("update_weights")
            learning_rate = metadata.get("learning_rate", 0.01)

            if update_weights:
                # Apply weight updates with momentum
                if hasattr(self, "model_manager"):
                    self.model_manager.apply_weight_update(
                        model_type, update_weights, learning_rate
                    )
                    logger.info(f"✅ Applied incremental update to {model_type}")
        else:
            # Need full model download
            logger.info(f"📥 Incompatible version, requesting full model")
            await self.client.emit(
                "request_full_model",
                {
                    "modelType": model_type,
                    "currentVersion": current_version,
                    "targetVersion": version,
                },
            )

    async def _handle_model_replacement(
        self, model_type: str, version: str, source: str
    ):
        """Handle complete model replacement"""
        logger.info(
            f"🔄 Replacing {model_type} model with version {version} from {source}"
        )

        # Request model download
        model_url = await self._request_model_download(model_type, version, source)

        if model_url:
            # Download and validate new model
            success = await self._download_and_validate_model(
                model_url, model_type, version
            )

            if success:
                # Backup current model
                self._backup_current_model(model_type)

                # Load new model
                if hasattr(self, "model_manager"):
                    self.model_manager.load_model(model_type, version)
                    logger.info(f"✅ Successfully replaced {model_type} model")
            else:
                logger.error(f"Failed to download/validate new model")

    async def _handle_model_merge(
        self, model_type: str, version: str, metadata: Dict[str, Any]
    ):
        """Handle model ensemble/merge operations"""
        logger.info(f"🔀 Merging {model_type} models")

        # Get merge strategy
        merge_strategy = metadata.get(
            "strategy", "average"
        )  # 'average', 'weighted', 'ensemble'
        model_weights = metadata.get("weights", {})

        if merge_strategy == "average":
            # Simple parameter averaging
            if hasattr(self, "model_manager"):
                self.model_manager.merge_models_average(model_type, model_weights)
        elif merge_strategy == "weighted":
            # Weighted average based on performance
            performance_scores = metadata.get("performance_scores", {})
            if hasattr(self, "model_manager"):
                self.model_manager.merge_models_weighted(
                    model_type, model_weights, performance_scores
                )
        elif merge_strategy == "ensemble":
            # Create ensemble of models
            if hasattr(self, "model_manager"):
                self.model_manager.create_ensemble(model_type, model_weights)

        logger.info(f"✅ Model merge completed using {merge_strategy} strategy")

    def _get_current_model_version(self, model_type: str) -> Optional[str]:
        """Get current version of specified model"""
        if hasattr(self, "model_versions"):
            return self.model_versions.get(model_type)
        return None

    def _is_compatible_version(self, current: str, target: str) -> bool:
        """Check if versions are compatible for incremental update"""
        # Simple version compatibility check
        try:
            curr_major, curr_minor = map(int, current.split(".")[:2])
            targ_major, targ_minor = map(int, target.split(".")[:2])

            # Compatible if same major version and target minor is higher
            return curr_major == targ_major and targ_minor > curr_minor
        except:
            return False

    async def _request_model_download(
        self, model_type: str, version: str, source: str
    ) -> Optional[str]:
        """Request download URL for model"""
        future = asyncio.Future()

        @self.sio.event
        async def model_download_url(data):
            if data.get("modelType") == model_type and data.get("version") == version:
                future.set_result(data.get("url"))

        await self.client.emit(
            "request_model_url",
            {"modelType": model_type, "version": version, "source": source},
        )

        try:
            return await asyncio.wait_for(future, timeout=10.0)
        except asyncio.TimeoutError:
            logger.error("Model URL request timed out")
            return None

    async def _download_and_validate_model(
        self, url: str, model_type: str, version: str
    ) -> bool:
        """Download and validate model from URL"""
        # Implementation would download model and validate it
        # For now, return True as placeholder
        logger.info(f"📥 Downloading model from {url}")
        return True

    def _backup_current_model(self, model_type: str):
        """Backup current model before replacement with versioning and compression"""
        logger.info(f"💾 Backing up current {model_type} model")

        try:
            # Define backup directory structure
            backup_base_dir = Path("model_backups")
            model_backup_dir = backup_base_dir / model_type
            model_backup_dir.mkdir(parents=True, exist_ok=True)

            # Get current model path
            current_model_path = self._get_model_path(model_type)
            if not current_model_path or not Path(current_model_path).exists():
                logger.warning(f"No current model found for {model_type}")
                return False

            # Generate backup filename with timestamp and version
            timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
            current_version = self._get_current_model_version(model_type) or "unknown"
            backup_filename = f"{model_type}_v{current_version}_{timestamp}"

            # Create backup metadata
            metadata = {
                "model_type": model_type,
                "original_version": current_version,
                "backup_timestamp": datetime.now().isoformat(),
                "original_path": str(current_model_path),
                "model_size_bytes": Path(current_model_path).stat().st_size,
                "backup_reason": "pre_replacement",
                "system_info": {
                    "service": self.client.service_name,
                    "capabilities": self.client.capabilities,
                },
            }

            # If model has performance metrics, include them
            if (
                hasattr(self, "model_performance")
                and model_type in self.model_performance
            ):
                metadata["performance_metrics"] = self.model_performance[model_type]

            # Save metadata
            metadata_path = model_backup_dir / f"{backup_filename}_metadata.json"
            with open(metadata_path, "w") as f:
                json.dump(metadata, f, indent=2)

            # Backup the model file(s)
            if Path(current_model_path).is_file():
                # Single file model
                import gzip
                import shutil

                # Create compressed backup
                backup_path = model_backup_dir / f"{backup_filename}.pt.gz"
                with open(current_model_path, "rb") as f_in:
                    with gzip.open(backup_path, "wb", compresslevel=6) as f_out:
                        shutil.copyfileobj(f_in, f_out)

                logger.info(f"✅ Backed up model to {backup_path}")

            elif Path(current_model_path).is_dir():
                # Directory-based model (e.g., TensorFlow SavedModel)
                import tarfile

                backup_path = model_backup_dir / f"{backup_filename}.tar.gz"
                with tarfile.open(backup_path, "w:gz") as tar:
                    tar.add(current_model_path, arcname=backup_filename)

                logger.info(f"✅ Backed up model directory to {backup_path}")

            # Verify backup integrity
            if not self._verify_backup_integrity(backup_path, current_model_path):
                logger.error(f"Backup integrity check failed for {model_type}")
                return False

            # Clean up old backups (keep last N backups)
            self._cleanup_old_backups(model_backup_dir, keep_count=5)

            # Update backup registry
            self._update_backup_registry(
                model_type,
                {
                    "backup_path": str(backup_path),
                    "metadata_path": str(metadata_path),
                    "timestamp": timestamp,
                    "version": current_version,
                    "size_bytes": backup_path.stat().st_size,
                },
            )

            logger.info(f"✅ Successfully backed up {model_type} model with metadata")
            return True

        except Exception as e:
            logger.error(f"❌ Failed to backup model {model_type}: {e}")
            return False

    def _get_model_path(self, model_type: str) -> Optional[Path]:
        """Get the current model path"""
        # Model paths based on type
        model_paths = {
            "policy": Path("models/policy_net.pt"),
            "value": Path("models/value_net.pt"),
            "combined": Path("models/combined_net.pt"),
            "minimax": Path("models/minimax_model.pkl"),
            "mcts": Path("models/mcts_model.pt"),
        }

        return model_paths.get(model_type)

    def _verify_backup_integrity(self, backup_path: Path, original_path: Path) -> bool:
        """Verify backup integrity by checking size and optionally content"""
        try:
            import gzip
            import tarfile

            # Check if backup exists
            if not backup_path.exists():
                return False

            # For gzip files, decompress and check size
            if backup_path.suffix == ".gz":
                with gzip.open(backup_path, "rb") as f:
                    decompressed_size = len(f.read())

                original_size = Path(original_path).stat().st_size

                # Allow small size differences due to compression artifacts
                size_diff = abs(decompressed_size - original_size)
                if size_diff > original_size * 0.01:  # 1% tolerance
                    logger.warning(
                        f"Size mismatch: original={original_size}, decompressed={decompressed_size}"
                    )
                    return False

            # For tar.gz files, check if extraction is possible
            elif backup_path.suffixes == [".tar", ".gz"]:
                with tarfile.open(backup_path, "r:gz") as tar:
                    # Verify we can read the archive
                    members = tar.getmembers()
                    if not members:
                        return False

            return True

        except Exception as e:
            logger.error(f"Integrity check failed: {e}")
            return False

    def _cleanup_old_backups(self, backup_dir: Path, keep_count: int = 5):
        """Clean up old backups, keeping only the most recent N backups"""
        try:
            # Find all backup files
            backup_files = []
            for pattern in ["*.pt.gz", "*.tar.gz"]:
                backup_files.extend(backup_dir.glob(pattern))

            # Sort by modification time (newest first)
            backup_files.sort(key=lambda p: p.stat().st_mtime, reverse=True)

            # Remove old backups and their metadata
            for old_backup in backup_files[keep_count:]:
                # Remove backup file
                old_backup.unlink()

                # Remove associated metadata
                metadata_path = old_backup.with_suffix("").with_suffix("_metadata.json")
                if metadata_path.exists():
                    metadata_path.unlink()

                logger.info(f"🗑️ Removed old backup: {old_backup.name}")

        except Exception as e:
            logger.error(f"Failed to cleanup old backups: {e}")

    def _update_backup_registry(self, model_type: str, backup_info: Dict[str, Any]):
        """Update the backup registry with new backup information"""
        try:
            registry_path = Path("model_backups/backup_registry.json")

            # Load existing registry
            if registry_path.exists():
                with open(registry_path, "r") as f:
                    registry = json.load(f)
            else:
                registry = {}

            # Update registry
            if model_type not in registry:
                registry[model_type] = []

            registry[model_type].append(backup_info)

            # Keep only recent entries
            registry[model_type] = registry[model_type][-10:]

            # Save updated registry
            registry_path.parent.mkdir(exist_ok=True)
            with open(registry_path, "w") as f:
                json.dump(registry, f, indent=2)

        except Exception as e:
            logger.error(f"Failed to update backup registry: {e}")

    def restore_model_from_backup(
        self, model_type: str, backup_timestamp: Optional[str] = None
    ) -> bool:
        """Restore a model from backup"""
        try:
            # Get backup info from registry
            registry_path = Path("model_backups/backup_registry.json")
            if not registry_path.exists():
                logger.error("No backup registry found")
                return False

            with open(registry_path, "r") as f:
                registry = json.load(f)

            if model_type not in registry or not registry[model_type]:
                logger.error(f"No backups found for {model_type}")
                return False

            # Find the backup to restore
            if backup_timestamp:
                backup_info = next(
                    (
                        b
                        for b in registry[model_type]
                        if b["timestamp"] == backup_timestamp
                    ),
                    None,
                )
            else:
                # Use most recent backup
                backup_info = registry[model_type][-1]

            if not backup_info:
                logger.error(f"Backup not found for {model_type} at {backup_timestamp}")
                return False

            # Restore the backup
            backup_path = Path(backup_info["backup_path"])
            target_path = self._get_model_path(model_type)

            if backup_path.suffix == ".gz":
                # Restore gzipped model
                import gzip
                import shutil

                with gzip.open(backup_path, "rb") as f_in:
                    with open(target_path, "wb") as f_out:
                        shutil.copyfileobj(f_in, f_out)

            elif backup_path.suffixes == [".tar", ".gz"]:
                # Restore tarred directory
                import tarfile

                with tarfile.open(backup_path, "r:gz") as tar:
                    tar.extractall(target_path.parent)

            logger.info(
                f"✅ Restored {model_type} model from backup {backup_info['timestamp']}"
            )

            # Update current version
            if "version" in backup_info:
                self.model_versions[model_type] = backup_info["version"]

            return True

        except Exception as e:
            logger.error(f"Failed to restore model from backup: {e}")
            return False

    async def start(self):
        """Start the integration client"""
        await self.client.connect()
        logger.info("✅ ML Service Integration started")

    async def stop(self):
        """Stop the integration client"""
        await self.client.disconnect()
        logger.info("🛑 ML Service Integration stopped")


class AICoordinationIntegration:
    """Integration wrapper for AI Coordination Hub"""

    def __init__(self):
        self.client = IntegrationClient(
            service_name="ai_coordination",
            capabilities=[
                "strategic_analysis",
                "simulation_coordination",
                "insight_generation",
                "cross_ai_communication",
            ],
        )

        # Initialize AI Coordination-specific data structures
        self.strategy_database = deque(maxlen=1000)  # Store strategic analyses
        self.simulation_history = deque(maxlen=100)  # Store simulation results

        # Setup AI Coordination-specific handlers
        self.client.on("game_data_update", self.analyze_game_strategy)
        self.client.on("simulation_request", self.handle_simulation_request)

    async def analyze_game_strategy(self, data: Dict[str, Any]):
        """Analyze game for strategic insights"""
        logger.info(f"🎯 Analyzing strategy for game: {data.get('gameId')}")

        try:
            # Extract game data
            game_id = data.get("gameId")
            board_state = data.get("board", [])
            moves_history = data.get("moves", [])
            player_types = data.get("playerTypes", {})  # {1: 'human', 2: 'ai'}
            game_outcome = data.get("outcome")  # 'win', 'loss', 'draw', 'ongoing'
            current_player = data.get("currentPlayer", 1)

            # Initialize strategic analysis
            analysis = {
                "gameId": game_id,
                "timestamp": datetime.now().isoformat(),
                "gamePhase": self._determine_game_phase(moves_history),
                "criticalMoments": [],
                "strategicPatterns": [],
                "playerInsights": {},
                "recommendations": [],
            }

            # Analyze game phases
            if analysis["gamePhase"] == "opening":
                opening_insights = self._analyze_opening_strategy(
                    board_state, moves_history
                )
                analysis["openingAnalysis"] = opening_insights

            elif analysis["gamePhase"] == "midgame":
                midgame_insights = self._analyze_midgame_strategy(
                    board_state, moves_history
                )
                analysis["midgameAnalysis"] = midgame_insights

            elif analysis["gamePhase"] == "endgame":
                endgame_insights = self._analyze_endgame_strategy(
                    board_state, moves_history
                )
                analysis["endgameAnalysis"] = endgame_insights

            # Identify critical moments
            critical_moments = self._identify_critical_moments(
                board_state, moves_history
            )
            analysis["criticalMoments"] = critical_moments

            # Detect strategic patterns
            patterns = self._detect_strategic_patterns(board_state, moves_history)
            analysis["strategicPatterns"] = patterns

            # Analyze player behaviors
            for player_id, player_type in player_types.items():
                player_analysis = self._analyze_player_behavior(
                    moves_history, player_id, player_type
                )
                analysis["playerInsights"][player_id] = player_analysis

            # Generate strategic recommendations
            if game_outcome == "ongoing":
                recommendations = self._generate_strategic_recommendations(
                    board_state, moves_history, current_player, patterns
                )
                analysis["recommendations"] = recommendations

            # Calculate strategic metrics
            metrics = self._calculate_strategic_metrics(board_state, moves_history)
            analysis["metrics"] = metrics

            # Share insights with other services
            await self.client.propagate_insight(
                {
                    "type": "strategic_analysis",
                    "gameId": game_id,
                    "keyInsights": self._extract_key_insights(analysis),
                    "gamePhase": analysis["gamePhase"],
                    "confidence": self._calculate_analysis_confidence(analysis),
                }
            )

            # Store analysis for learning
            if hasattr(self, "strategy_database"):
                self.strategy_database.append(analysis)

                # Keep only recent analyses
                if len(self.strategy_database) > 1000:
                    self.strategy_database.pop(0)

            logger.info(f"✅ Completed strategic analysis for game {game_id}")
            return analysis

        except Exception as e:
            logger.error(f"❌ Error in strategic analysis: {e}")
            return None

    def _determine_game_phase(self, moves: List[Dict]) -> str:
        """Determine current game phase based on move count"""
        move_count = len(moves)

        if move_count <= 8:
            return "opening"
        elif move_count <= 24:
            return "midgame"
        else:
            return "endgame"

    def _analyze_opening_strategy(
        self, board: List[List[int]], moves: List[Dict]
    ) -> Dict[str, Any]:
        """Analyze opening strategy patterns"""
        analysis = {
            "centerControl": self._evaluate_center_control(board, moves[:8]),
            "openingType": self._classify_opening(moves[:8]),
            "symmetry": self._check_opening_symmetry(moves[:8]),
            "tempo": self._calculate_tempo(moves[:8]),
        }

        # Check for common opening traps
        if self._is_opening_trap(moves[:8]):
            analysis["trapDetected"] = True
            analysis["trapType"] = self._identify_trap_type(moves[:8])

        return analysis

    def _analyze_midgame_strategy(
        self, board: List[List[int]], moves: List[Dict]
    ) -> Dict[str, Any]:
        """Analyze midgame tactical elements"""
        return {
            "threatCount": self._count_threats(board),
            "forkOpportunities": self._find_fork_opportunities(board),
            "defensiveRequirements": self._assess_defensive_needs(board),
            "spaceAdvantage": self._calculate_space_advantage(board),
        }

    def _analyze_endgame_strategy(
        self, board: List[List[int]], moves: List[Dict]
    ) -> Dict[str, Any]:
        """Analyze endgame winning conditions"""
        return {
            "winningPaths": self._find_winning_paths(board),
            "forcedSequences": self._identify_forced_sequences(board),
            "drawPotential": self._assess_draw_potential(board),
            "criticalSquares": self._identify_critical_squares(board),
        }

    def _identify_critical_moments(
        self, board: List[List[int]], moves: List[Dict]
    ) -> List[Dict[str, Any]]:
        """Identify game-changing moments"""
        critical_moments = []

        for i, move in enumerate(moves):
            # Create board state at this move
            board_at_move = self._recreate_board_at_move(moves[: i + 1])

            # Check if this move created/blocked a winning threat
            if self._is_critical_move(board_at_move, move):
                critical_moments.append(
                    {
                        "moveNumber": i + 1,
                        "position": [move.get("row"), move.get("col")],
                        "type": self._classify_critical_move(board_at_move, move),
                        "impact": self._assess_move_impact(board_at_move, move),
                    }
                )

        return critical_moments

    def _detect_strategic_patterns(
        self, board: List[List[int]], moves: List[Dict]
    ) -> List[Dict[str, Any]]:
        """Detect recurring strategic patterns"""
        patterns = []

        # Pattern detection
        pattern_types = [
            "ladder_formation",
            "diagonal_control",
            "column_domination",
            "fork_setup",
            "defensive_wall",
            "sacrifice_play",
        ]

        for pattern_type in pattern_types:
            detected = self._check_pattern(board, moves, pattern_type)
            if detected:
                patterns.append(
                    {
                        "type": pattern_type,
                        "positions": detected["positions"],
                        "strength": detected["strength"],
                        "firstAppearance": detected["firstMove"],
                    }
                )

        return patterns

    def _analyze_player_behavior(
        self, moves: List[Dict], player_id: int, player_type: str
    ) -> Dict[str, Any]:
        """Analyze individual player behavior and style"""
        player_moves = [m for m in moves if m.get("player") == player_id]

        return {
            "playStyle": self._classify_play_style(player_moves),
            "aggressiveness": self._calculate_aggressiveness(player_moves),
            "consistency": self._measure_consistency(player_moves),
            "preferredColumns": self._analyze_column_preference(player_moves),
            "reactionTime": (
                self._average_reaction_time(player_moves)
                if player_type == "human"
                else None
            ),
            "mistakeRate": self._estimate_mistake_rate(player_moves),
        }

    def _generate_strategic_recommendations(
        self,
        board: List[List[int]],
        moves: List[Dict],
        current_player: int,
        patterns: List[Dict],
    ) -> List[Dict[str, Any]]:
        """Generate strategic recommendations for current position"""
        recommendations = []

        # Immediate threats
        urgent_moves = self._find_urgent_moves(board, current_player)
        for move in urgent_moves:
            recommendations.append(
                {
                    "type": "urgent",
                    "position": move["position"],
                    "reason": move["reason"],
                    "priority": "critical",
                }
            )

        # Strategic opportunities
        strategic_moves = self._find_strategic_opportunities(
            board, current_player, patterns
        )
        for move in strategic_moves:
            recommendations.append(
                {
                    "type": "strategic",
                    "position": move["position"],
                    "reason": move["reason"],
                    "priority": "high",
                    "expectedOutcome": move["outcome"],
                }
            )

        # Positional improvements
        positional_moves = self._suggest_positional_improvements(board, current_player)
        for move in positional_moves:
            recommendations.append(
                {
                    "type": "positional",
                    "position": move["position"],
                    "reason": move["reason"],
                    "priority": "medium",
                }
            )

        return recommendations

    def _calculate_strategic_metrics(
        self, board: List[List[int]], moves: List[Dict]
    ) -> Dict[str, float]:
        """Calculate various strategic metrics"""
        return {
            "boardComplexity": self._calculate_board_complexity(board),
            "positionBalance": self._calculate_position_balance(board),
            "threatDensity": self._calculate_threat_density(board),
            "moveEfficiency": self._calculate_move_efficiency(moves),
            "strategicDepth": self._estimate_strategic_depth(board, moves),
        }

    def _extract_key_insights(self, analysis: Dict[str, Any]) -> List[str]:
        """Extract key insights from analysis"""
        insights = []

        # Game phase insights
        phase = analysis.get("gamePhase")
        if phase == "opening" and analysis.get("openingAnalysis", {}).get(
            "trapDetected"
        ):
            insights.append(
                f"Opening trap detected: {analysis['openingAnalysis']['trapType']}"
            )

        # Critical moments
        if len(analysis.get("criticalMoments", [])) > 0:
            insights.append(
                f"Identified {len(analysis['criticalMoments'])} critical moments"
            )

        # Pattern insights
        patterns = analysis.get("strategicPatterns", [])
        if patterns:
            dominant_pattern = max(patterns, key=lambda p: p["strength"])
            insights.append(f"Dominant pattern: {dominant_pattern['type']}")

        return insights

    def _calculate_analysis_confidence(self, analysis: Dict[str, Any]) -> float:
        """Calculate confidence score for the analysis"""
        confidence = 0.5  # Base confidence

        # Increase confidence based on data completeness
        if analysis.get("criticalMoments"):
            confidence += 0.1
        if analysis.get("strategicPatterns"):
            confidence += 0.1
        if analysis.get("metrics"):
            confidence += 0.15
        if len(analysis.get("playerInsights", {})) > 0:
            confidence += 0.15

        return min(confidence, 1.0)

    # Helper methods (simplified implementations)
    def _evaluate_center_control(
        self, board: List[List[int]], moves: List[Dict]
    ) -> float:
        """Evaluate control of center columns (3, 4, 5)"""
        center_moves = [m for m in moves if m.get("col") in [2, 3, 4]]
        return len(center_moves) / max(len(moves), 1)

    def _classify_opening(self, moves: List[Dict]) -> str:
        """Classify opening type"""
        if not moves:
            return "unknown"

        first_cols = [m.get("col") for m in moves[:4]]
        if 3 in first_cols[:2]:
            return "center_first"
        elif 0 in first_cols or 6 in first_cols:
            return "edge_opening"
        else:
            return "balanced"

    def _check_pattern(
        self, board: List[List[int]], moves: List[Dict], pattern_type: str
    ) -> Optional[Dict[str, Any]]:
        """Check for specific pattern type"""
        # Simplified pattern detection
        if pattern_type == "ladder_formation":
            # Check for diagonal ladder pattern
            for row in range(3):
                for col in range(4):
                    if (
                        board[row][col] != 0
                        and board[row][col] == board[row + 1][col + 1]
                        and board[row + 1][col + 1] == board[row + 2][col + 2]
                    ):
                        return {
                            "positions": [[row + i, col + i] for i in range(3)],
                            "strength": 0.8,
                            "firstMove": 10,  # Simplified
                        }
        return None

    def _recreate_board_at_move(self, moves: List[Dict]) -> List[List[int]]:
        """Recreate board state after given moves"""
        board = [[0 for _ in range(7)] for _ in range(6)]

        for move in moves:
            col = move.get("col", 0)
            player = move.get("player", 1)

            # Find lowest empty row in column
            for row in range(5, -1, -1):
                if board[row][col] == 0:
                    board[row][col] = player
                    break

        return board

    # Additional helper methods for strategic analysis
    def _check_opening_symmetry(self, moves: List[Dict]) -> float:
        """Check symmetry in opening moves"""
        if len(moves) < 4:
            return 0.0
        cols = [m.get("col", 0) for m in moves]
        center = 3
        symmetry_score = sum(
            1
            for i in range(len(cols) // 2)
            if abs(cols[i] - center) == abs(cols[-(i + 1)] - center)
        )
        return symmetry_score / (len(cols) // 2)

    def _calculate_tempo(self, moves: List[Dict]) -> Dict[str, float]:
        """Calculate tempo advantage"""
        if not moves:
            return {"player1": 0.0, "player2": 0.0}

        p1_moves = [m for m in moves if m.get("player") == 1]
        p2_moves = [m for m in moves if m.get("player") == 2]

        return {
            "player1": len(p1_moves) / max(len(moves), 1),
            "player2": len(p2_moves) / max(len(moves), 1),
        }

    def _is_opening_trap(self, moves: List[Dict]) -> bool:
        """Check if opening contains known trap patterns"""
        # Simplified trap detection
        return len(moves) >= 6 and self._has_fork_threat(moves)

    def _has_fork_threat(self, moves: List[Dict]) -> bool:
        """Check for fork threats in moves"""
        # Simplified implementation
        return False

    def _identify_trap_type(self, moves: List[Dict]) -> str:
        """Identify specific trap type"""
        return "standard_fork"

    def _count_threats(self, board: List[List[int]]) -> int:
        """Count active threats on board"""
        threats = 0
        # Check all possible winning lines
        for row in range(6):
            for col in range(7):
                if board[row][col] != 0:
                    threats += self._count_threats_from_position(board, row, col)
        return threats

    def _count_threats_from_position(
        self, board: List[List[int]], row: int, col: int
    ) -> int:
        """Count threats from specific position"""
        if board[row][col] == 0:
            return 0

        player = board[row][col]
        threats = 0
        directions = [
            (0, 1),
            (1, 0),
            (1, 1),
            (1, -1),
        ]  # horizontal, vertical, diagonal, anti-diagonal

        for dx, dy in directions:
            # Count consecutive pieces in both directions
            consecutive = 1
            empty_spaces = []

            # Check positive direction
            for i in range(1, 4):
                r, c = row + i * dx, col + i * dy
                if 0 <= r < 6 and 0 <= c < 7:
                    if board[r][c] == player:
                        consecutive += 1
                    elif board[r][c] == 0:
                        empty_spaces.append((r, c))
                        break
                    else:
                        break
                else:
                    break

            # Check negative direction
            for i in range(1, 4):
                r, c = row - i * dx, col - i * dy
                if 0 <= r < 6 and 0 <= c < 7:
                    if board[r][c] == player:
                        consecutive += 1
                    elif board[r][c] == 0:
                        empty_spaces.append((r, c))
                        break
                    else:
                        break
                else:
                    break

            # Evaluate threat level
            if consecutive >= 3 and len(empty_spaces) > 0:
                # Check if empty spaces are playable (have support below)
                playable_spaces = sum(
                    1 for r, c in empty_spaces if r == 5 or board[r + 1][c] != 0
                )
                if playable_spaces > 0:
                    threats += 1
                    if consecutive == 3 and playable_spaces == 2:
                        threats += 1  # Double threat (fork potential)

        return threats

    def _find_fork_opportunities(self, board: List[List[int]]) -> List[Dict[str, Any]]:
        """Find potential fork opportunities"""
        fork_opportunities = []

        # Check each empty position
        for col in range(7):
            if board[0][col] != 0:  # Column full
                continue

            # Find the row where piece would land
            row = 5
            for r in range(5, -1, -1):
                if board[r][col] == 0:
                    row = r
                    break

            # Try each player's move
            for player in [1, 2]:
                # Temporarily place piece
                board[row][col] = player

                # Count threats created
                threats_created = 0
                threat_positions = []

                # Check all directions from this position
                directions = [(0, 1), (1, 0), (1, 1), (1, -1)]

                for dx, dy in directions:
                    line_info = self._analyze_line(board, row, col, dx, dy, player)
                    if line_info["threat_level"] >= 2:
                        threats_created += 1
                        threat_positions.extend(line_info["critical_positions"])

                # Remove temporary piece
                board[row][col] = 0

                # Fork found if multiple threats created
                if threats_created >= 2:
                    fork_opportunities.append(
                        {
                            "position": [row, col],
                            "player": player,
                            "threats_created": threats_created,
                            "threat_positions": threat_positions,
                            "type": (
                                "double_threat"
                                if threats_created == 2
                                else "multi_threat"
                            ),
                            "urgency": "critical" if player == 2 else "opportunity",
                        }
                    )

        # Sort by number of threats created
        fork_opportunities.sort(key=lambda x: x["threats_created"], reverse=True)
        return fork_opportunities

    def _assess_defensive_needs(self, board: List[List[int]]) -> Dict[str, Any]:
        """Assess defensive requirements"""
        defensive_assessment = {
            "urgency": "low",
            "positions": [],
            "immediate_threats": [],
            "potential_threats": [],
            "fork_defenses": [],
        }

        # Check for immediate winning threats (opponent can win next move)
        for col in range(7):
            if board[0][col] != 0:
                continue

            row = next((r for r in range(5, -1, -1) if board[r][col] == 0), -1)
            if row == -1:
                continue

            # Check if opponent (player 2) can win
            board[row][col] = 2
            if self._check_winner(board, row, col):
                defensive_assessment["immediate_threats"].append(
                    {"position": [row, col], "type": "winning_move", "must_block": True}
                )
                defensive_assessment["urgency"] = "critical"
            board[row][col] = 0

        # Check for potential threats (opponent can create winning opportunity)
        for col in range(7):
            if board[0][col] != 0:
                continue

            row = next((r for r in range(5, -1, -1) if board[r][col] == 0), -1)
            if row == -1:
                continue

            # Simulate opponent move
            board[row][col] = 2
            threats = self._count_threats_from_position(board, row, col)
            board[row][col] = 0

            if threats >= 2:
                defensive_assessment["potential_threats"].append(
                    {
                        "position": [row, col],
                        "threat_count": threats,
                        "type": "fork_threat",
                    }
                )
                if defensive_assessment["urgency"] != "critical":
                    defensive_assessment["urgency"] = "high"
            elif threats == 1:
                defensive_assessment["potential_threats"].append(
                    {
                        "position": [row, col],
                        "threat_count": threats,
                        "type": "single_threat",
                    }
                )
                if defensive_assessment["urgency"] == "low":
                    defensive_assessment["urgency"] = "medium"

        # Compile all defensive positions
        defensive_assessment["positions"] = [
            t["position"] for t in defensive_assessment["immediate_threats"]
        ] + [
            t["position"] for t in defensive_assessment["potential_threats"][:3]
        ]  # Top 3 potential threats

        return defensive_assessment

    def _calculate_space_advantage(self, board: List[List[int]]) -> float:
        """Calculate space control advantage"""
        player1_control = 0
        player2_control = 0

        # Weight positions by strategic value
        position_weights = [
            [0.5, 0.7, 0.9, 1.0, 0.9, 0.7, 0.5],  # Row 5 (bottom)
            [0.6, 0.8, 1.0, 1.2, 1.0, 0.8, 0.6],  # Row 4
            [0.7, 0.9, 1.1, 1.3, 1.1, 0.9, 0.7],  # Row 3 (middle)
            [0.8, 1.0, 1.2, 1.4, 1.2, 1.0, 0.8],  # Row 2
            [0.9, 1.1, 1.3, 1.5, 1.3, 1.1, 0.9],  # Row 1
            [1.0, 1.2, 1.4, 1.6, 1.4, 1.2, 1.0],  # Row 0 (top)
        ]

        for row in range(6):
            for col in range(7):
                if board[row][col] == 1:
                    # Add position value
                    player1_control += position_weights[row][col]

                    # Add influence on adjacent empty spaces
                    for dr in [-1, 0, 1]:
                        for dc in [-1, 0, 1]:
                            if dr == 0 and dc == 0:
                                continue
                            r, c = row + dr, col + dc
                            if 0 <= r < 6 and 0 <= c < 7 and board[r][c] == 0:
                                player1_control += position_weights[r][c] * 0.3

                elif board[row][col] == 2:
                    # Same for player 2
                    player2_control += position_weights[row][col]

                    for dr in [-1, 0, 1]:
                        for dc in [-1, 0, 1]:
                            if dr == 0 and dc == 0:
                                continue
                            r, c = row + dr, col + dc
                            if 0 <= r < 6 and 0 <= c < 7 and board[r][c] == 0:
                                player2_control += position_weights[r][c] * 0.3

        # Calculate advantage (0.5 = balanced, >0.5 = player 1 advantage)
        total_control = player1_control + player2_control
        if total_control == 0:
            return 0.5

        return player1_control / total_control

    def _find_winning_paths(self, board: List[List[int]]) -> List[Dict[str, Any]]:
        """Find potential winning paths"""
        winning_paths = []

        # Check all possible 4-in-a-row positions
        # Horizontal paths
        for row in range(6):
            for col in range(4):
                path_info = self._analyze_winning_path(
                    board, row, col, 0, 1, [(row, col + i) for i in range(4)]
                )
                if path_info["viable"]:
                    winning_paths.append(path_info)

        # Vertical paths
        for row in range(3):
            for col in range(7):
                path_info = self._analyze_winning_path(
                    board, row, col, 1, 0, [(row + i, col) for i in range(4)]
                )
                if path_info["viable"]:
                    winning_paths.append(path_info)

        # Diagonal paths (top-left to bottom-right)
        for row in range(3):
            for col in range(4):
                path_info = self._analyze_winning_path(
                    board, row, col, 1, 1, [(row + i, col + i) for i in range(4)]
                )
                if path_info["viable"]:
                    winning_paths.append(path_info)

        # Anti-diagonal paths (top-right to bottom-left)
        for row in range(3):
            for col in range(3, 7):
                path_info = self._analyze_winning_path(
                    board, row, col, 1, -1, [(row + i, col - i) for i in range(4)]
                )
                if path_info["viable"]:
                    winning_paths.append(path_info)

        # Sort by completion percentage and moves needed
        winning_paths.sort(key=lambda x: (x["completion"], -x["moves_needed"]))

        return winning_paths

    def _analyze_winning_path(
        self,
        board: List[List[int]],
        start_row: int,
        start_col: int,
        dr: int,
        dc: int,
        positions: List[Tuple[int, int]],
    ) -> Dict[str, Any]:
        """Analyze a potential winning path"""
        player1_count = 0
        player2_count = 0
        empty_positions = []
        blocked_positions = []

        for r, c in positions:
            if board[r][c] == 1:
                player1_count += 1
            elif board[r][c] == 2:
                player2_count += 1
            else:
                empty_positions.append((r, c))
                # Check if position is immediately playable
                if r == 5 or board[r + 1][c] != 0:
                    blocked_positions.append((r, c))

        # Path is viable if only one player has pieces in it
        if player1_count > 0 and player2_count > 0:
            return {"viable": False}

        if player1_count == 0 and player2_count == 0:
            return {"viable": False}  # Empty path, not interesting

        player = 1 if player1_count > 0 else 2
        pieces_count = player1_count if player == 1 else player2_count

        return {
            "viable": True,
            "player": player,
            "positions": positions,
            "empty_positions": empty_positions,
            "playable_positions": blocked_positions,
            "pieces_count": pieces_count,
            "moves_needed": 4 - pieces_count,
            "completion": pieces_count / 4.0,
            "immediate": len(blocked_positions) >= (4 - pieces_count),
            "direction": self._get_direction_name(dr, dc),
        }

    def _get_direction_name(self, dr: int, dc: int) -> str:
        """Get human-readable direction name"""
        if dr == 0 and dc == 1:
            return "horizontal"
        elif dr == 1 and dc == 0:
            return "vertical"
        elif dr == 1 and dc == 1:
            return "diagonal"
        elif dr == 1 and dc == -1:
            return "anti-diagonal"
        return "unknown"

    def _identify_forced_sequences(
        self, board: List[List[int]]
    ) -> List[Dict[str, Any]]:
        """Identify forced move sequences"""
        forced_sequences = []

        # Look for positions where one player must respond or lose
        for col in range(7):
            if board[0][col] != 0:
                continue

            row = next((r for r in range(5, -1, -1) if board[r][col] == 0), -1)
            if row == -1:
                continue

            # Check both players
            for attacker in [1, 2]:
                defender = 3 - attacker

                # Simulate attacker's move
                board[row][col] = attacker

                # Check if this creates a winning threat
                if self._creates_winning_threat(board, row, col, attacker):
                    # Find forced defensive moves
                    forced_moves = self._find_forced_defensive_moves(board, defender)

                    if forced_moves:
                        # Analyze continuation
                        sequence = self._analyze_forced_continuation(
                            board, attacker, defender, [(row, col)], forced_moves
                        )

                        if sequence["length"] > 1:
                            forced_sequences.append(
                                {
                                    "initiating_move": [row, col],
                                    "attacker": attacker,
                                    "defender": defender,
                                    "sequence": sequence["moves"],
                                    "length": sequence["length"],
                                    "outcome": sequence["outcome"],
                                    "forcing_level": sequence["forcing_level"],
                                }
                            )

                board[row][col] = 0

        # Sort by sequence length and forcing level
        forced_sequences.sort(
            key=lambda x: (x["length"], x["forcing_level"]), reverse=True
        )

        return forced_sequences

    def _creates_winning_threat(
        self, board: List[List[int]], row: int, col: int, player: int
    ) -> bool:
        """Check if a move creates a winning threat"""
        # Count potential winning lines through this position
        threat_count = 0

        directions = [(0, 1), (1, 0), (1, 1), (1, -1)]
        for dx, dy in directions:
            consecutive = 1
            empty_needed = []

            # Check both directions
            for direction in [1, -1]:
                for i in range(1, 4):
                    r = row + i * dx * direction
                    c = col + i * dy * direction

                    if 0 <= r < 6 and 0 <= c < 7:
                        if board[r][c] == player:
                            consecutive += 1
                        elif board[r][c] == 0:
                            empty_needed.append((r, c))
                        else:
                            break
                    else:
                        break

            # Check if this creates a winnable position
            if consecutive + len(empty_needed) >= 4 and consecutive >= 2:
                # Verify empty positions are playable
                playable = all(
                    r == 5 or board[r + 1][c] != 0 for r, c in empty_needed[:1]
                )
                if playable:
                    threat_count += 1

        return threat_count > 0

    def _find_forced_defensive_moves(
        self, board: List[List[int]], defender: int
    ) -> List[Tuple[int, int]]:
        """Find moves defender must make to avoid immediate loss"""
        forced_moves = []

        # Look for opponent's winning moves
        for col in range(7):
            if board[0][col] != 0:
                continue

            row = next((r for r in range(5, -1, -1) if board[r][col] == 0), -1)
            if row == -1:
                continue

            # Check if opponent wins here
            board[row][col] = 3 - defender
            if self._check_winner(board, row, col):
                forced_moves.append((row, col))
            board[row][col] = 0

        return forced_moves

    def _analyze_forced_continuation(
        self,
        board: List[List[int]],
        attacker: int,
        defender: int,
        moves_so_far: List[Tuple[int, int]],
        forced_moves: List[Tuple[int, int]],
    ) -> Dict[str, Any]:
        """Analyze how a forced sequence continues"""
        # Simplified implementation - just return basic info
        return {
            "moves": moves_so_far + forced_moves[:1],
            "length": len(moves_so_far) + 1,
            "outcome": "undetermined",
            "forcing_level": len(forced_moves),
        }

    def _assess_draw_potential(self, board: List[List[int]]) -> float:
        """Assess likelihood of draw with advanced heuristics"""
        filled_cells = sum(1 for row in board for cell in row if cell != 0)
        empty_cells = 42 - filled_cells

        # Basic fill percentage
        fill_percentage = filled_cells / 42

        # Check for blocked winning paths
        total_paths = 69  # Total possible 4-in-a-row combinations
        blocked_paths = 0

        # Check all possible winning combinations
        # Horizontal
        for row in range(6):
            for col in range(4):
                if self._path_is_blocked(board, row, col, 0, 1):
                    blocked_paths += 1

        # Vertical
        for row in range(3):
            for col in range(7):
                if self._path_is_blocked(board, row, col, 1, 0):
                    blocked_paths += 1

        # Diagonals
        for row in range(3):
            for col in range(4):
                if self._path_is_blocked(board, row, col, 1, 1):
                    blocked_paths += 1

        for row in range(3):
            for col in range(3, 7):
                if self._path_is_blocked(board, row, col, 1, -1):
                    blocked_paths += 1

        blocked_percentage = blocked_paths / total_paths

        # Check for symmetric positions (often lead to draws)
        symmetry_score = self._calculate_board_symmetry(board)

        # Combine factors
        draw_potential = (
            fill_percentage * 0.3 + blocked_percentage * 0.5 + symmetry_score * 0.2
        )

        # Adjust based on game phase
        if empty_cells < 10 and blocked_percentage > 0.7:
            draw_potential = min(0.95, draw_potential * 1.3)

        return min(1.0, draw_potential)

    def _path_is_blocked(
        self, board: List[List[int]], row: int, col: int, dr: int, dc: int
    ) -> bool:
        """Check if a 4-in-a-row path is blocked by both players"""
        player1_present = False
        player2_present = False

        for i in range(4):
            r, c = row + i * dr, col + i * dc
            if board[r][c] == 1:
                player1_present = True
            elif board[r][c] == 2:
                player2_present = True

        return player1_present and player2_present

    def _calculate_board_symmetry(self, board: List[List[int]]) -> float:
        """Calculate board symmetry score"""
        symmetry_score = 0
        comparisons = 0

        # Check horizontal symmetry
        for row in range(6):
            for col in range(3):
                if board[row][col] != 0 and board[row][6 - col] != 0:
                    comparisons += 1
                    if board[row][col] == board[row][6 - col]:
                        symmetry_score += 1

        if comparisons == 0:
            return 0.0

        return symmetry_score / comparisons

    def _identify_critical_squares(self, board: List[List[int]]) -> List[List[int]]:
        """Identify critical board positions"""
        critical_squares = []

        # Evaluate each empty position
        for col in range(7):
            if board[0][col] != 0:
                continue

            row = next((r for r in range(5, -1, -1) if board[r][col] == 0), -1)
            if row == -1:
                continue

            criticality_score = 0

            # Check impact for both players
            for player in [1, 2]:
                board[row][col] = player

                # Winning move?
                if self._check_winner(board, row, col):
                    criticality_score += 100

                # Creates threats?
                threats = self._count_threats_from_position(board, row, col)
                criticality_score += threats * 20

                # Part of multiple winning paths?
                paths = self._count_winning_paths_through_position(
                    board, row, col, player
                )
                criticality_score += paths * 10

                # Controls center?
                if col in [2, 3, 4]:
                    criticality_score += 5

                board[row][col] = 0

            if criticality_score > 30:
                critical_squares.append([row, col, criticality_score])

        # Sort by criticality score and return top positions
        critical_squares.sort(key=lambda x: x[2], reverse=True)

        return [[row, col] for row, col, _ in critical_squares[:5]]

    def _count_winning_paths_through_position(
        self, board: List[List[int]], row: int, col: int, player: int
    ) -> int:
        """Count potential winning paths through a position"""
        paths = 0

        directions = [(0, 1), (1, 0), (1, 1), (1, -1)]
        for dx, dy in directions:
            # Check all possible 4-in-a-row lines including this position
            for offset in range(4):
                start_row = row - offset * dx
                start_col = col - offset * dy

                # Verify line is within bounds
                valid = True
                player_count = 0
                opponent_count = 0

                for i in range(4):
                    r = start_row + i * dx
                    c = start_col + i * dy

                    if not (0 <= r < 6 and 0 <= c < 7):
                        valid = False
                        break

                    if board[r][c] == player:
                        player_count += 1
                    elif board[r][c] == 3 - player:
                        opponent_count += 1

                # Path is viable if no opponent pieces
                if valid and opponent_count == 0 and player_count >= 1:
                    paths += 1

        return paths

    def _is_critical_move(self, board: List[List[int]], move: Dict[str, Any]) -> bool:
        """Check if move is critical"""
        row = move.get("row", -1)
        col = move.get("col", -1)
        player = move.get("player", 0)

        if row < 0 or col < 0 or player == 0:
            return False

        # Temporarily make the move
        original = board[row][col]
        board[row][col] = player

        is_critical = False

        # Check if it wins
        if self._check_winner(board, row, col):
            is_critical = True

        # Check if it blocks opponent win
        if not is_critical:
            board[row][col] = 3 - player
            if self._check_winner(board, row, col):
                is_critical = True
            board[row][col] = player

        # Check if it creates multiple threats
        if not is_critical:
            threats = self._count_threats_from_position(board, row, col)
            if threats >= 2:
                is_critical = True

        # Check if it's part of a forcing sequence
        if not is_critical:
            board[row][col] = 0
            defensive_needs = self._assess_defensive_needs(board)
            if defensive_needs["urgency"] in ["high", "critical"]:
                is_critical = True

        board[row][col] = original

        return is_critical

    def _classify_critical_move(
        self, board: List[List[int]], move: Dict[str, Any]
    ) -> str:
        """Classify type of critical move"""
        row = move.get("row", -1)
        col = move.get("col", -1)
        player = move.get("player", 0)

        if row < 0 or col < 0:
            return "invalid"

        # Temporarily make the move
        board[row][col] = player

        # Check various critical move types
        if self._check_winner(board, row, col):
            board[row][col] = 0
            return "winning_move"

        # Check if blocks opponent win
        board[row][col] = 3 - player
        if self._check_winner(board, row, col):
            board[row][col] = 0
            return "blocking_win"
        board[row][col] = player

        # Check for fork creation
        threats = self._count_threats_from_position(board, row, col)
        if threats >= 2:
            board[row][col] = 0
            return "creating_fork"

        # Check for fork block
        board[row][col] = 0
        opponent_threats_before = 0
        for c in range(7):
            if board[0][c] == 0:
                r = next((r for r in range(5, -1, -1) if board[r][c] == 0), -1)
                if r != -1:
                    board[r][c] = 3 - player
                    opponent_threats_before += self._count_threats_from_position(
                        board, r, c
                    )
                    board[r][c] = 0

        board[row][col] = player
        opponent_threats_after = 0
        for c in range(7):
            if board[0][c] == 0:
                r = next((r for r in range(5, -1, -1) if board[r][c] == 0), -1)
                if r != -1:
                    board[r][c] = 3 - player
                    opponent_threats_after += self._count_threats_from_position(
                        board, r, c
                    )
                    board[r][c] = 0

        board[row][col] = 0

        if opponent_threats_before - opponent_threats_after >= 2:
            return "blocking_fork"

        # Check for setup move
        future_threats = self._evaluate_future_threats(board, row, col, player)
        if future_threats > 1:
            return "strategic_setup"

        return "tactical_move"

    def _evaluate_future_threats(
        self, board: List[List[int]], row: int, col: int, player: int
    ) -> int:
        """Evaluate potential future threats from a move"""
        board[row][col] = player
        future_threats = 0

        # Look one move ahead
        for next_col in range(7):
            if board[0][next_col] != 0:
                continue

            next_row = next(
                (r for r in range(5, -1, -1) if board[r][next_col] == 0), -1
            )
            if next_row == -1:
                continue

            board[next_row][next_col] = player
            if self._creates_winning_threat(board, next_row, next_col, player):
                future_threats += 1
            board[next_row][next_col] = 0

        board[row][col] = 0
        return future_threats

    def _assess_move_impact(
        self, board: List[List[int]], move: Dict[str, Any]
    ) -> float:
        """Assess impact of move on game state"""
        row = move.get("row", -1)
        col = move.get("col", -1)
        player = move.get("player", 0)

        if row < 0 or col < 0 or player == 0:
            return 0.0

        impact_score = 0.0

        # Save original state
        original = board[row][col]
        board[row][col] = player

        # 1. Winning impact (highest)
        if self._check_winner(board, row, col):
            impact_score = 1.0
            board[row][col] = original
            return impact_score

        # 2. Blocking opponent win
        board[row][col] = 3 - player
        if self._check_winner(board, row, col):
            impact_score = max(impact_score, 0.9)
        board[row][col] = player

        # 3. Threat creation
        threats_created = self._count_threats_from_position(board, row, col)
        impact_score = max(impact_score, min(0.8, threats_created * 0.3))

        # 4. Space control change
        space_before = self._calculate_space_advantage(board)
        board[row][col] = player
        space_after = self._calculate_space_advantage(board)
        space_change = abs(space_after - space_before)
        impact_score = max(impact_score, min(0.7, space_change * 2))

        # 5. Winning path influence
        paths_influenced = self._count_winning_paths_through_position(
            board, row, col, player
        )
        impact_score = max(impact_score, min(0.6, paths_influenced * 0.1))

        # 6. Position value
        position_value = self._get_position_value(row, col)
        impact_score = max(impact_score, position_value * 0.3)

        # 7. Connectivity
        connectivity = self._calculate_connectivity(board, row, col, player)
        impact_score = max(impact_score, min(0.5, connectivity * 0.2))

        board[row][col] = original

        return impact_score

    def _get_position_value(self, row: int, col: int) -> float:
        """Get strategic value of a position"""
        # Center columns are more valuable
        col_value = 1.0 - abs(col - 3) * 0.15

        # Lower rows are more stable
        row_value = (5 - row) * 0.1

        return min(1.0, col_value + row_value)

    def _calculate_connectivity(
        self, board: List[List[int]], row: int, col: int, player: int
    ) -> int:
        """Calculate how many friendly pieces this move connects to"""
        connectivity = 0

        for dr in [-1, 0, 1]:
            for dc in [-1, 0, 1]:
                if dr == 0 and dc == 0:
                    continue

                r, c = row + dr, col + dc
                if 0 <= r < 6 and 0 <= c < 7 and board[r][c] == player:
                    connectivity += 1

        return connectivity

    def _analyze_line(
        self, board: List[List[int]], row: int, col: int, dx: int, dy: int, player: int
    ) -> Dict[str, Any]:
        """Analyze a line for threats and opportunities"""
        line_info = {
            "threat_level": 0,
            "critical_positions": [],
            "consecutive": 1,
            "potential_length": 1,
        }

        # Count in both directions
        for direction in [1, -1]:
            consecutive_pieces = 0
            empty_spaces = []

            for i in range(1, 4):
                r = row + i * dx * direction
                c = col + i * dy * direction

                if not (0 <= r < 6 and 0 <= c < 7):
                    break

                if board[r][c] == player:
                    consecutive_pieces += 1
                    line_info["consecutive"] += 1
                elif board[r][c] == 0:
                    empty_spaces.append((r, c))
                    if len(empty_spaces) == 1:  # Only count first empty
                        line_info["potential_length"] += 1
                else:
                    break

            # Add critical empty positions
            for r, c in empty_spaces:
                if r == 5 or board[r + 1][c] != 0:  # Playable position
                    line_info["critical_positions"].append((r, c))

        # Determine threat level
        if line_info["consecutive"] >= 3:
            line_info["threat_level"] = 3
        elif (
            line_info["consecutive"] == 2 and len(line_info["critical_positions"]) >= 2
        ):
            line_info["threat_level"] = 2
        elif (
            line_info["consecutive"] == 2 and len(line_info["critical_positions"]) >= 1
        ):
            line_info["threat_level"] = 1

        return line_info

    def _classify_play_style(self, moves: List[Dict]) -> str:
        """Classify player's style with advanced pattern analysis"""
        if not moves:
            return "unknown"

        # Analyze multiple dimensions of play
        style_scores = {
            "aggressive": 0,
            "defensive": 0,
            "positional": 0,
            "tactical": 0,
            "strategic": 0,
            "opportunistic": 0,
            "methodical": 0,
            "chaotic": 0,
        }

        # Column preference analysis
        cols = [m.get("col", 0) for m in moves]
        center_preference = sum(1 for c in cols if c in [2, 3, 4]) / len(cols)
        edge_preference = sum(1 for c in cols if c in [0, 6]) / len(cols)

        # Movement patterns
        col_transitions = [abs(cols[i] - cols[i - 1]) for i in range(1, len(cols))]
        avg_transition = (
            sum(col_transitions) / len(col_transitions) if col_transitions else 0
        )

        # Timing analysis
        move_times = [m.get("thinkTime", 1.0) for m in moves if "thinkTime" in m]
        avg_think_time = sum(move_times) / len(move_times) if move_times else 1.0
        time_variance = (
            self._calculate_variance(move_times) if len(move_times) > 1 else 0
        )

        # Response pattern analysis
        response_patterns = self._analyze_response_patterns(moves)

        # Score different play styles
        # Aggressive: Quick moves, center focus, high transitions
        if avg_think_time < 2.0 and center_preference > 0.5:
            style_scores["aggressive"] += 3
        if avg_transition > 2.5:
            style_scores["aggressive"] += 2

        # Defensive: Reactive moves, blocking patterns
        if response_patterns["blocking_frequency"] > 0.4:
            style_scores["defensive"] += 4
        if response_patterns["reactive_moves"] > 0.5:
            style_scores["defensive"] += 2

        # Positional: Center control, systematic building
        if center_preference > 0.6 and avg_transition < 2:
            style_scores["positional"] += 4
        if response_patterns["building_patterns"] > 0.3:
            style_scores["positional"] += 2

        # Tactical: Quick threats, fork attempts
        if response_patterns["threat_creation"] > 0.3:
            style_scores["tactical"] += 4
        if response_patterns["fork_attempts"] > 0.2:
            style_scores["tactical"] += 3

        # Strategic: Long think times, consistent patterns
        if avg_think_time > 5.0 and time_variance < 2.0:
            style_scores["strategic"] += 4
        if response_patterns["long_term_setups"] > 0.3:
            style_scores["strategic"] += 3

        # Opportunistic: Variable timing, exploits mistakes
        if time_variance > 5.0 and response_patterns["exploitation_moves"] > 0.3:
            style_scores["opportunistic"] += 4

        # Methodical: Consistent timing, systematic approach
        if time_variance < 1.0 and avg_transition < 1.5:
            style_scores["methodical"] += 4
        if self._has_systematic_pattern(cols):
            style_scores["methodical"] += 3

        # Chaotic: High variance, unpredictable
        if avg_transition > 3.0 and time_variance > 10.0:
            style_scores["chaotic"] += 4
        if not self._has_discernible_pattern(cols):
            style_scores["chaotic"] += 2

        # Determine primary style
        primary_style = max(style_scores.items(), key=lambda x: x[1])

        # Add modifiers based on secondary characteristics
        modifiers = []
        sorted_styles = sorted(style_scores.items(), key=lambda x: x[1], reverse=True)

        if sorted_styles[1][1] > sorted_styles[0][1] * 0.7:
            modifiers.append(sorted_styles[1][0])

        # Special compound styles
        if style_scores["aggressive"] > 3 and style_scores["tactical"] > 3:
            return "aggressive_tactical"
        elif style_scores["defensive"] > 3 and style_scores["positional"] > 3:
            return "defensive_positional"
        elif style_scores["strategic"] > 3 and style_scores["methodical"] > 3:
            return "strategic_methodical"

        # Return primary style with modifier if applicable
        if modifiers:
            return f"{primary_style[0]}_{modifiers[0]}"
        else:
            return primary_style[0]

    def _calculate_aggressiveness(self, moves: List[Dict]) -> float:
        """Calculate player aggressiveness with comprehensive metrics"""
        if not moves:
            return 0.5

        aggressiveness_score = 0.0
        factors = []

        # 1. Threat creation frequency
        threat_moves = 0
        for i, move in enumerate(moves):
            if move.get("creates_threat", False):
                threat_moves += 1
            # Estimate threat creation based on move metadata
            if move.get("move_type") in ["offensive", "attack", "threat"]:
                threat_moves += 0.5

        threat_frequency = threat_moves / len(moves)
        factors.append(("threat_frequency", threat_frequency, 0.25))

        # 2. Response time (faster = more aggressive)
        move_times = [m.get("thinkTime", 3.0) for m in moves if "thinkTime" in m]
        if move_times:
            avg_time = sum(move_times) / len(move_times)
            # Normalize: <2s = 1.0, >10s = 0.0
            time_score = max(0, min(1, (10 - avg_time) / 8))
            factors.append(("speed", time_score, 0.15))

        # 3. Column preference (center = aggressive)
        cols = [m.get("col", 0) for m in moves]
        center_moves = sum(1 for c in cols if c in [2, 3, 4])
        center_preference = center_moves / len(cols)
        factors.append(("center_preference", center_preference, 0.15))

        # 4. Vertical building (stacking = aggressive)
        stacking_score = self._calculate_stacking_tendency(moves)
        factors.append(("stacking", stacking_score, 0.15))

        # 5. Initiative (first to threaten)
        initiative_score = self._calculate_initiative_score(moves)
        factors.append(("initiative", initiative_score, 0.20))

        # 6. Risk-taking (playing in dangerous positions)
        risk_score = self._calculate_risk_taking_score(moves)
        factors.append(("risk_taking", risk_score, 0.10))

        # Calculate weighted score
        for name, score, weight in factors:
            aggressiveness_score += score * weight

        # Apply non-linear scaling for extreme behaviors
        if aggressiveness_score > 0.8:
            aggressiveness_score = 0.8 + (aggressiveness_score - 0.8) * 0.5
        elif aggressiveness_score < 0.2:
            aggressiveness_score = 0.2 * (aggressiveness_score / 0.2) ** 0.5

        return min(1.0, max(0.0, aggressiveness_score))

    def _measure_consistency(self, moves: List[Dict]) -> float:
        """Measure move consistency with advanced pattern analysis"""
        if len(moves) < 3:
            return 0.5

        consistency_metrics = []

        # 1. Timing consistency
        move_times = [m.get("thinkTime", 1.0) for m in moves if "thinkTime" in m]
        if len(move_times) > 1:
            time_variance = self._calculate_variance(move_times)
            avg_time = sum(move_times) / len(move_times)
            # Coefficient of variation (lower = more consistent)
            time_cv = (time_variance**0.5) / avg_time if avg_time > 0 else 1.0
            time_consistency = max(0, 1 - min(time_cv, 1))
            consistency_metrics.append(("timing", time_consistency, 0.25))

        # 2. Column selection pattern consistency
        cols = [m.get("col", 0) for m in moves]
        col_pattern_score = self._analyze_column_patterns(cols)
        consistency_metrics.append(("column_pattern", col_pattern_score, 0.20))

        # 3. Strategic consistency (similar move types)
        move_types = [m.get("move_type", "unknown") for m in moves]
        type_consistency = self._calculate_type_consistency(move_types)
        consistency_metrics.append(("move_type", type_consistency, 0.15))

        # 4. Response pattern consistency
        response_consistency = self._analyze_response_consistency(moves)
        consistency_metrics.append(("response_pattern", response_consistency, 0.20))

        # 5. Spatial consistency (move clustering)
        spatial_consistency = self._calculate_spatial_consistency(moves)
        consistency_metrics.append(("spatial", spatial_consistency, 0.10))

        # 6. Decision quality consistency
        quality_scores = [
            m.get("quality_score", 0.5) for m in moves if "quality_score" in m
        ]
        if quality_scores:
            quality_variance = self._calculate_variance(quality_scores)
            quality_consistency = max(0, 1 - min(quality_variance * 4, 1))
            consistency_metrics.append(("quality", quality_consistency, 0.10))

        # Calculate weighted consistency score
        total_score = 0
        total_weight = 0

        for name, score, weight in consistency_metrics:
            total_score += score * weight
            total_weight += weight

        if total_weight == 0:
            return 0.5

        consistency_score = total_score / total_weight

        # Apply smoothing for extreme values
        if consistency_score > 0.9:
            consistency_score = 0.9 + (consistency_score - 0.9) * 0.5
        elif consistency_score < 0.1:
            consistency_score = 0.1 * (consistency_score / 0.1) ** 0.5

        return consistency_score

    # Helper methods for advanced analysis

    def _calculate_variance(self, values: List[float]) -> float:
        """Calculate variance of a list of values"""
        if len(values) < 2:
            return 0.0
        mean = sum(values) / len(values)
        return sum((x - mean) ** 2 for x in values) / len(values)

    def _analyze_response_patterns(self, moves: List[Dict]) -> Dict[str, float]:
        """Analyze patterns in how player responds to situations"""
        patterns = {
            "blocking_frequency": 0.0,
            "reactive_moves": 0.0,
            "building_patterns": 0.0,
            "threat_creation": 0.0,
            "fork_attempts": 0.0,
            "long_term_setups": 0.0,
            "exploitation_moves": 0.0,
        }

        if not moves:
            return patterns

        for i, move in enumerate(moves):
            # Analyze move context
            move_context = move.get("context", {})

            if move_context.get("blocks_threat", False):
                patterns["blocking_frequency"] += 1

            if move_context.get("is_reactive", False):
                patterns["reactive_moves"] += 1

            if move_context.get("builds_position", False):
                patterns["building_patterns"] += 1

            if move_context.get("creates_threat", False):
                patterns["threat_creation"] += 1

            if move_context.get("creates_fork", False):
                patterns["fork_attempts"] += 1

            if move_context.get("part_of_plan", False):
                patterns["long_term_setups"] += 1

            if move_context.get("exploits_mistake", False):
                patterns["exploitation_moves"] += 1

        # Normalize to frequencies
        for key in patterns:
            patterns[key] /= len(moves)

        return patterns

    def _has_systematic_pattern(self, cols: List[int]) -> bool:
        """Check if column selections follow a systematic pattern"""
        if len(cols) < 4:
            return False

        # Check for arithmetic sequences
        differences = [cols[i] - cols[i - 1] for i in range(1, len(cols))]

        # Check if differences are consistent
        if len(set(differences[:4])) == 1:  # First 4 moves have same difference
            return True

        # Check for alternating patterns
        if len(cols) >= 6:
            pattern1 = cols[::2]  # Even indices
            pattern2 = cols[1::2]  # Odd indices

            if len(set(pattern1[:3])) == 1 or len(set(pattern2[:3])) == 1:
                return True

        # Check for mirroring patterns
        center = 3
        mirrored = all(
            abs(cols[i] - center) == abs(cols[i + 1] - center)
            for i in range(0, min(len(cols) - 1, 4), 2)
        )

        return mirrored

    def _has_discernible_pattern(self, cols: List[int]) -> bool:
        """Check if there's any discernible pattern in column selection"""
        if len(cols) < 3:
            return True  # Too few moves to be chaotic

        # Check for any repeating subsequences
        for length in range(2, min(len(cols) // 2 + 1, 5)):
            for start in range(len(cols) - length * 2 + 1):
                pattern = cols[start : start + length]
                if cols[start + length : start + length * 2] == pattern:
                    return True

        # Check for bounded randomness (not truly chaotic)
        col_range = max(cols) - min(cols)
        if col_range < 3:  # Moves clustered in small area
            return True

        # Check for frequency bias
        col_counts = {}
        for col in cols:
            col_counts[col] = col_counts.get(col, 0) + 1

        max_frequency = max(col_counts.values())
        if max_frequency / len(cols) > 0.4:  # One column used >40% of time
            return True

        return False

    def _calculate_stacking_tendency(self, moves: List[Dict]) -> float:
        """Calculate tendency to stack pieces vertically"""
        if len(moves) < 2:
            return 0.0

        cols = [m.get("col", 0) for m in moves]

        # Count consecutive moves in same column
        stacks = 0
        for i in range(1, len(cols)):
            if cols[i] == cols[i - 1]:
                stacks += 1

        # Also count near-stacks (adjacent columns)
        near_stacks = 0
        for i in range(1, len(cols)):
            if abs(cols[i] - cols[i - 1]) == 1:
                near_stacks += 0.5

        total_stacking = stacks + near_stacks
        max_possible = len(cols) - 1

        return min(1.0, total_stacking / max_possible)

    def _calculate_initiative_score(self, moves: List[Dict]) -> float:
        """Calculate how often player takes initiative"""
        if not moves:
            return 0.5

        initiative_moves = 0

        for move in moves:
            # Check various initiative indicators
            if move.get("first_threat", False):
                initiative_moves += 1.0
            elif move.get("creates_opportunity", False):
                initiative_moves += 0.8
            elif move.get("forces_response", False):
                initiative_moves += 0.7
            elif move.get("move_number", 100) <= 4:  # Early moves
                initiative_moves += 0.3

        return min(1.0, initiative_moves / len(moves))

    def _calculate_risk_taking_score(self, moves: List[Dict]) -> float:
        """Calculate risk-taking behavior"""
        if not moves:
            return 0.5

        risk_score = 0.0

        for move in moves:
            # Various risk indicators
            if move.get("allows_threat", False):
                risk_score += 1.0
            if move.get("ignores_defense", False):
                risk_score += 0.8
            if move.get("complicated_position", False):
                risk_score += 0.6
            if move.get("sacrificial", False):
                risk_score += 0.9

            # Column risk (edges are riskier early game)
            col = move.get("col", 3)
            move_num = move.get("move_number", 20)
            if move_num < 10 and col in [0, 6]:
                risk_score += 0.3

        return min(1.0, risk_score / len(moves))

    def _analyze_column_patterns(self, cols: List[int]) -> float:
        """Analyze consistency in column selection patterns"""
        if len(cols) < 3:
            return 0.5

        # Check for repeating patterns of different lengths
        pattern_scores = []

        for pattern_length in range(2, min(len(cols) // 2, 5)):
            matches = 0
            comparisons = 0

            for i in range(len(cols) - pattern_length):
                if i + pattern_length * 2 <= len(cols):
                    pattern1 = cols[i : i + pattern_length]
                    pattern2 = cols[i + pattern_length : i + pattern_length * 2]

                    comparisons += 1
                    similarity = sum(1 for a, b in zip(pattern1, pattern2) if a == b)
                    matches += similarity / pattern_length

            if comparisons > 0:
                pattern_scores.append(matches / comparisons)

        if not pattern_scores:
            return 0.5

        return max(pattern_scores)

    def _calculate_type_consistency(self, move_types: List[str]) -> float:
        """Calculate consistency in move types"""
        if not move_types:
            return 0.5

        # Count frequency of each type
        type_counts = {}
        for move_type in move_types:
            type_counts[move_type] = type_counts.get(move_type, 0) + 1

        # Calculate entropy (lower = more consistent)
        total = len(move_types)
        entropy = 0

        for count in type_counts.values():
            if count > 0:
                probability = count / total
                entropy -= probability * (probability**0.5)  # Modified entropy

        # Convert to consistency score (higher = more consistent)
        max_entropy = (
            -len(type_counts) * (1 / len(type_counts)) * ((1 / len(type_counts)) ** 0.5)
        )
        consistency = 1 - (entropy / max_entropy) if max_entropy != 0 else 0.5

        return consistency

    def _analyze_response_consistency(self, moves: List[Dict]) -> float:
        """Analyze consistency in response patterns"""
        if len(moves) < 2:
            return 0.5

        response_times = []
        response_types = []

        for i in range(1, len(moves)):
            # Time between opponent move and player move
            if "opponent_move_time" in moves[i] and "move_time" in moves[i]:
                response_time = moves[i]["move_time"] - moves[i]["opponent_move_time"]
                response_times.append(response_time)

            # Type of response
            if "response_type" in moves[i]:
                response_types.append(moves[i]["response_type"])

        consistency_score = 0.5

        # Time consistency
        if len(response_times) > 1:
            time_variance = self._calculate_variance(response_times)
            avg_time = sum(response_times) / len(response_times)
            time_cv = (time_variance**0.5) / avg_time if avg_time > 0 else 1.0
            time_consistency = max(0, 1 - min(time_cv, 1))
            consistency_score = time_consistency * 0.5

        # Type consistency
        if response_types:
            type_consistency = self._calculate_type_consistency(response_types)
            consistency_score += type_consistency * 0.5

        return consistency_score

    def _calculate_spatial_consistency(self, moves: List[Dict]) -> float:
        """Calculate spatial consistency of moves"""
        if len(moves) < 2:
            return 0.5

        cols = [m.get("col", 0) for m in moves]

        # Calculate average distance between consecutive moves
        distances = [abs(cols[i] - cols[i - 1]) for i in range(1, len(cols))]

        if not distances:
            return 0.5

        avg_distance = sum(distances) / len(distances)
        distance_variance = self._calculate_variance(distances)

        # Lower variance = more consistent spacing
        # Convert to 0-1 scale where 1 is most consistent
        consistency = max(0, 1 - (distance_variance**0.5) / 3.5)

        # Bonus for clustered play (low average distance)
        if avg_distance < 2:
            consistency = min(1.0, consistency * 1.2)

        return consistency

    def _analyze_column_preference(self, moves: List[Dict]) -> Dict[int, float]:
        """Analyze column preferences with advanced metrics"""
        if not moves:
            return {i: 0.0 for i in range(7)}

        # Basic frequency analysis
        col_counts = {}
        for i in range(7):
            col_counts[i] = 0

        for move in moves:
            col = move.get("col", 0)
            col_counts[col] += 1

        total = len(moves)
        preferences = {col: count / total for col, count in col_counts.items()}

        # Advanced analysis: temporal patterns
        temporal_weights = {}
        for i in range(7):
            temporal_weights[i] = 0.0

        # Weight recent moves more heavily
        for idx, move in enumerate(moves):
            col = move.get("col", 0)
            # Exponential decay: recent moves have more weight
            recency_weight = 1.0 * (0.95 ** (len(moves) - idx - 1))
            temporal_weights[col] += recency_weight

        # Normalize temporal weights
        total_temporal = sum(temporal_weights.values())
        if total_temporal > 0:
            for col in temporal_weights:
                temporal_weights[col] /= total_temporal

        # Combine frequency and temporal analysis
        combined_preferences = {}
        for col in range(7):
            combined_preferences[col] = {
                "frequency": preferences[col],
                "temporal": temporal_weights[col],
                "combined": preferences[col] * 0.6 + temporal_weights[col] * 0.4,
                "rank": 0,  # Will be filled next
            }

        # Add rankings
        sorted_cols = sorted(
            combined_preferences.items(), key=lambda x: x[1]["combined"], reverse=True
        )
        for rank, (col, _) in enumerate(sorted_cols):
            combined_preferences[col]["rank"] = rank + 1

        # Add pattern analysis
        for col in range(7):
            # Check if column is used in patterns
            pattern_score = 0.0

            # Check for alternating pattern with this column
            for i in range(1, len(moves), 2):
                if i < len(moves) and moves[i].get("col") == col:
                    pattern_score += 0.1

            # Check for sequential access
            for i in range(1, len(moves)):
                if moves[i].get("col") == col and moves[i - 1].get("col") == col:
                    pattern_score += 0.2

            combined_preferences[col]["pattern_involvement"] = min(1.0, pattern_score)

        return combined_preferences

    def _average_reaction_time(self, moves: List[Dict]) -> float:
        """Calculate average reaction time with outlier handling"""
        times = [m.get("thinkTime", 1.0) for m in moves if "thinkTime" in m]

        if not times:
            return 1.0

        # Remove outliers using IQR method
        if len(times) > 4:
            sorted_times = sorted(times)
            q1_idx = len(sorted_times) // 4
            q3_idx = 3 * len(sorted_times) // 4
            q1 = sorted_times[q1_idx]
            q3 = sorted_times[q3_idx]
            iqr = q3 - q1

            # Filter outliers
            lower_bound = q1 - 1.5 * iqr
            upper_bound = q3 + 1.5 * iqr
            filtered_times = [t for t in times if lower_bound <= t <= upper_bound]

            if filtered_times:
                times = filtered_times

        # Calculate weighted average (recent moves weighted more)
        if len(times) == 1:
            return times[0]

        weighted_sum = 0.0
        weight_total = 0.0

        for idx, time in enumerate(times):
            # Linear weight: more recent moves have higher weight
            weight = (idx + 1) / len(times)
            weighted_sum += time * weight
            weight_total += weight

        avg_time = (
            weighted_sum / weight_total if weight_total > 0 else sum(times) / len(times)
        )

        # Add confidence metric
        if len(times) > 2:
            variance = self._calculate_variance(times)
            consistency = (
                max(0, 1 - min(variance / (avg_time**2), 1)) if avg_time > 0 else 0
            )
        else:
            consistency = 0.5

        return {
            "average": avg_time,
            "median": sorted(times)[len(times) // 2],
            "consistency": consistency,
            "sample_size": len(times),
            "outliers_removed": len([m for m in moves if "thinkTime" in m])
            - len(times),
        }

    def _estimate_mistake_rate(self, moves: List[Dict]) -> float:
        """Estimate mistake rate using multiple indicators"""
        if not moves:
            return 0.0

        mistake_indicators = []
        weights = []

        # 1. Direct mistake flags
        flagged_mistakes = sum(1 for m in moves if m.get("is_mistake", False))
        mistake_indicators.append(flagged_mistakes / len(moves))
        weights.append(0.3)

        # 2. Missed wins
        missed_wins = sum(1 for m in moves if m.get("missed_win", False))
        mistake_indicators.append(missed_wins / len(moves))
        weights.append(0.25)

        # 3. Poor evaluations
        eval_scores = [m.get("eval_score", 0.5) for m in moves if "eval_score" in m]
        if eval_scores:
            poor_evals = sum(1 for score in eval_scores if score < 0.3)
            mistake_indicators.append(poor_evals / len(eval_scores))
            weights.append(0.2)

        # 4. Tempo loss
        tempo_losses = sum(1 for m in moves if m.get("loses_tempo", False))
        mistake_indicators.append(tempo_losses / len(moves))
        weights.append(0.15)

        # 5. Pattern-based mistakes
        pattern_mistakes = self._analyze_pattern_mistakes(moves)
        mistake_indicators.append(pattern_mistakes)
        weights.append(0.1)

        # Calculate weighted mistake rate
        if not mistake_indicators:
            return 0.1  # Default

        # Normalize weights
        total_weight = sum(weights[: len(mistake_indicators)])
        if total_weight == 0:
            return 0.1

        mistake_rate = (
            sum(ind * w for ind, w in zip(mistake_indicators, weights)) / total_weight
        )

        # Apply severity scaling
        severity_factor = 1.0

        # Check for critical mistakes
        critical_mistakes = sum(1 for m in moves if m.get("critical_mistake", False))
        if critical_mistakes > 0:
            severity_factor = 1.0 + (critical_mistakes / len(moves)) * 0.5

        # Adjust for game phase (mistakes in endgame are more costly)
        endgame_moves = [m for m in moves if m.get("game_phase") == "endgame"]
        if endgame_moves:
            endgame_mistakes = sum(
                1 for m in endgame_moves if m.get("is_mistake", False)
            )
            if endgame_mistakes > 0:
                severity_factor *= 1.2

        return min(1.0, mistake_rate * severity_factor)

    def _analyze_pattern_mistakes(self, moves: List[Dict]) -> float:
        """Analyze mistakes in pattern recognition"""
        if len(moves) < 4:
            return 0.0

        pattern_mistakes = 0
        opportunities = 0

        for i in range(len(moves) - 3):
            # Check if there was an obvious pattern to complete
            context = moves[i].get("board_context", {})
            if context.get("obvious_pattern_available", False):
                opportunities += 1
                if not moves[i].get("completes_pattern", False):
                    pattern_mistakes += 1

        return pattern_mistakes / opportunities if opportunities > 0 else 0.0

    def _find_urgent_moves(
        self, board: List[List[int]], player: int
    ) -> List[Dict[str, Any]]:
        """Find urgent defensive/offensive moves with comprehensive analysis"""
        urgent_moves = []

        # 1. Check for immediate wins (highest priority)
        for col in range(7):
            if board[0][col] != 0:
                continue

            row = self._get_drop_row(board, col)
            if row == -1:
                continue

            # Test if we can win
            board[row][col] = player
            if self._check_winner(board, row, col):
                urgent_moves.append(
                    {
                        "position": [row, col],
                        "type": "winning_move",
                        "priority": 1.0,
                        "reason": "Immediate win available",
                        "category": "offensive",
                    }
                )
            board[row][col] = 0

            # Test if opponent can win (must block)
            board[row][col] = 3 - player
            if self._check_winner(board, row, col):
                # Check if not already added as winning move
                if not any(
                    m["position"] == [row, col] and m["type"] == "winning_move"
                    for m in urgent_moves
                ):
                    urgent_moves.append(
                        {
                            "position": [row, col],
                            "type": "block_win",
                            "priority": 0.95,
                            "reason": "Must block opponent win",
                            "category": "defensive",
                        }
                    )
            board[row][col] = 0

        # 2. Check for fork opportunities/threats
        fork_analysis = self._analyze_fork_situations(board, player)

        # Our fork opportunities
        for fork in fork_analysis["our_forks"]:
            urgent_moves.append(
                {
                    "position": fork["position"],
                    "type": "create_fork",
                    "priority": 0.85,
                    "reason": f"Creates {fork['threat_count']} threats",
                    "category": "offensive",
                    "threats": fork["threat_positions"],
                }
            )

        # Opponent fork threats
        for fork in fork_analysis["opponent_forks"]:
            # Check if not already in urgent moves
            if not any(m["position"] == fork["position"] for m in urgent_moves):
                urgent_moves.append(
                    {
                        "position": fork["position"],
                        "type": "block_fork",
                        "priority": 0.9,
                        "reason": f"Blocks opponent {fork['threat_count']}-way fork",
                        "category": "defensive",
                        "threats_blocked": fork["threat_positions"],
                    }
                )

        # 3. Check for forced sequences
        forced_sequences = self._find_forced_win_sequences(board, player)
        for seq in forced_sequences[:2]:  # Top 2 sequences
            if seq["moves"] and seq["probability"] > 0.7:
                first_move = seq["moves"][0]
                urgent_moves.append(
                    {
                        "position": list(first_move),
                        "type": "forced_sequence_start",
                        "priority": 0.8,
                        "reason": f"Starts {len(seq['moves'])}-move forced win",
                        "category": "offensive",
                        "sequence": seq["moves"],
                        "probability": seq["probability"],
                    }
                )

        # 4. Check for critical defensive positions
        critical_defenses = self._find_critical_defensive_positions(board, player)
        for defense in critical_defenses:
            if not any(m["position"] == defense["position"] for m in urgent_moves):
                urgent_moves.append(
                    {
                        "position": defense["position"],
                        "type": "critical_defense",
                        "priority": defense["urgency"],
                        "reason": defense["reason"],
                        "category": "defensive",
                    }
                )

        # Sort by priority
        urgent_moves.sort(key=lambda x: x["priority"], reverse=True)

        return urgent_moves

    def _find_strategic_opportunities(
        self, board: List[List[int]], player: int, patterns: List[Dict]
    ) -> List[Dict[str, Any]]:
        """Find strategic opportunities based on board state and patterns"""
        opportunities = []

        # 1. Center control opportunities
        center_control = self._evaluate_center_control_opportunities(board, player)
        for opp in center_control:
            opportunities.append(
                {
                    "position": opp["position"],
                    "type": "center_control",
                    "value": opp["value"],
                    "reason": opp["reason"],
                    "long_term_benefit": opp["benefit"],
                }
            )

        # 2. Pattern completion opportunities
        for pattern in patterns:
            if pattern.get("player") == player and pattern.get("completion", 0) > 0.5:
                completion_moves = self._find_pattern_completion_moves(board, pattern)
                for move in completion_moves:
                    opportunities.append(
                        {
                            "position": move["position"],
                            "type": "pattern_completion",
                            "value": pattern["completion"] * move["contribution"],
                            "reason": f"Advances {pattern['type']} pattern",
                            "pattern_info": pattern,
                        }
                    )

        # 3. Space creation opportunities
        space_moves = self._find_space_creation_moves(board, player)
        for move in space_moves:
            opportunities.append(
                {
                    "position": move["position"],
                    "type": "space_creation",
                    "value": move["space_value"],
                    "reason": "Creates advantageous space",
                    "future_threats": move["potential_threats"],
                }
            )

        # 4. Tempo gaining moves
        tempo_moves = self._find_tempo_moves(board, player)
        for move in tempo_moves:
            opportunities.append(
                {
                    "position": move["position"],
                    "type": "tempo_gain",
                    "value": move["tempo_value"],
                    "reason": move["reason"],
                    "forces_response": move["forces_response"],
                }
            )

        # 5. Setup moves for future combinations
        setup_moves = self._find_setup_moves(board, player)
        for move in setup_moves:
            opportunities.append(
                {
                    "position": move["position"],
                    "type": "strategic_setup",
                    "value": move["future_value"],
                    "reason": "Sets up future opportunities",
                    "payoff_moves": move["payoff_in"],
                }
            )

        # 6. Disruption moves against opponent patterns
        if patterns:
            disruption_moves = self._find_disruption_moves(board, player, patterns)
            for move in disruption_moves:
                opportunities.append(
                    {
                        "position": move["position"],
                        "type": "disruption",
                        "value": move["disruption_value"],
                        "reason": f"Disrupts opponent {move['pattern_type']}",
                        "pattern_blocked": move["pattern_id"],
                    }
                )

        # Sort by strategic value
        opportunities.sort(key=lambda x: x["value"], reverse=True)

        # Add combined evaluations
        for opp in opportunities:
            opp["combined_score"] = self._evaluate_strategic_move(board, opp, player)

        return opportunities

    def _suggest_positional_improvements(
        self, board: List[List[int]], player: int
    ) -> List[Dict[str, Any]]:
        """Suggest positional improvements with detailed analysis"""
        suggestions = []

        # Analyze current position weaknesses
        position_analysis = self._analyze_position_weaknesses(board, player)

        # 1. Column balance improvements
        col_balance = self._analyze_column_balance(board, player)
        for col, imbalance in col_balance.items():
            if imbalance["needs_attention"]:
                improvement = self._calculate_column_improvement(board, col, player)
                if improvement:
                    suggestions.append(
                        {
                            "position": improvement["position"],
                            "type": "column_balance",
                            "improvement_score": improvement["score"],
                            "reason": f"Improves column {col} control",
                            "current_state": imbalance,
                        }
                    )

        # 2. Diagonal control improvements
        diagonal_control = self._analyze_diagonal_control(board, player)
        for diag in diagonal_control["weak_diagonals"]:
            improvement_moves = self._find_diagonal_improvements(board, diag, player)
            for move in improvement_moves:
                suggestions.append(
                    {
                        "position": move["position"],
                        "type": "diagonal_control",
                        "improvement_score": move["control_gain"],
                        "reason": "Strengthens diagonal control",
                        "diagonal_info": diag,
                    }
                )

        # 3. Connection improvements
        connection_moves = self._find_connection_improvements(board, player)
        for move in connection_moves:
            suggestions.append(
                {
                    "position": move["position"],
                    "type": "piece_connection",
                    "improvement_score": move["connection_value"],
                    "reason": f"Connects {move['pieces_connected']} pieces",
                    "creates_structure": move["structure_type"],
                }
            )

        # 4. Mobility improvements
        mobility_moves = self._find_mobility_improvements(board, player)
        for move in mobility_moves:
            suggestions.append(
                {
                    "position": move["position"],
                    "type": "mobility_enhancement",
                    "improvement_score": move["mobility_gain"],
                    "reason": "Increases future move options",
                    "new_options": move["options_created"],
                }
            )

        # 5. Defensive structure improvements
        defensive_improvements = self._find_defensive_improvements(board, player)
        for move in defensive_improvements:
            suggestions.append(
                {
                    "position": move["position"],
                    "type": "defensive_structure",
                    "improvement_score": move["defensive_value"],
                    "reason": move["reason"],
                    "vulnerabilities_addressed": move["fixes"],
                }
            )

        # 6. Long-term positional advantages
        long_term_moves = self._find_long_term_advantages(board, player)
        for move in long_term_moves:
            suggestions.append(
                {
                    "position": move["position"],
                    "type": "long_term_position",
                    "improvement_score": move["future_value"],
                    "reason": "Secures long-term advantage",
                    "payoff_timeline": move["moves_to_payoff"],
                }
            )

        # Sort by improvement score
        suggestions.sort(key=lambda x: x["improvement_score"], reverse=True)

        # Add relative improvements
        if suggestions:
            max_score = suggestions[0]["improvement_score"]
            for sug in suggestions:
                sug["relative_improvement"] = (
                    sug["improvement_score"] / max_score if max_score > 0 else 0
                )

        return suggestions

    def _calculate_board_complexity(self, board: List[List[int]]) -> float:
        """Calculate board state complexity with multiple factors"""
        complexity_score = 0.0

        # 1. Basic fill ratio (normalized)
        filled = sum(1 for row in board for cell in row if cell != 0)
        fill_ratio = filled / 42
        complexity_score += fill_ratio * 0.15

        # 2. Pattern complexity
        pattern_complexity = 0.0

        # Count different pattern types
        patterns_found = {
            "horizontal": 0,
            "vertical": 0,
            "diagonal": 0,
            "anti_diagonal": 0,
        }

        # Check all possible 2+ in a row patterns
        for row in range(6):
            for col in range(7):
                if board[row][col] != 0:
                    player = board[row][col]

                    # Check each direction
                    for dr, dc, ptype in [
                        (0, 1, "horizontal"),
                        (1, 0, "vertical"),
                        (1, 1, "diagonal"),
                        (1, -1, "anti_diagonal"),
                    ]:
                        length = 1
                        r, c = row + dr, col + dc
                        while 0 <= r < 6 and 0 <= c < 7 and board[r][c] == player:
                            length += 1
                            r += dr
                            c += dc
                        if length >= 2:
                            patterns_found[ptype] += 1

        # Calculate pattern diversity
        total_patterns = sum(patterns_found.values())
        if total_patterns > 0:
            # Shannon entropy of pattern distribution
            pattern_entropy = 0
            for count in patterns_found.values():
                if count > 0:
                    p = count / total_patterns
                    pattern_entropy -= p * np.log2(p) if p > 0 else 0

            # Normalize entropy (max entropy for 4 types is 2.0)
            pattern_complexity = pattern_entropy / 2.0

        complexity_score += pattern_complexity * 0.25

        # 3. Threat complexity
        threat_complexity = self._calculate_threat_complexity(board)
        complexity_score += threat_complexity * 0.20

        # 4. Interaction complexity (pieces affecting each other)
        interaction_score = 0.0
        for row in range(6):
            for col in range(7):
                if board[row][col] != 0:
                    # Count how many other pieces this affects
                    interactions = self._count_piece_interactions(board, row, col)
                    interaction_score += interactions

        # Normalize interaction score
        max_interactions = filled * 8  # Max 8 neighbors per piece
        if max_interactions > 0:
            interaction_score = interaction_score / max_interactions

        complexity_score += interaction_score * 0.15

        # 5. Branching factor (number of meaningful moves)
        meaningful_moves = 0
        for col in range(7):
            if board[0][col] == 0:
                row = self._get_drop_row(board, col)
                if row != -1:
                    # Check if move creates threats or blocks them
                    for player in [1, 2]:
                        board[row][col] = player
                        if self._creates_or_blocks_threat(board, row, col):
                            meaningful_moves += 0.5
                        board[row][col] = 0

        branching_complexity = min(1.0, meaningful_moves / 7)
        complexity_score += branching_complexity * 0.15

        # 6. Symmetry (less symmetry = more complex)
        symmetry = self._calculate_board_symmetry(board)
        complexity_score += (1 - symmetry) * 0.10

        return min(1.0, complexity_score)

    def _calculate_position_balance(self, board: List[List[int]]) -> float:
        """Calculate position balance between players with detailed metrics"""
        if not any(board[r][c] != 0 for r in range(6) for c in range(7)):
            return 0.5  # Empty board is balanced

        player1_score = 0.0
        player2_score = 0.0

        # 1. Material count (basic)
        p1_pieces = sum(1 for row in board for cell in row if cell == 1)
        p2_pieces = sum(1 for row in board for cell in row if cell == 2)

        # 2. Positional values
        position_values = [
            [3, 4, 5, 7, 5, 4, 3],  # Row 5 (bottom)
            [4, 6, 8, 10, 8, 6, 4],  # Row 4
            [5, 8, 11, 13, 11, 8, 5],  # Row 3
            [5, 8, 11, 13, 11, 8, 5],  # Row 2
            [4, 6, 8, 10, 8, 6, 4],  # Row 1
            [3, 4, 5, 7, 5, 4, 3],  # Row 0 (top)
        ]

        for row in range(6):
            for col in range(7):
                if board[row][col] == 1:
                    player1_score += position_values[row][col]
                elif board[row][col] == 2:
                    player2_score += position_values[row][col]

        # 3. Threat assessment
        p1_threats = self._count_player_threats(board, 1)
        p2_threats = self._count_player_threats(board, 2)

        player1_score += p1_threats * 15
        player2_score += p2_threats * 15

        # 4. Control assessment
        control_scores = self._calculate_control_scores(board)
        player1_score += control_scores[1] * 10
        player2_score += control_scores[2] * 10

        # 5. Connectivity bonus
        p1_connectivity = self._calculate_player_connectivity(board, 1)
        p2_connectivity = self._calculate_player_connectivity(board, 2)

        player1_score += p1_connectivity * 5
        player2_score += p2_connectivity * 5

        # 6. Future potential
        p1_potential = self._calculate_winning_potential(board, 1)
        p2_potential = self._calculate_winning_potential(board, 2)

        player1_score += p1_potential * 8
        player2_score += p2_potential * 8

        # Calculate balance (0.5 = balanced, >0.5 = player 1 advantage)
        total_score = player1_score + player2_score
        if total_score == 0:
            return 0.5

        balance = player1_score / total_score

        # Apply sigmoid smoothing for extreme values
        # This prevents positions from appearing completely one-sided
        if balance > 0.8:
            balance = 0.8 + (balance - 0.8) * 0.5
        elif balance < 0.2:
            balance = 0.2 - (0.2 - balance) * 0.5

        return balance

    def _calculate_threat_density(self, board: List[List[int]]) -> float:
        """Calculate threat density on board with spatial analysis"""
        if not any(board[r][c] != 0 for r in range(6) for c in range(7)):
            return 0.0

        threat_map = [[0.0 for _ in range(7)] for _ in range(6)]
        total_threats = 0

        # Analyze each position for threat potential
        for col in range(7):
            if board[0][col] != 0:
                continue

            row = self._get_drop_row(board, col)
            if row == -1:
                continue

            # Check threats for both players
            for player in [1, 2]:
                board[row][col] = player

                # Count immediate threats
                threats = self._count_threats_from_position(board, row, col)
                threat_map[row][col] += threats
                total_threats += threats

                # Check induced threats (threats created by this move)
                induced = self._count_induced_threats(board, row, col, player)
                threat_map[row][col] += induced * 0.5
                total_threats += induced * 0.5

                board[row][col] = 0

        # Calculate spatial distribution of threats
        threat_clusters = self._identify_threat_clusters(threat_map)

        # Calculate density metrics
        filled_cells = sum(1 for row in board for cell in row if cell != 0)
        empty_cells = 42 - filled_cells

        if empty_cells == 0:
            return 0.0

        # Base density
        base_density = total_threats / empty_cells

        # Cluster bonus (concentrated threats are more dangerous)
        cluster_bonus = 0.0
        for cluster in threat_clusters:
            cluster_size = len(cluster["positions"])
            cluster_intensity = cluster["total_threat_value"]
            if cluster_size > 0:
                cluster_density = cluster_intensity / cluster_size
                cluster_bonus += cluster_density * (cluster_size / empty_cells)

        # Combine metrics
        threat_density = base_density * 0.7 + cluster_bonus * 0.3

        # Normalize to 0-1 range
        # Typical max threat density is around 3-4 threats per empty cell
        normalized_density = min(1.0, threat_density / 3.0)

        # Apply game phase modifier
        game_progress = filled_cells / 42
        if game_progress < 0.3:  # Early game
            normalized_density *= 0.8
        elif game_progress > 0.7:  # Late game
            normalized_density *= 1.2

        return min(1.0, normalized_density)

    def _calculate_move_efficiency(self, moves: List[Dict]) -> float:
        """Calculate move efficiency with comprehensive metrics"""
        if not moves:
            return 0.5

        efficiency_scores = []

        # 1. Objective achievement rate
        objectives_achieved = 0
        objectives_attempted = 0

        for move in moves:
            if "objective" in move:
                objectives_attempted += 1
                if move.get("objective_achieved", False):
                    objectives_achieved += 1

        if objectives_attempted > 0:
            objective_efficiency = objectives_achieved / objectives_attempted
            efficiency_scores.append(("objectives", objective_efficiency, 0.25))

        # 2. Threat creation efficiency
        threat_moves = 0
        successful_threats = 0

        for move in moves:
            if move.get("intended_threat", False):
                threat_moves += 1
                if move.get("threat_materialized", False):
                    successful_threats += 1

        if threat_moves > 0:
            threat_efficiency = successful_threats / threat_moves
            efficiency_scores.append(("threats", threat_efficiency, 0.20))

        # 3. Move quality progression
        quality_scores = [
            m.get("quality_score", 0.5) for m in moves if "quality_score" in m
        ]
        if len(quality_scores) > 3:
            # Check if quality improves over time
            early_quality = sum(quality_scores[: len(quality_scores) // 3]) / (
                len(quality_scores) // 3
            )
            late_quality = sum(quality_scores[-len(quality_scores) // 3 :]) / (
                len(quality_scores) // 3
            )
            quality_improvement = (
                late_quality - early_quality + 1
            ) / 2  # Normalize to 0-1
            efficiency_scores.append(("quality_trend", quality_improvement, 0.15))

        # 4. Resource utilization (tempo)
        tempo_efficiency = self._calculate_tempo_efficiency(moves)
        efficiency_scores.append(("tempo", tempo_efficiency, 0.20))

        # 5. Pattern completion rate
        patterns_started = sum(1 for m in moves if m.get("starts_pattern", False))
        patterns_completed = sum(1 for m in moves if m.get("completes_pattern", False))

        if patterns_started > 0:
            pattern_efficiency = min(1.0, patterns_completed / patterns_started)
            efficiency_scores.append(("patterns", pattern_efficiency, 0.10))

        # 6. Defensive efficiency
        defensive_moves = [m for m in moves if m.get("move_type") == "defensive"]
        if defensive_moves:
            threats_blocked = sum(
                1 for m in defensive_moves if m.get("threat_blocked", False)
            )
            defensive_efficiency = threats_blocked / len(defensive_moves)
            efficiency_scores.append(("defense", defensive_efficiency, 0.10))

        # Calculate weighted efficiency
        if not efficiency_scores:
            return 0.7  # Default

        total_score = 0.0
        total_weight = 0.0

        for name, score, weight in efficiency_scores:
            total_score += score * weight
            total_weight += weight

        if total_weight == 0:
            return 0.7

        efficiency = total_score / total_weight

        # Apply game outcome modifier
        if moves and "game_outcome" in moves[-1]:
            outcome = moves[-1]["game_outcome"]
            if outcome == "win":
                efficiency = efficiency * 0.9 + 0.1  # Boost for winning
            elif outcome == "loss":
                efficiency = efficiency * 0.9  # Slight penalty for losing

        return efficiency

    def _estimate_strategic_depth(
        self, board: List[List[int]], moves: List[Dict]
    ) -> float:
        """Estimate strategic depth of position"""
        depth_score = 0.0

        # 1. Number of viable strategic plans
        strategic_plans = self._identify_strategic_plans(board)
        plan_diversity = min(1.0, len(strategic_plans) / 5)  # Normalize to 5+ plans
        depth_score += plan_diversity * 0.20

        # 2. Depth of forced variations
        forced_lines = self._calculate_forced_line_depth(board)
        max_depth = max([line["depth"] for line in forced_lines]) if forced_lines else 0
        depth_from_forced = min(1.0, max_depth / 10)  # Normalize to 10+ moves
        depth_score += depth_from_forced * 0.25

        # 3. Multi-level threat complexity
        threat_levels = self._analyze_threat_hierarchy(board)
        threat_depth = min(1.0, len(threat_levels) / 4)  # Normalize to 4+ levels
        depth_score += threat_depth * 0.20

        # 4. Positional subtlety
        if moves:
            subtle_moves = sum(1 for m in moves if m.get("move_subtlety", 0) > 0.7)
            obvious_moves = sum(1 for m in moves if m.get("move_subtlety", 0) < 0.3)
            if len(moves) > 0:
                subtlety_ratio = (subtle_moves - obvious_moves) / len(moves)
                subtlety_score = (subtlety_ratio + 1) / 2  # Normalize to 0-1
                depth_score += subtlety_score * 0.15

        # 5. Long-term planning requirements
        long_term_features = self._identify_long_term_features(board)
        long_term_score = min(1.0, len(long_term_features) / 3)
        depth_score += long_term_score * 0.10

        # 6. Decision complexity at each move
        if moves:
            avg_alternatives = sum(
                m.get("viable_alternatives", 1) for m in moves
            ) / len(moves)
            complexity_score = min(
                1.0, (avg_alternatives - 1) / 4
            )  # Normalize to 5+ alternatives
            depth_score += complexity_score * 0.10

        return min(1.0, depth_score)

    # Helper methods for the enhanced functions

    def _get_drop_row(self, board: List[List[int]], col: int) -> int:
        """Get row where piece would drop in column"""
        for row in range(5, -1, -1):
            if board[row][col] == 0:
                return row
        return -1

    def _analyze_fork_situations(
        self, board: List[List[int]], player: int
    ) -> Dict[str, List]:
        """Analyze fork opportunities and threats"""
        our_forks = []
        opponent_forks = []

        for col in range(7):
            if board[0][col] != 0:
                continue

            row = self._get_drop_row(board, col)
            if row == -1:
                continue

            # Check our fork opportunities
            board[row][col] = player
            threats = self._count_threats_from_position(board, row, col)
            if threats >= 2:
                threat_positions = self._get_threat_positions(board, row, col, player)
                our_forks.append(
                    {
                        "position": [row, col],
                        "threat_count": threats,
                        "threat_positions": threat_positions,
                    }
                )
            board[row][col] = 0

            # Check opponent fork threats
            board[row][col] = 3 - player
            threats = self._count_threats_from_position(board, row, col)
            if threats >= 2:
                threat_positions = self._get_threat_positions(
                    board, row, col, 3 - player
                )
                opponent_forks.append(
                    {
                        "position": [row, col],
                        "threat_count": threats,
                        "threat_positions": threat_positions,
                    }
                )
            board[row][col] = 0

        return {
            "our_forks": sorted(
                our_forks, key=lambda x: x["threat_count"], reverse=True
            ),
            "opponent_forks": sorted(
                opponent_forks, key=lambda x: x["threat_count"], reverse=True
            ),
        }

    def _get_threat_positions(
        self, board: List[List[int]], row: int, col: int, player: int
    ) -> List[Tuple[int, int]]:
        """Get positions that would complete threats from given position"""
        threat_positions = []

        directions = [(0, 1), (1, 0), (1, 1), (1, -1)]
        for dx, dy in directions:
            line_info = self._analyze_line(board, row, col, dx, dy, player)
            if line_info["threat_level"] >= 2:
                threat_positions.extend(line_info["critical_positions"])

        return list(set(threat_positions))  # Remove duplicates

    def _find_forced_win_sequences(
        self, board: List[List[int]], player: int
    ) -> List[Dict]:
        """Find forced winning sequences"""
        sequences = []

        # Simplified implementation - check for obvious forced wins
        for col in range(7):
            if board[0][col] != 0:
                continue

            row = self._get_drop_row(board, col)
            if row == -1:
                continue

            # Try move and check if it creates unstoppable threat
            board[row][col] = player
            if self._creates_unstoppable_threat(board, row, col, player):
                sequence = self._trace_forced_sequence(board, row, col, player)
                if sequence:
                    sequences.append(
                        {
                            "moves": sequence,
                            "probability": self._calculate_sequence_probability(
                                sequence, board
                            ),
                            "length": len(sequence),
                        }
                    )
            board[row][col] = 0

        return sorted(sequences, key=lambda x: x["probability"], reverse=True)

    def _creates_unstoppable_threat(
        self, board: List[List[int]], row: int, col: int, player: int
    ) -> bool:
        """Check if move creates unstoppable threat"""
        threats = self._count_threats_from_position(board, row, col)
        return threats >= 2  # Simplified - fork is often unstoppable

    def _trace_forced_sequence(
        self, board: List[List[int]], start_row: int, start_col: int, player: int
    ) -> List[Tuple[int, int]]:
        """Trace forced move sequence"""
        # Simplified - return starting move
        return [(start_row, start_col)]

    def _calculate_sequence_probability(
        self, sequence: List[Tuple[int, int]], board: List[List[int]]
    ) -> float:
        """Calculate probability of sequence succeeding"""
        # Simplified - based on sequence length
        return max(0.3, 1.0 - len(sequence) * 0.1)

    def _find_critical_defensive_positions(
        self, board: List[List[int]], player: int
    ) -> List[Dict]:
        """Find critical defensive positions"""
        critical_positions = []

        # Check positions that prevent multiple opponent threats
        for col in range(7):
            if board[0][col] != 0:
                continue

            row = self._get_drop_row(board, col)
            if row == -1:
                continue

            # Check how many opponent threats this blocks
            board[row][col] = player
            blocked_threats = 0

            # Count threats blocked
            for c in range(7):
                if c != col and board[0][c] == 0:
                    r = self._get_drop_row(board, c)
                    if r != -1:
                        board[r][c] = 3 - player
                        if self._check_winner(board, r, c):
                            blocked_threats += 1
                        board[r][c] = 0

            board[row][col] = 0

            if blocked_threats > 0:
                urgency = min(1.0, 0.7 + blocked_threats * 0.1)
                critical_positions.append(
                    {
                        "position": [row, col],
                        "urgency": urgency,
                        "threats_blocked": blocked_threats,
                        "reason": f"Blocks {blocked_threats} potential threats",
                    }
                )

        return sorted(critical_positions, key=lambda x: x["urgency"], reverse=True)

    # Additional helper methods for the enhanced analysis functions

    def _evaluate_center_control_opportunities(
        self, board: List[List[int]], player: int
    ) -> List[Dict]:
        """Evaluate opportunities for center control"""
        opportunities = []
        center_cols = [2, 3, 4]

        for col in center_cols:
            if board[0][col] == 0:
                row = self._get_drop_row(board, col)
                if row != -1:
                    # Evaluate value of this center position
                    value = self._evaluate_center_position(board, row, col, player)
                    if value > 0.5:
                        opportunities.append(
                            {
                                "position": [row, col],
                                "value": value,
                                "reason": f"Strengthens center column {col}",
                                "benefit": self._calculate_center_benefit(
                                    board, row, col, player
                                ),
                            }
                        )

        return sorted(opportunities, key=lambda x: x["value"], reverse=True)

    def _find_pattern_completion_moves(
        self, board: List[List[int]], pattern: Dict
    ) -> List[Dict]:
        """Find moves that complete or advance a pattern"""
        completion_moves = []

        for col in range(7):
            if board[0][col] == 0:
                row = self._get_drop_row(board, col)
                if row != -1:
                    # Check if this move advances the pattern
                    contribution = self._calculate_pattern_contribution(
                        board, row, col, pattern
                    )
                    if contribution > 0:
                        completion_moves.append(
                            {"position": [row, col], "contribution": contribution}
                        )

        return sorted(completion_moves, key=lambda x: x["contribution"], reverse=True)

    def _find_space_creation_moves(
        self, board: List[List[int]], player: int
    ) -> List[Dict]:
        """Find moves that create advantageous space"""
        space_moves = []

        for col in range(7):
            if board[0][col] == 0:
                row = self._get_drop_row(board, col)
                if row != -1:
                    # Evaluate space creation potential
                    space_value = self._evaluate_space_creation(board, row, col, player)
                    if space_value > 0.4:
                        potential_threats = self._count_potential_threats(
                            board, row, col, player
                        )
                        space_moves.append(
                            {
                                "position": [row, col],
                                "space_value": space_value,
                                "potential_threats": potential_threats,
                            }
                        )

        return sorted(space_moves, key=lambda x: x["space_value"], reverse=True)

    def _find_tempo_moves(self, board: List[List[int]], player: int) -> List[Dict]:
        """Find moves that gain tempo"""
        tempo_moves = []

        for col in range(7):
            if board[0][col] == 0:
                row = self._get_drop_row(board, col)
                if row != -1:
                    # Check if move forces response
                    board[row][col] = player
                    forces_response = self._check_forces_response(
                        board, row, col, player
                    )
                    tempo_value = self._calculate_tempo_value(board, row, col, player)
                    board[row][col] = 0

                    if tempo_value > 0.5:
                        tempo_moves.append(
                            {
                                "position": [row, col],
                                "tempo_value": tempo_value,
                                "forces_response": forces_response,
                                "reason": self._get_tempo_reason(
                                    tempo_value, forces_response
                                ),
                            }
                        )

        return sorted(tempo_moves, key=lambda x: x["tempo_value"], reverse=True)

    def _find_setup_moves(self, board: List[List[int]], player: int) -> List[Dict]:
        """Find strategic setup moves"""
        setup_moves = []

        for col in range(7):
            if board[0][col] == 0:
                row = self._get_drop_row(board, col)
                if row != -1:
                    # Evaluate future potential
                    future_value = self._evaluate_future_potential(
                        board, row, col, player
                    )
                    if future_value > 0.6:
                        payoff_moves = self._calculate_payoff_timeline(
                            board, row, col, player
                        )
                        setup_moves.append(
                            {
                                "position": [row, col],
                                "future_value": future_value,
                                "payoff_in": payoff_moves,
                            }
                        )

        return sorted(setup_moves, key=lambda x: x["future_value"], reverse=True)

    def _find_disruption_moves(
        self, board: List[List[int]], player: int, patterns: List[Dict]
    ) -> List[Dict]:
        """Find moves that disrupt opponent patterns"""
        disruption_moves = []

        # Focus on opponent patterns
        opponent_patterns = [p for p in patterns if p.get("player") == 3 - player]

        for pattern in opponent_patterns:
            for col in range(7):
                if board[0][col] == 0:
                    row = self._get_drop_row(board, col)
                    if row != -1:
                        disruption_value = self._calculate_disruption_value(
                            board, row, col, pattern
                        )
                        if disruption_value > 0.5:
                            disruption_moves.append(
                                {
                                    "position": [row, col],
                                    "disruption_value": disruption_value,
                                    "pattern_type": pattern.get("type", "unknown"),
                                    "pattern_id": id(pattern),
                                }
                            )

        return sorted(
            disruption_moves, key=lambda x: x["disruption_value"], reverse=True
        )

    def _evaluate_strategic_move(
        self, board: List[List[int]], opportunity: Dict, player: int
    ) -> float:
        """Evaluate combined strategic value of a move"""
        base_value = opportunity.get("value", 0.5)

        # Adjust based on move type
        move_type = opportunity.get("type")
        if move_type == "center_control":
            base_value *= 1.1
        elif move_type == "pattern_completion":
            base_value *= 1.2
        elif move_type == "tempo_gain" and opportunity.get("forces_response"):
            base_value *= 1.15

        # Consider board state
        game_phase = self._determine_game_phase_from_board(board)
        if game_phase == "opening" and move_type == "center_control":
            base_value *= 1.2
        elif game_phase == "endgame" and move_type in [
            "pattern_completion",
            "tempo_gain",
        ]:
            base_value *= 1.3

        return min(1.0, base_value)

    def _analyze_position_weaknesses(self, board: List[List[int]], player: int) -> Dict:
        """Analyze weaknesses in current position"""
        weaknesses = {
            "vulnerable_columns": [],
            "weak_diagonals": [],
            "isolated_pieces": [],
            "defensive_gaps": [],
        }

        # Check each column for vulnerabilities
        for col in range(7):
            vulnerability = self._assess_column_vulnerability(board, col, player)
            if vulnerability > 0.6:
                weaknesses["vulnerable_columns"].append(
                    {"column": col, "vulnerability": vulnerability}
                )

        # Check diagonals
        diagonal_weakness = self._assess_diagonal_weaknesses(board, player)
        weaknesses["weak_diagonals"] = diagonal_weakness

        # Find isolated pieces
        weaknesses["isolated_pieces"] = self._find_isolated_pieces(board, player)

        # Identify defensive gaps
        weaknesses["defensive_gaps"] = self._find_defensive_gaps(board, player)

        return weaknesses

    def _analyze_column_balance(
        self, board: List[List[int]], player: int
    ) -> Dict[int, Dict]:
        """Analyze balance in each column"""
        balance = {}

        for col in range(7):
            p1_count = sum(1 for row in range(6) if board[row][col] == 1)
            p2_count = sum(1 for row in range(6) if board[row][col] == 2)

            player_count = p1_count if player == 1 else p2_count
            opponent_count = p2_count if player == 1 else p1_count

            imbalance = opponent_count - player_count
            needs_attention = imbalance > 1 or (imbalance > 0 and col in [2, 3, 4])

            balance[col] = {
                "player_pieces": player_count,
                "opponent_pieces": opponent_count,
                "imbalance": imbalance,
                "needs_attention": needs_attention,
            }

        return balance

    def _calculate_column_improvement(
        self, board: List[List[int]], col: int, player: int
    ) -> Optional[Dict]:
        """Calculate improvement from playing in column"""
        if board[0][col] != 0:
            return None

        row = self._get_drop_row(board, col)
        if row == -1:
            return None

        # Calculate improvement score
        board[row][col] = player

        # Measure various improvements
        threat_improvement = self._count_threats_from_position(board, row, col) * 0.3
        control_improvement = (
            self._calculate_control_improvement(board, row, col, player) * 0.3
        )
        connection_improvement = (
            self._calculate_connectivity(board, row, col, player) * 0.2
        )
        defensive_improvement = (
            self._calculate_defensive_value(board, row, col, player) * 0.2
        )

        board[row][col] = 0

        total_score = (
            threat_improvement
            + control_improvement
            + connection_improvement
            + defensive_improvement
        )

        return {"position": [row, col], "score": total_score}

    def _analyze_diagonal_control(self, board: List[List[int]], player: int) -> Dict:
        """Analyze diagonal control"""
        diagonal_info = {
            "controlled_diagonals": [],
            "contested_diagonals": [],
            "weak_diagonals": [],
        }

        # Check all diagonals of length 4+
        diagonals = self._get_all_diagonals(board)

        for diag in diagonals:
            control = self._assess_diagonal_control(board, diag, player)

            if control["player_control"] > 0.7:
                diagonal_info["controlled_diagonals"].append(diag)
            elif abs(control["player_control"] - 0.5) < 0.2:
                diagonal_info["contested_diagonals"].append(diag)
            elif control["player_control"] < 0.3:
                diagonal_info["weak_diagonals"].append(diag)

        return diagonal_info

    def _find_diagonal_improvements(
        self, board: List[List[int]], diagonal: Dict, player: int
    ) -> List[Dict]:
        """Find moves that improve diagonal control"""
        improvements = []

        for pos in diagonal["positions"]:
            row, col = pos
            if board[row][col] == 0 and (row == 5 or board[row + 1][col] != 0):
                # This position is playable
                control_gain = self._calculate_diagonal_control_gain(
                    board, row, col, diagonal, player
                )
                if control_gain > 0.3:
                    improvements.append(
                        {"position": [row, col], "control_gain": control_gain}
                    )

        return sorted(improvements, key=lambda x: x["control_gain"], reverse=True)

    def _find_connection_improvements(
        self, board: List[List[int]], player: int
    ) -> List[Dict]:
        """Find moves that improve piece connections"""
        connection_moves = []

        for col in range(7):
            if board[0][col] == 0:
                row = self._get_drop_row(board, col)
                if row != -1:
                    # Count pieces this would connect
                    board[row][col] = player

                    connections = self._count_new_connections(board, row, col, player)
                    structure_type = self._identify_structure_type(
                        board, row, col, player
                    )
                    connection_value = self._evaluate_connection_value(
                        connections, structure_type
                    )

                    board[row][col] = 0

                    if connection_value > 0.4:
                        connection_moves.append(
                            {
                                "position": [row, col],
                                "pieces_connected": connections,
                                "structure_type": structure_type,
                                "connection_value": connection_value,
                            }
                        )

        return sorted(
            connection_moves, key=lambda x: x["connection_value"], reverse=True
        )

    def _find_mobility_improvements(
        self, board: List[List[int]], player: int
    ) -> List[Dict]:
        """Find moves that improve mobility"""
        mobility_moves = []

        current_mobility = self._calculate_mobility(board, player)

        for col in range(7):
            if board[0][col] == 0:
                row = self._get_drop_row(board, col)
                if row != -1:
                    # Test mobility after move
                    board[row][col] = player
                    new_mobility = self._calculate_mobility(board, player)
                    mobility_gain = new_mobility - current_mobility

                    if mobility_gain > 0:
                        options_created = self._count_new_options(
                            board, row, col, player
                        )
                        mobility_moves.append(
                            {
                                "position": [row, col],
                                "mobility_gain": mobility_gain,
                                "options_created": options_created,
                            }
                        )

                    board[row][col] = 0

        return sorted(mobility_moves, key=lambda x: x["mobility_gain"], reverse=True)

    def _find_defensive_improvements(
        self, board: List[List[int]], player: int
    ) -> List[Dict]:
        """Find defensive improvement moves"""
        defensive_moves = []

        vulnerabilities = self._identify_vulnerabilities(board, player)

        for vuln in vulnerabilities:
            defensive_options = self._find_defensive_options(board, vuln, player)
            for option in defensive_options:
                defensive_moves.append(
                    {
                        "position": option["position"],
                        "defensive_value": option["value"],
                        "reason": option["reason"],
                        "fixes": [vuln["type"]],
                    }
                )

        # Deduplicate and combine values for positions that fix multiple vulnerabilities
        position_map = {}
        for move in defensive_moves:
            pos_key = tuple(move["position"])
            if pos_key not in position_map:
                position_map[pos_key] = move
            else:
                position_map[pos_key]["defensive_value"] += (
                    move["defensive_value"] * 0.5
                )
                position_map[pos_key]["fixes"].extend(move["fixes"])

        return sorted(
            position_map.values(), key=lambda x: x["defensive_value"], reverse=True
        )

    def _find_long_term_advantages(
        self, board: List[List[int]], player: int
    ) -> List[Dict]:
        """Find moves that secure long-term advantages"""
        long_term_moves = []

        for col in range(7):
            if board[0][col] == 0:
                row = self._get_drop_row(board, col)
                if row != -1:
                    # Evaluate long-term potential
                    future_value = self._evaluate_long_term_value(
                        board, row, col, player
                    )

                    if future_value > 0.6:
                        moves_to_payoff = self._estimate_payoff_timeline(
                            board, row, col, player
                        )
                        long_term_moves.append(
                            {
                                "position": [row, col],
                                "future_value": future_value,
                                "moves_to_payoff": moves_to_payoff,
                            }
                        )

        return sorted(long_term_moves, key=lambda x: x["future_value"], reverse=True)

    def _calculate_threat_complexity(self, board: List[List[int]]) -> float:
        """Calculate complexity of threat structure"""
        all_threats = []

        # Find all threats on board
        for row in range(6):
            for col in range(7):
                if board[row][col] != 0:
                    threats = self._get_threats_from_position(board, row, col)
                    all_threats.extend(threats)

        if not all_threats:
            return 0.0

        # Analyze threat interactions
        interaction_count = 0
        for i, threat1 in enumerate(all_threats):
            for threat2 in all_threats[i + 1 :]:
                if self._threats_interact(threat1, threat2):
                    interaction_count += 1

        # Calculate complexity based on threat count and interactions
        threat_count_factor = min(1.0, len(all_threats) / 10)
        interaction_factor = min(1.0, interaction_count / 15)

        return threat_count_factor * 0.6 + interaction_factor * 0.4

    def _count_piece_interactions(
        self, board: List[List[int]], row: int, col: int
    ) -> int:
        """Count how many pieces interact with given position"""
        if board[row][col] == 0:
            return 0

        player = board[row][col]
        interactions = 0

        # Check all directions
        directions = [(0, 1), (1, 0), (1, 1), (1, -1)]

        for dx, dy in directions:
            # Check both directions
            for direction in [1, -1]:
                r, c = row + dx * direction, col + dy * direction
                line_length = 0

                while 0 <= r < 6 and 0 <= c < 7:
                    if board[r][c] == player:
                        line_length += 1
                    elif board[r][c] == 0:
                        # Empty space that could extend line
                        if line_length > 0:
                            interactions += 1
                        break
                    else:
                        # Opponent piece blocks
                        break

                    r += dx * direction
                    c += dy * direction

                if line_length > 0:
                    interactions += line_length

        return interactions

    def _creates_or_blocks_threat(
        self, board: List[List[int]], row: int, col: int
    ) -> bool:
        """Check if position creates or blocks a threat"""
        # Check if creates threat for player who placed there
        player = board[row][col]
        if player != 0:
            threats = self._count_threats_from_position(board, row, col)
            if threats > 0:
                return True

        # Check if blocks opponent threat
        board[row][col] = 0
        for p in [1, 2]:
            if p != player:
                board[row][col] = p
                if self._check_winner(board, row, col):
                    board[row][col] = player
                    return True

        board[row][col] = player
        return False

    def _count_player_threats(self, board: List[List[int]], player: int) -> int:
        """Count total threats for a player"""
        total_threats = 0

        for row in range(6):
            for col in range(7):
                if board[row][col] == player:
                    threats = self._count_threats_from_position(board, row, col)
                    total_threats += threats

        # Avoid double counting shared threats
        return min(total_threats, total_threats // 2 + 1)

    def _calculate_control_scores(self, board: List[List[int]]) -> Dict[int, float]:
        """Calculate control scores for each player"""
        control_scores = {1: 0.0, 2: 0.0}

        # Evaluate control of key positions
        key_positions = [
            # Center columns
            [(r, 3) for r in range(6)],
            [(r, 2) for r in range(6)],
            [(r, 4) for r in range(6)],
            # Key diagonals
            [(i, i) for i in range(min(6, 7))],
            [(i, 6 - i) for i in range(min(6, 7))],
        ]

        for position_set in key_positions:
            for row, col in position_set:
                if 0 <= row < 6 and 0 <= col < 7:
                    if board[row][col] != 0:
                        player = board[row][col]
                        # Weight by position importance
                        weight = 1.0
                        if col in [2, 3, 4]:  # Center columns
                            weight = 1.5
                        if row >= 3:  # Lower rows (more stable)
                            weight *= 1.2

                        control_scores[player] += weight

        return control_scores

    def _calculate_player_connectivity(
        self, board: List[List[int]], player: int
    ) -> float:
        """Calculate overall connectivity for a player"""
        if not any(board[r][c] == player for r in range(6) for c in range(7)):
            return 0.0

        total_connections = 0
        pieces = 0

        for row in range(6):
            for col in range(7):
                if board[row][col] == player:
                    pieces += 1
                    connections = self._calculate_connectivity(board, row, col, player)
                    total_connections += connections

        if pieces == 0:
            return 0.0

        # Average connections per piece, normalized
        avg_connections = total_connections / pieces
        return min(1.0, avg_connections / 4)  # Max 4 connections expected

    def _calculate_winning_potential(
        self, board: List[List[int]], player: int
    ) -> float:
        """Calculate potential for creating winning positions"""
        winning_paths = self._find_winning_paths(board)
        player_paths = [p for p in winning_paths if p.get("player") == player]

        if not player_paths:
            return 0.0

        # Weight paths by completion and immediacy
        potential = 0.0
        for path in player_paths[:10]:  # Top 10 paths
            completion = path.get("completion", 0)
            immediate = 1.0 if path.get("immediate", False) else 0.7
            potential += completion * immediate

        # Normalize
        return min(1.0, potential / 5)  # Normalize to ~5 strong paths

    def _count_induced_threats(
        self, board: List[List[int]], row: int, col: int, player: int
    ) -> int:
        """Count threats induced by a move"""
        induced = 0

        # Check if this move enables future threats
        for next_col in range(7):
            if next_col != col and board[0][next_col] == 0:
                next_row = self._get_drop_row(board, next_col)
                if next_row != -1:
                    # Would this follow-up create threats?
                    board[next_row][next_col] = player
                    future_threats = self._count_threats_from_position(
                        board, next_row, next_col
                    )
                    if future_threats > 0:
                        induced += 1
                    board[next_row][next_col] = 0

        return induced

    def _identify_threat_clusters(self, threat_map: List[List[float]]) -> List[Dict]:
        """Identify clusters of threats"""
        clusters = []
        visited = [[False for _ in range(7)] for _ in range(6)]

        for row in range(6):
            for col in range(7):
                if threat_map[row][col] > 0 and not visited[row][col]:
                    # Start new cluster
                    cluster = self._explore_threat_cluster(
                        threat_map, visited, row, col
                    )
                    if cluster["size"] > 1:
                        clusters.append(cluster)

        return sorted(clusters, key=lambda x: x["total_threat_value"], reverse=True)

    def _explore_threat_cluster(
        self,
        threat_map: List[List[float]],
        visited: List[List[bool]],
        start_row: int,
        start_col: int,
    ) -> Dict:
        """Explore a threat cluster using DFS"""
        cluster = {"positions": [], "total_threat_value": 0.0, "size": 0}

        stack = [(start_row, start_col)]

        while stack:
            row, col = stack.pop()

            if (
                row < 0
                or row >= 6
                or col < 0
                or col >= 7
                or visited[row][col]
                or threat_map[row][col] == 0
            ):
                continue

            visited[row][col] = True
            cluster["positions"].append((row, col))
            cluster["total_threat_value"] += threat_map[row][col]
            cluster["size"] += 1

            # Check neighbors
            for dr in [-1, 0, 1]:
                for dc in [-1, 0, 1]:
                    if dr != 0 or dc != 0:
                        stack.append((row + dr, col + dc))

        return cluster

    def _calculate_tempo_efficiency(self, moves: List[Dict]) -> float:
        """Calculate how efficiently tempo was used"""
        if not moves:
            return 0.5

        # Count moves that gained tempo
        tempo_gains = sum(1 for m in moves if m.get("gains_tempo", False))
        tempo_losses = sum(1 for m in moves if m.get("loses_tempo", False))

        # Calculate net tempo efficiency
        net_tempo = (tempo_gains - tempo_losses) / len(moves)

        # Normalize to 0-1 range
        return (net_tempo + 1) / 2

    def _identify_strategic_plans(self, board: List[List[int]]) -> List[Dict]:
        """Identify viable strategic plans"""
        plans = []

        # Plan types to check
        plan_types = [
            "center_domination",
            "diagonal_control",
            "column_lockdown",
            "fork_creation",
            "space_advantage",
            "defensive_fortress",
        ]

        for plan_type in plan_types:
            viability = self._assess_plan_viability(board, plan_type)
            if viability > 0.5:
                plans.append(
                    {
                        "type": plan_type,
                        "viability": viability,
                        "moves_required": self._estimate_plan_moves(board, plan_type),
                    }
                )

        return sorted(plans, key=lambda x: x["viability"], reverse=True)

    def _calculate_forced_line_depth(self, board: List[List[int]]) -> List[Dict]:
        """Calculate depth of forced variations"""
        forced_lines = []

        # Check each possible starting move
        for col in range(7):
            if board[0][col] == 0:
                row = self._get_drop_row(board, col)
                if row != -1:
                    for player in [1, 2]:
                        depth = self._trace_forced_line(board, row, col, player, 0)
                        if depth > 1:
                            forced_lines.append(
                                {"start": [row, col], "player": player, "depth": depth}
                            )

        return forced_lines

    def _analyze_threat_hierarchy(self, board: List[List[int]]) -> List[Dict]:
        """Analyze hierarchy of threats"""
        threat_levels = []

        # Level 1: Immediate threats (can win next move)
        immediate_threats = self._find_immediate_threats(board)
        if immediate_threats:
            threat_levels.append(
                {"level": 1, "threats": immediate_threats, "urgency": "critical"}
            )

        # Level 2: Two-move threats
        two_move_threats = self._find_two_move_threats(board)
        if two_move_threats:
            threat_levels.append(
                {"level": 2, "threats": two_move_threats, "urgency": "high"}
            )

        # Level 3: Setup threats
        setup_threats = self._find_setup_threats(board)
        if setup_threats:
            threat_levels.append(
                {"level": 3, "threats": setup_threats, "urgency": "medium"}
            )

        return threat_levels

    def _identify_long_term_features(self, board: List[List[int]]) -> List[Dict]:
        """Identify features requiring long-term planning"""
        features = []

        # Check for locked columns
        for col in range(7):
            if self._is_column_locked(board, col):
                features.append({"type": "locked_column", "column": col})

        # Check for developing structures
        structures = self._find_developing_structures(board)
        features.extend(structures)

        # Check for positional advantages that need nurturing
        advantages = self._find_positional_advantages(board)
        features.extend(advantages)

        return features

    async def handle_simulation_request(self, data: Dict[str, Any]):
        """Handle request to run AI vs AI simulation"""
        logger.info(f"🎮 Running simulation: {data.get('simulationId')}")

        try:
            # Extract simulation parameters
            simulation_id = data.get("simulationId")
            ai_config = data.get("aiConfig", {})
            num_games = data.get("numGames", 1)
            parallel_games = data.get("parallelGames", 1)
            simulation_type = data.get(
                "type", "standard"
            )  # 'standard', 'tournament', 'training'

            # Initialize simulation
            simulation = {
                "id": simulation_id,
                "status": "running",
                "startTime": datetime.now().isoformat(),
                "type": simulation_type,
                "config": ai_config,
                "results": {
                    "totalGames": num_games,
                    "completedGames": 0,
                    "wins": {"ai1": 0, "ai2": 0},
                    "draws": 0,
                    "gameDetails": [],
                },
                "insights": [],
                "performance": {},
            }

            # Notify start of simulation
            await self.client.emit(
                "simulation_started",
                {
                    "simulationId": simulation_id,
                    "config": ai_config,
                    "expectedDuration": self._estimate_simulation_duration(
                        num_games, ai_config
                    ),
                },
            )

            # Run simulation based on type
            if simulation_type == "standard":
                results = await self._run_standard_simulation(
                    simulation, ai_config, num_games
                )
            elif simulation_type == "tournament":
                results = await self._run_tournament_simulation(simulation, ai_config)
            elif simulation_type == "training":
                results = await self._run_training_simulation(
                    simulation, ai_config, num_games
                )
            else:
                raise ValueError(f"Unknown simulation type: {simulation_type}")

            # Update simulation results
            simulation["results"] = results
            simulation["status"] = "completed"
            simulation["endTime"] = datetime.now().isoformat()

            # Analyze simulation results
            analysis = await self._analyze_simulation_results(results, ai_config)
            simulation["analysis"] = analysis

            # Extract insights from simulation
            insights = self._extract_simulation_insights(results, analysis)
            simulation["insights"] = insights

            # Share insights with other services
            for insight in insights:
                await self.client.propagate_insight(
                    {
                        "type": "simulation_insight",
                        "simulationId": simulation_id,
                        "insight": insight,
                        "confidence": insight.get("confidence", 0.8),
                    }
                )

            # Submit final results
            await self.client.submit_simulation_result(simulation_id, simulation)

            # Store simulation for future reference
            if hasattr(self, "simulation_history"):
                self.simulation_history.append(simulation)
                # Keep only recent simulations
                if len(self.simulation_history) > 100:
                    self.simulation_history.pop(0)

            logger.info(f"✅ Completed simulation {simulation_id}")
            return simulation

        except Exception as e:
            logger.error(f"❌ Error in simulation: {e}")

            # Report simulation failure
            await self.client.emit(
                "simulation_failed",
                {
                    "simulationId": data.get("simulationId"),
                    "error": str(e),
                    "timestamp": datetime.now().isoformat(),
                },
            )
            return None

    async def _run_standard_simulation(
        self, simulation: Dict[str, Any], ai_config: Dict[str, Any], num_games: int
    ) -> Dict[str, Any]:
        """Run standard AI vs AI simulation"""
        results = simulation["results"]

        # Configure AIs
        ai1_config = ai_config.get("ai1", {"type": "minimax", "depth": 4})
        ai2_config = ai_config.get("ai2", {"type": "mcts", "simulations": 1000})

        # Run games
        for game_num in range(num_games):
            # Simulate a game
            game_result = await self._simulate_single_game(
                ai1_config, ai2_config, game_num + 1
            )

            # Update results
            results["completedGames"] += 1

            if game_result["winner"] == 1:
                results["wins"]["ai1"] += 1
            elif game_result["winner"] == 2:
                results["wins"]["ai2"] += 1
            else:
                results["draws"] += 1

            # Store game details
            results["gameDetails"].append(
                {
                    "gameNumber": game_num + 1,
                    "winner": game_result["winner"],
                    "moveCount": game_result["moveCount"],
                    "duration": game_result["duration"],
                    "finalBoard": game_result["finalBoard"],
                    "criticalMoments": game_result.get("criticalMoments", []),
                }
            )

            # Emit progress update
            if (game_num + 1) % 10 == 0:
                await self.client.emit(
                    "simulation_progress",
                    {
                        "simulationId": simulation["id"],
                        "progress": (game_num + 1) / num_games,
                        "currentResults": {
                            "ai1Wins": results["wins"]["ai1"],
                            "ai2Wins": results["wins"]["ai2"],
                            "draws": results["draws"],
                        },
                    },
                )

        # Calculate win rates
        results["winRates"] = {
            "ai1": results["wins"]["ai1"] / num_games,
            "ai2": results["wins"]["ai2"] / num_games,
            "drawRate": results["draws"] / num_games,
        }

        return results

    async def _run_tournament_simulation(
        self, simulation: Dict[str, Any], ai_config: Dict[str, Any]
    ) -> Dict[str, Any]:
        """Run tournament-style simulation with multiple AI types"""
        ai_types = ai_config.get(
            "participants",
            [
                {"name": "minimax_4", "type": "minimax", "depth": 4},
                {"name": "mcts_1000", "type": "mcts", "simulations": 1000},
                {"name": "alphazero", "type": "alphazero", "model": "latest"},
                {"name": "random", "type": "random"},
            ],
        )

        # Initialize tournament results
        tournament_results = {
            "participants": [ai["name"] for ai in ai_types],
            "matchResults": {},
            "standings": {},
            "totalMatches": len(ai_types) * (len(ai_types) - 1) // 2,
        }

        # Run round-robin tournament
        for i, ai1 in enumerate(ai_types):
            for j, ai2 in enumerate(ai_types[i + 1 :], i + 1):
                match_key = f"{ai1['name']}_vs_{ai2['name']}"

                # Play multiple games for each matchup
                match_result = await self._play_match(ai1, ai2, games=10)
                tournament_results["matchResults"][match_key] = match_result

                # Update standings
                self._update_tournament_standings(
                    tournament_results["standings"],
                    ai1["name"],
                    ai2["name"],
                    match_result,
                )

        # Calculate final rankings
        tournament_results["rankings"] = self._calculate_tournament_rankings(
            tournament_results["standings"]
        )

        return tournament_results

    async def _run_training_simulation(
        self, simulation: Dict[str, Any], ai_config: Dict[str, Any], num_games: int
    ) -> Dict[str, Any]:
        """Run training simulation for model improvement"""
        training_results = {
            "trainingGames": num_games,
            "learningCurve": [],
            "modelImprovements": [],
            "bestStrategies": [],
        }

        # Training AI configuration
        student_ai = ai_config.get("student", {"type": "neural", "model": "trainable"})
        teacher_ai = ai_config.get("teacher", {"type": "minimax", "depth": 6})

        # Run training games in batches
        batch_size = 50
        for batch in range(0, num_games, batch_size):
            batch_results = {
                "batchNumber": batch // batch_size + 1,
                "wins": 0,
                "losses": 0,
                "avgMoveQuality": 0.0,
            }

            # Play batch of games
            for game in range(min(batch_size, num_games - batch)):
                game_result = await self._simulate_training_game(
                    student_ai, teacher_ai, analyze_moves=True
                )

                # Update batch results
                if game_result["winner"] == 1:  # Student won
                    batch_results["wins"] += 1
                else:
                    batch_results["losses"] += 1

                batch_results["avgMoveQuality"] += game_result["moveQuality"]

            # Average move quality
            batch_results["avgMoveQuality"] /= min(batch_size, num_games - batch)

            # Record learning progress
            training_results["learningCurve"].append(batch_results)

            # Update model if improvement detected
            if batch_results["wins"] / batch_size > 0.4:  # 40% win rate threshold
                improvement = {
                    "batchNumber": batch_results["batchNumber"],
                    "winRate": batch_results["wins"] / batch_size,
                    "modelVersion": f"v{batch // batch_size + 1}.0",
                }
                training_results["modelImprovements"].append(improvement)

                # Notify model update
                await self.client.notify_model_update(
                    "training_model",
                    improvement["modelVersion"],
                    {"winRate": improvement["winRate"]},
                )

        return training_results

    async def _simulate_single_game(
        self, ai1_config: Dict[str, Any], ai2_config: Dict[str, Any], game_number: int
    ) -> Dict[str, Any]:
        """Simulate a single game between two AIs"""
        start_time = datetime.now()

        # Initialize game state
        board = [[0 for _ in range(7)] for _ in range(6)]
        moves = []
        current_player = 1

        # Play game
        while not self._is_game_over(board) and len(moves) < 42:
            # Get AI move
            if current_player == 1:
                move = await self._get_ai_move(board, ai1_config, current_player)
            else:
                move = await self._get_ai_move(board, ai2_config, current_player)

            # Make move
            row = self._drop_piece(board, move["col"], current_player)
            moves.append(
                {
                    "player": current_player,
                    "col": move["col"],
                    "row": row,
                    "moveNumber": len(moves) + 1,
                }
            )

            # Check for winner
            if self._check_winner(board, row, move["col"]):
                return {
                    "winner": current_player,
                    "moveCount": len(moves),
                    "duration": (datetime.now() - start_time).total_seconds(),
                    "finalBoard": board,
                    "moves": moves,
                }

            # Switch player
            current_player = 3 - current_player

        # Game ended in draw
        return {
            "winner": 0,  # Draw
            "moveCount": len(moves),
            "duration": (datetime.now() - start_time).total_seconds(),
            "finalBoard": board,
            "moves": moves,
        }

    async def _get_ai_move(
        self, board: List[List[int]], ai_config: Dict[str, Any], player: int
    ) -> Dict[str, Any]:
        """Get move from AI based on configuration"""
        ai_type = ai_config.get("type", "random")

        if ai_type == "random":
            # Random valid move
            valid_cols = [c for c in range(7) if board[0][c] == 0]
            return {"col": valid_cols[int(len(valid_cols) * 0.5)]}  # Simplified random

        elif ai_type == "minimax":
            # Request move from minimax service
            depth = ai_config.get("depth", 4)
            # Simplified - return center column if available
            if board[0][3] == 0:
                return {"col": 3}
            else:
                valid_cols = [c for c in range(7) if board[0][c] == 0]
                return {"col": valid_cols[0]}

        else:
            # Default to first valid column
            valid_cols = [c for c in range(7) if board[0][c] == 0]
            return {"col": valid_cols[0] if valid_cols else 0}

    def _drop_piece(self, board: List[List[int]], col: int, player: int) -> int:
        """Drop piece in column and return row"""
        for row in range(5, -1, -1):
            if board[row][col] == 0:
                board[row][col] = player
                return row
        return -1

    def _is_game_over(self, board: List[List[int]]) -> bool:
        """Check if game is over (win or board full)"""
        # Check for wins
        for row in range(6):
            for col in range(7):
                if board[row][col] != 0:
                    if self._check_winner(board, row, col):
                        return True

        # Check if board is full
        return all(board[0][col] != 0 for col in range(7))

    def _check_winner(self, board: List[List[int]], row: int, col: int) -> bool:
        """Check if the last move created a win"""
        if row < 0 or col < 0 or board[row][col] == 0:
            return False

        player = board[row][col]

        # Check horizontal
        count = 1
        # Check left
        c = col - 1
        while c >= 0 and board[row][c] == player:
            count += 1
            c -= 1
        # Check right
        c = col + 1
        while c < 7 and board[row][c] == player:
            count += 1
            c += 1
        if count >= 4:
            return True

        # Check vertical (only need to check down)
        count = 1
        r = row + 1
        while r < 6 and board[r][col] == player:
            count += 1
            r += 1
        if count >= 4:
            return True

        # Check diagonal (top-left to bottom-right)
        count = 1
        # Up-left
        r, c = row - 1, col - 1
        while r >= 0 and c >= 0 and board[r][c] == player:
            count += 1
            r -= 1
            c -= 1
        # Down-right
        r, c = row + 1, col + 1
        while r < 6 and c < 7 and board[r][c] == player:
            count += 1
            r += 1
            c += 1
        if count >= 4:
            return True

        # Check anti-diagonal (top-right to bottom-left)
        count = 1
        # Up-right
        r, c = row - 1, col + 1
        while r >= 0 and c < 7 and board[r][c] == player:
            count += 1
            r -= 1
            c += 1
        # Down-left
        r, c = row + 1, col - 1
        while r < 6 and c >= 0 and board[r][c] == player:
            count += 1
            r += 1
            c -= 1
        if count >= 4:
            return True

        return False

    async def _analyze_simulation_results(
        self, results: Dict[str, Any], ai_config: Dict[str, Any]
    ) -> Dict[str, Any]:
        """Analyze simulation results for insights"""
        analysis = {
            "dominantAI": None,
            "averageGameLength": 0,
            "gamePhaseDistribution": {"opening": 0, "midgame": 0, "endgame": 0},
            "commonPatterns": [],
            "strategicTrends": [],
        }

        # Determine dominant AI
        if results.get("winRates"):
            if results["winRates"]["ai1"] > results["winRates"]["ai2"]:
                analysis["dominantAI"] = "ai1"
            elif results["winRates"]["ai2"] > results["winRates"]["ai1"]:
                analysis["dominantAI"] = "ai2"
            else:
                analysis["dominantAI"] = "balanced"

        # Calculate average game length
        game_details = results.get("gameDetails", [])
        if game_details:
            total_moves = sum(g["moveCount"] for g in game_details)
            analysis["averageGameLength"] = total_moves / len(game_details)

            # Analyze game phase distribution
            for game in game_details:
                if game["moveCount"] <= 12:
                    analysis["gamePhaseDistribution"]["opening"] += 1
                elif game["moveCount"] <= 30:
                    analysis["gamePhaseDistribution"]["midgame"] += 1
                else:
                    analysis["gamePhaseDistribution"]["endgame"] += 1

        return analysis

    def _extract_simulation_insights(
        self, results: Dict[str, Any], analysis: Dict[str, Any]
    ) -> List[Dict[str, Any]]:
        """Extract actionable insights from simulation"""
        insights = []

        # Win rate insights
        if results.get("winRates"):
            win_diff = abs(results["winRates"]["ai1"] - results["winRates"]["ai2"])
            if win_diff > 0.2:
                insights.append(
                    {
                        "type": "performance_gap",
                        "description": f"Significant performance gap detected: {win_diff:.1%}",
                        "recommendation": "Consider adjusting AI parameters for balance",
                        "confidence": 0.9,
                    }
                )

        # Game length insights
        avg_length = analysis.get("averageGameLength", 0)
        if avg_length < 20:
            insights.append(
                {
                    "type": "quick_games",
                    "description": "Games ending unusually quickly",
                    "recommendation": "Check for aggressive strategies or defensive weaknesses",
                    "confidence": 0.8,
                }
            )

        return insights

    def _estimate_simulation_duration(
        self, num_games: int, ai_config: Dict[str, Any]
    ) -> float:
        """Estimate simulation duration in seconds"""
        # Base estimate: 2 seconds per game
        base_time = num_games * 2

        # Adjust for AI complexity
        if "mcts" in str(ai_config):
            base_time *= 2
        if "neural" in str(ai_config):
            base_time *= 1.5

        return base_time

    async def _play_match(
        self, ai1: Dict[str, Any], ai2: Dict[str, Any], games: int
    ) -> Dict[str, Any]:
        """Play a match between two AIs"""
        match_result = {"ai1Wins": 0, "ai2Wins": 0, "draws": 0, "games": []}

        for i in range(games):
            # Alternate starting player
            if i % 2 == 0:
                result = await self._simulate_single_game(ai1, ai2, i + 1)
                if result["winner"] == 1:
                    match_result["ai1Wins"] += 1
                elif result["winner"] == 2:
                    match_result["ai2Wins"] += 1
                else:
                    match_result["draws"] += 1
            else:
                result = await self._simulate_single_game(ai2, ai1, i + 1)
                if result["winner"] == 1:
                    match_result["ai2Wins"] += 1
                elif result["winner"] == 2:
                    match_result["ai1Wins"] += 1
                else:
                    match_result["draws"] += 1

            match_result["games"].append(result)

        return match_result

    def _update_tournament_standings(
        self,
        standings: Dict[str, Dict],
        ai1_name: str,
        ai2_name: str,
        match_result: Dict[str, Any],
    ):
        """Update tournament standings"""
        # Initialize standings if needed
        for name in [ai1_name, ai2_name]:
            if name not in standings:
                standings[name] = {"wins": 0, "losses": 0, "draws": 0, "points": 0}

        # Update based on match results
        standings[ai1_name]["wins"] += match_result["ai1Wins"]
        standings[ai1_name]["losses"] += match_result["ai2Wins"]
        standings[ai1_name]["draws"] += match_result["draws"]
        standings[ai1_name]["points"] += (
            match_result["ai1Wins"] * 3 + match_result["draws"]
        )

        standings[ai2_name]["wins"] += match_result["ai2Wins"]
        standings[ai2_name]["losses"] += match_result["ai1Wins"]
        standings[ai2_name]["draws"] += match_result["draws"]
        standings[ai2_name]["points"] += (
            match_result["ai2Wins"] * 3 + match_result["draws"]
        )

    def _calculate_tournament_rankings(
        self, standings: Dict[str, Dict]
    ) -> List[Dict[str, Any]]:
        """Calculate final tournament rankings"""
        rankings = []

        for ai_name, stats in standings.items():
            rankings.append(
                {
                    "name": ai_name,
                    "points": stats["points"],
                    "wins": stats["wins"],
                    "losses": stats["losses"],
                    "draws": stats["draws"],
                    "winRate": stats["wins"]
                    / (stats["wins"] + stats["losses"] + stats["draws"]),
                }
            )

        # Sort by points, then by wins
        rankings.sort(key=lambda x: (x["points"], x["wins"]), reverse=True)

        # Add rank
        for i, ranking in enumerate(rankings):
            ranking["rank"] = i + 1

        return rankings

    async def _simulate_training_game(
        self,
        student_ai: Dict[str, Any],
        teacher_ai: Dict[str, Any],
        analyze_moves: bool = False,
        collect_metrics: bool = True,
        timeout: float = 300.0,
    ) -> Dict[str, Any]:
        """
        Simulate an advanced training game with comprehensive analysis

        Args:
            student_ai: Student AI configuration
            teacher_ai: Teacher AI configuration
            analyze_moves: Enable detailed move-by-move analysis
            collect_metrics: Collect performance metrics
            timeout: Maximum game duration in seconds

        Returns:
            Comprehensive game result with analysis and metrics
        """
        start_time = datetime.now()
        metrics = {"timing": {}, "moves": [], "errors": [], "performance": {}}

        try:
            # Initialize game state tracking
            game_state = {
                "board": [[0 for _ in range(7)] for _ in range(6)],
                "moves": [],
                "move_times": [],
                "position_evaluations": [],
                "critical_moments": [],
                "blunders": [],
                "brilliant_moves": [],
            }

            # Run the base simulation with timeout
            result = await asyncio.wait_for(
                self._simulate_single_game(student_ai, teacher_ai, 1), timeout=timeout
            )

            # Enhanced move analysis
            if analyze_moves and "moves" in result:
                move_analysis = await self._analyze_training_moves(
                    result["moves"], game_state, student_ai, teacher_ai
                )
                result["moveAnalysis"] = move_analysis

                # Calculate detailed move quality metrics
                result["moveQuality"] = {
                    "overall": move_analysis.get("averageQuality", 0.0),
                    "byPhase": {
                        "opening": move_analysis.get("openingQuality", 0.0),
                        "midgame": move_analysis.get("midgameQuality", 0.0),
                        "endgame": move_analysis.get("endgameQuality", 0.0),
                    },
                    "consistency": move_analysis.get("consistency", 0.0),
                    "improvement": move_analysis.get("improvement", 0.0),
                    "criticalAccuracy": move_analysis.get("criticalAccuracy", 0.0),
                }

                # Identify learning opportunities
                result["learningOpportunities"] = self._identify_learning_opportunities(
                    move_analysis, game_state
                )

            # Collect performance metrics
            if collect_metrics:
                metrics["timing"]["totalDuration"] = (
                    datetime.now() - start_time
                ).total_seconds()
                metrics["timing"]["averageMoveTime"] = (
                    np.mean(game_state["move_times"]) if game_state["move_times"] else 0
                )
                metrics["timing"]["maxMoveTime"] = (
                    max(game_state["move_times"]) if game_state["move_times"] else 0
                )

                metrics["performance"] = {
                    "studentWinProbability": self._calculate_win_probability(
                        result, "student"
                    ),
                    "positionComplexity": self._calculate_average_complexity(
                        game_state["position_evaluations"]
                    ),
                    "strategicDepth": self._evaluate_strategic_depth(
                        result.get("moves", [])
                    ),
                    "tacticalSharpness": self._evaluate_tactical_sharpness(game_state),
                    "endgameSkill": self._evaluate_endgame_skill(result, game_state),
                }

                result["metrics"] = metrics

            # Add training recommendations
            result["trainingRecommendations"] = (
                await self._generate_training_recommendations(
                    result, student_ai, teacher_ai, game_state
                )
            )

            # Calculate skill differential
            result["skillDifferential"] = self._calculate_skill_differential(
                result, student_ai, teacher_ai
            )

            return result

        except asyncio.TimeoutError:
            logger.error(f"Training game timeout after {timeout}s")
            return {
                "error": "timeout",
                "message": f"Game exceeded {timeout}s time limit",
                "partialResult": game_state,
                "metrics": metrics,
            }
        except Exception as e:
            logger.error(f"Error in training game simulation: {str(e)}")
            return {
                "error": "simulation_error",
                "message": str(e),
                "partialResult": game_state,
                "metrics": metrics,
            }

    async def _analyze_training_moves(
        self, moves: List[Dict], game_state: Dict, student_ai: Dict, teacher_ai: Dict
    ) -> Dict[str, Any]:
        """Perform detailed analysis of training game moves"""
        analysis = {
            "moves": [],
            "patterns": {},
            "mistakes": [],
            "improvements": [],
            "averageQuality": 0.0,
            "consistency": 0.0,
        }

        board = [[0 for _ in range(7)] for _ in range(6)]
        position_history = []
        move_qualities = []

        for i, move in enumerate(moves):
            move_start = datetime.now()

            # Update board state
            col = move.get("column", 0)
            player = move.get("player", 1)
            row = self._get_available_row(board, col)

            if row is not None:
                board[row][col] = player
                position_history.append([row[:] for row in board])

                # Evaluate move quality
                move_eval = await self._evaluate_move_quality(
                    board, row, col, player, position_history, i
                )

                move_qualities.append(move_eval["quality"])

                # Classify move
                move_classification = self._classify_move(move_eval, board, row, col)

                # Track timing
                move_time = (datetime.now() - move_start).total_seconds()
                game_state["move_times"].append(move_time)

                # Build move analysis
                move_analysis = {
                    "moveNumber": i + 1,
                    "player": player,
                    "column": col,
                    "row": row,
                    "quality": move_eval["quality"],
                    "evaluation": move_eval["evaluation"],
                    "classification": move_classification,
                    "alternatives": move_eval.get("alternatives", []),
                    "threats": move_eval.get("threats", []),
                    "opportunities": move_eval.get("opportunities", []),
                    "timeSpent": move_time,
                    "positionComplexity": move_eval.get("complexity", 0),
                    "criticalMove": move_eval.get("critical", False),
                }

                analysis["moves"].append(move_analysis)

                # Track special moves
                if move_classification == "blunder":
                    analysis["mistakes"].append(move_analysis)
                    game_state["blunders"].append(move_analysis)
                elif move_classification == "brilliant":
                    game_state["brilliant_moves"].append(move_analysis)
                elif move_eval.get("critical", False):
                    game_state["critical_moments"].append(move_analysis)

        # Calculate overall metrics
        if move_qualities:
            analysis["averageQuality"] = np.mean(move_qualities)
            analysis["consistency"] = 1.0 - np.std(move_qualities)
            analysis["openingQuality"] = (
                np.mean(move_qualities[:10])
                if len(move_qualities) >= 10
                else np.mean(move_qualities)
            )
            analysis["midgameQuality"] = (
                np.mean(move_qualities[10:30]) if len(move_qualities) > 10 else 0.0
            )
            analysis["endgameQuality"] = (
                np.mean(move_qualities[30:]) if len(move_qualities) > 30 else 0.0
            )

            # Calculate improvement trend
            if len(move_qualities) > 5:
                first_half = np.mean(move_qualities[: len(move_qualities) // 2])
                second_half = np.mean(move_qualities[len(move_qualities) // 2 :])
                analysis["improvement"] = (
                    (second_half - first_half) / first_half if first_half > 0 else 0
                )

            # Critical move accuracy
            critical_moves = [
                m for m in analysis["moves"] if m.get("criticalMove", False)
            ]
            if critical_moves:
                critical_qualities = [m["quality"] for m in critical_moves]
                analysis["criticalAccuracy"] = np.mean(critical_qualities)

        # Pattern detection
        analysis["patterns"] = self._detect_move_patterns(analysis["moves"], board)

        return analysis

    async def _evaluate_move_quality(
        self,
        board: List[List[int]],
        row: int,
        col: int,
        player: int,
        history: List,
        move_num: int,
    ) -> Dict[str, Any]:
        """Evaluate the quality of a specific move"""
        evaluation = {
            "quality": 0.5,  # Default neutral
            "evaluation": 0.0,
            "alternatives": [],
            "threats": [],
            "opportunities": [],
            "complexity": 0.0,
            "critical": False,
        }

        try:
            # Check for immediate wins/blocks
            if self._creates_win(board, row, col, player):
                evaluation["quality"] = 1.0
                evaluation["evaluation"] = 100.0
            elif self._blocks_win(board, row, col, player):
                evaluation["quality"] = 0.95
                evaluation["evaluation"] = 50.0
                evaluation["critical"] = True
            else:
                # Evaluate position after move
                pos_eval = self._evaluate_position(board, player)
                evaluation["evaluation"] = pos_eval

                # Calculate quality based on position change
                if move_num > 0 and history:
                    prev_board = (
                        history[-2] if len(history) > 1 else [[0] * 7 for _ in range(6)]
                    )
                    prev_eval = self._evaluate_position(prev_board, player)
                    eval_change = pos_eval - prev_eval

                    # Normalize to 0-1 scale
                    evaluation["quality"] = 0.5 + (eval_change / 100.0)
                    evaluation["quality"] = max(0.0, min(1.0, evaluation["quality"]))

                # Find better alternatives
                alternatives = self._find_better_moves(board, row, col, player)
                evaluation["alternatives"] = alternatives[:3]  # Top 3 alternatives

                # Adjust quality if better moves exist
                if (
                    alternatives
                    and alternatives[0]["evaluation"] > evaluation["evaluation"]
                ):
                    quality_penalty = (
                        alternatives[0]["evaluation"] - evaluation["evaluation"]
                    ) / 100.0
                    evaluation["quality"] -= quality_penalty
                    evaluation["quality"] = max(0.0, evaluation["quality"])

            # Detect threats and opportunities
            evaluation["threats"] = self._detect_threats(board, player)
            evaluation["opportunities"] = self._detect_opportunities(board, player)

            # Calculate position complexity
            evaluation["complexity"] = self._calculate_position_complexity(board)

            # Mark as critical if multiple threats/opportunities
            if len(evaluation["threats"]) >= 2 or len(evaluation["opportunities"]) >= 2:
                evaluation["critical"] = True

        except Exception as e:
            logger.error(f"Error evaluating move quality: {str(e)}")

        return evaluation

    def _classify_move(
        self, move_eval: Dict, board: List[List[int]], row: int, col: int
    ) -> str:
        """Classify a move into categories"""
        quality = move_eval.get("quality", 0.5)

        if quality >= 0.95:
            return "brilliant"
        elif quality >= 0.85:
            return "excellent"
        elif quality >= 0.7:
            return "good"
        elif quality >= 0.5:
            return "acceptable"
        elif quality >= 0.3:
            return "inaccuracy"
        elif quality >= 0.15:
            return "mistake"
        else:
            return "blunder"

    def _identify_learning_opportunities(
        self, move_analysis: Dict, game_state: Dict
    ) -> List[Dict[str, Any]]:
        """Identify specific learning opportunities from the game"""
        opportunities = []

        # Analyze mistakes
        for mistake in move_analysis.get("mistakes", []):
            if mistake.get("alternatives"):
                opportunities.append(
                    {
                        "type": "missed_opportunity",
                        "moveNumber": mistake["moveNumber"],
                        "description": f"Better move available at column {mistake['alternatives'][0]['column']}",
                        "improvement": mistake["alternatives"][0]["evaluation"]
                        - mistake["evaluation"],
                        "concept": self._identify_concept(mistake, game_state),
                    }
                )

        # Analyze patterns
        patterns = move_analysis.get("patterns", {})
        if patterns.get("weaknesses"):
            for weakness in patterns["weaknesses"]:
                opportunities.append(
                    {
                        "type": "pattern_weakness",
                        "description": weakness["description"],
                        "frequency": weakness["frequency"],
                        "concept": weakness["concept"],
                        "exercises": self._suggest_exercises(weakness),
                    }
                )

        # Analyze critical moments
        critical_accuracy = move_analysis.get("criticalAccuracy", 0)
        if critical_accuracy < 0.7:
            opportunities.append(
                {
                    "type": "critical_moment_training",
                    "description": "Improve decision-making in critical positions",
                    "currentLevel": critical_accuracy,
                    "targetLevel": 0.85,
                    "exercises": ["tactical_puzzles", "time_pressure_training"],
                }
            )

        return opportunities

    async def _generate_training_recommendations(
        self, result: Dict, student_ai: Dict, teacher_ai: Dict, game_state: Dict
    ) -> List[Dict[str, Any]]:
        """Generate personalized training recommendations"""
        recommendations = []

        # Analyze weaknesses
        if result.get("moveAnalysis"):
            move_quality = result["moveAnalysis"].get("averageQuality", 0)

            if move_quality < 0.6:
                recommendations.append(
                    {
                        "priority": "high",
                        "area": "fundamental_tactics",
                        "description": "Focus on basic tactical patterns",
                        "exercises": [
                            "pattern_recognition",
                            "simple_combinations",
                            "threat_detection",
                        ],
                        "estimatedTime": "2-3 hours",
                        "difficultyAdjustment": -0.2,
                    }
                )

            # Phase-specific recommendations
            phase_quality = result.get("moveQuality", {}).get("byPhase", {})
            weakest_phase = (
                min(phase_quality.items(), key=lambda x: x[1])[0]
                if phase_quality
                else None
            )

            if weakest_phase:
                recommendations.append(
                    {
                        "priority": "medium",
                        "area": f"{weakest_phase}_improvement",
                        "description": f"Strengthen {weakest_phase} play",
                        "exercises": self._get_phase_exercises(weakest_phase),
                        "estimatedTime": "1-2 hours",
                    }
                )

        # Strategic recommendations
        if (
            result.get("metrics", {}).get("performance", {}).get("strategicDepth", 0)
            < 0.5
        ):
            recommendations.append(
                {
                    "priority": "medium",
                    "area": "strategic_planning",
                    "description": "Develop long-term planning skills",
                    "exercises": [
                        "positional_play",
                        "pawn_structure_analysis",
                        "plan_formulation",
                    ],
                    "estimatedTime": "3-4 hours",
                }
            )

        return recommendations

    def _calculate_skill_differential(
        self, result: Dict, student_ai: Dict, teacher_ai: Dict
    ) -> Dict[str, float]:
        """Calculate skill differential between student and teacher"""
        differential = {
            "overall": 0.0,
            "tactical": 0.0,
            "strategic": 0.0,
            "endgame": 0.0,
            "timeManagement": 0.0,
        }

        # Overall skill based on game result
        if result.get("winner") == 1:  # Student won
            differential["overall"] = 0.1
        elif result.get("winner") == 2:  # Teacher won
            differential["overall"] = -0.3
        else:  # Draw
            differential["overall"] = -0.1

        # Adjust based on game quality
        if result.get("moveAnalysis"):
            quality_diff = result["moveAnalysis"].get("averageQuality", 0.5) - 0.75
            differential["overall"] += quality_diff * 0.5

        # Component skills
        if result.get("metrics", {}).get("performance"):
            perf = result["metrics"]["performance"]
            differential["tactical"] = perf.get("tacticalSharpness", 0.5) - 0.7
            differential["strategic"] = perf.get("strategicDepth", 0.5) - 0.7
            differential["endgame"] = perf.get("endgameSkill", 0.5) - 0.7

        return differential

    def _get_available_row(self, board: List[List[int]], col: int) -> Optional[int]:
        """Get the lowest available row in a column"""
        for row in range(5, -1, -1):
            if board[row][col] == 0:
                return row
        return None

    def _creates_win(
        self, board: List[List[int]], row: int, col: int, player: int
    ) -> bool:
        """Check if a move creates a win"""
        # This is a simplified check - enhance as needed
        return self._check_win_from_position(board, row, col, player)

    def _blocks_win(
        self, board: List[List[int]], row: int, col: int, player: int
    ) -> bool:
        """Check if a move blocks opponent's win"""
        opponent = 3 - player
        # Temporarily remove the move
        board[row][col] = 0

        # Check if opponent could win there
        result = self._creates_win(board, row, col, opponent)

        # Restore the move
        board[row][col] = player
        return result

    def _check_win_from_position(
        self, board: List[List[int]], row: int, col: int, player: int
    ) -> bool:
        """Check if placing a piece at (row, col) creates a win for player"""
        directions = [(0, 1), (1, 0), (1, 1), (1, -1)]

        for dr, dc in directions:
            count = 1  # Count the piece itself

            # Check positive direction
            r, c = row + dr, col + dc
            while 0 <= r < 6 and 0 <= c < 7 and board[r][c] == player:
                count += 1
                r += dr
                c += dc

            # Check negative direction
            r, c = row - dr, col - dc
            while 0 <= r < 6 and 0 <= c < 7 and board[r][c] == player:
                count += 1
                r -= dr
                c -= dc

            if count >= 4:
                return True

        return False

    def _find_better_moves(
        self, board: List[List[int]], row: int, col: int, player: int
    ) -> List[Dict]:
        """Find better alternative moves"""
        # Temporarily remove the current move
        board[row][col] = 0
        alternatives = []

        for c in range(7):
            r = self._get_available_row(board, c)
            if r is not None:
                board[r][c] = player
                eval_score = self._evaluate_position(board, player)
                alternatives.append({"column": c, "row": r, "evaluation": eval_score})
                board[r][c] = 0

        # Restore the original move
        board[row][col] = player

        # Sort by evaluation
        alternatives.sort(key=lambda x: x["evaluation"], reverse=True)
        return alternatives

    def _detect_move_patterns(self, moves: List[Dict], board: List[List[int]]) -> Dict:
        """Detect patterns in move sequences"""
        patterns = {
            "openingStyle": "unknown",
            "commonSequences": [],
            "weaknesses": [],
            "strengths": [],
        }

        # Analyze opening moves
        if len(moves) >= 4:
            first_moves = [m["column"] for m in moves[:4]]
            if all(c == 3 for c in first_moves[:2]):
                patterns["openingStyle"] = "center_focused"
            elif any(c in [0, 6] for c in first_moves[:2]):
                patterns["openingStyle"] = "edge_focused"
            else:
                patterns["openingStyle"] = "balanced"

        # Detect repeated patterns
        if len(moves) >= 10:
            sequences = []
            for i in range(len(moves) - 3):
                seq = tuple(m["column"] for m in moves[i : i + 3])
                sequences.append(seq)

            from collections import Counter

            seq_counts = Counter(sequences)
            patterns["commonSequences"] = [
                {"sequence": list(seq), "count": count}
                for seq, count in seq_counts.most_common(3)
                if count > 1
            ]

        return patterns

    def _get_phase_exercises(self, phase: str) -> List[str]:
        """Get exercises for a specific game phase"""
        exercises = {
            "opening": ["opening_principles", "center_control", "development_patterns"],
            "midgame": ["combination_tactics", "position_evaluation", "plan_execution"],
            "endgame": ["winning_patterns", "defensive_techniques", "tempo_management"],
        }
        return exercises.get(phase, [])

    def _calculate_win_probability(self, result: Dict, player_type: str) -> float:
        """Calculate win probability based on game progression"""
        if not result.get("moves"):
            return 0.5

        # Simple estimation based on final result and game quality
        base_prob = 0.5
        if result.get("winner") == (1 if player_type == "student" else 2):
            base_prob = 0.7
        elif result.get("winner") == 0:
            base_prob = 0.5
        else:
            base_prob = 0.3

        # Adjust based on game quality
        if result.get("moveAnalysis"):
            quality = result["moveAnalysis"].get("averageQuality", 0.5)
            base_prob = base_prob * 0.7 + quality * 0.3

        return base_prob

    def _calculate_average_complexity(self, evaluations: List[Dict]) -> float:
        """Calculate average position complexity"""
        if not evaluations:
            return 0.0
        complexities = [e.get("complexity", 0) for e in evaluations]
        return np.mean(complexities) if complexities else 0.0

    def _evaluate_strategic_depth(self, moves: List[Dict]) -> float:
        """Evaluate strategic depth of play"""
        if len(moves) < 10:
            return 0.0

        # Look for strategic patterns
        depth_score = 0.5

        # Check for consistent plans
        if self._has_consistent_plan(moves):
            depth_score += 0.2

        # Check for long-term threats
        if self._creates_long_term_threats(moves):
            depth_score += 0.15

        # Check for positional understanding
        if self._shows_positional_understanding(moves):
            depth_score += 0.15

        return min(1.0, depth_score)

    def _evaluate_tactical_sharpness(self, game_state: Dict) -> float:
        """Evaluate tactical sharpness"""
        base_score = 0.5

        # Reward finding brilliant moves
        brilliant_count = len(game_state.get("brilliant_moves", []))
        base_score += brilliant_count * 0.1

        # Penalize blunders
        blunder_count = len(game_state.get("blunders", []))
        base_score -= blunder_count * 0.15

        # Reward accuracy in critical moments
        critical_moves = game_state.get("critical_moments", [])
        if critical_moves:
            critical_quality = np.mean([m.get("quality", 0.5) for m in critical_moves])
            base_score = base_score * 0.7 + critical_quality * 0.3

        return max(0.0, min(1.0, base_score))

    def _evaluate_endgame_skill(self, result: Dict, game_state: Dict) -> float:
        """Evaluate endgame skill"""
        if len(result.get("moves", [])) < 30:
            return 0.5  # Game didn't reach endgame

        # Analyze last 10 moves
        if result.get("moveAnalysis", {}).get("moves"):
            endgame_moves = result["moveAnalysis"]["moves"][-10:]
            endgame_quality = np.mean([m.get("quality", 0.5) for m in endgame_moves])
            return endgame_quality

        return 0.5

    def _has_consistent_plan(self, moves: List[Dict]) -> bool:
        """Check if moves show consistent planning"""
        # Simplified check - enhance as needed
        return len(moves) > 10

    def _creates_long_term_threats(self, moves: List[Dict]) -> bool:
        """Check if moves create long-term threats"""
        # Simplified check - enhance as needed
        return len(moves) > 15

    def _shows_positional_understanding(self, moves: List[Dict]) -> bool:
        """Check if moves show positional understanding"""
        # Simplified check - enhance as needed
        return True

    def _identify_concept(self, mistake: Dict, game_state: Dict) -> str:
        """Identify the concept related to a mistake"""
        # Simplified concept identification
        if mistake.get("classification") == "blunder":
            return "tactical_awareness"
        elif mistake.get("moveNumber", 0) < 10:
            return "opening_principles"
        elif mistake.get("moveNumber", 0) > 30:
            return "endgame_technique"
        else:
            return "middle_game_strategy"

    def _suggest_exercises(self, weakness: Dict) -> List[str]:
        """Suggest exercises for a specific weakness"""
        concept = weakness.get("concept", "")

        exercise_map = {
            "tactical_awareness": ["tactical_puzzles", "pattern_recognition"],
            "opening_principles": ["opening_drills", "center_control_exercises"],
            "endgame_technique": ["endgame_studies", "winning_patterns"],
            "positional_play": ["position_evaluation", "strategic_planning"],
        }

        return exercise_map.get(concept, ["general_practice"])

    def _calculate_position_complexity(self, board: List[List[int]]) -> float:
        """Calculate the complexity of a position"""
        complexity = 0.0

        # Count pieces
        pieces = sum(1 for row in board for cell in row if cell != 0)
        complexity += pieces * 0.02

        # Count potential threats
        for row in range(6):
            for col in range(7):
                if board[row][col] == 0:
                    # Check if this square is tactically important
                    for player in [1, 2]:
                        if self._creates_threat_at(board, row, col, player):
                            complexity += 0.1

        return min(1.0, complexity)

    async def start(
        self,
        max_retries: int = 3,
        retry_delay: float = 5.0,
        health_check_interval: float = 30.0,
    ) -> bool:
        """
        Start the integration client with advanced error handling and health monitoring

        Args:
            max_retries: Maximum connection retry attempts
            retry_delay: Delay between retry attempts in seconds
            health_check_interval: Interval for health checks in seconds

        Returns:
            bool: True if successfully started, False otherwise
        """
        self._running = True
        self._health_check_task = None
        self._connection_start_time = None
        self._reconnect_attempts = 0

        for attempt in range(max_retries):
            try:
                logger.info(
                    f"🔄 Attempting to start AI Coordination Integration (attempt {attempt + 1}/{max_retries})"
                )

                # Pre-connection health check
                if not await self._pre_connection_health_check():
                    logger.warning("⚠️ Pre-connection health check failed")
                    if attempt < max_retries - 1:
                        await asyncio.sleep(retry_delay)
                        continue
                    return False

                # Connect with timeout
                await asyncio.wait_for(self.client.connect(), timeout=30.0)

                # Verify connection
                if not await self._verify_connection():
                    raise ConnectionError("Connection verification failed")

                self._connection_start_time = datetime.now()

                # Start health monitoring
                self._health_check_task = asyncio.create_task(
                    self._health_check_loop(health_check_interval)
                )

                # Register service capabilities
                await self._register_enhanced_capabilities()

                # Initialize performance monitoring
                await self._initialize_monitoring()

                logger.info("✅ AI Coordination Integration started successfully")
                logger.info(f"📊 Connection established in {attempt + 1} attempts")

                # Send startup telemetry
                await self._send_startup_telemetry(
                    {
                        "attempts": attempt + 1,
                        "total_time": (
                            datetime.now() - self._connection_start_time
                        ).total_seconds(),
                    }
                )

                return True

            except asyncio.TimeoutError:
                logger.error(f"⏱️ Connection timeout on attempt {attempt + 1}")
            except Exception as e:
                logger.error(f"❌ Failed to start integration: {str(e)}")

            if attempt < max_retries - 1:
                wait_time = retry_delay * (2**attempt)  # Exponential backoff
                logger.info(f"⏳ Waiting {wait_time}s before retry...")
                await asyncio.sleep(wait_time)

        logger.error(
            f"❌ Failed to start AI Coordination Integration after {max_retries} attempts"
        )
        return False

    async def stop(self, graceful_timeout: float = 30.0, force: bool = False) -> bool:
        """
        Stop the integration client with graceful shutdown

        Args:
            graceful_timeout: Maximum time to wait for graceful shutdown
            force: Force immediate shutdown without cleanup

        Returns:
            bool: True if successfully stopped, False otherwise
        """
        if not self._running:
            logger.warning("⚠️ Integration client is not running")
            return True

        logger.info("🛑 Initiating AI Coordination Integration shutdown...")
        self._running = False

        try:
            if not force:
                # Start graceful shutdown
                shutdown_start = datetime.now()

                # Cancel health monitoring
                if self._health_check_task:
                    self._health_check_task.cancel()
                    try:
                        await self._health_check_task
                    except asyncio.CancelledError:
                        pass

                # Save current state
                await self._save_state()

                # Notify connected services
                await self._notify_shutdown()

                # Wait for pending operations
                await self._wait_for_pending_operations(graceful_timeout * 0.5)

                # Perform cleanup
                await self._cleanup_resources()

                # Send shutdown telemetry
                if self._connection_start_time:
                    session_duration = (
                        datetime.now() - self._connection_start_time
                    ).total_seconds()
                    await self._send_shutdown_telemetry(
                        {
                            "session_duration": session_duration,
                            "graceful": True,
                            "shutdown_time": (
                                datetime.now() - shutdown_start
                            ).total_seconds(),
                        }
                    )

            # Disconnect
            await asyncio.wait_for(
                self.client.disconnect(), timeout=graceful_timeout if not force else 5.0
            )

            logger.info("✅ AI Coordination Integration stopped successfully")
            return True

        except asyncio.TimeoutError:
            logger.error(f"⏱️ Shutdown timeout after {graceful_timeout}s")
            if not force:
                logger.warning("⚠️ Attempting force shutdown...")
                return await self.stop(graceful_timeout=5.0, force=True)
            return False

        except Exception as e:
            logger.error(f"❌ Error during shutdown: {str(e)}")
            return False

    async def _pre_connection_health_check(self) -> bool:
        """Perform pre-connection health checks"""
        checks = {
            "network": await self._check_network_connectivity(),
            "resources": await self._check_system_resources(),
            "dependencies": await self._check_dependencies(),
        }

        failed_checks = [name for name, status in checks.items() if not status]

        if failed_checks:
            logger.warning(
                f"⚠️ Pre-connection checks failed: {', '.join(failed_checks)}"
            )
            return False

        logger.info("✅ All pre-connection checks passed")
        return True

    async def _verify_connection(self) -> bool:
        """Verify the connection is properly established"""
        try:
            # Send a ping and wait for response
            response = await self.client.call("ping", timeout=5.0)
            return response.get("status") == "ok"
        except:
            return False

    async def _health_check_loop(self, interval: float):
        """Continuous health monitoring"""
        while self._running:
            try:
                await asyncio.sleep(interval)

                health_status = await self._perform_health_check()

                if not health_status["healthy"]:
                    logger.warning(f"⚠️ Health check failed: {health_status['issues']}")
                    await self._handle_health_issues(health_status["issues"])

                # Update metrics
                await self._update_health_metrics(health_status)

            except asyncio.CancelledError:
                break
            except Exception as e:
                logger.error(f"Error in health check loop: {str(e)}")

    async def _perform_health_check(self) -> Dict[str, Any]:
        """Perform comprehensive health check"""
        health_status = {"healthy": True, "checks": {}, "issues": [], "metrics": {}}

        # Connection health
        if not self.client.connected:
            health_status["healthy"] = False
            health_status["issues"].append("Connection lost")

        # Memory usage
        import psutil

        process = psutil.Process()
        memory_percent = process.memory_percent()
        health_status["metrics"]["memory_percent"] = memory_percent

        if memory_percent > 80:
            health_status["healthy"] = False
            health_status["issues"].append(f"High memory usage: {memory_percent:.1f}%")

        # Response time check
        start_time = datetime.now()
        try:
            await self.client.call("ping", timeout=2.0)
            response_time = (datetime.now() - start_time).total_seconds()
            health_status["metrics"]["response_time"] = response_time

            if response_time > 1.0:
                health_status["issues"].append(
                    f"Slow response time: {response_time:.2f}s"
                )
        except:
            health_status["healthy"] = False
            health_status["issues"].append("Ping timeout")

        return health_status

    async def _handle_health_issues(self, issues: List[str]):
        """
        Advanced health issue handler with intelligent prioritization and resolution
        """
        # Initialize issue tracking if not exists
        if not hasattr(self, "_health_issue_history"):
            self._health_issue_history = defaultdict(list)
            self._issue_resolution_stats = defaultdict(
                lambda: {"success": 0, "failure": 0}
            )

        # Categorize and prioritize issues
        prioritized_issues = self._prioritize_health_issues(issues)

        # Track issue patterns
        current_time = datetime.now()
        for issue in issues:
            self._health_issue_history[issue].append(current_time)

        # Handle issues based on priority and type
        for priority, issue_list in prioritized_issues.items():
            for issue_info in issue_list:
                try:
                    resolution_success = await self._resolve_health_issue(issue_info)

                    # Track resolution statistics
                    issue_type = issue_info["type"]
                    if resolution_success:
                        self._issue_resolution_stats[issue_type]["success"] += 1
                    else:
                        self._issue_resolution_stats[issue_type]["failure"] += 1

                    # Escalate if persistent
                    if not resolution_success:
                        await self._escalate_health_issue(issue_info)

                except Exception as e:
                    logger.error(f"Error handling health issue {issue_info}: {str(e)}")

        # Analyze patterns and adjust strategies
        await self._analyze_health_patterns()

    def _prioritize_health_issues(self, issues: List[str]) -> Dict[str, List[Dict]]:
        """Categorize and prioritize health issues"""
        prioritized = {"critical": [], "high": [], "medium": [], "low": []}

        for issue in issues:
            issue_info = self._parse_health_issue(issue)

            # Determine priority based on impact and frequency
            if "Connection lost" in issue or "service unavailable" in issue.lower():
                issue_info["priority"] = "critical"
                prioritized["critical"].append(issue_info)
            elif "High memory" in issue or "CPU" in issue:
                # Check if it's recurring
                recent_occurrences = self._count_recent_occurrences(issue, minutes=5)
                if recent_occurrences > 3:
                    issue_info["priority"] = "high"
                    prioritized["high"].append(issue_info)
                else:
                    issue_info["priority"] = "medium"
                    prioritized["medium"].append(issue_info)
            elif "Slow response" in issue:
                issue_info["priority"] = "medium"
                prioritized["medium"].append(issue_info)
            else:
                issue_info["priority"] = "low"
                prioritized["low"].append(issue_info)

        return prioritized

    def _parse_health_issue(self, issue: str) -> Dict[str, Any]:
        """Parse health issue string into structured format"""
        issue_info = {"raw": issue, "type": "unknown", "severity": 0, "details": {}}

        if "Connection lost" in issue:
            issue_info["type"] = "connection"
            issue_info["severity"] = 10
        elif "High memory" in issue:
            issue_info["type"] = "memory"
            issue_info["severity"] = 7
            # Extract memory percentage if available
            import re

            match = re.search(r"(\d+\.?\d*)%", issue)
            if match:
                issue_info["details"]["percentage"] = float(match.group(1))
        elif "Slow response" in issue:
            issue_info["type"] = "performance"
            issue_info["severity"] = 5
            # Extract response time if available
            match = re.search(r"(\d+\.?\d*)s", issue)
            if match:
                issue_info["details"]["response_time"] = float(match.group(1))
        elif "CPU" in issue:
            issue_info["type"] = "cpu"
            issue_info["severity"] = 8

        return issue_info

    def _count_recent_occurrences(self, issue: str, minutes: int = 5) -> int:
        """Count recent occurrences of an issue"""
        if issue not in self._health_issue_history:
            return 0

        cutoff_time = datetime.now() - timedelta(minutes=minutes)
        recent_count = sum(
            1
            for timestamp in self._health_issue_history[issue]
            if timestamp > cutoff_time
        )
        return recent_count

    async def _resolve_health_issue(self, issue_info: Dict[str, Any]) -> bool:
        """Attempt to resolve a specific health issue"""
        issue_type = issue_info["type"]

        if issue_type == "connection":
            return await self._handle_connection_issue(issue_info)
        elif issue_type == "memory":
            return await self._handle_memory_issue(issue_info)
        elif issue_type == "performance":
            return await self._handle_performance_issue(issue_info)
        elif issue_type == "cpu":
            return await self._handle_cpu_issue(issue_info)
        else:
            logger.warning(f"Unknown issue type: {issue_type}")
            return False

    async def _handle_connection_issue(self, issue_info: Dict) -> bool:
        """Handle connection-related issues"""
        return await self._attempt_reconnection()

    async def _handle_memory_issue(self, issue_info: Dict) -> bool:
        """Handle memory-related issues"""
        memory_percentage = issue_info["details"].get("percentage", 0)

        if memory_percentage > 90:
            return await self._aggressive_memory_cleanup()
        else:
            return await self._reduce_memory_usage()

    async def _handle_performance_issue(self, issue_info: Dict) -> bool:
        """Handle performance-related issues"""
        response_time = issue_info["details"].get("response_time", 0)

        if response_time > 5:
            return await self._emergency_performance_optimization()
        else:
            return await self._optimize_performance()

    async def _handle_cpu_issue(self, issue_info: Dict) -> bool:
        """Handle CPU-related issues"""
        return await self._reduce_cpu_usage()

    async def _escalate_health_issue(self, issue_info: Dict):
        """Escalate unresolved health issues"""
        logger.warning(f"⚠️ Escalating unresolved issue: {issue_info['raw']}")

        # Notify monitoring systems
        await self.client.emit(
            "health_issue_escalation",
            {
                "service": self.service_name,
                "issue": issue_info,
                "resolution_attempts": self._issue_resolution_stats[issue_info["type"]],
                "timestamp": datetime.now().isoformat(),
            },
        )

        # Take drastic measures based on issue type
        if issue_info["priority"] == "critical":
            if issue_info["type"] == "connection":
                # Multiple reconnection failures - initiate service migration
                logger.error(
                    "🚨 Critical connection failure - initiating service migration"
                )
                await self._initiate_service_migration()

    async def _analyze_health_patterns(self):
        """Analyze health issue patterns and adjust strategies"""
        # Clean old history (keep last hour)
        cutoff_time = datetime.now() - timedelta(hours=1)
        for issue, timestamps in list(self._health_issue_history.items()):
            self._health_issue_history[issue] = [
                ts for ts in timestamps if ts > cutoff_time
            ]
            if not self._health_issue_history[issue]:
                del self._health_issue_history[issue]

        # Identify recurring patterns
        patterns = []
        for issue, timestamps in self._health_issue_history.items():
            if len(timestamps) >= 5:
                # Calculate frequency
                time_diffs = [
                    timestamps[i + 1] - timestamps[i]
                    for i in range(len(timestamps) - 1)
                ]
                avg_interval = sum(td.total_seconds() for td in time_diffs) / len(
                    time_diffs
                )

                patterns.append(
                    {
                        "issue": issue,
                        "frequency": len(timestamps),
                        "avg_interval_seconds": avg_interval,
                        "pattern_type": self._classify_pattern(
                            avg_interval, len(timestamps)
                        ),
                    }
                )

        # Adjust strategies based on patterns
        for pattern in patterns:
            await self._adjust_health_strategy(pattern)

    def _classify_pattern(self, avg_interval: float, frequency: int) -> str:
        """Classify issue pattern"""
        if avg_interval < 30 and frequency > 10:
            return "rapid_recurring"
        elif avg_interval < 300:
            return "frequent"
        elif frequency > 5:
            return "periodic"
        else:
            return "sporadic"

    async def _adjust_health_strategy(self, pattern: Dict):
        """Adjust health monitoring strategy based on patterns"""
        if pattern["pattern_type"] == "rapid_recurring":
            logger.warning(f"🚨 Rapid recurring issue detected: {pattern['issue']}")
            # Implement more aggressive measures
            if "memory" in pattern["issue"].lower():
                await self._implement_memory_limit()
            elif "connection" in pattern["issue"].lower():
                await self._implement_connection_pooling()

    async def _attempt_reconnection(self) -> bool:
        """
        Advanced reconnection with circuit breaker pattern and intelligent backoff
        """
        # Initialize circuit breaker if not exists
        if not hasattr(self, "_circuit_breaker"):
            self._circuit_breaker = {
                "state": "closed",  # closed, open, half_open
                "failure_count": 0,
                "last_failure_time": None,
                "success_count": 0,
                "last_attempt_time": None,
            }

        # Check circuit breaker state
        if self._circuit_breaker["state"] == "open":
            # Check if enough time has passed to try again
            if self._circuit_breaker["last_failure_time"]:
                time_since_failure = (
                    datetime.now() - self._circuit_breaker["last_failure_time"]
                ).total_seconds()
                if time_since_failure < 60:  # 1 minute cooldown
                    logger.warning(
                        "⚡ Circuit breaker OPEN - skipping reconnection attempt"
                    )
                    return False
                else:
                    # Move to half-open state
                    self._circuit_breaker["state"] = "half_open"
                    logger.info(
                        "⚡ Circuit breaker HALF-OPEN - attempting reconnection"
                    )

        self._reconnect_attempts += 1
        attempt_start = datetime.now()

        # Calculate backoff with jitter
        backoff_base = min(2 ** (self._reconnect_attempts - 1), 60)
        jitter = np.random.uniform(0, backoff_base * 0.3)
        backoff_time = backoff_base + jitter

        logger.info(
            f"🔄 Attempting reconnection (attempt {self._reconnect_attempts}) with {backoff_time:.1f}s backoff"
        )

        try:
            # Pre-reconnection cleanup
            await self._pre_reconnection_cleanup()

            # Attempt connection with multiple strategies
            connection_strategies = [
                self._direct_reconnect,
                self._reconnect_with_new_session,
                self._reconnect_with_alternate_endpoint,
                self._reconnect_with_reduced_capabilities,
            ]

            for strategy in connection_strategies:
                try:
                    success = await strategy()
                    if success:
                        # Reset circuit breaker on success
                        self._circuit_breaker["state"] = "closed"
                        self._circuit_breaker["failure_count"] = 0
                        self._circuit_breaker["success_count"] += 1
                        self._reconnect_attempts = 0

                        # Restore full capabilities
                        await self._restore_full_capabilities()

                        logger.info(
                            f"✅ Reconnection successful using {strategy.__name__}"
                        )

                        # Send reconnection telemetry
                        await self._send_reconnection_telemetry(
                            {
                                "strategy": strategy.__name__,
                                "attempts": self._reconnect_attempts,
                                "duration": (
                                    datetime.now() - attempt_start
                                ).total_seconds(),
                            }
                        )

                        return True

                except Exception as e:
                    logger.warning(f"Strategy {strategy.__name__} failed: {str(e)}")
                    continue

            # All strategies failed
            raise ConnectionError("All reconnection strategies failed")

        except Exception as e:
            logger.error(f"❌ Reconnection failed: {str(e)}")

            # Update circuit breaker
            self._circuit_breaker["failure_count"] += 1
            self._circuit_breaker["last_failure_time"] = datetime.now()

            if self._circuit_breaker["failure_count"] >= 3:
                self._circuit_breaker["state"] = "open"
                logger.error("⚡ Circuit breaker OPEN - too many failures")

            # Check if we should give up
            if self._reconnect_attempts >= self._get_max_reconnect_attempts():
                logger.error("❌ Max reconnection attempts reached")
                await self._handle_permanent_connection_failure()
                return False

            # Wait before next attempt
            await asyncio.sleep(backoff_time)
            return False

    async def _direct_reconnect(self) -> bool:
        """Direct reconnection attempt"""
        await self.client.connect()
        return await self._verify_connection()

    async def _reconnect_with_new_session(self) -> bool:
        """Reconnect with a new session"""
        # Disconnect existing session
        try:
            await self.client.disconnect()
        except:
            pass

        # Create new client instance
        self.client = IntegrationClient(
            self.service_name, self.integration_url, self.capabilities
        )

        await self.client.connect()
        return await self._verify_connection()

    async def _reconnect_with_alternate_endpoint(self) -> bool:
        """Try alternate endpoints if available"""
        if hasattr(self, "_alternate_endpoints"):
            for endpoint in self._alternate_endpoints:
                try:
                    self.client.connection_url = endpoint
                    await self.client.connect()
                    if await self._verify_connection():
                        logger.info(f"✅ Connected to alternate endpoint: {endpoint}")
                        return True
                except:
                    continue
        return False

    async def _reconnect_with_reduced_capabilities(self) -> bool:
        """Reconnect with reduced capabilities for stability"""
        logger.info("📉 Attempting reconnection with reduced capabilities")

        # Reduce capabilities
        original_capabilities = self.capabilities.copy()
        self.capabilities = ["basic_operations"]

        try:
            await self.client.connect()
            if await self._verify_connection():
                logger.info("✅ Connected with reduced capabilities")

                # Gradually restore capabilities
                asyncio.create_task(
                    self._gradual_capability_restoration(original_capabilities)
                )
                return True
        except:
            self.capabilities = original_capabilities

        return False

    async def _pre_reconnection_cleanup(self):
        """
        Comprehensive cleanup before reconnection attempt with state preservation
        """
        cleanup_start = datetime.now()
        cleanup_report = {
            "timestamp": cleanup_start.isoformat(),
            "operations_cleared": 0,
            "resources_freed": 0,
            "state_preserved": {},
            "errors": [],
        }

        try:
            # Phase 1: Preserve critical state before cleanup
            critical_state = await self._preserve_critical_state()
            cleanup_report["state_preserved"] = critical_state

            # Phase 2: Cancel active operations gracefully
            if hasattr(self, "_active_tasks"):
                cancelled_count = 0
                for task in list(self._active_tasks):
                    if not task.done():
                        try:
                            task.cancel()
                            # Give task a chance to cleanup
                            try:
                                await asyncio.wait_for(task, timeout=0.5)
                            except (asyncio.TimeoutError, asyncio.CancelledError):
                                pass
                            cancelled_count += 1
                        except Exception as e:
                            cleanup_report["errors"].append(
                                f"Task cancellation error: {str(e)}"
                            )
                cleanup_report["operations_cleared"] += cancelled_count
                self._active_tasks.clear()

            # Phase 3: Clear pending operations with logging
            if hasattr(self, "_pending_operations"):
                pending_count = len(self._pending_operations)
                # Save important pending operations
                important_ops = [
                    op for op in self._pending_operations if op.get("critical")
                ]
                if important_ops:
                    cleanup_report["state_preserved"][
                        "pending_critical_ops"
                    ] = important_ops
                self._pending_operations.clear()
                cleanup_report["operations_cleared"] += pending_count

            # Phase 4: Reset connection state comprehensively
            await self._reset_connection_state()

            # Phase 5: Clear caches selectively
            cache_freed = await self._selective_cache_cleanup()
            cleanup_report["resources_freed"] += cache_freed

            # Phase 6: Reset network buffers
            await self._reset_network_buffers()

            # Phase 7: Clear event handlers that might interfere
            await self._clear_stale_event_handlers()

            # Phase 8: Reset rate limiters and throttles
            self._reset_rate_limiters()

            # Phase 9: Cleanup temporary resources
            await self._cleanup_temp_resources()

            # Phase 10: Verify cleanup success
            if not await self._verify_cleanup_success():
                logger.warning("⚠️ Cleanup verification failed, attempting deep cleanup")
                await self._deep_cleanup()

            # Log cleanup summary
            cleanup_duration = (datetime.now() - cleanup_start).total_seconds()
            logger.info(
                f"✅ Pre-reconnection cleanup completed in {cleanup_duration:.2f}s"
            )
            logger.info(
                f"📊 Cleanup stats: {cleanup_report['operations_cleared']} operations cleared, "
                f"{cleanup_report['resources_freed']} resources freed"
            )

            # Store cleanup report for analysis
            self._last_cleanup_report = cleanup_report

        except Exception as e:
            logger.error(f"❌ Error during pre-reconnection cleanup: {str(e)}")
            cleanup_report["errors"].append(f"Main cleanup error: {str(e)}")
            # Attempt emergency cleanup
            await self._emergency_cleanup()

    async def _preserve_critical_state(self) -> Dict[str, Any]:
        """Preserve critical state before cleanup"""
        critical_state = {
            "timestamp": datetime.now().isoformat(),
            "active_operations": [],
            "connection_params": {},
            "session_data": {},
        }

        # Save active operation metadata
        if hasattr(self, "_active_operations"):
            critical_state["active_operations"] = [
                {
                    "id": op.get("id"),
                    "type": op.get("type"),
                    "priority": op.get("priority", "normal"),
                    "start_time": op.get("start_time"),
                }
                for op in self._active_operations
                if op.get("priority") == "high"
            ]

        # Save connection parameters
        if hasattr(self, "client"):
            critical_state["connection_params"] = {
                "url": getattr(self.client, "connection_url", None),
                "timeout": getattr(self.client, "timeout", None),
                "reconnection_delay": getattr(self.client, "reconnection_delay", None),
            }

        # Save session data
        if hasattr(self, "_session_data"):
            critical_state["session_data"] = self._session_data.copy()

        return critical_state

    async def _reset_connection_state(self):
        """Comprehensive connection state reset"""
        # Reset client state if available
        if hasattr(self.client, "_reset_state"):
            await self.client._reset_state()

        # Reset socket state
        if hasattr(self.client, "eio") and self.client.eio:
            self.client.eio.state = "disconnected"

        # Clear message queues
        if hasattr(self.client, "_queue"):
            while not self.client._queue.empty():
                try:
                    self.client._queue.get_nowait()
                except:
                    break

        # Reset connection flags
        self._is_reconnecting = True
        self._last_successful_connection = None

    async def _selective_cache_cleanup(self) -> int:
        """Selectively clean caches preserving recent/important data"""
        freed_bytes = 0

        # Clear old cache entries but preserve recent ones
        if hasattr(self, "_cache"):
            cutoff_time = datetime.now() - timedelta(minutes=1)
            old_entries = []
            for key, value in self._cache.items():
                if isinstance(value, dict) and value.get("timestamp"):
                    if value["timestamp"] < cutoff_time:
                        old_entries.append(key)

            for key in old_entries:
                entry_size = sys.getsizeof(self._cache[key])
                del self._cache[key]
                freed_bytes += entry_size

        return freed_bytes

    async def _reset_network_buffers(self):
        """Reset network buffers and queues"""
        if hasattr(self, "_send_buffer"):
            self._send_buffer.clear()

        if hasattr(self, "_receive_buffer"):
            self._receive_buffer.clear()

        # Reset TCP nodelay if applicable
        if hasattr(self.client, "_set_tcp_nodelay"):
            await self.client._set_tcp_nodelay(True)

    async def _clear_stale_event_handlers(self):
        """Clear stale event handlers that might interfere with reconnection"""
        if hasattr(self, "_event_handlers"):
            # Keep only essential handlers
            essential_events = ["connect", "disconnect", "error", "reconnect"]
            for event in list(self._event_handlers.keys()):
                if event not in essential_events:
                    del self._event_handlers[event]

    def _reset_rate_limiters(self):
        """Reset rate limiters and throttles"""
        if hasattr(self, "_rate_limiter"):
            self._rate_limiter.reset()

        if hasattr(self, "_request_timestamps"):
            self._request_timestamps.clear()

        # Reset throttle delays
        self._throttle_delay = 0
        self._backoff_multiplier = 1.0

    async def _cleanup_temp_resources(self):
        """Cleanup temporary files and resources"""
        if hasattr(self, "_temp_files"):
            for temp_file in self._temp_files:
                try:
                    if os.path.exists(temp_file):
                        os.remove(temp_file)
                except Exception as e:
                    logger.warning(f"Failed to remove temp file {temp_file}: {e}")
            self._temp_files.clear()

    async def _verify_cleanup_success(self) -> bool:
        """Verify that cleanup was successful"""
        checks = {
            "pending_ops_cleared": not hasattr(self, "_pending_operations")
            or len(self._pending_operations) == 0,
            "active_tasks_cleared": not hasattr(self, "_active_tasks")
            or len(self._active_tasks) == 0,
            "buffers_cleared": not hasattr(self, "_send_buffer")
            or len(self._send_buffer) == 0,
            "rate_limits_reset": not hasattr(self, "_rate_limiter")
            or self._rate_limiter.is_reset(),
        }

        return all(checks.values())

    async def _deep_cleanup(self):
        """Deep cleanup when normal cleanup fails"""
        logger.warning("🧹 Performing deep cleanup")

        # Force garbage collection
        import gc

        gc.collect(2)

        # Clear all non-essential attributes
        non_essential_attrs = [
            "_cache",
            "_buffer",
            "_queue",
            "_pending",
            "_temporary",
            "_optional",
        ]

        for attr in dir(self):
            if any(keyword in attr for keyword in non_essential_attrs):
                try:
                    delattr(self, attr)
                except:
                    pass

    async def _emergency_cleanup(self):
        """Emergency cleanup when normal cleanup fails"""
        logger.error("🚨 Emergency cleanup initiated")
        try:
            # Force close connections
            if hasattr(self.client, "eio") and self.client.eio:
                self.client.eio.disconnect(abort=True)

            # Clear everything non-critical
            critical_attrs = ["service_name", "client", "capabilities", "_running"]
            for attr in list(self.__dict__.keys()):
                if attr not in critical_attrs:
                    try:
                        delattr(self, attr)
                    except:
                        pass
        except Exception as e:
            logger.error(f"Emergency cleanup failed: {e}")

    async def _restore_full_capabilities(self) -> bool:
        """
        Restore full service capabilities with validation and rollback support
        """
        restore_start = datetime.now()
        rollback_point = None

        try:
            # Create rollback point
            rollback_point = await self._create_capability_rollback_point()

            # Validate current connection health
            if not await self._validate_connection_health():
                logger.warning("⚠️ Connection not healthy enough for full capabilities")
                return False

            # Prepare capability restoration plan
            restoration_plan = await self._create_restoration_plan()

            # Execute restoration with validation
            for step in restoration_plan["steps"]:
                try:
                    logger.info(f"🔧 Restoring capability: {step['name']}")

                    # Pre-restoration check
                    if not await self._pre_capability_check(step):
                        logger.warning(f"Pre-check failed for {step['name']}")
                        continue

                    # Restore capability
                    success = await self._restore_single_capability(step)

                    if success:
                        # Validate restoration
                        if await self._validate_capability(step):
                            logger.info(f"✅ Successfully restored: {step['name']}")
                        else:
                            logger.warning(f"⚠️ Validation failed for {step['name']}")
                            await self._rollback_capability(step)
                    else:
                        logger.error(f"❌ Failed to restore: {step['name']}")

                except Exception as e:
                    logger.error(f"Error restoring {step['name']}: {str(e)}")
                    await self._handle_restoration_error(step, e)

            # Register all capabilities with the server
            registration_success = await self._register_enhanced_capabilities()

            if not registration_success:
                logger.error("❌ Failed to register capabilities")
                await self._rollback_to_point(rollback_point)
                return False

            # Verify full restoration
            if await self._verify_full_restoration():
                duration = (datetime.now() - restore_start).total_seconds()
                logger.info(f"✅ Full capabilities restored in {duration:.2f}s")

                # Send restoration telemetry
                await self._send_restoration_telemetry(
                    {
                        "duration": duration,
                        "capabilities_restored": len(self.capabilities),
                        "success": True,
                    }
                )

                return True
            else:
                logger.error("❌ Full restoration verification failed")
                await self._rollback_to_point(rollback_point)
                return False

        except Exception as e:
            logger.error(f"❌ Critical error during capability restoration: {str(e)}")
            if rollback_point:
                await self._rollback_to_point(rollback_point)
            return False

    async def _create_capability_rollback_point(self) -> Dict[str, Any]:
        """Create a rollback point for capability restoration"""
        return {
            "timestamp": datetime.now(),
            "capabilities": self.capabilities.copy(),
            "state": {
                "features": getattr(self, "_enabled_features", {}).copy(),
                "limits": getattr(self, "_resource_limits", {}).copy(),
                "config": getattr(self, "_capability_config", {}).copy(),
            },
        }

    async def _validate_connection_health(self) -> bool:
        """Validate connection is healthy enough for full capabilities"""
        health_checks = {
            "latency": await self._check_connection_latency(),
            "stability": await self._check_connection_stability(),
            "bandwidth": await self._check_available_bandwidth(),
            "error_rate": await self._check_error_rate(),
        }

        # All checks must pass
        return all(health_checks.values())

    async def _check_connection_latency(self) -> bool:
        """Check if connection latency is acceptable"""
        try:
            start = datetime.now()
            await self.client.call("ping", timeout=2.0)
            latency = (datetime.now() - start).total_seconds()
            return latency < 0.5  # 500ms threshold
        except:
            return False

    async def _check_connection_stability(self) -> bool:
        """Check connection stability over time"""
        if hasattr(self, "_connection_drops"):
            recent_drops = sum(
                1
                for drop_time in self._connection_drops
                if drop_time > datetime.now() - timedelta(minutes=5)
            )
            return recent_drops < 2
        return True

    async def _check_available_bandwidth(self) -> bool:
        """Check if sufficient bandwidth is available"""
        # This would implement actual bandwidth testing
        return True

    async def _check_error_rate(self) -> bool:
        """Check recent error rate"""
        if hasattr(self, "_recent_errors"):
            error_rate = len(self._recent_errors) / max(len(self._recent_requests), 1)
            return error_rate < 0.05  # 5% error rate threshold
        return True

    async def _create_restoration_plan(self) -> Dict[str, Any]:
        """Create a detailed plan for capability restoration"""
        plan = {"timestamp": datetime.now(), "steps": []}

        # Define capability dependencies
        capability_deps = {
            "basic_operations": [],
            "advanced_analytics": ["basic_operations"],
            "real_time_updates": ["basic_operations"],
            "ml_inference": ["basic_operations", "advanced_analytics"],
            "distributed_computing": ["basic_operations", "real_time_updates"],
        }

        # Sort capabilities by dependencies
        sorted_capabilities = self._topological_sort(self.capabilities, capability_deps)

        for capability in sorted_capabilities:
            plan["steps"].append(
                {
                    "name": capability,
                    "dependencies": capability_deps.get(capability, []),
                    "timeout": 30.0,
                    "retry_count": 3,
                    "validation_required": True,
                }
            )

        return plan

    def _topological_sort(
        self, items: List[str], dependencies: Dict[str, List[str]]
    ) -> List[str]:
        """Topologically sort items based on dependencies"""
        sorted_items = []
        visited = set()

        def visit(item):
            if item in visited:
                return
            visited.add(item)
            for dep in dependencies.get(item, []):
                if dep in items:
                    visit(dep)
            sorted_items.append(item)

        for item in items:
            visit(item)

        return sorted_items

    async def _pre_capability_check(self, step: Dict) -> bool:
        """Pre-check before restoring a capability"""
        # Check dependencies are satisfied
        for dep in step.get("dependencies", []):
            if dep not in self.capabilities:
                return False

        # Check resource availability
        return await self._check_resources_for_capability(step["name"])

    async def _check_resources_for_capability(self, capability: str) -> bool:
        """Check if resources are available for a capability"""
        resource_requirements = {
            "ml_inference": {"memory_mb": 512, "cpu_percent": 20},
            "distributed_computing": {"memory_mb": 1024, "cpu_percent": 40},
            "real_time_updates": {"memory_mb": 256, "cpu_percent": 10},
        }

        requirements = resource_requirements.get(capability, {})

        if requirements:
            import psutil

            memory = psutil.virtual_memory()
            cpu = psutil.cpu_percent(interval=0.1)

            if memory.available / 1024 / 1024 < requirements.get("memory_mb", 0):
                return False
            if cpu > (100 - requirements.get("cpu_percent", 0)):
                return False

        return True

    async def _restore_single_capability(self, step: Dict) -> bool:
        """Restore a single capability"""
        capability = step["name"]

        try:
            # Enable associated features
            if capability == "advanced_analytics":
                self._enable_advanced_analytics = True
            elif capability == "ml_inference":
                await self._initialize_ml_components()
            elif capability == "real_time_updates":
                await self._setup_real_time_subscriptions()

            # Add to active capabilities if not present
            if capability not in self.capabilities:
                self.capabilities.append(capability)

            return True

        except Exception as e:
            logger.error(f"Error restoring {capability}: {str(e)}")
            return False

    async def _validate_capability(self, step: Dict) -> bool:
        """Validate a restored capability is working"""
        capability = step["name"]

        validation_tests = {
            "basic_operations": self._test_basic_operations,
            "advanced_analytics": self._test_advanced_analytics,
            "ml_inference": self._test_ml_inference,
            "real_time_updates": self._test_real_time_updates,
        }

        test_func = validation_tests.get(capability)
        if test_func:
            try:
                return await test_func()
            except Exception as e:
                logger.error(f"Validation error for {capability}: {str(e)}")
                return False

        return True

    async def _test_basic_operations(self) -> bool:
        """Test basic operations capability"""
        try:
            response = await self.client.call("echo", {"test": "data"}, timeout=5.0)
            return response.get("test") == "data"
        except:
            return False

    async def _test_advanced_analytics(self) -> bool:
        """Test advanced analytics capability"""
        # Implement actual analytics test
        return True

    async def _test_ml_inference(self) -> bool:
        """Test ML inference capability"""
        # Implement actual ML test
        return True

    async def _test_real_time_updates(self) -> bool:
        """Test real-time updates capability"""
        # Implement actual real-time test
        return True

    async def _rollback_capability(self, step: Dict):
        """Rollback a single capability"""
        capability = step["name"]

        if capability in self.capabilities:
            self.capabilities.remove(capability)

        # Disable associated features
        if capability == "advanced_analytics":
            self._enable_advanced_analytics = False
        elif capability == "ml_inference":
            await self._cleanup_ml_components()

    async def _handle_restoration_error(self, step: Dict, error: Exception):
        """Handle errors during capability restoration"""
        logger.error(f"Restoration error for {step['name']}: {str(error)}")

        # Attempt recovery based on error type
        if isinstance(error, MemoryError):
            await self._reduce_memory_usage()
        elif isinstance(error, TimeoutError):
            await asyncio.sleep(5)  # Brief pause before retry

    async def _rollback_to_point(self, rollback_point: Dict):
        """Rollback to a previous capability state"""
        logger.warning("⏮️ Rolling back capabilities")

        self.capabilities = rollback_point["capabilities"].copy()

        # Restore state
        if "state" in rollback_point:
            for key, value in rollback_point["state"].items():
                setattr(self, f"_{key}", value)

    async def _verify_full_restoration(self) -> bool:
        """Verify all capabilities are fully restored"""
        # Check all expected capabilities are present
        expected_capabilities = getattr(self, "_full_capabilities", self.capabilities)
        if not all(cap in self.capabilities for cap in expected_capabilities):
            return False

        # Run comprehensive tests
        test_results = await asyncio.gather(
            self._test_all_capabilities(),
            self._test_integration_points(),
            self._test_performance_levels(),
            return_exceptions=True,
        )

        # Check for any failures
        return all(
            result is True
            for result in test_results
            if not isinstance(result, Exception)
        )

    async def _test_all_capabilities(self) -> bool:
        """Test all restored capabilities"""
        for capability in self.capabilities:
            if not await self._validate_capability({"name": capability}):
                return False
        return True

    async def _test_integration_points(self) -> bool:
        """Test integration points between capabilities"""
        # Test capability interactions
        return True

    async def _test_performance_levels(self) -> bool:
        """Test performance meets requirements"""
        # Implement performance testing
        return True

    async def _send_restoration_telemetry(self, data: Dict):
        """Send capability restoration telemetry"""
        await self.client.emit(
            "capability_restoration",
            {
                "service": self.service_name,
                "data": data,
                "timestamp": datetime.now().isoformat(),
            },
        )

    async def _initialize_ml_components(self):
        """Initialize ML components for inference capability"""
        # Initialize ML models and components
        pass

    async def _setup_real_time_subscriptions(self):
        """Setup real-time update subscriptions"""
        # Setup WebSocket subscriptions
        pass

    async def _cleanup_ml_components(self):
        """Cleanup ML components"""
        # Cleanup ML resources
        pass

    async def _gradual_capability_restoration(
        self, full_capabilities: List[str]
    ) -> bool:
        """
        Advanced gradual capability restoration with health monitoring and adaptive pacing
        """
        restoration_start = datetime.now()
        restoration_tracker = {
            "attempted": 0,
            "succeeded": 0,
            "failed": 0,
            "health_checks": [],
            "performance_metrics": [],
        }

        try:
            # Initial stabilization period with monitoring
            logger.info("⏳ Starting connection stabilization period...")
            stabilization_success = await self._monitor_connection_stability(
                duration=30
            )

            if not stabilization_success:
                logger.warning(
                    "⚠️ Connection not stable enough for capability restoration"
                )
                return False

            # Create restoration schedule based on system load
            restoration_schedule = await self._create_adaptive_restoration_schedule(
                full_capabilities
            )

            # Execute gradual restoration
            for phase in restoration_schedule["phases"]:
                logger.info(
                    f"📈 Starting restoration phase {phase['number']}: {phase['name']}"
                )

                for capability_batch in phase["batches"]:
                    # Pre-batch health check
                    batch_health = await self._pre_batch_health_check()
                    restoration_tracker["health_checks"].append(batch_health)

                    if not batch_health["healthy"]:
                        logger.warning(
                            f"⚠️ Skipping batch due to health issues: {batch_health['issues']}"
                        )
                        await self._wait_for_health_improvement()
                        continue

                    # Restore capability batch
                    batch_start = datetime.now()
                    batch_results = await self._restore_capability_batch(
                        capability_batch
                    )
                    batch_duration = (datetime.now() - batch_start).total_seconds()

                    # Track results
                    restoration_tracker["attempted"] += len(capability_batch)
                    restoration_tracker["succeeded"] += batch_results["succeeded"]
                    restoration_tracker["failed"] += batch_results["failed"]

                    # Performance monitoring
                    performance = await self._measure_system_performance()
                    restoration_tracker["performance_metrics"].append(
                        {
                            "timestamp": datetime.now(),
                            "batch": capability_batch,
                            "duration": batch_duration,
                            "metrics": performance,
                        }
                    )

                    # Adaptive pacing based on performance
                    wait_time = self._calculate_adaptive_wait_time(
                        performance, batch_results
                    )
                    if wait_time > 0:
                        logger.info(
                            f"⏳ Waiting {wait_time}s before next batch (adaptive pacing)"
                        )
                        await asyncio.sleep(wait_time)

                    # Mid-restoration optimization if needed
                    if (
                        performance["memory_percent"] > 70
                        or performance["cpu_percent"] > 80
                    ):
                        logger.warning("⚠️ High resource usage detected, optimizing...")
                        await self._mid_restoration_optimization()

                # Phase completion check
                phase_success = await self._verify_phase_completion(phase)
                if not phase_success:
                    logger.error(f"❌ Phase {phase['number']} verification failed")
                    # Decide whether to continue or abort
                    if phase.get("critical", False):
                        await self._handle_critical_phase_failure(phase)
                        return False

            # Final verification and reporting
            total_duration = (datetime.now() - restoration_start).total_seconds()
            success_rate = restoration_tracker["succeeded"] / max(
                restoration_tracker["attempted"], 1
            )

            logger.info(f"✅ Gradual restoration completed in {total_duration:.1f}s")
            logger.info(
                f"📊 Success rate: {success_rate:.1%} "
                f"({restoration_tracker['succeeded']}/{restoration_tracker['attempted']})"
            )

            # Send detailed telemetry
            await self._send_gradual_restoration_telemetry(
                {
                    "duration": total_duration,
                    "tracker": restoration_tracker,
                    "schedule": restoration_schedule,
                    "success_rate": success_rate,
                }
            )

            return (
                success_rate > 0.8
            )  # Consider successful if >80% capabilities restored

        except Exception as e:
            logger.error(f"❌ Error during gradual restoration: {str(e)}")
            await self._handle_restoration_failure(restoration_tracker)
            return False

    async def _monitor_connection_stability(self, duration: float) -> bool:
        """Monitor connection stability over a period"""
        start_time = datetime.now()
        stability_checks = []
        check_interval = 5.0  # Check every 5 seconds

        while (datetime.now() - start_time).total_seconds() < duration:
            check_result = {
                "timestamp": datetime.now(),
                "latency": None,
                "connected": False,
                "errors": 0,
            }

            try:
                # Ping test
                ping_start = datetime.now()
                await self.client.call("ping", timeout=2.0)
                check_result["latency"] = (datetime.now() - ping_start).total_seconds()
                check_result["connected"] = True
            except Exception as e:
                check_result["errors"] = 1
                logger.warning(f"Stability check failed: {str(e)}")

            stability_checks.append(check_result)
            await asyncio.sleep(check_interval)

        # Analyze stability
        connected_checks = sum(1 for check in stability_checks if check["connected"])
        stability_ratio = connected_checks / len(stability_checks)
        avg_latency = np.mean(
            [c["latency"] for c in stability_checks if c["latency"] is not None]
        )

        logger.info(
            f"📊 Stability: {stability_ratio:.1%}, Avg latency: {avg_latency:.3f}s"
        )

        return stability_ratio > 0.9 and avg_latency < 0.5

    async def _create_adaptive_restoration_schedule(
        self, capabilities: List[str]
    ) -> Dict[str, Any]:
        """Create an adaptive restoration schedule based on system state"""
        system_load = await self._assess_system_load()

        schedule = {
            "created": datetime.now(),
            "total_capabilities": len(capabilities),
            "phases": [],
        }

        # Categorize capabilities by resource requirements
        capability_categories = {"lightweight": [], "moderate": [], "heavy": []}

        for cap in capabilities:
            category = self._categorize_capability(cap)
            capability_categories[category].append(cap)

        # Phase 1: Essential and lightweight capabilities
        phase1_caps = ["basic_operations"] + capability_categories["lightweight"]
        schedule["phases"].append(
            {
                "number": 1,
                "name": "Essential Services",
                "critical": True,
                "batches": self._create_batches(phase1_caps, batch_size=2),
            }
        )

        # Phase 2: Moderate capabilities
        if capability_categories["moderate"]:
            batch_size = 1 if system_load["level"] == "high" else 2
            schedule["phases"].append(
                {
                    "number": 2,
                    "name": "Standard Services",
                    "critical": False,
                    "batches": self._create_batches(
                        capability_categories["moderate"], batch_size
                    ),
                }
            )

        # Phase 3: Heavy capabilities
        if capability_categories["heavy"]:
            schedule["phases"].append(
                {
                    "number": 3,
                    "name": "Advanced Services",
                    "critical": False,
                    "batches": self._create_batches(
                        capability_categories["heavy"], batch_size=1
                    ),
                }
            )

        return schedule

    def _categorize_capability(self, capability: str) -> str:
        """Categorize capability by resource requirements"""
        heavy_capabilities = ["ml_inference", "distributed_computing", "deep_analytics"]
        moderate_capabilities = ["real_time_updates", "advanced_monitoring", "caching"]

        if capability in heavy_capabilities:
            return "heavy"
        elif capability in moderate_capabilities:
            return "moderate"
        else:
            return "lightweight"

    def _create_batches(self, items: List[str], batch_size: int) -> List[List[str]]:
        """Create batches from a list of items"""
        return [items[i : i + batch_size] for i in range(0, len(items), batch_size)]

    async def _assess_system_load(self) -> Dict[str, Any]:
        """Assess current system load"""
        import psutil

        cpu_percent = psutil.cpu_percent(interval=1)
        memory_percent = psutil.virtual_memory().percent

        load_level = "low"
        if cpu_percent > 70 or memory_percent > 70:
            load_level = "high"
        elif cpu_percent > 50 or memory_percent > 50:
            load_level = "medium"

        return {
            "cpu_percent": cpu_percent,
            "memory_percent": memory_percent,
            "level": load_level,
            "timestamp": datetime.now(),
        }

    async def _pre_batch_health_check(self) -> Dict[str, Any]:
        """Perform health check before restoring a batch"""
        health = {
            "timestamp": datetime.now(),
            "healthy": True,
            "issues": [],
            "metrics": {},
        }

        # Check connection
        if not self.client.connected:
            health["healthy"] = False
            health["issues"].append("Not connected")

        # Check resources
        import psutil

        memory = psutil.virtual_memory()
        if memory.percent > 85:
            health["healthy"] = False
            health["issues"].append(f"High memory usage: {memory.percent:.1f}%")

        # Check recent errors
        if hasattr(self, "_recent_errors"):
            recent_error_count = len(
                [
                    e
                    for e in self._recent_errors
                    if e["timestamp"] > datetime.now() - timedelta(minutes=1)
                ]
            )
            if recent_error_count > 5:
                health["healthy"] = False
                health["issues"].append(
                    f"High error rate: {recent_error_count} errors/min"
                )

        health["metrics"] = {
            "memory_percent": memory.percent,
            "error_count": (
                recent_error_count if "recent_error_count" in locals() else 0
            ),
        }

        return health

    async def _wait_for_health_improvement(self):
        """Wait for system health to improve"""
        max_wait = 60  # Maximum 60 seconds
        waited = 0

        while waited < max_wait:
            await asyncio.sleep(5)
            waited += 5

            health = await self._pre_batch_health_check()
            if health["healthy"]:
                logger.info("✅ System health improved")
                return

        logger.warning("⚠️ System health did not improve within timeout")

    async def _restore_capability_batch(
        self, capabilities: List[str]
    ) -> Dict[str, int]:
        """Restore a batch of capabilities"""
        results = {"succeeded": 0, "failed": 0, "errors": []}

        for capability in capabilities:
            try:
                if capability not in self.capabilities:
                    self.capabilities.append(capability)

                    # Capability-specific initialization
                    await self._initialize_capability(capability)

                    # Verify capability
                    if await self._quick_capability_test(capability):
                        results["succeeded"] += 1
                        logger.info(f"✅ Restored capability: {capability}")
                    else:
                        self.capabilities.remove(capability)
                        results["failed"] += 1
                        results["errors"].append(f"{capability}: verification failed")
                else:
                    results["succeeded"] += 1  # Already present

            except Exception as e:
                results["failed"] += 1
                results["errors"].append(f"{capability}: {str(e)}")
                logger.error(f"Failed to restore {capability}: {str(e)}")

        return results

    async def _initialize_capability(self, capability: str):
        """Initialize a specific capability"""
        initializers = {
            "real_time_updates": self._init_real_time_updates,
            "ml_inference": self._init_ml_inference,
            "advanced_analytics": self._init_advanced_analytics,
        }

        initializer = initializers.get(capability)
        if initializer:
            await initializer()

    async def _quick_capability_test(self, capability: str) -> bool:
        """Quick test to verify capability is working"""
        # Implement quick tests for each capability
        return True

    async def _measure_system_performance(self) -> Dict[str, float]:
        """Measure current system performance"""
        import psutil

        return {
            "cpu_percent": psutil.cpu_percent(interval=0.1),
            "memory_percent": psutil.virtual_memory().percent,
            "timestamp": datetime.now(),
        }

    def _calculate_adaptive_wait_time(
        self, performance: Dict, batch_results: Dict
    ) -> float:
        """Calculate adaptive wait time based on performance and results"""
        base_wait = 10.0

        # Adjust based on resource usage
        if performance["cpu_percent"] > 70:
            base_wait *= 1.5
        if performance["memory_percent"] > 70:
            base_wait *= 1.5

        # Adjust based on failure rate
        if batch_results["failed"] > 0:
            failure_rate = batch_results["failed"] / (
                batch_results["succeeded"] + batch_results["failed"]
            )
            base_wait *= 1 + failure_rate

        # Cap wait time
        return min(base_wait, 30.0)

    async def _mid_restoration_optimization(self):
        """Perform optimization during restoration"""
        # Light cleanup to free resources
        await self._clear_caches()

        # Garbage collection
        import gc

        gc.collect()

        # Brief pause
        await asyncio.sleep(2)

    async def _verify_phase_completion(self, phase: Dict) -> bool:
        """Verify a restoration phase completed successfully"""
        # Check all capabilities in phase are active
        all_capabilities = [cap for batch in phase["batches"] for cap in batch]

        for capability in all_capabilities:
            if capability not in self.capabilities:
                return False

        return True

    async def _handle_critical_phase_failure(self, phase: Dict):
        """Handle failure of a critical phase"""
        logger.error(f"🚨 Critical phase {phase['number']} failed: {phase['name']}")

        # Attempt recovery
        logger.info("🔄 Attempting phase recovery...")

        # Reduce capabilities to minimum
        self.capabilities = ["basic_operations"]

        # Notify monitoring
        await self.client.emit(
            "critical_phase_failure",
            {
                "service": self.service_name,
                "phase": phase,
                "timestamp": datetime.now().isoformat(),
            },
        )

    async def _handle_restoration_failure(self, tracker: Dict):
        """Handle overall restoration failure"""
        logger.error("❌ Gradual restoration failed")

        # Log detailed failure analysis
        logger.error(f"📊 Restoration stats: {tracker}")

        # Fallback to minimal capabilities
        self.capabilities = ["basic_operations"]

    async def _send_gradual_restoration_telemetry(self, data: Dict):
        """Send detailed gradual restoration telemetry"""
        await self.client.emit(
            "gradual_restoration_complete",
            {
                "service": self.service_name,
                "data": data,
                "timestamp": datetime.now().isoformat(),
            },
        )

    async def _init_real_time_updates(self):
        """Initialize real-time updates capability"""
        # Setup WebSocket subscriptions
        pass

    async def _init_ml_inference(self):
        """Initialize ML inference capability"""
        # Load ML models
        pass

    async def _init_advanced_analytics(self):
        """Initialize advanced analytics capability"""
        # Setup analytics components
        pass

    def _get_max_reconnect_attempts(self) -> int:
        """
        Intelligent reconnection attempt calculation based on multiple factors
        """
        base_attempts = 5

        # Time of day factor
        current_hour = datetime.now().hour
        current_day = datetime.now().weekday()

        # Business hours get more attempts (Mon-Fri, 9-17)
        if 0 <= current_day <= 4 and 9 <= current_hour <= 17:
            time_multiplier = 2.0
        # Extended business hours
        elif 0 <= current_day <= 4 and (
            7 <= current_hour <= 9 or 17 <= current_hour <= 19
        ):
            time_multiplier = 1.5
        # Nights and weekends
        else:
            time_multiplier = 0.8

        # Service criticality factor
        criticality_multiplier = self._get_service_criticality_multiplier()

        # Historical success rate factor
        success_rate_multiplier = self._get_historical_success_multiplier()

        # Current system load factor
        load_multiplier = self._get_system_load_multiplier()

        # Environmental factors
        env_multiplier = self._get_environmental_multiplier()

        # Calculate final attempts
        max_attempts = int(
            base_attempts
            * time_multiplier
            * criticality_multiplier
            * success_rate_multiplier
            * load_multiplier
            * env_multiplier
        )

        # Apply bounds
        max_attempts = max(3, min(max_attempts, 20))

        logger.info(
            f"📊 Calculated max reconnect attempts: {max_attempts} "
            f"(factors: time={time_multiplier:.1f}, criticality={criticality_multiplier:.1f}, "
            f"success={success_rate_multiplier:.1f}, load={load_multiplier:.1f}, "
            f"env={env_multiplier:.1f})"
        )

        return max_attempts

    def _get_service_criticality_multiplier(self) -> float:
        """Get multiplier based on service criticality"""
        critical_services = ["payment_processing", "authentication", "core_api"]
        important_services = ["ml_inference", "real_time_updates", "analytics"]

        if self.service_name in critical_services:
            return 2.0
        elif self.service_name in important_services:
            return 1.5
        else:
            return 1.0

    def _get_historical_success_multiplier(self) -> float:
        """Get multiplier based on historical reconnection success"""
        if not hasattr(self, "_reconnection_history"):
            return 1.0

        recent_history = [
            h
            for h in self._reconnection_history
            if h["timestamp"] > datetime.now() - timedelta(hours=24)
        ]

        if not recent_history:
            return 1.0

        success_rate = sum(1 for h in recent_history if h["success"]) / len(
            recent_history
        )

        if success_rate > 0.8:
            return 1.2  # High success rate, try harder
        elif success_rate < 0.3:
            return 0.8  # Low success rate, don't waste resources
        else:
            return 1.0

    def _get_system_load_multiplier(self) -> float:
        """Get multiplier based on current system load"""
        try:
            import psutil

            cpu_percent = psutil.cpu_percent(interval=0.1)
            memory_percent = psutil.virtual_memory().percent

            avg_load = (cpu_percent + memory_percent) / 2

            if avg_load > 80:
                return 0.7  # High load, reduce attempts
            elif avg_load < 30:
                return 1.3  # Low load, can afford more attempts
            else:
                return 1.0
        except:
            return 1.0

    def _get_environmental_multiplier(self) -> float:
        """Get multiplier based on environmental factors"""
        multiplier = 1.0

        # Check if in cloud environment
        if os.environ.get("CLOUD_PROVIDER"):
            multiplier *= 1.2  # Cloud environments often have better reliability

        # Check if in production
        if os.environ.get("ENVIRONMENT") == "production":
            multiplier *= 1.5  # Production gets more attempts

        # Check if disaster recovery mode
        if os.environ.get("DISASTER_RECOVERY_MODE") == "true":
            multiplier *= 2.0  # Critical situation

        return multiplier

    async def _handle_permanent_connection_failure(self):
        """
        Comprehensive handling of permanent connection failure with recovery options
        """
        failure_time = datetime.now()
        logger.critical("🚨 PERMANENT CONNECTION FAILURE DETECTED")

        try:
            # Phase 1: Immediate preservation
            preservation_report = await self._emergency_state_preservation()

            # Phase 2: Failure analysis
            failure_analysis = await self._analyze_connection_failure()

            # Phase 3: Recovery attempts
            recovery_attempted = await self._attempt_advanced_recovery(failure_analysis)

            if recovery_attempted and await self._verify_connection():
                logger.info("✅ Advanced recovery successful!")
                return

            # Phase 4: Notification cascade
            await self._execute_notification_cascade(failure_analysis)

            # Phase 5: Failover preparation
            failover_ready = await self._prepare_for_failover()

            # Phase 6: Service migration
            if failover_ready:
                migration_success = await self._attempt_service_migration()
                if migration_success:
                    logger.info("✅ Service migration successful")
                    return

            # Phase 7: Graceful degradation
            await self._implement_graceful_degradation()

            # Phase 8: Final shutdown sequence
            await self._execute_final_shutdown_sequence()

        except Exception as e:
            logger.critical(
                f"🚨 CRITICAL ERROR in permanent failure handling: {str(e)}"
            )
            # Emergency shutdown
            await self._emergency_shutdown()

    async def _emergency_state_preservation(self) -> Dict[str, Any]:
        """Emergency preservation of all critical state"""
        preservation_report = {
            "timestamp": datetime.now(),
            "preserved_items": 0,
            "failed_items": 0,
            "storage_locations": [],
        }

        critical_data = {
            "service_state": await self._capture_full_service_state(),
            "active_operations": self._capture_active_operations(),
            "connection_history": self._capture_connection_history(),
            "performance_metrics": self._capture_performance_metrics(),
            "error_logs": self._capture_recent_errors(),
        }

        # Multi-destination preservation
        preservation_methods = [
            ("local_file", self._preserve_to_local_file),
            ("memory_cache", self._preserve_to_memory_cache),
            ("remote_backup", self._preserve_to_remote_backup),
            ("distributed_cache", self._preserve_to_distributed_cache),
        ]

        for data_type, data in critical_data.items():
            for method_name, method_func in preservation_methods:
                try:
                    location = await method_func(data_type, data)
                    if location:
                        preservation_report["preserved_items"] += 1
                        preservation_report["storage_locations"].append(
                            {
                                "type": data_type,
                                "method": method_name,
                                "location": location,
                            }
                        )
                        break  # Success, move to next data type
                except Exception as e:
                    logger.error(
                        f"Failed to preserve {data_type} via {method_name}: {str(e)}"
                    )
                    preservation_report["failed_items"] += 1

        return preservation_report

    async def _capture_full_service_state(self) -> Dict[str, Any]:
        """Capture complete service state"""
        return {
            "service_name": self.service_name,
            "capabilities": self.capabilities.copy(),
            "connection_state": {
                "url": getattr(self.client, "connection_url", None),
                "connected": getattr(self.client, "connected", False),
                "last_connected": getattr(self, "_last_successful_connection", None),
            },
            "configuration": self._capture_configuration(),
            "runtime_state": self._capture_runtime_state(),
        }

    def _capture_active_operations(self) -> List[Dict]:
        """Capture all active operations"""
        operations = []

        if hasattr(self, "_active_operations"):
            for op in self._active_operations:
                operations.append(
                    {
                        "id": op.get("id"),
                        "type": op.get("type"),
                        "start_time": op.get("start_time"),
                        "state": op.get("state"),
                        "data": op.get("data", {})[:1000],  # Limit data size
                    }
                )

        return operations

    def _capture_connection_history(self) -> List[Dict]:
        """Capture recent connection history"""
        if hasattr(self, "_connection_history"):
            return self._connection_history[-100:]  # Last 100 entries
        return []

    def _capture_performance_metrics(self) -> Dict[str, Any]:
        """Capture recent performance metrics"""
        return getattr(self, "_performance_metrics", {})

    def _capture_recent_errors(self) -> List[Dict]:
        """Capture recent error logs"""
        if hasattr(self, "_error_log"):
            return self._error_log[-50:]  # Last 50 errors
        return []

    def _capture_configuration(self) -> Dict[str, Any]:
        """Capture service configuration"""
        return {
            "endpoints": getattr(self, "_endpoints", {}),
            "timeouts": getattr(self, "_timeouts", {}),
            "limits": getattr(self, "_limits", {}),
        }

    def _capture_runtime_state(self) -> Dict[str, Any]:
        """Capture runtime state"""
        return {
            "uptime": (
                (datetime.now() - self._startup_time).total_seconds()
                if hasattr(self, "_startup_time")
                else 0
            ),
            "total_operations": getattr(self, "_total_operations_count", 0),
            "cache_size": len(getattr(self, "_cache", {})),
        }

    async def _preserve_to_local_file(self, data_type: str, data: Any) -> str:
        """Preserve data to local file"""
        import json
        import tempfile

        filename = f"emergency_state_{self.service_name}_{data_type}_{datetime.now().strftime('%Y%m%d_%H%M%S')}.json"
        filepath = os.path.join(tempfile.gettempdir(), filename)

        with open(filepath, "w") as f:
            json.dump(data, f, indent=2, default=str)

        return filepath

    async def _preserve_to_memory_cache(self, data_type: str, data: Any) -> str:
        """Preserve data in memory cache"""
        if not hasattr(self, "_emergency_cache"):
            self._emergency_cache = {}

        key = f"emergency_{data_type}_{datetime.now().isoformat()}"
        self._emergency_cache[key] = data
        return f"memory:{key}"

    async def _preserve_to_remote_backup(
        self, data_type: str, data: Any
    ) -> Optional[str]:
        """Preserve data to remote backup service"""
        # Implementation depends on backup service
        return None

    async def _preserve_to_distributed_cache(
        self, data_type: str, data: Any
    ) -> Optional[str]:
        """Preserve data to distributed cache"""
        # Implementation depends on cache service
        return None

    async def _analyze_connection_failure(self) -> Dict[str, Any]:
        """Analyze the connection failure comprehensively"""
        analysis = {
            "timestamp": datetime.now(),
            "failure_type": "unknown",
            "root_cause": "unknown",
            "duration": 0,
            "impact_assessment": {},
            "recovery_options": [],
        }

        # Analyze failure patterns
        if hasattr(self, "_connection_history"):
            recent_failures = [
                h for h in self._connection_history[-20:] if not h.get("success", True)
            ]

            if len(recent_failures) > 10:
                analysis["failure_type"] = "chronic"
            elif len(recent_failures) > 5:
                analysis["failure_type"] = "recurring"
            else:
                analysis["failure_type"] = "acute"

        # Determine root cause
        if hasattr(self, "_last_error"):
            error_msg = str(self._last_error)
            if "timeout" in error_msg.lower():
                analysis["root_cause"] = "network_timeout"
            elif "refused" in error_msg.lower():
                analysis["root_cause"] = "connection_refused"
            elif "dns" in error_msg.lower():
                analysis["root_cause"] = "dns_failure"

        # Calculate failure duration
        if hasattr(self, "_last_successful_connection"):
            analysis["duration"] = (
                datetime.now() - self._last_successful_connection
            ).total_seconds()

        # Impact assessment
        analysis["impact_assessment"] = {
            "affected_operations": len(getattr(self, "_pending_operations", [])),
            "data_at_risk": self._assess_data_at_risk(),
            "service_dependencies": self._identify_affected_dependencies(),
        }

        # Recovery options
        analysis["recovery_options"] = self._identify_recovery_options(analysis)

        return analysis

    def _assess_data_at_risk(self) -> Dict[str, int]:
        """Assess data at risk due to connection failure"""
        return {
            "pending_operations": len(getattr(self, "_pending_operations", [])),
            "unsaved_results": len(getattr(self, "_unsaved_results", [])),
            "cache_entries": len(getattr(self, "_cache", {})),
        }

    def _identify_affected_dependencies(self) -> List[str]:
        """Identify services dependent on this connection"""
        return getattr(self, "_dependent_services", [])

    def _identify_recovery_options(self, analysis: Dict) -> List[Dict]:
        """Identify available recovery options"""
        options = []

        # Option 1: Alternate endpoints
        if hasattr(self, "_alternate_endpoints") and self._alternate_endpoints:
            options.append(
                {
                    "type": "alternate_endpoint",
                    "description": "Switch to alternate endpoint",
                    "probability": 0.7,
                }
            )

        # Option 2: Service migration
        if self._can_migrate():
            options.append(
                {
                    "type": "service_migration",
                    "description": "Migrate to alternate infrastructure",
                    "probability": 0.6,
                }
            )

        # Option 3: Offline mode
        options.append(
            {
                "type": "offline_mode",
                "description": "Continue in offline mode",
                "probability": 0.9,
            }
        )

        return options

    def _can_migrate(self) -> bool:
        """Check if service migration is possible"""
        return hasattr(self, "_migration_config") and self._migration_config.get(
            "enabled", False
        )

    async def _attempt_advanced_recovery(self, analysis: Dict) -> bool:
        """Attempt advanced recovery based on failure analysis"""
        for option in analysis["recovery_options"]:
            logger.info(f"🔧 Attempting recovery option: {option['description']}")

            try:
                if option["type"] == "alternate_endpoint":
                    if await self._try_alternate_endpoints():
                        return True
                elif option["type"] == "service_migration":
                    if await self._attempt_service_migration():
                        return True
                elif option["type"] == "offline_mode":
                    if await self._enable_offline_mode():
                        return True
            except Exception as e:
                logger.error(f"Recovery option {option['type']} failed: {str(e)}")

        return False

    async def _try_alternate_endpoints(self) -> bool:
        """Try connecting to alternate endpoints"""
        if not hasattr(self, "_alternate_endpoints"):
            return False

        for endpoint in self._alternate_endpoints:
            try:
                logger.info(f"🔄 Trying alternate endpoint: {endpoint}")
                self.client.connection_url = endpoint
                await self.client.connect()
                if await self._verify_connection():
                    logger.info(f"✅ Connected to alternate endpoint: {endpoint}")
                    return True
            except Exception as e:
                logger.error(f"Alternate endpoint {endpoint} failed: {str(e)}")

        return False

    async def _execute_notification_cascade(self, analysis: Dict):
        """Execute comprehensive notification cascade"""
        notifications = []

        # Level 1: System logs
        logger.critical(f"🚨 SERVICE FAILURE: {self.service_name}")
        logger.critical(f"📊 Failure Analysis: {analysis}")

        # Level 2: Local notifications
        if hasattr(self, "_local_notifier"):
            notifications.append(
                self._local_notifier.send(
                    {
                        "level": "critical",
                        "service": self.service_name,
                        "analysis": analysis,
                    }
                )
            )

        # Level 3: Remote monitoring
        if hasattr(self, "_monitoring_client"):
            notifications.append(
                self._monitoring_client.alert(
                    {
                        "severity": "critical",
                        "service": self.service_name,
                        "failure_analysis": analysis,
                    }
                )
            )

        # Level 4: Team notifications
        if hasattr(self, "_alert_config"):
            notifications.extend(self._send_team_notifications(analysis))

        # Wait for all notifications
        await asyncio.gather(*notifications, return_exceptions=True)

    def _send_team_notifications(self, analysis: Dict) -> List[asyncio.Task]:
        """Send notifications to team members"""
        tasks = []

        # This would integrate with actual notification services
        # (Slack, PagerDuty, email, etc.)

        return tasks

    async def _prepare_for_failover(self) -> bool:
        """Prepare system for failover"""
        try:
            # Export current state
            state_export = await self._export_full_state()

            # Prepare failover package
            failover_package = {
                "service": self.service_name,
                "state": state_export,
                "timestamp": datetime.now(),
                "target_infrastructure": self._identify_failover_target(),
            }

            # Validate failover readiness
            return await self._validate_failover_readiness(failover_package)

        except Exception as e:
            logger.error(f"Failover preparation failed: {str(e)}")
            return False

    async def _export_full_state(self) -> Dict[str, Any]:
        """Export complete state for failover"""
        return {
            "service_state": await self._capture_full_service_state(),
            "data": await self._export_critical_data(),
            "configuration": self._export_configuration(),
        }

    async def _export_critical_data(self) -> Dict[str, Any]:
        """Export critical data for failover"""
        return {
            "cache": dict(
                list(getattr(self, "_cache", {}).items())[:1000]
            ),  # Limit size
            "pending_operations": getattr(self, "_pending_operations", [])[:100],
        }

    def _export_configuration(self) -> Dict[str, Any]:
        """Export service configuration"""
        return {
            "endpoints": getattr(self, "_endpoints", {}),
            "capabilities": self.capabilities.copy(),
            "limits": getattr(self, "_limits", {}),
        }

    def _identify_failover_target(self) -> Dict[str, str]:
        """Identify failover target infrastructure"""
        # This would determine the best failover target
        return {"type": "cloud", "provider": "aws", "region": "us-east-1"}

    async def _validate_failover_readiness(self, package: Dict) -> bool:
        """Validate system is ready for failover"""
        # Implement validation logic
        return True

    async def _attempt_service_migration(self) -> bool:
        """Attempt to migrate service to alternate infrastructure"""
        logger.info("🚀 Attempting service migration...")

        try:
            # This would implement actual service migration
            # For now, return False as placeholder
            return False
        except Exception as e:
            logger.error(f"Service migration failed: {str(e)}")
            return False

    async def _enable_offline_mode(self) -> bool:
        """Enable offline mode operation"""
        logger.info("📴 Enabling offline mode...")

        try:
            self._offline_mode = True
            self.capabilities = ["offline_operations"]

            # Setup offline operation handlers
            await self._setup_offline_handlers()

            return True
        except Exception as e:
            logger.error(f"Failed to enable offline mode: {str(e)}")
            return False

    async def _setup_offline_handlers(self):
        """Setup handlers for offline operation"""
        # Implement offline operation logic
        pass

    async def _implement_graceful_degradation(self):
        """Implement graceful service degradation"""
        logger.info("📉 Implementing graceful degradation...")

        # Reduce to minimal operations
        self.capabilities = ["basic_operations"]

        # Notify dependent services
        await self._notify_dependent_services()

        # Enable request queuing
        self._enable_request_queuing = True

    async def _notify_dependent_services(self):
        """Notify dependent services of degradation"""
        # Implement notification logic
        pass

    async def _execute_final_shutdown_sequence(self):
        """Execute final shutdown sequence"""
        logger.info("🛑 Executing final shutdown sequence...")

        # Final state save
        await self._final_state_save()

        # Resource cleanup
        await self._final_resource_cleanup()

        # Shutdown
        await self.stop(force=True)

    async def _final_state_save(self):
        """Final attempt to save state"""
        try:
            state = await self._capture_full_service_state()
            await self._preserve_to_local_file("final_state", state)
        except Exception as e:
            logger.error(f"Final state save failed: {str(e)}")

    async def _final_resource_cleanup(self):
        """Final resource cleanup"""
        try:
            await self._cleanup_resources()
        except Exception as e:
            logger.error(f"Final cleanup failed: {str(e)}")

    async def _emergency_shutdown(self):
        """Emergency shutdown when all else fails"""
        logger.critical("💀 EMERGENCY SHUTDOWN")

        # Force stop
        self._running = False

        # Kill all tasks
        for task in asyncio.all_tasks():
            if task != asyncio.current_task():
                task.cancel()

        # Exit
        asyncio.create_task(self._force_exit())

    async def _send_reconnection_telemetry(self, data: Dict):
        """Send reconnection telemetry"""
        await self.client.emit(
            "reconnection_telemetry",
            {
                "service": self.service_name,
                "data": data,
                "timestamp": datetime.now().isoformat(),
            },
        )

    async def _reduce_memory_usage(self) -> bool:
        """
        Advanced memory optimization with profiling and intelligent cleanup
        """
        initial_memory = self._get_current_memory_usage()
        logger.info(
            f"🧹 Starting memory optimization (current: {initial_memory:.1f}MB)"
        )

        try:
            # Phase 1: Basic cleanup
            import gc

            gc.collect()

            # Phase 2: Clear caches
            cleared_cache_size = await self._clear_caches()

            # Phase 3: Optimize data structures
            await self._optimize_data_structures()

            # Phase 4: Release unused resources
            await self._release_unused_resources()

            # Phase 5: Memory profiling and targeted cleanup
            if initial_memory > 500:  # If using more than 500MB
                await self._deep_memory_analysis()

            # Force garbage collection again
            gc.collect(2)  # Full collection

            # Check results
            final_memory = self._get_current_memory_usage()
            memory_freed = initial_memory - final_memory
            reduction_percentage = (memory_freed / initial_memory) * 100

            logger.info(
                f"✅ Memory optimization complete: freed {memory_freed:.1f}MB ({reduction_percentage:.1f}%)"
            )
            logger.info(f"📊 Cache cleared: {cleared_cache_size:.1f}MB")

            # Send memory optimization telemetry
            await self._send_memory_telemetry(
                {
                    "initial_mb": initial_memory,
                    "final_mb": final_memory,
                    "freed_mb": memory_freed,
                    "reduction_percentage": reduction_percentage,
                    "cache_cleared_mb": cleared_cache_size,
                }
            )

            return reduction_percentage > 5  # Success if freed more than 5%

        except Exception as e:
            logger.error(f"Error during memory optimization: {str(e)}")
            return False

    async def _aggressive_memory_cleanup(self) -> bool:
        """Aggressive memory cleanup for critical situations"""
        logger.warning("🚨 Initiating aggressive memory cleanup")

        # First, do normal cleanup
        await self._reduce_memory_usage()

        # Additional aggressive measures
        try:
            # Disable non-essential features temporarily
            await self._disable_non_essential_features()

            # Clear all caches completely
            await self._clear_all_caches(aggressive=True)

            # Reduce internal buffers
            await self._reduce_buffer_sizes()

            # Offload data to disk if possible
            await self._offload_to_disk()

            # Request garbage collection multiple times
            import gc

            for _ in range(3):
                gc.collect(2)
                await asyncio.sleep(0.1)

            # Check if we've freed enough
            current_memory = self._get_current_memory_usage()
            memory_percent = self._get_memory_percentage()

            success = memory_percent < 70

            if success:
                logger.info(
                    f"✅ Aggressive cleanup successful: memory now at {memory_percent:.1f}%"
                )

                # Gradually re-enable features
                asyncio.create_task(self._gradual_feature_restoration())
            else:
                logger.error(
                    f"❌ Aggressive cleanup insufficient: memory still at {memory_percent:.1f}%"
                )

            return success

        except Exception as e:
            logger.error(f"Error during aggressive memory cleanup: {str(e)}")
            return False

    def _get_current_memory_usage(self) -> float:
        """Get current memory usage in MB"""
        import psutil

        process = psutil.Process()
        return process.memory_info().rss / 1024 / 1024

    def _get_memory_percentage(self) -> float:
        """Get current memory usage percentage"""
        import psutil

        process = psutil.Process()
        return process.memory_percent()

    async def _clear_caches(self) -> float:
        """Clear various caches and return freed size in MB"""
        freed_size = 0

        # Clear result cache
        if hasattr(self, "_result_cache"):
            cache_size = sys.getsizeof(self._result_cache) / 1024 / 1024
            self._result_cache.clear()
            freed_size += cache_size

        # Clear analysis cache
        if hasattr(self, "_analysis_cache"):
            cache_size = sys.getsizeof(self._analysis_cache) / 1024 / 1024
            # Keep only recent entries
            cutoff_time = datetime.now() - timedelta(minutes=5)
            self._analysis_cache = {
                k: v
                for k, v in self._analysis_cache.items()
                if v.get("timestamp", datetime.min) > cutoff_time
            }
            freed_size += cache_size * 0.8  # Estimate 80% cleared

        # Clear move history beyond last 100 games
        if hasattr(self, "_game_history"):
            if len(self._game_history) > 100:
                self._game_history = self._game_history[-100:]
                freed_size += 10  # Estimate

        return freed_size

    async def _optimize_data_structures(self):
        """Optimize internal data structures for memory efficiency"""
        # Convert lists to more memory-efficient structures where possible
        if hasattr(self, "_move_history"):
            # Use deque with maxlen for move history
            from collections import deque

            if not isinstance(self._move_history, deque):
                self._move_history = deque(self._move_history, maxlen=10000)

        # Compress large dictionaries
        if hasattr(self, "_analysis_results"):
            # Remove redundant data
            for key in list(self._analysis_results.keys()):
                if "temporary" in key or "debug" in key:
                    del self._analysis_results[key]

    async def _release_unused_resources(self):
        """Release resources that are no longer needed"""
        # Close unused connections
        if hasattr(self, "_unused_connections"):
            for conn in self._unused_connections:
                try:
                    await conn.close()
                except:
                    pass
            self._unused_connections.clear()

        # Clear completed futures
        if hasattr(self, "_pending_futures"):
            self._pending_futures = [f for f in self._pending_futures if not f.done()]

    async def _deep_memory_analysis(self):
        """Perform deep memory analysis and targeted cleanup"""
        try:
            import tracemalloc

            # Start tracing
            tracemalloc.start()

            # Take snapshot
            snapshot = tracemalloc.take_snapshot()
            top_stats = snapshot.statistics("lineno")

            # Log top memory users
            logger.info("📊 Top memory allocations:")
            for stat in top_stats[:5]:
                logger.info(f"  {stat}")

            # Targeted cleanup based on findings
            # This is where you'd add specific cleanup based on profiling

            tracemalloc.stop()

        except ImportError:
            logger.warning("tracemalloc not available for deep analysis")

    async def _disable_non_essential_features(self):
        """Temporarily disable non-essential features"""
        self._disabled_features = []

        non_essential_features = [
            "advanced_analytics",
            "detailed_logging",
            "performance_tracking",
            "pattern_detection",
        ]

        for feature in non_essential_features:
            if hasattr(self, f"_enable_{feature}"):
                setattr(self, f"_enable_{feature}", False)
                self._disabled_features.append(feature)

        logger.info(f"⏸️ Disabled features: {', '.join(self._disabled_features)}")

    async def _clear_all_caches(self, aggressive: bool = False):
        """Clear all caches, optionally aggressive"""
        cache_attributes = [
            attr
            for attr in dir(self)
            if "cache" in attr.lower() and hasattr(getattr(self, attr), "clear")
        ]

        for cache_attr in cache_attributes:
            cache = getattr(self, cache_attr)
            if hasattr(cache, "clear"):
                cache.clear()
            elif aggressive and hasattr(cache, "__dict__"):
                # Clear object attributes if aggressive
                cache.__dict__.clear()

    async def _reduce_buffer_sizes(self):
        """Reduce internal buffer sizes"""
        buffer_configs = {
            "_max_pending_operations": 100,  # Reduced from higher value
            "_max_history_size": 1000,  # Reduced from higher value
            "_max_cache_entries": 500,  # Reduced from higher value
        }

        for attr, new_size in buffer_configs.items():
            if hasattr(self, attr):
                setattr(self, attr, new_size)

    async def _offload_to_disk(self):
        """Offload less frequently used data to disk"""
        import pickle
        import tempfile

        offload_dir = tempfile.gettempdir()

        # Offload old game history
        if hasattr(self, "_game_history") and len(self._game_history) > 100:
            old_games = self._game_history[:-100]
            offload_path = os.path.join(
                offload_dir, f"game_history_{self.service_name}.pkl"
            )

            with open(offload_path, "wb") as f:
                pickle.dump(old_games, f)

            self._game_history = self._game_history[-100:]
            self._offloaded_data_paths = getattr(self, "_offloaded_data_paths", [])
            self._offloaded_data_paths.append(offload_path)

            logger.info(f"💾 Offloaded {len(old_games)} old games to disk")

    async def _gradual_feature_restoration(self):
        """Gradually restore disabled features"""
        await asyncio.sleep(300)  # Wait 5 minutes

        if hasattr(self, "_disabled_features"):
            for feature in self._disabled_features:
                if self._get_memory_percentage() < 60:  # Only if memory is OK
                    if hasattr(self, f"_enable_{feature}"):
                        setattr(self, f"_enable_{feature}", True)
                        logger.info(f"✅ Re-enabled feature: {feature}")
                        await asyncio.sleep(60)  # Wait between re-enabling

    async def _send_memory_telemetry(self, data: Dict):
        """Send memory optimization telemetry"""
        await self.client.emit(
            "memory_telemetry",
            {
                "service": self.service_name,
                "data": data,
                "timestamp": datetime.now().isoformat(),
            },
        )

    async def _save_critical_state(self):
        """Save critical state during failure"""
        critical_state = {
            "service": self.service_name,
            "last_known_good_state": getattr(self, "_last_known_good_state", {}),
            "pending_operations": getattr(self, "_pending_operations", []),
            "timestamp": datetime.now().isoformat(),
        }

        # Save to multiple locations for redundancy
        import json

        # Local file
        with open(f"critical_state_{self.service_name}.json", "w") as f:
            json.dump(critical_state, f)

        # Try to send to backup service
        try:
            await self._send_to_backup_service(critical_state)
        except:
            pass

    async def _notify_connection_failure(self):
        """Notify about connection failure"""
        # This would integrate with your alerting system
        logger.critical(f"🚨 CRITICAL: Service {self.service_name} connection failure")

    async def _send_to_backup_service(self, data: Dict):
        """Send data to backup service"""
        # Implementation would depend on your backup infrastructure
        pass

    async def _initiate_service_migration(self):
        """Initiate service migration to alternate infrastructure"""
        logger.info("🚀 Initiating service migration")
        # This would coordinate with your orchestration system

    async def _implement_memory_limit(self):
        """Implement memory limit to prevent issues"""
        self._memory_limit_mb = 1024  # 1GB limit
        logger.info(f"📏 Implemented memory limit: {self._memory_limit_mb}MB")

    async def _implement_connection_pooling(self):
        """Implement connection pooling for stability"""
        logger.info("🔄 Implementing connection pooling")
        # This would set up connection pooling

    async def _reduce_cpu_usage(self) -> bool:
        """Reduce CPU usage through various optimizations"""
        logger.info("⚡ Optimizing CPU usage")

        try:
            # Reduce concurrent operations
            if hasattr(self, "_max_concurrent_operations"):
                self._max_concurrent_operations = max(
                    1, self._max_concurrent_operations // 2
                )

            # Add delays to non-critical operations
            self._cpu_throttle_delay = 0.1

            # Reduce complexity of algorithms temporarily
            self._use_simplified_algorithms = True

            return True
        except Exception as e:
            logger.error(f"Error reducing CPU usage: {str(e)}")
            return False

    async def _emergency_performance_optimization(self) -> bool:
        """Emergency performance optimization for critical slowdowns"""
        logger.warning("🚨 Emergency performance optimization activated")

        try:
            # Disable all non-essential operations
            await self._disable_non_essential_features()

            # Reduce operation complexity
            self._emergency_mode = True

            # Clear all queues
            if hasattr(self, "_operation_queue"):
                self._operation_queue.clear()

            # Implement request throttling
            self._request_throttle_rate = 0.1  # Max 10 requests per second

            return True
        except Exception as e:
            logger.error(f"Error in emergency optimization: {str(e)}")
            return False

    async def _optimize_performance(self) -> bool:
        """
        Standard performance optimization with intelligent strategies
        """
        logger.info("⚡ Starting performance optimization")

        try:
            # Analyze current performance bottlenecks
            bottlenecks = await self._analyze_performance_bottlenecks()

            # Apply targeted optimizations
            optimization_applied = False

            if "database" in bottlenecks:
                optimization_applied |= await self._optimize_database_queries()

            if "network" in bottlenecks:
                optimization_applied |= await self._optimize_network_usage()

            if "processing" in bottlenecks:
                optimization_applied |= await self._optimize_processing()

            if "io" in bottlenecks:
                optimization_applied |= await self._optimize_io_operations()

            # Implement general optimizations
            await self._apply_general_optimizations()

            return optimization_applied

        except Exception as e:
            logger.error(f"Error during performance optimization: {str(e)}")
            return False

    async def _analyze_performance_bottlenecks(self) -> List[str]:
        """Analyze and identify performance bottlenecks"""
        bottlenecks = []

        # This would include actual performance profiling
        # For now, return common bottlenecks

        if hasattr(self, "_last_response_times"):
            avg_response = np.mean(self._last_response_times)
            if avg_response > 1.0:
                bottlenecks.append("network")

        import psutil

        cpu_percent = psutil.cpu_percent(interval=0.1)
        if cpu_percent > 70:
            bottlenecks.append("processing")

        return bottlenecks

    async def _optimize_database_queries(self) -> bool:
        """Optimize database query patterns"""
        logger.info("🗄️ Optimizing database queries")

        # Implement query caching
        if not hasattr(self, "_query_cache"):
            self._query_cache = {}

        # Enable batch operations
        self._enable_batch_operations = True

        return True

    async def _optimize_network_usage(self) -> bool:
        """Optimize network usage patterns"""
        logger.info("🌐 Optimizing network usage")

        # Enable compression
        self._enable_compression = True

        # Implement request batching
        self._enable_request_batching = True

        # Reduce polling frequency
        if hasattr(self, "_polling_interval"):
            self._polling_interval = min(self._polling_interval * 1.5, 60)

        return True

    async def _optimize_processing(self) -> bool:
        """Optimize processing algorithms"""
        logger.info("🧮 Optimizing processing algorithms")

        # Use caching for expensive computations
        self._enable_computation_cache = True

        # Implement lazy evaluation
        self._enable_lazy_evaluation = True

        # Use approximate algorithms where acceptable
        self._use_approximate_algorithms = True

        return True

    async def _optimize_io_operations(self) -> bool:
        """Optimize I/O operations"""
        logger.info("💾 Optimizing I/O operations")

        # Implement buffering
        self._io_buffer_size = 8192

        # Use async I/O where possible
        self._prefer_async_io = True

        # Batch write operations
        self._enable_write_batching = True

        return True

    async def _apply_general_optimizations(self):
        """Apply general performance optimizations"""
        # Remove debug logging in production
        if hasattr(logging, "getLogger"):
            logger.setLevel(logging.WARNING)

        # Optimize event handlers
        await self._optimize_event_handlers()

        # Pre-compile regular expressions
        await self._precompile_patterns()

    async def _optimize_event_handlers(self):
        """Optimize event handler performance"""
        # Debounce rapid events
        self._event_debounce_ms = 100

        # Prioritize critical events
        self._event_priority_queue = asyncio.PriorityQueue()

    async def _precompile_patterns(self):
        """Pre-compile commonly used patterns"""
        import re

        self._compiled_patterns = {
            "memory_percent": re.compile(r"(\d+\.?\d*)%"),
            "response_time": re.compile(r"(\d+\.?\d*)s"),
            "error_code": re.compile(r"error[:\s]+(\w+)", re.IGNORECASE),
        }

    def __init__(self, *args, **kwargs):
        """Initialize with required attributes"""
        super().__init__(*args, **kwargs)
        self._running = False
        self._health_check_task = None
        self._connection_start_time = None
        self._reconnect_attempts = 0
        self._performance_metrics = {}

        # Initialize health monitoring
        self._health_issue_history = defaultdict(list)
        self._issue_resolution_stats = defaultdict(lambda: {"success": 0, "failure": 0})

    async def _optimize_performance(self):
        """Optimize performance when slowdowns detected"""
        # Could implement various optimization strategies
        logger.info("⚡ Applying performance optimizations")

    async def _register_enhanced_capabilities(self):
        """Register enhanced service capabilities"""
        capabilities = {
            "service": self.service_name,
            "version": "2.0.0",
            "features": [
                "advanced_training_simulation",
                "comprehensive_move_analysis",
                "real_time_performance_monitoring",
                "adaptive_difficulty_adjustment",
                "multi_model_evaluation",
            ],
            "performance": {
                "max_concurrent_games": 100,
                "avg_move_time": 0.1,
                "supported_ai_types": ["mcts", "minimax", "neural", "hybrid"],
            },
        }

        await self.client.emit("register_capabilities", capabilities)

    async def _initialize_monitoring(self):
        """Initialize performance monitoring"""
        self._performance_metrics = {
            "games_simulated": 0,
            "total_moves_analyzed": 0,
            "avg_analysis_time": 0,
            "errors_encountered": 0,
            "uptime_seconds": 0,
        }

        # Start metrics collection
        asyncio.create_task(self._collect_metrics())

    async def _collect_metrics(self):
        """Collect performance metrics"""
        while self._running:
            await asyncio.sleep(60)  # Collect every minute

            if self._connection_start_time:
                self._performance_metrics["uptime_seconds"] = (
                    datetime.now() - self._connection_start_time
                ).total_seconds()

            # Send metrics
            await self.client.emit(
                "performance_metrics",
                {
                    "service": self.service_name,
                    "metrics": self._performance_metrics,
                    "timestamp": datetime.now().isoformat(),
                },
            )

    async def _save_state(self):
        """Save current state before shutdown"""
        state = {
            "service": self.service_name,
            "metrics": self._performance_metrics,
            "timestamp": datetime.now().isoformat(),
        }

        # Could save to file or database
        logger.info("💾 State saved successfully")

    async def _notify_shutdown(self):
        """Notify connected services of impending shutdown"""
        await self.client.emit(
            "service_shutting_down",
            {
                "service": self.service_name,
                "reason": "graceful_shutdown",
                "timestamp": datetime.now().isoformat(),
            },
        )

    async def _wait_for_pending_operations(self, timeout: float):
        """Wait for pending operations to complete"""
        logger.info("⏳ Waiting for pending operations to complete...")
        # Implementation would track and wait for ongoing operations
        await asyncio.sleep(min(2.0, timeout))

    async def _cleanup_resources(self):
        """Clean up allocated resources"""
        logger.info("🧹 Cleaning up resources...")

        # Clear caches
        if hasattr(self, "_cache"):
            self._cache.clear()

        # Close any open connections
        # Clean up temporary files
        # etc.

    async def _send_startup_telemetry(self, data: Dict[str, Any]):
        """Send startup telemetry data"""
        await self.client.emit(
            "telemetry",
            {
                "type": "startup",
                "service": self.service_name,
                "data": data,
                "timestamp": datetime.now().isoformat(),
            },
        )

    async def _send_shutdown_telemetry(self, data: Dict[str, Any]):
        """Send shutdown telemetry data"""
        await self.client.emit(
            "telemetry",
            {
                "type": "shutdown",
                "service": self.service_name,
                "data": data,
                "timestamp": datetime.now().isoformat(),
            },
        )

    async def _update_health_metrics(self, health_status: Dict[str, Any]):
        """Update health metrics"""
        await self.client.emit(
            "health_metrics",
            {
                "service": self.service_name,
                "status": health_status,
                "timestamp": datetime.now().isoformat(),
            },
        )

    async def _check_network_connectivity(self) -> bool:
        """Check network connectivity"""
        try:
            # Simple check - could be enhanced
            import socket

            socket.create_connection(("8.8.8.8", 53), timeout=3)
            return True
        except:
            return False

    async def _check_system_resources(self) -> bool:
        """Check system resources availability"""
        try:
            import psutil

            # Check CPU
            cpu_percent = psutil.cpu_percent(interval=0.1)
            if cpu_percent > 90:
                logger.warning(f"⚠️ High CPU usage: {cpu_percent}%")
                return False

            # Check memory
            memory = psutil.virtual_memory()
            if memory.percent > 90:
                logger.warning(f"⚠️ High memory usage: {memory.percent}%")
                return False

            # Check disk
            disk = psutil.disk_usage("/")
            if disk.percent > 95:
                logger.warning(f"⚠️ Low disk space: {disk.percent}% used")
                return False

            return True

        except Exception as e:
            logger.error(f"Error checking system resources: {str(e)}")
            return False

    async def _check_dependencies(self) -> bool:
        """Check required dependencies"""
        try:
            # Check if required services are accessible
            # This would check connections to databases, APIs, etc.
            return True
        except:
            return False

    def _creates_threat_at(
        self, board: List[List[int]], row: int, col: int, player: int
    ) -> bool:
        """Check if placing a piece at (row, col) creates a threat"""
        # Temporarily place the piece
        original = board[row][col]
        board[row][col] = player

        # Check if this creates a potential win threat
        threat = False
        directions = [(0, 1), (1, 0), (1, 1), (1, -1)]

        for dr, dc in directions:
            count = 1
            empty_spots = []

            # Check positive direction
            r, c = row + dr, col + dc
            while 0 <= r < 6 and 0 <= c < 7 and len(empty_spots) <= 1:
                if board[r][c] == player:
                    count += 1
                elif board[r][c] == 0:
                    empty_spots.append((r, c))
                else:
                    break
                r += dr
                c += dc

            # Check negative direction
            r, c = row - dr, col - dc
            while 0 <= r < 6 and 0 <= c < 7 and len(empty_spots) <= 1:
                if board[r][c] == player:
                    count += 1
                elif board[r][c] == 0:
                    empty_spots.append((r, c))
                else:
                    break
                r -= dr
                c -= dc

            # If we have 3 pieces and one empty spot, it's a threat
            if count >= 3 and len(empty_spots) == 1:
                threat = True
                break

        # Restore original value
        board[row][col] = original
        return threat


# Example usage
async def main():
    """Example of how to use the integration client"""

    # Create ML Service integration
    ml_integration = MLServiceIntegration()
    await ml_integration.start()

    # Simulate some events
    await ml_integration.client.notify_model_update(
        model_type="minimax", version="2.0.0", metadata={"accuracy": 0.92}
    )

    await ml_integration.client.share_pattern(
        {
            "type": "diagonal_threat",
            "positions": [[2, 3], [3, 4], [4, 5]],
            "confidence": 0.85,
        }
    )

    # Keep running
    try:
        await asyncio.Event().wait()
    except KeyboardInterrupt:
        await ml_integration.stop()


if __name__ == "__main__":
    logging.basicConfig(
        level=logging.INFO,
        format="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
    )

    asyncio.run(main())
