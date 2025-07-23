import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { join } from 'path';
import * as express from 'express';
import { IoAdapter } from '@nestjs/platform-socket.io';

async function bootstrap() {
  const logger = new Logger('Bootstrap');

  try {
    logger.log('🚀 Starting Enterprise Connect Four Backend...');

    const app = await NestFactory.create(AppModule, {
      logger: ['error', 'warn', 'log'],
    });

    // Configure WebSocket adapter for socket.io
    app.useWebSocketAdapter(new IoAdapter(app));

    const configService = app.get(ConfigService);

    // Enterprise Configuration Logging
    logger.log('🏢 Enterprise Configuration:');
    logger.log(`   📁 Port: ${configService.get('port')}`);
    logger.log(`   🌐 Frontend URL: ${configService.get('frontendUrl')}`);
    logger.log(`   🧠 ML Service URL: ${configService.get('mlServiceUrl')}`);
    logger.log(`   🏢 Enterprise Mode: ${configService.get('enterpriseMode') ? '✅' : '❌'}`);
    logger.log(`   🤖 Advanced AI: ${configService.get('enableAdvancedAI') ? '✅' : '❌'}`);
    logger.log(`   📈 Performance Monitoring: ${configService.get('performanceMonitoring') ? '✅' : '❌'}`);

    // Enterprise CORS Configuration
    const corsEnabled = configService.get('corsEnabled') !== false; // Default to true
    const corsOrigins = configService.get('corsOrigins') || [
      'http://localhost:3000',
      'http://localhost:3001',
      'https://connect-four-ai-derek.vercel.app',
      'https://connect-four-ai-roge.vercel.app',
      '*' // Allow all origins for now
    ];

    // Always enable CORS
    app.enableCors({
      origin: (origin, callback) => {
        // Allow requests with no origin (like mobile apps or curl)
        if (!origin) return callback(null, true);

        // Check if origin is in allowed list
        if (corsOrigins.includes('*') || corsOrigins.includes(origin)) {
          callback(null, true);
        } else {
          logger.warn(`CORS blocked origin: ${origin}`);
          callback(null, true); // For now, allow all origins during debugging
        }
      },
      credentials: true,
      methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'HEAD'],
      allowedHeaders: ['Content-Type', 'Authorization', 'Accept', 'Origin', 'X-Requested-With'],
      exposedHeaders: ['Content-Length', 'X-Requested-With'],
      maxAge: 86400, // 24 hours
    });

    logger.log(`✅ CORS enabled for origins: ${corsOrigins.join(', ')}`);

    // Set API prefix
    app.setGlobalPrefix('api');
    logger.log('✅ API prefix set to /api');

    // Serve frontend static files
    const frontendPath = join(__dirname, '..', '..', 'frontend', 'build');
    app.use(express.static(frontendPath));
    logger.log('✅ Frontend static files served from: ' + frontendPath);

    // Enterprise Server Startup
    const port = process.env.PORT || configService.get('port') || 3000;
    const frontendUrl = configService.get('frontendUrl');

    await app.listen(port);
    logger.log(`🚀 Enterprise Connect Four Backend running on port ${port}`);
    logger.log(`💚 Health check: http://localhost:${port}/api/health`);
    logger.log(`🎮 Game ready at: ${frontendUrl}`);
    logger.log(`🧠 ML Service integration: ${configService.get('mlServiceUrl')}`);

  } catch (error) {
    logger.error('💥 Bootstrap failed:', error.message);
    process.exit(1);
  }
}

bootstrap();
