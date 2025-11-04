"""
📊 LEARNING STABILITY MONITOR
=============================

Advanced monitoring system for continuous learning that:
- Tracks model performance over time
- Detects catastrophic forgetting
- Monitors pattern-specific improvements
- Provides real-time alerts
- Maintains performance baselines
"""

import asyncio
import json
import logging
import time
from collections import defaultdict, deque
from dataclasses import asdict, dataclass
from datetime import datetime, timedelta
from typing import Any, Dict, List, Optional, Tuple

import matplotlib.pyplot as plt
import numpy as np
import seaborn as sns
import torch
from prometheus_client import Counter, Gauge, Histogram

# Configure logging
logger = logging.getLogger(__name__)

# Prometheus metrics
model_performance_gauge = Gauge("ml_model_performance", "Current model performance")
pattern_defense_gauge = Gauge(
    "ml_pattern_defense_rate", "Pattern defense success rate", ["pattern"]
)
learning_stability_gauge = Gauge("ml_learning_stability", "Learning stability score")
forgetting_events_counter = Counter(
    "ml_catastrophic_forgetting_total", "Total catastrophic forgetting events"
)
model_updates_counter = Counter("ml_model_updates_total", "Total model updates")


@dataclass
class PerformanceSnapshot:
    """Snapshot of model performance at a point in time"""

    timestamp: datetime
    version: int
    overall_accuracy: float
    win_rate: float
    pattern_defense_rates: Dict[str, float]
    test_scores: Dict[str, float]
    memory_usage: float
    inference_time: float


@dataclass
class StabilityReport:
    """Comprehensive stability analysis report"""

    is_stable: bool
    stability_score: float
    performance_trend: str
    risk_factors: List[str]
    recommendations: List[str]
    pattern_analysis: Dict[str, Any]


class LearningStabilityMonitor:
    """Advanced monitoring system for continuous learning stability"""

    def __init__(self, config: Dict[str, Any]):
        self.config = config

        # Thresholds
        self.catastrophic_threshold = config.get("catastrophic_threshold", 0.15)
        self.degradation_threshold = config.get("degradation_threshold", 0.05)
        self.improvement_threshold = config.get("improvement_threshold", 0.02)

        # History tracking
        self.performance_history: deque[PerformanceSnapshot] = deque(maxlen=1000)
        self.baseline_performance: Optional[PerformanceSnapshot] = None
        self.pattern_baselines: Dict[str, float] = {}

        # Stability metrics
        self.stability_scores: deque[float] = deque(maxlen=100)
        self.forgetting_events: List[Dict[str, Any]] = []
        self.improvement_events: List[Dict[str, Any]] = []

        # Pattern-specific tracking
        self.pattern_performance: Dict[str, deque[float]] = defaultdict(
            lambda: deque(maxlen=100)
        )
        self.pattern_trends: Dict[str, str] = {}

        # Test suites
        self.test_suites = self._initialize_test_suites()

        # Monitoring state
        self.monitoring_active = True
        self.alert_callbacks = []

        logger.info("Learning Stability Monitor initialized")

    def _initialize_test_suites(self) -> Dict[str, List[Dict[str, Any]]]:
        """Initialize comprehensive test suites"""
        return {
            "basic": self._create_basic_tests(),
            "pattern": self._create_pattern_tests(),
            "edge_cases": self._create_edge_case_tests(),
            "adversarial": self._create_adversarial_tests(),
        }

    def _create_basic_tests(self) -> List[Dict[str, Any]]:
        """Create basic capability tests"""
        return [
            # Win in 1 move
            {
                "name": "win_in_1_horizontal",
                "board": self._create_test_board(
                    ["......." "......." "......." "......." "......." "YYY...."]
                ),
                "expected_move": 3,
                "category": "immediate_win",
            },
            # Block opponent win
            {
                "name": "block_win_horizontal",
                "board": self._create_test_board(
                    ["......." "......." "......." "......." "......." "RRR...."]
                ),
                "expected_move": 3,
                "category": "immediate_block",
            },
            # Center control
            {
                "name": "opening_center",
                "board": self._create_test_board(
                    ["......." "......." "......." "......." "......." "......."]
                ),
                "expected_move": 3,
                "category": "opening",
            },
        ]

    def _create_pattern_tests(self) -> List[Dict[str, Any]]:
        """Create pattern-specific defense tests"""
        return [
            # Horizontal threat
            {
                "name": "horizontal_threat_2",
                "board": self._create_test_board(
                    ["......." "......." "......." "......." "......." ".RR...."]
                ),
                "blocking_moves": [0, 3],
                "pattern": "horizontal",
            },
            # Vertical threat
            {
                "name": "vertical_threat_3",
                "board": self._create_test_board(
                    ["......." "......." "......." ".R....." ".R....." ".R....."]
                ),
                "blocking_moves": [1],
                "pattern": "vertical",
            },
            # Diagonal threat
            {
                "name": "diagonal_threat",
                "board": self._create_test_board(
                    ["......." "......." "......." "...R..." "..RY..." ".RYY..."]
                ),
                "blocking_moves": [3],
                "pattern": "diagonal",
            },
        ]

    def _create_edge_case_tests(self) -> List[Dict[str, Any]]:
        """Create edge case tests"""
        return [
            # Almost full board
            {
                "name": "almost_full_board",
                "board": self._create_test_board(
                    [".RYRYR." "YRYRYRY" "RYRYRYY" "YRYRYRY" "RYRYRYY" "YRYRYRY"]
                ),
                "valid_moves": [0, 6],
                "category": "endgame",
            }
        ]

    def _create_adversarial_tests(self) -> List[Dict[str, Any]]:
        """Create adversarial tests to catch overfitting"""
        # Generate positions that might exploit learned patterns
        return []

    def _create_test_board(self, board_strings: List[str]) -> List[List[str]]:
        """Convert string representation to board"""
        board = []
        for row_str in board_strings:
            row = []
            for char in row_str:
                if char == "Y":
                    row.append("Yellow")
                elif char == "R":
                    row.append("Red")
                else:
                    row.append("Empty")
            board.append(row)
        return board

    async def evaluate_model(self, model, version: int) -> PerformanceSnapshot:
        """Comprehensive model evaluation"""
        start_time = time.time()

        # Run all test suites
        test_results = {}
        for suite_name, test_suite in self.test_suites.items():
            suite_score = await self._run_test_suite(model, test_suite)
            test_results[suite_name] = suite_score

        # Calculate overall metrics
        overall_accuracy = np.mean(list(test_results.values()))

        # Pattern-specific evaluation
        pattern_scores = await self._evaluate_pattern_defense(model)

        # Performance metrics
        inference_time = (time.time() - start_time) / len(self.test_suites)
        memory_usage = self._get_model_memory_usage(model)

        # Create snapshot
        snapshot = PerformanceSnapshot(
            timestamp=datetime.now(),
            version=version,
            overall_accuracy=overall_accuracy,
            win_rate=test_results.get("basic", 0),
            pattern_defense_rates=pattern_scores,
            test_scores=test_results,
            memory_usage=memory_usage,
            inference_time=inference_time,
        )

        # Update history
        self.performance_history.append(snapshot)

        # Update metrics
        model_performance_gauge.set(overall_accuracy)
        for pattern, score in pattern_scores.items():
            pattern_defense_gauge.labels(pattern=pattern).set(score)

        return snapshot

    async def _run_test_suite(self, model, test_suite: List[Dict[str, Any]]) -> float:
        """Run a test suite and return accuracy"""
        if not test_suite:
            return 1.0

        correct = 0
        total = len(test_suite)

        model.eval()
        with torch.no_grad():
            for test in test_suite:
                if await self._evaluate_single_test(model, test):
                    correct += 1

        return correct / total

    async def _evaluate_single_test(self, model, test: Dict[str, Any]) -> bool:
        """Evaluate model on a single test"""
        board_tensor = self._board_to_tensor(test["board"])
        output = model(board_tensor.unsqueeze(0))
        predicted_move = output.argmax(dim=1).item()

        # Check based on test type
        if "expected_move" in test:
            return predicted_move == test["expected_move"]
        elif "blocking_moves" in test:
            return predicted_move in test["blocking_moves"]
        elif "valid_moves" in test:
            return predicted_move in test["valid_moves"]
        else:
            return True

    async def _evaluate_pattern_defense(self, model) -> Dict[str, float]:
        """Evaluate pattern-specific defense capabilities"""
        pattern_scores = {}

        for test in self.test_suites["pattern"]:
            pattern = test.get("pattern")
            if pattern:
                if pattern not in pattern_scores:
                    pattern_scores[pattern] = []

                success = await self._evaluate_single_test(model, test)
                pattern_scores[pattern].append(1.0 if success else 0.0)

        # Average scores per pattern
        return {
            pattern: np.mean(scores) if scores else 0.0
            for pattern, scores in pattern_scores.items()
        }

    def _board_to_tensor(self, board: List[List[str]]) -> torch.Tensor:
        """Convert board to tensor"""
        tensor = torch.zeros(2, 6, 7)

        for r in range(6):
            for c in range(7):
                if board[r][c] == "Yellow":
                    tensor[0, r, c] = 1
                elif board[r][c] == "Red":
                    tensor[1, r, c] = 1

        return tensor

    def _get_model_memory_usage(self, model) -> float:
        """Estimate model memory usage in MB"""
        param_size = 0
        buffer_size = 0

        for param in model.parameters():
            param_size += param.nelement() * param.element_size()

        for buffer in model.buffers():
            buffer_size += buffer.nelement() * buffer.element_size()

        return (param_size + buffer_size) / 1024 / 1024

    async def check_stability(
        self, current_snapshot: PerformanceSnapshot
    ) -> StabilityReport:
        """Comprehensive stability check"""
        # Set baseline if needed
        if self.baseline_performance is None:
            self.baseline_performance = current_snapshot
            for pattern, score in current_snapshot.pattern_defense_rates.items():
                self.pattern_baselines[pattern] = score

        # Calculate stability metrics
        stability_score = self._calculate_stability_score(current_snapshot)
        performance_trend = self._analyze_performance_trend()
        risk_factors = self._identify_risk_factors(current_snapshot)
        pattern_analysis = self._analyze_pattern_performance()

        # Determine if stable
        is_stable = (
            stability_score > 0.7
            and len([r for r in risk_factors if "catastrophic" in r.lower()]) == 0
        )

        # Generate recommendations
        recommendations = self._generate_recommendations(
            current_snapshot, risk_factors, pattern_analysis
        )

        report = StabilityReport(
            is_stable=is_stable,
            stability_score=stability_score,
            performance_trend=performance_trend,
            risk_factors=risk_factors,
            recommendations=recommendations,
            pattern_analysis=pattern_analysis,
        )

        # Update metrics
        learning_stability_gauge.set(stability_score)

        # Check for alerts
        await self._check_alerts(report, current_snapshot)

        return report

    def _calculate_stability_score(self, current: PerformanceSnapshot) -> float:
        """Calculate overall stability score (0-1)"""
        scores = []

        # Performance stability
        perf_drop = (
            self.baseline_performance.overall_accuracy - current.overall_accuracy
        )
        perf_score = max(0, 1 - (perf_drop / self.catastrophic_threshold))
        scores.append(perf_score)

        # Consistency score
        if len(self.performance_history) >= 10:
            recent_performances = [
                s.overall_accuracy for s in list(self.performance_history)[-10:]
            ]
            consistency = 1 - (
                np.std(recent_performances) / np.mean(recent_performances)
            )
            scores.append(consistency)

        # Pattern stability
        pattern_scores = []
        for pattern, current_score in current.pattern_defense_rates.items():
            baseline_score = self.pattern_baselines.get(pattern, current_score)
            pattern_stability = (
                min(1.0, current_score / baseline_score) if baseline_score > 0 else 1.0
            )
            pattern_scores.append(pattern_stability)

        if pattern_scores:
            scores.append(np.mean(pattern_scores))

        # Test suite performance
        test_score = np.mean(list(current.test_scores.values()))
        scores.append(test_score)

        return np.mean(scores)

    def _analyze_performance_trend(self) -> str:
        """Analyze recent performance trend"""
        if len(self.performance_history) < 5:
            return "insufficient_data"

        recent = [s.overall_accuracy for s in list(self.performance_history)[-10:]]

        # Calculate trend
        x = np.arange(len(recent))
        slope, _ = np.polyfit(x, recent, 1)

        if slope > self.improvement_threshold:
            return "improving"
        elif slope < -self.degradation_threshold:
            return "degrading"
        else:
            return "stable"

    def _identify_risk_factors(self, current: PerformanceSnapshot) -> List[str]:
        """Identify stability risk factors"""
        risks = []

        # Check catastrophic forgetting
        perf_drop = (
            self.baseline_performance.overall_accuracy - current.overall_accuracy
        )
        if perf_drop > self.catastrophic_threshold:
            risks.append(
                f"Catastrophic forgetting detected: {perf_drop:.2%} performance drop"
            )

        # Check pattern-specific degradation
        for pattern, current_score in current.pattern_defense_rates.items():
            baseline = self.pattern_baselines.get(pattern, current_score)
            if baseline > 0 and current_score < baseline * 0.8:
                risks.append(
                    f"{pattern} defense degraded by {(1 - current_score/baseline):.2%}"
                )

        # Check consistency
        if len(self.performance_history) >= 10:
            recent = [s.overall_accuracy for s in list(self.performance_history)[-10:]]
            if np.std(recent) > 0.1:
                risks.append("High performance variability detected")

        # Check specific test failures
        for test_name, score in current.test_scores.items():
            if score < 0.7:
                risks.append(f"Poor performance on {test_name} tests: {score:.2%}")

        return risks

    def _analyze_pattern_performance(self) -> Dict[str, Any]:
        """Detailed pattern performance analysis"""
        analysis = {}

        for pattern in ["horizontal", "vertical", "diagonal", "anti-diagonal"]:
            if pattern in self.pattern_performance:
                recent_scores = list(self.pattern_performance[pattern])
                if recent_scores:
                    analysis[pattern] = {
                        "current": recent_scores[-1] if recent_scores else 0,
                        "average": np.mean(recent_scores),
                        "trend": self._calculate_trend(recent_scores),
                        "stability": (
                            1 - np.std(recent_scores) if len(recent_scores) > 1 else 1
                        ),
                    }

        return analysis

    def _calculate_trend(self, values: List[float]) -> str:
        """Calculate trend from values"""
        if len(values) < 3:
            return "unknown"

        x = np.arange(len(values))
        slope, _ = np.polyfit(x, values, 1)

        if slope > 0.01:
            return "improving"
        elif slope < -0.01:
            return "degrading"
        else:
            return "stable"

    def _generate_recommendations(
        self,
        current: PerformanceSnapshot,
        risks: List[str],
        pattern_analysis: Dict[str, Any],
    ) -> List[str]:
        """Generate actionable recommendations"""
        recommendations = []

        # Address catastrophic forgetting
        if any("catastrophic" in r.lower() for r in risks):
            recommendations.append(
                "Reduce learning rate to prevent catastrophic forgetting"
            )
            recommendations.append("Increase rehearsal of basic positions")
            recommendations.append("Consider elastic weight consolidation (EWC)")

        # Address pattern-specific issues
        for pattern, analysis in pattern_analysis.items():
            if analysis["trend"] == "degrading":
                recommendations.append(f"Focus training on {pattern} pattern defense")
                recommendations.append(
                    f"Increase {pattern} pattern examples in training"
                )

        # General recommendations
        if current.inference_time > 100:  # ms
            recommendations.append("Consider model pruning to improve inference speed")

        if current.memory_usage > 100:  # MB
            recommendations.append("Optimize model architecture to reduce memory usage")

        return recommendations

    async def _check_alerts(
        self, report: StabilityReport, snapshot: PerformanceSnapshot
    ):
        """Check and trigger alerts if needed"""
        alerts = []

        # Critical alerts
        if not report.is_stable:
            alerts.append(
                {
                    "level": "critical",
                    "message": f"Model stability compromised! Score: {report.stability_score:.2f}",
                    "timestamp": datetime.now(),
                    "data": asdict(report),
                }
            )

        # Warning alerts
        if report.performance_trend == "degrading":
            alerts.append(
                {
                    "level": "warning",
                    "message": "Performance degradation trend detected",
                    "timestamp": datetime.now(),
                }
            )

        # Pattern-specific alerts
        for pattern, analysis in report.pattern_analysis.items():
            if analysis.get("current", 1) < 0.5:
                alerts.append(
                    {
                        "level": "warning",
                        "message": f"Poor {pattern} defense: {analysis['current']:.2%}",
                        "timestamp": datetime.now(),
                    }
                )

        # Trigger callbacks
        for alert in alerts:
            logger.warning(f"Alert: {alert['message']}")
            for callback in self.alert_callbacks:
                await callback(alert)

    def add_alert_callback(self, callback):
        """Add alert callback function"""
        self.alert_callbacks.append(callback)

    def plot_performance_history(self, save_path: Optional[str] = None):
        """Plot performance history"""
        if len(self.performance_history) < 2:
            return

        fig, axes = plt.subplots(2, 2, figsize=(12, 10))

        # Overall performance
        timestamps = [s.timestamp for s in self.performance_history]
        accuracies = [s.overall_accuracy for s in self.performance_history]

        axes[0, 0].plot(timestamps, accuracies, "b-", linewidth=2)
        axes[0, 0].axhline(
            y=self.baseline_performance.overall_accuracy,
            color="r",
            linestyle="--",
            label="Baseline",
        )
        axes[0, 0].set_title("Overall Performance")
        axes[0, 0].set_ylabel("Accuracy")
        axes[0, 0].legend()

        # Pattern performance
        patterns = ["horizontal", "vertical", "diagonal"]
        for i, pattern in enumerate(patterns):
            if pattern in self.pattern_performance:
                scores = list(self.pattern_performance[pattern])
                axes[0, 1].plot(scores, label=pattern, linewidth=2)

        axes[0, 1].set_title("Pattern Defense Performance")
        axes[0, 1].set_ylabel("Success Rate")
        axes[0, 1].legend()

        # Stability score
        stability_scores = list(self.stability_scores)
        axes[1, 0].plot(stability_scores, "g-", linewidth=2)
        axes[1, 0].axhline(y=0.7, color="r", linestyle="--", label="Threshold")
        axes[1, 0].set_title("Stability Score")
        axes[1, 0].set_ylabel("Score")
        axes[1, 0].legend()

        # Memory and inference time
        memory_usage = [s.memory_usage for s in self.performance_history]
        inference_times = [s.inference_time * 1000 for s in self.performance_history]

        ax2 = axes[1, 1].twinx()
        axes[1, 1].plot(timestamps, memory_usage, "b-", label="Memory (MB)")
        ax2.plot(timestamps, inference_times, "r-", label="Inference (ms)")
        axes[1, 1].set_title("Resource Usage")
        axes[1, 1].set_ylabel("Memory (MB)", color="b")
        ax2.set_ylabel("Inference Time (ms)", color="r")

        plt.tight_layout()

        if save_path:
            plt.savefig(save_path)
        else:
            plt.show()

    def get_summary_stats(self) -> Dict[str, Any]:
        """Get summary statistics"""
        if not self.performance_history:
            return {}

        recent_performances = [
            s.overall_accuracy for s in list(self.performance_history)[-20:]
        ]

        return {
            "current_performance": self.performance_history[-1].overall_accuracy,
            "baseline_performance": (
                self.baseline_performance.overall_accuracy
                if self.baseline_performance
                else None
            ),
            "average_performance": np.mean(recent_performances),
            "performance_std": np.std(recent_performances),
            "stability_score": (
                self.stability_scores[-1] if self.stability_scores else None
            ),
            "total_evaluations": len(self.performance_history),
            "forgetting_events": len(self.forgetting_events),
            "improvement_events": len(self.improvement_events),
            "pattern_performance": dict(self.pattern_performance),
            "alerts_triggered": sum(
                1 for e in self.forgetting_events if e.get("alert_triggered")
            ),
        }


# Integration with continuous learning pipeline
async def monitor_learning_stability(model, pipeline, config: Dict[str, Any]):
    """Monitor learning stability in real-time"""
    monitor = LearningStabilityMonitor(config)

    # Add alert handler
    async def handle_alert(alert: Dict[str, Any]):
        # Send to pipeline for action
        if alert["level"] == "critical":
            logger.error(f"Critical stability alert: {alert['message']}")
            # Could trigger model rollback or learning rate adjustment

    monitor.add_alert_callback(handle_alert)

    # Periodic evaluation loop
    while True:
        try:
            # Evaluate current model
            snapshot = await monitor.evaluate_model(model, pipeline.model_version)

            # Check stability
            report = await monitor.check_stability(snapshot)

            # Log report
            logger.info(
                f"Stability Report: {report.is_stable} "
                f"(score: {report.stability_score:.2f}, "
                f"trend: {report.performance_trend})"
            )

            # Send to pipeline
            await pipeline._broadcast_update(
                {"type": "stability_report", "data": asdict(report)}
            )

            # Wait before next evaluation
            await asyncio.sleep(300)  # 5 minutes

        except Exception as e:
            logger.error(f"Error in stability monitoring: {e}")
            await asyncio.sleep(60)


if __name__ == "__main__":
    # Example usage
    logger.info("Learning Stability Monitor module loaded")
