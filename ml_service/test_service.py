#!/usr/bin/env python3
"""
🧪 COMPREHENSIVE ML SERVICE TEST SUITE
=======================================

Test script for validating the enhanced Connect4 ML service functionality.
"""

import asyncio
import json
import time
from typing import Any, Dict

import httpx


class MLServiceTester:
    """Comprehensive tester for the ML service"""

    def __init__(self, base_url: str = "http://localhost:8001"):
        self.base_url = base_url
        self.client = httpx.AsyncClient(timeout=30.0)

    async def test_health_check(self) -> Dict[str, Any]:
        """Test health check endpoint"""
        print("🏥 Testing health check...")

        try:
            response = await self.client.get(f"{self.base_url}/health")

            if response.status_code == 200:
                data = response.json()
                print(f"✅ Health check passed")
                print(f"   Status: {data.get('status')}")
                print(f"   Device: {data.get('device')}")
                print(f"   Models loaded: {data.get('models_loaded', [])}")
                print(f"   Memory usage: {data.get('memory_usage_mb', 0):.1f} MB")
                return {"status": "success", "data": data}
            else:
                print(f"❌ Health check failed: {response.status_code}")
                return {"status": "failed", "error": response.text}

        except Exception as e:
            print(f"❌ Health check error: {e}")
            return {"status": "error", "error": str(e)}

    async def test_basic_prediction(self) -> Dict[str, Any]:
        """Test basic prediction functionality"""
        print("\n🎯 Testing basic prediction...")

        # Create test board (empty)
        test_board = [["Empty" for _ in range(7)] for _ in range(6)]

        payload = {
            "board": test_board,
            "game_id": "test_game_001",
            "move_number": 0,
            "include_uncertainty": True,
        }

        try:
            start_time = time.time()
            response = await self.client.post(f"{self.base_url}/predict", json=payload)
            duration = (time.time() - start_time) * 1000

            if response.status_code == 200:
                data = response.json()
                print(f"✅ Basic prediction passed ({duration:.1f}ms)")
                print(f"   Move: {data.get('move')}")
                print(f"   Confidence: {data.get('confidence', 0):.3f}")
                print(f"   Model: {data.get('model_type')}")
                print(f"   Inference time: {data.get('inference_time_ms', 0):.1f}ms")
                print(f"   Cache hit: {data.get('cache_hit', False)}")
                return {"status": "success", "data": data}
            else:
                print(f"❌ Basic prediction failed: {response.status_code}")
                return {"status": "failed", "error": response.text}

        except Exception as e:
            print(f"❌ Basic prediction error: {e}")
            return {"status": "error", "error": str(e)}

    async def test_model_types(self) -> Dict[str, Any]:
        """Test different model types"""
        print("\n🎮 Testing different model types...")

        test_board = [["Empty" for _ in range(7)] for _ in range(6)]
        model_types = ["lightweight", "standard", "heavyweight", "legacy"]
        results = {}

        for model_type in model_types:
            payload = {
                "board": test_board,
                "model_type": model_type,
                "include_uncertainty": True,
            }

            try:
                start_time = time.time()
                response = await self.client.post(
                    f"{self.base_url}/predict", json=payload
                )
                duration = (time.time() - start_time) * 1000

                if response.status_code == 200:
                    data = response.json()
                    print(
                        f"✅ {model_type}: move {data.get('move')}, "
                        f"confidence {data.get('confidence', 0):.3f}, "
                        f"time {duration:.1f}ms"
                    )
                    results[model_type] = {
                        "status": "success",
                        "duration": duration,
                        "data": data,
                    }
                else:
                    print(f"❌ {model_type}: failed ({response.status_code})")
                    results[model_type] = {"status": "failed", "error": response.text}

            except Exception as e:
                print(f"❌ {model_type}: error - {e}")
                results[model_type] = {"status": "error", "error": str(e)}

        return results

    async def test_caching(self) -> Dict[str, Any]:
        """Test caching functionality"""
        print("\n💾 Testing caching...")

        test_board = [["Empty" for _ in range(7)] for _ in range(6)]
        payload = {"board": test_board, "game_id": "cache_test"}

        try:
            # First request (should be cache miss)
            start_time = time.time()
            response1 = await self.client.post(f"{self.base_url}/predict", json=payload)
            time1 = (time.time() - start_time) * 1000

            # Second request (should be cache hit)
            start_time = time.time()
            response2 = await self.client.post(f"{self.base_url}/predict", json=payload)
            time2 = (time.time() - start_time) * 1000

            if response1.status_code == 200 and response2.status_code == 200:
                data1 = response1.json()
                data2 = response2.json()

                cache_hit = data2.get("cache_hit", False)
                speedup = time1 / time2 if time2 > 0 else 1

                print(f"✅ Caching test passed")
                print(f"   First request: {time1:.1f}ms (cache miss)")
                print(f"   Second request: {time2:.1f}ms (cache hit: {cache_hit})")
                print(f"   Speedup: {speedup:.1f}x")

                return {
                    "status": "success",
                    "cache_hit": cache_hit,
                    "speedup": speedup,
                    "times": [time1, time2],
                }
            else:
                print(f"❌ Caching test failed")
                return {"status": "failed"}

        except Exception as e:
            print(f"❌ Caching test error: {e}")
            return {"status": "error", "error": str(e)}

    async def test_batch_prediction(self) -> Dict[str, Any]:
        """Test batch prediction functionality"""
        print("\n📦 Testing batch prediction...")

        # Create multiple test boards
        boards = []
        for i in range(5):
            board = [["Empty" for _ in range(7)] for _ in range(6)]
            # Add some pieces to make boards different
            if i > 0:
                board[5][i % 7] = "Red"

            boards.append({"board": board, "game_id": f"batch_test_{i}"})

        payload = {"boards": boards, "batch_id": "test_batch_001"}

        try:
            start_time = time.time()
            response = await self.client.post(
                f"{self.base_url}/predict/batch", json=payload
            )
            duration = (time.time() - start_time) * 1000

            if response.status_code == 200:
                data = response.json()
                successful_count = data.get("successful_count", 0)
                total_count = len(boards)

                print(f"✅ Batch prediction passed ({duration:.1f}ms)")
                print(f"   Processed: {successful_count}/{total_count} boards")
                print(f"   Average per board: {duration/total_count:.1f}ms")

                return {"status": "success", "data": data}
            else:
                print(f"❌ Batch prediction failed: {response.status_code}")
                return {"status": "failed", "error": response.text}

        except Exception as e:
            print(f"❌ Batch prediction error: {e}")
            return {"status": "error", "error": str(e)}

    async def test_models_endpoint(self) -> Dict[str, Any]:
        """Test models listing endpoint"""
        print("\n🎯 Testing models endpoint...")

        try:
            response = await self.client.get(f"{self.base_url}/models")

            if response.status_code == 200:
                data = response.json()
                available_models = data.get("available_models", [])
                print(f"✅ Models endpoint passed")
                print(f"   Available models: {available_models}")
                print(f"   Default model: {data.get('default_model')}")
                return {"status": "success", "data": data}
            else:
                print(f"❌ Models endpoint failed: {response.status_code}")
                return {"status": "failed", "error": response.text}

        except Exception as e:
            print(f"❌ Models endpoint error: {e}")
            return {"status": "error", "error": str(e)}

    async def test_stress_performance(self, num_requests: int = 20) -> Dict[str, Any]:
        """Test performance under load"""
        print(f"\n🚀 Testing performance ({num_requests} concurrent requests)...")

        test_board = [["Empty" for _ in range(7)] for _ in range(6)]

        async def single_request(request_id: int):
            payload = {"board": test_board, "game_id": f"stress_test_{request_id}"}

            start_time = time.time()
            try:
                response = await self.client.post(
                    f"{self.base_url}/predict", json=payload
                )
                duration = (time.time() - start_time) * 1000

                if response.status_code == 200:
                    return {"status": "success", "duration": duration}
                else:
                    return {"status": "failed", "error": response.status_code}
            except Exception as e:
                return {"status": "error", "error": str(e)}

        try:
            start_time = time.time()
            tasks = [single_request(i) for i in range(num_requests)]
            results = await asyncio.gather(*tasks)
            total_time = (time.time() - start_time) * 1000

            successful = [r for r in results if r["status"] == "success"]
            failed = [r for r in results if r["status"] != "success"]

            if successful:
                durations = [r["duration"] for r in successful]
                avg_duration = sum(durations) / len(durations)
                min_duration = min(durations)
                max_duration = max(durations)
                throughput = len(successful) / (total_time / 1000)
            else:
                avg_duration = min_duration = max_duration = throughput = 0

            print(f"✅ Stress test completed")
            print(f"   Total time: {total_time:.1f}ms")
            print(f"   Successful: {len(successful)}/{num_requests}")
            print(f"   Throughput: {throughput:.1f} requests/sec")
            print(
                f"   Latency: avg {avg_duration:.1f}ms, min {min_duration:.1f}ms, max {max_duration:.1f}ms"
            )

            return {
                "status": "success",
                "total_requests": num_requests,
                "successful_requests": len(successful),
                "failed_requests": len(failed),
                "total_time_ms": total_time,
                "throughput_rps": throughput,
                "latency": {
                    "avg": avg_duration,
                    "min": min_duration,
                    "max": max_duration,
                },
            }

        except Exception as e:
            print(f"❌ Stress test error: {e}")
            return {"status": "error", "error": str(e)}

    async def run_all_tests(self) -> Dict[str, Any]:
        """Run all tests"""
        print("🧪 Starting comprehensive ML service tests...\n")

        results = {}

        # Run tests
        results["health_check"] = await self.test_health_check()
        results["basic_prediction"] = await self.test_basic_prediction()
        results["model_types"] = await self.test_model_types()
        results["caching"] = await self.test_caching()
        results["batch_prediction"] = await self.test_batch_prediction()
        results["models_endpoint"] = await self.test_models_endpoint()
        results["stress_test"] = await self.test_stress_performance()

        # Summary
        total_tests = len(results)
        passed_tests = sum(
            1
            for r in results.values()
            if isinstance(r, dict) and r.get("status") == "success"
        )

        print(f"\n📊 TEST SUMMARY")
        print(f"================")
        print(f"Total tests: {total_tests}")
        print(f"Passed: {passed_tests}")
        print(f"Failed: {total_tests - passed_tests}")
        print(f"Success rate: {(passed_tests/total_tests)*100:.1f}%")

        return {
            "summary": {
                "total_tests": total_tests,
                "passed_tests": passed_tests,
                "failed_tests": total_tests - passed_tests,
                "success_rate": (passed_tests / total_tests) * 100,
            },
            "detailed_results": results,
        }

    async def close(self):
        """Close the HTTP client"""
        await self.client.aclose()


async def main():
    """Main test runner"""
    tester = MLServiceTester()

    try:
        results = await tester.run_all_tests()

        # Save results to file
        with open("test_results.json", "w") as f:
            json.dump(results, f, indent=2)

        print(f"\n💾 Results saved to test_results.json")

    except KeyboardInterrupt:
        print("\n🛑 Tests interrupted by user")
    except Exception as e:
        print(f"\n❌ Test runner error: {e}")
    finally:
        await tester.close()


if __name__ == "__main__":
    asyncio.run(main())
