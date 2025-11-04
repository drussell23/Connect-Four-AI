#!/usr/bin/env python3
"""
Simple client test to verify ML service HTTP endpoints
"""

import asyncio
import json

import httpx


async def test_ml_service():
    """Test the ML service endpoints"""
    print("🧪 Testing ML service HTTP endpoints...")

    base_url = "http://localhost:8001"

    try:
        async with httpx.AsyncClient(timeout=30.0) as client:
            # Test health check
            print("\n🏥 Testing health check...")
            response = await client.get(f"{base_url}/health")
            if response.status_code == 200:
                health_data = response.json()
                print(f"✅ Health check: {health_data['status']}")
                print(f"   Device: {health_data['device']}")
                print(f"   Models: {health_data['models_loaded']}")
            else:
                print(f"❌ Health check failed: {response.status_code}")
                return

            # Test basic prediction
            print("\n🎯 Testing basic prediction...")
            test_board = [["Empty" for _ in range(7)] for _ in range(6)]
            test_board[5][3] = "Red"
            test_board[5][4] = "Yellow"

            prediction_request = {
                "board": test_board,
                "game_id": "client_test_001",
                "include_uncertainty": True,
            }

            response = await client.post(f"{base_url}/predict", json=prediction_request)
            if response.status_code == 200:
                prediction_data = response.json()
                print(f"✅ Basic prediction: move {prediction_data['move']}")
                print(f"   Confidence: {prediction_data['confidence']:.3f}")
                print(
                    f"   Inference time: {prediction_data['inference_time_ms']:.1f}ms"
                )
                print(f"   Model: {prediction_data['model_type']}")
                print(f"   Cache hit: {prediction_data['cache_hit']}")
            else:
                print(f"❌ Basic prediction failed: {response.status_code}")
                print(f"   Error: {response.text}")
                return

            # Test caching (second request should be cached)
            print("\n💾 Testing caching...")
            response = await client.post(f"{base_url}/predict", json=prediction_request)
            if response.status_code == 200:
                cached_data = response.json()
                print(f"✅ Cached prediction: move {cached_data['move']}")
                print(f"   Cache hit: {cached_data['cache_hit']}")
                print(f"   Inference time: {cached_data['inference_time_ms']:.1f}ms")
            else:
                print(f"❌ Cached prediction failed: {response.status_code}")

            # Test different model types
            print("\n🎮 Testing different model types...")
            for model_type in ["lightweight", "standard", "heavyweight", "legacy"]:
                request = {
                    "board": test_board,
                    "model_type": model_type,
                    "game_id": f"model_test_{model_type}",
                }

                response = await client.post(f"{base_url}/predict", json=request)
                if response.status_code == 200:
                    data = response.json()
                    print(
                        f"✅ {model_type}: move {data['move']}, "
                        f"confidence {data['confidence']:.3f}, "
                        f"time {data['inference_time_ms']:.1f}ms"
                    )
                else:
                    print(f"❌ {model_type}: failed ({response.status_code})")

            # Test batch prediction
            print("\n📦 Testing batch prediction...")
            batch_boards = []
            for i in range(3):
                board = [["Empty" for _ in range(7)] for _ in range(6)]
                if i > 0:
                    board[5][i] = "Red"
                batch_boards.append({"board": board, "game_id": f"batch_test_{i}"})

            batch_request = {"boards": batch_boards, "batch_id": "client_test_batch"}

            response = await client.post(
                f"{base_url}/predict/batch", json=batch_request
            )
            if response.status_code == 200:
                batch_data = response.json()
                print(
                    f"✅ Batch prediction: {batch_data['successful_count']}/{len(batch_boards)} successful"
                )
                print(f"   Total time: {batch_data['total_time_ms']:.1f}ms")
                print(
                    f"   Avg per board: {batch_data['total_time_ms']/len(batch_boards):.1f}ms"
                )
            else:
                print(f"❌ Batch prediction failed: {response.status_code}")

            # Test models endpoint
            print("\n🔧 Testing models endpoint...")
            response = await client.get(f"{base_url}/models")
            if response.status_code == 200:
                models_data = response.json()
                print(f"✅ Models endpoint: {models_data['available_models']}")
                print(f"   Default: {models_data['default_model']}")
            else:
                print(f"❌ Models endpoint failed: {response.status_code}")

            # Test stats endpoint
            print("\n📊 Testing stats endpoint...")
            response = await client.get(f"{base_url}/stats")
            if response.status_code == 200:
                stats_data = response.json()
                print(f"✅ Stats endpoint: version {stats_data['service']['version']}")
                print(
                    f"   Total requests: {stats_data['performance']['total_requests']}"
                )
                print(f"   Cache hit rate: {stats_data['cache']['hit_rate']:.3f}")
            else:
                print(f"❌ Stats endpoint failed: {response.status_code}")

            print("\n🎉 All HTTP endpoint tests completed successfully!")

    except httpx.ConnectError:
        print("❌ Could not connect to ML service")
        print("   Make sure the service is running: python start_service.py --dev")
    except Exception as e:
        print(f"❌ Test failed: {e}")


if __name__ == "__main__":
    asyncio.run(test_ml_service())
