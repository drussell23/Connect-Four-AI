// backend/src/app.module.ts
import { Module } from '@nestjs/common';
import { GameGateway } from './game/game.gateway';
import { GameService } from './game/game.service';

/**
 * Root application module registering WebSocket gateway and game service.
 */
@Module({
  providers: [GameGateway, GameService],
})
export class AppModule {}
