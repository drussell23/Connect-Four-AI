#ifndef GAME_HPP
#define GAME_HPP

#include <vector>
#include <algorithm>

using namespace std;

// Represents a single cell on the board.
enum class Cell { Empty, Red, Yellow };
// Represents the current player.
enum class Player { Red, Yellow };

class Game {
    public: 
        static constexpr int ROWS = 6; 
        static constexpr int COLS = 7;

        // Constructor: initializes empty board and sets starting player.
        Game();

        // Attempts to drop a disc into the given column (0-based).
        // Returns true if successful, false if column is full or out of range. 
        bool dropDisc(int column);

        // Checks whether the specified player has a winning four-in-a-row.
        bool checkWin(Player player) const;

        // Returns true if the board is full and no winner (draw state).
        bool isDraw() const;

        // Returns the player whose turn it currently is.
        Player currentPlayer() const;

        // Switches the turn to the other player. 
        void switchPlayer();

        // Resets the game state to start a new match.
        void reset();

        // Gets the cell content at the given row/column.
        Cell getCell(int row, int col) const;
    
    private:
        vector<vector<Cell>> board_;
        Player currentPlayer_;

        // Helper: checks a line of 4 starting from (startRow, startCol) in direction (deltaRow, deltaCol).
        bool isWinningSequence(int startRow, int startCol, int deltaRow, int deltaCol, Player player) const;
};

#endif // GAME_HPP