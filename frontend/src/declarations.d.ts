// Type declarations for Connect Four game

export type CellValue = 'Empty' | 'Red' | 'Yellow';

export interface Move {
    player: CellValue;
    column: number;
}

export interface BoardProps {
    board: CellValue[][];
    winningLine: [number, number][];
    onColumnClick: (col: number) => void;
    gameOver: boolean;
    currentPlayer: CellValue;
}

export interface PlayerStats {
    wins: number;
    losses: number;
    draws: number;
    winStreak: number;
    currentLevelWins: number;
    totalGamesPlayed: number;
    highestLevelReached: number;
    averageMovesPerGame: number;
}

export interface AIPersonalityData {
    name: string;
    description: string;
    difficulty: number;
    specialAbilities: string[];
    threatLevel: string;
    color: string;
}
