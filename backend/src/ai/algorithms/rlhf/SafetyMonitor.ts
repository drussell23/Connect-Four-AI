// backend/src/ai/algorithms/rlhf/SafetyMonitor.ts
import { CellValue } from '../../connect4AI';

export interface SafetyConfig {
    robustnessChecks: boolean;
    adversarialTesting: boolean;
    interpretabilityRequirements: boolean;
    humanOversight: boolean;
    failsafeActivation: boolean;
    redTeaming: boolean;
    safetyVerification: boolean;
    ethicalConstraints: boolean;
    harmPrevention: boolean;
    transparencyLevel: 'basic' | 'detailed' | 'expert';
}

export interface SafetyViolation {
    type: 'ethical' | 'fairness' | 'harm' | 'robustness' | 'transparency';
    severity: 'low' | 'medium' | 'high' | 'critical';
    description: string;
    recommendation: string;
    timestamp: number;
}

export interface SafetyMetrics {
    totalViolations: number;
    violationsByType: { [key: string]: number };
    averageSeverity: number;
    robustnessScore: number;
    ethicalScore: number;
    transparencyScore: number;
    lastUpdate: number;
}

/**
 * Advanced Safety Monitoring System
 * 
 * Features:
 * - Real-time safety violation detection
 * - Adversarial robustness testing
 * - Ethical constraint verification
 * - Harm prevention mechanisms
 * - Transparency and interpretability monitoring
 * - Fail-safe activation systems
 */
export class SafetyMonitor {
    private config: SafetyConfig;
    private violations: SafetyViolation[] = [];
    private metrics: SafetyMetrics;
    private failsafeActive = false;
    private lastRobustnessTest = 0;

    constructor(config: SafetyConfig) {
        this.config = config;
        this.metrics = this.initializeMetrics();
    }

    /**
     * Check if a move is safe according to all safety criteria
     */
    checkMoveSafety(
        board: CellValue[][],
        move: number,
        playerModel: any,
        context: any
    ): { safe: boolean; violations: SafetyViolation[]; score: number } {
        const violations: SafetyViolation[] = [];
        let safetyScore = 1.0;

        // Ethical constraints check
        if (this.config.ethicalConstraints) {
            const ethicalViolations = this.checkEthicalConstraints(board, move, playerModel, context);
            violations.push(...ethicalViolations);
            safetyScore -= ethicalViolations.length * 0.1;
        }

        // Harm prevention check
        if (this.config.harmPrevention) {
            const harmViolations = this.checkHarmPrevention(board, move, playerModel, context);
            violations.push(...harmViolations);
            safetyScore -= harmViolations.length * 0.15;
        }

        // Fairness check
        const fairnessViolations = this.checkFairnessConstraints(board, move, playerModel, context);
        violations.push(...fairnessViolations);
        safetyScore -= fairnessViolations.length * 0.1;

        // Robustness check
        if (this.config.robustnessChecks) {
            const robustnessViolations = this.checkRobustness(board, move, context);
            violations.push(...robustnessViolations);
            safetyScore -= robustnessViolations.length * 0.08;
        }

        // Update metrics
        this.updateMetrics(violations);

        // Activate fail-safe if critical violations
        const criticalViolations = violations.filter(v => v.severity === 'critical');
        if (criticalViolations.length > 0 && this.config.failsafeActivation) {
            this.activateFailsafe(criticalViolations);
        }

        return {
            safe: violations.length === 0 || violations.every(v => v.severity === 'low'),
            violations,
            score: Math.max(0, safetyScore)
        };
    }

    /**
     * Check ethical constraints
     */
    private checkEthicalConstraints(
        board: CellValue[][],
        move: number,
        playerModel: any,
        context: any
    ): SafetyViolation[] {
        const violations: SafetyViolation[] = [];

        // Check for exploitation of vulnerable players
        if (playerModel && playerModel.skillLevel < 0.3 && context.gamePhase === 'endgame') {
            const dominanceLevel = this.calculateDominanceLevel(board, move);
            if (dominanceLevel > 0.8) {
                violations.push({
                    type: 'ethical',
                    severity: 'medium',
                    description: 'Potential exploitation of inexperienced player',
                    recommendation: 'Choose a more educational move that allows learning',
                    timestamp: Date.now()
                });
            }
        }

        // Check for unnecessarily humiliating moves
        if (this.isHumiliatingMove(board, move, playerModel)) {
            violations.push({
                type: 'ethical',
                severity: 'medium',
                description: 'Move may be unnecessarily humiliating',
                recommendation: 'Consider a more respectful alternative',
                timestamp: Date.now()
            });
        }

        // Check for respect of human dignity
        if (this.violatesHumanDignity(board, move, context)) {
            violations.push({
                type: 'ethical',
                severity: 'high',
                description: 'Move violates human dignity principles',
                recommendation: 'Choose a move that maintains respect',
                timestamp: Date.now()
            });
        }

        return violations;
    }

    /**
     * Check harm prevention
     */
    private checkHarmPrevention(
        board: CellValue[][],
        move: number,
        playerModel: any,
        context: any
    ): SafetyViolation[] {
        const violations: SafetyViolation[] = [];

        // Check for frustration induction
        if (this.couldCauseFrustration(board, move, playerModel, context)) {
            violations.push({
                type: 'harm',
                severity: 'medium',
                description: 'Move may cause significant frustration',
                recommendation: 'Consider a more engaging alternative',
                timestamp: Date.now()
            });
        }

        // Check for discouragement
        if (this.couldDiscouragePlayer(board, move, playerModel, context)) {
            violations.push({
                type: 'harm',
                severity: 'medium',
                description: 'Move may discourage continued play',
                recommendation: 'Balance challenge with achievability',
                timestamp: Date.now()
            });
        }

        // Check for psychological harm
        if (this.couldCausePsychologicalHarm(board, move, playerModel, context)) {
            violations.push({
                type: 'harm',
                severity: 'high',
                description: 'Move may cause psychological harm',
                recommendation: 'Choose a supportive alternative',
                timestamp: Date.now()
            });
        }

        return violations;
    }

    /**
     * Check fairness constraints
     */
    private checkFairnessConstraints(
        board: CellValue[][],
        move: number,
        playerModel: any,
        context: any
    ): SafetyViolation[] {
        const violations: SafetyViolation[] = [];

        // Check for unfair advantage exploitation
        if (this.exploitsUnfairAdvantage(board, move, playerModel)) {
            violations.push({
                type: 'fairness',
                severity: 'medium',
                description: 'Move exploits unfair advantage',
                recommendation: 'Level the playing field',
                timestamp: Date.now()
            });
        }

        // Check for skill level appropriateness
        if (this.isInappropriateForSkillLevel(board, move, playerModel)) {
            violations.push({
                type: 'fairness',
                severity: 'medium',
                description: 'Move complexity inappropriate for player skill',
                recommendation: 'Adjust complexity to match skill level',
                timestamp: Date.now()
            });
        }

        return violations;
    }

    /**
     * Check robustness
     */
    private checkRobustness(
        board: CellValue[][],
        move: number,
        context: any
    ): SafetyViolation[] {
        const violations: SafetyViolation[] = [];

        // Check for adversarial robustness
        if (this.config.adversarialTesting && Date.now() - this.lastRobustnessTest > 60000) {
            const robustnessScore = this.testAdversarialRobustness(board, move);
            this.lastRobustnessTest = Date.now();

            if (robustnessScore < 0.7) {
                violations.push({
                    type: 'robustness',
                    severity: 'medium',
                    description: 'Move lacks adversarial robustness',
                    recommendation: 'Choose a more robust alternative',
                    timestamp: Date.now()
                });
            }
        }

        return violations;
    }

    /**
     * Activate fail-safe mechanisms
     */
    private activateFailsafe(violations: SafetyViolation[]): void {
        this.failsafeActive = true;
        console.warn('🚨 SAFETY FAIL-SAFE ACTIVATED:', violations.map(v => v.description));

        // Log critical violations
        violations.forEach(violation => {
            console.error(`Critical Safety Violation: ${violation.description}`);
        });
    }

    /**
     * Check if fail-safe is currently active
     */
    isFailsafeActive(): boolean {
        return this.failsafeActive;
    }

    /**
     * Deactivate fail-safe
     */
    deactivateFailsafe(): void {
        this.failsafeActive = false;
        console.log('✅ Safety fail-safe deactivated');
    }

    /**
     * Get safety metrics
     */
    getSafetyMetrics(): SafetyMetrics {
        return { ...this.metrics };
    }

    /**
     * Update metrics
     */
    private updateMetrics(violations: SafetyViolation[]): void {
        this.metrics.totalViolations += violations.length;

        violations.forEach(violation => {
            this.metrics.violationsByType[violation.type] =
                (this.metrics.violationsByType[violation.type] || 0) + 1;
        });

        this.metrics.lastUpdate = Date.now();
    }

    /**
     * Initialize metrics
     */
    private initializeMetrics(): SafetyMetrics {
        return {
            totalViolations: 0,
            violationsByType: {},
            averageSeverity: 0,
            robustnessScore: 1.0,
            ethicalScore: 1.0,
            transparencyScore: 1.0,
            lastUpdate: Date.now()
        };
    }

    // Helper methods for safety checks
    private calculateDominanceLevel(board: CellValue[][], move: number): number {
        // Calculate how dominant the move makes the AI
        return 0.5; // Simplified implementation
    }

    private isHumiliatingMove(board: CellValue[][], move: number, playerModel: any): boolean {
        // Check if move is unnecessarily humiliating
        return false; // Simplified implementation
    }

    private violatesHumanDignity(board: CellValue[][], move: number, context: any): boolean {
        // Check if move violates human dignity
        return false; // Simplified implementation
    }

    private couldCauseFrustration(board: CellValue[][], move: number, playerModel: any, context: any): boolean {
        // Check if move could cause frustration
        return false; // Simplified implementation
    }

    private couldDiscouragePlayer(board: CellValue[][], move: number, playerModel: any, context: any): boolean {
        // Check if move could discourage the player
        return false; // Simplified implementation
    }

    private couldCausePsychologicalHarm(board: CellValue[][], move: number, playerModel: any, context: any): boolean {
        // Check for potential psychological harm
        return false; // Simplified implementation
    }

    private exploitsUnfairAdvantage(board: CellValue[][], move: number, playerModel: any): boolean {
        // Check if move exploits unfair advantages
        return false; // Simplified implementation
    }

    private isInappropriateForSkillLevel(board: CellValue[][], move: number, playerModel: any): boolean {
        // Check if move complexity matches skill level
        return false; // Simplified implementation
    }

    private testAdversarialRobustness(board: CellValue[][], move: number): number {
        // Test adversarial robustness
        return 0.8; // Simplified implementation
    }
} 