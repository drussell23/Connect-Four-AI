"""
🔧 INTEGRATION MODULE FOR DIFFICULTY-AWARE LEARNING
==================================================

Integrates the difficulty-aware learning system with the existing ML service
and continuous learning pipeline.
"""

import asyncio
import logging
from typing import Any, Dict, Optional

import numpy as np
import torch
from continuous_learning import ContinuousLearningPipeline
from difficulty_aware_learning import (DifficultyAwareContinuousLearning,
                                       DifficultyAwareExperienceBuffer,
                                       MultiModelDifficultyManager,
                                       create_difficulty_aware_pipeline)

logger = logging.getLogger(__name__)


class IntegratedDifficultyLearningPipeline(ContinuousLearningPipeline):
    """Enhanced continuous learning pipeline with difficulty awareness"""

    def __init__(self, model_manager, config: Dict[str, Any]):
        # Initialize base continuous learning
        super().__init__(model_manager, config)

        # Create difficulty-aware components
        self.difficulty_buffer = DifficultyAwareExperienceBuffer(
            capacity_per_level=config.get("capacity_per_level", 10000)
        )

        # Get base model class from existing model
        base_model = model_manager.models.get("standard")
        if base_model:
            base_model_class = type(base_model)
            model_config = {
                "input_channels": 2,
                "board_height": 6,
                "board_width": 7,
                "hidden_size": 128,
                "num_layers": 4,
            }
        else:
            raise ValueError("No base model found in model manager")

        # Create multi-model manager
        self.multi_model_manager = MultiModelDifficultyManager(
            base_model_class, model_config
        )

        # Create difficulty-aware learning system
        self.difficulty_learning = DifficultyAwareContinuousLearning(
            self.multi_model_manager, config
        )

        # Override metrics to include difficulty tracking
        self.metrics["difficulty_metrics"] = {
            f"level_{i}": {
                "games": 0,
                "losses": 0,
                "patterns_learned": 0,
                "model_updates": 0,
            }
            for i in range(1, 11)
        }

        logger.info("Integrated difficulty-aware learning pipeline initialized")

    async def process_game_outcome(self, game_data: Dict[str, Any]):
        """Process game with difficulty awareness"""
        # Extract difficulty
        difficulty = game_data.get("difficulty", 0.5)
        difficulty_level = max(1, min(10, int(difficulty * 10)))

        # Log to both systems for transition period
        await super().process_game_outcome(game_data)

        # Process with difficulty awareness
        await self.difficulty_learning.process_game(game_data)

        # Update difficulty-specific metrics
        diff_metrics = self.metrics["difficulty_metrics"][f"level_{difficulty_level}"]
        diff_metrics["games"] += 1

        if game_data.get("outcome") == "loss":
            diff_metrics["losses"] += 1

            # Handle difficulty-specific pattern learning
            if game_data.get("difficultyContext"):
                await self._handle_difficulty_pattern(game_data, difficulty_level)

    async def _handle_difficulty_pattern(
        self, game_data: Dict[str, Any], difficulty_level: int
    ):
        """Handle pattern learning with difficulty context"""
        context = game_data["difficultyContext"]

        if context.get("transferToHigherLevels"):
            # Ensure higher levels learn from this pattern
            logger.info(
                f"Transferring pattern from level {difficulty_level} to higher levels"
            )

            # Add to difficulty buffer with transfer instructions
            self.difficulty_buffer.add_experience(game_data, priority=2.0)

            # Update metrics
            self.metrics["difficulty_metrics"][f"level_{difficulty_level}"][
                "patterns_learned"
            ] += 1

    async def get_model_for_difficulty(self, difficulty: float) -> Any:
        """Get appropriate model(s) for difficulty level"""
        difficulty_level = max(1, min(10, int(difficulty * 10)))

        # Get relevant patterns for this difficulty
        patterns = self.difficulty_buffer.get_relevant_patterns(
            difficulty_level, []  # Would pass current board state
        )

        # Return ensemble prediction capability
        return {
            "difficulty_level": difficulty_level,
            "primary_model": self.multi_model_manager.models[difficulty_level],
            "ensemble_models": self._get_ensemble_models(difficulty_level),
            "patterns": patterns,
            "predict_fn": lambda board: self._ensemble_predict(
                board, difficulty_level, patterns
            ),
        }

    def _get_ensemble_models(self, difficulty_level: int) -> Dict[int, Any]:
        """Get models that contribute to ensemble for this difficulty"""
        ensemble_weights = self.multi_model_manager.ensemble_weights[difficulty_level]
        ensemble_models = {}

        for level, weight in enumerate(ensemble_weights, 1):
            if weight > 0:
                ensemble_models[level] = {
                    "model": self.multi_model_manager.models[level],
                    "weight": weight,
                }

        return ensemble_models

    async def _ensemble_predict(
        self, board_tensor: torch.Tensor, difficulty_level: int, patterns: list
    ) -> Dict[str, Any]:
        """Make ensemble prediction with pattern awareness"""
        result = self.multi_model_manager.get_ensemble_prediction(
            board_tensor, difficulty_level, patterns
        )

        return {
            "move_probabilities": result["prediction"],
            "best_move": torch.argmax(result["prediction"]).item(),
            "ensemble_size": result["ensemble_size"],
            "pattern_adjustments": result["pattern_adjustments"],
            "difficulty": difficulty_level,
        }

    async def force_model_update_for_difficulty(self, difficulty: int):
        """Force model update for specific difficulty"""
        await self.difficulty_learning.update_difficulty_model(difficulty)

        # Update metrics
        self.metrics["difficulty_metrics"][f"level_{difficulty}"]["model_updates"] += 1

    def get_difficulty_aware_metrics(self) -> Dict[str, Any]:
        """Get comprehensive metrics including difficulty breakdown"""
        base_metrics = self.get_metrics()

        # Add difficulty-specific information
        difficulty_summary = {
            "total_games_by_level": {},
            "loss_rates_by_level": {},
            "pattern_defense_by_level": {},
            "cross_level_transfers": 0,
        }

        for level in range(1, 11):
            level_key = f"level_{level}"
            diff_metrics = self.metrics["difficulty_metrics"][level_key]

            difficulty_summary["total_games_by_level"][level] = diff_metrics["games"]

            if diff_metrics["games"] > 0:
                difficulty_summary["loss_rates_by_level"][level] = (
                    diff_metrics["losses"] / diff_metrics["games"]
                )
            else:
                difficulty_summary["loss_rates_by_level"][level] = 0.0

            # Get pattern defense rates from difficulty buffer
            patterns = self.difficulty_buffer.pattern_registry.get(level, {})
            difficulty_summary["pattern_defense_by_level"][level] = {
                pattern_type: len(pattern_list)
                for pattern_type, pattern_list in patterns.items()
            }

        # Count cross-level transfers
        difficulty_summary["cross_level_transfers"] = sum(
            self.difficulty_buffer.metrics["patterns_transferred"].values()
        )

        return {
            **base_metrics,
            "difficulty_breakdown": difficulty_summary,
            "multi_model_status": {
                f"level_{level}": {
                    "model_loaded": level in self.multi_model_manager.models,
                    "performance": self.multi_model_manager.model_performance[level],
                }
                for level in range(1, 11)
            },
        }


async def upgrade_to_difficulty_aware_learning(
    existing_pipeline: ContinuousLearningPipeline, model_manager
) -> IntegratedDifficultyLearningPipeline:
    """Upgrade existing pipeline to difficulty-aware version"""
    logger.info("Upgrading to difficulty-aware learning pipeline...")

    # Create new integrated pipeline
    config = {
        "buffer_capacity": 100000,
        "capacity_per_level": 10000,
        "learning_rate": 0.0001,
        "batch_size": 32,
        "update_frequency": 100,
        "min_games": 50,
        "validation_threshold": 0.95,
    }

    integrated_pipeline = IntegratedDifficultyLearningPipeline(model_manager, config)

    # Transfer existing experience buffer if available
    if hasattr(existing_pipeline, "experience_buffer"):
        logger.info("Transferring existing experiences to difficulty-aware buffer...")

        for experience in existing_pipeline.experience_buffer.buffer:
            integrated_pipeline.difficulty_buffer.add_experience(
                experience, experience.get("priority", 1.0)
            )

    # Transfer metrics
    integrated_pipeline.metrics.update(existing_pipeline.metrics)

    logger.info("Upgrade complete! Difficulty-aware learning is now active")

    return integrated_pipeline


# WebSocket message handlers for difficulty-aware features
async def handle_difficulty_message(
    pipeline: IntegratedDifficultyLearningPipeline, message: Dict[str, Any]
) -> Optional[Dict[str, Any]]:
    """Handle difficulty-specific WebSocket messages"""
    msg_type = message.get("type")

    if msg_type == "get_difficulty_model":
        difficulty = message.get("difficulty", 0.5)
        model_info = await pipeline.get_model_for_difficulty(difficulty)

        return {
            "type": "difficulty_model_info",
            "difficulty": difficulty,
            "difficulty_level": model_info["difficulty_level"],
            "ensemble_size": len(model_info["ensemble_models"]),
            "patterns_available": len(model_info["patterns"]),
        }

    elif msg_type == "force_difficulty_update":
        difficulty_level = message.get("difficulty_level")
        if 1 <= difficulty_level <= 10:
            await pipeline.force_model_update_for_difficulty(difficulty_level)
            return {
                "type": "difficulty_update_complete",
                "difficulty_level": difficulty_level,
            }

    elif msg_type == "get_difficulty_metrics":
        return {
            "type": "difficulty_metrics",
            "data": pipeline.get_difficulty_aware_metrics(),
        }

    return None


if __name__ == "__main__":
    logger.info("Difficulty learning integration module loaded")
