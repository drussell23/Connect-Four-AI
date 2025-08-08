import { IoAdapter } from '@nestjs/platform-socket.io';
import { ServerOptions } from 'socket.io';
import { INestApplication } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

export class CustomIoAdapter extends IoAdapter {
  constructor(private app: INestApplication) {
    super(app);
  }

  createIOServer(port: number, options?: ServerOptions): any {
    const configService = this.app.get(ConfigService);
    
    // Get CORS origins from config or use defaults
    const corsOrigins = configService.get('corsOrigins') || [
      'http://localhost:3000',
      'http://localhost:3001',
      'https://connect-four-ai-derek.vercel.app',
      'https://connect-four-ai-roge.vercel.app',
      'https://*.vercel.app', // Allow all Vercel preview deployments
      'https://*.onrender.com', // Allow Render deployments
      '*' // Allow all origins temporarily for debugging
    ];

    const server = super.createIOServer(port, {
      ...options,
      // Configure ping/pong timeouts to match frontend
      pingInterval: 25000,  // Send ping every 25 seconds
      pingTimeout: 60000,   // Wait 60 seconds for pong response
      // Additional stability options
      connectTimeout: 45000,
      // Allow larger payloads
      maxHttpBufferSize: 1e8,
      // CORS configuration
      cors: {
        origin: (origin, callback) => {
          // Allow requests with no origin (like mobile apps or Postman)
          if (!origin) return callback(null, true);
          
          // Check exact matches
          if (corsOrigins.includes(origin) || corsOrigins.includes('*')) {
            return callback(null, true);
          }
          
          // Check wildcard patterns
          const wildcardMatch = corsOrigins.some(pattern => {
            if (pattern.includes('*')) {
              const regex = new RegExp(pattern.replace(/\*/g, '.*'));
              return regex.test(origin);
            }
            return false;
          });
          
          if (wildcardMatch) {
            return callback(null, true);
          }
          
          // Log rejected origins for debugging
          console.warn(`Socket.IO CORS rejected origin: ${origin}`);
          // For now, allow all origins to prevent blocking
          callback(null, true);
        },
        credentials: true,
        methods: ['GET', 'POST'],
        allowedHeaders: ['Content-Type', 'Authorization'],
      },
      // Transport options
      transports: ['polling', 'websocket'],
    });

    return server;
  }
}