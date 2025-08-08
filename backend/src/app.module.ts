// backend/src/app.module.ts
import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';
import { GameModule } from './game/game.module';
import { MlModule } from './ml/ml.module';
import { ServiceIntegrationModule } from './integration/service-integration.module';
import { HealthController } from './health.controller';
import { TensorFlowStatusController } from './controllers/tensorflow-status.controller';

// Enterprise Environment Configuration
const envConfiguration = () => ({
  // Service Configuration
  port: parseInt(process.env.BACKEND_PORT, 10) || 3001,
  frontendPort: parseInt(process.env.FRONTEND_PORT, 10) || 3000,
  mlServicePort: parseInt(process.env.ML_SERVICE_PORT, 10) || 8000,
  mlOptimization: process.env.ML_OPTIMIZATION === 'true',

  // URLs
  backendUrl: process.env.BACKEND_URL || 'http://localhost:3001',
  frontendUrl: process.env.FRONTEND_URL || 'http://localhost:3000',
  mlServiceUrl: process.env.ML_SERVICE_URL || 'http://localhost:8000',

  // Enterprise Services
  enterpriseMode: process.env.FEATURE_ENTERPRISE_MODE === 'true',
  aiInsights: process.env.FEATURE_AI_INSIGHTS === 'true',
  performanceAnalytics: process.env.FEATURE_PERFORMANCE_ANALYTICS === 'true',

  // AI Configuration
  enableAdvancedAI: process.env.ENABLE_ADVANCED_AI === 'true',
  aiTimeout: parseInt(process.env.AI_TIMEOUT_MS, 10) || 5000,
  aiHealthCheck: process.env.AI_HEALTH_CHECK_ENABLED === 'true',

  // CORS Configuration
  corsEnabled: process.env.CORS_ENABLED === 'true',
  corsOrigins: process.env.CORS_ORIGINS?.split(',') || [
    'http://localhost:3000',
    'http://localhost:3001',
    'https://connect-four-ai-derek.vercel.app',
    'https://connect-four-ai-derek.vercel.app/'
  ],

  // Security
  jwtSecret: process.env.JWT_SECRET || 'your_jwt_secret_key_here',
  sessionSecret: process.env.SESSION_SECRET || 'your_session_secret_here',

  // Performance
  maxMemoryUsage: process.env.MAX_MEMORY_USAGE || '512MB',
  maxCpuUsage: parseInt(process.env.MAX_CPU_USAGE, 10) || 80,

  // Monitoring
  performanceMonitoring: process.env.PERFORMANCE_MONITORING_ENABLED === 'true',
  healthCheckEnabled: process.env.HEALTH_CHECK_ENABLED === 'true',
  healthCheckInterval: parseInt(process.env.HEALTH_CHECK_INTERVAL, 10) || 30000,

  // Service Integration
  enableServiceIntegration: process.env.ENABLE_SERVICE_INTEGRATION !== 'false',
  simulationWorkers: parseInt(process.env.SIMULATION_WORKERS, 10) || 2,
  integrationPort: parseInt(process.env.INTEGRATION_PORT, 10) || 8888,
});

// Conditionally load M1 module based on environment
const moduleImports = [
  ConfigModule.forRoot({
    isGlobal: true,
    envFilePath: '.env',
    load: [envConfiguration],
    cache: true,
  }),
  ScheduleModule.forRoot(),
  ServiceIntegrationModule,
  GameModule,
  MlModule
];

// Only load M1 optimizations if explicitly enabled
const m1Enabled = process.env.M1_OPTIMIZED === 'true' || process.env.ENABLE_M1_FEATURES === 'true';
console.log('[AppModule] M1 Module Loading Check:', {
  M1_OPTIMIZED: process.env.M1_OPTIMIZED,
  ENABLE_M1_FEATURES: process.env.ENABLE_M1_FEATURES,
  m1Enabled,
  moduleCount: moduleImports.length
});
if (m1Enabled) {
  console.log('[AppModule] Adding M1OptimizedAIModule to imports');
  // Lazy load the module only when needed
  const { M1OptimizedAIModule } = require('./ai/m1-optimized/m1-optimized-ai.module');
  moduleImports.splice(2, 0, M1OptimizedAIModule); // Insert after ScheduleModule
}

@Module({
  imports: moduleImports,
  controllers: [HealthController, TensorFlowStatusController],
  providers: [],
})
export class AppModule { }
