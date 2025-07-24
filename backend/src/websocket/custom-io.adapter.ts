import { IoAdapter } from '@nestjs/platform-socket.io';
import { ServerOptions } from 'socket.io';
import { INestApplication } from '@nestjs/common';

export class CustomIoAdapter extends IoAdapter {
  constructor(private app: INestApplication) {
    super(app);
  }

  createIOServer(port: number, options?: ServerOptions): any {
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
        origin: ['http://localhost:3000', 'http://localhost:3001', '*'],
        credentials: true,
        methods: ['GET', 'POST'],
      },
      // Transport options
      transports: ['polling', 'websocket'],
    });

    return server;
  }
}