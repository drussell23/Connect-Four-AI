// board.h
#ifndef BOARD_H
#define BOARD_H

#include <stdbool.h>

#define ROWS 6
#define COLS 7

// Cell values 
#define EMPTY '.'
#define RED   'R'
#define YELLOW 'Y'

// Represents the game board as a 2D array.
typedef struct {
    char grid[ROWS][COLS];
} Board;

// Drop a disc ('R' or 'Y') into the specified column (0-based).
// Returns the row index (0-based from top) where the disc landed, or -1 if the column is full. 
int dropDisc(Board *b, int col, char disc);

// Check if the board is completely full.
bool isFull(const Board *b);

// Print the current board state to stdout.
void printBoard(const Board *b);

// Check if the given disc ('R' or 'Y') has four in a row.
bool checkWin(const Board *b, char disc);

#endif // BOARD_H


