#!/usr/bin/env python3
"""
AlphaZero Self-Play Training for Connect Four
==============================================

Usage:
    python self_play_train.py                      # Default settings
    python self_play_train.py --iterations 20      # More iterations
    python self_play_train.py --games 100 --sims 200  # Harder training
    python self_play_train.py --workers 4          # Parallel self-play
    python self_play_train.py --fast                # Quick test run

All settings configurable via CLI args or environment variables.
"""

import argparse
import math
import os
import random
import sys
import time
from concurrent.futures import ProcessPoolExecutor, as_completed
from dataclasses import dataclass, field
from pathlib import Path
from typing import Dict, List, Optional, Tuple

import torch
import torch.nn as nn
import torch.nn.functional as F

# ─── Model Architecture (matches saved weights exactly) ──────────────────────

class ResBlock(nn.Module):
    """Residual block matching the trained model's architecture."""
    def __init__(self, channels: int):
        super().__init__()
        self.conv1 = nn.Conv2d(channels, channels, 3, padding=1, bias=False)
        self.bn1 = nn.BatchNorm2d(channels)
        self.conv2 = nn.Conv2d(channels, channels, 3, padding=1, bias=False)
        self.bn2 = nn.BatchNorm2d(channels)

    def forward(self, x: torch.Tensor) -> torch.Tensor:
        identity = x
        out = F.relu(self.bn1(self.conv1(x)))
        out = self.bn2(self.conv2(out))
        return F.relu(out + identity)


class Connect4Net(nn.Module):
    """
    Connect Four neural network with policy and value heads.

    Auto-detects architecture from saved weights or creates fresh model.
    Supports both the legacy format (conv_in/res_blocks/fc1/fc2) and
    the new format with explicit value head.
    """

    def __init__(self, channels: int = 64, num_blocks: int = 4):
        super().__init__()
        self.channels = channels

        # Feature extraction
        self.conv_in = nn.Conv2d(2, channels, 3, padding=1, bias=False)
        self.bn_in = nn.BatchNorm2d(channels)
        self.res_blocks = nn.ModuleList([ResBlock(channels) for _ in range(num_blocks)])

        # Policy head (move selection)
        self.fc1 = nn.Linear(channels, 128)
        self.fc2 = nn.Linear(128, 7)

        # Value head (position evaluation)
        self.value_fc1 = nn.Linear(channels, 64)
        self.value_fc2 = nn.Linear(64, 1)

        self._init_weights()

    def _init_weights(self):
        for m in self.modules():
            if isinstance(m, nn.Conv2d):
                nn.init.kaiming_normal_(m.weight, mode="fan_out", nonlinearity="relu")
            elif isinstance(m, nn.BatchNorm2d):
                nn.init.constant_(m.weight, 1)
                nn.init.constant_(m.bias, 0)
            elif isinstance(m, nn.Linear):
                nn.init.kaiming_normal_(m.weight, nonlinearity="relu")
                nn.init.constant_(m.bias, 0)

    def _features(self, x: torch.Tensor) -> torch.Tensor:
        x = F.relu(self.bn_in(self.conv_in(x)))
        for block in self.res_blocks:
            x = block(x)
        return F.adaptive_avg_pool2d(x, 1).view(x.size(0), -1)

    def forward(self, x: torch.Tensor) -> torch.Tensor:
        """Returns policy logits (7,)."""
        feat = self._features(x)
        return self.fc2(F.relu(self.fc1(feat)))

    def forward_both(self, x: torch.Tensor) -> Tuple[torch.Tensor, torch.Tensor]:
        """Returns (policy_logits, value) for training."""
        feat = self._features(x)
        policy = self.fc2(F.relu(self.fc1(feat)))
        value = torch.tanh(self.value_fc2(F.relu(self.value_fc1(feat))))
        return policy, value

    def get_value(self, x: torch.Tensor) -> float:
        with torch.no_grad():
            feat = self._features(x)
            return torch.tanh(self.value_fc2(F.relu(self.value_fc1(feat)))).item()


def load_model(path: Path, device: torch.device) -> Connect4Net:
    """Load a model, auto-detecting architecture from the state dict."""
    if not path.exists():
        print(f"  No model found at {path}, starting fresh")
        model = Connect4Net()
        return model.to(device)

    state_dict = torch.load(path, map_location="cpu", weights_only=True)

    # Detect channel count from conv_in weight shape
    if "conv_in.weight" in state_dict:
        channels = state_dict["conv_in.weight"].shape[0]
    elif "input_conv.weight" in state_dict:
        channels = state_dict["input_conv.weight"].shape[0]
    else:
        channels = 64

    # Detect block count
    block_count = 0
    while f"res_blocks.{block_count}.conv1.weight" in state_dict:
        block_count += 1
    if block_count == 0:
        # Try alternate naming
        while f"residual_blocks.{block_count}.conv1.weight" in state_dict:
            block_count += 1
    if block_count == 0:
        block_count = 4

    print(f"  Detected architecture: {channels} channels, {block_count} res blocks")
    model = Connect4Net(channels=channels, num_blocks=block_count)

    # Load compatible weights, skip mismatched
    model_keys = set(model.state_dict().keys())
    loaded = 0
    skipped = 0
    new_state = model.state_dict()

    for key, tensor in state_dict.items():
        if key in model_keys and new_state[key].shape == tensor.shape:
            new_state[key] = tensor
            loaded += 1
        else:
            skipped += 1

    model.load_state_dict(new_state)
    print(f"  Loaded {loaded} weight tensors, initialized {skipped} fresh")
    return model.to(device)


# ─── Game Engine ──────────────────────────────────────────────────────────────

ROWS, COLS = 6, 7
EMPTY, P1, P2 = 0, 1, -1


@dataclass
class GameState:
    """Compact, fast Connect Four state."""
    board: list = field(default_factory=lambda: [0] * 42)
    heights: list = field(default_factory=lambda: [0] * 7)  # pieces per column
    current: int = P1
    moves: int = 0
    last_row: int = -1
    last_col: int = -1

    def copy(self) -> "GameState":
        g = GameState()
        g.board = self.board[:]
        g.heights = self.heights[:]
        g.current = self.current
        g.moves = self.moves
        g.last_row = self.last_row
        g.last_col = self.last_col
        return g

    def valid_moves(self) -> List[int]:
        return [c for c in range(COLS) if self.heights[c] < ROWS]

    def drop(self, col: int) -> bool:
        """Drop piece, return True if move was valid."""
        if self.heights[col] >= ROWS:
            return False
        row = ROWS - 1 - self.heights[col]
        self.board[row * COLS + col] = self.current
        self.heights[col] += 1
        self.last_row = row
        self.last_col = col
        self.moves += 1
        self.current *= -1
        return True

    def check_win(self) -> bool:
        """Check if the last move created a 4-in-a-row."""
        r, c = self.last_row, self.last_col
        if r < 0:
            return False
        player = self.board[r * COLS + c]
        if player == EMPTY:
            return False
        for dr, dc in [(0, 1), (1, 0), (1, 1), (1, -1)]:
            count = 1
            for sign in (1, -1):
                nr, nc = r + dr * sign, c + dc * sign
                while 0 <= nr < ROWS and 0 <= nc < COLS and self.board[nr * COLS + nc] == player:
                    count += 1
                    nr += dr * sign
                    nc += dc * sign
            if count >= 4:
                return True
        return False

    def is_terminal(self) -> bool:
        return self.check_win() or self.moves >= 42

    def to_tensor(self, perspective: int) -> torch.Tensor:
        """2-channel tensor: [my_pieces, opponent_pieces]."""
        mine = [0.0] * 42
        theirs = [0.0] * 42
        for i in range(42):
            if self.board[i] == perspective:
                mine[i] = 1.0
            elif self.board[i] == -perspective:
                theirs[i] = 1.0
        t = torch.tensor([mine, theirs], dtype=torch.float32).view(1, 2, ROWS, COLS)
        return t


# ─── MCTS ─────────────────────────────────────────────────────────────────────

class Node:
    __slots__ = ("parent", "action", "prior", "visits", "value_sum", "children")

    def __init__(self, parent: Optional["Node"], action: int, prior: float):
        self.parent = parent
        self.action = action
        self.prior = prior
        self.visits = 0
        self.value_sum = 0.0
        self.children: Optional[List["Node"]] = None

    def q(self) -> float:
        return self.value_sum / self.visits if self.visits > 0 else 0.0

    def ucb(self, c_puct: float) -> float:
        parent_n = self.parent.visits if self.parent else 1
        return self.q() + c_puct * self.prior * math.sqrt(parent_n) / (1 + self.visits)

    def select_child(self, c_puct: float) -> "Node":
        return max(self.children, key=lambda n: n.ucb(c_puct))

    def is_leaf(self) -> bool:
        return self.children is None


def run_mcts(
    game: GameState,
    model: nn.Module,
    num_sims: int,
    c_puct: float,
    device: torch.device,
    add_noise: bool = True,
    noise_alpha: float = 0.3,
    noise_frac: float = 0.25,
) -> List[float]:
    """MCTS search returning visit-count policy."""
    root = Node(None, -1, 1.0)
    _expand(root, game, model, device)

    # Add Dirichlet noise at root for exploration
    if add_noise and root.children:
        noise = torch.distributions.Dirichlet(
            torch.full((len(root.children),), noise_alpha)
        ).sample().tolist()
        for child, n in zip(root.children, noise):
            child.prior = (1 - noise_frac) * child.prior + noise_frac * n

    for _ in range(num_sims):
        node = root
        sim = game.copy()

        # Select
        while not node.is_leaf():
            node = node.select_child(c_puct)
            sim.drop(node.action)
            if sim.check_win():
                _backprop(node, -1.0)
                break
            if sim.moves >= 42:
                _backprop(node, 0.0)
                break
        else:
            # Expand & evaluate
            if sim.is_terminal():
                _backprop(node, 0.0)
            else:
                value = _expand(node, sim, model, device)
                _backprop(node, value)

    # Extract policy
    policy = [0.0] * COLS
    if root.children:
        total = sum(c.visits for c in root.children)
        if total > 0:
            for c in root.children:
                policy[c.action] = c.visits / total
    return policy


def _expand(node: Node, game: GameState, model: nn.Module, device: torch.device) -> float:
    """Expand leaf, return value estimate."""
    valid = game.valid_moves()
    if not valid:
        return 0.0

    tensor = game.to_tensor(game.current).to(device)
    with torch.no_grad():
        logits = model(tensor)[0].cpu()
        try:
            value = model.get_value(tensor)
        except Exception:
            value = 0.0

    # Mask and normalize
    probs = F.softmax(logits, dim=0).numpy()
    mask = [1.0 if c in valid else 0.0 for c in range(COLS)]
    probs = probs * mask
    s = probs.sum()
    if s > 0:
        probs /= s
    else:
        probs = [m / sum(mask) for m in mask]

    node.children = [Node(node, col, float(probs[col])) for col in valid]
    return value


def _backprop(node: Node, value: float):
    while node is not None:
        node.visits += 1
        node.value_sum += value
        value = -value
        node = node.parent


# ─── Self-Play Worker ─────────────────────────────────────────────────────────

def _self_play_worker(args: tuple) -> List[Tuple[list, list, float]]:
    """Worker function for parallel self-play. Returns serializable data."""
    model_state, num_games, num_sims, c_puct, temperature, temp_drop, channels, num_blocks = args

    # Reconstruct model in this process
    device = torch.device("cpu")  # Workers use CPU for safety
    model = Connect4Net(channels=channels, num_blocks=num_blocks)
    model.load_state_dict(model_state)
    model.to(device)
    model.eval()

    all_data = []

    for _ in range(num_games):
        game = GameState()
        history = []

        while not game.is_terminal():
            policy = run_mcts(
                game, model, num_sims, c_puct, device,
                add_noise=True,
            )
            tensor_data = game.to_tensor(game.current).squeeze(0).tolist()
            history.append((tensor_data, policy, game.current))

            # Temperature-based move selection
            if game.moves < temp_drop and temperature > 0:
                adj = [p ** (1.0 / max(temperature, 0.01)) for p in policy]
                total = sum(adj)
                adj = [p / total for p in adj]
                col = random.choices(range(COLS), weights=adj, k=1)[0]
            else:
                col = max(range(COLS), key=lambda c: policy[c])

            game.drop(col)

        # Determine winner
        winner = 0
        if game.check_win():
            winner = -game.current  # current already flipped after last drop

        for tensor_data, policy, player in history:
            if winner == 0:
                outcome = 0.0
            elif winner == player:
                outcome = 1.0
            else:
                outcome = -1.0
            all_data.append((tensor_data, policy, outcome))

    return all_data


# ─── Training ─────────────────────────────────────────────────────────────────

def train_step(
    model: Connect4Net,
    data: List[Tuple[list, list, float]],
    optimizer: torch.optim.Optimizer,
    batch_size: int,
    device: torch.device,
) -> Dict[str, float]:
    """Train on self-play data. Returns loss metrics."""
    random.shuffle(data)
    model.train()

    total_policy_loss = 0.0
    total_value_loss = 0.0
    batches = 0

    for i in range(0, len(data), batch_size):
        batch = data[i: i + batch_size]
        if len(batch) < 2:
            continue

        boards = torch.tensor([b for b, _, _ in batch], dtype=torch.float32).to(device)
        target_pi = torch.tensor([p for _, p, _ in batch], dtype=torch.float32).to(device)
        target_v = torch.tensor([[v] for _, _, v in batch], dtype=torch.float32).to(device)

        policy_logits, value = model.forward_both(boards)

        # Policy loss: cross-entropy with MCTS visit distribution
        log_probs = F.log_softmax(policy_logits, dim=1)
        policy_loss = -(target_pi * log_probs).sum(dim=1).mean()

        # Value loss: MSE
        value_loss = F.mse_loss(value, target_v)

        loss = policy_loss + value_loss

        optimizer.zero_grad()
        loss.backward()
        nn.utils.clip_grad_norm_(model.parameters(), max_norm=1.0)
        optimizer.step()

        total_policy_loss += policy_loss.item()
        total_value_loss += value_loss.item()
        batches += 1

    model.eval()

    return {
        "policy_loss": total_policy_loss / max(batches, 1),
        "value_loss": total_value_loss / max(batches, 1),
        "total_loss": (total_policy_loss + total_value_loss) / max(batches, 1),
        "batches": batches,
    }


# ─── Evaluation ───────────────────────────────────────────────────────────────

def evaluate(
    new_model: Connect4Net,
    old_model: Connect4Net,
    num_games: int,
    num_sims: int,
    device: torch.device,
) -> Dict[str, float]:
    """Pit new model vs old model."""
    new_wins, old_wins, draws = 0, 0, 0

    for g in range(num_games):
        game = GameState()
        # Alternate starting player
        models = {P1: new_model, P2: old_model} if g % 2 == 0 else {P1: old_model, P2: new_model}
        new_is = P1 if g % 2 == 0 else P2

        while not game.is_terminal():
            m = models[game.current]
            policy = run_mcts(game, m, num_sims, 1.5, device, add_noise=False)
            col = max(range(COLS), key=lambda c: policy[c])
            game.drop(col)

        if game.check_win():
            winner = -game.current
            if winner == new_is:
                new_wins += 1
            else:
                old_wins += 1
        else:
            draws += 1

    return {
        "new_wins": new_wins,
        "old_wins": old_wins,
        "draws": draws,
        "new_win_rate": new_wins / max(num_games, 1),
    }


# ─── CLI & Config ─────────────────────────────────────────────────────────────

def parse_args() -> argparse.Namespace:
    p = argparse.ArgumentParser(description="AlphaZero self-play training for Connect Four")

    p.add_argument("--iterations", type=int,
                   default=int(os.getenv("TRAIN_ITERATIONS", "10")),
                   help="Training iterations (default: 10)")
    p.add_argument("--games", type=int,
                   default=int(os.getenv("TRAIN_GAMES", "50")),
                   help="Self-play games per iteration (default: 50)")
    p.add_argument("--sims", type=int,
                   default=int(os.getenv("MCTS_SIMS", "100")),
                   help="MCTS simulations per move (default: 100)")
    p.add_argument("--eval-games", type=int,
                   default=int(os.getenv("EVAL_GAMES", "20")),
                   help="Evaluation games per iteration (default: 20)")
    p.add_argument("--batch-size", type=int,
                   default=int(os.getenv("BATCH_SIZE", "64")),
                   help="Training batch size (default: 64)")
    p.add_argument("--lr", type=float,
                   default=float(os.getenv("LEARNING_RATE", "0.001")),
                   help="Learning rate (default: 0.001)")
    p.add_argument("--c-puct", type=float,
                   default=float(os.getenv("C_PUCT", "1.5")),
                   help="MCTS exploration constant (default: 1.5)")
    p.add_argument("--temperature", type=float,
                   default=float(os.getenv("TEMPERATURE", "1.0")),
                   help="Move selection temperature (default: 1.0)")
    p.add_argument("--temp-drop", type=int,
                   default=int(os.getenv("TEMP_DROP", "12")),
                   help="Switch to greedy after N moves (default: 12)")
    p.add_argument("--win-threshold", type=float,
                   default=float(os.getenv("WIN_THRESHOLD", "0.55")),
                   help="Win rate threshold to accept new model (default: 0.55)")
    p.add_argument("--workers", type=int,
                   default=int(os.getenv("TRAIN_WORKERS", "1")),
                   help="Parallel self-play workers (default: 1)")
    p.add_argument("--model-dir", type=str,
                   default=os.getenv("MODEL_DIR", str(Path(__file__).parent / "models")),
                   help="Model directory")
    p.add_argument("--fast", action="store_true",
                   help="Quick test run (5 iters, 10 games, 30 sims)")

    return p.parse_args()


# ─── Main ─────────────────────────────────────────────────────────────────────

def main():
    args = parse_args()

    if args.fast:
        args.iterations = 5
        args.games = 10
        args.sims = 30
        args.eval_games = 10

    # Device selection
    if torch.backends.mps.is_available():
        device = torch.device("mps")
        device_name = "Apple Silicon GPU (MPS)"
    elif torch.cuda.is_available():
        device = torch.device("cuda")
        device_name = f"CUDA ({torch.cuda.get_device_name()})"
    else:
        device = torch.device("cpu")
        device_name = "CPU"

    # Paths
    model_dir = Path(args.model_dir)
    model_dir.mkdir(parents=True, exist_ok=True)
    model_path = model_dir / "policy_net.pt"
    best_path = model_dir / "best_policy_net.pt"

    # Load model
    print(f"\n{'='*60}")
    print(f"  AlphaZero Self-Play Training")
    print(f"{'='*60}")
    print(f"  Device:          {device_name}")

    model = load_model(model_path, device)
    model.eval()

    params = sum(p.numel() for p in model.parameters())
    print(f"  Model params:    {params:,}")
    print(f"  Iterations:      {args.iterations}")
    print(f"  Games/iter:      {args.games}")
    print(f"  MCTS sims/move:  {args.sims}")
    print(f"  Workers:         {args.workers}")
    print(f"  Learning rate:   {args.lr}")
    print(f"  C_PUCT:          {args.c_puct}")
    print(f"  Win threshold:   {args.win_threshold:.0%}")
    print(f"{'='*60}\n")

    # Best model copy
    best_model = Connect4Net(channels=model.channels, num_blocks=len(model.res_blocks))
    best_model.load_state_dict(model.state_dict())
    best_model.to(device).eval()

    optimizer = torch.optim.Adam(model.parameters(), lr=args.lr, weight_decay=1e-4)
    scheduler = torch.optim.lr_scheduler.CosineAnnealingLR(
        optimizer, T_max=args.iterations, eta_min=args.lr * 0.1
    )

    replay_buffer: List[Tuple[list, list, float]] = []
    max_buffer = args.games * 42 * 3  # ~3 iterations of data
    accepted_count = 0

    for iteration in range(1, args.iterations + 1):
        t0 = time.time()
        print(f"--- Iteration {iteration}/{args.iterations} (lr={optimizer.param_groups[0]['lr']:.6f}) ---")

        # ── Phase 1: Self-play ───────────────────────────────────────────
        print(f"  Self-play: {args.games} games, {args.sims} sims/move", end="", flush=True)

        if args.workers > 1:
            # Parallel self-play
            games_per_worker = [args.games // args.workers] * args.workers
            remainder = args.games % args.workers
            for i in range(remainder):
                games_per_worker[i] += 1

            model_state = model.state_dict()
            worker_args = [
                (model_state, gpw, args.sims, args.c_puct,
                 args.temperature, args.temp_drop, model.channels, len(model.res_blocks))
                for gpw in games_per_worker if gpw > 0
            ]

            iteration_data = []
            with ProcessPoolExecutor(max_workers=args.workers) as pool:
                futures = [pool.submit(_self_play_worker, wa) for wa in worker_args]
                for future in as_completed(futures):
                    iteration_data.extend(future.result())
        else:
            # Single-process self-play
            model_state = model.state_dict()
            iteration_data = _self_play_worker(
                (model_state, args.games, args.sims, args.c_puct,
                 args.temperature, args.temp_drop, model.channels, len(model.res_blocks))
            )

        elapsed = time.time() - t0
        print(f" -> {len(iteration_data)} positions in {elapsed:.0f}s "
              f"({args.games / elapsed:.1f} games/sec)")

        # Add to replay buffer
        replay_buffer.extend(iteration_data)
        if len(replay_buffer) > max_buffer:
            replay_buffer = replay_buffer[-max_buffer:]

        # ── Phase 2: Training ────────────────────────────────────────────
        print(f"  Training on {len(replay_buffer)} positions...", end="", flush=True)
        metrics = train_step(model, replay_buffer, optimizer, args.batch_size, device)
        scheduler.step()
        print(f" -> policy={metrics['policy_loss']:.4f} value={metrics['value_loss']:.4f}")

        # ── Phase 3: Evaluation ──────────────────────────────────────────
        print(f"  Evaluating ({args.eval_games} games)...", end="", flush=True)
        result = evaluate(model, best_model, args.eval_games, args.sims // 2, device)
        print(f" -> new={result['new_wins']} old={result['old_wins']} "
              f"draw={result['draws']} ({result['new_win_rate']:.0%})")

        # ── Phase 4: Model selection ─────────────────────────────────────
        if result["new_win_rate"] >= args.win_threshold:
            best_model.load_state_dict(model.state_dict())
            torch.save(model.state_dict(), best_path)
            torch.save(model.state_dict(), model_path)
            accepted_count += 1
            print(f"  ACCEPTED ({accepted_count} total)")
        else:
            model.load_state_dict(best_model.state_dict())
            print(f"  rejected (below {args.win_threshold:.0%})")

        total_time = time.time() - t0
        print(f"  Time: {total_time:.0f}s\n")

    # ── Save final model ─────────────────────────────────────────────────
    torch.save(best_model.state_dict(), model_path)
    torch.save(best_model.state_dict(), best_path)

    root_models = Path(__file__).parent.parent / "models"
    if root_models.exists():
        torch.save(best_model.state_dict(), root_models / "best_policy_net.pt")
        torch.save(best_model.state_dict(), root_models / "current_policy_net.pt")
        print(f"Model saved to {root_models}/")

    print(f"\nDone! {accepted_count}/{args.iterations} iterations improved the model.")
    print(f"Model saved to {model_path}")


if __name__ == "__main__":
    main()
