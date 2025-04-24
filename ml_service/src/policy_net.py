import torch  
import torch.nn as nn  
import torch.nn.functional as F  

class ResidualBlock(nn.Module):
    """
    A basic residual block: Conv-BN-ReLU-Conv-BN with a skip connection.
    """
    def __init__(self, channels: int):
        super().__init__()
        self.conv1 = nn.Conv2d(channels, channels, kernel_size=3, padding=1, bias=False)
        self.bn1 = nn.BatchNorm2d(channels)
        self.conv2 = nn.Conv2d(channels, channels, kernel_size=3, padding=1, bias=False)
        self.bn2 = nn.BatchNorm2d(channels)

    def forward(self, x: torch.Tensor) -> torch.Tensor:
        identity = x
        out = self.bn1(self.conv1(x))
        out = F.relu(out)
        out = self.bn2(self.conv2(out))
        out += identity
        return F.relu(out)

class Connect4PolicyNet(nn.Module):
    """
    Advanced Convolutional Policy Network for Connect Four.
    - Uses 2-channel input (Red layer, Yellow layer)
    - Multiple residual blocks for deep feature extraction
    - Global average pooling to condense spatial features
    - Fully-connected layers with dropout for final move logits
    """
    def __init__(self):
        super().__init__()
        # Input channels: 2 (Red pieces, Yellow pieces), Board size: 6x7
        self.conv_in = nn.Conv2d(2, 64, kernel_size=3, padding=1, bias=False)
        self.bn_in = nn.BatchNorm2d(64)

        # Stack of residual blocks
        blocks = [ResidualBlock(64) for _ in range(4)]
        self.res_blocks = nn.Sequential(*blocks)

        # Global pooling and fully connected head
        self.global_pool = nn.AdaptiveAvgPool2d((1, 1))
        self.fc1 = nn.Linear(64, 128)
        self.dropout = nn.Dropout(0.3)
        self.fc2 = nn.Linear(128, 7)  # 7 output logits for columns

    def forward(self, x: torch.Tensor) -> torch.Tensor:
        """
        Forward pass.
        :param x: Tensor of shape (batch_size, 2, 6, 7)
        :return: Logits of shape (batch_size, 7)
        """
        x = self.conv_in(x)
        x = self.bn_in(x)
        x = F.relu(x)
        x = self.res_blocks(x)
        x = self.global_pool(x)
        x = x.view(x.size(0), -1)  # flatten to (batch_size, 64)
        x = F.relu(self.fc1(x))
        x = self.dropout(x)
        logits = self.fc2(x)
        return logits
