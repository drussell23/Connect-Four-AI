/**
 * Offline Indicator Component
 * Shows connection status and offline capabilities
 */

import React, { useState, useEffect } from 'react';
import './OfflineIndicator.css';

interface OfflineIndicatorProps {
  isOnline: boolean;
  isConnected: boolean;
  connectionQuality: 'excellent' | 'good' | 'poor' | 'offline';
  syncPending: boolean;
  offlineMoveCount?: number;
  className?: string;
  position?: 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right';
  showDetails?: boolean;
}

export const OfflineIndicator: React.FC<OfflineIndicatorProps> = ({
  isOnline,
  isConnected,
  connectionQuality,
  syncPending,
  offlineMoveCount = 0,
  className = '',
  position = 'top-right',
  showDetails = false
}) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const [showToast, setShowToast] = useState(false);
  const [lastOnlineState, setLastOnlineState] = useState(isOnline);

  // Show toast on connection change
  useEffect(() => {
    if (isOnline !== lastOnlineState) {
      setShowToast(true);
      setLastOnlineState(isOnline);
      
      const timer = setTimeout(() => setShowToast(false), 3000);
      return () => clearTimeout(timer);
    }
  }, [isOnline, lastOnlineState]);

  const getStatusIcon = () => {
    if (!isOnline) return '📴';
    if (!isConnected) return '🔄';
    
    switch (connectionQuality) {
      case 'excellent': return '📶';
      case 'good': return '📶';
      case 'poor': return '📶';
      default: return '❌';
    }
  };

  const getStatusText = () => {
    if (!isOnline) return 'Offline Mode';
    if (!isConnected) return 'Connecting...';
    if (syncPending) return 'Syncing...';
    
    switch (connectionQuality) {
      case 'excellent': return 'Connected';
      case 'good': return 'Connected';
      case 'poor': return 'Poor Connection';
      default: return 'Connection Error';
    }
  };

  const getStatusColor = () => {
    if (!isOnline) return 'offline';
    if (!isConnected) return 'connecting';
    
    switch (connectionQuality) {
      case 'excellent': return 'excellent';
      case 'good': return 'good';
      case 'poor': return 'poor';
      default: return 'error';
    }
  };

  return (
    <>
      {/* Main Indicator */}
      <div 
        className={`offline-indicator ${position} ${className} status-${getStatusColor()}`}
        onClick={() => showDetails && setIsExpanded(!isExpanded)}
        role="button"
        aria-label="Connection status"
        aria-expanded={isExpanded}
      >
        <div className="indicator-content">
          <span className="status-icon" aria-hidden="true">
            {getStatusIcon()}
          </span>
          <span className="status-text">
            {getStatusText()}
          </span>
          {syncPending && (
            <span className="sync-spinner" aria-label="Syncing">
              <span className="spinner"></span>
            </span>
          )}
          {offlineMoveCount > 0 && (
            <span className="offline-badge" aria-label={`${offlineMoveCount} offline moves`}>
              {offlineMoveCount}
            </span>
          )}
        </div>

        {/* Expanded Details */}
        {showDetails && isExpanded && (
          <div className="indicator-details">
            <div className="detail-row">
              <span className="detail-label">Status:</span>
              <span className="detail-value">{getStatusText()}</span>
            </div>
            <div className="detail-row">
              <span className="detail-label">Connection:</span>
              <span className="detail-value">{connectionQuality}</span>
            </div>
            {offlineMoveCount > 0 && (
              <div className="detail-row">
                <span className="detail-label">Offline Moves:</span>
                <span className="detail-value">{offlineMoveCount}</span>
              </div>
            )}
            <div className="detail-info">
              {!isOnline ? (
                <>
                  <p>You're playing offline. Your moves will sync when you reconnect.</p>
                  <p>AI moves are computed locally.</p>
                </>
              ) : connectionQuality === 'poor' ? (
                <p>Connection is unstable. Game will continue offline if disconnected.</p>
              ) : (
                <p>Connected to game server.</p>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Connection Change Toast */}
      {showToast && (
        <div className={`connection-toast ${isOnline ? 'online' : 'offline'}`}>
          <span className="toast-icon">
            {isOnline ? '✅' : '📴'}
          </span>
          <span className="toast-message">
            {isOnline ? 'Back online!' : 'You are offline'}
          </span>
        </div>
      )}

      {/* Sync Progress Bar */}
      {syncPending && (
        <div className="sync-progress">
          <div className="sync-progress-bar">
            <div className="sync-progress-fill"></div>
          </div>
        </div>
      )}
    </>
  );
};

// Simplified version for minimal UI
export const MinimalOfflineIndicator: React.FC<{
  isOffline: boolean;
  className?: string;
}> = ({ isOffline, className = '' }) => {
  if (!isOffline) return null;

  return (
    <div className={`minimal-offline-indicator ${className}`}>
      <span className="offline-dot"></span>
      <span>Offline</span>
    </div>
  );
};

// Connection quality bars component
export const ConnectionQualityBars: React.FC<{
  quality: 'excellent' | 'good' | 'poor' | 'offline';
  size?: 'small' | 'medium' | 'large';
}> = ({ quality, size = 'medium' }) => {
  const getBars = () => {
    switch (quality) {
      case 'excellent': return [true, true, true, true];
      case 'good': return [true, true, true, false];
      case 'poor': return [true, true, false, false];
      case 'offline': return [false, false, false, false];
    }
  };

  const bars = getBars();

  return (
    <div className={`connection-bars ${size}`} aria-label={`Connection: ${quality}`}>
      {bars.map((active, index) => (
        <div 
          key={index}
          className={`bar ${active ? 'active' : 'inactive'}`}
          style={{ height: `${(index + 1) * 25}%` }}
        />
      ))}
    </div>
  );
};

// Offline capabilities badge
export const OfflineCapabilitiesBadge: React.FC<{
  canWorkOffline: boolean;
  isServiceWorkerReady: boolean;
  hasOfflineAI: boolean;
}> = ({ canWorkOffline, isServiceWorkerReady, hasOfflineAI }) => {
  const capabilities = [
    { label: 'Offline Play', enabled: canWorkOffline },
    { label: 'Service Worker', enabled: isServiceWorkerReady },
    { label: 'Offline AI', enabled: hasOfflineAI }
  ];

  const enabledCount = capabilities.filter(c => c.enabled).length;

  return (
    <div className="offline-capabilities-badge">
      <div className="capabilities-summary">
        <span className="capabilities-icon">
          {enabledCount === capabilities.length ? '✅' : '⚡'}
        </span>
        <span className="capabilities-text">
          {enabledCount}/{capabilities.length} Offline Features
        </span>
      </div>
      <div className="capabilities-list">
        {capabilities.map((cap, index) => (
          <div key={index} className="capability-item">
            <span className={`capability-status ${cap.enabled ? 'enabled' : 'disabled'}`}>
              {cap.enabled ? '✓' : '✗'}
            </span>
            <span className="capability-label">{cap.label}</span>
          </div>
        ))}
      </div>
    </div>
  );
};