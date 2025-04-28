// board.c
#include <stdio.h>
#include "board.h"

void initBoard(Board *b) {
    for (int r = 0; r < ROWS; r++) {
        for (int c = 0; c < COLS; c++) {
            b->grid[r][c] = EMPTY;
        }
    }
}

int dropDisc(Board *b, int col, char disc) {
    if (col < 0 || col >= COLS)
        return -1;

    for (int r = ROWS - 1; r >= 0; r --) {
        if (b->grid[r][col] == EMPTY) {
            b->grid[r][col] = disc;
            return r;
        }
    }
    return -1; // Column full.
}

bool isFull(const Board *b) {
    for (int c = 0; c < COLS; c++) {
        if (b->grid[0][c] == EMPTY)
            return false;
    }
    return true;
}

void printBoard(const Board *b) {
    for (int r = 0; r < ROWS; r++) {
       for (int c = 0; c < COLS; c++) {
        putchar(b->grid[r][c]);
        putchar(' ');
       }
       putchar('\n');
    }
    
    // Column numbers.
    for (int c = 0; c < COLS; c++) {
        printf("%d ", c);
    }
    putchar('\n');
}

// Helper to check four-in-a-row starting from (r,c) in direction dr, dc.
static bool checkDirection(const Board *b, int r, int c, int dr, int dc, char disc) {
    int count = 0; 
    
    for (int i = 0; i < 4; i++) {
        int rr = r + dr * i;
        int cc = c + dc * i;

        if (rr < 0 || r >= ROWS || cc < 0 || cc >= COLS)
            return false;

        if (b->grid[rr][cc] != disc)
            return false;
    }
    return true;
}

bool checkWin(const Board *b, char disc) {
    // Check horizontal, vertical, and two diagonals.
    for (int r = 0; r < ROWS; r++) {
        for (int c = 0; c < COLS; c++) {
            if (b->grid[r][c] != disc)
                continue;
            
            // Horizontal
            if (checkDirection(b, r, c, 0, 1, disc))
                return true;

            // Vertical 
            if (checkDirection(b, r, c, 1, 0, disc))
                return true;
            
            // Diagonal down-right
            if (checkDirection(b, r, c, 1, 1, disc))
                return true;

            // Diagonal down-left 
            if (checkDirection(b, r, c, 1, -1, disc))
                return true;
        }
    }
    return false;
}