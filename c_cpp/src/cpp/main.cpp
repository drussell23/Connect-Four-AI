#include <iostream>
#include <limits>
#include "Game.hpp"

using namespace std;

// Convert a Cell to a printable character.
char cellToChar(Cell c)
{
    switch (c)
    {
    case Cell::Empty:
        return '.';
    case Cell::Red:
        return 'R';
    case Cell::Yellow:
        return 'Y';
    }
    return '?';
}

// Print the board to stdout
template <typename GameType>
void printBoard(const GameType &game)
{
    cout << "\n  ";
    for (int c = 0; c < GameType::COLS; ++c)
    {
        cout << c << ' ';
    }
    cout << '\n';
    for (int r = 0; r < GameType::ROWS; ++r)
    {
        cout << r << ' ';
        for (int c = 0; c < GameType::COLS; ++c)
        {
            cout << cellToChar(game.getCell(r, c)) << ' ';
        }
        cout << '\n';
    }
    cout << endl;
}

int main()
{
    Game game;
    cout << "Welcome to Connect Four!" << endl;

    while (true)
    {
        printBoard(game);
        auto player = game.currentPlayer();

        cout << (player == Player::Red ? "Red" : "Yellow") << "'s turn. Enter column (0-)" << Game::COLS - 1 << "): ";

        int col;

        if (!(cin >> col))
        {
            cin.clear();
            cin.ignore(numeric_limits<streamsize>::max(), '\n');
            cout << "Invalid input. Please enter a number." << endl;
            continue;
        }

        if (!game.dropDisc(col))
        {
            cout << "Column full or out of range. Try again." << endl;
            continue;
        }

        // Check for win.
        if (game.checkWin(player))
        {
            printBoard(game);
            cout << (player == Player::Red ? "Red" : "Yellow") << " wins!" << endl;
            break;
        }

        // Check for draw.
        if (game.isDraw())
        {
            printBoard(game);
            cout << "It's a draw!" << endl;
            break;
        }

        // Switch turns.
        game.switchPlayer();
    }

    cout << "Game over. Thanks for playing!" << endl;
    return 0;
}