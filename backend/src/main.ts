import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ValidationPipe, Logger } from '@nestjs/common';
import { IoAdapter } from '@nestjs/platform-socket.io';

async function bootstrap() {
    const logger = new Logger('Bootstrap');
    const app = await NestFactory.create(AppModule);
    
    // Enable CORS for all origins (adjust as needed).
    app.enableCors({
        origin: '*',
        methods: ['GET', 'POST'],
        credentials: true,
    });

    // Global validation
    app.useGlobalPipes(
        new ValidationPipe({
            whitelist: true, 
            forbidNonWhitelisted: true, 
            transform: true,
        }),
    );

    // Set up Socket.IO adapter.
    app.useWebSocketAdapter(new IoAdapter(app));

    const port = process.env.PORT || 3000;
    await app.listen(port);
    logger.log(`Server is running on http://localhost:${port}`);
}

bootstrap();