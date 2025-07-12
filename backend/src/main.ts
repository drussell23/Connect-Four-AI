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

  try {
    logger.log('🚀 Initializing application...');

    const app = await NestFactory.create(AppModule, {
      logger: ['log', 'warn', 'error'],
    });

    logger.log('✅ Application initialized.');

    // --- Middleware and Configuration ---
    app.enableCors({ origin: '*', methods: ['GET', 'POST'], credentials: true });
    app.useGlobalPipes(
      new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }),
    );
    app.useWebSocketAdapter(new WSOnlyIoAdapter(app));

    // Set global prefix for all API routes
    app.setGlobalPrefix('api');

    // --- Static File Serving ---
    const httpAdapter = app.getHttpAdapter();
    const expressApp = httpAdapter.getInstance() as express.Application;
    const distPath = join(__dirname, '..', '..', 'frontend', 'build');
    expressApp.use(express.static(distPath));
    expressApp.use((req, res, next) => {
      if (req.url.startsWith('/socket.io') || req.url.startsWith('/api')) {
        return next();
      }
      res.sendFile(join(distPath, 'index.html'));
    });

    // --- Robust Port Handling & Server Start ---
    const startServer = async () => {
      let port = parseInt(process.env.PORT, 10) || 3000;
      const maxRetries = 10;
      for (let i = 0; i < maxRetries; i++) {
        try {
          await app.listen(port);
          logger.log(`🚀 Server is running on http://localhost:${port}`);
          return; // Success
        } catch (error) {
          if (error.code === 'EADDRINUSE') {
            logger.warn(`Port ${port} is in use. Trying next port...`);
            port++;
          } else {
            throw error; // Re-throw other errors
          }
        }
      }
      throw new Error(`Could not find an open port after ${maxRetries} retries.`);
    };

    await startServer();

  } catch (error) {
    logger.error('❌ Failed to bootstrap the application.', error.stack);
    process.exit(1);
  }
}
bootstrap();
