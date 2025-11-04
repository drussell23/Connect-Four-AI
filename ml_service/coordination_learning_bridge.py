"""
🌉 COORDINATION-LEARNING BRIDGE
================================

Integrates the Continuous Learning system with the AI Coordination Hub,
enabling real-time knowledge sharing and collective learning across all AI services.

Features:
- Broadcasts loss patterns to all connected AI services
- Shares learning insights from model updates
- Coordinates defensive strategies across AI personalities
- Enables collective pattern recognition
"""

import asyncio
import json
import logging
from dataclasses import asdict, dataclass
from datetime import datetime
from typing import Any, Dict, List, Optional

import websockets

logger = logging.getLogger(__name__)


@dataclass
class LearningBroadcast:
    """Learning event to broadcast across AI services"""

    event_type: str  # 'loss_pattern', 'model_update', 'pattern_insight'
    source: str
    timestamp: float
    data: Dict[str, Any]
    priority: int = 5  # 1-10


class CoordinationLearningBridge:
    """Bridge between Continuous Learning and AI Coordination Hub"""

    def __init__(
        self,
        cl_ws_url: str = "ws://localhost:8005/ws",
        coord_ws_url: str = "ws://localhost:8003/ws/continuous_learning",
    ):
        self.cl_ws_url = cl_ws_url
        self.coord_ws_url = coord_ws_url
        self.cl_websocket: Optional[websockets.WebSocketClientProtocol] = None
        self.coord_websocket: Optional[websockets.WebSocketClientProtocol] = None
        self.running = False

        # Metrics
        self.bridge_metrics = {
            "patterns_shared": 0,
            "insights_broadcast": 0,
            "collective_learnings": 0,
            "coordination_requests": 0,
        }

    async def start(self):
        """Start the bridge service"""
        self.running = True

        # Connect to both services
        await self.connect_to_services()

        # Start message routing
        await asyncio.gather(
            self.route_cl_to_coordination(),
            self.route_coordination_to_cl(),
            self.heartbeat_loop(),
        )

    async def connect_to_services(self):
        """Establish WebSocket connections"""
        try:
            # Connect to Continuous Learning
            self.cl_websocket = await websockets.connect(self.cl_ws_url)
            logger.info(f"Connected to Continuous Learning at {self.cl_ws_url}")

            # Send handshake
            await self.cl_websocket.send(
                json.dumps(
                    {
                        "type": "handshake",
                        "service": "coordination-bridge",
                        "version": "1.0.0",
                    }
                )
            )

            # Connect to AI Coordination Hub
            self.coord_websocket = await websockets.connect(self.coord_ws_url)
            logger.info(f"Connected to AI Coordination Hub at {self.coord_ws_url}")

        except Exception as e:
            logger.error(f"Failed to connect to services: {e}")
            raise

    async def route_cl_to_coordination(self):
        """Route messages from Continuous Learning to Coordination Hub"""
        while self.running:
            try:
                if not self.cl_websocket:
                    await asyncio.sleep(1)
                    continue

                message = await self.cl_websocket.recv()
                data = json.loads(message)

                # Transform and route based on message type
                if data["type"] == "pattern_insights":
                    await self.broadcast_pattern_insights(data["data"])

                elif data["type"] == "model_updated":
                    await self.broadcast_model_update(data["data"])

                elif data["type"] == "learning_progress":
                    await self.share_learning_progress(data["data"])

            except websockets.exceptions.ConnectionClosed:
                logger.warning("Continuous Learning connection closed, reconnecting...")
                await self.reconnect_cl()
            except Exception as e:
                logger.error(f"Error routing CL message: {e}")

    async def route_coordination_to_cl(self):
        """Route messages from Coordination Hub to Continuous Learning"""
        while self.running:
            try:
                if not self.coord_websocket:
                    await asyncio.sleep(1)
                    continue

                message = await self.coord_websocket.recv()
                data = json.loads(message)

                # Handle coordination insights
                if data.get("type") == "collective_pattern":
                    await self.send_collective_pattern_to_cl(data)

                elif data.get("type") == "defense_coordination":
                    await self.coordinate_defense_learning(data)

            except websockets.exceptions.ConnectionClosed:
                logger.warning("Coordination Hub connection closed, reconnecting...")
                await self.reconnect_coordination()
            except Exception as e:
                logger.error(f"Error routing coordination message: {e}")

    async def broadcast_pattern_insights(self, insights: Dict[str, Any]):
        """Broadcast pattern insights to all AI services via Coordination Hub"""
        logger.info(f"Broadcasting pattern insights: {insights.get('patterns', {})}")

        # Create insight sharing message
        message = {
            "type": "insight_sharing",
            "payload": {
                "source_model": "continuous_learning",
                "insight_type": "loss_pattern_analysis",
                "confidence": 0.9,
                "board_state": [],  # Would be filled with actual board
                "discovered_pattern": json.dumps(insights.get("patterns", {})),
                "effectiveness_score": 0.8,
                "opponent_context": "human_player",
            },
        }

        if self.coord_websocket:
            await self.coord_websocket.send(json.dumps(message))
            self.bridge_metrics["patterns_shared"] += 1

    async def broadcast_model_update(self, update_data: Dict[str, Any]):
        """Broadcast model updates to coordination hub"""
        logger.info(f"Broadcasting model update v{update_data.get('version')}")

        # Share improvements across AI services
        improvements = update_data.get("improvements", {})

        for pattern, improvement in improvements.items():
            if pattern.endswith("_defense") and improvement > 0:
                message = {
                    "type": "strategy_update",
                    "payload": {
                        "update_type": "defense_improvement",
                        "pattern": pattern.replace("_defense", ""),
                        "improvement_rate": improvement,
                        "model_version": update_data.get("version"),
                        "timestamp": update_data.get("timestamp"),
                    },
                }

                if self.coord_websocket:
                    await self.coord_websocket.send(json.dumps(message))

        self.bridge_metrics["insights_broadcast"] += 1

    async def share_learning_progress(self, progress: Dict[str, Any]):
        """Share learning progress with coordination hub"""
        # Only share significant progress updates
        if progress.get("lossesAnalyzed", 0) % 10 == 0:
            message = {
                "type": "learning_status",
                "payload": {
                    "games_processed": progress.get("gamesProcessed", 0),
                    "losses_analyzed": progress.get("lossesAnalyzed", 0),
                    "buffer_utilization": progress.get("bufferSize", 0)
                    / 100000,  # Normalized
                },
            }

            if self.coord_websocket:
                await self.coord_websocket.send(json.dumps(message))

    async def send_collective_pattern_to_cl(self, pattern_data: Dict[str, Any]):
        """Send collectively discovered patterns back to continuous learning"""
        logger.info("Sending collective pattern discovery to CL")

        # Transform coordination pattern to CL format
        cl_message = {
            "type": "external_pattern_insight",
            "source": "ai_coordination_collective",
            "pattern": pattern_data.get("pattern_type"),
            "confidence": pattern_data.get("collective_confidence", 0.8),
            "discovered_by": pattern_data.get("discovering_ais", []),
            "recommended_training_focus": pattern_data.get("training_suggestions", []),
        }

        if self.cl_websocket:
            await self.cl_websocket.send(json.dumps(cl_message))
            self.bridge_metrics["collective_learnings"] += 1

    async def coordinate_defense_learning(self, defense_data: Dict[str, Any]):
        """Coordinate defensive learning across systems"""
        # Request pattern defense from CL
        pattern = defense_data.get("threatened_pattern")
        board = defense_data.get("board_state")

        cl_request = {
            "type": "pattern_defense_request",
            "requestId": f"coord_{datetime.now().timestamp()}",
            "pattern": pattern,
            "board": board,
            "context": {
                "ai_consensus": defense_data.get("ai_recommendations", []),
                "urgency": defense_data.get("urgency", 5),
            },
        }

        if self.cl_websocket:
            await self.cl_websocket.send(json.dumps(cl_request))
            self.bridge_metrics["coordination_requests"] += 1

    async def heartbeat_loop(self):
        """Maintain connections with heartbeats"""
        while self.running:
            try:
                # Send heartbeat to CL
                if self.cl_websocket:
                    await self.cl_websocket.send(
                        json.dumps(
                            {"type": "heartbeat", "metrics": self.bridge_metrics}
                        )
                    )

                # Send heartbeat to Coordination
                if self.coord_websocket:
                    await self.coord_websocket.send(
                        json.dumps({"type": "heartbeat", "service": "learning_bridge"})
                    )

                await asyncio.sleep(30)  # Every 30 seconds

            except Exception as e:
                logger.error(f"Heartbeat error: {e}")

    async def reconnect_cl(self):
        """Reconnect to Continuous Learning service"""
        for attempt in range(5):
            try:
                await asyncio.sleep(2**attempt)  # Exponential backoff
                self.cl_websocket = await websockets.connect(self.cl_ws_url)
                logger.info("Reconnected to Continuous Learning")
                return
            except Exception as e:
                logger.error(f"CL reconnection attempt {attempt + 1} failed: {e}")

    async def reconnect_coordination(self):
        """Reconnect to Coordination Hub"""
        for attempt in range(5):
            try:
                await asyncio.sleep(2**attempt)  # Exponential backoff
                self.coord_websocket = await websockets.connect(self.coord_ws_url)
                logger.info("Reconnected to Coordination Hub")
                return
            except Exception as e:
                logger.error(
                    f"Coordination reconnection attempt {attempt + 1} failed: {e}"
                )

    def get_metrics(self) -> Dict[str, Any]:
        """Get bridge metrics"""
        return {
            "bridge_metrics": self.bridge_metrics,
            "connections": {
                "continuous_learning": self.cl_websocket is not None,
                "coordination_hub": self.coord_websocket is not None,
            },
            "timestamp": datetime.now().isoformat(),
        }

    async def stop(self):
        """Stop the bridge service"""
        self.running = False

        if self.cl_websocket:
            await self.cl_websocket.close()

        if self.coord_websocket:
            await self.coord_websocket.close()

        logger.info("Coordination-Learning Bridge stopped")


async def main():
    """Main entry point"""
    logger.info("Starting Coordination-Learning Bridge...")

    bridge = CoordinationLearningBridge()

    try:
        await bridge.start()
    except KeyboardInterrupt:
        logger.info("Shutting down bridge...")
        await bridge.stop()


if __name__ == "__main__":
    logging.basicConfig(
        level=logging.INFO,
        format="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
    )

    asyncio.run(main())
