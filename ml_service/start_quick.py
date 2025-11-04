#!/usr/bin/env python3
"""
🚀 Quick ML Service Mock
Lightweight ML service for development and testing
Bypasses heavy dependencies like torch for faster startup
"""

import logging
import threading
import time

from flask import Flask, jsonify

# Configure minimal logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = Flask(__name__)

# Service state
service_state = {
    "status": "starting",
    "start_time": time.time(),
    "requests_served": 0,
    "mode": "development_mock",
}


@app.route("/health", methods=["GET"])
def health_check():
    """Health check endpoint"""
    uptime = time.time() - service_state["start_time"]
    return jsonify(
        {
            "status": "ok",
            "service": "Connect Four ML Service (Mock)",
            "uptime_seconds": round(uptime, 2),
            "mode": service_state["mode"],
            "requests_served": service_state["requests_served"],
            "message": "Development mock - lightweight and fast!",
        }
    )


@app.route("/predict", methods=["POST"])
def predict():
    """Mock prediction endpoint"""
    service_state["requests_served"] += 1

    # Simulate lightweight AI prediction
    import random

    mock_prediction = {
        "column": random.randint(0, 6),
        "confidence": round(random.uniform(0.6, 0.95), 3),
        "thinking_time": round(random.uniform(0.1, 0.5), 3),
        "model": "mock_ai_v1",
        "mode": "development",
    }

    return jsonify(mock_prediction)


@app.route("/status", methods=["GET"])
def status():
    """Service status endpoint"""
    return jsonify(
        {
            "service": "ML Inference Service",
            "mode": "development_mock",
            "features": ["health_check", "mock_predictions", "fast_startup"],
            "dependencies": "minimal",
            "performance": "optimized_for_development",
        }
    )


def startup_sequence():
    """Quick startup sequence"""
    logger.info("🚀 Quick ML Service starting...")
    time.sleep(0.5)  # Minimal startup delay
    service_state["status"] = "ready"
    logger.info("✅ Quick ML Service ready on http://localhost:8000")
    logger.info("🏃 Development mode: Fast startup, mock predictions")


if __name__ == "__main__":
    # Start in background thread
    startup_thread = threading.Thread(target=startup_sequence)
    startup_thread.start()

    # Run Flask app
    app.run(
        host="0.0.0.0",
        port=8000,
        debug=False,
        threaded=True,
        use_reloader=False,  # Prevent double startup
    )
