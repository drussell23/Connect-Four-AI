"""
🧠 CONNECT4 NEURAL NETWORK ARCHITECTURE
========================================

Neural network implementation for Connect Four game intelligence.
Simplified but robust architecture that focuses on compatibility.
"""

import math
from typing import Any, Dict, List, Optional, Tuple

import torch
import torch.nn as nn
import torch.nn.functional as F


class Connect4PolicyNet(nn.Module):
    """
    Connect4 Policy Network for game move prediction

    A robust neural network architecture for Connect Four that:
    - Takes board state as input (2x6x7 tensor)
    - Outputs move probabilities for 7 columns
    - Uses convolutional layers for spatial feature extraction
    - Includes residual connections for better training
    """

    def __init__(
        self, input_channels: int = 2, hidden_channels: int = 128, num_blocks: int = 4
    ):
        super().__init__()

        # Input processing
        self.input_conv = nn.Conv2d(input_channels, hidden_channels, 3, padding=1)
        self.input_bn = nn.BatchNorm2d(hidden_channels)

        # Residual blocks
        self.residual_blocks = nn.ModuleList(
            [ResidualBlock(hidden_channels) for _ in range(num_blocks)]
        )

        # Policy head
        self.policy_conv = nn.Conv2d(hidden_channels, 32, 1)
        self.policy_bn = nn.BatchNorm2d(32)
        self.policy_fc = nn.Linear(32 * 6 * 7, 7)  # 7 columns

        # Value head (optional)
        self.value_conv = nn.Conv2d(hidden_channels, 16, 1)
        self.value_bn = nn.BatchNorm2d(16)
        self.value_fc1 = nn.Linear(16 * 6 * 7, 128)
        self.value_fc2 = nn.Linear(128, 1)

        self.dropout = nn.Dropout(0.1)

        # Initialize weights
        self._initialize_weights()

    def _initialize_weights(self):
        """Initialize network weights"""
        for module in self.modules():
            if isinstance(module, nn.Conv2d):
                nn.init.kaiming_normal_(
                    module.weight, mode="fan_out", nonlinearity="relu"
                )
                if module.bias is not None:
                    nn.init.constant_(module.bias, 0)
            elif isinstance(module, nn.BatchNorm2d):
                nn.init.constant_(module.weight, 1)
                nn.init.constant_(module.bias, 0)
            elif isinstance(module, nn.Linear):
                nn.init.normal_(module.weight, 0, 0.01)
                nn.init.constant_(module.bias, 0)

    def forward(self, x: torch.Tensor) -> torch.Tensor:
        """
        Forward pass

        Args:
            x: Input tensor of shape (batch_size, 2, 6, 7)

        Returns:
            Policy logits of shape (batch_size, 7)
        """
        # Input processing
        x = self.input_conv(x)
        x = self.input_bn(x)
        x = F.relu(x)

        # Residual blocks
        for block in self.residual_blocks:
            x = block(x)

        # Policy head
        policy = self.policy_conv(x)
        policy = self.policy_bn(policy)
        policy = F.relu(policy)
        policy = policy.view(policy.size(0), -1)
        policy = self.dropout(policy)
        policy_logits = self.policy_fc(policy)

        return policy_logits

    def predict(self, x: torch.Tensor) -> Tuple[int, List[float]]:
        """
        Make a prediction and return best move with probabilities

        Args:
            x: Input tensor of shape (batch_size, 2, 6, 7)

        Returns:
            Tuple of (best_move, move_probabilities)
        """
        self.eval()
        with torch.no_grad():
            logits = self.forward(x)
            probs = F.softmax(logits, dim=1)

            if len(probs.shape) > 1:
                probs = probs[0]  # Remove batch dimension

            best_move = int(torch.argmax(probs).item())  # Ensure int conversion
            prob_list = probs.cpu().tolist()

            return best_move, prob_list

    def get_value_estimate(self, x: torch.Tensor) -> float:
        """
        Get position value estimate

        Args:
            x: Input tensor of shape (batch_size, 2, 6, 7)

        Returns:
            Value estimate between -1 and 1
        """
        self.eval()
        with torch.no_grad():
            # Input processing
            features = self.input_conv(x)
            features = self.input_bn(features)
            features = F.relu(features)

            # Residual blocks
            for block in self.residual_blocks:
                features = block(features)

            # Value head
            value = self.value_conv(features)
            value = self.value_bn(value)
            value = F.relu(value)
            value = value.view(value.size(0), -1)
            value = self.dropout(value)
            value = F.relu(self.value_fc1(value))
            value = torch.tanh(self.value_fc2(value))

            return value[0].item() if len(value) > 0 else 0.0


class ResidualBlock(nn.Module):
    """Residual block for the policy network"""

    def __init__(self, channels: int):
        super().__init__()
        self.conv1 = nn.Conv2d(channels, channels, 3, padding=1, bias=False)
        self.bn1 = nn.BatchNorm2d(channels)
        self.conv2 = nn.Conv2d(channels, channels, 3, padding=1, bias=False)
        self.bn2 = nn.BatchNorm2d(channels)

    def forward(self, x: torch.Tensor) -> torch.Tensor:
        identity = x

        out = self.conv1(x)
        out = self.bn1(out)
        out = F.relu(out)

        out = self.conv2(out)
        out = self.bn2(out)

        out += identity
        out = F.relu(out)

        return out


class AdvancedConnect4PolicyNet(nn.Module):
    """
    Advanced Connect4 Policy Network with additional features

    This version includes:
    - Attention mechanisms
    - Uncertainty estimation
    - Multiple output heads
    """

    def __init__(
        self,
        input_channels: int = 2,
        base_channels: int = 128,
        num_residual_blocks: int = 8,
        use_attention: bool = True,
        enable_uncertainty: bool = True,
    ):
        super().__init__()

        self.enable_uncertainty = enable_uncertainty
        self.use_attention = use_attention

        # Input processing
        self.input_conv = nn.Conv2d(input_channels, base_channels, 3, padding=1)
        self.input_bn = nn.BatchNorm2d(base_channels)

        # Residual blocks
        self.residual_blocks = nn.ModuleList(
            [
                AdvancedResidualBlock(
                    base_channels, use_attention=(i >= num_residual_blocks - 2)
                )
                for i in range(num_residual_blocks)
            ]
        )

        # Policy head
        self.policy_conv = nn.Conv2d(base_channels, 32, 1)
        self.policy_bn = nn.BatchNorm2d(32)
        self.policy_fc = nn.Linear(32 * 6 * 7, 7)

        # Value head
        self.value_conv = nn.Conv2d(base_channels, 16, 1)
        self.value_bn = nn.BatchNorm2d(16)
        self.value_fc1 = nn.Linear(16 * 6 * 7, 128)
        self.value_fc2 = nn.Linear(128, 1)

        # Uncertainty head
        if enable_uncertainty:
            self.uncertainty_conv = nn.Conv2d(base_channels, 8, 1)
            self.uncertainty_bn = nn.BatchNorm2d(8)
            self.uncertainty_fc = nn.Linear(8 * 6 * 7, 7)

        self.dropout = nn.Dropout(0.1)
        self._initialize_weights()

    def _initialize_weights(self):
        """Initialize network weights"""
        for module in self.modules():
            if isinstance(module, nn.Conv2d):
                nn.init.kaiming_normal_(
                    module.weight, mode="fan_out", nonlinearity="relu"
                )
                if module.bias is not None:
                    nn.init.constant_(module.bias, 0)
            elif isinstance(module, nn.BatchNorm2d):
                nn.init.constant_(module.weight, 1)
                nn.init.constant_(module.bias, 0)
            elif isinstance(module, nn.Linear):
                nn.init.normal_(module.weight, 0, 0.01)
                nn.init.constant_(module.bias, 0)

    def forward(self, x: torch.Tensor) -> Dict[str, torch.Tensor]:
        """
        Forward pass returning multiple outputs

        Args:
            x: Input tensor of shape (batch_size, 2, 6, 7)

        Returns:
            Dictionary with keys: policy, value, uncertainty (if enabled)
        """
        # Input processing
        x = self.input_conv(x)
        x = self.input_bn(x)
        x = F.relu(x)

        # Residual blocks
        for block in self.residual_blocks:
            x = block(x)

        # Policy head
        policy = self.policy_conv(x)
        policy = self.policy_bn(policy)
        policy = F.relu(policy)
        policy = policy.view(policy.size(0), -1)
        policy = self.dropout(policy)
        policy_logits = self.policy_fc(policy)

        # Value head
        value = self.value_conv(x)
        value = self.value_bn(value)
        value = F.relu(value)
        value = value.view(value.size(0), -1)
        value = self.dropout(value)
        value = F.relu(self.value_fc1(value))
        value = torch.tanh(self.value_fc2(value))

        outputs = {
            "policy": F.softmax(policy_logits, dim=1),
            "policy_logits": policy_logits,
            "value": value,
        }

        # Uncertainty estimation
        if self.enable_uncertainty:
            uncertainty = self.uncertainty_conv(x)
            uncertainty = self.uncertainty_bn(uncertainty)
            uncertainty = F.relu(uncertainty)
            uncertainty = uncertainty.view(uncertainty.size(0), -1)
            uncertainty = self.dropout(uncertainty)
            uncertainty = torch.sigmoid(self.uncertainty_fc(uncertainty))
            outputs["uncertainty"] = uncertainty

        return outputs


class AdvancedResidualBlock(nn.Module):
    """Advanced residual block with optional attention"""

    def __init__(self, channels: int, use_attention: bool = False):
        super().__init__()
        self.use_attention = use_attention

        # Main pathway
        self.conv1 = nn.Conv2d(channels, channels, 3, padding=1, bias=False)
        self.bn1 = nn.BatchNorm2d(channels)
        self.conv2 = nn.Conv2d(channels, channels, 3, padding=1, bias=False)
        self.bn2 = nn.BatchNorm2d(channels)

        # Simple attention mechanism
        if use_attention:
            self.attention = nn.Sequential(
                nn.Conv2d(channels, channels // 4, 1),
                nn.ReLU(),
                nn.Conv2d(channels // 4, channels, 1),
                nn.Sigmoid(),
            )

        self.dropout = nn.Dropout2d(0.1)

    def forward(self, x: torch.Tensor) -> torch.Tensor:
        identity = x

        out = self.conv1(x)
        out = self.bn1(out)
        out = F.relu(out)
        out = self.dropout(out)

        out = self.conv2(out)
        out = self.bn2(out)

        # Apply attention if enabled
        if self.use_attention:
            att_weights = self.attention(out)
            out = out * att_weights

        out += identity
        out = F.relu(out)

        return out


# Factory functions for different model configurations
def create_lightweight_model() -> Connect4PolicyNet:
    """Create a lightweight model for fast inference"""
    return Connect4PolicyNet(hidden_channels=64, num_blocks=2)


def create_standard_model() -> Connect4PolicyNet:
    """Create a standard model for balanced performance"""
    return Connect4PolicyNet(hidden_channels=128, num_blocks=4)


def create_heavyweight_model() -> AdvancedConnect4PolicyNet:
    """Create a heavyweight model for maximum performance"""
    return AdvancedConnect4PolicyNet(
        base_channels=256,
        num_residual_blocks=12,
        use_attention=True,
        enable_uncertainty=True,
    )


def create_legacy_model() -> Connect4PolicyNet:
    """Create a legacy model for backward compatibility"""
    return Connect4PolicyNet(hidden_channels=64, num_blocks=2)


# Model registry
MODEL_REGISTRY = {
    "lightweight": create_lightweight_model,
    "standard": create_standard_model,
    "heavyweight": create_heavyweight_model,
    "legacy": create_legacy_model,
}


def get_model(model_type: str = "standard") -> nn.Module:
    """
    Factory function to create models by name

    Args:
        model_type: One of 'lightweight', 'standard', 'heavyweight', 'legacy'

    Returns:
        Instantiated model
    """
    if model_type not in MODEL_REGISTRY:
        raise ValueError(
            f"Unknown model type: {model_type}. Available: {list(MODEL_REGISTRY.keys())}"
        )

    return MODEL_REGISTRY[model_type]()


def get_available_models() -> List[str]:
    """Get list of available model types"""
    return list(MODEL_REGISTRY.keys())


def get_model_info() -> Dict[str, Dict[str, Any]]:
    """Get information about available models"""
    return {
        "lightweight": {
            "description": "Fast inference model with reduced parameters",
            "channels": 64,
            "blocks": 2,
            "attention": False,
            "uncertainty": False,
        },
        "standard": {
            "description": "Balanced model for general use",
            "channels": 128,
            "blocks": 4,
            "attention": False,
            "uncertainty": False,
        },
        "heavyweight": {
            "description": "Maximum performance model with all features",
            "channels": 256,
            "blocks": 12,
            "attention": True,
            "uncertainty": True,
        },
        "legacy": {
            "description": "Simple model for backward compatibility",
            "channels": 64,
            "blocks": 2,
            "attention": False,
            "uncertainty": False,
        },
    }
