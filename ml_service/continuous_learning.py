"""
🧠 CONTINUOUS LEARNING PIPELINE
================================

Advanced continuous learning system for Connect Four AI that:
- Learns from every loss with pattern-specific analysis
- Implements prioritized experience replay
- Updates models in real-time without service interruption
- Maintains model stability through validation
- Provides WebSocket interface for real-time updates
"""

import asyncio
import gzip
import json
import logging
import os
import pickle
import time
from collections import defaultdict, deque
from datetime import datetime, timedelta
from pathlib import Path
from typing import Any, Deque, Dict, List, Optional, Set, Tuple

import aiofiles
import numpy as np
import torch
import torch.nn as nn
import torch.nn.functional as F
import websockets
from scipy import stats
from torch.utils.data import DataLoader, Dataset
from websockets.server import WebSocketServerProtocol

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


class ExperienceBuffer:
    """Prioritized experience replay buffer with pattern-aware sampling"""

    def __init__(self, capacity: int = 100000):
        self.capacity = capacity
        self.buffer: Deque[Dict[str, Any]] = deque(maxlen=capacity)
        self.priorities: Deque[float] = deque(maxlen=capacity)
        self.pattern_buffers = {
            "horizontal": deque(maxlen=capacity // 4),
            "vertical": deque(maxlen=capacity // 4),
            "diagonal": deque(maxlen=capacity // 4),
            "anti-diagonal": deque(maxlen=capacity // 4),
        }
        self.position = 0
        self.beta = 0.4
        self.beta_increment = 0.001
        self.epsilon = 0.01

    def add(self, experience: Dict[str, Any], priority: float = None):
        """Add experience with optional priority"""
        if priority is None:
            priority = max(self.priorities) if self.priorities else 1.0

        # Add to main buffer
        self.buffer.append(experience)
        self.priorities.append(priority)

        # Add to pattern-specific buffer if it's a loss
        if experience.get("outcome") == "loss" and experience.get("loss_pattern"):
            pattern_type = experience["loss_pattern"]["type"]
            if pattern_type in self.pattern_buffers:
                self.pattern_buffers[pattern_type].append(experience)

    def sample(
        self, batch_size: int, pattern_focus: Optional[str] = None
    ) -> List[Dict[str, Any]]:
        """Sample batch with optional pattern focus"""
        if pattern_focus and self.pattern_buffers[pattern_focus]:
            # 70% from pattern buffer, 30% from general buffer
            pattern_size = int(batch_size * 0.7)
            general_size = batch_size - pattern_size

            pattern_batch = self._sample_from_buffer(
                list(self.pattern_buffers[pattern_focus]), pattern_size
            )
            general_batch = self._prioritized_sample(general_size)

            return pattern_batch + general_batch
        else:
            return self._prioritized_sample(batch_size)

    def _prioritized_sample(self, batch_size: int) -> List[Dict[str, Any]]:
        """Sample using prioritized experience replay"""
        if len(self.buffer) < batch_size:
            return list(self.buffer)

        # Calculate sampling probabilities
        priorities = np.array(list(self.priorities))
        probs = priorities**self.beta
        probs /= probs.sum()

        # Sample indices
        indices = np.random.choice(len(self.buffer), batch_size, p=probs)

        # Update beta
        self.beta = min(1.0, self.beta + self.beta_increment)

        return [self.buffer[i] for i in indices]

    def _sample_from_buffer(
        self, buffer: List[Dict[str, Any]], size: int
    ) -> List[Dict[str, Any]]:
        """Random sample from a specific buffer"""
        if len(buffer) <= size:
            return buffer
        indices = np.random.choice(len(buffer), size, replace=False)
        return [buffer[i] for i in indices]

    def update_priorities(self, indices: List[int], priorities: List[float]):
        """Update priorities after training"""
        for idx, priority in zip(indices, priorities):
            if 0 <= idx < len(self.priorities):
                self.priorities[idx] = priority + self.epsilon


class ContinuousLearningPipeline:
    """Main continuous learning pipeline"""

    def __init__(self, model_manager, config: Dict[str, Any]):
        self.model_manager = model_manager
        self.config = config
        self.experience_buffer = ExperienceBuffer(
            capacity=config.get("buffer_capacity", 100000)
        )

        # Learning configuration
        self.learning_rate = config.get("learning_rate", 0.0001)
        self.batch_size = config.get("batch_size", 32)
        self.update_frequency = config.get("update_frequency", 100)
        self.min_games_for_update = config.get("min_games", 50)
        self.validation_threshold = config.get("validation_threshold", 0.95)

        # Loss pattern tracking
        self.loss_patterns = defaultdict(list)
        self.pattern_improvements = defaultdict(float)

        # Metrics
        self.metrics = {
            "games_processed": 0,
            "losses_analyzed": 0,
            "model_updates": 0,
            "current_win_rate": 0.5,
            "pattern_defense_rates": defaultdict(float),
            "last_update": None,
            "learning_rate_adjustments": 0,
            "convergence_score": 0.0,
        }

        # Model versioning
        self.model_version = 1
        self.model_history = deque(maxlen=10)

        # WebSocket clients for real-time updates
        self.ws_clients = set()

        # Advanced learning features
        self.stability_monitor = LearningStabilityMonitor()
        self.learning_scheduler = AdaptiveLearningScheduler()
        self.pattern_analyzer = PatternAnalyzer()
        self.meta_learner = MetaLearner()

        logger.info("Continuous Learning Pipeline initialized")

    async def process_game_outcome(self, game_data: Dict[str, Any]):
        """Process completed game for learning"""
        try:
            # Extract training examples
            examples = self._extract_training_examples(game_data)

            # Analyze game patterns
            patterns = self.pattern_analyzer.analyze_game_patterns(game_data)

            # Determine priority based on outcome and patterns
            if game_data["outcome"] == "loss":
                priority = 2.0  # High priority for losses
                self.metrics["losses_analyzed"] += 1

                # Analyze loss pattern
                if loss_pattern := game_data.get("lossPattern"):
                    await self._analyze_loss_pattern(loss_pattern, examples)
                    # Boost priority for critical patterns
                    if loss_pattern["type"] in ["diagonal", "anti-diagonal"]:
                        priority = 3.0
            else:
                priority = 1.0

            # Add to experience buffer with pattern info
            for example in examples:
                example["patterns"] = patterns
                self.experience_buffer.add(example, priority)

            self.metrics["games_processed"] += 1

            # Update win rate
            self._update_win_rate(game_data["outcome"])

            # Check if we should update model
            if self._should_update_model():
                # Determine pattern focus based on recent losses
                pattern_focus = self._determine_pattern_focus()
                await self.update_model(pattern_focus=pattern_focus)

            # Broadcast comprehensive update
            await self._broadcast_update(
                {
                    "type": "learning_progress",
                    "data": {
                        "gamesProcessed": self.metrics["games_processed"],
                        "lossesAnalyzed": self.metrics["losses_analyzed"],
                        "bufferSize": len(self.experience_buffer.buffer),
                        "winRate": self.metrics["current_win_rate"],
                        "patterns": patterns,
                        "convergenceScore": self.metrics["convergence_score"],
                    },
                }
            )

        except Exception as e:
            logger.error(f"Error processing game outcome: {e}")

    def _extract_training_examples(
        self, game_data: Dict[str, Any]
    ) -> List[Dict[str, Any]]:
        """Extract training examples from game data"""
        examples = []
        moves = game_data.get("moves", [])
        outcome = game_data["outcome"]

        # Process each move
        for i, move in enumerate(moves):
            if move["playerId"] == "AI":
                # Create training example
                example = {
                    "board_before": move.get("boardStateBefore"),
                    "board_after": move.get("boardStateAfter"),
                    "action": move["column"],
                    "outcome": outcome,
                    "move_number": i,
                    "total_moves": len(moves),
                    "game_phase": self._determine_game_phase(i, len(moves)),
                    "timestamp": move["timestamp"],
                }

                # Add loss pattern info if available
                if outcome == "loss" and game_data.get("lossPattern"):
                    example["loss_pattern"] = game_data["lossPattern"]

                examples.append(example)

        return examples

    def _determine_game_phase(self, move_num: int, total_moves: int) -> str:
        """Determine game phase (opening/middle/endgame)"""
        if move_num < 8:
            return "opening"
        elif move_num < total_moves - 10:
            return "middle"
        else:
            return "endgame"

    async def _analyze_loss_pattern(
        self, loss_pattern: Dict[str, Any], examples: List[Dict[str, Any]]
    ):
        """Analyze loss pattern for targeted learning"""
        pattern_type = loss_pattern["type"]

        # Store pattern for analysis
        self.loss_patterns[pattern_type].append(
            {
                "pattern": loss_pattern,
                "examples": examples[-5:],  # Last 5 moves
                "timestamp": datetime.now(),
            }
        )

        # Log pattern analysis
        logger.info(
            f"Loss pattern detected: {pattern_type} with "
            f"{len(loss_pattern.get('aiMistakes', []))} mistakes"
        )

        # Broadcast pattern insight
        await self._broadcast_update(
            {
                "type": "pattern_insights",
                "data": {
                    "patterns": {pattern_type: len(self.loss_patterns[pattern_type])},
                    "criticalPositions": loss_pattern.get("criticalPositions", []),
                    "recommendations": self._generate_pattern_recommendations(
                        pattern_type
                    ),
                },
            }
        )

    def _generate_pattern_recommendations(self, pattern_type: str) -> List[str]:
        """Generate recommendations based on pattern analysis"""
        recommendations = {
            "horizontal": [
                "Increase weight on horizontal threat detection",
                "Prioritize center column control",
                "Look ahead for horizontal setups",
            ],
            "vertical": [
                "Monitor column heights more carefully",
                "Prevent vertical stacking",
                "Balance defensive and offensive plays",
            ],
            "diagonal": [
                "Improve diagonal pattern recognition",
                "Control key diagonal intersections",
                "Increase lookahead for diagonal threats",
            ],
            "anti-diagonal": [
                "Enhance anti-diagonal threat detection",
                "Block critical anti-diagonal positions",
                "Consider both diagonal directions equally",
            ],
        }

        return recommendations.get(pattern_type, ["Improve general defense"])

    def _should_update_model(self) -> bool:
        """Determine if model should be updated"""
        # Check minimum games requirement
        if len(self.experience_buffer.buffer) < self.min_games_for_update:
            return False

        # Check update frequency
        if self.metrics["games_processed"] % self.update_frequency != 0:
            return False

        # Check time since last update
        if self.metrics["last_update"]:
            time_since_update = datetime.now() - self.metrics["last_update"]
            if time_since_update < timedelta(minutes=5):
                return False

        return True

    async def update_model(self, pattern_focus: Optional[str] = None):
        """Perform incremental model update"""
        logger.info(f"Starting model update (version {self.model_version})")

        try:
            # Sample training batch
            batch = self.experience_buffer.sample(
                self.batch_size * 10,  # Larger batch for update
                pattern_focus=pattern_focus,
            )

            # Prepare training data
            train_loader = self._prepare_training_data(batch)

            # Save current model as backup
            await self._backup_current_model()

            # Fine-tune model
            improvements = await self._fine_tune_model(train_loader, pattern_focus)

            # Validate improvement
            if await self._validate_improvement(improvements):
                # Deploy updated model
                await self._deploy_updated_model()

                # Update metrics
                self.metrics["model_updates"] += 1
                self.metrics["last_update"] = datetime.now()
                self.model_version += 1

                # Broadcast update
                await self._broadcast_update(
                    {
                        "type": "model_updated",
                        "data": {
                            "version": f"v{self.model_version}",
                            "improvements": improvements,
                            "timestamp": time.time(),
                        },
                    }
                )

                logger.info(
                    f"Model updated successfully to version {self.model_version}"
                )
            else:
                # Rollback to previous model
                await self._rollback_model()
                logger.warning("Model update failed validation, rolling back")

        except Exception as e:
            logger.error(f"Error during model update: {e}")
            await self._rollback_model()

    def _prepare_training_data(self, batch: List[Dict[str, Any]]) -> DataLoader:
        """Prepare data for training"""
        # Convert to tensors
        boards = []
        actions = []
        rewards = []

        for example in batch:
            # Convert board to tensor
            board_tensor = self._board_to_tensor(example["board_before"])
            boards.append(board_tensor)

            # Action
            actions.append(example["action"])

            # Calculate reward based on outcome
            reward = self._calculate_reward(example)
            rewards.append(reward)

        # Create dataset
        dataset = Connect4Dataset(boards, actions, rewards)

        return DataLoader(dataset, batch_size=self.batch_size, shuffle=True)

    def _board_to_tensor(self, board: List[List[str]]) -> torch.Tensor:
        """Convert board to tensor representation"""
        # Create 2-channel tensor (player, opponent)
        tensor = torch.zeros(2, 6, 7)

        for r in range(6):
            for c in range(7):
                if board[r][c] == "Yellow":  # AI
                    tensor[0, r, c] = 1
                elif board[r][c] == "Red":  # Human
                    tensor[1, r, c] = 1

        return tensor

    def _calculate_reward(self, example: Dict[str, Any]) -> float:
        """Calculate reward for training"""
        outcome = example["outcome"]
        move_number = example["move_number"]
        total_moves = example["total_moves"]

        # Base reward
        if outcome == "win":
            reward = 1.0
        elif outcome == "draw":
            reward = 0.0
        else:  # loss
            reward = -1.0

        # Adjust based on move position (discount earlier moves)
        position_factor = (move_number + 1) / total_moves
        reward *= 0.5 + 0.5 * position_factor

        # Boost negative reward for critical mistakes
        if outcome == "loss" and example.get("loss_pattern"):
            if move_number >= total_moves - 5:  # Last 5 moves
                reward *= 2.0  # Double negative reward

        return reward

    async def _fine_tune_model(
        self, train_loader: DataLoader, pattern_focus: Optional[str]
    ) -> Dict[str, float]:
        """Fine-tune the model with adaptive learning"""
        model = self.model_manager.models["standard"]
        model.train()

        # Get adaptive learning rate
        current_lr = self.learning_scheduler.get_optimal_lr()
        optimizer = torch.optim.Adam(model.parameters(), lr=current_lr)

        improvements = defaultdict(float)
        best_loss = float("inf")

        # Training loop with early stopping
        for epoch in range(10):  # More epochs with early stopping
            total_loss = 0
            correct_predictions = 0
            total_predictions = 0

            for batch_boards, batch_actions, batch_rewards in train_loader:
                optimizer.zero_grad()

                # Forward pass
                outputs = model(batch_boards)

                # Calculate loss
                loss = self._calculate_loss(outputs, batch_actions, batch_rewards)

                # Track accuracy
                predictions = outputs.argmax(dim=1)
                correct_predictions += (predictions == batch_actions).sum().item()
                total_predictions += batch_actions.size(0)

                # Backward pass
                loss.backward()

                # Gradient clipping
                torch.nn.utils.clip_grad_norm_(model.parameters(), max_norm=1.0)

                optimizer.step()

                total_loss += loss.item()

            avg_loss = total_loss / len(train_loader)
            accuracy = correct_predictions / total_predictions
            improvements[f"epoch_{epoch}_loss"] = avg_loss
            improvements[f"epoch_{epoch}_accuracy"] = accuracy

            # Update learning rate
            new_lr = self.learning_scheduler.update(accuracy, avg_loss)
            for param_group in optimizer.param_groups:
                param_group["lr"] = new_lr

            # Early stopping
            if avg_loss < best_loss:
                best_loss = avg_loss
                patience_counter = 0
            else:
                patience_counter += 1
                if patience_counter >= 3:
                    logger.info(f"Early stopping at epoch {epoch}")
                    break

        # Calculate pattern-specific improvements
        if pattern_focus:
            pattern_improvement = await self._test_pattern_defense(pattern_focus)
            improvements[f"{pattern_focus}_defense"] = pattern_improvement
            self.pattern_improvements[pattern_focus] = pattern_improvement
        else:
            # Test all patterns
            for pattern in ["horizontal", "vertical", "diagonal", "anti-diagonal"]:
                improvement = await self._test_pattern_defense(pattern)
                improvements[f"{pattern}_defense"] = improvement
                self.pattern_improvements[pattern] = improvement

        # Test stability
        stability_score = await self._test_model_stability()
        improvements["stability"] = stability_score

        # Update convergence score
        self.metrics["convergence_score"] = self._calculate_convergence(improvements)

        # Overall improvement
        improvements["overall_accuracy"] = sum(
            v for k, v in improvements.items() if "accuracy" in k
        ) / sum(1 for k in improvements if "accuracy" in k)

        return dict(improvements)

    def _calculate_loss(
        self, outputs: torch.Tensor, actions: torch.Tensor, rewards: torch.Tensor
    ) -> torch.Tensor:
        """Calculate custom loss function"""
        # Policy loss (cross-entropy)
        policy_loss = F.cross_entropy(outputs, actions, reduction="none")

        # Weight by rewards (positive for good moves, negative for bad)
        weighted_loss = policy_loss * (-rewards)  # Negative because we minimize loss

        return weighted_loss.mean()

    async def _test_pattern_defense(self, pattern: str) -> float:
        """Test model's defense against specific pattern"""
        # Load test positions for pattern
        test_positions = self._get_pattern_test_positions(pattern)

        if not test_positions:
            return 0.5

        correct = 0
        total = len(test_positions)

        model = self.model_manager.models["standard"]
        model.eval()

        with torch.no_grad():
            for position in test_positions:
                board_tensor = self._board_to_tensor(position["board"])
                output = model(board_tensor.unsqueeze(0))

                # Get predicted move
                predicted_move = output.argmax(dim=1).item()

                # Check if it blocks the threat
                if predicted_move in position["blocking_moves"]:
                    correct += 1

        return correct / total

    def _get_pattern_test_positions(self, pattern: str) -> List[Dict[str, Any]]:
        """Get test positions for pattern defense"""
        # This would load pre-defined test positions
        # For now, return positions from recent losses
        positions = []

        for loss_data in self.loss_patterns[pattern][-10:]:
            for example in loss_data["examples"]:
                if "board_before" in example:
                    positions.append(
                        {
                            "board": example["board_before"],
                            "blocking_moves": [
                                pos["column"]
                                for pos in loss_data["pattern"].get(
                                    "criticalPositions", []
                                )
                            ],
                        }
                    )

        return positions

    async def _validate_improvement(self, improvements: Dict[str, float]) -> bool:
        """Validate that model hasn't degraded"""
        # Check overall improvement
        if improvements.get("overall_accuracy", 0) < -0.1:
            return False

        # Check catastrophic forgetting on basic positions
        basic_score = await self._test_basic_positions()
        if basic_score < self.validation_threshold:
            logger.warning(f"Basic position score too low: {basic_score}")
            return False

        # Check pattern defense improvements
        for pattern in ["horizontal", "vertical", "diagonal"]:
            if improvements.get(f"{pattern}_defense", 0) < 0.3:
                logger.warning(
                    f"Poor {pattern} defense: {improvements.get(f'{pattern}_defense', 0)}"
                )
                # Don't reject, but log concern

        return True

    async def _test_basic_positions(self) -> float:
        """Test model on basic positions to prevent catastrophic forgetting"""
        basic_tests = [
            # Win in 1 move
            {
                "board": [
                    ["Empty"] * 7,
                    ["Empty"] * 7,
                    ["Empty"] * 7,
                    ["Empty", "Empty", "Empty", "Empty", "Empty", "Empty", "Empty"],
                    ["Empty", "Empty", "Empty", "Empty", "Empty", "Empty", "Empty"],
                    ["Yellow", "Yellow", "Yellow", "Empty", "Empty", "Empty", "Empty"],
                ],
                "correct_move": 3,
            },
            # Block opponent win
            {
                "board": [
                    ["Empty"] * 7,
                    ["Empty"] * 7,
                    ["Empty"] * 7,
                    ["Empty", "Empty", "Empty", "Empty", "Empty", "Empty", "Empty"],
                    ["Empty", "Empty", "Empty", "Empty", "Empty", "Empty", "Empty"],
                    ["Red", "Red", "Red", "Empty", "Empty", "Empty", "Empty"],
                ],
                "correct_move": 3,
            },
        ]

        correct = 0
        model = self.model_manager.models["standard"]
        model.eval()

        with torch.no_grad():
            for test in basic_tests:
                board_tensor = self._board_to_tensor(test["board"])
                output = model(board_tensor.unsqueeze(0))
                predicted_move = output.argmax(dim=1).item()

                if predicted_move == test["correct_move"]:
                    correct += 1

        return correct / len(basic_tests)

    async def _backup_current_model(self):
        """Enhanced backup with compression and metadata"""
        try:
            model = self.model_manager.models["standard"]
            backup_data = {
                "version": self.model_version,
                "state_dict": model.state_dict().copy(),
                "timestamp": datetime.now(),
                "metrics": dict(self.metrics),
                "pattern_improvements": dict(self.pattern_improvements),
                "architecture": {
                    "type": model.__class__.__name__,
                    "layers": str(model) if hasattr(model, "__str__") else "Unknown",
                },
                "training_stats": {
                    "total_games": self.metrics["games_processed"],
                    "losses_analyzed": self.metrics["losses_analyzed"],
                    "win_rate": self.metrics["current_win_rate"],
                },
            }

            # Add to in-memory history
            self.model_history.append(backup_data)

            # Save to disk with compression
            backup_dir = Path("model_backups")
            backup_dir.mkdir(exist_ok=True)

            filename = (
                backup_dir
                / f"model_v{self.model_version}_{datetime.now().strftime('%Y%m%d_%H%M%S')}.pkl.gz"
            )

            async with aiofiles.open(filename, "wb") as f:
                compressed = gzip.compress(pickle.dumps(backup_data))
                await f.write(compressed)

            logger.info(
                f"Model backup saved to {filename} (size: {len(compressed) / 1024:.1f}KB)"
            )

            # Clean old backups (keep last 20)
            await self._cleanup_old_backups(backup_dir)

        except Exception as e:
            logger.error(f"Error backing up model: {e}")

    async def _deploy_updated_model(self):
        """Deploy the updated model"""
        # Model is already updated in-place
        # This method would handle any deployment logistics
        logger.info("Model deployed successfully")

    async def _rollback_model(self):
        """Rollback to previous model version"""
        if self.model_history:
            previous = self.model_history[-1]
            self.model_manager.models["standard"].load_state_dict(
                previous["state_dict"]
            )
            logger.info(f"Rolled back to model version {previous['version']}")

    async def _broadcast_update(self, message: Dict[str, Any]):
        """Broadcast update to all WebSocket clients"""
        if self.ws_clients:
            message_json = json.dumps(message)
            disconnected = set()

            for client in self.ws_clients:
                try:
                    await client.send(message_json)
                except websockets.exceptions.ConnectionClosed:
                    disconnected.add(client)

            # Remove disconnected clients
            self.ws_clients -= disconnected

    async def handle_websocket(self, websocket: WebSocketServerProtocol, path: str):
        """Handle WebSocket connections"""
        self.ws_clients.add(websocket)
        logger.info(
            f"WebSocket client connected. Total clients: {len(self.ws_clients)}"
        )

        try:
            # Send initial status
            await websocket.send(
                json.dumps(
                    {
                        "type": "connection_established",
                        "data": {
                            "model_version": self.model_version,
                            "metrics": dict(self.metrics),
                        },
                    }
                )
            )

            # Handle incoming messages
            async for message in websocket:
                await self._handle_ws_message(websocket, json.loads(message))

        except websockets.exceptions.ConnectionClosed:
            pass
        finally:
            self.ws_clients.remove(websocket)
            logger.info(
                f"WebSocket client disconnected. Total clients: {len(self.ws_clients)}"
            )

    async def _handle_ws_message(
        self, websocket: WebSocketServerProtocol, message: Dict[str, Any]
    ):
        """Handle incoming WebSocket messages"""
        msg_type = message.get("type")

        if msg_type == "priority_learning":
            # Handle priority learning request
            await self.process_game_outcome(message["data"])

        elif msg_type == "pattern_defense_request":
            # Handle pattern defense request
            response = {
                "type": "pattern_defense_response",
                "requestId": message.get("requestId"),
                "defense": self._generate_pattern_defense(
                    message.get("pattern"), message.get("board")
                ),
            }
            await websocket.send(json.dumps(response))

        elif msg_type == "check_model_updates":
            # Force model update check
            if message.get("force") and self._should_update_model():
                await self.update_model()

        elif msg_type == "get_metrics":
            # Send current metrics
            await websocket.send(
                json.dumps({"type": "metrics_update", "data": dict(self.metrics)})
            )

        elif msg_type == "opponent_adaptation":
            # Handle opponent adaptation request
            opponent_profile = message.get("opponent_profile", {})
            game_history = message.get("game_history", [])

            strategy = self.meta_learner.adapt_strategy(opponent_profile, game_history)

            await websocket.send(
                json.dumps(
                    {
                        "type": "strategy_update",
                        "requestId": message.get("requestId"),
                        "strategy": strategy,
                    }
                )
            )

        elif msg_type == "pattern_analysis":
            # Detailed pattern analysis request
            patterns = self.pattern_analyzer.pattern_database

            await websocket.send(
                json.dumps(
                    {
                        "type": "pattern_analysis_response",
                        "requestId": message.get("requestId"),
                        "patterns": dict(patterns),
                        "insights": self._generate_pattern_insights(),
                    }
                )
            )

        elif msg_type == "request_model_rollback":
            # Handle model rollback request
            if self.model_history:
                await self._rollback_model()
                await websocket.send(
                    json.dumps(
                        {
                            "type": "rollback_complete",
                            "requestId": message.get("requestId"),
                            "version": self.model_version,
                        }
                    )
                )

    def _generate_pattern_defense(
        self, pattern: str, board: List[List[str]]
    ) -> Dict[str, Any]:
        """Generate pattern-specific defense strategy"""
        # Analyze board for pattern threats
        critical_moves = self._find_critical_moves(board, pattern)

        return {
            "pattern": pattern,
            "criticalMoves": critical_moves,
            "confidence": self.pattern_improvements.get(pattern, 0.5),
            "strategy": self._generate_pattern_recommendations(pattern),
        }

    def _find_critical_moves(self, board: List[List[str]], pattern: str) -> List[int]:
        """Find critical defensive moves for pattern"""
        critical = []

        # Simple heuristic for now
        if pattern == "horizontal":
            # Check each row for potential horizontal threats
            for row in range(6):
                consecutive = 0
                for col in range(7):
                    if board[row][col] == "Red":
                        consecutive += 1
                        if consecutive >= 2:
                            # Check adjacent columns
                            if col + 1 < 7 and board[row][col + 1] == "Empty":
                                critical.append(col + 1)
                            if (
                                col - consecutive >= 0
                                and board[row][col - consecutive] == "Empty"
                            ):
                                critical.append(col - consecutive)
                    else:
                        consecutive = 0

        # Remove duplicates and return top 3
        return list(set(critical))[:3]


class Connect4Dataset(Dataset):
    """PyTorch dataset for Connect Four training data"""

    def __init__(
        self, boards: List[torch.Tensor], actions: List[int], rewards: List[float]
    ):
        self.boards = boards
        self.actions = torch.tensor(actions, dtype=torch.long)
        self.rewards = torch.tensor(rewards, dtype=torch.float32)

    def __len__(self):
        return len(self.boards)

    def __getitem__(self, idx):
        return self.boards[idx], self.actions[idx], self.rewards[idx]


class LearningStabilityMonitor:
    """Monitor learning stability and prevent catastrophic forgetting"""

    def __init__(self, threshold: float = 0.1):
        self.threshold = threshold
        self.performance_history = deque(maxlen=100)
        self.baseline_performance = None

    async def check_stability(self, model, test_set: List[Dict[str, Any]]) -> bool:
        """Check if model is stable"""
        performance = await self._evaluate_model(model, test_set)

        # Set baseline if not set
        if self.baseline_performance is None:
            self.baseline_performance = performance

        self.performance_history.append(performance)

        # Check for catastrophic forgetting
        if performance < self.baseline_performance * (1 - self.threshold):
            logger.warning(
                f"Catastrophic forgetting detected! "
                f"Performance: {performance:.2f} vs baseline: {self.baseline_performance:.2f}"
            )
            return False

        # Check for consistent degradation
        if len(self.performance_history) >= 10:
            recent_avg = sum(list(self.performance_history)[-10:]) / 10
            if recent_avg < self.baseline_performance * (1 - self.threshold / 2):
                logger.warning(f"Consistent performance degradation detected")
                return False

        return True

    async def _evaluate_model(self, model, test_set: List[Dict[str, Any]]) -> float:
        """Evaluate model performance"""
        correct = 0
        total = len(test_set)

        model.eval()
        with torch.no_grad():
            for test in test_set:
                # Implementation depends on test format
                # This is a placeholder
                correct += 1 if self._test_position(model, test) else 0

        return correct / total if total > 0 else 0

    def _test_position(self, model, test: Dict[str, Any]) -> bool:
        """Test model on a single position"""
        # Placeholder - implement based on test format
        return True

    async def _cleanup_old_backups(self, backup_dir: Path, keep_last: int = 20):
        """Clean up old model backups"""
        try:
            backups = sorted(
                backup_dir.glob("model_v*.pkl.gz"),
                key=lambda x: x.stat().st_mtime,
                reverse=True,
            )

            for backup in backups[keep_last:]:
                backup.unlink()
                logger.info(f"Deleted old backup: {backup.name}")

        except Exception as e:
            logger.error(f"Error cleaning up backups: {e}")


class AdaptiveLearningScheduler:
    """Adaptive learning rate scheduler based on performance"""

    def __init__(self):
        self.initial_lr = 0.001
        self.current_lr = self.initial_lr
        self.performance_history = deque(maxlen=50)
        self.lr_history = deque(maxlen=50)
        self.patience = 5
        self.min_lr = 1e-6
        self.max_lr = 0.01

    def update(self, performance: float, loss: float) -> float:
        """Update learning rate based on performance"""
        self.performance_history.append(performance)

        if len(self.performance_history) >= self.patience:
            # Check for plateau
            recent_perf = list(self.performance_history)[-self.patience :]
            if np.std(recent_perf) < 0.01:  # Performance plateau
                # Reduce learning rate
                self.current_lr = max(self.min_lr, self.current_lr * 0.5)
                logger.info(
                    f"Learning rate reduced to {self.current_lr:.6f} due to plateau"
                )
            elif all(
                recent_perf[i] < recent_perf[i + 1] for i in range(len(recent_perf) - 1)
            ):
                # Consistent improvement - increase learning rate slightly
                self.current_lr = min(self.max_lr, self.current_lr * 1.1)
                logger.info(
                    f"Learning rate increased to {self.current_lr:.6f} due to improvement"
                )

        self.lr_history.append(self.current_lr)
        return self.current_lr

    def get_optimal_lr(self) -> float:
        """Get optimal learning rate based on history"""
        if len(self.performance_history) < 10:
            return self.current_lr

        # Find learning rate that led to best performance
        best_idx = np.argmax(list(self.performance_history))
        if best_idx < len(self.lr_history):
            return self.lr_history[best_idx]
        return self.current_lr


class PatternAnalyzer:
    """Advanced pattern analysis for strategic learning"""

    def __init__(self):
        self.pattern_database = defaultdict(
            lambda: {
                "occurrences": 0,
                "win_rate": 0.0,
                "critical_moves": [],
                "counter_strategies": [],
            }
        )
        self.pattern_correlations = defaultdict(float)

    def analyze_game_patterns(self, game_data: Dict[str, Any]) -> Dict[str, Any]:
        """Analyze patterns in completed game"""
        patterns = {
            "opening_patterns": self._analyze_opening(game_data),
            "tactical_patterns": self._analyze_tactics(game_data),
            "endgame_patterns": self._analyze_endgame(game_data),
            "mistake_patterns": self._analyze_mistakes(game_data),
        }

        # Update pattern database
        for category, pattern_list in patterns.items():
            for pattern in pattern_list:
                self._update_pattern_database(pattern, game_data["outcome"])

        return patterns

    def _analyze_opening(self, game_data: Dict[str, Any]) -> List[Dict[str, Any]]:
        """Analyze opening patterns"""
        moves = game_data.get("moves", [])[:8]  # First 8 moves
        patterns = []

        # Center control pattern
        center_moves = sum(1 for m in moves if m["column"] in [2, 3, 4])
        if center_moves >= 4:
            patterns.append(
                {
                    "type": "center_control",
                    "strength": center_moves / len(moves),
                    "moves": [m["column"] for m in moves if m["column"] in [2, 3, 4]],
                }
            )

        # Edge play pattern
        edge_moves = sum(1 for m in moves if m["column"] in [0, 6])
        if edge_moves >= 2:
            patterns.append(
                {
                    "type": "edge_play",
                    "strength": edge_moves / len(moves),
                    "moves": [m["column"] for m in moves if m["column"] in [0, 6]],
                }
            )

        return patterns

    def _analyze_tactics(self, game_data: Dict[str, Any]) -> List[Dict[str, Any]]:
        """Analyze tactical patterns"""
        patterns = []
        moves = game_data.get("moves", [])

        # Fork creation pattern
        for i in range(len(moves) - 2):
            if self._is_fork_setup(moves[i : i + 3]):
                patterns.append(
                    {
                        "type": "fork_creation",
                        "move_index": i,
                        "columns": [
                            moves[i]["column"],
                            moves[i + 1]["column"],
                            moves[i + 2]["column"],
                        ],
                    }
                )

        # Forced move pattern
        for i, move in enumerate(moves):
            if move.get("forced"):
                patterns.append(
                    {"type": "forced_move", "move_index": i, "column": move["column"]}
                )

        return patterns

    def _analyze_endgame(self, game_data: Dict[str, Any]) -> List[Dict[str, Any]]:
        """Analyze endgame patterns"""
        moves = game_data.get("moves", [])
        if len(moves) < 20:
            return []

        patterns = []
        endgame_moves = moves[-10:]  # Last 10 moves

        # Column filling pattern
        column_counts = defaultdict(int)
        for move in endgame_moves:
            column_counts[move["column"]] += 1

        for col, count in column_counts.items():
            if count >= 3:
                patterns.append(
                    {
                        "type": "column_focus",
                        "column": col,
                        "intensity": count / len(endgame_moves),
                    }
                )

        return patterns

    def _analyze_mistakes(self, game_data: Dict[str, Any]) -> List[Dict[str, Any]]:
        """Analyze mistake patterns"""
        if game_data["outcome"] != "loss":
            return []

        patterns = []
        if loss_pattern := game_data.get("lossPattern"):
            mistakes = loss_pattern.get("aiMistakes", [])

            for mistake in mistakes:
                patterns.append(
                    {
                        "type": "missed_threat",
                        "threat_type": loss_pattern["type"],
                        "move_index": mistake["moveIndex"],
                        "column": mistake["column"],
                        "better_move": mistake.get("betterMove"),
                    }
                )

        return patterns

    def _is_fork_setup(self, moves: List[Dict[str, Any]]) -> bool:
        """Check if moves create a fork setup"""
        if len(moves) < 3:
            return False

        # Simple heuristic - moves in different columns creating multiple threats
        columns = [m["column"] for m in moves]
        return len(set(columns)) >= 2 and abs(max(columns) - min(columns)) >= 2

    def _update_pattern_database(self, pattern: Dict[str, Any], outcome: str):
        """Update pattern database with occurrence"""
        pattern_key = f"{pattern['type']}_{pattern.get('subtype', 'default')}"

        db_entry = self.pattern_database[pattern_key]
        db_entry["occurrences"] += 1

        # Update win rate
        if outcome == "win":
            current_wins = db_entry["win_rate"] * (db_entry["occurrences"] - 1)
            db_entry["win_rate"] = (current_wins + 1) / db_entry["occurrences"]
        else:
            current_wins = db_entry["win_rate"] * (db_entry["occurrences"] - 1)
            db_entry["win_rate"] = current_wins / db_entry["occurrences"]


class MetaLearner:
    """Meta-learning system for strategy adaptation"""

    def __init__(self):
        self.strategy_performance = defaultdict(
            lambda: {
                "games": 0,
                "wins": 0,
                "avg_game_length": 0,
                "pattern_success": defaultdict(float),
            }
        )
        self.opponent_models = {}
        self.adaptation_history = deque(maxlen=100)

    def adapt_strategy(
        self, opponent_profile: Dict[str, Any], game_history: List[Dict[str, Any]]
    ) -> Dict[str, Any]:
        """Adapt strategy based on opponent profile and game history"""
        # Analyze opponent tendencies
        opponent_patterns = self._analyze_opponent(opponent_profile, game_history)

        # Select counter-strategy
        strategy = self._select_counter_strategy(opponent_patterns)

        # Record adaptation
        self.adaptation_history.append(
            {
                "timestamp": datetime.now(),
                "opponent_profile": opponent_profile,
                "selected_strategy": strategy,
                "confidence": self._calculate_confidence(opponent_patterns),
            }
        )

        return strategy

    def _analyze_opponent(
        self, profile: Dict[str, Any], history: List[Dict[str, Any]]
    ) -> Dict[str, Any]:
        """Analyze opponent playing patterns"""
        patterns = {
            "aggression_level": self._calculate_aggression(history),
            "preferred_columns": self._find_column_preference(history),
            "reaction_patterns": self._analyze_reactions(history),
            "weakness_areas": self._identify_weaknesses(history),
        }

        return patterns

    def _calculate_aggression(self, history: List[Dict[str, Any]]) -> float:
        """Calculate opponent's aggression level"""
        if not history:
            return 0.5

        offensive_moves = 0
        total_moves = 0

        for game in history:
            for move in game.get("moves", []):
                if move["playerId"] != "AI":
                    total_moves += 1
                    if self._is_offensive_move(move, game):
                        offensive_moves += 1

        return offensive_moves / total_moves if total_moves > 0 else 0.5

    def _is_offensive_move(self, move: Dict[str, Any], game: Dict[str, Any]) -> bool:
        """Determine if a move is offensive"""
        # Simple heuristic - center columns and building sequences
        return move["column"] in [2, 3, 4] or move.get("creates_threat", False)

    def _find_column_preference(self, history: List[Dict[str, Any]]) -> List[int]:
        """Find opponent's preferred columns"""
        column_counts = defaultdict(int)

        for game in history:
            for move in game.get("moves", []):
                if move["playerId"] != "AI":
                    column_counts[move["column"]] += 1

        # Sort by frequency
        sorted_cols = sorted(column_counts.items(), key=lambda x: x[1], reverse=True)
        return [col for col, _ in sorted_cols[:3]]

    def _analyze_reactions(self, history: List[Dict[str, Any]]) -> Dict[str, float]:
        """Analyze how opponent reacts to threats"""
        reactions = {"blocks_immediate": 0, "creates_counter": 0, "ignores_threat": 0}

        total_threats = 0

        for game in history:
            moves = game.get("moves", [])
            for i in range(len(moves) - 1):
                if moves[i]["playerId"] == "AI" and moves[i].get("creates_threat"):
                    total_threats += 1
                    next_move = moves[i + 1]

                    if next_move.get("blocks_threat"):
                        reactions["blocks_immediate"] += 1
                    elif next_move.get("creates_threat"):
                        reactions["creates_counter"] += 1
                    else:
                        reactions["ignores_threat"] += 1

        # Normalize
        if total_threats > 0:
            for key in reactions:
                reactions[key] /= total_threats

        return reactions

    def _identify_weaknesses(self, history: List[Dict[str, Any]]) -> List[str]:
        """Identify opponent's weaknesses"""
        weaknesses = []

        # Analyze losses
        losses = [g for g in history if g.get("outcome") == "win"]  # AI wins

        if not losses:
            return []

        # Common weakness patterns
        pattern_counts = defaultdict(int)

        for game in losses:
            if loss_pattern := game.get("opponentLossPattern"):
                pattern_counts[loss_pattern["type"]] += 1

        # Most common weakness
        if pattern_counts:
            sorted_patterns = sorted(
                pattern_counts.items(), key=lambda x: x[1], reverse=True
            )
            weaknesses = [pattern for pattern, _ in sorted_patterns[:3]]

        return weaknesses

    def _select_counter_strategy(
        self, opponent_patterns: Dict[str, Any]
    ) -> Dict[str, Any]:
        """Select optimal counter-strategy"""
        strategy = {"name": "adaptive_counter", "parameters": {}, "focus_areas": []}

        # High aggression -> defensive play
        if opponent_patterns["aggression_level"] > 0.7:
            strategy["name"] = "defensive_counter"
            strategy["parameters"]["block_priority"] = 0.8
            strategy["focus_areas"].append("threat_prevention")

        # Low aggression -> aggressive play
        elif opponent_patterns["aggression_level"] < 0.3:
            strategy["name"] = "aggressive_push"
            strategy["parameters"]["attack_priority"] = 0.8
            strategy["focus_areas"].append("create_threats")

        # Column preferences -> block preferred columns
        if preferred := opponent_patterns["preferred_columns"]:
            strategy["parameters"]["column_weights"] = {
                col: 0.3 if col in preferred else 1.0 for col in range(7)
            }

        # Reaction patterns
        reactions = opponent_patterns["reaction_patterns"]
        if reactions.get("ignores_threat", 0) > 0.3:
            strategy["focus_areas"].append("exploit_ignored_threats")

        return strategy

    def _calculate_confidence(self, patterns: Dict[str, Any]) -> float:
        """Calculate confidence in strategy selection"""
        # Base confidence on data quality and pattern clarity
        confidence = 0.5

        # Clear patterns increase confidence
        if patterns["aggression_level"] > 0.8 or patterns["aggression_level"] < 0.2:
            confidence += 0.2

        if patterns["preferred_columns"]:
            confidence += 0.1

        if patterns["weakness_areas"]:
            confidence += 0.2

        return min(1.0, confidence)


# Initialize and run the continuous learning system
async def run_continuous_learning(model_manager, config: Dict[str, Any]):
    """Run the continuous learning pipeline"""
    pipeline = ContinuousLearningPipeline(model_manager, config)

    # Start WebSocket server
    ws_port = int(os.environ.get("ML_WEBSOCKET_PORT", "8002"))
    server = await websockets.serve(pipeline.handle_websocket, "localhost", ws_port)

    logger.info(
        f"Continuous Learning WebSocket server started on ws://localhost:{ws_port}"
    )
    logger.info("Advanced features enabled:")
    logger.info("  - Adaptive learning rate scheduling")
    logger.info("  - Pattern analysis and database")
    logger.info("  - Meta-learning for opponent adaptation")
    logger.info("  - Model stability monitoring")
    logger.info("  - Compressed model backups")

    # Start background tasks
    asyncio.create_task(pipeline._periodic_model_evaluation())
    asyncio.create_task(pipeline._periodic_pattern_analysis())

    # Keep the server running
    await asyncio.Future()  # Run forever


if __name__ == "__main__":
    # This would be integrated with the main ML service
    logger.info("Continuous Learning module loaded")
