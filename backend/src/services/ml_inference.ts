/**
 * 🧠 ML INFERENCE SERVICE
 * =======================
 * 
 * Service to communicate with the enhanced Connect4 ML service.
 * Provides intelligent move suggestions via HTTP API calls.
 */

import { Logger } from '@nestjs/common';
import axios, { AxiosInstance, AxiosResponse } from 'axios';

// Configure ML service connection
const ML_SERVICE_BASE_URL = process.env.ML_SERVICE_URL || 'http://localhost:8001';
const ML_SERVICE_TIMEOUT = parseInt(process.env.ML_SERVICE_TIMEOUT || '5000');
const ML_API_KEY = process.env.ML_API_KEY; // Optional API key

export interface MLPredictionRequest {
    board: number[][][] | string[][];
    model_type?: 'lightweight' | 'standard' | 'heavyweight' | 'legacy';
    include_uncertainty?: boolean;
    game_id?: string;
}

export interface MLPredictionResponse {
  move: number;
  probs: number[];
    confidence?: number;
    uncertainty?: number[];
    value_estimate?: number;
    model_type: string;
    model_version: string;
    inference_time_ms: number;
    timestamp: number;
    request_id?: string;
    cache_hit: boolean;
    alternatives?: Array<{
        move: number;
        probability: number;
    }>;
}

export interface MLServiceError {
    error: {
        code: number;
        message: string;
        timestamp: number;
        path: string;
    };
}

/**
 * ML Inference Client for Connect4 AI predictions
 */
class MLInferenceClient {
    private readonly logger = new Logger(MLInferenceClient.name);
    private readonly httpClient: AxiosInstance;
    private isHealthy = false;
    private lastHealthCheck = 0;
    private readonly HEALTH_CHECK_INTERVAL = 30000; // 30 seconds

    constructor() {
        this.httpClient = axios.create({
            baseURL: ML_SERVICE_BASE_URL,
            timeout: ML_SERVICE_TIMEOUT,
            headers: {
                'Content-Type': 'application/json',
                ...(ML_API_KEY && { 'Authorization': `Bearer ${ML_API_KEY}` })
            }
        });

        // Response interceptor for error handling
        this.httpClient.interceptors.response.use(
            (response) => response,
            (error) => {
                this.logger.error(
                    `ML service error: ${error.message}`,
                    error.response?.data || error
                );
                return Promise.reject(error);
            }
        );

        // Initial health check
        this.checkHealth();
    }

    /**
     * Check if ML service is healthy
     */
    async checkHealth(): Promise<boolean> {
        const now = Date.now();

        // Skip if recent check
        if (now - this.lastHealthCheck < this.HEALTH_CHECK_INTERVAL && this.isHealthy) {
            return this.isHealthy;
        }

        try {
            const response = await this.httpClient.get('/health', { timeout: 3000 });
            this.isHealthy = response.status === 200 && response.data.status === 'healthy';
            this.lastHealthCheck = now;

            if (this.isHealthy) {
                this.logger.debug(`ML service healthy: ${response.data.device}, models: ${response.data.models_loaded?.join(', ')}`);
            }
        } catch (error: any) {
            this.isHealthy = false;
            this.logger.warn(`ML service health check failed: ${error.message}`);
        }

        return this.isHealthy;
    }

    /**
     * Get AI move prediction from ML service
     */
    async predict(request: MLPredictionRequest): Promise<MLPredictionResponse> {
        try {
            // Health check
            await this.checkHealth();
            if (!this.isHealthy) {
                throw new Error('ML service is not healthy');
            }

            // Make prediction request
            const startTime = Date.now();
            const response: AxiosResponse<MLPredictionResponse> = await this.httpClient.post('/predict', request);
            const totalTime = Date.now() - startTime;

            this.logger.debug(
                `ML prediction: move=${response.data.move}, ` +
                `confidence=${response.data.confidence?.toFixed(3)}, ` +
                `inference=${response.data.inference_time_ms.toFixed(1)}ms, ` +
                `total=${totalTime}ms, ` +
                `cache_hit=${response.data.cache_hit}`
            );

            return response.data;
        } catch (error: any) {
            // Enhanced error handling
            if (error.response) {
                // ML service returned an error response
                const mlError: MLServiceError = error.response.data;
                this.logger.error(
                    `ML service error ${mlError.error.code}: ${mlError.error.message}`
                );
                throw new Error(`ML service error: ${mlError.error.message}`);
            } else if (error.request) {
                // Network error
                this.logger.error('ML service unreachable', error.message);
                throw new Error('ML service unreachable');
            } else {
                // Other error
                this.logger.error('ML prediction failed', error.message);
                throw new Error(`ML prediction failed: ${error.message}`);
            }
        }
    }

    /**
     * Get batch predictions for multiple boards
     */
    async batchPredict(requests: MLPredictionRequest[]): Promise<MLPredictionResponse[]> {
        try {
            await this.checkHealth();
            if (!this.isHealthy) {
                throw new Error('ML service is not healthy');
            }

            const batchRequest = {
                boards: requests,
                batch_id: `batch_${Date.now()}`
            };

            const response = await this.httpClient.post('/predict/batch', batchRequest);

            this.logger.debug(
                `Batch prediction: ${response.data.successful_count}/${requests.length} successful, ` +
                `total_time=${response.data.total_time_ms.toFixed(1)}ms`
            );

            return response.data.results.filter((result: any) => !result.error);
        } catch (error: any) {
            this.logger.error('Batch prediction failed', error.message);
            throw new Error(`Batch prediction failed: ${error.message}`);
        }
    }

    /**
     * Get available models information
     */
    async getModels(): Promise<any> {
        try {
            const response = await this.httpClient.get('/models');
            return response.data;
        } catch (error: any) {
            this.logger.error('Failed to get models info', error.message);
            throw new Error(`Failed to get models: ${error.message}`);
        }
    }

    /**
     * Get service statistics
     */
    async getStats(): Promise<any> {
        try {
            const response = await this.httpClient.get('/stats');
            return response.data;
        } catch (error: any) {
            this.logger.error('Failed to get stats', error.message);
            throw new Error(`Failed to get stats: ${error.message}`);
        }
    }
}

// Singleton instance
const mlClient = new MLInferenceClient();

/**
 * Convert board layers to string format for better API compatibility
 */
function convertLayersToBoard(layers: number[][][]): string[][] {
    const [redLayer, yellowLayer] = layers;
    const board: string[][] = [];

    for (let row = 0; row < 6; row++) {
        board[row] = [];
        for (let col = 0; col < 7; col++) {
            if (redLayer[row][col] === 1) {
                board[row][col] = 'Red';
            } else if (yellowLayer[row][col] === 1) {
                board[row][col] = 'Yellow';
        } else {
                board[row][col] = 'Empty';
            }
        }
    }

    return board;
}

/**
 * Legacy function for backward compatibility
 * 
 * @param layers - 2×6×7 tensor format [redLayer, yellowLayer]
 * @param modelType - Model type to use (optional)
 * @returns Recommended column (0-6)
 */
export async function getAIMoveViaAPI(
    layers: number[][][],
    modelType: 'lightweight' | 'standard' | 'heavyweight' | 'legacy' = 'standard'
): Promise<number> {
    try {
        // Convert layers to board format
        const board = convertLayersToBoard(layers);

        // Make prediction request
        const request: MLPredictionRequest = {
            board,
            model_type: modelType,
            include_uncertainty: false, // Keep it simple for legacy compatibility
            game_id: `legacy_${Date.now()}`
        };

        const response = await mlClient.predict(request);

        // Validate column is in valid range
        if (response.move < 0 || response.move > 6) {
            throw new Error(`Invalid move column: ${response.move}`);
        }

        return response.move;
    } catch (error: any) {
        throw new Error(`AI move prediction failed: ${error.message}`);
    }
}

/**
 * Enhanced function for new integrations
 * 
 * @param board - Board in string format
 * @param options - Prediction options
 * @returns Full prediction response
 */
export async function getEnhancedAIMove(
    board: string[][],
    options: {
        modelType?: 'lightweight' | 'standard' | 'heavyweight' | 'legacy';
        includeUncertainty?: boolean;
        gameId?: string;
    } = {}
): Promise<MLPredictionResponse> {
    const request: MLPredictionRequest = {
        board,
        model_type: options.modelType || 'standard',
        include_uncertainty: options.includeUncertainty || false,
        game_id: options.gameId
    };

    return await mlClient.predict(request);
}

/**
 * Batch prediction for multiple board states
 */
export async function getBatchAIMoves(
    boards: string[][][],
    modelType: 'lightweight' | 'standard' | 'heavyweight' | 'legacy' = 'standard'
): Promise<number[]> {
    const requests: MLPredictionRequest[] = boards.map((board, index) => ({
        board,
        model_type: modelType,
        include_uncertainty: false,
        game_id: `batch_${Date.now()}_${index}`
    }));

    const responses = await mlClient.batchPredict(requests);
    return responses.map(response => response.move);
}

/**
 * Get ML service health status
 */
export async function getMLServiceHealth(): Promise<boolean> {
    return await mlClient.checkHealth();
}

/**
 * Get ML service information
 */
export async function getMLServiceInfo(): Promise<{
    models: any;
    stats: any;
    health: boolean;
}> {
    const [models, stats, health] = await Promise.allSettled([
        mlClient.getModels(),
        mlClient.getStats(),
        mlClient.checkHealth()
    ]);

    return {
        models: models.status === 'fulfilled' ? models.value : null,
        stats: stats.status === 'fulfilled' ? stats.value : null,
        health: health.status === 'fulfilled' ? health.value : false
    };
}

// Export the client for advanced usage
export { mlClient };
export default mlClient; 