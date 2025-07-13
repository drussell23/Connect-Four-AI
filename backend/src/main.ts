import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { Logger } from '@nestjs/common';
import { join } from 'path';
import * as express from 'express';

async function bootstrap() {
  const logger = new Logger('Bootstrap');

  try {
    logger.log('🚀 Starting Connect Four Backend with Frontend...');

    const app = await NestFactory.create(AppModule, {
      logger: ['error', 'warn', 'log'],
    });

    // Enable CORS
    app.enableCors({
      origin: ['http://localhost:3000', 'http://localhost:3001'],
      credentials: true,
    });

    // Set API prefix
    app.setGlobalPrefix('api');
    logger.log('✅ API prefix set to /api');

    // Serve frontend static files
    const frontendPath = join(__dirname, '..', '..', 'frontend', 'build');
    app.use(express.static(frontendPath));
    logger.log('✅ Frontend static files served from: ' + frontendPath);

    // Start server
    await app.listen(3000);
    logger.log('🚀 Connect Four Backend + Frontend running on http://localhost:3000');
    logger.log('💚 Health check: http://localhost:3000/api/health');
    logger.log('🎮 Game ready at: http://localhost:3000');

  } catch (error) {
    logger.error('💥 Bootstrap failed:', error.message);
    process.exit(1);
  }
}

bootstrap();
