#!/usr/bin/env bash
set -euo pipefail

# simple countdown helper
countdown() {
  for ((i=3; i>0; i--)); do
    echo "⟳ Continuing in ${i}..."
    sleep 1
  done
}

# 1. Generate raw self-play games
echo "⟳ Generating raw games…"
npx ts-node scripts/generate_game_data.ts
echo "✓ Step 1 complete."
countdown

# 2. Preprocess into train/test
echo "⟳ Preprocessing data…"
python scripts/preprocess.py
echo "✓ Step 2 complete."
countdown

# 3. Quick sanity check
echo "✓ Data files:"
ls -lh data/raw_games.json data/train.json data/test.json
echo "✓ Step 3 complete."
countdown

# 4. Train policy network
echo "⟳ Training model…"
python src/train.py \
  --data_path ../data/train.json \
  --model_dir ../models \
  --epochs 50 \
  --batch_size 128
echo "✓ Step 4 complete."
countdown

# 5. Launch the FastAPI server
echo "⟳ Starting Uvicorn…"
uvicorn ml_service:app --reload --host 0.0.0.0 --port 8000
