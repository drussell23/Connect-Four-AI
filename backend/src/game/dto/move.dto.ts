import { IsArray, IsEnum } from "class-validator";
import { Type } from 'class-transformer';
import { CellValue } from "../../ai/connect4AI";

/**
 * Possible players in the game.
 */
export enum Player {
    Red = 'Red',
    Yellow = 'Yellow',
}

/**
 * Data Transfer Object for a player's move, including full board state.
 */
export class MoveDto {
    /**
     * 6×7 board represented as a 2D array of CellValue ("Red", "Yellow" or empty string).
     */
    @IsArray()
    @IsArray({ each: true })
    @Type(() => Array)
    board: CellValue[][];

    /**
     * Which player's move this is.
     */
    @IsEnum(Player)
    currentPlayer: Player;
}