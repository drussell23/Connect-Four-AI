import { ConfigModule } from '@nestjs/config';

export const productionConfig = ConfigModule.forRoot({
  isGlobal: true,
  envFilePath: '.env.production',
  load: [
    () => ({
      port: process.env.PORT || 3001,
      environment: 'production',
      cors: {
        origin: process.env.CORS_ORIGIN || 'https://your-domain.vercel.app',
        credentials: true,
      },
      mlService: {
        url: process.env.ML_SERVICE_URL || 'https://your-ml-service.railway.app',
        timeout: 10000,
      },
      database: {
        url: process.env.DATABASE_URL,
        ssl: true,
      },
      security: {
        rateLimit: {
          windowMs: 15 * 60 * 1000, // 15 minutes
          max: 100, // limit each IP to 100 requests per windowMs
        },
      },
    }),
  ],
}); 