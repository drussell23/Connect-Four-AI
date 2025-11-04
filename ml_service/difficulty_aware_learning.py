"""
🎯 DIFFICULTY-AWARE LEARNING SYSTEM
===================================

Implements segmented learning by difficulty level with cross-level insights.
Each difficulty maintains its own model and pattern memory while benefiting
from knowledge gained at other levels.

Key Features:
- Separate models for each difficulty level (1-10)
- Pattern transfer from lower to higher difficulties
- Progressive difficulty that truly learns from past defeats
- Multi-model ensemble for strategic depth
"""

import asyncio
import copy
import json
import logging
import time
from collections import defaultdict, deque
from dataclasses import asdict, dataclass
from datetime import datetime
from typing import Any, Dict, List, Optional, Tuple

import numpy as np
import torch
import torch.nn as nn

logger = logging.getLogger(__name__)


@dataclass
class DifficultyPattern:
    """Pattern learned at a specific difficulty"""

    pattern_type: str  # horizontal, vertical, diagonal, anti-diagonal
    difficulty_level: int
    board_state: List[List[str]]
    critical_positions: List[Dict[str, int]]
    defense_moves: List[int]
    confidence: float
    games_encountered: int
    games_defended: int
    last_seen: datetime
    transfer_factor: float = 1.0  # How well this transfers to other levels


class DifficultyAwareExperienceBuffer:
    """Experience replay buffer segmented by difficulty with cross-level transfer"""

    def __init__(self, capacity_per_level: int = 10000):
        # Separate buffers for each difficulty level
        self.level_buffers = {
            level: deque(maxlen=capacity_per_level) for level in range(1, 11)
        }

        # Cross-level buffer for pattern transfer
        self.pattern_transfer_buffer = deque(maxlen=capacity_per_level * 2)

        # Pattern registry by difficulty
        self.pattern_registry: Dict[int, Dict[str, List[DifficultyPattern]]] = (
            defaultdict(lambda: defaultdict(list))
        )

        # Transfer learning matrix (how much knowledge transfers between levels)
        self.transfer_matrix = self._initialize_transfer_matrix()

        # Metrics
        self.metrics = {
            "patterns_learned": defaultdict(int),
            "patterns_transferred": defaultdict(int),
            "cross_level_defenses": 0,
        }

    def _initialize_transfer_matrix(self) -> np.ndarray:
        """Create transfer learning coefficients between difficulty levels"""
        matrix = np.zeros((10, 10))

        for i in range(10):
            for j in range(10):
                if i == j:
                    matrix[i][j] = 1.0  # Same level = full transfer
                elif j > i:
                    # Higher difficulties benefit from lower level patterns
                    matrix[i][j] = 1.0 - (j - i) * 0.05  # 5% decay per level
                else:
                    # Lower difficulties get limited benefit from higher patterns
                    matrix[i][j] = 0.3 - (i - j) * 0.05

        return matrix

    def add_experience(self, experience: Dict[str, Any], priority: float = 1.0):
        """Add experience to appropriate difficulty buffer"""
        difficulty = experience.get("difficulty", 5)
        difficulty = max(1, min(10, int(difficulty * 10)))  # Convert 0-1 to 1-10

        # Add to difficulty-specific buffer
        self.level_buffers[difficulty].append(
            {**experience, "priority": priority, "timestamp": time.time()}
        )

        # If it's a loss, analyze and store pattern
        if experience.get("outcome") == "loss" and experience.get("lossPattern"):
            self._process_loss_pattern(experience, difficulty)

    def _process_loss_pattern(self, experience: Dict[str, Any], difficulty: int):
        """Process and store loss pattern for cross-level learning"""
        loss_pattern = experience["lossPattern"]
        pattern_type = loss_pattern["type"]

        # Create difficulty-specific pattern
        diff_pattern = DifficultyPattern(
            pattern_type=pattern_type,
            difficulty_level=difficulty,
            board_state=experience["finalBoard"],
            critical_positions=loss_pattern.get("criticalPositions", []),
            defense_moves=self._calculate_defense_moves(loss_pattern),
            confidence=0.9,
            games_encountered=1,
            games_defended=0,
            last_seen=datetime.now(),
        )

        # Store in pattern registry
        self.pattern_registry[difficulty][pattern_type].append(diff_pattern)
        self.metrics["patterns_learned"][f"level_{difficulty}"] += 1

        # Transfer pattern knowledge to higher difficulties
        self._transfer_pattern_knowledge(diff_pattern, difficulty)

    def _calculate_defense_moves(self, loss_pattern: Dict[str, Any]) -> List[int]:
        """Calculate defensive moves for a pattern"""
        defense_moves = []

        # Get columns from critical positions
        for pos in loss_pattern.get("criticalPositions", []):
            if pos["column"] not in defense_moves:
                defense_moves.append(pos["column"])

        # Add adjacent columns for broader defense
        for pos in loss_pattern.get("winningSequence", []):
            col = pos["column"]
            for adj in [col - 1, col + 1]:
                if 0 <= adj < 7 and adj not in defense_moves:
                    defense_moves.append(adj)

        return defense_moves[:3]  # Top 3 defensive moves

    def _transfer_pattern_knowledge(
        self, pattern: DifficultyPattern, source_level: int
    ):
        """Transfer pattern knowledge to other difficulty levels"""
        for target_level in range(1, 11):
            if target_level == source_level:
                continue

            # Calculate transfer factor
            transfer_factor = self.transfer_matrix[source_level - 1][target_level - 1]

            if transfer_factor > 0.3:  # Only transfer if significant
                transferred_pattern = copy.deepcopy(pattern)
                transferred_pattern.difficulty_level = target_level
                transferred_pattern.confidence *= transfer_factor
                transferred_pattern.transfer_factor = transfer_factor

                # Add to pattern transfer buffer
                self.pattern_transfer_buffer.append(
                    {
                        "source_level": source_level,
                        "target_level": target_level,
                        "pattern": asdict(transferred_pattern),
                        "transfer_factor": transfer_factor,
                    }
                )

                # Update target level's pattern registry
                self.pattern_registry[target_level][pattern.pattern_type].append(
                    transferred_pattern
                )

                self.metrics["patterns_transferred"][
                    f"{source_level}_to_{target_level}"
                ] += 1

    def get_relevant_patterns(
        self, difficulty: int, board_state: List[List[str]]
    ) -> List[DifficultyPattern]:
        """Get patterns relevant to current difficulty and board state"""
        relevant_patterns = []

        # Get patterns for this difficulty
        for pattern_type, patterns in self.pattern_registry[difficulty].items():
            # Sort by confidence and recency
            sorted_patterns = sorted(
                patterns,
                key=lambda p: (p.confidence, -time.mktime(p.last_seen.timetuple())),
                reverse=True,
            )
            relevant_patterns.extend(sorted_patterns[:5])  # Top 5 per pattern type

        return relevant_patterns

    def sample_for_training(
        self, difficulty: int, batch_size: int
    ) -> List[Dict[str, Any]]:
        """Sample experiences for training a specific difficulty model"""
        samples = []

        # 60% from same difficulty
        same_level_size = int(batch_size * 0.6)
        if len(self.level_buffers[difficulty]) >= same_level_size:
            same_level_samples = np.random.choice(
                list(self.level_buffers[difficulty]), same_level_size, replace=False
            )
            samples.extend(same_level_samples)

        # 30% from adjacent difficulties
        adj_size = int(batch_size * 0.3)
        adjacent_samples = []
        for adj_diff in [difficulty - 1, difficulty + 1]:
            if 1 <= adj_diff <= 10 and len(self.level_buffers[adj_diff]) > 0:
                adj_samples = np.random.choice(
                    list(self.level_buffers[adj_diff]),
                    min(adj_size // 2, len(self.level_buffers[adj_diff])),
                    replace=False,
                )
                adjacent_samples.extend(adj_samples)
        samples.extend(adjacent_samples[:adj_size])

        # 10% from pattern transfer buffer
        transfer_size = batch_size - len(samples)
        if len(self.pattern_transfer_buffer) >= transfer_size:
            transfer_samples = np.random.choice(
                list(self.pattern_transfer_buffer), transfer_size, replace=False
            )
            samples.extend(transfer_samples)

        return samples


class MultiModelDifficultyManager:
    """Manages multiple models for different difficulty levels"""

    def __init__(self, base_model_class, model_config: Dict[str, Any]):
        self.model_config = model_config
        self.models = {}

        # Initialize models for each difficulty
        for level in range(1, 11):
            self.models[level] = self._create_model_for_difficulty(
                base_model_class, level
            )

        # Ensemble weights for multi-model predictions
        self.ensemble_weights = self._initialize_ensemble_weights()

        # Model performance tracking
        self.model_performance = defaultdict(
            lambda: {
                "games_played": 0,
                "losses": 0,
                "patterns_defended": defaultdict(int),
                "win_rate": 1.0,
            }
        )

    def _create_model_for_difficulty(self, model_class, difficulty: int):
        """Create a model configured for specific difficulty"""
        config = copy.deepcopy(self.model_config)

        # Adjust model capacity based on difficulty
        if difficulty <= 3:
            # Simpler models for lower difficulties
            config["hidden_size"] = config.get("hidden_size", 128) // 2
            config["num_layers"] = max(2, config.get("num_layers", 4) - 2)
        elif difficulty >= 8:
            # More complex models for higher difficulties
            config["hidden_size"] = int(config.get("hidden_size", 128) * 1.5)
            config["num_layers"] = config.get("num_layers", 4) + 1

        model = model_class(**config)

        # Initialize with difficulty-appropriate weights
        self._initialize_difficulty_weights(model, difficulty)

        return model

    def _initialize_difficulty_weights(self, model, difficulty: int):
        """Initialize model weights based on difficulty"""
        # Lower difficulties have more random/exploratory initialization
        init_std = (
            0.1 - (difficulty - 1) * 0.008
        )  # Less randomness as difficulty increases

        for param in model.parameters():
            if param.dim() > 1:
                nn.init.xavier_normal_(param, gain=init_std)

    def _initialize_ensemble_weights(self) -> Dict[int, List[float]]:
        """Initialize ensemble weights for multi-model predictions"""
        weights = {}

        for level in range(1, 11):
            # Each level uses multiple models with different weights
            if level <= 3:
                # Lower levels primarily use their own model
                weights[level] = [0.8 if i == level - 1 else 0.02 for i in range(10)]
            elif level <= 7:
                # Mid levels blend adjacent models
                weights[level] = [0.0] * 10
                weights[level][level - 1] = 0.6  # Main model
                if level > 1:
                    weights[level][level - 2] = 0.2  # Previous level
                if level < 10:
                    weights[level][level] = 0.2  # Next level
            else:
                # High levels use ensemble of strong models
                weights[level] = [0.0] * 10
                for i in range(max(0, level - 3), level):
                    weights[level][i] = 0.25

        return weights

    def get_ensemble_prediction(
        self,
        board_state: torch.Tensor,
        difficulty: int,
        patterns: List[DifficultyPattern],
    ) -> Dict[str, Any]:
        """Get prediction using ensemble of models with pattern awareness"""
        ensemble_weights = self.ensemble_weights[difficulty]
        predictions = []

        # Collect predictions from relevant models
        for level, weight in enumerate(ensemble_weights, 1):
            if weight > 0:
                model = self.models[level]
                model.eval()

                with torch.no_grad():
                    output = model(board_state)

                    # Apply pattern-based adjustments
                    adjusted_output = self._apply_pattern_knowledge(
                        output, patterns, level, difficulty
                    )

                    predictions.append(
                        {
                            "model_level": level,
                            "weight": weight,
                            "output": adjusted_output,
                            "confidence": torch.max(
                                torch.softmax(adjusted_output, dim=1)
                            ).item(),
                        }
                    )

        # Combine predictions
        final_output = self._combine_predictions(predictions)

        return {
            "prediction": final_output,
            "ensemble_size": len(predictions),
            "pattern_adjustments": len(patterns),
            "difficulty": difficulty,
        }

    def _apply_pattern_knowledge(
        self,
        output: torch.Tensor,
        patterns: List[DifficultyPattern],
        model_level: int,
        current_difficulty: int,
    ) -> torch.Tensor:
        """Adjust model output based on learned patterns"""
        adjusted = output.clone()

        for pattern in patterns:
            # Apply pattern defense with transfer factor
            transfer_factor = self.ensemble_weights[current_difficulty][model_level - 1]

            for defense_move in pattern.defense_moves:
                if defense_move < adjusted.shape[1]:
                    # Boost defensive move probability
                    boost = pattern.confidence * transfer_factor * 0.3
                    adjusted[0, defense_move] += boost

        return adjusted

    def _combine_predictions(self, predictions: List[Dict[str, Any]]) -> torch.Tensor:
        """Combine multiple model predictions using weighted average"""
        if not predictions:
            return None

        # Stack all outputs
        outputs = torch.stack([p["output"] for p in predictions])
        weights = (
            torch.tensor([p["weight"] for p in predictions]).unsqueeze(1).unsqueeze(2)
        )

        # Weighted average
        combined = torch.sum(outputs * weights, dim=0) / torch.sum(weights)

        return combined

    def update_model_performance(self, difficulty: int, game_outcome: Dict[str, Any]):
        """Update performance metrics for difficulty model"""
        perf = self.model_performance[difficulty]
        perf["games_played"] += 1

        if game_outcome["outcome"] == "loss":
            perf["losses"] += 1

            # Track pattern defense failures
            if pattern := game_outcome.get("lossPattern"):
                pattern_type = pattern["type"]
                perf["patterns_defended"][pattern_type] += 1

        # Update win rate
        perf["win_rate"] = 1 - (perf["losses"] / max(1, perf["games_played"]))


class DifficultyAwareContinuousLearning:
    """Main continuous learning system with difficulty awareness"""

    def __init__(
        self, model_manager: MultiModelDifficultyManager, config: Dict[str, Any]
    ):
        self.model_manager = model_manager
        self.config = config

        # Difficulty-aware experience buffer
        self.experience_buffer = DifficultyAwareExperienceBuffer(
            capacity_per_level=config.get("capacity_per_level", 10000)
        )

        # Training configuration per difficulty
        self.training_config = self._initialize_training_config()

        # Learning metrics
        self.learning_metrics = defaultdict(
            lambda: {
                "updates": 0,
                "patterns_learned": defaultdict(int),
                "defense_success_rate": defaultdict(float),
                "last_update": None,
            }
        )

        logger.info("Difficulty-aware continuous learning initialized")

    def _initialize_training_config(self) -> Dict[int, Dict[str, Any]]:
        """Initialize training configuration for each difficulty"""
        configs = {}

        for level in range(1, 11):
            configs[level] = {
                "learning_rate": 0.001
                * (0.9 ** (level - 1)),  # Slower learning at higher levels
                "batch_size": 32 + level * 4,  # Larger batches for higher levels
                "update_frequency": 50
                + level * 10,  # Less frequent updates at higher levels
                "min_games": 20 + level * 5,  # More games required before update
                "pattern_focus_weight": 1.5
                + level * 0.1,  # Stronger pattern focus at higher levels
            }

        return configs

    async def process_game(self, game_data: Dict[str, Any]):
        """Process completed game with difficulty awareness"""
        difficulty = int(game_data.get("difficulty", 0.5) * 10)
        difficulty = max(1, min(10, difficulty))

        # Add to experience buffer
        priority = 2.0 if game_data["outcome"] == "loss" else 1.0
        self.experience_buffer.add_experience(game_data, priority)

        # Update model performance
        self.model_manager.update_model_performance(difficulty, game_data)

        # Check if we should update models
        for level in range(max(1, difficulty - 1), min(11, difficulty + 2)):
            if self._should_update_model(level):
                await self.update_difficulty_model(level)

    def _should_update_model(self, difficulty: int) -> bool:
        """Check if model for difficulty should be updated"""
        config = self.training_config[difficulty]
        buffer_size = len(self.experience_buffer.level_buffers[difficulty])

        if buffer_size < config["min_games"]:
            return False

        metrics = self.learning_metrics[difficulty]
        if metrics["updates"] == 0:
            return True

        # Update based on frequency
        games_since_update = buffer_size - (
            metrics["updates"] * config["update_frequency"]
        )
        return games_since_update >= config["update_frequency"]

    async def update_difficulty_model(self, difficulty: int):
        """Update model for specific difficulty"""
        logger.info(f"Updating model for difficulty {difficulty}")

        config = self.training_config[difficulty]
        model = self.model_manager.models[difficulty]

        # Sample training data
        batch = self.experience_buffer.sample_for_training(
            difficulty, config["batch_size"] * 10  # Larger sample for update
        )

        if not batch:
            return

        # Get relevant patterns for this difficulty
        patterns = self.experience_buffer.get_relevant_patterns(
            difficulty, batch[0].get("finalBoard", [])
        )

        # Train model with pattern awareness
        improvements = await self._train_with_patterns(model, batch, patterns, config)

        # Update metrics
        metrics = self.learning_metrics[difficulty]
        metrics["updates"] += 1
        metrics["last_update"] = datetime.now()

        # Broadcast update
        await self._broadcast_model_update(difficulty, improvements, patterns)

    async def _train_with_patterns(
        self,
        model,
        batch: List[Dict[str, Any]],
        patterns: List[DifficultyPattern],
        config: Dict[str, Any],
    ) -> Dict[str, float]:
        """Train model with pattern-focused learning"""
        model.train()
        optimizer = torch.optim.Adam(model.parameters(), lr=config["learning_rate"])

        improvements = defaultdict(float)

        # Training loop
        for epoch in range(5):
            total_loss = 0
            pattern_defense_loss = 0

            for experience in batch:
                # Standard training
                loss = self._compute_loss(model, experience)

                # Additional loss for pattern defense
                if experience.get("outcome") == "loss" and experience.get(
                    "lossPattern"
                ):
                    pattern_loss = self._compute_pattern_defense_loss(
                        model, experience, patterns, config["pattern_focus_weight"]
                    )
                    loss += pattern_loss
                    pattern_defense_loss += pattern_loss.item()

                optimizer.zero_grad()
                loss.backward()
                optimizer.step()

                total_loss += loss.item()

            # Track improvements
            improvements[f"epoch_{epoch}_loss"] = total_loss / len(batch)
            improvements["pattern_defense_focus"] = pattern_defense_loss / max(
                1, len(batch)
            )

        return dict(improvements)

    def _compute_loss(self, model, experience: Dict[str, Any]) -> torch.Tensor:
        """Compute standard training loss"""
        # Implementation depends on your model architecture
        # This is a placeholder
        return torch.tensor(0.0, requires_grad=True)

    def _compute_pattern_defense_loss(
        self,
        model,
        experience: Dict[str, Any],
        patterns: List[DifficultyPattern],
        weight: float,
    ) -> torch.Tensor:
        """Compute loss focused on pattern defense"""
        # Implementation focuses on defensive moves for patterns
        # This is a placeholder
        return torch.tensor(0.0, requires_grad=True)

    async def _broadcast_model_update(
        self,
        difficulty: int,
        improvements: Dict[str, float],
        patterns: List[DifficultyPattern],
    ):
        """Broadcast model update information"""
        update_info = {
            "type": "difficulty_model_updated",
            "difficulty": difficulty,
            "improvements": improvements,
            "patterns_strengthened": [
                {
                    "type": p.pattern_type,
                    "confidence": p.confidence,
                    "defense_moves": p.defense_moves,
                }
                for p in patterns[:5]  # Top 5 patterns
            ],
            "timestamp": time.time(),
        }

        logger.info(f"Model updated for difficulty {difficulty}: {improvements}")

        # Would broadcast via WebSocket here
        return update_info


# Integration with existing continuous learning system
def create_difficulty_aware_pipeline(
    base_model_class, model_config: Dict[str, Any], learning_config: Dict[str, Any]
):
    """Create a complete difficulty-aware learning pipeline"""

    # Create multi-model manager
    model_manager = MultiModelDifficultyManager(base_model_class, model_config)

    # Create learning system
    learning_system = DifficultyAwareContinuousLearning(model_manager, learning_config)

    return learning_system


if __name__ == "__main__":
    logger.info("Difficulty-aware learning system loaded")
