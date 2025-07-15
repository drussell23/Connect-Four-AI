#!/usr/bin/env bash
set -eo pipefail

# ============================================================================
# Smart ML Pipeline Orchestrator
# Advanced unified ML training system with parallel processing, monitoring,
# and fault tolerance - similar to smart-start.sh but for ML workflows
# ============================================================================

# Color definitions for beautiful output
declare -A COLORS=(
    [RED]='\033[0;31m'    [GREEN]='\033[0;32m'   [YELLOW]='\033[0;33m'
    [BLUE]='\033[0;34m'   [PURPLE]='\033[0;35m'  [CYAN]='\033[0;36m'
    [WHITE]='\033[0;37m'  [BOLD]='\033[1m'       [RESET]='\033[0m'
    [DIM]='\033[2m'       [UNDERLINE]='\033[4m'
)

# Configuration
declare -A CONFIG=(
    [PROJECT_NAME]="Connect4 ML Pipeline"
    [VERSION]="2.0.0"
    [MAX_PARALLEL_GAMES]=8
    [TRAINING_WORKERS]=4
    [MEMORY_LIMIT_MB]=4096
    [API_PORT]=8000
    [MONITOR_PORT]=8001
    [LOG_LEVEL]="INFO"
    [AUTO_RESTART]=true
    [BENCHMARK_GAMES]=1000
)

# Global state
declare -A STATE=(
    [FORCE_CLEANUP]=false
    [OFFLINE_ONLY]=false
    [CONTINUOUS_ONLY]=false
    [PARALLEL_MODE]=false
    [MONITOR_MODE]=false
    [PRODUCTION_MODE]=false
    [BENCHMARK_MODE]=false
    [QUIET_MODE]=false
)

declare -a BACKGROUND_PIDS=()
declare -a TEMP_FILES=()

# ============================================================================
# Core Utilities
# ============================================================================

log() {
    local level="$1" && shift
    local color_key="$1" && shift
    local timestamp=$(date '+%H:%M:%S')
    
    if [[ "${STATE[QUIET_MODE]}" == "false" ]]; then
        printf "${COLORS[$color_key]}[%s] [%s]${COLORS[RESET]} %s\n" \
            "$timestamp" "$level" "$*" >&2
    fi
    
    # Always log to file
    printf "[%s] [%s] %s\n" "$(date -Iseconds)" "$level" "$*" >> ml-pipeline.log
}

info()  { log "INFO"  "BLUE"   "$@"; }
warn()  { log "WARN"  "YELLOW" "$@"; }
error() { log "ERROR" "RED"    "$@"; }
success() { log "SUCCESS" "GREEN" "$@"; }
debug() { [[ "${CONFIG[LOG_LEVEL]}" == "DEBUG" ]] && log "DEBUG" "DIM" "$@"; }

header() {
    echo
    printf "${COLORS[BOLD]}${COLORS[CYAN]}"
    printf "█%.0s" {1..60}; echo
    printf "█%*s█\n" 58 ""
    printf "█%*s%*s█\n" $(((58-${#1})/2)) "" $(((58-${#1}+1)/2)) "$1"
    printf "█%*s█\n" 58 ""
    printf "█%.0s" {1..60}; echo
    printf "${COLORS[RESET]}\n"
}

spinner() {
    local pid=$1
    local delay=0.1
    local spinstr='|/-\'
    local msg="${2:-Processing...}"
    
    while kill -0 "$pid" 2>/dev/null; do
        local temp=${spinstr#?}
        printf "\r${COLORS[CYAN]}[%c] %s${COLORS[RESET]}" "$spinstr" "$msg"
        spinstr=$temp${spinstr%"$temp"}
        sleep $delay
    done
    printf "\r%*s\r" $((${#msg} + 10)) ""
}

cleanup() {
    info "🧹 Cleaning up resources..."
    
    # Kill background processes
    for pid in "${BACKGROUND_PIDS[@]}"; do
        if kill -0 "$pid" 2>/dev/null; then
            kill -TERM "$pid" 2>/dev/null || true
            sleep 1
            kill -KILL "$pid" 2>/dev/null || true
        fi
    done
    
    # Remove temp files
    for file in "${TEMP_FILES[@]}"; do
        rm -f "$file" 2>/dev/null || true
    done
    
    # Clean up ports
    for port in "${CONFIG[API_PORT]}" "${CONFIG[MONITOR_PORT]}"; do
        lsof -ti tcp:"$port" | xargs -r kill -9 2>/dev/null || true
    done
    
    success "✅ Cleanup completed"
}

trap cleanup EXIT INT TERM

# ============================================================================
# Resource Management
# ============================================================================

check_resources() {
    info "🔍 Checking system resources..."
    
    # Check CPU cores
    local cpu_cores=$(nproc 2>/dev/null || sysctl -n hw.ncpu 2>/dev/null || echo "4")
    info "CPU cores available: $cpu_cores"
    
    # Check memory
    local total_mem_kb
    if command -v free >/dev/null 2>&1; then
        total_mem_kb=$(free | awk '/^Mem:/{print $2}')
    elif command -v vm_stat >/dev/null 2>&1; then
        local pages=$(vm_stat | grep "Pages free" | awk '{print $3}' | tr -d '.')
        total_mem_kb=$((pages * 4))
    else
        total_mem_kb=8388608  # Default 8GB
    fi
    
    local total_mem_mb=$((total_mem_kb / 1024))
    info "Memory available: ${total_mem_mb}MB"
    
    # Adjust configuration based on resources
    if [[ $total_mem_mb -lt 2048 ]]; then
        warn "Low memory detected, reducing parallel workers"
        CONFIG[MAX_PARALLEL_GAMES]=2
        CONFIG[TRAINING_WORKERS]=1
    elif [[ $total_mem_mb -gt 8192 ]]; then
        info "High memory detected, increasing parallel workers"
        CONFIG[MAX_PARALLEL_GAMES]=16
        CONFIG[TRAINING_WORKERS]=8
    fi
    
    # Check disk space
    local disk_space=$(df . | awk 'NR==2 {print $4}')
    if [[ $disk_space -lt 1048576 ]]; then  # Less than 1GB
        warn "Low disk space detected: ${disk_space}KB available"
    fi
}

monitor_resources() {
    local monitor_file="resource-monitor.log"
    TEMP_FILES+=("$monitor_file")
    
    while true; do
        local timestamp=$(date -Iseconds)
        local cpu_usage
        local mem_usage
        
        # Get CPU usage
        if command -v top >/dev/null 2>&1; then
            cpu_usage=$(top -l 1 -n 0 | grep "CPU usage" | awk '{print $3}' | tr -d '%' 2>/dev/null || echo "0")
        else
            cpu_usage="0"
        fi
        
        # Get memory usage
        if command -v ps >/dev/null 2>&1; then
            mem_usage=$(ps -eo pid,ppid,cmd,%mem,%cpu --sort=-%mem | head -10 | awk '{sum+=$4} END {print sum}' 2>/dev/null || echo "0")
        else
            mem_usage="0"
        fi
        
        echo "[$timestamp] CPU: ${cpu_usage}% | Memory: ${mem_usage}%" >> "$monitor_file"
        sleep 30
    done &
    
    BACKGROUND_PIDS+=($!)
}

# ============================================================================
# Parallel Processing Engine
# ============================================================================

parallel_game_generation() {
    local total_games="${1:-1000}"
    local workers="${CONFIG[MAX_PARALLEL_GAMES]}"
    local games_per_worker=$((total_games / workers))
    
    info "🎮 Starting parallel game generation: $total_games games across $workers workers"
    
    local output_dir="backend/src/ml/data/parallel"
    mkdir -p "$output_dir"
    
    local worker_pids=()
    
    for ((i=0; i<workers; i++)); do
        local worker_output="$output_dir/games_worker_$i.json"
        TEMP_FILES+=("$worker_output")
        
        (
            # Worker-specific game generation
            NODE_OPTIONS="--max_old_space_size=1024" \
            npx ts-node backend/src/ml/scripts/generate_game_data.ts \
                --output "$worker_output" \
                --games "$games_per_worker" \
                --worker-id "$i" \
                --quiet \
                > "worker_$i.log" 2>&1
        ) &
        
        worker_pids+=($!)
        BACKGROUND_PIDS+=($!)
    done
    
    # Monitor workers with progress
    local completed=0
    while [[ $completed -lt $workers ]]; do
        completed=0
        for pid in "${worker_pids[@]}"; do
            if ! kill -0 "$pid" 2>/dev/null; then
                ((completed++))
            fi
        done
        
        printf "\r${COLORS[CYAN]}Progress: %d/%d workers completed${COLORS[RESET]}" "$completed" "$workers"
        sleep 2
    done
    echo
    
    # Merge results
    info "🔗 Merging parallel game results..."
    python3 -c "
import json
import glob

all_games = []
for file in glob.glob('$output_dir/games_worker_*.json'):
    try:
        with open(file, 'r') as f:
            games = json.load(f)
            if isinstance(games, list):
                all_games.extend(games)
            else:
                all_games.append(games)
    except Exception as e:
        print(f'Warning: Could not load {file}: {e}')

with open('backend/src/ml/data/raw_games.json', 'w') as f:
    json.dump(all_games, f, indent=2)

print(f'Merged {len(all_games)} games successfully')
"
    
    success "✅ Parallel game generation completed: $total_games games"
}

parallel_training() {
    info "🧠 Starting parallel training pipeline..."
    
    # Run preprocessing in background
    (
        info "📊 Preprocessing data..."
        python3 backend/src/ml/scripts/preprocess.py
    ) &
    local preprocess_pid=$!
    BACKGROUND_PIDS+=($preprocess_pid)
    
    # Wait for preprocessing
    wait $preprocess_pid
    
    # Start multiple training processes
    local training_pids=()
    
    for ((i=0; i<CONFIG[TRAINING_WORKERS]; i++)); do
        (
            CUDA_VISIBLE_DEVICES=$((i % 4)) \
            python3 backend/src/ml/scripts/train_policy.py \
                --train-json "backend/src/ml/data/train.json" \
                --test-data "backend/src/ml/data/test.json" \
                --epochs 25 \
                --batch-size 64 \
                --worker-id "$i" \
                --output "models/worker_${i}_policy.pt"
        ) &
        
        training_pids+=($!)
        BACKGROUND_PIDS+=($!)
    done
    
    # Monitor training progress
    local start_time=$(date +%s)
    while true; do
        local running=0
        for pid in "${training_pids[@]}"; do
            if kill -0 "$pid" 2>/dev/null; then
                ((running++))
            fi
        done
        
        if [[ $running -eq 0 ]]; then
            break
        fi
        
        local elapsed=$(($(date +%s) - start_time))
        printf "\r${COLORS[YELLOW]}Training: %d/%d workers active (${elapsed}s elapsed)${COLORS[RESET]}" \
            "$running" "${CONFIG[TRAINING_WORKERS]}"
        sleep 5
    done
    echo
    
    success "✅ Parallel training completed"
}

# ============================================================================
# Monitoring & Metrics
# ============================================================================

start_monitoring_dashboard() {
    if [[ "${STATE[MONITOR_MODE]}" == "true" ]]; then
        info "📊 Starting monitoring dashboard on port ${CONFIG[MONITOR_PORT]}..."
        
        # Simple HTTP monitoring server
        (
            cd "$(dirname "$0")"
            python3 -c "
import http.server
import socketserver
import json
import time
import threading
from pathlib import Path

class MonitoringHandler(http.server.SimpleHTTPRequestHandler):
    def do_GET(self):
        if self.path == '/metrics':
            self.send_response(200)
            self.send_header('Content-type', 'application/json')
            self.end_headers()
            
            metrics = {
                'timestamp': time.time(),
                'status': 'running',
                'workers': ${CONFIG[TRAINING_WORKERS]},
                'parallel_games': ${CONFIG[MAX_PARALLEL_GAMES]},
                'memory_limit': ${CONFIG[MEMORY_LIMIT_MB]},
            }
            
            # Read resource monitor if available
            try:
                with open('resource-monitor.log', 'r') as f:
                    lines = f.readlines()
                    if lines:
                        last_line = lines[-1].strip()
                        metrics['resources'] = last_line
            except:
                pass
                
            self.wfile.write(json.dumps(metrics).encode())
        else:
            super().do_GET()

with socketserver.TCPServer(('', ${CONFIG[MONITOR_PORT]}), MonitoringHandler) as httpd:
    print(f'Monitoring dashboard: http://localhost:${CONFIG[MONITOR_PORT]}/metrics')
    httpd.serve_forever()
"
        ) &
        
        BACKGROUND_PIDS+=($!)
        info "📊 Monitoring dashboard started: http://localhost:${CONFIG[MONITOR_PORT]}/metrics"
    fi
}

# ============================================================================
# Main Pipeline Execution
# ============================================================================

run_offline_pipeline() {
    header "Offline Training Pipeline"
    
    if [[ "${STATE[PARALLEL_MODE]}" == "true" ]]; then
        parallel_game_generation "${CONFIG[BENCHMARK_GAMES]}"
        parallel_training
    else
        info "🎮 Generating game data..."
        npx ts-node backend/src/ml/scripts/generate_game_data.ts
        
        info "📊 Preprocessing data..."
        python3 backend/src/ml/scripts/preprocess.py
        
        info "🧠 Training policy network..."
        python3 backend/src/ml/scripts/train_policy.py \
            --train-json backend/src/ml/data/train.json \
            --test-data backend/src/ml/data/test.json \
            --epochs 50 \
            --batch-size 128
    fi
    
    success "✅ Offline pipeline completed"
}

run_continuous_pipeline() {
    header "Continuous Learning Pipeline"
    
    info "🔄 Starting continuous learning loop..."
    local cycle=1
    
    while true; do
        info "📈 Cycle $cycle: Starting continuous learning iteration"
        
        # Bootstrap model
        cp "models/best_policy_net.pt" "models/current_policy_net.pt" 2>/dev/null || true
        
        # Ingest new data
        python3 "ml_service/scripts/ingest_and_buffer.py" \
            --live-log "ml_service/data/live_games.jsonl" \
            --buffer "ml_service/data/replay_buffer.pkl" \
            --max-size 1000
        
        # Fine-tune
        local timestamp=$(date -u +'%Y%m%dT%H%M%SZ')
        local fine_tuned_model="models/fine_tuned_${timestamp}.pt"
        
        python3 "ml_service/scripts/fine_tune.py" \
            --base-model "models/current_policy_net.pt" \
            --buffer "ml_service/data/replay_buffer.pkl" \
            --output "$fine_tuned_model" \
            --epochs 3 \
            --batch-size 64
        
        # Evaluate and promote
        python3 "ml_service/scripts/evaluate_new_model.py" \
            --new "$fine_tuned_model" \
            --old "models/current_policy_net.pt" \
            --games 50 \
            --output "ml_service/data/eval_report.json"
        
        python3 "ml_service/scripts/promote_if_good.py" \
            --report "ml_service/data/eval_report.json" \
            --new "$fine_tuned_model" \
            --prod-target "models/current_policy_net.pt" \
            --threshold 0.52
        
        success "✅ Cycle $cycle completed"
        ((cycle++))
        
        sleep 60  # Wait 1 minute between cycles
    done
}

run_benchmark() {
    header "ML Benchmark Suite"
    
    info "🏃‍♂️ Running benchmark with ${CONFIG[BENCHMARK_GAMES]} games..."
    local start_time=$(date +%s)
    
    parallel_game_generation "${CONFIG[BENCHMARK_GAMES]}"
    
    local end_time=$(date +%s)
    local duration=$((end_time - start_time))
    local games_per_second=$((CONFIG[BENCHMARK_GAMES] / duration))
    
    success "✅ Benchmark completed in ${duration}s (${games_per_second} games/sec)"
}

# ============================================================================
# Argument Parsing
# ============================================================================

parse_arguments() {
    while [[ $# -gt 0 ]]; do
        case $1 in
            --force-cleanup)     STATE[FORCE_CLEANUP]=true ;;
            --offline-only)      STATE[OFFLINE_ONLY]=true ;;
            --continuous-only)   STATE[CONTINUOUS_ONLY]=true ;;
            --parallel)          STATE[PARALLEL_MODE]=true ;;
            --monitor)           STATE[MONITOR_MODE]=true ;;
            --production)        STATE[PRODUCTION_MODE]=true ;;
            --benchmark)         STATE[BENCHMARK_MODE]=true ;;
            --quiet)             STATE[QUIET_MODE]=true ;;
            --help|-h)           show_help; exit 0 ;;
            *)                   error "Unknown option: $1"; exit 1 ;;
        esac
        shift
    done
}

show_help() {
    cat << EOF
${COLORS[BOLD]}${CONFIG[PROJECT_NAME]} v${CONFIG[VERSION]}${COLORS[RESET]}

${COLORS[CYAN]}USAGE:${COLORS[RESET]}
    $0 [OPTIONS]

${COLORS[CYAN]}OPTIONS:${COLORS[RESET]}
    --force-cleanup      Force cleanup of previous runs
    --offline-only       Run only offline training pipeline
    --continuous-only    Run only continuous learning pipeline
    --parallel           Enable parallel processing mode
    --monitor            Start monitoring dashboard
    --production         Production mode with optimizations
    --benchmark          Run benchmark suite
    --quiet              Reduce output verbosity
    --help, -h           Show this help message

${COLORS[CYAN]}EXAMPLES:${COLORS[RESET]}
    $0                               # Run full pipeline
    $0 --parallel --monitor          # Parallel mode with monitoring
    $0 --offline-only --benchmark    # Benchmark offline training
    $0 --continuous-only             # Only continuous learning

${COLORS[CYAN]}MONITORING:${COLORS[RESET]}
    Dashboard: http://localhost:${CONFIG[MONITOR_PORT]}/metrics
    Logs:      ml-pipeline.log
EOF
}

# ============================================================================
# Main Entry Point
# ============================================================================

main() {
    # Initialize
    header "${CONFIG[PROJECT_NAME]} v${CONFIG[VERSION]}"
    parse_arguments "$@"
    
    # Force cleanup if requested
    if [[ "${STATE[FORCE_CLEANUP]}" == "true" ]]; then
        info "🧹 Force cleanup requested..."
        cleanup
    fi
    
    # Resource checks
    check_resources
    
    # Start monitoring if requested
    start_monitoring_dashboard
    if [[ "${STATE[MONITOR_MODE]}" == "true" ]]; then
        monitor_resources
    fi
    
    # Execute based on mode
    if [[ "${STATE[BENCHMARK_MODE]}" == "true" ]]; then
        run_benchmark
    elif [[ "${STATE[OFFLINE_ONLY]}" == "true" ]]; then
        run_offline_pipeline
    elif [[ "${STATE[CONTINUOUS_ONLY]}" == "true" ]]; then
        run_continuous_pipeline
    else
        # Run both offline and continuous
        run_offline_pipeline
        run_continuous_pipeline
    fi
    
    success "🎉 ML Pipeline completed successfully!"
}

# Execute if run directly
if [[ "${BASH_SOURCE[0]}" == "${0}" ]]; then
    main "$@"
fi 