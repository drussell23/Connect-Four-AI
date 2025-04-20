import React from 'react';

export interface ControlPanelProps {
  /**
   * Indicates whose turn it is: 'Red' or 'Yellow'.
   */
  currentPlayer: 'Red' | 'Yellow';
  /**
   * Optional status message (e.g., 'Red wins!', 'Draw').
   */
  statusMessage?: string;
  /**
   * Callback to start a new game.
   */
  onRestart: () => void;
}

/**
 * Control panel displaying current player, status, and restart button.
 */
export const ControlPanel: React.FC<ControlPanelProps> = ({ currentPlayer, statusMessage, onRestart }) => {
  const playerColorClass = currentPlayer === 'Red' ? 'text-red-500' : 'text-yellow-500';

  return (
    <div className="flex items-center justify-between bg-blue-700 p-4 rounded-lg mb-4">
      <div className="text-white text-lg">
        Current Turn: <span className={playerColorClass}>{currentPlayer}</span>
      </div>
      <button
        onClick={onRestart}
        className="px-4 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 focus:outline-none focus:ring-2 focus:ring-green-300"
      >
        Restart Game
      </button>
      {statusMessage && (
        <div className="text-white text-lg font-semibold">
          {statusMessage}
        </div>
      )}
    </div>
  );
};
