#!/usr/bin/env python3
"""
🚀 ML SERVICE WITH CONTINUOUS LEARNING
=====================================

Starts both the main ML service and the continuous learning pipeline
for real-time model improvement during gameplay.
"""

import asyncio
import logging
import multiprocessing
import os
import sys
import time
from pathlib import Path

# Configure logging
logging.basicConfig(
    level=logging.INFO, format="%(asctime)s - %(name)s - %(levelname)s - %(message)s"
)
logger = logging.getLogger(__name__)

# Add current directory to path
sys.path.insert(0, str(Path(__file__).parent))


def start_ml_service():
    """Start the main ML service"""
    import uvicorn

    from ml_service import app

    host = os.environ.get("ML_SERVICE_HOST", "127.0.0.1")
    port = int(os.environ.get("ML_SERVICE_PORT", "8000"))

    logger.info(f"Starting ML service on {host}:{port}")

    uvicorn.run(app, host=host, port=port, reload=False, access_log=True)


def start_continuous_learning():
    """Start the continuous learning pipeline"""
    import asyncio

    from continuous_learning import (ContinuousLearningPipeline,
                                     run_continuous_learning)

    from ml_service import \
      model_manager  # Import model manager from main service

    logger.info("Starting continuous learning pipeline")

    # Configuration for continuous learning
    config = {
        "buffer_capacity": 100000,
        "learning_rate": 0.0001,
        "batch_size": 32,
        "update_frequency": 100,
        "min_games": 50,
        "validation_threshold": 0.95,
        "catastrophic_threshold": 0.15,
        "degradation_threshold": 0.05,
        "improvement_threshold": 0.02,
    }

    # Create event loop and run
    loop = asyncio.new_event_loop()
    asyncio.set_event_loop(loop)

    try:
        loop.run_until_complete(run_continuous_learning(model_manager, config))
    except KeyboardInterrupt:
        logger.info("Continuous learning pipeline shutting down")
    finally:
        loop.close()


def start_learning_monitor():
    """Start the learning stability monitor"""
    import asyncio

    from continuous_learning import ContinuousLearningPipeline
    from learning_monitor import monitor_learning_stability

    from ml_service import model_manager

    logger.info("Starting learning stability monitor")

    # Configuration for monitor
    config = {
        "catastrophic_threshold": 0.15,
        "degradation_threshold": 0.05,
        "improvement_threshold": 0.02,
    }

    # Create event loop and run
    loop = asyncio.new_event_loop()
    asyncio.set_event_loop(loop)

    # Create pipeline instance (would be shared with continuous learning in production)
    pipeline = ContinuousLearningPipeline(model_manager, config)

    try:
        # Check if model exists first
        if "standard" in model_manager.models:
            loop.run_until_complete(
                monitor_learning_stability(
                    model_manager.models["standard"], pipeline, config
                )
            )
        else:
            logger.warning("Standard model not found, skipping learning monitor")
    except KeyboardInterrupt:
        logger.info("Learning monitor shutting down")
    finally:
        loop.close()


async def start_integrated_service():
    """Start ML service with integrated continuous learning"""
    import uvicorn
    import websockets
    from continuous_learning import ContinuousLearningPipeline

    from ml_service import app, model_manager

    # Configuration for continuous learning
    config = {
        "buffer_capacity": 100000,
        "capacity_per_level": 10000,
        "learning_rate": 0.0001,
        "batch_size": 32,
        "update_frequency": 100,
        "min_games": 50,
        "validation_threshold": 0.95,
    }

    # Ensure model manager has a base model loaded first
    try:
        await model_manager.load_model("standard")
        logger.info("Loaded standard model for continuous learning")
    except Exception as e:
        logger.warning(f"Could not load standard model: {e}")

    # Create continuous learning pipeline
    # Use difficulty-aware version if available
    try:
        from integrate_difficulty_learning import \
          IntegratedDifficultyLearningPipeline

        if model_manager.models:
            pipeline = IntegratedDifficultyLearningPipeline(model_manager, config)
            logger.info("Using difficulty-aware continuous learning pipeline")
        else:
            # Fall back to standard pipeline if no models loaded
            pipeline = ContinuousLearningPipeline(model_manager, config)
            logger.info(
                "Using standard continuous learning pipeline (no models loaded)"
            )
    except ImportError:
        pipeline = ContinuousLearningPipeline(model_manager, config)
        logger.info("Using standard continuous learning pipeline")
    except Exception as e:
        logger.warning(f"Failed to initialize difficulty-aware pipeline: {e}")
        pipeline = ContinuousLearningPipeline(model_manager, config)
        logger.info("Using standard continuous learning pipeline as fallback")

    # Start HTTP health endpoint for continuous learning
    async def start_cl_http():
        from aiohttp import web

        async def health_handler(request):
            return web.json_response(
                {
                    "status": "healthy",
                    "service": "continuous_learning",
                    "timestamp": time.time(),
                    "buffer_size": (
                        len(pipeline.experience_buffer.buffer)
                        if hasattr(pipeline, "experience_buffer")
                        else 0
                    ),
                },
                headers={
                    "Access-Control-Allow-Origin": "*",
                    "Access-Control-Allow-Methods": "GET, OPTIONS",
                    "Access-Control-Allow-Headers": "Content-Type",
                },
            )

        async def handle_options(request):
            return web.Response(
                headers={
                    "Access-Control-Allow-Origin": "*",
                    "Access-Control-Allow-Methods": "GET, OPTIONS",
                    "Access-Control-Allow-Headers": "Content-Type",
                }
            )

        app = web.Application()
        app.router.add_get("/health", health_handler)
        app.router.add_options("/health", handle_options)

        runner = web.AppRunner(app)
        await runner.setup()
        http_port = int(os.environ.get("ML_WEBSOCKET_PORT", "8002"))
        site = web.TCPSite(runner, "localhost", http_port)
        await site.start()
        logger.info(
            f"Continuous Learning HTTP health endpoint started on http://localhost:{http_port}/health"
        )

    # Start WebSocket server for continuous learning in background
    async def start_cl_websocket():
        ws_port = int(os.environ.get("ML_WEBSOCKET_PORT", "8002"))

        # Create a wrapper to handle the path parameter
        async def websocket_handler(websocket):
            await pipeline.handle_websocket(websocket, "/")

        # Use a different port for WebSocket to avoid conflict with HTTP
        ws_actual_port = 8005  # Use 8005 for WebSocket to avoid conflicts
        server = await websockets.serve(websocket_handler, "localhost", ws_actual_port)
        logger.info(
            f"Continuous Learning WebSocket server started on ws://localhost:{ws_actual_port}"
        )
        await asyncio.Future()  # Run forever

    # Start both HTTP and WebSocket servers as background tasks
    asyncio.create_task(start_cl_http())
    asyncio.create_task(start_cl_websocket())

    # Start coordination-learning bridge if AI coordination is available
    if os.environ.get("ENABLE_COORDINATION_BRIDGE", "true").lower() == "true":
        try:
            from coordination_learning_bridge import CoordinationLearningBridge

            bridge = CoordinationLearningBridge()
            asyncio.create_task(bridge.start())
            logger.info("Coordination-Learning Bridge started")
        except Exception as e:
            logger.warning(f"Could not start Coordination-Learning Bridge: {e}")

    # Start Integration WebSocket client for seamless service communication
    if os.environ.get("ENABLE_SERVICE_INTEGRATION", "true").lower() == "true":
        try:
            from integration_client import MLServiceIntegration

            ml_integration = MLServiceIntegration()
            asyncio.create_task(ml_integration.start())
            logger.info("✅ Service Integration client started")

            # Register pipeline with integration for real-time updates
            pipeline.integration_client = ml_integration.client
        except Exception as e:
            logger.warning(f"Could not start Service Integration client: {e}")

    # Start the main ML service
    host = os.environ.get("ML_SERVICE_HOST", "127.0.0.1")
    port = int(os.environ.get("ML_SERVICE_PORT", "8000"))

    config = uvicorn.Config(
        app=app, host=host, port=port, reload=False, access_log=True
    )

    server = uvicorn.Server(config)
    await server.serve()


def main():
    """Main entry point - starts integrated ML service with continuous learning"""
    logger.info("🚀 Starting ML Service with Continuous Learning")

    try:
        asyncio.run(start_integrated_service())
    except KeyboardInterrupt:
        logger.info("Shutting down ML service with continuous learning...")
    except Exception as e:
        logger.error(f"Failed to start integrated service: {e}")
        sys.exit(1)


if __name__ == "__main__":
    main()
