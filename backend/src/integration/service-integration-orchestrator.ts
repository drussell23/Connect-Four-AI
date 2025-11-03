import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { HttpService } from '@nestjs/axios';
import { WebSocket } from 'ws';
import { firstValueFrom } from 'rxjs';
import { ConfigService } from '@nestjs/config';
import { Interval } from '@nestjs/schedule';

/**
 * 🎯 SERVICE INTEGRATION ORCHESTRATOR
 * ==================================
 * 
 * Master orchestrator that ensures all services work together seamlessly
 * while maintaining their independence. Handles:
 * 
 * - Real-time data flow between services
 * - Background AI vs AI simulations
 * - Continuous learning pipeline
 * - Cross-service event propagation
 * - Model synchronization
 * - Performance monitoring
 */
@Injectable()
export class ServiceIntegrationOrchestrator implements OnModuleInit {
  private readonly logger = new Logger(ServiceIntegrationOrchestrator.name);
  
  // WebSocket connections to all services
  // ML Service uses HTTP API instead of WebSocket
  private aiCoordinationWebSocket: WebSocket | null = null;
  private continuousLearningWebSocket: WebSocket | null = null;
  
  // Service health status
  private serviceStatus = new Map<string, boolean>();
  
  // Background simulation control
  private simulationActive = false;
  private simulationWorkers: any[] = [];
  
  // Integration metrics
  private metrics = {
    gamesProcessed: 0,
    simulationsRun: 0,
    modelUpdates: 0,
    dataFlowEvents: 0,
    patternsSynced: 0,
    lastHealthCheck: new Date(),
  };

  constructor(
    private readonly eventEmitter: EventEmitter2,
    private readonly httpService: HttpService,
    private readonly configService: ConfigService,
  ) {}

  async onModuleInit() {
    this.logger.log('🚀 Initializing Service Integration Orchestrator...');

    // Check if services should be disabled
    const disableExternalServices = this.configService.get('DISABLE_EXTERNAL_SERVICES', 'false') === 'true';
    
    if (disableExternalServices) {
      this.logger.log('📦 External services disabled by configuration');
      // Mark internal services as available
      this.serviceStatus.set('backend', true);
      this.serviceStatus.set('frontend', false); // Frontend is separate
      this.serviceStatus.set('integration_websocket', true); // Part of backend
      this.serviceStatus.set('game_websocket', true); // Part of backend
      
      // Mark external services as unavailable
      this.serviceStatus.set('ml_service', false);
      this.serviceStatus.set('ml_inference', false);
      this.serviceStatus.set('continuous_learning', false);
      this.serviceStatus.set('ai_coordination', false);
      this.serviceStatus.set('python_trainer', false);
      this.broadcastServiceStatus();
      return;
    }
    
    // Connect to all services
    await this.connectToAllServices();
    
    // Setup cross-service event handlers
    this.setupEventHandlers();
    
    // Start health monitoring
    this.startHealthMonitoring();
    
    // Initialize background simulations
    await this.initializeBackgroundSimulations();
    
    // Set internal services that are always running with the backend
    this.serviceStatus.set('backend', true); // Backend is running if this code is executing
    this.serviceStatus.set('integration_websocket', true); // Part of backend
    this.serviceStatus.set('game_websocket', true); // Game gateway is part of backend
    
    // Do initial health check and broadcast status
    await this.checkAllServicesHealth();
    
    // Broadcast initial status after a short delay to ensure all listeners are ready
    setTimeout(() => {
      this.broadcastServiceStatus();
    }, 2000);
    
    // Broadcast again after 5 seconds to ensure frontend gets the status
    setTimeout(() => {
      this.logger.log('📡 Broadcasting service status to all connected clients...');
      this.broadcastServiceStatus();
    }, 5000);
    
    this.logger.log('✅ Service Integration Orchestrator initialized successfully');
  }

  /**
   * Connect to all microservices via WebSocket for real-time communication
   */
  private async connectToAllServices(): Promise<void> {
    // Check individual service toggles
    const enableMLService = this.configService.get('ENABLE_ML_SERVICE', 'true') === 'true';
    const enableContinuousLearning = this.configService.get('ENABLE_CONTINUOUS_LEARNING', 'true') === 'true';
    const enableAICoordination = this.configService.get('ENABLE_AI_COORDINATION', 'true') === 'true';
    
    // ML Service doesn't provide WebSocket, only HTTP API
    // Mark it as connected if health check passes
    if (enableMLService) {
      this.checkMLServiceHealth();
    } else {
      this.serviceStatus.set('ml_service', false);
      this.logger.log('⏭️ ML Service disabled by configuration');
    }
    
    // Connect to Continuous Learning WebSocket
    if (enableContinuousLearning) {
      await this.connectToContinuousLearning();
    } else {
      this.serviceStatus.set('continuous_learning', false);
      this.logger.log('⏭️ Continuous Learning service disabled by configuration');
    }
    
    // Connect to AI Coordination Hub
    if (enableAICoordination) {
      await this.connectToAICoordination();
    } else {
      this.serviceStatus.set('ai_coordination', false);
      this.logger.log('⏭️ AI Coordination service disabled by configuration');
    }
    
    this.logger.log('📡 Service connection initialization complete');
  }

  /**
   * Check ML Service health via HTTP
   */
  private async checkMLServiceHealth(): Promise<void> {
    const mlServiceUrl = this.configService.get('ML_SERVICE_URL', 'http://localhost:8000');
    
    try {
      const response = await fetch(`${mlServiceUrl}/health`);
      if (response.ok) {
        this.serviceStatus.set('ml_service', true);
        this.logger.log('✅ ML Service is healthy');
        this.broadcastServiceStatus();
      } else {
        this.serviceStatus.set('ml_service', false);
        this.logger.warn('ML Service health check failed');
        this.broadcastServiceStatus();
      }
    } catch (error) {
      this.serviceStatus.set('ml_service', false);
      this.logger.error('Failed to check ML Service health:', error);
    }
    
    // Schedule next health check only if service is enabled
    if (this.configService.get('ENABLE_ML_SERVICE', 'true') === 'true') {
      setTimeout(() => this.checkMLServiceHealth(), 30000);
    }
  }

  /**
   * Connect to Continuous Learning for real-time model updates
   */
  private async connectToContinuousLearning(): Promise<void> {
    const clWsUrl = this.configService.get('CONTINUOUS_LEARNING_WS_URL', 'ws://localhost:8005');
    
    try {
      this.continuousLearningWebSocket = new WebSocket(clWsUrl);
      
      this.continuousLearningWebSocket.on('open', () => {
        this.serviceStatus.set('continuous_learning', true);
        this.logger.log('✅ Connected to Continuous Learning WebSocket');
        this.broadcastServiceStatus();
        
        // Subscribe to model updates
        this.sendToContinuousLearning({
          type: 'subscribe',
          topics: ['model_updates', 'pattern_insights', 'learning_progress'],
        });
      });
      
      this.continuousLearningWebSocket.on('message', (data) => {
        this.handleContinuousLearningMessage(JSON.parse(data.toString()));
      });
      
      this.continuousLearningWebSocket.on('error', (error) => {
        this.logger.error('Continuous Learning WebSocket error:', error);
        this.serviceStatus.set('continuous_learning', false);
      });
      
      this.continuousLearningWebSocket.on('close', () => {
        this.serviceStatus.set('continuous_learning', false);
        setTimeout(() => this.connectToContinuousLearning(), 5000);
      });
    } catch (error) {
      this.logger.error('Failed to connect to Continuous Learning:', error);
      setTimeout(() => this.connectToContinuousLearning(), 5000);
    }
  }

  /**
   * Connect to AI Coordination Hub for strategic decisions
   */
  private async connectToAICoordination(): Promise<void> {
    const aiCoordUrl = this.configService.get('AI_COORDINATION_WS_URL', 'ws://localhost:8003/ws/backend_orchestrator');
    
    try {
      this.aiCoordinationWebSocket = new WebSocket(aiCoordUrl);
      
      this.aiCoordinationWebSocket.on('open', () => {
        this.serviceStatus.set('ai_coordination', true);
        this.logger.log('✅ Connected to AI Coordination Hub');
        this.broadcastServiceStatus();
        
        // Register capabilities
        this.sendToAICoordination({
          type: 'register',
          service: 'backend_orchestrator',
          capabilities: {
            simulation: true,
            realtime_analysis: true,
            pattern_detection: true,
          },
        });
      });
      
      this.aiCoordinationWebSocket.on('message', (data) => {
        this.handleAICoordinationMessage(JSON.parse(data.toString()));
      });
      
      this.aiCoordinationWebSocket.on('error', (error) => {
        this.logger.error('AI Coordination WebSocket error:', error);
        this.serviceStatus.set('ai_coordination', false);
      });
      
      this.aiCoordinationWebSocket.on('close', () => {
        this.serviceStatus.set('ai_coordination', false);
        setTimeout(() => this.connectToAICoordination(), 5000);
      });
    } catch (error) {
      this.logger.error('Failed to connect to AI Coordination:', error);
      setTimeout(() => this.connectToAICoordination(), 5000);
    }
  }

  /**
   * Setup event handlers for cross-service communication
   */
  private setupEventHandlers(): void {
    // Game events
    this.eventEmitter.on('game.started', (data) => this.handleGameStarted(data));
    this.eventEmitter.on('game.move.made', (data) => this.handleMoveMade(data));
    this.eventEmitter.on('game.ended', (data) => this.handleGameEnded(data));
    
    // AI events
    this.eventEmitter.on('ai.move.requested', (data) => this.handleAIMoveRequest(data));
    this.eventEmitter.on('ai.pattern.detected', (data) => this.handlePatternDetected(data));
    
    // Learning events
    this.eventEmitter.on('learning.model.updated', (data) => this.handleModelUpdated(data));
    this.eventEmitter.on('learning.insight.generated', (data) => this.handleInsightGenerated(data));
    
    // Simulation events
    this.eventEmitter.on('simulation.completed', (data) => this.handleSimulationCompleted(data));
    
    // Service status request - check health first then broadcast
    this.eventEmitter.on('service.status.request', async () => {
      this.logger.log('📊 Service status requested - checking health...');
      await this.checkAllServicesHealth();
    });
  }

  /**
   * Initialize background AI vs AI simulations
   */
  private async initializeBackgroundSimulations(): Promise<void> {
    this.logger.log('🎮 Initializing background AI vs AI simulations...');
    
    // Start simulation workers based on available resources
    const workerCount = this.configService.get('SIMULATION_WORKERS', 2);
    
    for (let i = 0; i < workerCount; i++) {
      this.startSimulationWorker(i);
    }
    
    this.simulationActive = true;
    this.logger.log(`✅ Started ${workerCount} simulation workers`);
  }

  /**
   * Start a simulation worker for background AI vs AI games
   */
  private startSimulationWorker(workerId: number): void {
    const worker = {
      id: workerId,
      active: true,
      gamesPlayed: 0,
      lastGame: null,
    };
    
    this.simulationWorkers.push(worker);
    
    // Run simulations in background
    this.runSimulationLoop(worker);
  }

  /**
   * Run continuous simulation loop
   */
  private async runSimulationLoop(worker: any): Promise<void> {
    while (worker.active && this.simulationActive) {
      try {
        // Generate varied difficulty levels for diverse training data
        const difficulty1 = Math.random() * 0.5 + 0.5; // 0.5-1.0
        const difficulty2 = Math.random() * 0.5 + 0.5; // 0.5-1.0
        
        // Run simulation
        const simulationResult = await this.runSingleSimulation(
          worker.id,
          difficulty1,
          difficulty2
        );
        
        if (simulationResult) {
          worker.gamesPlayed++;
          worker.lastGame = new Date();
          this.metrics.simulationsRun++;
          
          // Process simulation data
          await this.processSimulationData(simulationResult);
          
          // Emit simulation completed event
          this.eventEmitter.emit('simulation.completed', {
            workerId: worker.id,
            result: simulationResult,
            totalGames: worker.gamesPlayed,
          });
        }
        
        // Brief pause between simulations
        await this.sleep(1000);
        
      } catch (error) {
        this.logger.error(`Simulation worker ${worker.id} error:`, error);
        await this.sleep(5000); // Longer pause on error
      }
    }
  }

  /**
   * Run a single AI vs AI simulation
   */
  private async runSingleSimulation(
    _workerId: number,
    difficulty1: number,
    difficulty2: number
  ): Promise<any> {
    try {
      // Call AI Coordination service to run simulation
      const response = await firstValueFrom(
        this.httpService.post('http://localhost:8003/simulate', {
          player1: {
            type: 'ai',
            difficulty: difficulty1,
            strategy: this.selectStrategy(),
          },
          player2: {
            type: 'ai',
            difficulty: difficulty2,
            strategy: this.selectStrategy(),
          },
          fastMode: true,
          collectPatterns: true,
        })
      );
      
      return response.data;
    } catch (error) {
      this.logger.error('Simulation failed:', error);
      return null;
    }
  }

  /**
   * Select AI strategy for simulation variety
   */
  private selectStrategy(): string {
    const strategies = [
      'minimax',
      'mcts',
      'alphazero',
      'reinforcement',
      'hybrid',
      'ensemble',
    ];
    return strategies[Math.floor(Math.random() * strategies.length)];
  }

  /**
   * Process simulation data for learning
   */
  private async processSimulationData(simulationData: any): Promise<void> {
    // Send to continuous learning
    this.sendToContinuousLearning({
      type: 'simulation_data',
      data: {
        gameId: simulationData.gameId,
        moves: simulationData.moves,
        winner: simulationData.winner,
        patterns: simulationData.patterns,
        insights: simulationData.insights,
        metadata: {
          source: 'background_simulation',
          timestamp: new Date(),
        },
      },
    });
    
    // ML service processing is handled via HTTP API
    // Background simulations are processed through the MLClientService
  }

  /**
   * Handle game started event
   */
  private async handleGameStarted(data: any): Promise<void> {
    this.metrics.dataFlowEvents++;
    
    // Notify all services about new game
    this.broadcastToAllServices({
      type: 'game_started',
      gameId: data.gameId,
      players: data.players,
      difficulty: data.difficulty,
      timestamp: new Date(),
    });
  }

  /**
   * Handle move made event
   */
  private async handleMoveMade(data: any): Promise<void> {
    this.metrics.dataFlowEvents++;
    
    // ML service analysis is handled via HTTP API
    // Move analysis is processed through the MLClientService
    
    // Send to continuous learning for pattern detection
    this.sendToContinuousLearning({
      type: 'move_made',
      data: data,
    });
  }

  /**
   * Handle game ended event
   */
  private async handleGameEnded(data: any): Promise<void> {
    this.metrics.gamesProcessed++;
    this.metrics.dataFlowEvents++;
    
    // Send complete game data to all services
    const gameData = {
      type: 'game_ended',
      gameId: data.gameId,
      winner: data.winner,
      moves: data.moves,
      board: data.finalBoard,
      patterns: data.patterns,
      duration: data.duration,
      metadata: {
        difficulty: data.difficulty,
        playerTypes: data.playerTypes,
        timestamp: new Date(),
      },
    };
    
    // High priority for human games
    if (data.playerTypes.includes('human')) {
      gameData['priority'] = 'high';
    }
    
    this.broadcastToAllServices(gameData);
  }

  /**
   * Handle AI move request
   */
  private async handleAIMoveRequest(data: any): Promise<void> {
    // Coordinate between services for best move
    const moveAnalysis = await this.coordinateAIMove(data);
    
    // Emit move decision
    this.eventEmitter.emit('ai.move.decided', {
      gameId: data.gameId,
      move: moveAnalysis.move,
      confidence: moveAnalysis.confidence,
      strategy: moveAnalysis.strategy,
    });
  }

  /**
   * Coordinate AI move across services
   */
  private async coordinateAIMove(data: any): Promise<any> {
    const requests = [];
    
    // Get move from ML service
    if (this.serviceStatus.get('ml_service')) {
      requests.push(
        firstValueFrom(
          this.httpService.post('http://localhost:8000/predict', {
            board: data.board,
            model_type: 'ensemble',
          })
        ).catch(() => ({ data: null }))
      );
    }
    
    // Get strategic recommendation from AI Coordination
    if (this.serviceStatus.get('ai_coordination')) {
      requests.push(
        firstValueFrom(
          this.httpService.post('http://localhost:8003/analyze', {
            board: data.board,
            gameState: data.gameState,
          })
        ).catch(() => ({ data: null }))
      );
    }
    
    const results = await Promise.all(requests);
    
    // Combine recommendations
    return this.combineAIRecommendations(results);
  }

  /**
   * Combine AI recommendations from multiple services
   */
  private combineAIRecommendations(results: any[]): any {
    // Implement sophisticated voting/ensemble logic
    const validResults = results.filter(r => r.data !== null);
    
    if (validResults.length === 0) {
      // Fallback to simple logic
      return {
        move: { column: Math.floor(Math.random() * 7) },
        confidence: 0.5,
        strategy: 'random_fallback',
      };
    }
    
    // Use ensemble voting or weighted average
    // This is a simplified version - you can make it more sophisticated
    const moveVotes = new Map<number, number>();
    let totalConfidence = 0;
    
    validResults.forEach(result => {
      if (result.data.move) {
        const column = result.data.move.column;
        const confidence = result.data.confidence || 0.5;
        moveVotes.set(column, (moveVotes.get(column) || 0) + confidence);
        totalConfidence += confidence;
      }
    });
    
    // Select move with highest weighted votes
    let bestMove = 3; // Center as default
    let bestScore = 0;
    
    moveVotes.forEach((score, column) => {
      if (score > bestScore) {
        bestScore = score;
        bestMove = column;
      }
    });
    
    return {
      move: { column: bestMove },
      confidence: bestScore / totalConfidence,
      strategy: 'ensemble_voting',
    };
  }

  /**
   * Handle pattern detected event
   */
  private async handlePatternDetected(data: any): Promise<void> {
    this.metrics.patternsSynced++;
    
    // Share pattern with all services for learning
    this.broadcastToAllServices({
      type: 'pattern_detected',
      pattern: data.pattern,
      context: data.context,
      importance: data.importance,
    });
  }

  /**
   * Handle model updated event
   */
  private async handleModelUpdated(data: any): Promise<void> {
    this.metrics.modelUpdates++;
    
    // Notify all services about model update
    this.broadcastToAllServices({
      type: 'model_updated',
      modelType: data.modelType,
      version: data.version,
      improvements: data.improvements,
      timestamp: new Date(),
    });
    
    // Trigger model synchronization
    this.eventEmitter.emit('model.sync.required', data);
  }

  /**
   * Handle insight generated event
   */
  private async handleInsightGenerated(data: any): Promise<void> {
    // Share strategic insights across services
    this.broadcastToAllServices({
      type: 'insight_generated',
      insight: data.insight,
      applicability: data.applicability,
      confidence: data.confidence,
    });
  }

  /**
   * Handle simulation completed event
   */
  private async handleSimulationCompleted(data: any): Promise<void> {
    this.logger.debug(`Simulation ${data.workerId} completed game ${data.totalGames}`);
    
    // Optionally adjust simulation parameters based on results
    if (data.result && data.result.insights) {
      this.adjustSimulationStrategy(data.result.insights);
    }
  }

  /**
   * Adjust simulation strategy based on insights
   */
  private adjustSimulationStrategy(_insights: any): void {
    // Implement adaptive simulation strategy
    // For example, focus on positions where AI performs poorly
  }

  /**
   * Start health monitoring for all services
   */
  private startHealthMonitoring(): void {
    setInterval(async () => {
      await this.checkAllServicesHealth();
    }, 30000); // Check every 30 seconds
  }

  /**
   * Check health of all services
   */
  private async checkAllServicesHealth(): Promise<void> {
    // Resolve dynamic ports/URLs from configuration
    const backendPort = this.configService.get('port') || 3000;
    const backendUrl = this.configService.get('backendUrl') || `http://localhost:${backendPort}`;

    const services = [
      { name: 'backend', url: `${backendUrl}/api/health` },
      { name: 'frontend', url: this.configService.get('frontendUrl') || 'http://localhost:3001' },
      { name: 'ml_service', url: this.configService.get('mlServiceUrl') ? `${this.configService.get('mlServiceUrl')}/health` : 'http://localhost:8000/health' },
      { name: 'ml_inference', url: 'http://localhost:8001/health' },
      { name: 'continuous_learning', url: 'http://localhost:8002/health' },
      { name: 'ai_coordination', url: 'http://localhost:8003/health' },
      { name: 'python_trainer', url: 'http://localhost:8004/health' },
    ];
    
    this.logger.log('🔍 Checking health of all services...');
    
    for (const service of services) {
      try {
        const response = await firstValueFrom(
          this.httpService.get(service.url, { timeout: 5000 })
        );
        const isHealthy = response.status === 200;
        this.serviceStatus.set(service.name, isHealthy);
        this.logger.log(`✅ ${service.name}: ${isHealthy ? 'HEALTHY' : 'UNHEALTHY'} (${service.url})`);
      } catch (error: any) {
        this.serviceStatus.set(service.name, false);
        this.logger.warn(`❌ ${service.name}: FAILED (${service.url}) - ${error.message}`);
      }
    }
    
    this.metrics.lastHealthCheck = new Date();
    
    // Broadcast updated status
    this.broadcastServiceStatus();
  }

  // ML Service communication is handled via HTTP API through MLClientService

  /**
   * Send message to Continuous Learning
   */
  private sendToContinuousLearning(message: any): void {
    if (this.continuousLearningWebSocket?.readyState === WebSocket.OPEN) {
      this.continuousLearningWebSocket.send(JSON.stringify(message));
    }
  }

  /**
   * Send message to AI Coordination
   */
  private sendToAICoordination(message: any): void {
    if (this.aiCoordinationWebSocket?.readyState === WebSocket.OPEN) {
      this.aiCoordinationWebSocket.send(JSON.stringify(message));
    }
  }

  /**
   * Broadcast message to all connected services
   */
  private broadcastToAllServices(message: any): void {
    // ML Service receives updates via HTTP API
    this.sendToContinuousLearning(message);
    this.sendToAICoordination(message);
  }

  // ML Service events are handled via HTTP API responses

  /**
   * Handle Continuous Learning messages
   */
  private handleContinuousLearningMessage(message: any): void {
    switch (message.type) {
      case 'learning_progress':
        this.eventEmitter.emit('cl.learning.progress', message.data);
        break;
      case 'pattern_insight':
        this.eventEmitter.emit('cl.pattern.insight', message.data);
        break;
      case 'model_updated':
        this.eventEmitter.emit('cl.model.updated', message.data);
        break;
    }
  }

  /**
   * Handle AI Coordination messages
   */
  private handleAICoordinationMessage(message: any): void {
    switch (message.type) {
      case 'strategy_recommendation':
        this.eventEmitter.emit('ai.strategy.recommendation', message.data);
        break;
      case 'simulation_request':
        // Handle request for specific simulation
        this.runTargetedSimulation(message.data);
        break;
    }
  }

  /**
   * Run targeted simulation based on AI Coordination request
   */
  private async runTargetedSimulation(request: any): Promise<void> {
    // Run specific simulation scenario
    const result = await this.runSingleSimulation(
      -1, // Special worker ID for targeted simulations
      request.difficulty1 || 0.8,
      request.difficulty2 || 0.8
    );
    
    if (result) {
      this.sendToAICoordination({
        type: 'simulation_result',
        requestId: request.requestId,
        result: result,
      });
    }
  }

  /**
   * Broadcast service status updates
   */
  private broadcastServiceStatus(): void {
    const statusUpdate = {
      backend: this.serviceStatus.get('backend') || false,
      frontend: this.serviceStatus.get('frontend') || false,
      ml_service: this.serviceStatus.get('ml_service') || false,
      ml_inference: this.serviceStatus.get('ml_inference') || false,
      continuous_learning: this.serviceStatus.get('continuous_learning') || false,
      ai_coordination: this.serviceStatus.get('ai_coordination') || false,
      python_trainer: this.serviceStatus.get('python_trainer') || false,
      game_websocket: this.serviceStatus.get('game_websocket') || false,
      integration_websocket: this.serviceStatus.get('integration_websocket') || false,
    };
    
    // Count online services
    const onlineCount = Object.values(statusUpdate).filter(status => status).length;
    const totalCount = Object.keys(statusUpdate).length;
    
    // Log service integration summary
    this.logger.log(`📊 Service Integration Summary: (${onlineCount}/${totalCount} services online)`);
    this.logger.log(`   Backend: ${statusUpdate.backend ? '✅' : '❌'}`);
    this.logger.log(`   Frontend: ${statusUpdate.frontend ? '✅' : '❌'}`);
    this.logger.log(`   ML Service: ${statusUpdate.ml_service ? '✅' : '❌'}`);
    this.logger.log(`   ML Inference: ${statusUpdate.ml_inference ? '✅' : '❌'}`);
    this.logger.log(`   Continuous Learning: ${statusUpdate.continuous_learning ? '✅' : '❌'}`);
    this.logger.log(`   AI Coordination: ${statusUpdate.ai_coordination ? '✅' : '❌'}`);
    this.logger.log(`   Python Trainer: ${statusUpdate.python_trainer ? '✅' : '❌'}`);
    this.logger.log(`   Game WebSocket: ${statusUpdate.game_websocket ? '✅' : '❌'}`);
    this.logger.log(`   Integration WebSocket: ${statusUpdate.integration_websocket ? '✅' : '❌'}`);
    
    // Emit service status update event
    this.eventEmitter.emit('service.status.update', statusUpdate);
  }

  /**
   * Get integration metrics
   */
  getMetrics(): any {
    const serviceStatusObj = Object.fromEntries(this.serviceStatus);
    const onlineCount = Object.values(serviceStatusObj).filter(status => status).length;
    const totalCount = Object.keys(serviceStatusObj).length;
    
    return {
      ...this.metrics,
      serviceStatus: serviceStatusObj,
      servicesOnline: onlineCount,
      servicesTotal: totalCount,
      servicesSummary: `${onlineCount}/${totalCount} services online`,
      simulationWorkers: this.simulationWorkers.map(w => ({
        id: w.id,
        active: w.active,
        gamesPlayed: w.gamesPlayed,
        lastGame: w.lastGame,
      })),
    };
  }

  /**
   * Utility sleep function
   */
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
  
  /**
   * Periodic service status summary logging
   * Runs every 60 seconds to log the current service integration status
   */
  @Interval(60000)
  public logServiceStatusSummary(): void {
    const metrics = this.getMetrics();
    this.logger.log(`📊 Service Integration Summary: (${metrics.servicesOnline}/${metrics.servicesTotal} services online)`);
  }
}