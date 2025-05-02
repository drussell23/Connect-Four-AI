#pragma once

#include <string>
#include "core/Board.hpp"

using namespace std;

/**
 * Player Interface
 *
 * Abstract base class for any Connect-4 player (human, AI, etc.).
 */
class Player {
public:
    virtual ~Player() = default;

    /**
     * Decide next move based on the current board state.
     * @param board The game board.
     * @return Column index (0-based) where to drop the disc.
     */
    virtual int getMove(const Board &board) = 0;

    /**
     * Get this player's disc type.
     * @return 'R' for Red or 'Y' for Yellow
     */
    virtual char getDisc() const = 0;

    /**
     * (Optional) Provide a name for logging or prompts.
     * @return Player name or identifier
     */
    virtual string getName() const { return ""; }
};
