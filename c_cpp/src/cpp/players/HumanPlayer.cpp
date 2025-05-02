#include "players/HumanPlayer.hpp"

HumanPlayer::HumanPlayer(char disc, const std::string& name) : disc_(disc), name_(name) {}

int HumanPlayer::getMove(const Board& board) {
    int col = -1;
    while (true) {
        std::cout << name_ << " (" << disc_ << ") - Enter column [0-" << COLS-1 << "]: ";
        if (!(std::cin >> col)) {
            cin.clear();
            cin.ignore(numeric_limits<streamsize>::max(), '\n');
            cout << "Invalid input. Please enter a number.\n";
            continue;
        }
        if (col < 0 || col >= COLS) {
            cout << "Column out of range. Choose between 0 and " << COLS-1 << ".\n";
            continue;
        }
        if (board.isColumnFull(col)) {
            cout << "Column " << col << " is full. Try another.\n";
            continue;
        }
        break;
    }
    return col;
}

char HumanPlayer::getDisc() const {
    return disc_;
}
