#!/usr/bin/env python3
"""
Initialize basic models for ML service startup
"""

import os
from pathlib import Path

import torch
import torch.nn as nn


class SimpleNet(nn.Module):
    def __init__(self, input_size=42, hidden_size=128, output_size=7):
        super(SimpleNet, self).__init__()
        self.fc1 = nn.Linear(input_size, hidden_size)
        self.fc2 = nn.Linear(hidden_size, hidden_size // 2)
        self.fc3 = nn.Linear(hidden_size // 2, output_size)
        self.relu = nn.ReLU()
        self.softmax = nn.Softmax(dim=1)

    def forward(self, x):
        x = self.relu(self.fc1(x))
        x = self.relu(self.fc2(x))
        x = self.fc3(x)
        return self.softmax(x)


def initialize_models():
    """Create basic models if they don't exist"""
    models_dir = Path(__file__).parent / "models"
    models_dir.mkdir(exist_ok=True)

    # Create policy network
    policy_path = models_dir / "policy_net.pt"
    if not policy_path.exists():
        print("Creating policy_net.pt...")
        policy_net = SimpleNet()
        torch.save(
            {
                "model_state_dict": policy_net.state_dict(),
                "model_type": "policy",
                "version": "1.0.0",
            },
            policy_path,
        )
        print("✅ Created policy_net.pt")

    # Create value network
    value_path = models_dir / "value_net.pt"
    if not value_path.exists():
        print("Creating value_net.pt...")
        value_net = SimpleNet(output_size=1)  # Single output for value
        torch.save(
            {
                "model_state_dict": value_net.state_dict(),
                "model_type": "value",
                "version": "1.0.0",
            },
            value_path,
        )
        print("✅ Created value_net.pt")

    # Create difficulty-specific models
    if os.environ.get("ENABLE_DIFFICULTY_AWARE_LEARNING") == "true":
        model_count = int(os.environ.get("DIFFICULTY_MODELS_COUNT", "10"))
        for level in range(1, model_count + 1):
            level_path = models_dir / f"model_difficulty_{level}.pt"
            if not level_path.exists():
                print(f"Creating model_difficulty_{level}.pt...")
                level_net = SimpleNet()
                torch.save(
                    {
                        "model_state_dict": level_net.state_dict(),
                        "model_type": "difficulty",
                        "difficulty_level": level,
                        "version": "1.0.0",
                    },
                    level_path,
                )
                print(f"✅ Created model_difficulty_{level}.pt")


if __name__ == "__main__":
    initialize_models()
    print("\n🎉 All models initialized successfully!")
