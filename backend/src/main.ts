// backend/src/main.ts
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ValidationPipe, Logger } from '@nestjs/common';
import { IoAdapter } from '@nestjs/platform-socket.io';
import { ServerOptions } from 'socket.io';
import * as express from 'express';
import { join } from 'path';

// Custom adapter to restrict transports to WebSocket only
class WSOnlyIoAdapter extends IoAdapter {
  createIOServer(portOrOptions: any, options?: ServerOptions) {
    // Supply a default path and restrict to 'websocket' transport
    const opts: ServerOptions = {
      path: options?.path ?? '/socket.io',
      transports: ['websocket'],
      ...(options || {}),
    } as ServerOptions;
    return super.createIOServer(portOrOptions, opts);
  }
}

async function bootstrap() {
  const logger = new Logger('Bootstrap');

  console.log('🚀 bootstrap() start');

  // Initialize NestJS application
  const app = await NestFactory.create(AppModule, {
    logger: ['log', 'warn', 'error'],
  });

  console.log('✅ NestFactory.create complete');

  // Enable CORS for all origins
  app.enableCors({ origin: '*', methods: ['GET', 'POST'], credentials: true });

  // Global validation pipe
  app.useGlobalPipes(
    new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }),
  );

  // Use custom WebSocket adapter
  app.useWebSocketAdapter(new WSOnlyIoAdapter(app));

  // Serve React build output
  const httpAdapter = app.getHttpAdapter();
  const expressApp = httpAdapter.getInstance() as express.Application;
  const distPath = join(__dirname, '..', '..', 'frontend', 'build');
  expressApp.use(express.static(distPath));
  expressApp.use((req, res, next) => {
    if (req.url.startsWith('/socket.io')) {
      return next();
    }
    res.sendFile(join(distPath, 'index.html'));
  });

  const port = parseInt(process.env.PORT, 10) || 3000;
  await app.listen(port);
  logger.log(`🚀 Server is running on http://localhost:${port}`);
}
bootstrap();
