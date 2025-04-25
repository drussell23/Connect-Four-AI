#!/usr/bin/env bash
set -euo pipefail

# ----------------------------------------------------------------------------
# scripts/run_ml_service_pipeline.sh
# Advanced Continuous ML Service Pipeline:
#   1) Bootstrap baseline model
#   2) Ingest new game data
#   3) Fine-tune model
#   4) Evaluate candidate model
#   5) Promote if performance threshold met
# ----------------------------------------------------------------------------

# ANSI color codes for enhanced log readability
RED="\033[1;31m"
GREEN="\033[1;32m"
YELLOW="\033[1;33m"
BLUE="\033[1;34m"
RESET="\033[0m"

#-----------------------------------------------------------------------------#
# Function: echo_log
# Purpose : Print colored, leveled log messages with timestamps
# Usage   : echo_log <LEVEL> <message>
# Levels  : INFO, WARN, ERROR, DEBUG
#-----------------------------------------------------------------------------#
echo_log() {
  local level="$1"; shift
  local ts="$(date -u +'%Y-%m-%dT%H:%M:%SZ')"
  local color
  case "$level" in
    INFO)  color="$GREEN";;
    WARN)  color="$YELLOW";;
    ERROR) color="$RED";;
    DEBUG) color="$BLUE";;
    *)     color="$RESET";;
  esac
  printf "%b[%s] [%s] %s%b\n" "$color" "$ts" "$level" "$*" "$RESET"
}

#-----------------------------------------------------------------------------#
# Function: eventual_error
# Purpose : Trap and handle any uncaught errors with line number reporting
# Trigger : ERR trap
#-----------------------------------------------------------------------------#
eventual_error() {
  local lineno="$1"
  echo_log ERROR "Pipeline aborted due to error at line $lineno"
  exit 1
}
trap 'eventual_error ${LINENO}' ERR

#-----------------------------------------------------------------------------#
# Function: cleanup
# Purpose : Handle SIGINT/SIGTERM for graceful shutdown
# Trigger : SIGINT, SIGTERM traps
#-----------------------------------------------------------------------------#
cleanup() {
  echo_log INFO "Termination signal received. Exiting pipeline..."
  exit 0
}
trap cleanup SIGINT SIGTERM

#-----------------------------------------------------------------------------#
# Setup: Resolve project root directory and change to it
#-----------------------------------------------------------------------------#
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" &>/dev/null && pwd)"
ROOT="$(dirname "$SCRIPT_DIR")"
cd "$ROOT"

#-----------------------------------------------------------------------------#
# Function: bootstrap_model
# Purpose : Copy the baseline model into working 'current' location
# Creates : models folder if missing
#-----------------------------------------------------------------------------#
bootstrap_model() {
  echo_log INFO "Bootstrapping baseline model"
  mkdir -p "$ROOT/models"
  cp "$ROOT/models/best_policy_net.pt" "$ROOT/models/current_policy_net.pt"
}

#-----------------------------------------------------------------------------#
# Function: ingest_stage
# Purpose : Append new live game logs to replay buffer for continuous training
# Calls   : ingest_and_buffer.py script
#-----------------------------------------------------------------------------#
ingest_stage() {
  echo_log INFO "Stage 1: Ingesting new game logs"
  python3 "$ROOT/ml_service/scripts/ingest_and_buffer.py" \
    --live-log   "ml_service/data/live_games.jsonl" \
    --buffer     "ml_service/data/replay_buffer.pkl" \
    --max-size   1000
  echo_log INFO "Ingestion complete: replay buffer updated"
}

#-----------------------------------------------------------------------------#
# Function: tune_stage
# Purpose : Fine-tune the current policy network on aggregated replay buffer
# Generates: timestamped fine-tuned model file
#-----------------------------------------------------------------------------#
tune_stage() {
  echo_log INFO "Stage 2: Fine-tuning policy network"
  local ts="$(date -u +'%Y%m%dT%H%M%SZ')"
  OUT="$ROOT/models/fine_tuned_${ts}.pt"
  python3 "$ROOT/ml_service/scripts/fine_tune.py" \
    --base-model  "$ROOT/models/current_policy_net.pt" \
    --buffer      "ml_service/data/replay_buffer.pkl" \
    --output      "$OUT" \
    --epochs      3 \
    --batch-size  64 \
    --lr          1e-4 \
    --historic    0.8

  # Fallback: if training produced no output, keep current model
  if [[ ! -s "$OUT" ]]; then
    echo_log WARN "Fine-tune output empty; using existing model"
    cp "$ROOT/models/current_policy_net.pt" "$OUT"
  fi
  echo_log INFO "Fine-tuning complete: model saved as $OUT"
}

#-----------------------------------------------------------------------------#
# Function: evaluate_stage
# Purpose : Compare fine-tuned model against current policy via self-play
# Outputs : JSON report with win rates
#-----------------------------------------------------------------------------#
evaluate_stage() {
  echo_log INFO "Stage 3: Evaluating fine-tuned model"
  python3 "$ROOT/ml_service/scripts/evaluate_new_model.py" \
    --new    "$OUT" \
    --old    "$ROOT/models/current_policy_net.pt" \
    --games  50 \
    --output "ml_service/data/eval_report.json"
  echo_log INFO "Evaluation complete: report saved to ml_service/data/eval_report.json"
}

#-----------------------------------------------------------------------------#
# Function: promote_stage
# Purpose : Promote fine-tuned model to 'current' if performance threshold met
# Threshold: win rate > 0.52 by default
#-----------------------------------------------------------------------------#
promote_stage() {
  echo_log INFO "Stage 4: Promoting model based on performance threshold"
  python3 "$ROOT/ml_service/scripts/promote_if_good.py" \
    --report      "ml_service/data/eval_report.json" \
    --new         "$OUT" \
    --prod-target "$ROOT/models/current_policy_net.pt" \
    --threshold   0.52
  echo_log INFO "Promotion check complete: current_policy_net.pt updated if criteria met"
}

#-----------------------------------------------------------------------------#
# Function: main
# Purpose : Execute all pipeline stages in order
#-----------------------------------------------------------------------------#
main() {
  echo_log INFO "Starting continuous learning pipeline"
  bootstrap_model
  ingest_stage
  tune_stage
  evaluate_stage
  promote_stage
  echo_log INFO "Continuous learning pipeline finished successfully"
}

# Execute main
main
