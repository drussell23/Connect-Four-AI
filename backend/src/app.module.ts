// backend/src/app.module.ts
import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { GameModule } from './game/game.module';
import { MlModule } from './ml/ml.module';
import { HealthController } from './health.controller';

// Enterprise Environment Configuration
const envConfiguration = () => ({
  // Service Configuration
  port: parseInt(process.env.BACKEND_PORT, 10) || 3000,
  frontendPort: parseInt(process.env.FRONTEND_PORT, 10) || 3001,
  mlServicePort: parseInt(process.env.ML_SERVICE_PORT, 10) || 8000,

  // URLs
  backendUrl: process.env.BACKEND_URL || 'http://localhost:3000',
  frontendUrl: process.env.FRONTEND_URL || 'http://localhost:3001',
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
  corsOrigins: process.env.CORS_ORIGINS?.split(',') || ['http://localhost:3001'],

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
});

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
      load: [envConfiguration],
      cache: true,
    }),
    GameModule,
    MlModule
  ],
  controllers: [HealthController],
  providers: [],
})
export class AppModule { }
