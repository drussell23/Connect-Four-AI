#!/usr/bin/env python3
"""
AlphaZero-style Self-Play Training for Connect Four
====================================================

Run locally on your Mac to improve the AI model:

    cd ml_service
    python self_play_train.py

This script:
1. Loads the current policy network
2. Plays games against itself using MCTS + neural net guidance
3. Trains the model on self-play data
4. Saves the improved model
5. Repeats for multiple iterations

Each iteration the AI gets stronger by learning from its own games.
"""

import copy
import math
import os
import random
import sys
import time
from pathlib import Path
from typing import List, Optional, Tuple

import torch
import torch.nn as nn
import torch.nn.functional as F

# Add parent dir to path for imports
sys.path.insert(0, str(Path(__file__).parent))
from src.policy_net import Connect4PolicyNet

# ─── Game Constants ───────────────────────────────────────────────────────────
ROWS = 6
COLS = 7
EMPTY = 0
PLAYER1 = 1  # "Red" - first mover
PLAYER2 = -1  # "Yellow" - AI


# ─── Connect Four Game Logic ─────────────────────────────────────────────────
class Connect4:
    """Fast Connect Four game state."""

    def __init__(self):
        self.board = [[EMPTY] * COLS for _ in range(ROWS)]
        self.current_player = PLAYER1
        self.move_count = 0

    def copy(self) -> "Connect4":
        g = Connect4()
        g.board = [row[:] for row in self.board]
        g.current_player = self.current_player
        g.move_count = self.move_count
        return g

    def valid_moves(self) -> List[int]:
        return [c for c in range(COLS) if self.board[0][c] == EMPTY]

    def drop(self, col: int) -> int:
        """Drop a piece in column. Returns the row it landed on, or -1."""
        for r in range(ROWS - 1, -1, -1):
            if self.board[r][col] == EMPTY:
                self.board[r][col] = self.current_player
                self.move_count += 1
                landed_row = r
                self.current_player *= -1
                return landed_row
        return -1

    def check_win(self, row: int, col: int) -> bool:
        """Check if the piece at (row, col) is part of a 4-in-a-row."""
        player = self.board[row][col]
        if player == EMPTY:
            return False
        directions = [(0, 1), (1, 0), (1, 1), (1, -1)]
        for dr, dc in directions:
            count = 1
            for sign in [1, -1]:
                r, c = row + dr * sign, col + dc * sign
                while 0 <= r < ROWS and 0 <= c < COLS and self.board[r][c] == player:
                    count += 1
                    r += dr * sign
                    c += dc * sign
            if count >= 4:
                return True
        return False

    def is_draw(self) -> bool:
        return self.move_count >= ROWS * COLS

    def to_tensor(self, perspective: int) -> torch.Tensor:
        """Convert board to 2-channel tensor from a player's perspective.
        Channel 0: current player's pieces, Channel 1: opponent's pieces."""
        mine = [[0.0] * COLS for _ in range(ROWS)]
        theirs = [[0.0] * COLS for _ in range(ROWS)]
        for r in range(ROWS):
            for c in range(COLS):
                if self.board[r][c] == perspective:
                    mine[r][c] = 1.0
                elif self.board[r][c] == -perspective:
                    theirs[r][c] = 1.0
        return torch.tensor([mine, theirs], dtype=torch.float32).unsqueeze(0)


# ─── MCTS ─────────────────────────────────────────────────────────────────────
class MCTSNode:
    __slots__ = ["parent", "action", "prior", "visit_count", "value_sum", "children"]

    def __init__(self, parent: Optional["MCTSNode"], action: int, prior: float):
        self.parent = parent
        self.action = action
        self.prior = prior
        self.visit_count = 0
        self.value_sum = 0.0
        self.children: List[MCTSNode] = []

    def q_value(self) -> float:
        if self.visit_count == 0:
            return 0.0
        return self.value_sum / self.visit_count

    def ucb_score(self, c_puct: float) -> float:
        parent_visits = self.parent.visit_count if self.parent else 1
        exploration = c_puct * self.prior * math.sqrt(parent_visits) / (1 + self.visit_count)
        return self.q_value() + exploration

    def is_leaf(self) -> bool:
        return len(self.children) == 0


def mcts_search(
    game: Connect4,
    model: nn.Module,
    num_simulations: int,
    c_puct: float = 1.5,
    device: torch.device = torch.device("cpu"),
) -> List[float]:
    """Run MCTS and return visit-count-based policy for the current position."""
    root = MCTSNode(parent=None, action=-1, prior=1.0)

    # Expand root
    _expand_node(root, game, model, device)

    for _ in range(num_simulations):
        node = root
        sim_game = game.copy()

        # SELECT: walk down tree using UCB
        while not node.is_leaf():
            best = max(node.children, key=lambda n: n.ucb_score(c_puct))
            row = sim_game.drop(best.action)
            node = best

            # Terminal check
            if row >= 0 and sim_game.check_win(row, best.action):
                # The player who just moved won — that's sim_game.current_player * -1
                _backpropagate(node, -1.0)  # Loss for current player at this node
                break
            if sim_game.is_draw():
                _backpropagate(node, 0.0)
                break
        else:
            # EXPAND & EVALUATE
            value = _expand_node(node, sim_game, model, device)
            _backpropagate(node, value)

    # Build policy from visit counts
    total_visits = sum(c.visit_count for c in root.children)
    if total_visits == 0:
        valid = game.valid_moves()
        return [1.0 / len(valid) if c in valid else 0.0 for c in range(COLS)]

    policy = [0.0] * COLS
    for child in root.children:
        policy[child.action] = child.visit_count / total_visits
    return policy


def _expand_node(
    node: MCTSNode,
    game: Connect4,
    model: nn.Module,
    device: torch.device,
) -> float:
    """Expand a leaf node using the neural network. Returns value estimate."""
    valid_moves = game.valid_moves()
    if not valid_moves:
        return 0.0  # Draw

    board_tensor = game.to_tensor(game.current_player).to(device)

    with torch.no_grad():
        logits = model(board_tensor)[0]  # (7,)
        probs = F.softmax(logits, dim=0).cpu().numpy()

        # Value estimate from value head
        try:
            value = model.get_value_estimate(board_tensor)
        except Exception:
            value = 0.0

    # Mask invalid moves and renormalize
    for c in range(COLS):
        if c not in valid_moves:
            probs[c] = 0.0
    prob_sum = probs.sum()
    if prob_sum > 0:
        probs /= prob_sum
    else:
        probs = [1.0 / len(valid_moves) if c in valid_moves else 0.0 for c in range(COLS)]

    # Create children
    for col in valid_moves:
        child = MCTSNode(parent=node, action=col, prior=float(probs[col]))
        node.children.append(child)

    return value


def _backpropagate(node: MCTSNode, value: float):
    """Propagate value back up the tree, flipping sign at each level."""
    while node is not None:
        node.visit_count += 1
        node.value_sum += value
        value = -value  # Flip for opponent
        node = node.parent


# ─── Self-Play ────────────────────────────────────────────────────────────────
def play_one_game(
    model: nn.Module,
    num_simulations: int = 100,
    temperature: float = 1.0,
    temp_threshold: int = 12,
    device: torch.device = torch.device("cpu"),
) -> List[Tuple[torch.Tensor, List[float], int]]:
    """Play a full game of self-play. Returns list of (board_tensor, policy, outcome)."""
    game = Connect4()
    history = []  # (board_tensor, mcts_policy, player_at_that_turn)

    while True:
        # Run MCTS from current position
        policy = mcts_search(game, model, num_simulations, device=device)

        # Store training data (from current player's perspective)
        board_tensor = game.to_tensor(game.current_player)
        history.append((board_tensor, policy, game.current_player))

        # Select move
        if game.move_count < temp_threshold and temperature > 0:
            # Sample proportional to visit counts (with temperature)
            adjusted = [p ** (1.0 / temperature) for p in policy]
            total = sum(adjusted)
            adjusted = [p / total for p in adjusted]
            col = random.choices(range(COLS), weights=adjusted, k=1)[0]
        else:
            # Greedy
            col = max(range(COLS), key=lambda c: policy[c])

        row = game.drop(col)

        # Check terminal
        if row >= 0 and game.check_win(row, col):
            winner = -game.current_player  # Player who just moved
            break
        if game.is_draw():
            winner = EMPTY
            break

    # Assign outcomes: +1 if you won, -1 if you lost, 0 if draw
    training_data = []
    for board_tensor, policy, player in history:
        if winner == EMPTY:
            outcome = 0.0
        elif winner == player:
            outcome = 1.0
        else:
            outcome = -1.0
        training_data.append((board_tensor, policy, outcome))

    return training_data


# ─── Training ─────────────────────────────────────────────────────────────────
def train_on_data(
    model: nn.Module,
    training_data: List[Tuple[torch.Tensor, List[float], float]],
    optimizer: torch.optim.Optimizer,
    batch_size: int = 64,
    device: torch.device = torch.device("cpu"),
) -> dict:
    """Train the model on self-play data. Returns loss metrics."""
    random.shuffle(training_data)
    model.train()

    total_policy_loss = 0.0
    total_value_loss = 0.0
    num_batches = 0

    for i in range(0, len(training_data), batch_size):
        batch = training_data[i : i + batch_size]
        if len(batch) < 4:
            continue

        boards = torch.cat([b for b, _, _ in batch], dim=0).to(device)
        target_policies = torch.tensor([p for _, p, _ in batch], dtype=torch.float32).to(device)
        target_values = torch.tensor([[v] for _, _, v in batch], dtype=torch.float32).to(device)

        # Forward pass — policy
        policy_logits = model(boards)
        log_probs = F.log_softmax(policy_logits, dim=1)
        policy_loss = -(target_policies * log_probs).sum(dim=1).mean()

        # Forward pass — value
        # Get value from the value head
        features = model.input_conv(boards)
        features = model.input_bn(features)
        features = F.relu(features)
        for block in model.residual_blocks:
            features = block(features)
        value = model.value_conv(features)
        value = model.value_bn(value)
        value = F.relu(value)
        value = value.view(value.size(0), -1)
        value = model.dropout(value)
        value = F.relu(model.value_fc1(value))
        value = torch.tanh(model.value_fc2(value))

        value_loss = F.mse_loss(value, target_values)

        # Combined loss
        loss = policy_loss + value_loss

        optimizer.zero_grad()
        loss.backward()
        torch.nn.utils.clip_grad_norm_(model.parameters(), max_norm=1.0)
        optimizer.step()

        total_policy_loss += policy_loss.item()
        total_value_loss += value_loss.item()
        num_batches += 1

    model.eval()

    if num_batches == 0:
        return {"policy_loss": 0, "value_loss": 0, "batches": 0}

    return {
        "policy_loss": total_policy_loss / num_batches,
        "value_loss": total_value_loss / num_batches,
        "batches": num_batches,
    }


# ─── Evaluation ───────────────────────────────────────────────────────────────
def evaluate_models(
    model_a: nn.Module,
    model_b: nn.Module,
    num_games: int = 20,
    num_simulations: int = 50,
    device: torch.device = torch.device("cpu"),
) -> dict:
    """Play model_a vs model_b and return win rates."""
    wins_a, wins_b, draws = 0, 0, 0

    for game_idx in range(num_games):
        game = Connect4()
        # Alternate who goes first
        models = {PLAYER1: model_a, PLAYER2: model_b} if game_idx % 2 == 0 else {PLAYER1: model_b, PLAYER2: model_a}
        a_player = PLAYER1 if game_idx % 2 == 0 else PLAYER2

        while True:
            current_model = models[game.current_player]
            policy = mcts_search(game, current_model, num_simulations, device=device)
            col = max(range(COLS), key=lambda c: policy[c])
            row = game.drop(col)

            if row >= 0 and game.check_win(row, col):
                winner = -game.current_player
                if winner == a_player:
                    wins_a += 1
                else:
                    wins_b += 1
                break
            if game.is_draw():
                draws += 1
                break

    return {
        "new_wins": wins_a,
        "old_wins": wins_b,
        "draws": draws,
        "new_win_rate": wins_a / num_games,
    }


# ─── Main Training Loop ──────────────────────────────────────────────────────
def main():
    # Configuration
    NUM_ITERATIONS = 10       # Training iterations
    GAMES_PER_ITERATION = 50  # Self-play games per iteration
    MCTS_SIMULATIONS = 100    # MCTS simulations per move
    EVAL_GAMES = 20           # Evaluation games between old and new model
    BATCH_SIZE = 64
    LEARNING_RATE = 1e-3
    TEMPERATURE = 1.0
    TEMP_THRESHOLD = 12       # Switch to greedy after this many moves
    WIN_THRESHOLD = 0.55      # New model must win >55% to replace old

    # Paths
    model_dir = Path(__file__).parent / "models"
    model_path = model_dir / "policy_net.pt"
    best_model_path = model_dir / "best_policy_net.pt"

    # Device
    if torch.backends.mps.is_available():
        device = torch.device("mps")  # Apple Silicon GPU
        print(f"Using Apple Silicon GPU (MPS)")
    elif torch.cuda.is_available():
        device = torch.device("cuda")
        print(f"Using CUDA GPU")
    else:
        device = torch.device("cpu")
        print(f"Using CPU")

    # Load or create model
    model = Connect4PolicyNet()
    if model_path.exists():
        model.load_state_dict(torch.load(model_path, map_location="cpu", weights_only=True))
        print(f"Loaded existing model from {model_path}")
    else:
        print("Starting with fresh model")
    model = model.to(device)
    model.eval()

    # Keep a copy of the best model for evaluation
    best_model = Connect4PolicyNet()
    best_model.load_state_dict(model.state_dict())
    best_model = best_model.to(device)
    best_model.eval()

    optimizer = torch.optim.Adam(model.parameters(), lr=LEARNING_RATE, weight_decay=1e-4)

    print(f"\n{'='*60}")
    print(f"  AlphaZero Self-Play Training for Connect Four")
    print(f"{'='*60}")
    print(f"  Iterations:      {NUM_ITERATIONS}")
    print(f"  Games/iteration: {GAMES_PER_ITERATION}")
    print(f"  MCTS sims/move:  {MCTS_SIMULATIONS}")
    print(f"  Device:          {device}")
    print(f"  Model params:    {sum(p.numel() for p in model.parameters()):,}")
    print(f"{'='*60}\n")

    all_training_data = []

    for iteration in range(1, NUM_ITERATIONS + 1):
        iter_start = time.time()
        print(f"\n--- Iteration {iteration}/{NUM_ITERATIONS} ---")

        # Phase 1: Self-play
        print(f"  Self-play: generating {GAMES_PER_ITERATION} games...")
        iteration_data = []
        outcomes = {"p1_wins": 0, "p2_wins": 0, "draws": 0}

        for g in range(GAMES_PER_ITERATION):
            game_data = play_one_game(
                model,
                num_simulations=MCTS_SIMULATIONS,
                temperature=TEMPERATURE,
                temp_threshold=TEMP_THRESHOLD,
                device=device,
            )
            iteration_data.extend(game_data)

            # Track outcomes
            if game_data:
                final_outcome = game_data[-1][2]
                if final_outcome > 0:
                    outcomes["p1_wins"] += 1
                elif final_outcome < 0:
                    outcomes["p2_wins"] += 1
                else:
                    outcomes["draws"] += 1

            if (g + 1) % 10 == 0:
                elapsed = time.time() - iter_start
                rate = (g + 1) / elapsed
                print(f"    Game {g+1}/{GAMES_PER_ITERATION} ({rate:.1f} games/sec)")

        print(f"  Self-play done: {len(iteration_data)} positions, "
              f"P1 wins={outcomes['p1_wins']}, P2 wins={outcomes['p2_wins']}, "
              f"Draws={outcomes['draws']}")

        # Keep a sliding window of training data
        all_training_data.extend(iteration_data)
        max_buffer = GAMES_PER_ITERATION * 42 * 3  # ~3 iterations worth
        if len(all_training_data) > max_buffer:
            all_training_data = all_training_data[-max_buffer:]

        # Phase 2: Training
        print(f"  Training on {len(all_training_data)} positions...")
        metrics = train_on_data(model, all_training_data, optimizer, BATCH_SIZE, device)
        print(f"  Loss: policy={metrics['policy_loss']:.4f}, "
              f"value={metrics['value_loss']:.4f} ({metrics['batches']} batches)")

        # Phase 3: Evaluation against previous best
        print(f"  Evaluating new model vs best model ({EVAL_GAMES} games)...")
        eval_result = evaluate_models(model, best_model, EVAL_GAMES, MCTS_SIMULATIONS // 2, device)
        print(f"  Result: new={eval_result['new_wins']}, "
              f"old={eval_result['old_wins']}, draws={eval_result['draws']} "
              f"(win rate: {eval_result['new_win_rate']:.1%})")

        # Phase 4: Model selection
        if eval_result["new_win_rate"] >= WIN_THRESHOLD:
            print(f"  New model accepted! Saving as best model.")
            best_model.load_state_dict(model.state_dict())
            torch.save(model.state_dict(), best_model_path)
            torch.save(model.state_dict(), model_path)
        else:
            print(f"  New model rejected (below {WIN_THRESHOLD:.0%} threshold). Keeping best.")
            # Revert to best model but continue training from it
            model.load_state_dict(best_model.state_dict())

        iter_time = time.time() - iter_start
        print(f"  Iteration time: {iter_time:.0f}s")

    # Final save
    torch.save(best_model.state_dict(), model_path)
    torch.save(best_model.state_dict(), best_model_path)

    # Also copy to the repo root models/ directory
    root_models = Path(__file__).parent.parent / "models"
    if root_models.exists():
        torch.save(best_model.state_dict(), root_models / "best_policy_net.pt")
        torch.save(best_model.state_dict(), root_models / "current_policy_net.pt")
        print(f"\nModel also saved to {root_models}/")

    print(f"\nTraining complete! Best model saved to {model_path}")
    print(f"Deploy by pushing to GitHub and restarting the Render ML service.")


if __name__ == "__main__":
    main()
