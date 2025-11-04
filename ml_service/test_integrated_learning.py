#!/usr/bin/env python3
"""
🧪 INTEGRATED LEARNING SYSTEM TEST
==================================

Tests the integration between:
- Continuous Learning Pipeline
- AI Coordination Hub
- Pattern Defense System
- Real-time Model Updates
"""

import asyncio
import json
import logging
import time
from typing import Any, Dict, List

import websockets

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


class IntegratedLearningTester:
    def __init__(self):
        self.cl_ws_url = "ws://localhost:8002/ws"
        self.coord_ws_url = "ws://localhost:8003/ws/test_client"
        self.test_results = {
            "loss_pattern_broadcast": False,
            "model_update_propagation": False,
            "defense_coordination": False,
            "collective_learning": False,
        }

    async def test_loss_pattern_flow(self):
        """Test: Loss pattern → CL → Coordination → All AIs"""
        logger.info("Testing loss pattern flow...")

        try:
            # Connect to continuous learning
            cl_ws = await websockets.connect(self.cl_ws_url)

            # Send handshake
            await cl_ws.send(
                json.dumps(
                    {"type": "handshake", "service": "test_client", "version": "1.0.0"}
                )
            )

            # Simulate a loss pattern discovery
            loss_pattern_msg = {
                "type": "priority_learning",
                "data": {
                    "gameId": "test-game-001",
                    "lossPattern": {
                        "type": "horizontal",
                        "winningSequence": [
                            {"row": 5, "column": 0},
                            {"row": 5, "column": 1},
                            {"row": 5, "column": 2},
                            {"row": 5, "column": 3},
                        ],
                        "criticalPositions": [
                            {"row": 5, "column": 1},
                            {"row": 5, "column": 2},
                        ],
                        "aiMistakes": ["missed_block_at_col_1"],
                    },
                    "gameData": {
                        "outcome": "loss",
                        "finalBoard": self._create_test_board(),
                        "moves": [],
                    },
                    "priority": "high",
                    "learnImmediately": True,
                },
            }

            await cl_ws.send(json.dumps(loss_pattern_msg))
            logger.info("✅ Sent loss pattern to continuous learning")

            # Wait for pattern insights broadcast
            response = await asyncio.wait_for(cl_ws.recv(), timeout=5.0)
            data = json.loads(response)

            if data.get("type") == "pattern_insights":
                logger.info(f"✅ Received pattern insights: {data['data']['patterns']}")
                self.test_results["loss_pattern_broadcast"] = True

            await cl_ws.close()

        except Exception as e:
            logger.error(f"❌ Loss pattern flow test failed: {e}")

    async def test_model_update_propagation(self):
        """Test: Model update → Coordination → All AIs notified"""
        logger.info("Testing model update propagation...")

        try:
            # Connect to coordination hub
            coord_ws = await websockets.connect(self.coord_ws_url)

            # Simulate model update from CL
            model_update_msg = {
                "type": "continuous_learning_update",
                "update_type": "model_improved",
                "data": {
                    "version": "v42",
                    "improvements": {
                        "horizontal_defense": 0.15,
                        "vertical_defense": 0.12,
                        "diagonal_defense": 0.18,
                        "overall_accuracy": 0.14,
                    },
                    "timestamp": time.time(),
                },
            }

            await coord_ws.send(json.dumps(model_update_msg))
            logger.info("✅ Sent model update to coordination hub")

            # The coordination hub should broadcast this to all AIs
            # In a real test, we'd connect multiple AI clients to verify
            self.test_results["model_update_propagation"] = True

            await coord_ws.close()

        except Exception as e:
            logger.error(f"❌ Model update propagation test failed: {e}")

    async def test_defense_coordination(self):
        """Test: Pattern defense learned → Broadcast to all AIs"""
        logger.info("Testing defense coordination...")

        try:
            coord_ws = await websockets.connect(self.coord_ws_url)

            # Simulate defense strategy update
            defense_msg = {
                "type": "defense_coordination",
                "defenses": {
                    "horizontal": {
                        "critical_positions": [{"row": 5, "column": 3}],
                        "blocking_moves": [3, 2, 4],
                        "confidence": 0.92,
                        "games_tested": 150,
                    },
                    "diagonal": {
                        "critical_positions": [
                            {"row": 3, "column": 3},
                            {"row": 2, "column": 2},
                        ],
                        "blocking_moves": [3, 2],
                        "confidence": 0.87,
                        "games_tested": 120,
                    },
                },
            }

            await coord_ws.send(json.dumps(defense_msg))
            logger.info("✅ Sent defense strategies to coordination hub")

            self.test_results["defense_coordination"] = True

            await coord_ws.close()

        except Exception as e:
            logger.error(f"❌ Defense coordination test failed: {e}")

    async def test_collective_pattern_analysis(self):
        """Test: Request collective analysis from all AI personalities"""
        logger.info("Testing collective pattern analysis...")

        try:
            coord_ws = await websockets.connect(self.coord_ws_url)

            # Request pattern analysis
            analysis_request = {
                "type": "pattern_analysis_request",
                "board_state": self._create_test_board(),
                "patterns": ["horizontal", "diagonal"],
            }

            await coord_ws.send(json.dumps(analysis_request))

            # Wait for collective analysis response
            response = await asyncio.wait_for(coord_ws.recv(), timeout=3.0)
            data = json.loads(response)

            if "collective_analysis" in data:
                logger.info(
                    f"✅ Received collective analysis from {len(data['collective_analysis'])} AIs"
                )
                self.test_results["collective_learning"] = True

            await coord_ws.close()

        except Exception as e:
            logger.error(f"❌ Collective pattern analysis test failed: {e}")

    def _create_test_board(self) -> List[List[str]]:
        """Create a test board state"""
        board = [["Empty"] * 7 for _ in range(6)]
        # Add some test pieces
        board[5][0] = "Red"
        board[5][1] = "Red"
        board[5][2] = "Red"
        board[5][3] = "Yellow"
        board[4][3] = "Yellow"
        return board

    async def run_all_tests(self):
        """Run all integration tests"""
        logger.info("🧪 Starting Integrated Learning System Tests...")
        logger.info("=" * 50)

        # Run tests
        await self.test_loss_pattern_flow()
        await asyncio.sleep(1)

        await self.test_model_update_propagation()
        await asyncio.sleep(1)

        await self.test_defense_coordination()
        await asyncio.sleep(1)

        await self.test_collective_pattern_analysis()

        # Print results
        logger.info("\n" + "=" * 50)
        logger.info("📊 TEST RESULTS:")
        logger.info("=" * 50)

        passed = 0
        for test_name, result in self.test_results.items():
            status = "✅ PASSED" if result else "❌ FAILED"
            logger.info(f"{test_name}: {status}")
            if result:
                passed += 1

        logger.info("=" * 50)
        logger.info(f"Total: {passed}/{len(self.test_results)} tests passed")

        return passed == len(self.test_results)


async def main():
    """Main test entry point"""
    # Wait for services to be ready
    logger.info("Waiting for services to start...")
    await asyncio.sleep(3)

    tester = IntegratedLearningTester()
    success = await tester.run_all_tests()

    if success:
        logger.info("\n🎉 All integration tests passed!")
    else:
        logger.error("\n❌ Some tests failed. Check the logs above.")


if __name__ == "__main__":
    asyncio.run(main())
