/**
 * Advanced Model Ensemble and Voting System for Connect Four
 * Implements state-of-the-art ensemble techniques with adaptive learning
 */

import { Injectable, Logger } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { CellValue } from '../connect4AI';

export interface EnsembleMember {
  id: string;
  name: string;
  type: 'neural' | 'tree' | 'linear' | 'hybrid';
  weight: number;
  reliability: number;
  specialization?: {
    openingStrength: number;
    middlegameStrength: number;
    endgameStrength: number;
    tacticalStrength: number;
    strategicStrength: number;
  };
}

export interface VotingResult {
  move: number;
  votes: Map<string, number>;
  confidence: number;
  consensus: number;
  dissenterRationale?: Map<string, string>;
}

export interface EnsembleConfig {
  votingMethod: 'plurality' | 'borda' | 'condorcet' | 'approval' | 'ranked' | 'quadratic';
  weightingScheme: 'uniform' | 'performance' | 'adaptive' | 'bayesian';
  diversityBonus: number;
  consensusThreshold: number;
  expertiseWeighting: boolean;
  dynamicReweighting: boolean;
}

export interface EnsemblePerformance {
  ensembleAccuracy: number;
  memberAccuracies: Map<string, number>;
  diversityScore: number;
  consensusRate: number;
  predictionSpeed: number;
}

@Injectable()
export class ModelEnsembleVoting {
  private readonly logger = new Logger(ModelEnsembleVoting.name);
  private ensembleMembers: Map<string, EnsembleMember> = new Map();
  private votingHistory: Array<{
    board: string;
    votes: Map<string, number>;
    outcome: 'correct' | 'incorrect';
    timestamp: Date;
  }> = [];
  private performanceMetrics: EnsemblePerformance = {
    ensembleAccuracy: 0,
    memberAccuracies: new Map(),
    diversityScore: 0,
    consensusRate: 0,
    predictionSpeed: 0
  };

  constructor(private readonly eventEmitter: EventEmitter2) {}

  /**
   * Register a model as ensemble member
   */
  registerMember(member: EnsembleMember): void {
    this.logger.log(`Registering ensemble member: ${member.name}`);
    
    // Initialize member with default values if not provided
    const fullMember: EnsembleMember = {
      ...member,
      weight: member.weight || 1.0,
      reliability: member.reliability || 0.5,
      specialization: member.specialization || {
        openingStrength: 0.5,
        middlegameStrength: 0.5,
        endgameStrength: 0.5,
        tacticalStrength: 0.5,
        strategicStrength: 0.5
      }
    };

    this.ensembleMembers.set(member.id, fullMember);
    this.performanceMetrics.memberAccuracies.set(member.id, 0.5);

    this.eventEmitter.emit('ensemble.member.registered', {
      memberId: member.id,
      memberName: member.name
    });
  }

  /**
   * Conduct ensemble voting
   */
  async vote(
    predictions: Map<string, { move: number; confidence: number; reasoning?: string }>,
    board: CellValue[][],
    config: EnsembleConfig
  ): Promise<VotingResult> {
    this.logger.debug(`Conducting ensemble vote with ${predictions.size} members`);

    const startTime = performance.now();

    // Adjust weights based on game phase and member expertise
    const adjustedWeights = this.adjustWeightsForGamePhase(board, config);

    // Apply voting method
    let result: VotingResult;

    switch (config.votingMethod) {
      case 'plurality':
        result = this.pluralityVoting(predictions, adjustedWeights);
        break;
      case 'borda':
        result = this.bordaCountVoting(predictions, adjustedWeights);
        break;
      case 'condorcet':
        result = this.condorcetVoting(predictions, adjustedWeights);
        break;
      case 'approval':
        result = this.approvalVoting(predictions, adjustedWeights, config);
        break;
      case 'ranked':
        result = this.rankedChoiceVoting(predictions, adjustedWeights);
        break;
      case 'quadratic':
        result = this.quadraticVoting(predictions, adjustedWeights);
        break;
      default:
        result = this.pluralityVoting(predictions, adjustedWeights);
    }

    // Apply diversity bonus if enabled
    if (config.diversityBonus > 0) {
      result = this.applyDiversityBonus(result, predictions, config.diversityBonus);
    }

    // Calculate consensus
    result.consensus = this.calculateConsensus(result.votes);

    // Record voting time
    const votingTime = performance.now() - startTime;
    this.updatePredictionSpeed(votingTime);

    // Emit voting result
    this.eventEmitter.emit('ensemble.vote.completed', {
      move: result.move,
      confidence: result.confidence,
      consensus: result.consensus,
      votingTime
    });

    return result;
  }

  /**
   * Plurality voting (first-past-the-post)
   */
  private pluralityVoting(
    predictions: Map<string, { move: number; confidence: number }>,
    weights: Map<string, number>
  ): VotingResult {
    const voteCounts = new Map<number, number>();
    const votes = new Map<string, number>();

    for (const [memberId, prediction] of predictions) {
      const weight = weights.get(memberId) || 1.0;
      const weightedVote = weight * prediction.confidence;
      
      voteCounts.set(
        prediction.move,
        (voteCounts.get(prediction.move) || 0) + weightedVote
      );
      
      votes.set(memberId, prediction.move);
    }

    // Find winner
    let bestMove = -1;
    let maxVotes = -1;
    
    for (const [move, voteCount] of voteCounts) {
      if (voteCount > maxVotes) {
        maxVotes = voteCount;
        bestMove = move;
      }
    }

    // Calculate confidence
    const totalVotes = Array.from(voteCounts.values()).reduce((a, b) => a + b, 0);
    const confidence = maxVotes / totalVotes;

    return {
      move: bestMove,
      votes,
      confidence,
      consensus: 0 // Will be calculated later
    };
  }

  /**
   * Borda count voting
   */
  private bordaCountVoting(
    predictions: Map<string, { move: number; confidence: number }>,
    weights: Map<string, number>
  ): VotingResult {
    // Convert predictions to rankings
    const rankings = new Map<string, number[]>();
    
    for (const [memberId, prediction] of predictions) {
      // Create ranking based on confidence scores for all moves
      const moveConfidences: Array<{ move: number; confidence: number }> = [];
      
      // Simulate confidence for other moves based on the predicted move
      for (let move = 0; move < 7; move++) {
        if (move === prediction.move) {
          moveConfidences.push({ move, confidence: prediction.confidence });
        } else {
          // Decay confidence for other moves
          const distance = Math.abs(move - prediction.move);
          const decayedConfidence = prediction.confidence * Math.exp(-distance * 0.5);
          moveConfidences.push({ move, confidence: decayedConfidence });
        }
      }
      
      // Sort by confidence and create ranking
      moveConfidences.sort((a, b) => b.confidence - a.confidence);
      const ranking = moveConfidences.map(mc => mc.move);
      rankings.set(memberId, ranking);
    }

    // Calculate Borda scores
    const bordaScores = new Map<number, number>();
    const votes = new Map<string, number>();
    
    for (const [memberId, ranking] of rankings) {
      const weight = weights.get(memberId) || 1.0;
      
      ranking.forEach((move, index) => {
        const points = (ranking.length - index - 1) * weight;
        bordaScores.set(move, (bordaScores.get(move) || 0) + points);
      });
      
      votes.set(memberId, ranking[0]); // First choice
    }

    // Find winner
    let bestMove = -1;
    let maxScore = -1;
    
    for (const [move, score] of bordaScores) {
      if (score > maxScore) {
        maxScore = score;
        bestMove = move;
      }
    }

    // Calculate confidence
    const totalScore = Array.from(bordaScores.values()).reduce((a, b) => a + b, 0);
    const confidence = maxScore / totalScore;

    return {
      move: bestMove,
      votes,
      confidence,
      consensus: 0
    };
  }

  /**
   * Condorcet voting (pairwise comparison)
   */
  private condorcetVoting(
    predictions: Map<string, { move: number; confidence: number }>,
    weights: Map<string, number>
  ): VotingResult {
    const pairwiseMatrix = Array(7).fill(null).map(() => Array(7).fill(0));
    const votes = new Map<string, number>();

    // Build pairwise preference matrix
    for (const [memberId, prediction] of predictions) {
      const weight = weights.get(memberId) || 1.0;
      
      // Member prefers their predicted move over all others
      for (let other = 0; other < 7; other++) {
        if (other !== prediction.move) {
          pairwiseMatrix[prediction.move][other] += weight * prediction.confidence;
        }
      }
      
      votes.set(memberId, prediction.move);
    }

    // Find Condorcet winner (defeats all others in pairwise comparison)
    let condorcetWinner = -1;
    
    for (let candidate = 0; candidate < 7; candidate++) {
      let winsAll = true;
      
      for (let opponent = 0; opponent < 7; opponent++) {
        if (candidate !== opponent && 
            pairwiseMatrix[candidate][opponent] <= pairwiseMatrix[opponent][candidate]) {
          winsAll = false;
          break;
        }
      }
      
      if (winsAll) {
        condorcetWinner = candidate;
        break;
      }
    }

    // If no Condorcet winner, use Copeland's method
    if (condorcetWinner === -1) {
      const copelandScores = new Array(7).fill(0);
      
      for (let i = 0; i < 7; i++) {
        for (let j = 0; j < 7; j++) {
          if (i !== j) {
            if (pairwiseMatrix[i][j] > pairwiseMatrix[j][i]) {
              copelandScores[i]++;
            } else if (pairwiseMatrix[i][j] === pairwiseMatrix[j][i]) {
              copelandScores[i] += 0.5;
            }
          }
        }
      }
      
      condorcetWinner = copelandScores.indexOf(Math.max(...copelandScores));
    }

    // Calculate confidence based on victory margins
    let totalMargin = 0;
    let winnerMargin = 0;
    
    for (let opponent = 0; opponent < 7; opponent++) {
      if (opponent !== condorcetWinner) {
        const margin = pairwiseMatrix[condorcetWinner][opponent] - 
                      pairwiseMatrix[opponent][condorcetWinner];
        winnerMargin += Math.max(0, margin);
        totalMargin += Math.abs(margin);
      }
    }
    
    const confidence = totalMargin > 0 ? winnerMargin / totalMargin : 0.5;

    return {
      move: condorcetWinner,
      votes,
      confidence,
      consensus: 0
    };
  }

  /**
   * Approval voting
   */
  private approvalVoting(
    predictions: Map<string, { move: number; confidence: number }>,
    weights: Map<string, number>,
    config: EnsembleConfig
  ): VotingResult {
    const approvalThreshold = config.consensusThreshold || 0.6;
    const approvalCounts = new Map<number, number>();
    const votes = new Map<string, number>();

    for (const [memberId, prediction] of predictions) {
      const weight = weights.get(memberId) || 1.0;
      
      // Approve moves above threshold
      for (let move = 0; move < 7; move++) {
        let moveConfidence: number;
        
        if (move === prediction.move) {
          moveConfidence = prediction.confidence;
        } else {
          // Estimate confidence for other moves
          const distance = Math.abs(move - prediction.move);
          moveConfidence = prediction.confidence * Math.exp(-distance * 0.3);
        }
        
        if (moveConfidence >= approvalThreshold) {
          approvalCounts.set(move, (approvalCounts.get(move) || 0) + weight);
        }
      }
      
      votes.set(memberId, prediction.move);
    }

    // Find most approved move
    let bestMove = -1;
    let maxApprovals = -1;
    
    for (const [move, approvals] of approvalCounts) {
      if (approvals > maxApprovals) {
        maxApprovals = approvals;
        bestMove = move;
      }
    }

    // Calculate confidence
    const totalPossibleApprovals = predictions.size * Math.max(...weights.values());
    const confidence = maxApprovals / totalPossibleApprovals;

    return {
      move: bestMove,
      votes,
      confidence,
      consensus: 0
    };
  }

  /**
   * Ranked choice (instant runoff) voting
   */
  private rankedChoiceVoting(
    predictions: Map<string, { move: number; confidence: number }>,
    weights: Map<string, number>
  ): VotingResult {
    // Create ballots with rankings
    const ballots: Array<{
      memberId: string;
      ranking: number[];
      weight: number;
    }> = [];

    for (const [memberId, prediction] of predictions) {
      const weight = weights.get(memberId) || 1.0;
      
      // Create ranking based on move distances
      const ranking: number[] = [];
      for (let dist = 0; dist < 7; dist++) {
        for (let move = 0; move < 7; move++) {
          if (Math.abs(move - prediction.move) === dist && !ranking.includes(move)) {
            ranking.push(move);
          }
        }
      }
      
      ballots.push({ memberId, ranking, weight });
    }

    // Run instant runoff
    const eliminated = new Set<number>();
    const votes = new Map<string, number>();
    
    while (eliminated.size < 6) {
      const roundVotes = new Map<number, number>();
      
      // Count first preferences
      for (const ballot of ballots) {
        for (const move of ballot.ranking) {
          if (!eliminated.has(move)) {
            roundVotes.set(move, (roundVotes.get(move) || 0) + ballot.weight);
            break;
          }
        }
      }
      
      // Check for majority
      const totalVotes = Array.from(roundVotes.values()).reduce((a, b) => a + b, 0);
      for (const [move, voteCount] of roundVotes) {
        if (voteCount > totalVotes / 2) {
          // Winner found
          for (const ballot of ballots) {
            votes.set(ballot.memberId, ballot.ranking[0]);
          }
          
          return {
            move,
            votes,
            confidence: voteCount / totalVotes,
            consensus: 0
          };
        }
      }
      
      // Eliminate candidate with fewest votes
      let minVotes = Infinity;
      let toEliminate = -1;
      
      for (const [move, voteCount] of roundVotes) {
        if (voteCount < minVotes) {
          minVotes = voteCount;
          toEliminate = move;
        }
      }
      
      eliminated.add(toEliminate);
    }

    // Should not reach here, but return last remaining
    const remaining = Array.from({ length: 7 }, (_, i) => i)
      .find(move => !eliminated.has(move)) || 0;

    for (const ballot of ballots) {
      votes.set(ballot.memberId, ballot.ranking[0]);
    }

    return {
      move: remaining,
      votes,
      confidence: 0.5,
      consensus: 0
    };
  }

  /**
   * Quadratic voting
   */
  private quadraticVoting(
    predictions: Map<string, { move: number; confidence: number }>,
    weights: Map<string, number>
  ): VotingResult {
    const voteCredits = 100; // Each member gets 100 credits
    const quadraticVotes = new Map<number, number>();
    const votes = new Map<string, number>();

    for (const [memberId, prediction] of predictions) {
      const weight = weights.get(memberId) || 1.0;
      
      // Allocate credits based on confidence
      const creditsForBest = Math.floor(prediction.confidence * voteCredits);
      const votesForBest = Math.sqrt(creditsForBest);
      
      quadraticVotes.set(
        prediction.move,
        (quadraticVotes.get(prediction.move) || 0) + votesForBest * weight
      );
      
      // Allocate remaining credits to second choices
      const remainingCredits = voteCredits - creditsForBest;
      if (remainingCredits > 0) {
        // Distribute to adjacent moves
        const adjacentMoves = [prediction.move - 1, prediction.move + 1]
          .filter(m => m >= 0 && m < 7);
        
        for (const move of adjacentMoves) {
          const creditsForAdjacent = remainingCredits / adjacentMoves.length;
          const votesForAdjacent = Math.sqrt(creditsForAdjacent);
          
          quadraticVotes.set(
            move,
            (quadraticVotes.get(move) || 0) + votesForAdjacent * weight
          );
        }
      }
      
      votes.set(memberId, prediction.move);
    }

    // Find winner
    let bestMove = -1;
    let maxVotes = -1;
    
    for (const [move, voteCount] of quadraticVotes) {
      if (voteCount > maxVotes) {
        maxVotes = voteCount;
        bestMove = move;
      }
    }

    // Calculate confidence
    const totalVotes = Array.from(quadraticVotes.values()).reduce((a, b) => a + b, 0);
    const confidence = maxVotes / totalVotes;

    return {
      move: bestMove,
      votes,
      confidence,
      consensus: 0
    };
  }

  /**
   * Adjust weights based on game phase
   */
  private adjustWeightsForGamePhase(
    board: CellValue[][],
    config: EnsembleConfig
  ): Map<string, number> {
    if (!config.expertiseWeighting) {
      // Return uniform weights
      const weights = new Map<string, number>();
      for (const memberId of this.ensembleMembers.keys()) {
        weights.set(memberId, 1.0);
      }
      return weights;
    }

    const gamePhase = this.detectGamePhase(board);
    const adjustedWeights = new Map<string, number>();

    for (const [memberId, member] of this.ensembleMembers) {
      let phaseWeight = 1.0;

      if (member.specialization) {
        switch (gamePhase) {
          case 'opening':
            phaseWeight = member.specialization.openingStrength;
            break;
          case 'middlegame':
            phaseWeight = member.specialization.middlegameStrength;
            break;
          case 'endgame':
            phaseWeight = member.specialization.endgameStrength;
            break;
        }
      }

      // Combine with reliability and base weight
      const finalWeight = member.weight * member.reliability * phaseWeight;
      adjustedWeights.set(memberId, finalWeight);
    }

    return adjustedWeights;
  }

  /**
   * Apply diversity bonus to ensemble
   */
  private applyDiversityBonus(
    result: VotingResult,
    predictions: Map<string, { move: number; confidence: number }>,
    diversityBonus: number
  ): VotingResult {
    // Calculate move diversity
    const moveCounts = new Map<number, number>();
    for (const pred of predictions.values()) {
      moveCounts.set(pred.move, (moveCounts.get(pred.move) || 0) + 1);
    }

    // Identify unique moves (minority opinions)
    const uniqueMoves = Array.from(moveCounts.entries())
      .filter(([_, count]) => count === 1)
      .map(([move, _]) => move);

    // Apply bonus to unique moves
    if (uniqueMoves.length > 0 && uniqueMoves.includes(result.move)) {
      result.confidence *= (1 + diversityBonus);
      result.confidence = Math.min(result.confidence, 1.0);
    }

    return result;
  }

  /**
   * Update member weights based on performance
   */
  async updateWeights(
    votingResult: VotingResult,
    actualBestMove: number,
    config: EnsembleConfig
  ): Promise<void> {
    if (!config.dynamicReweighting) {
      return;
    }

    const learningRate = 0.1;

    for (const [memberId, predictedMove] of votingResult.votes) {
      const member = this.ensembleMembers.get(memberId);
      if (!member) continue;

      // Update reliability based on correctness
      const wasCorrect = predictedMove === actualBestMove;
      const currentAccuracy = this.performanceMetrics.memberAccuracies.get(memberId) || 0.5;
      
      // Exponential moving average
      const newAccuracy = currentAccuracy * 0.9 + (wasCorrect ? 1.0 : 0.0) * 0.1;
      this.performanceMetrics.memberAccuracies.set(memberId, newAccuracy);

      // Update member reliability
      member.reliability = member.reliability * (1 - learningRate) + 
                          newAccuracy * learningRate;

      // Bayesian weight update
      if (config.weightingScheme === 'bayesian') {
        const prior = member.weight;
        const likelihood = wasCorrect ? 0.8 : 0.2;
        const evidence = 0.5; // Neutral prior
        
        member.weight = (prior * likelihood) / evidence;
        member.weight = Math.max(0.1, Math.min(2.0, member.weight)); // Clamp weights
      }
    }

    // Record voting outcome
    this.votingHistory.push({
      board: this.boardToString(this.createDummyBoard()), // Simplified
      votes: votingResult.votes,
      outcome: votingResult.move === actualBestMove ? 'correct' : 'incorrect',
      timestamp: new Date()
    });

    // Update ensemble accuracy
    const correctVotes = this.votingHistory.filter(h => h.outcome === 'correct').length;
    this.performanceMetrics.ensembleAccuracy = correctVotes / this.votingHistory.length;

    // Emit weight update event
    this.eventEmitter.emit('ensemble.weights.updated', {
      memberWeights: Array.from(this.ensembleMembers.entries()).map(([id, member]) => ({
        memberId: id,
        weight: member.weight,
        reliability: member.reliability
      }))
    });
  }

  /**
   * Calculate ensemble diversity
   */
  calculateDiversity(): number {
    if (this.votingHistory.length < 10) {
      return 0.5; // Not enough data
    }

    // Use last 10 votes
    const recentVotes = this.votingHistory.slice(-10);
    let totalDisagreement = 0;

    for (const vote of recentVotes) {
      const moves = Array.from(vote.votes.values());
      const uniqueMoves = new Set(moves).size;
      const disagreement = (uniqueMoves - 1) / 6; // Normalized by max possible
      totalDisagreement += disagreement;
    }

    return totalDisagreement / recentVotes.length;
  }

  /**
   * Helper methods
   */

  private detectGamePhase(board: CellValue[][]): 'opening' | 'middlegame' | 'endgame' {
    let pieces = 0;
    for (let r = 0; r < board.length; r++) {
      for (let c = 0; c < board[0].length; c++) {
        if (board[r][c] !== 'Empty') pieces++;
      }
    }

    if (pieces < 8) return 'opening';
    if (pieces < 24) return 'middlegame';
    return 'endgame';
  }

  private calculateConsensus(votes: Map<string, number>): number {
    const moves = Array.from(votes.values());
    const uniqueMoves = new Set(moves);
    
    if (uniqueMoves.size === 1) return 1.0; // Perfect consensus
    
    // Calculate how many members voted for the winning move
    const winningMove = moves[0]; // Assuming first is winner
    const agreeingMembers = moves.filter(m => m === winningMove).length;
    
    return agreeingMembers / moves.length;
  }

  private updatePredictionSpeed(time: number): void {
    const alpha = 0.1; // EMA factor
    this.performanceMetrics.predictionSpeed = 
      this.performanceMetrics.predictionSpeed * (1 - alpha) + time * alpha;
  }

  private boardToString(board: CellValue[][]): string {
    return board.flat().map(cell => 
      cell === 'Red' ? 'R' : cell === 'Yellow' ? 'Y' : '_'
    ).join('');
  }

  private createDummyBoard(): CellValue[][] {
    return Array(6).fill(null).map(() => Array(7).fill('Empty'));
  }

  /**
   * Get ensemble statistics
   */
  getEnsembleStats(): EnsemblePerformance & {
    memberDetails: Array<{
      id: string;
      name: string;
      weight: number;
      reliability: number;
      accuracy: number;
    }>;
    votingHistory: number;
  } {
    const memberDetails = Array.from(this.ensembleMembers.entries()).map(([id, member]) => ({
      id,
      name: member.name,
      weight: member.weight,
      reliability: member.reliability,
      accuracy: this.performanceMetrics.memberAccuracies.get(id) || 0
    }));

    return {
      ...this.performanceMetrics,
      diversityScore: this.calculateDiversity(),
      memberDetails,
      votingHistory: this.votingHistory.length
    };
  }

  /**
   * Reset ensemble
   */
  reset(): void {
    this.votingHistory = [];
    this.performanceMetrics = {
      ensembleAccuracy: 0,
      memberAccuracies: new Map(),
      diversityScore: 0,
      consensusRate: 0,
      predictionSpeed: 0
    };

    // Reset member weights and reliability
    for (const member of this.ensembleMembers.values()) {
      member.weight = 1.0;
      member.reliability = 0.5;
    }

    this.logger.log('Ensemble reset completed');
  }
}