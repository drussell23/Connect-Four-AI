#!/usr/bin/env python3
"""
🚀 ML SERVICE STARTUP SCRIPT
=============================

Enhanced startup script for the Connect4 ML service with:
- Automatic dependency checking
- Environment setup
- Service configuration
- Development and production modes
"""

import argparse
import asyncio
import os
import subprocess
import sys
from pathlib import Path


def check_dependencies():
    """Check if required dependencies are installed"""
    print("🔍 Checking dependencies...")

    required_packages = [
        "torch",
        "fastapi",
        "uvicorn",
        "pydantic",
        "numpy",
        "prometheus_client",
        "structlog",
        "httpx",
    ]

    missing = []
    for package in required_packages:
        try:
            __import__(package)
            print(f"✅ {package}")
        except ImportError:
            missing.append(package)
            print(f"❌ {package} (missing)")

    if missing:
        print(f"\n⚠️  Missing dependencies: {', '.join(missing)}")
        print("Run: pip install -r requirements.txt")
        return False

    print("✅ All dependencies satisfied")
    return True


def setup_environment(args):
    """Setup environment variables"""
    print("\n🔧 Setting up environment...")

    # Core settings
    os.environ["DEFAULT_MODEL_TYPE"] = args.model_type
    os.environ["CACHE_TTL"] = str(args.cache_ttl)
    os.environ["MAX_BATCH_SIZE"] = str(args.max_batch_size)

    # Development vs production
    if args.dev:
        os.environ["ENABLE_AUTH"] = "false"
        os.environ["RATE_LIMIT_RPM"] = "10000"
        os.environ["WARMUP_REQUESTS"] = "5"
        print("🔧 Development mode enabled")
    else:
        os.environ["ENABLE_AUTH"] = "true"
        os.environ["API_KEY"] = args.api_key or "your-secure-api-key"
        os.environ["RATE_LIMIT_RPM"] = str(args.rate_limit)
        os.environ["WARMUP_REQUESTS"] = "10"
        print("🔒 Production mode enabled")

    # Redis settings
    if args.redis_host:
        os.environ["REDIS_HOST"] = args.redis_host
        os.environ["REDIS_PORT"] = str(args.redis_port)
        print(f"🔧 Redis configured: {args.redis_host}:{args.redis_port}")

    # Performance settings
    os.environ["INFERENCE_TIMEOUT"] = str(args.timeout)

    print("✅ Environment configured")


def run_service(args):
    """Run the ML service"""
    print(f"\n🚀 Starting ML Service on port {args.port}...")

    uvicorn_args = [
        "uvicorn",
        "ml_service:app",
        "--host",
        args.host,
        "--port",
        str(args.port),
        "--workers",
        str(args.workers),
    ]

    if args.dev:
        uvicorn_args.extend(["--reload", "--log-level", "debug"])
    else:
        uvicorn_args.extend(["--log-level", "info"])

    # Add SSL if certificates provided
    if args.ssl_cert and args.ssl_key:
        uvicorn_args.extend(
            ["--ssl-keyfile", args.ssl_key, "--ssl-certfile", args.ssl_cert]
        )
        print(f"🔒 SSL enabled")

    print(
        f"🎯 Service will be available at: http{'s' if args.ssl_cert else ''}://{args.host}:{args.port}"
    )
    print(
        f"📖 API documentation: http{'s' if args.ssl_cert else ''}://{args.host}:{args.port}/docs"
    )

    try:
        subprocess.run(uvicorn_args, check=True)
    except KeyboardInterrupt:
        print("\n🛑 Service stopped by user")
    except subprocess.CalledProcessError as e:
        print(f"\n❌ Service failed to start: {e}")
        sys.exit(1)


def main():
    """Main startup function"""
    parser = argparse.ArgumentParser(
        description="🧠 Enhanced Connect4 ML Service",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
  # Development mode
  python start_service.py --dev
  
  # Production mode
  python start_service.py --api-key your-secret-key
  
  # With Redis cache
  python start_service.py --redis-host localhost --redis-port 6379
  
  # High performance mode
  python start_service.py --model-type heavyweight --workers 4
        """,
    )

    # Core settings
    parser.add_argument(
        "--host",
        default="127.0.0.1",
        help="Host address (use 0.0.0.0 for all interfaces)",
    )
    parser.add_argument("--port", type=int, default=8001, help="Port number")
    parser.add_argument(
        "--workers", type=int, default=1, help="Number of worker processes"
    )

    # Model settings
    parser.add_argument(
        "--model-type",
        default="standard",
        choices=["lightweight", "standard", "heavyweight", "legacy"],
        help="Default model type",
    )

    # Performance settings
    parser.add_argument(
        "--cache-ttl", type=int, default=300, help="Cache TTL in seconds"
    )
    parser.add_argument(
        "--max-batch-size", type=int, default=32, help="Maximum batch size"
    )
    parser.add_argument("--timeout", type=float, default=5.0, help="Inference timeout")

    # Security settings
    parser.add_argument("--dev", action="store_true", help="Enable development mode")
    parser.add_argument("--api-key", help="API key for authentication")
    parser.add_argument(
        "--rate-limit", type=int, default=1000, help="Rate limit (requests/minute)"
    )

    # SSL settings
    parser.add_argument("--ssl-cert", help="SSL certificate file")
    parser.add_argument("--ssl-key", help="SSL private key file")

    # Redis settings
    parser.add_argument("--redis-host", help="Redis host")
    parser.add_argument("--redis-port", type=int, default=6379, help="Redis port")

    # Other options
    parser.add_argument(
        "--skip-deps", action="store_true", help="Skip dependency check"
    )
    parser.add_argument(
        "--test", action="store_true", help="Run tests instead of starting service"
    )

    args = parser.parse_args()

    print("🧠 Enhanced Connect4 ML Service")
    print("=" * 35)

    # Check dependencies
    if not args.skip_deps and not check_dependencies():
        sys.exit(1)

    # Setup environment
    setup_environment(args)

    # Run tests or start service
    if args.test:
        print("\n🧪 Running tests...")
        subprocess.run([sys.executable, "test_service.py"])
    else:
        run_service(args)


if __name__ == "__main__":
    main()
