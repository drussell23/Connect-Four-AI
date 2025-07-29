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
import json
import logging
import time
from collections import deque, defaultdict
from datetime import datetime, timedelta
from pathlib import Path
from typing import List, Dict, Any, Optional, Tuple, Deque
import numpy as np

import torch
import torch.nn as nn
import torch.nn.functional as F
from torch.utils.data import Dataset, DataLoader
import websockets
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
            'horizontal': deque(maxlen=capacity // 4),
            'vertical': deque(maxlen=capacity // 4),
            'diagonal': deque(maxlen=capacity // 4),
            'anti-diagonal': deque(maxlen=capacity // 4)
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
        if experience.get('outcome') == 'loss' and experience.get('loss_pattern'):
            pattern_type = experience['loss_pattern']['type']
            if pattern_type in self.pattern_buffers:
                self.pattern_buffers[pattern_type].append(experience)
                
    def sample(self, batch_size: int, pattern_focus: Optional[str] = None) -> List[Dict[str, Any]]:
        """Sample batch with optional pattern focus"""
        if pattern_focus and self.pattern_buffers[pattern_focus]:
            # 70% from pattern buffer, 30% from general buffer
            pattern_size = int(batch_size * 0.7)
            general_size = batch_size - pattern_size
            
            pattern_batch = self._sample_from_buffer(
                list(self.pattern_buffers[pattern_focus]), 
                pattern_size
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
        probs = priorities ** self.beta
        probs /= probs.sum()
        
        # Sample indices
        indices = np.random.choice(len(self.buffer), batch_size, p=probs)
        
        # Update beta
        self.beta = min(1.0, self.beta + self.beta_increment)
        
        return [self.buffer[i] for i in indices]
        
    def _sample_from_buffer(self, buffer: List[Dict[str, Any]], size: int) -> List[Dict[str, Any]]:
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
            capacity=config.get('buffer_capacity', 100000)
        )
        
        # Learning configuration
        self.learning_rate = config.get('learning_rate', 0.0001)
        self.batch_size = config.get('batch_size', 32)
        self.update_frequency = config.get('update_frequency', 100)
        self.min_games_for_update = config.get('min_games', 50)
        self.validation_threshold = config.get('validation_threshold', 0.95)
        
        # Loss pattern tracking
        self.loss_patterns = defaultdict(list)
        self.pattern_improvements = defaultdict(float)
        
        # Metrics
        self.metrics = {
            'games_processed': 0,
            'losses_analyzed': 0,
            'model_updates': 0,
            'current_win_rate': 0.5,
            'pattern_defense_rates': defaultdict(float),
            'last_update': None
        }
        
        # Model versioning
        self.model_version = 1
        self.model_history = deque(maxlen=10)
        
        # WebSocket clients for real-time updates
        self.ws_clients = set()
        
        logger.info("Continuous Learning Pipeline initialized")
        
    async def process_game_outcome(self, game_data: Dict[str, Any]):
        """Process completed game for learning"""
        try:
            # Extract training examples
            examples = self._extract_training_examples(game_data)
            
            # Determine priority based on outcome
            if game_data['outcome'] == 'loss':
                priority = 2.0  # High priority for losses
                self.metrics['losses_analyzed'] += 1
                
                # Analyze loss pattern
                if loss_pattern := game_data.get('lossPattern'):
                    await self._analyze_loss_pattern(loss_pattern, examples)
            else:
                priority = 1.0
                
            # Add to experience buffer
            for example in examples:
                self.experience_buffer.add(example, priority)
                
            self.metrics['games_processed'] += 1
            
            # Check if we should update model
            if self._should_update_model():
                await self.update_model()
                
            # Broadcast metrics update
            await self._broadcast_update({
                'type': 'learning_progress',
                'data': {
                    'gamesProcessed': self.metrics['games_processed'],
                    'lossesAnalyzed': self.metrics['losses_analyzed'],
                    'bufferSize': len(self.experience_buffer.buffer)
                }
            })
            
        except Exception as e:
            logger.error(f"Error processing game outcome: {e}")
            
    def _extract_training_examples(self, game_data: Dict[str, Any]) -> List[Dict[str, Any]]:
        """Extract training examples from game data"""
        examples = []
        moves = game_data.get('moves', [])
        outcome = game_data['outcome']
        
        # Process each move
        for i, move in enumerate(moves):
            if move['playerId'] == 'AI':
                # Create training example
                example = {
                    'board_before': move.get('boardStateBefore'),
                    'board_after': move.get('boardStateAfter'),
                    'action': move['column'],
                    'outcome': outcome,
                    'move_number': i,
                    'total_moves': len(moves),
                    'game_phase': self._determine_game_phase(i, len(moves)),
                    'timestamp': move['timestamp']
                }
                
                # Add loss pattern info if available
                if outcome == 'loss' and game_data.get('lossPattern'):
                    example['loss_pattern'] = game_data['lossPattern']
                    
                examples.append(example)
                
        return examples
        
    def _determine_game_phase(self, move_num: int, total_moves: int) -> str:
        """Determine game phase (opening/middle/endgame)"""
        if move_num < 8:
            return 'opening'
        elif move_num < total_moves - 10:
            return 'middle'
        else:
            return 'endgame'
            
    async def _analyze_loss_pattern(self, loss_pattern: Dict[str, Any], 
                                   examples: List[Dict[str, Any]]):
        """Analyze loss pattern for targeted learning"""
        pattern_type = loss_pattern['type']
        
        # Store pattern for analysis
        self.loss_patterns[pattern_type].append({
            'pattern': loss_pattern,
            'examples': examples[-5:],  # Last 5 moves
            'timestamp': datetime.now()
        })
        
        # Log pattern analysis
        logger.info(f"Loss pattern detected: {pattern_type} with "
                   f"{len(loss_pattern.get('aiMistakes', []))} mistakes")
        
        # Broadcast pattern insight
        await self._broadcast_update({
            'type': 'pattern_insights',
            'data': {
                'patterns': {pattern_type: len(self.loss_patterns[pattern_type])},
                'criticalPositions': loss_pattern.get('criticalPositions', []),
                'recommendations': self._generate_pattern_recommendations(pattern_type)
            }
        })
        
    def _generate_pattern_recommendations(self, pattern_type: str) -> List[str]:
        """Generate recommendations based on pattern analysis"""
        recommendations = {
            'horizontal': [
                "Increase weight on horizontal threat detection",
                "Prioritize center column control",
                "Look ahead for horizontal setups"
            ],
            'vertical': [
                "Monitor column heights more carefully",
                "Prevent vertical stacking",
                "Balance defensive and offensive plays"
            ],
            'diagonal': [
                "Improve diagonal pattern recognition",
                "Control key diagonal intersections",
                "Increase lookahead for diagonal threats"
            ],
            'anti-diagonal': [
                "Enhance anti-diagonal threat detection",
                "Block critical anti-diagonal positions",
                "Consider both diagonal directions equally"
            ]
        }
        
        return recommendations.get(pattern_type, ["Improve general defense"])
        
    def _should_update_model(self) -> bool:
        """Determine if model should be updated"""
        # Check minimum games requirement
        if len(self.experience_buffer.buffer) < self.min_games_for_update:
            return False
            
        # Check update frequency
        if self.metrics['games_processed'] % self.update_frequency != 0:
            return False
            
        # Check time since last update
        if self.metrics['last_update']:
            time_since_update = datetime.now() - self.metrics['last_update']
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
                pattern_focus=pattern_focus
            )
            
            # Prepare training data
            train_loader = self._prepare_training_data(batch)
            
            # Save current model as backup
            self._backup_current_model()
            
            # Fine-tune model
            improvements = await self._fine_tune_model(train_loader, pattern_focus)
            
            # Validate improvement
            if await self._validate_improvement(improvements):
                # Deploy updated model
                await self._deploy_updated_model()
                
                # Update metrics
                self.metrics['model_updates'] += 1
                self.metrics['last_update'] = datetime.now()
                self.model_version += 1
                
                # Broadcast update
                await self._broadcast_update({
                    'type': 'model_updated',
                    'data': {
                        'version': f"v{self.model_version}",
                        'improvements': improvements,
                        'timestamp': time.time()
                    }
                })
                
                logger.info(f"Model updated successfully to version {self.model_version}")
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
            board_tensor = self._board_to_tensor(example['board_before'])
            boards.append(board_tensor)
            
            # Action
            actions.append(example['action'])
            
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
                if board[r][c] == 'Yellow':  # AI
                    tensor[0, r, c] = 1
                elif board[r][c] == 'Red':  # Human
                    tensor[1, r, c] = 1
                    
        return tensor
        
    def _calculate_reward(self, example: Dict[str, Any]) -> float:
        """Calculate reward for training"""
        outcome = example['outcome']
        move_number = example['move_number']
        total_moves = example['total_moves']
        
        # Base reward
        if outcome == 'win':
            reward = 1.0
        elif outcome == 'draw':
            reward = 0.0
        else:  # loss
            reward = -1.0
            
        # Adjust based on move position (discount earlier moves)
        position_factor = (move_number + 1) / total_moves
        reward *= (0.5 + 0.5 * position_factor)
        
        # Boost negative reward for critical mistakes
        if outcome == 'loss' and example.get('loss_pattern'):
            if move_number >= total_moves - 5:  # Last 5 moves
                reward *= 2.0  # Double negative reward
                
        return reward
        
    async def _fine_tune_model(self, train_loader: DataLoader, 
                              pattern_focus: Optional[str]) -> Dict[str, float]:
        """Fine-tune the model"""
        model = self.model_manager.models['standard']
        model.train()
        
        optimizer = torch.optim.Adam(model.parameters(), lr=self.learning_rate)
        improvements = defaultdict(float)
        
        # Training loop
        for epoch in range(5):  # Small number of epochs
            total_loss = 0
            
            for batch_boards, batch_actions, batch_rewards in train_loader:
                optimizer.zero_grad()
                
                # Forward pass
                outputs = model(batch_boards)
                
                # Calculate loss
                loss = self._calculate_loss(outputs, batch_actions, batch_rewards)
                
                # Backward pass
                loss.backward()
                optimizer.step()
                
                total_loss += loss.item()
                
            avg_loss = total_loss / len(train_loader)
            improvements[f'epoch_{epoch}_loss'] = avg_loss
            
        # Calculate pattern-specific improvements
        if pattern_focus:
            pattern_improvement = await self._test_pattern_defense(pattern_focus)
            improvements[f'{pattern_focus}_defense'] = pattern_improvement
            self.pattern_improvements[pattern_focus] = pattern_improvement
        else:
            # Test all patterns
            for pattern in ['horizontal', 'vertical', 'diagonal']:
                improvement = await self._test_pattern_defense(pattern)
                improvements[f'{pattern}_defense'] = improvement
                self.pattern_improvements[pattern] = improvement
                
        # Overall improvement
        improvements['overall_accuracy'] = sum(improvements.values()) / len(improvements)
        
        return dict(improvements)
        
    def _calculate_loss(self, outputs: torch.Tensor, actions: torch.Tensor, 
                       rewards: torch.Tensor) -> torch.Tensor:
        """Calculate custom loss function"""
        # Policy loss (cross-entropy)
        policy_loss = F.cross_entropy(outputs, actions, reduction='none')
        
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
        
        model = self.model_manager.models['standard']
        model.eval()
        
        with torch.no_grad():
            for position in test_positions:
                board_tensor = self._board_to_tensor(position['board'])
                output = model(board_tensor.unsqueeze(0))
                
                # Get predicted move
                predicted_move = output.argmax(dim=1).item()
                
                # Check if it blocks the threat
                if predicted_move in position['blocking_moves']:
                    correct += 1
                    
        return correct / total
        
    def _get_pattern_test_positions(self, pattern: str) -> List[Dict[str, Any]]:
        """Get test positions for pattern defense"""
        # This would load pre-defined test positions
        # For now, return positions from recent losses
        positions = []
        
        for loss_data in self.loss_patterns[pattern][-10:]:
            for example in loss_data['examples']:
                if 'board_before' in example:
                    positions.append({
                        'board': example['board_before'],
                        'blocking_moves': [pos['column'] for pos in 
                                         loss_data['pattern'].get('criticalPositions', [])]
                    })
                    
        return positions
        
    async def _validate_improvement(self, improvements: Dict[str, float]) -> bool:
        """Validate that model hasn't degraded"""
        # Check overall improvement
        if improvements.get('overall_accuracy', 0) < -0.1:
            return False
            
        # Check catastrophic forgetting on basic positions
        basic_score = await self._test_basic_positions()
        if basic_score < self.validation_threshold:
            logger.warning(f"Basic position score too low: {basic_score}")
            return False
            
        # Check pattern defense improvements
        for pattern in ['horizontal', 'vertical', 'diagonal']:
            if improvements.get(f'{pattern}_defense', 0) < 0.3:
                logger.warning(f"Poor {pattern} defense: {improvements.get(f'{pattern}_defense', 0)}")
                # Don't reject, but log concern
                
        return True
        
    async def _test_basic_positions(self) -> float:
        """Test model on basic positions to prevent catastrophic forgetting"""
        basic_tests = [
            # Win in 1 move
            {
                'board': [
                    ['Empty'] * 7,
                    ['Empty'] * 7,
                    ['Empty'] * 7,
                    ['Empty', 'Empty', 'Empty', 'Empty', 'Empty', 'Empty', 'Empty'],
                    ['Empty', 'Empty', 'Empty', 'Empty', 'Empty', 'Empty', 'Empty'],
                    ['Yellow', 'Yellow', 'Yellow', 'Empty', 'Empty', 'Empty', 'Empty']
                ],
                'correct_move': 3
            },
            # Block opponent win
            {
                'board': [
                    ['Empty'] * 7,
                    ['Empty'] * 7,
                    ['Empty'] * 7,
                    ['Empty', 'Empty', 'Empty', 'Empty', 'Empty', 'Empty', 'Empty'],
                    ['Empty', 'Empty', 'Empty', 'Empty', 'Empty', 'Empty', 'Empty'],
                    ['Red', 'Red', 'Red', 'Empty', 'Empty', 'Empty', 'Empty']
                ],
                'correct_move': 3
            }
        ]
        
        correct = 0
        model = self.model_manager.models['standard']
        model.eval()
        
        with torch.no_grad():
            for test in basic_tests:
                board_tensor = self._board_to_tensor(test['board'])
                output = model(board_tensor.unsqueeze(0))
                predicted_move = output.argmax(dim=1).item()
                
                if predicted_move == test['correct_move']:
                    correct += 1
                    
        return correct / len(basic_tests)
        
    def _backup_current_model(self):
        """Backup current model before update"""
        current_state = self.model_manager.models['standard'].state_dict()
        self.model_history.append({
            'version': self.model_version,
            'state_dict': current_state.copy(),
            'timestamp': datetime.now()
        })
        
    async def _deploy_updated_model(self):
        """Deploy the updated model"""
        # Model is already updated in-place
        # This method would handle any deployment logistics
        logger.info("Model deployed successfully")
        
    async def _rollback_model(self):
        """Rollback to previous model version"""
        if self.model_history:
            previous = self.model_history[-1]
            self.model_manager.models['standard'].load_state_dict(
                previous['state_dict']
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
        logger.info(f"WebSocket client connected. Total clients: {len(self.ws_clients)}")
        
        try:
            # Send initial status
            await websocket.send(json.dumps({
                'type': 'connection_established',
                'data': {
                    'model_version': self.model_version,
                    'metrics': dict(self.metrics)
                }
            }))
            
            # Handle incoming messages
            async for message in websocket:
                await self._handle_ws_message(websocket, json.loads(message))
                
        except websockets.exceptions.ConnectionClosed:
            pass
        finally:
            self.ws_clients.remove(websocket)
            logger.info(f"WebSocket client disconnected. Total clients: {len(self.ws_clients)}")
            
    async def _handle_ws_message(self, websocket: WebSocketServerProtocol, 
                                message: Dict[str, Any]):
        """Handle incoming WebSocket messages"""
        msg_type = message.get('type')
        
        if msg_type == 'priority_learning':
            # Handle priority learning request
            await self.process_game_outcome(message['data'])
            
        elif msg_type == 'pattern_defense_request':
            # Handle pattern defense request
            response = {
                'type': 'pattern_defense_response',
                'requestId': message.get('requestId'),
                'defense': self._generate_pattern_defense(
                    message.get('pattern'),
                    message.get('board')
                )
            }
            await websocket.send(json.dumps(response))
            
        elif msg_type == 'check_model_updates':
            # Force model update check
            if message.get('force') and self._should_update_model():
                await self.update_model()
                
        elif msg_type == 'get_metrics':
            # Send current metrics
            await websocket.send(json.dumps({
                'type': 'metrics_update',
                'data': dict(self.metrics)
            }))
            
    def _generate_pattern_defense(self, pattern: str, board: List[List[str]]) -> Dict[str, Any]:
        """Generate pattern-specific defense strategy"""
        # Analyze board for pattern threats
        critical_moves = self._find_critical_moves(board, pattern)
        
        return {
            'pattern': pattern,
            'criticalMoves': critical_moves,
            'confidence': self.pattern_improvements.get(pattern, 0.5),
            'strategy': self._generate_pattern_recommendations(pattern)
        }
        
    def _find_critical_moves(self, board: List[List[str]], pattern: str) -> List[int]:
        """Find critical defensive moves for pattern"""
        critical = []
        
        # Simple heuristic for now
        if pattern == 'horizontal':
            # Check each row for potential horizontal threats
            for row in range(6):
                consecutive = 0
                for col in range(7):
                    if board[row][col] == 'Red':
                        consecutive += 1
                        if consecutive >= 2:
                            # Check adjacent columns
                            if col + 1 < 7 and board[row][col + 1] == 'Empty':
                                critical.append(col + 1)
                            if col - consecutive >= 0 and board[row][col - consecutive] == 'Empty':
                                critical.append(col - consecutive)
                    else:
                        consecutive = 0
                        
        # Remove duplicates and return top 3
        return list(set(critical))[:3]


class Connect4Dataset(Dataset):
    """PyTorch dataset for Connect Four training data"""
    
    def __init__(self, boards: List[torch.Tensor], actions: List[int], 
                 rewards: List[float]):
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
            logger.warning(f"Catastrophic forgetting detected! "
                          f"Performance: {performance:.2f} vs baseline: {self.baseline_performance:.2f}")
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


# Initialize and run the continuous learning system
async def run_continuous_learning(model_manager, config: Dict[str, Any]):
    """Run the continuous learning pipeline"""
    pipeline = ContinuousLearningPipeline(model_manager, config)
    
    # Start WebSocket server
    ws_port = int(os.environ.get("ML_WEBSOCKET_PORT", "8002"))
    server = await websockets.serve(
        pipeline.handle_websocket,
        "localhost",
        ws_port
    )
    
    logger.info(f"Continuous Learning WebSocket server started on ws://localhost:{ws_port}")
    
    # Keep the server running
    await asyncio.Future()  # Run forever


if __name__ == "__main__":
    # This would be integrated with the main ML service
    logger.info("Continuous Learning module loaded")