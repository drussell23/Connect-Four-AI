// backend/src/game/game.module.ts
import { Module } from "@nestjs/common";
import { HttpModule } from "@nestjs/axios";
import { GameService } from "./game.service";
import { GameController } from "./game.controller";
import { MlClientService } from "../ml/ml-client.service";

@Module({ 
    imports: [HttpModule],
    controllers: [GameController],
    providers: [GameService, MlClientService],
})
export class GameModule {}