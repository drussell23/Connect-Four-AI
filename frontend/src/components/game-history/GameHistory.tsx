// frontend/src/components/game-history/GameHistory.tsx
import React, { useEffect, useState } from 'react';
import { 
  getGameHistory, 
  searchGames, 
  getGameReplay, 
  GameHistory as GameHistoryType,
  GameSearchFilters,
  GameReplay,
  GameSearchResult
} from '../../api/game-history';
import './GameHistory.css';

interface GameHistoryProps {
  playerId: string;
  isVisible: boolean;
  onClose: () => void;
}

const GameHistory: React.FC<GameHistoryProps> = ({ playerId, isVisible, onClose }) => {
  const [games, setGames] = useState<GameHistoryType[]>([]);
  const [searchResults, setSearchResults] = useState<GameSearchResult | null>(null);
  const [selectedGame, setSelectedGame] = useState<GameHistoryType | null>(null);
  const [gameReplay, setGameReplay] = useState<GameReplay | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [view, setView] = useState<'history' | 'search' | 'replay'>('history');
  const [searchFilters, setSearchFilters] = useState<GameSearchFilters>({});
  const [currentPage, setCurrentPage] = useState(1);

  useEffect(() => {
    if (isVisible && playerId) {
      loadGameHistory();
    }
  }, [isVisible, playerId]);

  const loadGameHistory = async () => {
    setLoading(true);
    setError(null);
    
    try {
      const data = await getGameHistory(playerId, 50);
      setGames(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load game history');
      console.error('Error loading game history:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = async () => {
    setLoading(true);
    setError(null);
    
    try {
      const results = await searchGames(searchFilters, currentPage, 20);
      setSearchResults(results);
      setView('search');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to search games');
      console.error('Error searching games:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleGameSelect = async (game: GameHistoryType) => {
    setSelectedGame(game);
    setLoading(true);
    setError(null);
    
    try {
      const replay = await getGameReplay(game.gameId);
      setGameReplay(replay);
      setView('replay');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load game replay');
      console.error('Error loading game replay:', err);
    } finally {
      setLoading(false);
    }
  };

  const getWinnerIcon = (winner: string) => {
    switch (winner) {
      case 'player': return '👤';
      case 'ai': return '🤖';
      case 'draw': return '🤝';
      default: return '❓';
    }
  };

  const getGameDuration = (duration: number) => {
    const minutes = Math.floor(duration / 60000);
    const seconds = Math.floor((duration % 60000) / 1000);
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  };

  const getGameQuality = (quality: string) => {
    switch (quality) {
      case 'high': return { color: '#2ecc71', icon: '⭐' };
      case 'medium': return { color: '#f39c12', icon: '➖' };
      case 'low': return { color: '#e74c3c', icon: '⚠️' };
      default: return { color: '#95a5a6', icon: '❓' };
    }
  };

  const renderGameList = (gameList: GameHistoryType[]) => (
    <div className="game-list">
      {gameList.map(game => {
        const quality = getGameQuality(game.gameMode);
        return (
          <div 
            key={game.gameId} 
            className="game-item"
            onClick={() => handleGameSelect(game)}
          >
            <div className="game-header">
              <div className="game-info">
                <span className="game-date">
                  {new Date(game.startTime).toLocaleDateString()}
                </span>
                <span className="game-time">
                  {new Date(game.startTime).toLocaleTimeString()}
                </span>
              </div>
              <div className="game-winner">
                {getWinnerIcon(game.winner)} {game.winner}
              </div>
            </div>
            
            <div className="game-details">
              <div className="game-stats">
                <span className="stat">Moves: {game.totalMoves}</span>
                <span className="stat">Duration: {getGameDuration(game.duration)}</span>
                <span className="stat">AI Level: {game.aiLevel}</span>
              </div>
              
              <div className="game-quality">
                <span 
                  className="quality-badge"
                  style={{ color: quality.color }}
                >
                  {quality.icon} {game.gameMode}
                </span>
              </div>
            </div>
            
            {game.tags.length > 0 && (
              <div className="game-tags">
                {game.tags.map(tag => (
                  <span key={tag} className="tag">{tag}</span>
                ))}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );

  const renderSearchFilters = () => (
    <div className="search-filters">
      <h3>Search Filters</h3>
      <div className="filters-grid">
        <div className="filter-group">
          <label>Winner:</label>
          <select 
            value={searchFilters.winner || ''} 
            onChange={e => setSearchFilters({...searchFilters, winner: e.target.value as any})}
          >
            <option value="">Any</option>
            <option value="player">Player</option>
            <option value="ai">AI</option>
            <option value="draw">Draw</option>
          </select>
        </div>
        
        <div className="filter-group">
          <label>Game Mode:</label>
          <input 
            type="text" 
            placeholder="e.g., standard, timed"
            value={searchFilters.gameMode || ''}
            onChange={e => setSearchFilters({...searchFilters, gameMode: e.target.value})}
          />
        </div>
        
        <div className="filter-group">
          <label>AI Level:</label>
          <input 
            type="text" 
            placeholder="e.g., beginner, expert"
            value={searchFilters.aiLevel || ''}
            onChange={e => setSearchFilters({...searchFilters, aiLevel: e.target.value})}
          />
        </div>
        
        <div className="filter-group">
          <label>Min Moves:</label>
          <input 
            type="number" 
            placeholder="0"
            value={searchFilters.minMoves || ''}
            onChange={e => setSearchFilters({...searchFilters, minMoves: parseInt(e.target.value) || undefined})}
          />
        </div>
        
        <div className="filter-group">
          <label>Max Moves:</label>
          <input 
            type="number" 
            placeholder="100"
            value={searchFilters.maxMoves || ''}
            onChange={e => setSearchFilters({...searchFilters, maxMoves: parseInt(e.target.value) || undefined})}
          />
        </div>
        
        <div className="filter-group">
          <label>Favorites Only:</label>
          <input 
            type="checkbox"
            checked={searchFilters.isFavorite || false}
            onChange={e => setSearchFilters({...searchFilters, isFavorite: e.target.checked})}
          />
        </div>
      </div>
      
      <button className="search-btn" onClick={handleSearch}>
        🔍 Search Games
      </button>
    </div>
  );

  const renderReplay = () => {
    if (!gameReplay || !selectedGame) return null;

    return (
      <div className="replay-view">
        <div className="replay-header">
          <h3>Game Replay</h3>
          <button onClick={() => setView('history')} className="back-btn">
            ← Back to History
          </button>
        </div>
        
        <div className="replay-info">
          <div className="replay-stats">
            <span>Total Moves: {gameReplay.statistics.totalMoves}</span>
            <span>Average Move Time: {Math.round(gameReplay.statistics.averageMoveTime)}ms</span>
            <span>Accuracy: {gameReplay.statistics.accuracyRate.toFixed(1)}%</span>
          </div>
        </div>
        
        <div className="replay-moves">
          <h4>Move History</h4>
          <div className="moves-list">
            {gameReplay.moves.map((move, index) => (
              <div key={index} className="move-item">
                <span className="move-number">{move.moveNumber}</span>
                <span className={`player-badge ${move.player}`}>
                  {move.player === 'ai' ? '🤖' : '👤'}
                </span>
                <span className="move-column">Column {move.column}</span>
                <span className="move-time">{move.timestamp}ms</span>
                {move.analysis && (
                  <span className={`move-quality ${move.analysis.quality}`}>
                    {move.analysis.quality}
                  </span>
                )}
              </div>
            ))}
          </div>
        </div>
        
        {gameReplay.highlights.length > 0 && (
          <div className="replay-highlights">
            <h4>Highlights</h4>
            <div className="highlights-list">
              {gameReplay.highlights.map((highlight, index) => (
                <div key={index} className="highlight-item">
                  <span className={`highlight-type ${highlight.type}`}>
                    {highlight.type}
                  </span>
                  <span className="highlight-move">Move {highlight.moveNumber}</span>
                  <span className="highlight-description">{highlight.description}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    );
  };

  if (!isVisible) return null;

  return (
    <div className="game-history-overlay">
      <div className="game-history-modal">
        <div className="game-history-header">
          <h2>Game History</h2>
          <button className="close-btn" onClick={onClose}>×</button>
        </div>

        <div className="game-history-nav">
          <button 
            className={`nav-btn ${view === 'history' ? 'active' : ''}`}
            onClick={() => setView('history')}
          >
            📚 History
          </button>
          <button 
            className={`nav-btn ${view === 'search' ? 'active' : ''}`}
            onClick={() => setView('search')}
          >
            🔍 Search
          </button>
          {selectedGame && (
            <button 
              className={`nav-btn ${view === 'replay' ? 'active' : ''}`}
              onClick={() => setView('replay')}
            >
              ▶️ Replay
            </button>
          )}
        </div>

        {loading && (
          <div className="loading-container">
            <div className="loading-spinner"></div>
            <p>Loading...</p>
          </div>
        )}

        {error && (
          <div className="error-container">
            <p className="error-message">⚠️ {error}</p>
            <button onClick={loadGameHistory} className="retry-btn">Retry</button>
          </div>
        )}

        <div className="game-history-content">
          {view === 'history' && !loading && !error && (
            <div className="history-view">
              <h3>Recent Games ({games.length})</h3>
              {games.length > 0 ? renderGameList(games) : (
                <div className="empty-state">
                  <p>📊 No games recorded yet</p>
                  <p style={{ fontSize: '14px', color: '#999', marginTop: '10px' }}>
                    Your game history will appear here after you complete your first game.
                    Each game is automatically saved when it ends (win, lose, or draw).
                  </p>
                </div>
              )}
            </div>
          )}

          {view === 'search' && !loading && !error && (
            <div className="search-view">
              {renderSearchFilters()}
              {searchResults && (
                <div className="search-results">
                  <h3>Search Results ({searchResults.total})</h3>
                  {searchResults.games.length > 0 ? renderGameList(searchResults.games) : (
                    <div className="empty-state">
                      <p>No games match your search criteria.</p>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {view === 'replay' && !loading && !error && renderReplay()}
        </div>
      </div>
    </div>
  );
};

export default GameHistory; 