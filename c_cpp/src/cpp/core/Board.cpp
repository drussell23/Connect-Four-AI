#include "Board.hpp"

Board::Board() {
    reset();
}

void Board::reset() {
    for (int r = 0; r < ROWS; r++) {
        for (int c = 0; c < COLS; c++) {
            grid_[r][c] = Cell::Empty;
        }
    }
}

bool Board::isFull() const {
    for (int c = 0; c < COLS; c++) {
        if (!isColumnFull(c))
            return false;
    }
    return true;
}

bool Board::isColumnFull(int col) const {
    return grid_[0][col] != Cell::Empty;
}

int Board::dropDisc(int col, Cell disc) {
    if (col < 0 || col >= COLS)
        return -1;

    for (int r = ROWS - 1; r >= 0; r--) {
        if (grid_[r][col] == Cell::Empty) {
            grid_[r][col] = disc;
            return r;
        }
    }
    return -1; // Column full.
}

bool Board::checkDirection(int startRow, int startCol, int dr, int dc, Cell disc) const {
    for (int i = 0; i < 4; i++) {
        int r = startRow + dr * i;
        int c = startCol + dc * i;

        if (r < 0 || r >= ROWS || c < 0 || c >= COLS) 
            return false;

        if (grid_[r][c] != disc) 
            return false;
    }
    return true;
}

bool Board::checkWin(Cell disc) const { 
    // Horizontal, vertical, diagonal checks.
    for (int r = 0; r < ROWS; r++) {
        for (int c = 0; c < COLS; c++) {
            if (grid_[r][c] != disc)
                continue;
            
            // Horizontal 
            if (checkDirection(r, c, 0, 1, disc))
                return true; 
            
            // Vertical 
            if (checkDirection(r, c, 1, 0, disc))
                return true; 

            // Diagonal down-right
            if (checkDirection(r, c, 1, 1, disc))
                return true; 

            // Diagonal down-left 
            if (checkDirection(r, c, 1, -1, disc))
                return true; 
        }
    }
    return false;
}

void Board::print(ostream& os) const {
    for (int r = 0; r < ROWS; r++) {
        for (int c = 0; c < COLS; c++) {
            char ch;

            switch (grid_[r][c]) {
                case Cell::Red:
                    ch = 'R'; 
                    break;

                case Cell::Yellow:
                    ch = 'Y';
                    break;

                default:
                    ch = '.';
                    break;
            }
            os << ch << " ";
        }
        os << "\n";
    }
    // Column indices.
    for (int c = 0; c < COLS; c++) {
        os << c << " ";
    }
    os << "\n";
}

Cell Board::getCell(int row, int col) const {
    if (row < 0 || row >= ROWS || col < 0 || col >= COLS)
        return Cell::Empty;
    
    return grid_[row][col];
}