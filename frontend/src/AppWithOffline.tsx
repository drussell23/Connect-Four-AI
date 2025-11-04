/**
 * Main App Component with Offline Support
 * Demonstrates integration of all offline components
 */

import React, { useState, useEffect } from 'react';
import './App.css';
import { useOfflineSupport } from './hooks/useOfflineSupport';
import { OfflineGameService } from './services/OfflineGameService';
import { GameStateManager, GameState, CellValue } from './services/GameStateManager';
import { 
  OfflineIndicator, 
  MinimalOfflineIndicator,
  ConnectionQualityBars,
  OfflineCapabilitiesBadge 
} from './components/OfflineIndicator';

// Game board component
const GameBoard: React.FC<{
  board: CellValue[][];
  onColumnClick: (column: number) => void;
  disabled: boolean;
}> = ({ board, onColumnClick, disabled }) => {
  return (
    <div className="game-board">
      {board.map((row, rowIndex) => (
        <div key={rowIndex} className="board-row">
          {row.map((cell, colIndex) => (
            <div
              key={colIndex}
              className={`board-cell ${cell.toLowerCase()}`}
              onClick={() => !disabled && onColumnClick(colIndex)}
            >
              {cell !== 'Empty' && (
                <div className={`piece ${cell.toLowerCase()}`} />
              )}
            </div>
          ))}
        </div>
      ))}
    </div>
  );
};

// Main App Component
function AppWithOffline() {
  const [gameService, setGameService] = useState<OfflineGameService | null>(null);
  const [gameState, setGameState] = useState<GameState | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showOfflineDetails, setShowOfflineDetails] = useState(false);
  
  // Use offline support hook
  const offline = useOfflineSupport({
    enableBackgroundSync: true,
    showUpdatePrompt: true
  });

  // Initialize game service
  useEffect(() => {
    const service = new OfflineGameService({
      enableOffline: true,
      autoReconnect: true
    });

    // Setup event listeners
    service.on('game:updated', (state) => {
      setGameState(state);
    });

    service.on('game:error', (error) => {
      setError(error.message);
    });

    service.on('connection:offline-mode', () => {
      console.log('Switched to offline mode');
    });

    service.on('sync:completed', ({ count }) => {
      console.log(`Synced ${count} moves`);
    });

    setGameService(service);
    setIsLoading(false);

    // Load last game if available
    loadLastGame(service);

    return () => {
      service.destroy();
    };
  }, []);

  // Register service worker
  useEffect(() => {
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('/sw.js').then(
        (registration) => {
          console.log('Service Worker registered:', registration.scope);
        },
        (error) => {
          console.error('Service Worker registration failed:', error);
        }
      );
    }
  }, []);

  // Load last game
  const loadLastGame = async (service: OfflineGameService) => {
    try {
      const { games: recentGames } = await service.getRecentGames();
      if (recentGames.length > 0 && recentGames[0].status === 'active') {
        const game = await service.loadGame(recentGames[0].id);
        if (game) {
          setGameState(game);
        }
      }
    } catch (error) {
      console.error('Failed to load last game:', error);
    }
  };

  // Handle new game
  const handleNewGame = async () => {
    if (!gameService) return;
    
    try {
      setIsLoading(true);
      const game = await gameService.createGame(20); // AI difficulty 20
      setGameState(game);
    } catch (error) {
      setError('Failed to create new game');
    } finally {
      setIsLoading(false);
    }
  };

  // Handle column click
  const handleColumnClick = async (column: number) => {
    if (!gameService || !gameState) return;
    if (gameState.status !== 'active' || gameState.currentPlayer !== 'Red') return;
    
    try {
      await gameService.makeMove(column);
    } catch (error) {
      setError('Invalid move');
    }
  };

  // Handle update prompt
  useEffect(() => {
    if (offline.isUpdateAvailable) {
      const shouldUpdate = window.confirm(
        'A new version is available! Update now?'
      );
      
      if (shouldUpdate) {
        offline.updateServiceWorker();
      }
    }
  }, [offline.isUpdateAvailable]);

  // Prefetch AI models when online
  useEffect(() => {
    if (offline.isOnline && offline.isServiceWorkerReady) {
      offline.prefetchAiModels();
    }
  }, [offline.isOnline, offline.isServiceWorkerReady]);

  if (isLoading) {
    return (
      <div className="app-loading">
        <div className="spinner"></div>
        <p>Loading Connect Four AI...</p>
      </div>
    );
  }

  return (
    <div className="App">
      {/* Offline Indicator */}
      <OfflineIndicator
        isOnline={offline.isOnline}
        isConnected={gameService?.isConnected || false}
        connectionQuality={offline.connectionQuality}
        syncPending={offline.syncPending}
        offlineMoveCount={gameState?.offlineMoves?.length || 0}
        showDetails={showOfflineDetails}
        position="top-right"
      />

      {/* Header */}
      <header className="app-header">
        <h1>Connect Four AI</h1>
        <div className="header-controls">
          <ConnectionQualityBars quality={offline.connectionQuality} size="medium" />
          <button 
            className="btn-settings"
            onClick={() => setShowOfflineDetails(!showOfflineDetails)}
          >
            ⚙️
          </button>
        </div>
      </header>

      {/* Main Game Area */}
      <main className="app-main">
        {error && (
          <div className="error-banner">
            {error}
            <button onClick={() => setError(null)}>✕</button>
          </div>
        )}

        {!gameState ? (
          <div className="welcome-screen">
            <h2>Welcome to Connect Four AI</h2>
            <p>Play against advanced AI that works offline!</p>
            <button className="btn-primary" onClick={handleNewGame}>
              Start New Game
            </button>
            
            <OfflineCapabilitiesBadge
              canWorkOffline={offline.isOfflineReady}
              isServiceWorkerReady={offline.isServiceWorkerReady}
              hasOfflineAI={true}
            />
          </div>
        ) : (
          <div className="game-container">
            {/* Game Status */}
            <div className="game-status">
              {gameState.status === 'active' ? (
                <>
                  <div className={`current-player ${gameState.currentPlayer.toLowerCase()}`}>
                    {gameState.currentPlayer}'s Turn
                  </div>
                  {gameState.currentPlayer === 'Yellow' && (
                    <div className="ai-thinking">
                      <span className="spinner-small"></span>
                      AI is thinking...
                    </div>
                  )}
                </>
              ) : (
                <div className="game-over">
                  {gameState.status === 'won' ? (
                    <h2>{gameState.winner} Wins!</h2>
                  ) : (
                    <h2>It's a Draw!</h2>
                  )}
                </div>
              )}
            </div>

            {/* Game Board */}
            <GameBoard
              board={gameState.board}
              onColumnClick={handleColumnClick}
              disabled={gameState.status !== 'active' || gameState.currentPlayer !== 'Red'}
            />

            {/* Game Controls */}
            <div className="game-controls">
              <button className="btn-secondary" onClick={handleNewGame}>
                New Game
              </button>
              
              {gameState.offlineMoves.length > 0 && (
                <div className="offline-moves-indicator">
                  <MinimalOfflineIndicator isOffline={true} />
                  <span>{gameState.offlineMoves.length} moves to sync</span>
                </div>
              )}
            </div>

            {/* Move History */}
            <div className="move-history">
              <h3>Move History</h3>
              <div className="moves-list">
                {gameState.moves.map((move, index) => (
                  <div 
                    key={index} 
                    className={`move-item ${move.player.toLowerCase()} ${!move.synced ? 'offline' : ''}`}
                  >
                    <span className="move-number">{index + 1}.</span>
                    <span className="move-player">{move.player}</span>
                    <span className="move-column">Column {move.column + 1}</span>
                    {!move.synced && <span className="offline-badge">📴</span>}
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="app-footer">
        <div className="footer-content">
          <p>Connect Four AI - Works Offline!</p>
          {offline.offlineSince && (
            <p className="offline-duration">
              Offline for {Math.round((Date.now() - offline.offlineSince.getTime()) / 60000)} minutes
            </p>
          )}
        </div>
      </footer>

      {/* Update Prompt */}
      {offline.isUpdateAvailable && (
        <div className="update-prompt">
          <p>A new version is available!</p>
          <button onClick={offline.updateServiceWorker}>Update Now</button>
        </div>
      )}
    </div>
  );
}

export default AppWithOffline;