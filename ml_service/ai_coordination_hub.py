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
import hashlib
import json
import logging
import time
from collections import deque
from dataclasses import asdict, dataclass
from enum import Enum
from typing import Any, Dict, List, Optional, Set, Tuple

import aioredis
import numpy as np
import websockets
from fastapi import FastAPI, WebSocket
from fastapi.middleware.cors import CORSMiddleware


class MessageType(Enum):
    PREDICTION_REQUEST = "prediction_request"
    PREDICTION_RESPONSE = "prediction_response"
    STRATEGY_UPDATE = "strategy_update"
    LEARNING_INSIGHT = "learning_insight"
    COORDINATION_SIGNAL = "coordination_signal"
    EMERGENCY_OVERRIDE = "emergency_override"


class AIPersonality(Enum):
    TACTICAL_SPECIALIST = "tactical"  # Fast, reactive
    STRATEGIC_PLANNER = "strategic"  # Deep, thoughtful
    ADAPTIVE_LEARNER = "adaptive"  # Flexible, evolving
    PATTERN_HUNTER = "pattern"  # Pattern recognition expert


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
            "messages_exchanged": 0,
            "successful_collaborations": 0,
            "insight_discoveries": 0,
            "strategy_adaptations": 0,
        }

        # Initialize AI personalities
        self._initialize_ai_personalities()

    def _initialize_ai_personalities(self):
        """Initialize distinct AI personalities"""
        self.ai_personalities = {
            "ml_service_tactical": {
                "personality": AIPersonality.TACTICAL_SPECIALIST,
                "strengths": ["immediate_threats", "defensive_moves", "quick_patterns"],
                "response_time": 0.05,  # 50ms
                "confidence_threshold": 0.7,
                "collaboration_style": "reactive",
            },
            "ml_service_strategic": {
                "personality": AIPersonality.STRATEGIC_PLANNER,
                "strengths": ["long_term_planning", "positional_analysis", "endgame"],
                "response_time": 0.2,  # 200ms
                "confidence_threshold": 0.6,
                "collaboration_style": "deliberate",
            },
            "ml_inference_fast": {
                "personality": AIPersonality.ADAPTIVE_LEARNER,
                "strengths": [
                    "pattern_adaptation",
                    "opponent_modeling",
                    "quick_learning",
                ],
                "response_time": 0.03,  # 30ms
                "confidence_threshold": 0.8,
                "collaboration_style": "adaptive",
            },
        }

    async def register_ai_service(
        self, service_id: str, capabilities: Dict[str, Any], websocket: WebSocket
    ):
        """Register an AI service for coordination"""
        await websocket.accept()

        self.connected_ais[service_id] = {
            "websocket": websocket,
            "capabilities": capabilities,
            "connected_at": time.time(),
            "message_count": 0,
            "last_seen": time.time(),
        }

        # Send welcome message with collaboration instructions
        welcome_msg = AIMessage(
            sender_id="coordination_hub",
            receiver_id=service_id,
            message_type=MessageType.COORDINATION_SIGNAL,
            payload={
                "action": "welcome",
                "your_personality": self.ai_personalities.get(service_id, {}),
                "collaboration_peers": list(self.connected_ais.keys()),
                "shared_knowledge": self._get_relevant_knowledge(service_id),
            },
            timestamp=time.time(),
        )

        await self._send_message(service_id, welcome_msg)
        logging.info(f"AI service {service_id} registered for coordination")

    async def coordinate_prediction(
        self, game_id: str, board_state: List[List[str]], context: Dict[str, Any]
    ) -> Dict[str, Any]:
        """Coordinate multiple AI services for optimal prediction"""

        # Determine which AIs should participate
        participating_ais = self._select_optimal_ai_team(board_state, context)

        # Create coordination request
        coordination_request = {
            "game_id": game_id,
            "board_state": board_state,
            "context": context,
            "collaboration_mode": "ensemble",
            "urgency": self._assess_urgency(board_state),
            "deadline_ms": 150,  # 150ms deadline for response
        }

        # Send requests to participating AIs
        responses = await self._gather_ai_responses(
            participating_ais, coordination_request
        )

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
                        "insight": asdict(enriched_insight),
                        "integration_suggestions": self._get_integration_suggestions(
                            ai_id, enriched_insight
                        ),
                        "expected_benefit": self._estimate_benefit(
                            ai_id, enriched_insight
                        ),
                    },
                    timestamp=time.time(),
                    urgency=5,
                )

                await self._send_message(ai_id, insight_msg)

        # Store in collective memory
        self.collective_memory[f"insight_{time.time()}"] = enriched_insight
        self.collaboration_stats["insight_discoveries"] += 1

    async def emergency_coordination(
        self,
        game_id: str,
        emergency_type: str,
        board_state: List[List[str]],
        context: Dict[str, Any],
    ):
        """Handle emergency situations requiring immediate AI coordination"""

        # Priority override for all AIs
        emergency_msg = AIMessage(
            sender_id="coordination_hub",
            receiver_id="all",
            message_type=MessageType.EMERGENCY_OVERRIDE,
            payload={
                "emergency_type": emergency_type,
                "game_id": game_id,
                "board_state": board_state,
                "context": context,
                "required_response_time_ms": 50,
                "priority_level": "CRITICAL",
            },
            timestamp=time.time(),
            urgency=10,
            requires_response=True,
        )

        # Broadcast to all connected AIs
        emergency_responses = []
        for ai_id in self.connected_ais:
            response = await self._send_urgent_message(ai_id, emergency_msg)
            if response:
                emergency_responses.append(response)

        # Immediate synthesis of emergency responses
        emergency_decision = await self._synthesize_emergency_response(
            emergency_responses
        )

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
                    "strategy_adaptation": strategy_update,
                    "performance_context": performance_analysis,
                    "implementation_priority": "high",
                    "expected_improvement": strategy_update.get(
                        "expected_improvement", 0.1
                    ),
                },
                timestamp=time.time(),
                urgency=7,
            )

            await self._send_message(ai_id, update_msg)

        self.collaboration_stats["strategy_adaptations"] += len(strategy_updates)

    async def cross_model_knowledge_fusion(
        self, topic: str, context: Dict[str, Any]
    ) -> Dict[str, Any]:
        """Fuse knowledge from multiple AI models on a specific topic"""

        # Query all AIs for their knowledge on the topic
        knowledge_requests = []
        for ai_id in self.connected_ais:
            request = AIMessage(
                sender_id="coordination_hub",
                receiver_id=ai_id,
                message_type=MessageType.COORDINATION_SIGNAL,
                payload={
                    "action": "knowledge_query",
                    "topic": topic,
                    "context": context,
                    "detail_level": "high",
                },
                timestamp=time.time(),
                requires_response=True,
            )
            knowledge_requests.append(self._send_message(ai_id, request))

        # Gather responses
        knowledge_responses = await asyncio.gather(
            *knowledge_requests, return_exceptions=True
        )

        # Fuse knowledge using advanced synthesis
        fused_knowledge = await self._fuse_multi_model_knowledge(knowledge_responses)

        # Create new collective insight
        collective_insight = {
            "topic": topic,
            "fused_knowledge": fused_knowledge,
            "contributing_models": list(self.connected_ais.keys()),
            "fusion_confidence": self._calculate_fusion_confidence(knowledge_responses),
            "synthesis_timestamp": time.time(),
            "application_contexts": self._identify_application_contexts(
                fused_knowledge
            ),
        }

        # Store in knowledge base
        self.knowledge_base[f"fusion_{topic}_{time.time()}"] = collective_insight

        return collective_insight

    # Private helper methods
    def _select_optimal_ai_team(
        self, board_state: List[List[str]], context: Dict[str, Any]
    ) -> List[str]:
        """Select optimal AI team based on current situation"""
        team = []

        # Always include tactical specialist for immediate threats
        if "ml_service_tactical" in self.connected_ais:
            team.append("ml_service_tactical")

        # Include strategic planner for complex positions
        move_count = sum(1 for row in board_state for cell in row if cell != "Empty")
        if move_count > 10 and "ml_service_strategic" in self.connected_ais:
            team.append("ml_service_strategic")

        # Include adaptive learner if opponent patterns are available
        if context.get("opponent_id") and "ml_inference_fast" in self.connected_ais:
            team.append("ml_inference_fast")

        return team

    def _assess_urgency(self, board_state: List[List[str]]) -> int:
        """
        Advanced urgency assessment with multi-factor analysis

        Returns urgency score 1-10 based on:
        - Immediate win/loss threats
        - Multiple simultaneous threats
        - Game phase criticality
        - Tempo considerations
        - Pattern-based predictions
        """
        try:
            # Convert board state to numpy array for efficient operations
            board = self._board_to_numpy(board_state)

            # Phase 1: Immediate win/loss detection
            immediate_result = self._check_immediate_wins_losses(board)
            if immediate_result["can_win"]:
                return 10  # Win imminent
            if (
                immediate_result["must_block"]
                and len(immediate_result["block_positions"]) > 1
            ):
                return 9  # Multiple threats to block
            if immediate_result["must_block"]:
                return 8  # Single threat to block

            # Phase 2: Multi-threat analysis
            threat_analysis = self._analyze_threat_landscape(board)
            if threat_analysis["threat_count"] > 2:
                return 7  # Multiple developing threats

            # Phase 3: Opportunity assessment
            opportunities = self._identify_opportunities(board)
            if opportunities["immediate"]:
                return 7  # Immediate opportunities
            if opportunities["fork"]:
                return 6  # Fork opportunities

            # Phase 4: Game phase analysis
            game_phase = self._determine_game_phase(board)
            endgame_bonus = 1 if game_phase == "endgame" else 0

            # Phase 5: Tempo analysis
            tempo_state = self._analyze_tempo(board, threat_analysis)
            tempo_bonus = 1 if tempo_state["is_critical"] else 0

            # Phase 6: Pattern-based urgency
            pattern_urgency = self._assess_pattern_urgency(board)

            # Calculate final urgency score
            base_urgency = 5  # Neutral

            if threat_analysis["threat_count"] > 0:
                base_urgency = 6
            elif opportunities["setup"]:
                base_urgency = 5
            else:
                base_urgency = 4

            # Apply bonuses
            final_urgency = base_urgency + endgame_bonus + tempo_bonus

            # Consider pattern urgency
            if pattern_urgency > final_urgency:
                final_urgency = (final_urgency + pattern_urgency) // 2

            return max(1, min(10, final_urgency))

        except Exception as e:
            logging.error(f"Error in urgency assessment: {str(e)}")
            return 5  # Default to moderate urgency

    async def _gather_ai_responses(
        self, ai_list: List[str], request: Dict[str, Any]
    ) -> List[Dict[str, Any]]:
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
                    requires_response=True,
                )
                tasks.append(self._send_message_with_timeout(ai_id, msg, timeout=0.15))

        raw_responses = await asyncio.gather(*tasks, return_exceptions=True)

        # Filter out exceptions and None values, cast to proper type
        valid_responses: List[Dict[str, Any]] = []
        for response in raw_responses:
            if isinstance(response, dict) and response is not None:
                valid_responses.append(response)

        return valid_responses

    async def _synthesize_collective_decision(
        self, responses: List[Dict[str, Any]], context: Dict[str, Any]
    ) -> Dict[str, Any]:
        """Synthesize multiple AI responses into collective decision"""

        if not responses:
            return {"error": "No valid responses received"}

        # Weight responses based on AI personalities and situation
        weighted_predictions = []
        total_weight = 0

        for response in responses:
            ai_id = response.get("source_ai_id") if isinstance(response, dict) else None
            if ai_id:
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
                probs = response.get("probs", [1 / 7] * 7)
                normalized_weight = weight / total_weight

                for i in range(len(ensemble_probs)):
                    ensemble_probs[i] += probs[i] * normalized_weight

                ensemble_reasoning.append(
                    f"{response.get('source_ai_id')}: {response.get('reasoning', '')}"
                )

            final_move = ensemble_probs.index(max(ensemble_probs))

            return {
                "move": final_move,
                "probs": ensemble_probs,
                "confidence": max(ensemble_probs),
                "source": "collective_intelligence",
                "contributing_ais": [
                    r.get("source_ai_id") for r, _ in weighted_predictions
                ],
                "reasoning": ensemble_reasoning,
                "collaboration_quality": self._assess_collaboration_quality(responses),
            }

        # Fallback to best single response
        best_response = max(responses, key=lambda r: r.get("confidence", 0))
        best_response["source"] = "fallback_best_individual"
        return best_response

    def _calculate_response_weight(
        self,
        response: Dict[str, Any],
        personality: Dict[str, Any],
        context: Dict[str, Any],
    ) -> float:
        """Calculate weight for AI response based on situation"""
        base_weight = 1.0

        # Adjust based on confidence
        confidence = response.get("confidence", 0.5)
        base_weight *= confidence

        # Adjust based on AI strengths and current situation
        strengths = personality.get("strengths", [])

        # Boost tactical specialist in threat situations
        if "immediate_threats" in strengths and context.get("threat_level") == "high":
            base_weight *= 1.5

        # Boost strategic planner in complex positions
        if "long_term_planning" in strengths and context.get("game_phase") == "endgame":
            base_weight *= 1.3

        # Boost adaptive learner when opponent modeling is relevant
        if "opponent_modeling" in strengths and context.get("opponent_id"):
            base_weight *= 1.2

        return base_weight

    async def _send_message(
        self, ai_id: str, message: AIMessage
    ) -> Optional[Dict[str, Any]]:
        """Send message to specific AI service"""
        if ai_id not in self.connected_ais:
            return None

        try:
            websocket = self.connected_ais[ai_id]["websocket"]
            # Convert message to serializable format
            message_dict = {
                "sender_id": message.sender_id,
                "receiver_id": message.receiver_id,
                "message_type": message.message_type.value,  # Convert enum to string
                "payload": message.payload,
                "timestamp": message.timestamp,
                "urgency": message.urgency,
                "requires_response": message.requires_response,
            }
            await websocket.send_text(json.dumps(message_dict))

            self.collaboration_stats["messages_exchanged"] += 1
            self.connected_ais[ai_id]["message_count"] += 1
            self.connected_ais[ai_id]["last_seen"] = time.time()

            # Wait for response if required
            if message.requires_response:
                response = await websocket.receive_text()
                return json.loads(response)

        except Exception as e:
            logging.error(f"Failed to send message to {ai_id}: {e}")
            return None

    async def _send_message_with_timeout(
        self, ai_id: str, message: AIMessage, timeout: float
    ) -> Optional[Dict[str, Any]]:
        """Send message with timeout"""
        try:
            return await asyncio.wait_for(
                self._send_message(ai_id, message), timeout=timeout
            )
        except asyncio.TimeoutError:
            logging.warning(f"Timeout sending message to {ai_id}")
            return None

    def _get_relevant_knowledge(self, service_id: str) -> Dict[str, Any]:
        """Get relevant knowledge for a specific AI service"""
        personality = self.ai_personalities.get(service_id, {})
        strengths = personality.get("strengths", [])

        relevant_knowledge = {}
        for key, knowledge in self.knowledge_base.items():
            if any(strength in knowledge.get("topics", []) for strength in strengths):
                relevant_knowledge[key] = knowledge

        return relevant_knowledge

    async def _enrich_insight(self, insight: AIInsight) -> AIInsight:
        """
        Advanced insight enrichment with validation, context, and meta-analysis

        Enriches insights with:
        - Cross-model validation
        - Historical context
        - Pattern recognition
        - Confidence calibration
        - Meta-strategic analysis
        - Counterfactual reasoning
        """
        try:
            # Create enriched copy with additional attributes
            enriched_insight = AIInsight(
                source_model=insight.source_model,
                insight_type=insight.insight_type,
                confidence=insight.confidence,
                board_state=insight.board_state,
                discovered_pattern=insight.discovered_pattern,
                effectiveness_score=insight.effectiveness_score,
                opponent_context=insight.opponent_context,
            )

            # Phase 1: Validation
            validation_result = await self._validate_insight(enriched_insight)
            enriched_insight.confidence *= validation_result.get(
                "confidence_multiplier", 1.0
            )

            # Add validation status as a dynamic attribute
            if hasattr(enriched_insight, "__dict__"):
                enriched_insight.__dict__["validation_status"] = validation_result.get(
                    "status", "validated"
                )

            # Phase 2: Context Enhancement
            context = await self._enhance_context(enriched_insight)
            if hasattr(enriched_insight, "__dict__"):
                enriched_insight.__dict__["game_phase"] = context.get(
                    "game_phase", "unknown"
                )
                enriched_insight.__dict__["strategic_context"] = context.get(
                    "strategic_implications", []
                )

            # Phase 3: Pattern Analysis
            pattern_analysis = await self._analyze_insight_patterns(enriched_insight)
            if hasattr(enriched_insight, "__dict__"):
                enriched_insight.__dict__["pattern_strength"] = pattern_analysis.get(
                    "strength", 0.5
                )
                enriched_insight.__dict__["related_patterns"] = pattern_analysis.get(
                    "related", []
                )

            # Phase 4: Cross-Model Validation
            cross_validation = await self._cross_validate_insight(enriched_insight)
            if cross_validation["agreement_score"] < 0.5:
                enriched_insight.confidence *= 0.8
                if hasattr(enriched_insight, "__dict__"):
                    enriched_insight.__dict__["validation_warnings"] = (
                        cross_validation.get("dissenting_opinions", [])
                    )

            # Phase 5: Meta-Strategic Analysis
            meta_analysis = await self._perform_meta_analysis(enriched_insight)
            if hasattr(enriched_insight, "__dict__"):
                enriched_insight.__dict__["strategic_framework"] = meta_analysis.get(
                    "framework", "hybrid"
                )
                enriched_insight.__dict__["long_term_implications"] = meta_analysis.get(
                    "implications", []
                )

            # Phase 6: Actionability Enhancement
            actions = await self._enhance_actionability(enriched_insight)
            if hasattr(enriched_insight, "__dict__"):
                enriched_insight.__dict__["recommended_actions"] = actions
                enriched_insight.__dict__["primary_action"] = (
                    actions[0] if actions else None
                )

            # Phase 7: Impact Assessment
            impact = await self._assess_insight_impact(enriched_insight)
            if hasattr(enriched_insight, "__dict__"):
                enriched_insight.__dict__["impact_score"] = impact.get(
                    "immediate_impact", 0.5
                )
                enriched_insight.__dict__["risk_reward_ratio"] = impact.get(
                    "risk_reward_ratio", 1.0
                )

            # Final confidence recalibration
            enriched_insight.confidence = max(
                0.1, min(0.95, enriched_insight.confidence)
            )

            return enriched_insight

        except Exception as e:
            logging.error(f"Error enriching insight: {str(e)}")
            return insight  # Return original on error

    def _find_relevant_ais_for_insight(self, insight: AIInsight) -> List[str]:
        """Find which AIs would benefit from a specific insight"""
        relevant_ais = []

        for ai_id, personality in self.ai_personalities.items():
            if ai_id in self.connected_ais:
                # Check if insight aligns with AI's strengths or weaknesses
                strengths = personality.get("strengths", [])
                if any(strength in insight.insight_type for strength in strengths):
                    relevant_ais.append(ai_id)

        return relevant_ais

    async def _record_collaboration_outcome(
        self,
        game_id: str,
        responses: List[Dict[str, Any]],
        final_decision: Dict[str, Any],
    ):
        """Record the outcome of a collaboration for learning"""
        outcome = {
            "game_id": game_id,
            "timestamp": time.time(),
            "participating_ais": [
                r.get("source_ai_id") for r in responses if r.get("source_ai_id")
            ],
            "final_decision": final_decision,
            "response_count": len(responses),
            "collaboration_success": final_decision.get("confidence", 0) > 0.5,
        }

        self.collective_memory[f"collaboration_{game_id}_{time.time()}"] = outcome
        self.collaboration_stats["successful_collaborations"] += 1

    def _get_integration_suggestions(self, ai_id: str, insight: AIInsight) -> List[str]:
        """Get suggestions for how an AI can integrate an insight"""
        personality = self.ai_personalities.get(ai_id, {})
        suggestions = []

        if "tactical" in personality.get("personality", {}).value:
            suggestions.append("Apply immediate tactical patterns")
            suggestions.append("Update threat detection algorithms")

        if "strategic" in personality.get("personality", {}).value:
            suggestions.append("Incorporate into long-term planning")
            suggestions.append("Update positional evaluation")

        if "adaptive" in personality.get("personality", {}).value:
            suggestions.append("Adapt pattern recognition")
            suggestions.append("Update opponent modeling")

        return suggestions

    def _estimate_benefit(self, ai_id: str, insight: AIInsight) -> float:
        """Estimate the benefit an AI would get from an insight"""
        personality = self.ai_personalities.get(ai_id, {})
        base_benefit = insight.effectiveness_score

        # Adjust based on AI personality alignment
        if (
            "tactical" in personality.get("personality", {}).value
            and "immediate" in insight.insight_type
        ):
            base_benefit *= 1.3

        if (
            "strategic" in personality.get("personality", {}).value
            and "long_term" in insight.insight_type
        ):
            base_benefit *= 1.2

        if (
            "adaptive" in personality.get("personality", {}).value
            and "pattern" in insight.insight_type
        ):
            base_benefit *= 1.4

        return min(base_benefit, 1.0)  # Cap at 1.0

    async def _send_urgent_message(
        self, ai_id: str, message: AIMessage
    ) -> Optional[Dict[str, Any]]:
        """Send urgent message with higher priority"""
        if ai_id not in self.connected_ais:
            return None

        try:
            websocket = self.connected_ais[ai_id]["websocket"]
            # Convert message to serializable format
            message_dict = {
                "sender_id": message.sender_id,
                "receiver_id": message.receiver_id,
                "message_type": message.message_type.value,  # Convert enum to string
                "payload": message.payload,
                "timestamp": message.timestamp,
                "urgency": message.urgency,
                "requires_response": message.requires_response,
            }
            await websocket.send_text(json.dumps(message_dict))

            # For urgent messages, wait for immediate response
            if message.requires_response:
                response = await websocket.receive_text()
                return json.loads(response)

        except Exception as e:
            logging.error(f"Failed to send urgent message to {ai_id}: {e}")
            return None

    async def _synthesize_emergency_response(
        self, emergency_responses: List[Dict[str, Any]]
    ) -> Dict[str, Any]:
        """Synthesize emergency responses into immediate action"""
        if not emergency_responses:
            return {"error": "No emergency responses received"}

        # Take the highest confidence response for emergency situations
        best_response = max(emergency_responses, key=lambda r: r.get("confidence", 0))

        return {
            "emergency_action": best_response.get("move"),
            "confidence": best_response.get("confidence", 0),
            "source": "emergency_synthesis",
            "response_count": len(emergency_responses),
            "timestamp": time.time(),
        }

    async def _analyze_collective_performance(
        self, game_results: List[Dict[str, Any]]
    ) -> Dict[str, Any]:
        """Analyze collective performance across multiple games"""
        if not game_results:
            return {"error": "No game results to analyze"}

        analysis = {
            "total_games": len(game_results),
            "win_rate": sum(1 for r in game_results if r.get("result") == "win")
            / len(game_results),
            "average_confidence": sum(r.get("confidence", 0) for r in game_results)
            / len(game_results),
            "ai_performance": {},
            "collaboration_effectiveness": 0.0,
        }

        # Analyze individual AI performance
        for ai_id in self.connected_ais:
            ai_games = [
                r for r in game_results if ai_id in r.get("participating_ais", [])
            ]
            if ai_games:
                analysis["ai_performance"][ai_id] = {
                    "games": len(ai_games),
                    "win_rate": sum(1 for r in ai_games if r.get("result") == "win")
                    / len(ai_games),
                    "avg_confidence": sum(r.get("confidence", 0) for r in ai_games)
                    / len(ai_games),
                }

        return analysis

    def _identify_improvement_areas(
        self, performance_analysis: Dict[str, Any]
    ) -> Dict[str, List[str]]:
        """Identify areas where each AI can improve"""
        improvement_areas = {}

        for ai_id, performance in performance_analysis.get(
            "ai_performance", {}
        ).items():
            areas = []

            if performance.get("win_rate", 0) < 0.6:
                areas.append("win_rate")

            if performance.get("avg_confidence", 0) < 0.7:
                areas.append("confidence")

            if areas:
                improvement_areas[ai_id] = areas

        return improvement_areas

    async def _generate_strategy_adaptation(
        self,
        ai_id: str,
        improvement_areas: List[str],
        performance_analysis: Dict[str, Any],
    ) -> Dict[str, Any]:
        """Generate strategy adaptation for a specific AI"""
        personality = self.ai_personalities.get(ai_id, {})

        adaptation = {
            "ai_id": ai_id,
            "improvement_areas": improvement_areas,
            "strategy_changes": [],
            "expected_improvement": 0.1,
        }

        if "win_rate" in improvement_areas:
            adaptation["strategy_changes"].append(
                "Increase defensive play in losing positions"
            )
            adaptation["strategy_changes"].append("Improve endgame calculation")

        if "confidence" in improvement_areas:
            adaptation["strategy_changes"].append(
                "Reduce overconfidence in complex positions"
            )
            adaptation["strategy_changes"].append("Improve uncertainty estimation")

        return adaptation

    async def _fuse_multi_model_knowledge(
        self, knowledge_responses: List[Any]
    ) -> Dict[str, Any]:
        """Fuse knowledge from multiple AI models"""
        valid_responses = [
            r
            for r in knowledge_responses
            if not isinstance(r, Exception) and r is not None
        ]

        if not valid_responses:
            return {"error": "No valid knowledge responses"}

        fused_knowledge = {
            "combined_insights": [],
            "consensus_areas": [],
            "conflicting_views": [],
            "synthesis_confidence": 0.0,
        }

        # Extract insights from all responses
        all_insights = []
        for response in valid_responses:
            if isinstance(response, dict):
                insights = response.get("insights", [])
                all_insights.extend(insights)

        # Group similar insights
        insight_groups = {}
        for insight in all_insights:
            key = insight.get("type", "general")
            if key not in insight_groups:
                insight_groups[key] = []
            insight_groups[key].append(insight)

        # Create consensus insights
        for insight_type, insights in insight_groups.items():
            if len(insights) > 1:
                # Multiple AIs agree on this insight
                consensus_insight = {
                    "type": insight_type,
                    "confidence": sum(i.get("confidence", 0) for i in insights)
                    / len(insights),
                    "supporting_ais": len(insights),
                    "synthesis": f"Consensus among {len(insights)} AIs on {insight_type}",
                }
                fused_knowledge["consensus_areas"].append(consensus_insight)
            else:
                # Single AI insight
                fused_knowledge["combined_insights"].append(insights[0])

        return fused_knowledge

    def _calculate_fusion_confidence(self, knowledge_responses: List[Any]) -> float:
        """Calculate confidence in the fused knowledge"""
        valid_responses = [
            r
            for r in knowledge_responses
            if not isinstance(r, Exception) and r is not None
        ]

        if not valid_responses:
            return 0.0

        # Calculate confidence based on response quality and agreement
        total_confidence = 0.0
        response_count = len(valid_responses)

        for response in valid_responses:
            if isinstance(response, dict):
                confidence = response.get("confidence", 0.5)
                total_confidence += confidence

        return total_confidence / response_count if response_count > 0 else 0.0

    def _identify_application_contexts(
        self, fused_knowledge: Dict[str, Any]
    ) -> List[str]:
        """Identify contexts where the fused knowledge can be applied"""
        contexts = []

        if fused_knowledge.get("consensus_areas"):
            contexts.append("high_confidence_decisions")

        if fused_knowledge.get("combined_insights"):
            contexts.append("exploratory_analysis")

        if fused_knowledge.get("conflicting_views"):
            contexts.append("uncertainty_management")

        return contexts

    def _assess_collaboration_quality(self, responses: List[Dict[str, Any]]) -> float:
        """Assess the quality of collaboration based on responses"""
        if not responses:
            return 0.0

        # Calculate collaboration quality based on:
        # 1. Response diversity
        # 2. Confidence levels
        # 3. Response consistency

        confidence_sum = sum(r.get("confidence", 0) for r in responses)
        avg_confidence = confidence_sum / len(responses)

        # Diversity bonus (different AIs contributing)
        unique_ais = len(
            set(r.get("source_ai_id") for r in responses if r.get("source_ai_id"))
        )
        diversity_bonus = min(unique_ais / len(self.connected_ais), 1.0) * 0.2

        # Consistency bonus (similar confidence levels)
        confidence_variance = sum(
            (r.get("confidence", 0) - avg_confidence) ** 2 for r in responses
        ) / len(responses)
        consistency_bonus = max(0, 0.1 - confidence_variance) * 2

        return min(avg_confidence + diversity_bonus + consistency_bonus, 1.0)

    async def handle_continuous_learning_update(
        self, update_type: str, data: Dict[str, Any]
    ):
        """Handle updates from the continuous learning system"""
        if update_type == "loss_pattern_discovered":
            # Broadcast critical loss pattern to all AIs
            pattern_insight = AIInsight(
                source_model="continuous_learning",
                insight_type=f"critical_{data['pattern']}_vulnerability",
                confidence=0.95,
                board_state=data.get("board", []),
                discovered_pattern=data["pattern"],
                effectiveness_score=data.get("severity", 0.8),
                opponent_context="human_expert",
            )
            await self.share_learning_insight("continuous_learning", pattern_insight)

        elif update_type == "model_improved":
            # Notify all AIs about model improvements
            for ai_id in self.connected_ais:
                update_msg = AIMessage(
                    sender_id="continuous_learning",
                    receiver_id=ai_id,
                    message_type=MessageType.STRATEGY_UPDATE,
                    payload={
                        "update_type": "model_enhancement",
                        "improvements": data.get("improvements", {}),
                        "version": data.get("version"),
                        "recommendation": "Consider updating local strategies",
                    },
                    timestamp=time.time(),
                    urgency=7,
                )
                await self._send_message(ai_id, update_msg)

        elif update_type == "pattern_defense_learned":
            # Share new defense strategies
            await self._broadcast_defense_strategies(data.get("defenses", {}))

    async def _broadcast_defense_strategies(self, defenses: Dict[str, Any]):
        """Broadcast learned defense strategies to all AIs"""
        for pattern, defense in defenses.items():
            # Create strategy update for each pattern
            strategy_update = {
                "pattern_type": pattern,
                "critical_positions": defense.get("critical_positions", []),
                "blocking_moves": defense.get("blocking_moves", []),
                "confidence": defense.get("confidence", 0.8),
                "source": "continuous_learning_system",
                "games_tested": defense.get("games_tested", 0),
            }

            # Broadcast to all connected AIs
            for ai_id, ai_info in self.connected_ais.items():
                if ai_info.get("websocket"):
                    try:
                        await ai_info["websocket"].send_text(
                            json.dumps(
                                {
                                    "type": "defense_strategy_update",
                                    "pattern": pattern,
                                    "strategy": strategy_update,
                                    "timestamp": time.time(),
                                }
                            )
                        )
                    except Exception as e:
                        logging.error(
                            f"Failed to send defense strategy to {ai_id}: {e}"
                        )

        self.collaboration_stats["strategy_adaptations"] += len(defenses)

    async def request_collective_pattern_analysis(
        self, board_state: List[List[str]], threat_patterns: List[str]
    ) -> Dict[str, Any]:
        """Request collective analysis of threat patterns from all AIs"""
        analysis_results = []

        # Request analysis from each AI personality
        for ai_id, ai_info in self.connected_ais.items():
            personality = self.ai_personalities.get(ai_id, {})

            # Skip if AI doesn't specialize in pattern analysis
            if "pattern" not in personality.get("strengths", []):
                continue

            analysis_request = {
                "type": "pattern_analysis_request",
                "board_state": board_state,
                "patterns": threat_patterns,
                "urgency": 8,
            }

            if ai_info.get("websocket"):
                try:
                    await ai_info["websocket"].send_text(json.dumps(analysis_request))
                    # Would normally await response here
                    analysis_results.append(
                        {
                            "ai_id": ai_id,
                            "personality": personality.get("personality"),
                            "analysis": "pending",
                        }
                    )
                except Exception as e:
                    logging.error(f"Failed to request analysis from {ai_id}: {e}")

        return {
            "collective_analysis": analysis_results,
            "timestamp": time.time(),
            "patterns_analyzed": threat_patterns,
        }

    # Helper methods for enhanced _assess_urgency
    def _board_to_numpy(self, board_state: List[List[str]]) -> np.ndarray:
        """Convert board state to numpy array"""
        mapping = {"X": 1, "O": 2, "": 0, " ": 0, None: 0}
        board = np.zeros((6, 7), dtype=int)

        for i, row in enumerate(board_state):
            for j, cell in enumerate(row):
                board[i, j] = mapping.get(cell, 0)

        return board

    def _check_immediate_wins_losses(self, board: np.ndarray) -> Dict[str, Any]:
        """Check for immediate win opportunities or must-block positions"""
        result = {
            "can_win": False,
            "win_positions": [],
            "must_block": False,
            "block_positions": [],
        }

        for col in range(7):
            row = self._get_next_row(board, col)
            if row is None:
                continue

            # Check if player 1 can win
            board[row, col] = 1
            if self._check_win(board, row, col, 1):
                result["can_win"] = True
                result["win_positions"].append((row, col))
            board[row, col] = 0

            # Check if player 2 can win (must block)
            board[row, col] = 2
            if self._check_win(board, row, col, 2):
                result["must_block"] = True
                result["block_positions"].append((row, col))
            board[row, col] = 0

        return result

    def _analyze_threat_landscape(self, board: np.ndarray) -> Dict[str, Any]:
        """Analyze all threats on the board"""
        threats = {"immediate": [], "developing": [], "threat_count": 0}

        # Check all positions for threats
        for row in range(6):
            for col in range(7):
                if board[row, col] == 0:
                    # Check threats for both players
                    for player in [1, 2]:
                        threat_level = self._evaluate_position_threat(
                            board, row, col, player
                        )
                        if threat_level > 0:
                            if player == 2:  # Opponent threat
                                threats["immediate"].append((row, col))
                            else:  # Our opportunity
                                threats["developing"].append((row, col))

        threats["threat_count"] = (
            len(threats["immediate"]) + len(threats["developing"]) * 0.5
        )
        return threats

    def _identify_opportunities(self, board: np.ndarray) -> Dict[str, List]:
        """Identify winning opportunities"""
        opportunities = {"immediate": [], "setup": [], "fork": []}

        for col in range(7):
            row = self._get_next_row(board, col)
            if row is None:
                continue

            board[row, col] = 1

            # Check for immediate wins
            if self._check_win(board, row, col, 1):
                opportunities["immediate"].append((row, col))
            else:
                # Check for setup moves
                if self._creates_future_threat(board, row, col):
                    opportunities["setup"].append((row, col))

                # Check for fork opportunities
                if self._creates_fork(board, row, col):
                    opportunities["fork"].append((row, col))

            board[row, col] = 0

        return opportunities

    def _determine_game_phase(self, board: np.ndarray) -> str:
        """Determine current game phase"""
        pieces_played = np.count_nonzero(board)

        if pieces_played < 8:
            return "opening"
        elif pieces_played < 24:
            return "midgame"
        else:
            return "endgame"

    def _analyze_tempo(
        self, board: np.ndarray, threat_analysis: Dict
    ) -> Dict[str, Any]:
        """Analyze tempo and initiative"""
        tempo_state = {"is_critical": False, "initiative": "neutral"}

        our_threats = len(threat_analysis.get("developing", []))
        opp_threats = len(threat_analysis.get("immediate", []))

        if opp_threats > our_threats + 1:
            tempo_state["is_critical"] = True
            tempo_state["initiative"] = "opponent"
        elif our_threats > opp_threats:
            tempo_state["initiative"] = "ours"

        return tempo_state

    def _assess_pattern_urgency(self, board: np.ndarray) -> int:
        """Assess urgency based on board patterns"""
        # Check for critical patterns
        if self._has_zugzwang_pattern(board):
            return 8
        if self._has_forced_move_pattern(board):
            return 7
        return 4

    # Additional helper methods
    def _get_next_row(self, board: np.ndarray, col: int) -> Optional[int]:
        """Get the next available row in a column"""
        for row in range(5, -1, -1):
            if board[row, col] == 0:
                return row
        return None

    def _check_win(self, board: np.ndarray, row: int, col: int, player: int) -> bool:
        """Check if placing a piece at (row, col) results in a win"""
        # Horizontal check
        count = 1
        # Check left
        j = col - 1
        while j >= 0 and board[row, j] == player:
            count += 1
            j -= 1
        # Check right
        j = col + 1
        while j < 7 and board[row, j] == player:
            count += 1
            j += 1
        if count >= 4:
            return True

        # Vertical check
        count = 1
        # Check down
        i = row + 1
        while i < 6 and board[i, col] == player:
            count += 1
            i += 1
        # Check up
        i = row - 1
        while i >= 0 and board[i, col] == player:
            count += 1
            i -= 1
        if count >= 4:
            return True

        # Diagonal check (top-left to bottom-right)
        count = 1
        i, j = row - 1, col - 1
        while i >= 0 and j >= 0 and board[i, j] == player:
            count += 1
            i -= 1
            j -= 1
        i, j = row + 1, col + 1
        while i < 6 and j < 7 and board[i, j] == player:
            count += 1
            i += 1
            j += 1
        if count >= 4:
            return True

        # Diagonal check (top-right to bottom-left)
        count = 1
        i, j = row - 1, col + 1
        while i >= 0 and j < 7 and board[i, j] == player:
            count += 1
            i -= 1
            j += 1
        i, j = row + 1, col - 1
        while i < 6 and j >= 0 and board[i, j] == player:
            count += 1
            i += 1
            j -= 1
        if count >= 4:
            return True

        return False

    def _evaluate_position_threat(
        self, board: np.ndarray, row: int, col: int, player: int
    ) -> float:
        """Evaluate threat level of a position"""
        board[row, col] = player
        threat_level = 0

        # Check how many directions can form 4
        directions = [
            [(0, 1), (0, -1)],  # Horizontal
            [(1, 0), (-1, 0)],  # Vertical
            [(1, 1), (-1, -1)],  # Diagonal 1
            [(1, -1), (-1, 1)],  # Diagonal 2
        ]

        for direction in directions:
            count = 1
            for dr, dc in direction:
                r, c = row + dr, col + dc
                while 0 <= r < 6 and 0 <= c < 7 and board[r, c] == player:
                    count += 1
                    r += dr
                    c += dc

            if count >= 3:
                threat_level += 1.0
            elif count >= 2:
                threat_level += 0.5

        board[row, col] = 0
        return threat_level

    def _creates_future_threat(self, board: np.ndarray, row: int, col: int) -> bool:
        """Check if a move creates future threats"""
        # Check if this move enables a winning position next turn
        threat_count = 0

        for next_col in range(7):
            next_row = self._get_next_row(board, next_col)
            if next_row is not None:
                board[next_row, next_col] = 1
                if self._check_win(board, next_row, next_col, 1):
                    threat_count += 1
                board[next_row, next_col] = 0

        return threat_count >= 2

    def _creates_fork(self, board: np.ndarray, row: int, col: int) -> bool:
        """Check if a move creates a fork (multiple winning threats)"""
        win_positions = 0

        for c in range(7):
            if c == col:
                continue
            r = self._get_next_row(board, c)
            if r is not None:
                board[r, c] = 1
                if self._check_win(board, r, c, 1):
                    win_positions += 1
                board[r, c] = 0

        return win_positions >= 2

    def _has_zugzwang_pattern(self, board: np.ndarray) -> bool:
        """Check for zugzwang patterns (forced move situations)"""
        # Simplified check for positions where any move leads to disadvantage
        empty_cols = [
            col for col in range(7) if self._get_next_row(board, col) is not None
        ]

        if len(empty_cols) <= 3:
            # In endgame, check if all moves lead to opponent wins
            bad_moves = 0
            for col in empty_cols:
                row = self._get_next_row(board, col)
                board[row, col] = 1
                # Check if opponent can win after our move
                opp_wins = False
                for opp_col in range(7):
                    opp_row = self._get_next_row(board, opp_col)
                    if opp_row is not None:
                        board[opp_row, opp_col] = 2
                        if self._check_win(board, opp_row, opp_col, 2):
                            opp_wins = True
                        board[opp_row, opp_col] = 0
                        if opp_wins:
                            break
                board[row, col] = 0
                if opp_wins:
                    bad_moves += 1

            return bad_moves == len(empty_cols)

        return False

    def _has_forced_move_pattern(self, board: np.ndarray) -> bool:
        """Check if there's only one viable move"""
        immediate = self._check_immediate_wins_losses(board)

        # Must block immediate loss
        if immediate["must_block"] and len(immediate["block_positions"]) == 1:
            return True

        # Only one non-losing move
        safe_moves = []
        for col in range(7):
            row = self._get_next_row(board, col)
            if row is not None:
                board[row, col] = 1
                # Check if opponent wins after this
                safe = True
                for opp_col in range(7):
                    opp_row = self._get_next_row(board, opp_col)
                    if opp_row is not None:
                        board[opp_row, opp_col] = 2
                        if self._check_win(board, opp_row, opp_col, 2):
                            safe = False
                        board[opp_row, opp_col] = 0
                        if not safe:
                            break
                board[row, col] = 0
                if safe:
                    safe_moves.append(col)

        return len(safe_moves) == 1

    # Helper methods for enhanced _enrich_insight
    async def _validate_insight(self, insight: AIInsight) -> Dict[str, Any]:
        """Validate insight through multiple checks"""
        validation = {
            "status": "validated",
            "confidence_multiplier": 1.0,
            "warnings": [],
        }

        # Check board state validity
        if insight.board_state:
            if not self._is_valid_board_state(insight.board_state):
                validation["status"] = "invalid_board"
                validation["confidence_multiplier"] = 0.5
                validation["warnings"].append("Invalid board state detected")

        # Check confidence bounds
        if not 0 <= insight.confidence <= 1:
            validation["confidence_multiplier"] = 0.8
            validation["warnings"].append("Confidence out of bounds")

        # Check pattern validity
        if insight.discovered_pattern and not self._is_valid_pattern(
            insight.discovered_pattern
        ):
            validation["confidence_multiplier"] *= 0.9
            validation["warnings"].append("Pattern validation failed")

        return validation

    async def _enhance_context(self, insight: AIInsight) -> Dict[str, Any]:
        """Add game context to insight"""
        board = (
            self._board_to_numpy(insight.board_state) if insight.board_state else None
        )

        context = {
            "game_phase": (
                self._determine_game_phase(board) if board is not None else "unknown"
            ),
            "strategic_implications": [],
        }

        # Add strategic implications based on insight type
        if "tactical" in insight.insight_type:
            context["strategic_implications"].append("Immediate action required")
        if "pattern" in insight.insight_type:
            context["strategic_implications"].append("Recurring situation detected")
        if "opponent" in insight.insight_type:
            context["strategic_implications"].append("Opponent behavior analysis")

        return context

    async def _analyze_insight_patterns(self, insight: AIInsight) -> Dict[str, Any]:
        """Analyze patterns related to the insight"""
        analysis = {"strength": 0.5, "related": []}

        if insight.discovered_pattern:
            # Calculate pattern strength based on effectiveness
            analysis["strength"] = min(insight.effectiveness_score * 1.2, 1.0)

            # Find related patterns (simplified)
            if "win" in insight.discovered_pattern:
                analysis["related"].append("winning_sequences")
            if "block" in insight.discovered_pattern:
                analysis["related"].append("defensive_patterns")
            if "fork" in insight.discovered_pattern:
                analysis["related"].append("multi_threat_patterns")

        return analysis

    async def _cross_validate_insight(self, insight: AIInsight) -> Dict[str, Any]:
        """Cross-validate insight with other models"""
        validation = {
            "agreement_score": 0.7,  # Default moderate agreement
            "dissenting_opinions": [],
        }

        # Simulate cross-validation based on insight source
        if insight.source_model == "experimental_ai":
            validation["agreement_score"] = 0.6
            validation["dissenting_opinions"].append("Conservative models disagree")
        elif insight.source_model == "ml_inference_fast":
            validation["agreement_score"] = 0.8

        return validation

    async def _perform_meta_analysis(self, insight: AIInsight) -> Dict[str, Any]:
        """Perform meta-strategic analysis"""
        meta = {"framework": "hybrid", "implications": []}

        # Determine strategic framework
        if insight.effectiveness_score > 0.8:
            meta["framework"] = "aggressive"
            meta["implications"].append("High confidence warrants bold play")
        elif insight.effectiveness_score < 0.4:
            meta["framework"] = "defensive"
            meta["implications"].append("Low confidence suggests caution")

        # Add long-term implications
        if "pattern" in insight.insight_type:
            meta["implications"].append("Pattern knowledge can be reused")
        if "opponent" in insight.insight_type:
            meta["implications"].append("Opponent modeling improved")

        return meta

    async def _enhance_actionability(self, insight: AIInsight) -> List[Dict[str, Any]]:
        """Generate actionable recommendations"""
        actions = []

        # Generate actions based on insight type
        if "immediate_threat" in insight.insight_type:
            actions.append(
                {
                    "action": "block_threat",
                    "urgency": "high",
                    "confidence": insight.confidence,
                }
            )

        if "winning_opportunity" in insight.insight_type:
            actions.append(
                {
                    "action": "execute_win",
                    "urgency": "critical",
                    "confidence": insight.confidence,
                }
            )

        if "pattern" in insight.insight_type:
            actions.append(
                {
                    "action": "apply_pattern",
                    "urgency": "medium",
                    "confidence": insight.confidence * 0.9,
                }
            )

        # Sort by urgency
        urgency_order = {"critical": 0, "high": 1, "medium": 2, "low": 3}
        actions.sort(key=lambda x: urgency_order.get(x["urgency"], 4))

        return actions

    async def _assess_insight_impact(self, insight: AIInsight) -> Dict[str, Any]:
        """Assess the potential impact of an insight"""
        impact = {"immediate_impact": 0.5, "risk_reward_ratio": 1.0}

        # Calculate immediate impact
        if insight.effectiveness_score > 0.7:
            impact["immediate_impact"] = 0.8
        elif insight.effectiveness_score < 0.3:
            impact["immediate_impact"] = 0.2

        # Calculate risk-reward ratio
        if "winning" in insight.insight_type:
            impact["risk_reward_ratio"] = 3.0  # High reward, low risk
        elif "defensive" in insight.insight_type:
            impact["risk_reward_ratio"] = 0.5  # Low reward, high risk if not taken

        return impact

    def _is_valid_board_state(self, board_state: List[List[str]]) -> bool:
        """Check if board state is valid"""
        if not board_state or len(board_state) != 6:
            return False

        for row in board_state:
            if len(row) != 7:
                return False
            for cell in row:
                if cell not in ["X", "O", "", " ", None]:
                    return False

        return True

    def _is_valid_pattern(self, pattern: str) -> bool:
        """Check if pattern string is valid"""
        valid_patterns = [
            "winning_sequence",
            "blocking_pattern",
            "fork_opportunity",
            "defensive_setup",
            "offensive_setup",
            "tempo_gain",
        ]

        return any(valid in pattern.lower() for valid in valid_patterns)


# Global coordination hub instance
coordination_hub = AICoordinationHub()

# FastAPI app for coordination endpoints
app = FastAPI(title="AI Coordination Hub", version="1.0.0")

# Add CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://localhost:3001"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.websocket("/ws/{ai_service_id}")
async def websocket_endpoint(websocket: WebSocket, ai_service_id: str):
    """WebSocket endpoint for AI service coordination"""
    await coordination_hub.register_ai_service(ai_service_id, {}, websocket)

    try:
        while True:
            data = await websocket.receive_text()
            message = json.loads(data)

            # Handle incoming messages from AI services
            if message.get("type") == "insight_sharing":
                insight = AIInsight(**message["payload"])
                await coordination_hub.share_learning_insight(ai_service_id, insight)

            elif message.get("type") == "coordination_request":
                result = await coordination_hub.coordinate_prediction(
                    message["game_id"], message["board_state"], message["context"]
                )
                await websocket.send_text(json.dumps(result))

            elif message.get("type") == "continuous_learning_update":
                # Handle updates from continuous learning system
                await coordination_hub.handle_continuous_learning_update(
                    message["update_type"], message["data"]
                )

            elif message.get("type") == "pattern_analysis_request":
                # Collective pattern analysis request
                result = await coordination_hub.request_collective_pattern_analysis(
                    message["board_state"], message["patterns"]
                )
                await websocket.send_text(json.dumps(result))

            elif message.get("type") == "defense_coordination":
                # Coordinate defensive strategies
                await coordination_hub._broadcast_defense_strategies(
                    message.get("defenses", {})
                )

    except Exception as e:
        logging.error(f"WebSocket error for {ai_service_id}: {e}")
    finally:
        if ai_service_id in coordination_hub.connected_ais:
            del coordination_hub.connected_ais[ai_service_id]


@app.get("/health")
async def health_check():
    """Health check endpoint"""
    return {
        "status": "healthy",
        "service": "ai_coordination_hub",
        "timestamp": time.time(),
    }


@app.get("/coordination/stats")
async def get_coordination_stats():
    """Get coordination statistics"""
    return {
        "connected_ais": len(coordination_hub.connected_ais),
        "stats": coordination_hub.collaboration_stats,
        "active_games": len(coordination_hub.active_games),
        "knowledge_base_size": len(coordination_hub.knowledge_base),
    }


if __name__ == "__main__":
    import os

    import uvicorn

    # Use environment variable for host binding, defaulting to localhost for security
    host = os.environ.get("AI_COORDINATION_HOST", "127.0.0.1")
    port = int(os.environ.get("AI_COORDINATION_PORT", "8002"))
    uvicorn.run("ai_coordination_hub:app", host=host, port=port, reload=False)
