"""
🧠 Connect4 ML Service Core Module
===================================

Machine learning components for Connect Four game intelligence.
"""

__version__ = "2.0.0"
__author__ = "Connect4 AI Team"
__description__ = "ML inference service for Connect Four game intelligence"

# Core neural network exports
from .policy_net import (
    Connect4PolicyNet,
    AdvancedConnect4PolicyNet,
    create_lightweight_model,
    create_standard_model,
    create_heavyweight_model,
    create_legacy_model,
    get_model,
    get_available_models,
    get_model_info,
    ResidualBlock,
    AdvancedResidualBlock,
    MODEL_REGISTRY,
)

# Version and metadata
__all__ = [
    # Core models
    "Connect4PolicyNet",
    "AdvancedConnect4PolicyNet",
    # Model factories
    "create_lightweight_model",
    "create_standard_model",
    "create_heavyweight_model",
    "create_legacy_model",
    "get_model",
    "get_available_models",
    "get_model_info",
    # Components
    "ResidualBlock",
    "AdvancedResidualBlock",
    "MODEL_REGISTRY",
    # Metadata
    "__version__",
    "__author__",
    "__description__",
]
