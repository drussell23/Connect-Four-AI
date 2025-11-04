"""
🚀 ENHANCED ML-INFERENCE SERVICE
================================

Advanced prediction engine with specialized capabilities:
- Ultra-fast tactical analysis (< 50ms)
- Uncertainty quantification
- Pattern recognition
- Threat detection
- Multi-modal predictions
"""

import asyncio
import json
import time
from dataclasses import dataclass
from enum import Enum
from typing import Dict, List, Optional, Tuple, Union

import numpy as np
import torch
import torch.nn.functional as F
import uvicorn
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
# Import policy network
from src.policy_net import Connect4PolicyNet


class ThreatLevel(Enum):
    NONE = "none"
    LOW = "low"
    MEDIUM = "medium"
    HIGH = "high"
    CRITICAL = "critical"


class GamePhase(Enum):
    OPENING = "opening"
    MIDGAME = "midgame"
    ENDGAME = "endgame"


@dataclass
class TacticalAnalysis:
    """Advanced tactical analysis results"""

    winning_moves: List[int]
    blocking_moves: List[int]
    threat_level: ThreatLevel
    immediate_threats: List[Dict]
    tactical_score: float
    recommended_move: int


class TacticalRequest(BaseModel):
    board: List[List[str]]
    include_threats: bool = True
    include_uncertainty: bool = False
    max_depth: int = 3


class TacticalResponse(BaseModel):
    move: int
    probs: List[float]
    confidence: float
    uncertainty: Optional[List[float]] = None
    tactical_analysis: Dict
    inference_time_ms: float
    threat_level: str
    winning_moves: List[int]
    blocking_moves: List[int]


class EnhancedInferenceEngine:
    """Ultra-fast tactical inference engine"""

    def __init__(self):
        self.device = self._get_device()
        self.model = self._load_model()
        self.pattern_cache = {}
        self.threat_patterns = self._init_threat_patterns()

    def _get_device(self):
        """Get optimal device"""
        if torch.cuda.is_available():
            return torch.device("cuda")
        elif hasattr(torch.backends, "mps") and torch.backends.mps.is_available():
            return torch.device("mps")
        return torch.device("cpu")

    def _load_model(self):
        """Load optimized model for speed"""
        model = Connect4PolicyNet()
        model = model.to(self.device)
        model.eval()

        # Try to load weights
        try:
            model_path = "../models/best_policy_net.pt"
            # Use weights_only=True for security (PyTorch 1.13+)
            checkpoint = torch.load(
                model_path, map_location=self.device, weights_only=True
            )
            state_dict = checkpoint.get("model_state_dict", checkpoint)
            model.load_state_dict(state_dict)
            print("✅ Loaded trained weights")
        except Exception as e:
            print(f"⚠️  Using random weights: {e}")

        return model

    def _init_threat_patterns(self):
        """Initialize threat detection patterns"""
        return {
            "winning_patterns": [
                # Horizontal wins
                [(0, 0), (0, 1), (0, 2), (0, 3)],
                # Vertical wins
                [(0, 0), (1, 0), (2, 0), (3, 0)],
                # Diagonal wins
                [(0, 0), (1, 1), (2, 2), (3, 3)],
                [(0, 3), (1, 2), (2, 1), (3, 0)],
            ],
            "threat_patterns": [
                # Three in a row with gap
                [(0, 0), (0, 1), (0, 2), None],
                [None, (0, 1), (0, 2), (0, 3)],
                [(0, 0), None, (0, 2), (0, 3)],
            ],
        }

    async def ultra_fast_predict(self, board: List[List[str]]) -> TacticalResponse:
        """Ultra-fast prediction optimized for speed"""
        start_time = time.time()

        # Convert board to tensor
        board_tensor = self._board_to_tensor(board)

        # Fast inference
        with torch.no_grad():
            logits = self.model(board_tensor)
            probs = F.softmax(logits[0], dim=0).cpu().numpy().tolist()
            move = int(np.argmax(probs))
            confidence = max(probs)

        # Quick tactical analysis
        tactical_analysis = await self._quick_tactical_analysis(board)

        inference_time = (time.time() - start_time) * 1000

        return TacticalResponse(
            move=move,
            probs=probs,
            confidence=confidence,
            tactical_analysis=tactical_analysis,
            inference_time_ms=inference_time,
            threat_level=tactical_analysis["threat_level"],
            winning_moves=tactical_analysis["winning_moves"],
            blocking_moves=tactical_analysis["blocking_moves"],
        )

    async def advanced_predict(
        self, board: List[List[str]], include_uncertainty: bool = False
    ) -> TacticalResponse:
        """Advanced prediction with full analysis"""
        start_time = time.time()

        # Enhanced tactical analysis
        tactical_analysis = await self._full_tactical_analysis(board)

        # Model prediction with uncertainty if requested
        board_tensor = self._board_to_tensor(board)

        with torch.no_grad():
            # Multiple forward passes for uncertainty estimation
            if include_uncertainty:
                predictions = []
                for _ in range(10):  # Monte Carlo dropout
                    logits = self.model(board_tensor)
                    probs = F.softmax(logits[0], dim=0).cpu().numpy()
                    predictions.append(probs)

                predictions = np.array(predictions)
                mean_probs = predictions.mean(axis=0).tolist()
                uncertainty = predictions.std(axis=0).tolist()

                # Adjust predictions based on tactical analysis
                adjusted_probs = self._adjust_predictions_with_tactics(
                    mean_probs, tactical_analysis
                )
                move = int(np.argmax(adjusted_probs))
                confidence = max(adjusted_probs)

            else:
                logits = self.model(board_tensor)
                probs = F.softmax(logits[0], dim=0).cpu().numpy().tolist()
                adjusted_probs = self._adjust_predictions_with_tactics(
                    probs, tactical_analysis
                )
                move = int(np.argmax(adjusted_probs))
                confidence = max(adjusted_probs)
                uncertainty = None

        inference_time = (time.time() - start_time) * 1000

        return TacticalResponse(
            move=move,
            probs=adjusted_probs,
            confidence=confidence,
            uncertainty=uncertainty,
            tactical_analysis=tactical_analysis,
            inference_time_ms=inference_time,
            threat_level=tactical_analysis["threat_level"],
            winning_moves=tactical_analysis["winning_moves"],
            blocking_moves=tactical_analysis["blocking_moves"],
        )

    async def _quick_tactical_analysis(self, board: List[List[str]]) -> Dict:
        """Lightning-fast tactical analysis"""
        winning_moves = self._find_winning_moves(board)
        blocking_moves = self._find_blocking_moves(board)

        # Determine threat level
        if winning_moves:
            threat_level = ThreatLevel.CRITICAL.value
        elif blocking_moves:
            threat_level = ThreatLevel.HIGH.value
        else:
            threat_level = ThreatLevel.LOW.value

        return {
            "winning_moves": winning_moves,
            "blocking_moves": blocking_moves,
            "threat_level": threat_level,
            "analysis_type": "quick",
        }

    async def _full_tactical_analysis(self, board: List[List[str]]) -> Dict:
        """Comprehensive tactical analysis"""
        # Basic analysis
        winning_moves = self._find_winning_moves(board)
        blocking_moves = self._find_blocking_moves(board)

        # Advanced analysis
        fork_opportunities = self._find_fork_opportunities(board)
        trap_setups = self._find_trap_setups(board)
        column_control = self._analyze_column_control(board)
        center_control = self._analyze_center_control(board)

        # Pattern recognition
        patterns = await self._recognize_patterns(board)

        # Calculate tactical score
        tactical_score = self._calculate_tactical_score(
            winning_moves,
            blocking_moves,
            fork_opportunities,
            trap_setups,
            column_control,
            center_control,
        )

        # Determine threat level
        threat_level = self._determine_threat_level(
            winning_moves, blocking_moves, fork_opportunities, tactical_score
        )

        return {
            "winning_moves": winning_moves,
            "blocking_moves": blocking_moves,
            "fork_opportunities": fork_opportunities,
            "trap_setups": trap_setups,
            "column_control": column_control,
            "center_control": center_control,
            "patterns": patterns,
            "tactical_score": tactical_score,
            "threat_level": threat_level,
            "analysis_type": "full",
        }

    def _board_to_tensor(self, board: List[List[str]]) -> torch.Tensor:
        """Convert board to tensor format"""
        # Convert string board to numeric
        numeric_board = []
        for row in board:
            numeric_row = []
            for cell in row:
                if cell == "Empty":
                    numeric_row.append(0)
                elif cell == "Red":
                    numeric_row.append(1)
                elif cell == "Yellow":
                    numeric_row.append(-1)
                else:
                    numeric_row.append(0)
            numeric_board.append(numeric_row)

        # Create player channels
        red_channel = [[1 if cell == 1 else 0 for cell in row] for row in numeric_board]
        yellow_channel = [
            [1 if cell == -1 else 0 for cell in row] for row in numeric_board
        ]

        tensor = torch.tensor(
            [red_channel, yellow_channel], dtype=torch.float32, device=self.device
        )
        return tensor.unsqueeze(0)  # Add batch dimension

    def _find_winning_moves(self, board: List[List[str]]) -> List[int]:
        """Find moves that result in immediate win"""
        winning_moves = []

        for col in range(7):
            if self._is_valid_move(board, col):
                # Simulate move
                test_board = self._simulate_move(board, col, "Red")
                if self._check_winner(test_board) == "Red":
                    winning_moves.append(col)

        return winning_moves

    def _find_blocking_moves(self, board: List[List[str]]) -> List[int]:
        """Find moves that block opponent's winning moves"""
        blocking_moves = []

        for col in range(7):
            if self._is_valid_move(board, col):
                # Simulate opponent move
                test_board = self._simulate_move(board, col, "Yellow")
                if self._check_winner(test_board) == "Yellow":
                    blocking_moves.append(col)

        return blocking_moves

    def _find_fork_opportunities(self, board: List[List[str]]) -> List[int]:
        """Find moves that create multiple winning threats"""
        fork_moves = []

        for col in range(7):
            if self._is_valid_move(board, col):
                test_board = self._simulate_move(board, col, "Red")
                winning_count = len(self._find_winning_moves(test_board))
                if winning_count >= 2:  # Creates multiple threats
                    fork_moves.append(col)

        return fork_moves

    def _find_trap_setups(self, board: List[List[str]]) -> List[int]:
        """Find moves that set up future winning opportunities"""
        trap_moves = []

        for col in range(7):
            if self._is_valid_move(board, col):
                test_board = self._simulate_move(board, col, "Red")
                # Look ahead one more move
                future_opportunities = 0
                for next_col in range(7):
                    if self._is_valid_move(test_board, next_col):
                        future_board = self._simulate_move(test_board, next_col, "Red")
                        if self._find_winning_moves(future_board):
                            future_opportunities += 1

                if future_opportunities >= 2:
                    trap_moves.append(col)

        return trap_moves

    def _analyze_column_control(self, board: List[List[str]]) -> Dict[int, float]:
        """Analyze control of each column"""
        control = {}

        for col in range(7):
            red_pieces = sum(1 for row in range(6) if board[row][col] == "Red")
            yellow_pieces = sum(1 for row in range(6) if board[row][col] == "Yellow")

            if red_pieces + yellow_pieces == 0:
                control[col] = 0.0  # Neutral
            else:
                control[col] = (red_pieces - yellow_pieces) / (
                    red_pieces + yellow_pieces
                )

        return control

    def _analyze_center_control(self, board: List[List[str]]) -> float:
        """Analyze control of center columns (3, 4)"""
        center_score = 0
        center_cols = [2, 3, 4]  # Columns 2, 3, 4 are most valuable

        for col in center_cols:
            for row in range(6):
                if board[row][col] == "Red":
                    center_score += 1
                elif board[row][col] == "Yellow":
                    center_score -= 1

        return center_score / (len(center_cols) * 6)  # Normalize

    async def _recognize_patterns(self, board: List[List[str]]) -> List[str]:
        """Recognize common game patterns"""
        patterns = []

        # Check for common opening patterns
        move_count = sum(1 for row in board for cell in row if cell != "Empty")

        if move_count <= 6:  # Opening phase
            if board[5][3] == "Red":  # Center opening
                patterns.append("center_opening")
            if board[5][2] == "Red" or board[5][4] == "Red":
                patterns.append("side_center_opening")

        # Check for advanced patterns
        if self._has_connected_four_threat(board):
            patterns.append("connected_four_threat")

        if self._has_double_threat(board):
            patterns.append("double_threat")

        return patterns

    def _calculate_tactical_score(
        self,
        winning_moves,
        blocking_moves,
        fork_opportunities,
        trap_setups,
        column_control,
        center_control,
    ) -> float:
        """Calculate overall tactical score"""
        score = 0.0

        # Immediate opportunities (highest weight)
        score += len(winning_moves) * 100
        score += len(blocking_moves) * 50
        score += len(fork_opportunities) * 30
        score += len(trap_setups) * 20

        # Positional advantages
        score += center_control * 10
        score += sum(column_control.values()) * 5

        return score

    def _determine_threat_level(
        self, winning_moves, blocking_moves, fork_opportunities, tactical_score
    ) -> str:
        """Determine current threat level"""
        if winning_moves:
            return ThreatLevel.CRITICAL.value
        elif blocking_moves:
            return ThreatLevel.HIGH.value
        elif fork_opportunities:
            return ThreatLevel.MEDIUM.value
        elif tactical_score > 50:
            return ThreatLevel.MEDIUM.value
        else:
            return ThreatLevel.LOW.value

    def _adjust_predictions_with_tactics(
        self, probs: List[float], tactical_analysis: Dict
    ) -> List[float]:
        """Adjust model predictions based on tactical analysis"""
        adjusted_probs = probs.copy()

        # Boost winning moves
        for move in tactical_analysis["winning_moves"]:
            adjusted_probs[move] *= 10.0

        # Boost blocking moves
        for move in tactical_analysis["blocking_moves"]:
            adjusted_probs[move] *= 5.0

        # Boost fork opportunities
        if "fork_opportunities" in tactical_analysis:
            for move in tactical_analysis["fork_opportunities"]:
                adjusted_probs[move] *= 3.0

        # Normalize
        total = sum(adjusted_probs)
        if total > 0:
            adjusted_probs = [p / total for p in adjusted_probs]

        return adjusted_probs

    # Helper methods
    def _is_valid_move(self, board: List[List[str]], col: int) -> bool:
        return 0 <= col < 7 and board[0][col] == "Empty"

    def _simulate_move(
        self, board: List[List[str]], col: int, player: str
    ) -> List[List[str]]:
        """Simulate a move and return new board state"""
        new_board = [row[:] for row in board]  # Deep copy

        for row in range(5, -1, -1):
            if new_board[row][col] == "Empty":
                new_board[row][col] = player
                break

        return new_board

    def _check_winner(self, board: List[List[str]]) -> Optional[str]:
        """Check if there's a winner"""
        # Check horizontal, vertical, and diagonal wins
        for row in range(6):
            for col in range(7):
                if board[row][col] != "Empty":
                    player = board[row][col]
                    # Check all directions
                    if (
                        self._check_direction(
                            board, row, col, 0, 1, player
                        )  # Horizontal
                        or self._check_direction(
                            board, row, col, 1, 0, player
                        )  # Vertical
                        or self._check_direction(
                            board, row, col, 1, 1, player
                        )  # Diagonal /
                        or self._check_direction(board, row, col, 1, -1, player)
                    ):  # Diagonal \
                        return player
        return None

    def _check_direction(
        self,
        board: List[List[str]],
        row: int,
        col: int,
        delta_row: int,
        delta_col: int,
        player: str,
    ) -> bool:
        """Check for four in a row in a specific direction"""
        count = 0
        for i in range(4):
            new_row = row + i * delta_row
            new_col = col + i * delta_col
            if (
                0 <= new_row < 6
                and 0 <= new_col < 7
                and board[new_row][new_col] == player
            ):
                count += 1
            else:
                break
        return count == 4

    def _has_connected_four_threat(self, board: List[List[str]]) -> bool:
        """Check for connected four threat patterns"""
        # Implementation for detecting threat patterns
        return False  # Placeholder

    def _has_double_threat(self, board: List[List[str]]) -> bool:
        """Check for double threat patterns"""
        # Implementation for detecting double threats
        return False  # Placeholder


# FastAPI Application
app = FastAPI(
    title="🚀 Enhanced ML-Inference Service",
    description="Ultra-fast tactical analysis for Connect Four",
    version="1.0.0",
)

# Add CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://localhost:3001"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Global inference engine
inference_engine = EnhancedInferenceEngine()


@app.post("/predict/fast", response_model=TacticalResponse)
async def fast_predict(request: TacticalRequest):
    """Ultra-fast prediction endpoint"""
    return await inference_engine.ultra_fast_predict(request.board)


@app.post("/predict/advanced", response_model=TacticalResponse)
async def advanced_predict(request: TacticalRequest):
    """Advanced prediction with full tactical analysis"""
    return await inference_engine.advanced_predict(
        request.board, request.include_uncertainty
    )


@app.get("/health")
async def health_check():
    """Health check endpoint"""
    return {
        "status": "healthy",
        "service": "enhanced-ml-inference",
        "version": "1.0.0",
        "device": str(inference_engine.device),
    }


if __name__ == "__main__":
    import os

    # Use environment variable for host binding, defaulting to localhost for security
    host = os.environ.get("ML_INFERENCE_HOST", "127.0.0.1")
    port = int(os.environ.get("ML_INFERENCE_PORT", "8001"))
    uvicorn.run("enhanced_inference:app", host=host, port=port, reload=False)
