/**
 * Hybrid AI Controller
 * REST API for training, deployment, and model management
 */

import {
  Controller,
  Post,
  Get,
  Put,
  Delete,
  Body,
  Param,
  Query,
  HttpException,
  HttpStatus,
  UseInterceptors,
  UploadedFile,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { HybridAIService, TrainingConfig, TrainingExample } from './hybrid-ai.service';
import { TrainingDataManager, GameRecord } from './training-data-manager';
import { ModelDeploymentService, DeploymentStrategy } from './model-deployment.service';
import { CellValue } from '../connect4AI';

@Controller('api/ai/hybrid')
export class HybridAIController {
  constructor(
    private readonly hybridAI: HybridAIService,
    private readonly dataManager: TrainingDataManager,
    private readonly deployment: ModelDeploymentService,
  ) {}

  /**
   * Train a new model
   */
  @Post('train')
  async trainModel(
    @Body() body: {
      examples?: TrainingExample[];
      datasetName?: string;
      config: TrainingConfig;
      description?: string;
    },
  ) {
    try {
      let examples: TrainingExample[];

      if (body.examples) {
        examples = body.examples;
      } else if (body.datasetName) {
        examples = await this.dataManager.loadDataset(body.datasetName);
      } else {
        throw new HttpException(
          'Either examples or datasetName must be provided',
          HttpStatus.BAD_REQUEST,
        );
      }

      const job = await this.hybridAI.trainModel(
        examples,
        body.config,
        body.description,
      );

      return {
        success: true,
        job,
      };
    } catch (error) {
      throw new HttpException(error.message, HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  /**
   * Get training job status
   */
  @Get('train/:jobId')
  async getTrainingStatus(@Param('jobId') jobId: string) {
    try {
      const status = await this.hybridAI.getTrainingStatus(jobId);
      return {
        success: true,
        status,
      };
    } catch (error) {
      throw new HttpException(error.message, HttpStatus.NOT_FOUND);
    }
  }

  /**
   * Make prediction with current model
   */
  @Post('predict')
  async predict(@Body() body: { board: CellValue[][] }) {
    try {
      const prediction = await this.hybridAI.predict(body.board);
      return {
        success: true,
        prediction,
      };
    } catch (error) {
      throw new HttpException(error.message, HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  /**
   * Make ensemble prediction
   */
  @Post('predict/ensemble')
  async ensemblePredict(
    @Body() body: {
      board: CellValue[][];
      modelIds?: string[];
    },
  ) {
    try {
      const prediction = await this.hybridAI.ensemblePredict(
        body.board,
        body.modelIds,
      );
      return {
        success: true,
        prediction,
      };
    } catch (error) {
      throw new HttpException(error.message, HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  /**
   * Deploy a trained model
   */
  @Post('deploy/:jobId')
  async deployModel(
    @Param('jobId') jobId: string,
    @Body() body: {
      strategy: DeploymentStrategy;
      targetGroup?: string;
      activate?: boolean;
    },
  ) {
    try {
      // First, download and save the model
      const modelVersion = await this.hybridAI.deployModel(
        jobId,
        body.activate ?? true,
      );

      // Then set up deployment strategy
      await this.deployment.deployModel(
        modelVersion.id,
        body.strategy,
        body.targetGroup || 'default',
      );

      return {
        success: true,
        modelVersion,
      };
    } catch (error) {
      throw new HttpException(error.message, HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  /**
   * Save game for training
   */
  @Post('games')
  async saveGame(@Body() game: GameRecord) {
    try {
      await this.dataManager.saveGame(game);
      return {
        success: true,
        gameId: game.id,
      };
    } catch (error) {
      throw new HttpException(error.message, HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  /**
   * Generate self-play data
   */
  @Post('selfplay')
  async generateSelfPlay(
    @Body() body: {
      numGames: number;
      options?: {
        temperature?: number;
        explorationRate?: number;
        symmetricGames?: boolean;
      };
    },
  ) {
    try {
      // This would use your AI service
      const examples = await this.dataManager.generateSelfPlayData(
        this.hybridAI, // Pass AI service
        body.numGames,
        body.options,
      );

      return {
        success: true,
        examplesGenerated: examples.length,
      };
    } catch (error) {
      throw new HttpException(error.message, HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  /**
   * Create training dataset
   */
  @Post('datasets')
  async createDataset(
    @Body() body: {
      name: string;
      options: {
        gameIds?: string[];
        dateRange?: { start: Date; end: Date };
        minRating?: number;
        includeHumanGames?: boolean;
        includeSelfPlay?: boolean;
        maxExamples?: number;
        balanceClasses?: boolean;
      };
    },
  ) {
    try {
      const datasetPath = await this.dataManager.createDataset(
        body.name,
        body.options,
      );

      return {
        success: true,
        datasetPath,
      };
    } catch (error) {
      throw new HttpException(error.message, HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  /**
   * List available datasets
   */
  @Get('datasets')
  async listDatasets() {
    try {
      const datasets = await this.dataManager.listDatasets();
      return {
        success: true,
        datasets,
      };
    } catch (error) {
      throw new HttpException(error.message, HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  /**
   * Start A/B test
   */
  @Post('abtest')
  async startABTest(
    @Body() body: {
      name: string;
      modelA: string;
      modelB: string;
      splitPercentage: number;
      duration: number;
      metrics: string[];
      segmentation?: any;
    },
  ) {
    try {
      await this.deployment.startABTest(body);
      return {
        success: true,
        testName: body.name,
      };
    } catch (error) {
      throw new HttpException(error.message, HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  /**
   * Get model comparison
   */
  @Post('compare')
  async compareModels(
    @Body() body: {
      modelIds: string[];
      metrics?: string[];
    },
  ) {
    try {
      const comparison = await this.deployment.compareModels(
        body.modelIds,
        body.metrics,
      );

      return {
        success: true,
        comparison,
      };
    } catch (error) {
      throw new HttpException(error.message, HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  /**
   * Rollback deployment
   */
  @Post('rollback/:modelId')
  async rollbackModel(
    @Param('modelId') modelId: string,
    @Body() body: {
      reason: string;
      targetGroup?: string;
    },
  ) {
    try {
      await this.deployment.rollbackDeployment(
        modelId,
        body.reason,
        body.targetGroup || 'default',
      );

      return {
        success: true,
        message: `Model ${modelId} rolled back`,
      };
    } catch (error) {
      throw new HttpException(error.message, HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  /**
   * Get system status
   */
  @Get('status')
  async getStatus() {
    const hybridStatus = this.hybridAI.getStatus();
    const deploymentStatus = await this.deployment.getDeploymentStatus();

    return {
      success: true,
      status: {
        hybrid: hybridStatus,
        deployment: deploymentStatus,
      },
    };
  }

  /**
   * Upload ONNX model directly
   */
  @Post('upload')
  @UseInterceptors(FileInterceptor('model'))
  async uploadModel(
    @UploadedFile() file: any, // Express.Multer.File type
    @Body() body: {
      modelType: string;
      metadata?: any;
    },
  ) {
    try {
      if (!file) {
        throw new HttpException('No file uploaded', HttpStatus.BAD_REQUEST);
      }

      // Save uploaded model
      const modelVersion = await this.deployment.registerModel(
        file.path,
        {
          modelType: body.modelType,
          metadata: body.metadata,
        },
      );

      return {
        success: true,
        modelVersion,
      };
    } catch (error) {
      throw new HttpException(error.message, HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  /**
   * Hyperparameter search
   */
  @Post('hypersearch')
  async hyperparameterSearch(
    @Body() body: {
      examples: TrainingExample[];
      searchSpace: Record<string, any>;
    },
  ) {
    try {
      const results = await this.hybridAI.hyperparameterSearch(
        body.examples,
        body.searchSpace,
      );

      return {
        success: true,
        results,
      };
    } catch (error) {
      throw new HttpException(error.message, HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  /**
   * Record model performance
   */
  @Post('performance/:modelId')
  async recordPerformance(
    @Param('modelId') modelId: string,
    @Body() performance: any,
  ) {
    try {
      await this.deployment.recordPerformance(modelId, performance);
      return {
        success: true,
        message: 'Performance recorded',
      };
    } catch (error) {
      throw new HttpException(error.message, HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }
}