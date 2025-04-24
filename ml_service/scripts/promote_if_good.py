#!/usr/bin/env python3
"""
Script: promote_if_good.py
Promote a newly fine-tuned model to production if it exceeds a win-rate threshold.
"""
import sys
import os
import json
import shutil
import logging
import argparse
from pathlib import Path
from datetime import datetime, timezone

# ----------------------------------------------------------------------------
# Logging setup
# ----------------------------------------------------------------------------
logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s: %(message)s")
logger = logging.getLogger(__name__)


# ----------------------------------------------------------------------------
# Load evaluation report
# ----------------------------------------------------------------------------
def load_report(report_path: Path) -> dict:
    try:
        with report_path.open("r") as f:
            return json.load(f)
    except Exception as e:
        logger.error(f"Failed to load report at {report_path}: {e}")
        sys.exit(1)


# ----------------------------------------------------------------------------
# Promote model
# ----------------------------------------------------------------------------
def promote_model(new_model_path: Path, prod_model_path: Path):
    prod_model_path.parent.mkdir(parents=True, exist_ok=True)
    # Copy new model to production location
    shutil.copy2(new_model_path, prod_model_path)
    logger.info(f"Promoted model '{new_model_path}' to '{prod_model_path}'")


# ----------------------------------------------------------------------------
# Main entrypoint
# ----------------------------------------------------------------------------
def main():
    parser = argparse.ArgumentParser(
        description="Promote new model if evaluation criteria met."
    )
    parser.add_argument(
        "--report",
        "-r",
        type=str,
        default=os.path.join("data", "eval_report.json"),
        help="Path to evaluation report JSON",
    )
    parser.add_argument(
        "--new",
        "-n",
        type=str,
        required=True,
        help="Path to newly trained model checkpoint",
    )
    parser.add_argument(
        "--prod-target",
        "-p",
        type=str,
        default=os.path.join("..", "models", "current_policy_net.pt"),
        help="Production model path to overwrite",
    )
    parser.add_argument(
        "--threshold",
        "-t",
        type=float,
        default=0.5,
        help="Minimum win-rate for promotion (0-1)",
    )
    args = parser.parse_args()

    report_path = Path(args.report)
    report = load_report(report_path)

    new_win_rate = report.get("new_win_rate")
    if new_win_rate is None:
        logger.error("Report missing 'new_win_rate'")
        sys.exit(1)

    logger.info(f"Evaluated new win rate: {new_win_rate}")
    if new_win_rate >= args.threshold:
        prod_path = Path(args.prod_target)
        new_model = Path(args.new)
        promote_model(new_model, prod_path)
        outcome = "promoted"
    else:
        logger.info(
            f"Win rate {new_win_rate} below threshold {args.threshold}. Not promoting."
        )
        outcome = "not_promoted"

    summary = {
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "new_win_rate": new_win_rate,
        "threshold": args.threshold,
        "outcome": outcome,
    }
    # Print summary for CI logs
    print(json.dumps(summary, indent=2))


if __name__ == "__main__":
    main()
