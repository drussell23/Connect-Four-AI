#include "Game.hpp"

Game::Game() : board_(ROWS, vector<Cell>(COLS, Cell::Empty)), currentPlayer_(Player::Red) {}

bool Game::dropDisc(int column)
{
    if (column < 0 || column >= COLS)
        return false;

    for (int row = ROWS - 1; row >= 0; --row)
    {
        if (board_[row][column] == Cell::Empty)
        {
            board_[row][column] = (currentPlayer_ == Player::Red ? Cell::Red : Cell::Yellow);
            return true;
        }
    }
    return false; // Column is full.
}

bool Game::checkWin(Player player) const
{
    for (int r = 0; r < ROWS; ++r)
    {
        for (int c = 0; c < COLS; ++c)
        {
            if (board_[r][c] != (player == Player::Red ? Cell::Red : Cell::Yellow))
                continue;

            // Check all four directions.
            if (isWinningSequence(r, c, 0, 1, player) || // Horizontal
                isWinningSequence(r, c, 1, 0, player) || // Vertical
                isWinningSequence(r, c, 1, 1, player) || // Diag down-right
                isWinningSequence(r, c, 1, -1, player))  // Diag down-left
            {
                return true;
            }
        }
    }
    return false;
}

bool Game::isWinningSequence(int startRow, int startCol, int deltaRow, int deltaCol, Player player) const {
    Cell target = (player == Player::Red ? Cell::Red : Cell::Yellow);
    int r = startRow;
    int c = startCol;

    for (int i = 0; i < 4; ++i) {
        if (r < 0 || r >= ROWS || c < 0 || c >= COLS)
            return false;

        if (board_[r][c] != target)
            return false;
        
        r += deltaRow;
        c += deltaCol;
    }
    return true;
}

bool Game::isDraw() const {
    for (int c = 0; c < COLS; ++c) {
        if (board_[0][c] == Cell::Empty) {
            return false;
        }
    }
    return true;
}

Player Game::currentPlayer() const {
    return currentPlayer_;
}

void Game::switchPlayer() {
    currentPlayer_ = (currentPlayer_ == Player::Red ? Player::Yellow : Player::Red);
}

void Game::reset() {
    for (auto &row : board_) {
        fill(row.begin(), row.end(), Cell::Empty);
    }
}

Cell Game::getCell(int row, int col) const {
    if (row < 0 || row >= ROWS || col < 0 || col >= COLS) {
        return Cell::Empty;
    }
    return board_[row][col];
}