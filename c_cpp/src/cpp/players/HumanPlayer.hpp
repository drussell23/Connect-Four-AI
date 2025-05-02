#pragma once

#include "Player.hpp"
#include "core/Board.hpp"

#include <limits>
#include <iostream>
#include <ios>
#include <string>

using namespace std;

/**
 * @brief HumanPlayer  
 * 
 * A console-based human player. Prompts the user to enter a column number (0-6)
 * and validates input against the current board state.
 */
class HumanPlayer : public Player {
    public:
        /**
         * Constructs a HumanPlayer with the given disc ('R' or 'Y'). 
         * @param disc The character representing this player's disc. 
         * @param name (optional) A name or prompt to display.
         */
        explicit HumanPlayer(char disc, const string& name = "Human");

        /**
         * Prompt the user for a move and return the chosen column index.
         * Keeps asking until a legal move is entered. 
         * @param board The current board state. 
         * @returns Column index (0-based) where the user wants to drop their disc. 
         */
        int getMove(const Board& board) override;

        /**
         * Get this player's disc character ('R' or 'Y'). 
         */
        char getDisc() const override;

    private: 
        char disc_; // 'R' or 'Y'
        string name_; // Player name or prompt identifier.
};