// backend/src/main.ts
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ValidationPipe, Logger } from '@nestjs/common';
import { IoAdapter } from '@nestjs/platform-socket.io';
import * as express from 'express';
import { join } from 'path';

async function bootstrap() {
  const logger = new Logger('Bootstrap');

  // Initialize NestJS application
  const app = await NestFactory.create(AppModule);

  // Enable CORS for all origins
  app.enableCors({
    origin: '*',
    methods: ['GET', 'POST'],
    credentials: true,
  });

  // Global validation pipe
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  // Configure WebSocket adapter
  app.useWebSocketAdapter(new IoAdapter(app));

  // Serve React build output
  const httpAdapter = app.getHttpAdapter();
  const expressApp = httpAdapter.getInstance() as express.Application;
  const distPath = join(__dirname, '..', 'frontend', 'dist');
  expressApp.use(express.static(distPath));
  // SPA fallback: for all other requests, return index.html
  expressApp.use((_req, res) => {
    res.sendFile(join(distPath, 'index.html'));
  });

  const port = process.env.PORT || 3000;
  await app.listen(port);
  logger.log(`🚀 Server is running on http://localhost:${port}`);
}