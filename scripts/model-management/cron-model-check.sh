#!/bin/bash
# Weekly model repository health check

cd "$(dirname "$0")/../.."
./scripts/model-management/model-monitor.sh > logs/model-health-$(date +%Y%m%d).log 2>&1

# Clean up old logs (keep last 4 weeks)
find logs/ -name "model-health-*.log" -mtime +28 -delete 2>/dev/null || true
