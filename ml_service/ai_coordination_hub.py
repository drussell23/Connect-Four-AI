"""
🌟 AI COORDINATION HUB
======================

Revolutionary AI-to-AI communication system that enables:
- Real-time knowledge sharing between ML services
- Collective intelligence emergence
- Dynamic strategy adaptation
- Cross-model learning and evolution
"""

import asyncio
import json
import time
from typing import Dict, List, Any, Optional, Set
from dataclasses import dataclass, asdict
from enum import Enum
import websockets
import aioredis
from fastapi import FastAPI, WebSocket
import logging

class MessageType(Enum):
    PREDICTION_REQUEST = "prediction_request"
    PREDICTION_RESPONSE = "prediction_response"
    STRATEGY_UPDATE = "strategy_update"
    LEARNING_INSIGHT = "learning_insight"
    COORDINATION_SIGNAL = "coordination_signal"
    EMERGENCY_OVERRIDE = "emergency_override"

class AIPersonality(Enum):
    TACTICAL_SPECIALIST = "tactical"      # Fast, reactive
    STRATEGIC_PLANNER = "strategic"       # Deep, thoughtful
    ADAPTIVE_LEARNER = "adaptive"         # Flexible, evolving
    PATTERN_HUNTER = "pattern"           # Pattern recognition expert

@dataclass
class AIMessage:
    sender_id: str
    receiver_id: str
    message_type: MessageType
    payload: Dict[str, Any]
    timestamp: float
    urgency: int = 1  # 1-10, 10 being most urgent
    requires_response: bool = False

@dataclass
class AIInsight:
    source_model: str
    insight_type: str
    confidence: float
    board_state: List[List[str]]
    discovered_pattern: str
    effectiveness_score: float
    opponent_context: Optional[str] = None

class AICoordinationHub:
    """Central intelligence coordination system"""
    
    def __init__(self):
        self.connected_ais = {}
        self.message_queue = asyncio.Queue()
        self.knowledge_base = {}
        self.active_games = {}
        self.ai_personalities = {}
        self.cross_model_insights = []
        self.collective_memory = {}
        
        # Performance tracking
        self.collaboration_stats = {
            'messages_exchanged': 0,
            'successful_collaborations': 0,
            'insight_discoveries': 0,
            'strategy_adaptations': 0
        }
        
        # Initialize AI personalities
        self._initialize_ai_personalities()
        
    def _initialize_ai_personalities(self):
        """Initialize distinct AI personalities"""
        self.ai_personalities = {
            'ml_service_tactical': {
                'personality': AIPersonality.TACTICAL_SPECIALIST,
                'strengths': ['immediate_threats', 'defensive_moves', 'quick_patterns'],
                'response_time': 0.05,  # 50ms
                'confidence_threshold': 0.7,
                'collaboration_style': 'reactive'
            },
            'ml_service_strategic': {
                'personality': AIPersonality.STRATEGIC_PLANNER,
                'strengths': ['long_term_planning', 'positional_analysis', 'endgame'],
                'response_time': 0.2,   # 200ms
                'confidence_threshold': 0.6,
                'collaboration_style': 'deliberate'
            },
            'ml_inference_fast': {
                'personality': AIPersonality.ADAPTIVE_LEARNER,
                'strengths': ['pattern_adaptation', 'opponent_modeling', 'quick_learning'],
                'response_time': 0.03,  # 30ms
                'confidence_threshold': 0.8,
                'collaboration_style': 'adaptive'
            }
        }

    async def register_ai_service(self, service_id: str, capabilities: Dict[str, Any], websocket: WebSocket):
        """Register an AI service for coordination"""
        await websocket.accept()
        
        self.connected_ais[service_id] = {
            'websocket': websocket,
            'capabilities': capabilities,
            'connected_at': time.time(),
            'message_count': 0,
            'last_seen': time.time()
        }
        
        # Send welcome message with collaboration instructions
        welcome_msg = AIMessage(
            sender_id="coordination_hub",
            receiver_id=service_id,
            message_type=MessageType.COORDINATION_SIGNAL,
            payload={
                'action': 'welcome',
                'your_personality': self.ai_personalities.get(service_id, {}),
                'collaboration_peers': list(self.connected_ais.keys()),
                'shared_knowledge': self._get_relevant_knowledge(service_id)
            },
            timestamp=time.time()
        )
        
        await self._send_message(service_id, welcome_msg)
        logging.info(f"AI service {service_id} registered for coordination")

    async def coordinate_prediction(self, game_id: str, board_state: List[List[str]], 
                                  context: Dict[str, Any]) -> Dict[str, Any]:
        """Coordinate multiple AI services for optimal prediction"""
        
        # Determine which AIs should participate
        participating_ais = self._select_optimal_ai_team(board_state, context)
        
        # Create coordination request
        coordination_request = {
            'game_id': game_id,
            'board_state': board_state,
            'context': context,
            'collaboration_mode': 'ensemble',
            'urgency': self._assess_urgency(board_state),
            'deadline_ms': 150  # 150ms deadline for response
        }
        
        # Send requests to participating AIs
        responses = await self._gather_ai_responses(participating_ais, coordination_request)
        
        # Synthesize responses using collective intelligence
        final_decision = await self._synthesize_collective_decision(responses, context)
        
        # Learn from the collaboration
        await self._record_collaboration_outcome(game_id, responses, final_decision)
        
        return final_decision

    async def share_learning_insight(self, source_ai: str, insight: AIInsight):
        """Share a learning insight across all AI services"""
        
        # Validate and enrich the insight
        enriched_insight = await self._enrich_insight(insight)
        
        # Determine which AIs would benefit from this insight
        relevant_ais = self._find_relevant_ais_for_insight(enriched_insight)
        
        # Broadcast insight to relevant AIs
        for ai_id in relevant_ais:
            if ai_id != source_ai and ai_id in self.connected_ais:
                insight_msg = AIMessage(
                    sender_id=source_ai,
                    receiver_id=ai_id,
                    message_type=MessageType.LEARNING_INSIGHT,
                    payload={
                        'insight': asdict(enriched_insight),
                        'integration_suggestions': self._get_integration_suggestions(ai_id, enriched_insight),
                        'expected_benefit': self._estimate_benefit(ai_id, enriched_insight)
                    },
                    timestamp=time.time(),
                    urgency=5
                )
                
                await self._send_message(ai_id, insight_msg)
        
        # Store in collective memory
        self.collective_memory[f"insight_{time.time()}"] = enriched_insight
        self.collaboration_stats['insight_discoveries'] += 1

    async def emergency_coordination(self, game_id: str, emergency_type: str, 
                                   board_state: List[List[str]], context: Dict[str, Any]):
        """Handle emergency situations requiring immediate AI coordination"""
        
        # Priority override for all AIs
        emergency_msg = AIMessage(
            sender_id="coordination_hub",
            receiver_id="all",
            message_type=MessageType.EMERGENCY_OVERRIDE,
            payload={
                'emergency_type': emergency_type,
                'game_id': game_id,
                'board_state': board_state,
                'context': context,
                'required_response_time_ms': 50,
                'priority_level': 'CRITICAL'
            },
            timestamp=time.time(),
            urgency=10,
            requires_response=True
        )
        
        # Broadcast to all connected AIs
        emergency_responses = []
        for ai_id in self.connected_ais:
            response = await self._send_urgent_message(ai_id, emergency_msg)
            if response:
                emergency_responses.append(response)
        
        # Immediate synthesis of emergency responses
        emergency_decision = await self._synthesize_emergency_response(emergency_responses)
        
        return emergency_decision

    async def adaptive_strategy_evolution(self, game_results: List[Dict[str, Any]]):
        """Evolve AI strategies based on game outcomes"""
        
        # Analyze collective performance
        performance_analysis = await self._analyze_collective_performance(game_results)
        
        # Identify improvement opportunities
        improvement_areas = self._identify_improvement_areas(performance_analysis)
        
        # Generate strategy adaptations
        strategy_updates = {}
        for ai_id in self.connected_ais:
            if ai_id in improvement_areas:
                strategy_updates[ai_id] = await self._generate_strategy_adaptation(
                    ai_id, improvement_areas[ai_id], performance_analysis
                )
        
        # Distribute strategy updates
        for ai_id, strategy_update in strategy_updates.items():
            update_msg = AIMessage(
                sender_id="coordination_hub",
                receiver_id=ai_id,
                message_type=MessageType.STRATEGY_UPDATE,
                payload={
                    'strategy_adaptation': strategy_update,
                    'performance_context': performance_analysis,
                    'implementation_priority': 'high',
                    'expected_improvement': strategy_update.get('expected_improvement', 0.1)
                },
                timestamp=time.time(),
                urgency=7
            )
            
            await self._send_message(ai_id, update_msg)
        
        self.collaboration_stats['strategy_adaptations'] += len(strategy_updates)

    async def cross_model_knowledge_fusion(self, topic: str, context: Dict[str, Any]) -> Dict[str, Any]:
        """Fuse knowledge from multiple AI models on a specific topic"""
        
        # Query all AIs for their knowledge on the topic
        knowledge_requests = []
        for ai_id in self.connected_ais:
            request = AIMessage(
                sender_id="coordination_hub",
                receiver_id=ai_id,
                message_type=MessageType.COORDINATION_SIGNAL,
                payload={
                    'action': 'knowledge_query',
                    'topic': topic,
                    'context': context,
                    'detail_level': 'high'
                },
                timestamp=time.time(),
                requires_response=True
            )
            knowledge_requests.append(self._send_message(ai_id, request))
        
        # Gather responses
        knowledge_responses = await asyncio.gather(*knowledge_requests, return_exceptions=True)
        
        # Fuse knowledge using advanced synthesis
        fused_knowledge = await self._fuse_multi_model_knowledge(knowledge_responses)
        
        # Create new collective insight
        collective_insight = {
            'topic': topic,
            'fused_knowledge': fused_knowledge,
            'contributing_models': list(self.connected_ais.keys()),
            'fusion_confidence': self._calculate_fusion_confidence(knowledge_responses),
            'synthesis_timestamp': time.time(),
            'application_contexts': self._identify_application_contexts(fused_knowledge)
        }
        
        # Store in knowledge base
        self.knowledge_base[f"fusion_{topic}_{time.time()}"] = collective_insight
        
        return collective_insight

    # Private helper methods
    def _select_optimal_ai_team(self, board_state: List[List[str]], context: Dict[str, Any]) -> List[str]:
        """Select optimal AI team based on current situation"""
        team = []
        
        # Always include tactical specialist for immediate threats
        if 'ml_service_tactical' in self.connected_ais:
            team.append('ml_service_tactical')
        
        # Include strategic planner for complex positions
        move_count = sum(1 for row in board_state for cell in row if cell != 'Empty')
        if move_count > 10 and 'ml_service_strategic' in self.connected_ais:
            team.append('ml_service_strategic')
        
        # Include adaptive learner if opponent patterns are available
        if context.get('opponent_id') and 'ml_inference_fast' in self.connected_ais:
            team.append('ml_inference_fast')
        
        return team

    def _assess_urgency(self, board_state: List[List[str]]) -> int:
        """Assess urgency of the situation (1-10)"""
        # Quick threat assessment
        # Implementation would check for immediate wins/blocks
        return 5  # Placeholder

    async def _gather_ai_responses(self, ai_list: List[str], request: Dict[str, Any]) -> List[Dict[str, Any]]:
        """Gather responses from multiple AIs with timeout"""
        responses = []
        
        tasks = []
        for ai_id in ai_list:
            if ai_id in self.connected_ais:
                msg = AIMessage(
                    sender_id="coordination_hub",
                    receiver_id=ai_id,
                    message_type=MessageType.PREDICTION_REQUEST,
                    payload=request,
                    timestamp=time.time(),
                    requires_response=True
                )
                tasks.append(self._send_message_with_timeout(ai_id, msg, timeout=0.15))
        
        responses = await asyncio.gather(*tasks, return_exceptions=True)
        return [r for r in responses if not isinstance(r, Exception)]

    async def _synthesize_collective_decision(self, responses: List[Dict[str, Any]], 
                                            context: Dict[str, Any]) -> Dict[str, Any]:
        """Synthesize multiple AI responses into collective decision"""
        
        if not responses:
            return {'error': 'No valid responses received'}
        
        # Weight responses based on AI personalities and situation
        weighted_predictions = []
        total_weight = 0
        
        for response in responses:
            ai_id = response.get('source_ai_id')
            personality = self.ai_personalities.get(ai_id, {})
            
            # Calculate weight based on situation and AI strengths
            weight = self._calculate_response_weight(response, personality, context)
            weighted_predictions.append((response, weight))
            total_weight += weight
        
        # Ensemble the predictions
        if total_weight > 0:
            ensemble_probs = [0.0] * 7  # 7 columns
            ensemble_reasoning = []
            
            for response, weight in weighted_predictions:
                probs = response.get('probs', [1/7] * 7)
                normalized_weight = weight / total_weight
                
                for i in range(len(ensemble_probs)):
                    ensemble_probs[i] += probs[i] * normalized_weight
                
                ensemble_reasoning.append(f"{response.get('source_ai_id')}: {response.get('reasoning', '')}")
            
            final_move = ensemble_probs.index(max(ensemble_probs))
            
            return {
                'move': final_move,
                'probs': ensemble_probs,
                'confidence': max(ensemble_probs),
                'source': 'collective_intelligence',
                'contributing_ais': [r.get('source_ai_id') for r, _ in weighted_predictions],
                'reasoning': ensemble_reasoning,
                'collaboration_quality': self._assess_collaboration_quality(responses)
            }
        
        # Fallback to best single response
        best_response = max(responses, key=lambda r: r.get('confidence', 0))
        best_response['source'] = 'fallback_best_individual'
        return best_response

    def _calculate_response_weight(self, response: Dict[str, Any], 
                                 personality: Dict[str, Any], context: Dict[str, Any]) -> float:
        """Calculate weight for AI response based on situation"""
        base_weight = 1.0
        
        # Adjust based on confidence
        confidence = response.get('confidence', 0.5)
        base_weight *= confidence
        
        # Adjust based on AI strengths and current situation
        strengths = personality.get('strengths', [])
        
        # Boost tactical specialist in threat situations
        if 'immediate_threats' in strengths and context.get('threat_level') == 'high':
            base_weight *= 1.5
        
        # Boost strategic planner in complex positions
        if 'long_term_planning' in strengths and context.get('game_phase') == 'endgame':
            base_weight *= 1.3
        
        # Boost adaptive learner when opponent modeling is relevant
        if 'opponent_modeling' in strengths and context.get('opponent_id'):
            base_weight *= 1.2
        
        return base_weight

    async def _send_message(self, ai_id: str, message: AIMessage) -> Optional[Dict[str, Any]]:
        """Send message to specific AI service"""
        if ai_id not in self.connected_ais:
            return None
        
        try:
            websocket = self.connected_ais[ai_id]['websocket']
            await websocket.send_text(json.dumps(asdict(message)))
            
            self.collaboration_stats['messages_exchanged'] += 1
            self.connected_ais[ai_id]['message_count'] += 1
            self.connected_ais[ai_id]['last_seen'] = time.time()
            
            # Wait for response if required
            if message.requires_response:
                response = await websocket.receive_text()
                return json.loads(response)
            
        except Exception as e:
            logging.error(f"Failed to send message to {ai_id}: {e}")
            return None

    async def _send_message_with_timeout(self, ai_id: str, message: AIMessage, timeout: float) -> Optional[Dict[str, Any]]:
        """Send message with timeout"""
        try:
            return await asyncio.wait_for(self._send_message(ai_id, message), timeout=timeout)
        except asyncio.TimeoutError:
            logging.warning(f"Timeout sending message to {ai_id}")
            return None

    def _get_relevant_knowledge(self, service_id: str) -> Dict[str, Any]:
        """Get relevant knowledge for a specific AI service"""
        personality = self.ai_personalities.get(service_id, {})
        strengths = personality.get('strengths', [])
        
        relevant_knowledge = {}
        for key, knowledge in self.knowledge_base.items():
            if any(strength in knowledge.get('topics', []) for strength in strengths):
                relevant_knowledge[key] = knowledge
        
        return relevant_knowledge

    async def _enrich_insight(self, insight: AIInsight) -> AIInsight:
        """Enrich insight with additional context and validation"""
        # Add cross-validation, context, and meta-information
        # Implementation would validate and enhance the insight
        return insight

    def _find_relevant_ais_for_insight(self, insight: AIInsight) -> List[str]:
        """Find which AIs would benefit from a specific insight"""
        relevant_ais = []
        
        for ai_id, personality in self.ai_personalities.items():
            if ai_id in self.connected_ais:
                # Check if insight aligns with AI's strengths or weaknesses
                strengths = personality.get('strengths', [])
                if any(strength in insight.insight_type for strength in strengths):
                    relevant_ais.append(ai_id)
        
        return relevant_ais

# Global coordination hub instance
coordination_hub = AICoordinationHub()

# FastAPI app for coordination endpoints
app = FastAPI(title="AI Coordination Hub", version="1.0.0")

@app.websocket("/ws/{ai_service_id}")
async def websocket_endpoint(websocket: WebSocket, ai_service_id: str):
    """WebSocket endpoint for AI service coordination"""
    await coordination_hub.register_ai_service(ai_service_id, {}, websocket)
    
    try:
        while True:
            data = await websocket.receive_text()
            message = json.loads(data)
            
            # Handle incoming messages from AI services
            if message.get('type') == 'insight_sharing':
                insight = AIInsight(**message['payload'])
                await coordination_hub.share_learning_insight(ai_service_id, insight)
            
            elif message.get('type') == 'coordination_request':
                result = await coordination_hub.coordinate_prediction(
                    message['game_id'],
                    message['board_state'],
                    message['context']
                )
                await websocket.send_text(json.dumps(result))
    
    except Exception as e:
        logging.error(f"WebSocket error for {ai_service_id}: {e}")
    finally:
        if ai_service_id in coordination_hub.connected_ais:
            del coordination_hub.connected_ais[ai_service_id]

@app.get("/coordination/stats")
async def get_coordination_stats():
    """Get coordination statistics"""
    return {
        'connected_ais': len(coordination_hub.connected_ais),
        'stats': coordination_hub.collaboration_stats,
        'active_games': len(coordination_hub.active_games),
        'knowledge_base_size': len(coordination_hub.knowledge_base)
    }

if __name__ == "__main__":
    import os
    import uvicorn
    # Use environment variable for host binding, defaulting to localhost for security
    host = os.environ.get("AI_COORDINATION_HOST", "127.0.0.1")
    port = int(os.environ.get("AI_COORDINATION_PORT", "8002"))
    uvicorn.run("ai_coordination_hub:app", host=host, port=port, reload=False) 