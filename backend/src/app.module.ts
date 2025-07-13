// backend/src/app.module.ts
import { Module } from '@nestjs/common';
import { GameModule } from './game/game.module';
import { MlModule } from './ml/ml.module';
import { HealthController } from './health.controller';

@Module({
  imports: [GameModule, MlModule],
  controllers: [HealthController],
  providers: [],
})
export class AppModule { }
