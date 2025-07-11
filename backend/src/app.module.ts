// backend/src/app.module.ts
import { Module } from '@nestjs/common';
import { GameModule } from './game/game.module';
import { MlModule } from './ml/ml.module';

@Module({
  imports: [GameModule, MlModule],
  providers: [],
})
export class AppModule { }
