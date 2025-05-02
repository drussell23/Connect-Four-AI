#pragma once

#include <array>
#include <iostream>

using namespace std;

static constexpr int ROWS = 6;
static constexpr int COLS = 7;

/**
 * Represents the content of a single cell on the Connect-4 board.
 */
enum class Cell {
    Empty, 
    Red, 
    Yellow
};

/**
 * Board 
 * 
 * Encapsulates a 6x7 Connect-4 grid, drop-disc logic, with detection, and display.
 */
class Board {
    public: 
        /**
         * Default constructs an empty board. 
         */
        Board();

        /**
         * Resets the board to all Empty cells. 
         */
        void reset();

        /**
         * Returns true if the board is completely full. 
         */
        bool isFull() const;

        /**
         * Returns true if the specified column is full (no Empty in top cell).
         * @param col Column index [0-COLS)
         */
        bool isColumnFull(int col) const;

        /**
         * Drops a disc into the given column. 
         * @param col Column index [0-COLS)
         * @param disc Cell::Red or Cell::Yellow 
         * @returns Row index [0-ROWS) where the disc landed, or -1 if the column is full. 
         */
        int dropDisc(int col, Cell disc);

        bool Board::checkDirection(int startRow, int startCol, int dr, int dc, Cell disc) const;

        /**
         * Checks if the given disc has four in a row anywhere on the board. 
         */
        bool checkWin(Cell disc) const;

        /**
         * Prints the board to the given output stream. 
         * Uses R for Red, Y for Yellow, . for Empty. 
         */
        void print(ostream& os = cout) const;

        /**
         * Retrieves the content of a cell at (row, col). 
         */
        Cell getCell(int row, int col) const; 

    private: 
        array<array<Cell, COLS>, ROWS> grid_;

        /**
         * Helper to check four-in-a-row starting from (r,c) in direction (dr, dc). 
         */
        bool checkDirection(int startRow, int startCol, int dr, int dc, Cell disc) const;
};