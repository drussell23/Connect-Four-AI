/**
 * Offline Support Hook
 * Manages offline state and service worker registration
 */

import { useState, useEffect, useCallback, useRef } from 'react';

export interface OfflineState {
  isOnline: boolean;
  isServiceWorkerReady: boolean;
  isUpdateAvailable: boolean;
  offlineSince: Date | null;
  connectionQuality: 'excellent' | 'good' | 'poor' | 'offline';
  syncPending: boolean;
}

export interface OfflineConfig {
  enableBackgroundSync: boolean;
  enablePushNotifications: boolean;
  checkInterval: number;
  showUpdatePrompt: boolean;
}

const defaultConfig: OfflineConfig = {
  enableBackgroundSync: true,
  enablePushNotifications: false,
  checkInterval: 30000, // 30 seconds
  showUpdatePrompt: true
};

export function useOfflineSupport(config: Partial<OfflineConfig> = {}) {
  const finalConfig = { ...defaultConfig, ...config };
  const [state, setState] = useState<OfflineState>({
    isOnline: navigator.onLine,
    isServiceWorkerReady: false,
    isUpdateAvailable: false,
    offlineSince: null,
    connectionQuality: navigator.onLine ? 'good' : 'offline',
    syncPending: false
  });

  const swRegistration = useRef<ServiceWorkerRegistration | null>(null);
  const connectionCheckInterval = useRef<NodeJS.Timeout | null>(null);

  // Register service worker
  const registerServiceWorker = useCallback(async () => {
    if ('serviceWorker' in navigator) {
      try {
        const registration = await navigator.serviceWorker.register('/sw.js', {
          scope: '/'
        });

        swRegistration.current = registration;

        // Check for updates periodically
        setInterval(() => {
          registration.update();
        }, finalConfig.checkInterval);

        // Handle updates
        registration.addEventListener('updatefound', () => {
          const newWorker = registration.installing;
          if (newWorker) {
            newWorker.addEventListener('statechange', () => {
              if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
                setState(prev => ({ ...prev, isUpdateAvailable: true }));
              }
            });
          }
        });

        // Wait for service worker to be ready
        await navigator.serviceWorker.ready;
        setState(prev => ({ ...prev, isServiceWorkerReady: true }));

        console.log('Service Worker registered successfully');

        // Register background sync if supported
        if (finalConfig.enableBackgroundSync && 'sync' in registration) {
          try {
            await (registration as any).sync.register('sync-game-state');
            console.log('Background sync registered');
          } catch (error) {
            console.warn('Background sync registration failed:', error);
          }
        }

        return registration;
      } catch (error) {
        console.error('Service Worker registration failed:', error);
        return null;
      }
    }
    return null;
  }, [finalConfig.checkInterval, finalConfig.enableBackgroundSync]);

  // Check connection quality
  const checkConnectionQuality = useCallback(async () => {
    if (!navigator.onLine) {
      setState(prev => ({ ...prev, connectionQuality: 'offline' }));
      return;
    }

    try {
      const start = performance.now();
      const response = await fetch('/api/ping', { 
        method: 'HEAD',
        cache: 'no-cache'
      });
      const latency = performance.now() - start;

      let quality: OfflineState['connectionQuality'];
      if (!response.ok) {
        quality = 'poor';
      } else if (latency < 100) {
        quality = 'excellent';
      } else if (latency < 300) {
        quality = 'good';
      } else {
        quality = 'poor';
      }

      setState(prev => ({ ...prev, connectionQuality: quality }));
    } catch (error) {
      setState(prev => ({ ...prev, connectionQuality: 'poor' }));
    }
  }, []);

  // Handle online/offline events
  useEffect(() => {
    const handleOnline = () => {
      console.log('Connection restored');
      setState(prev => ({
        ...prev,
        isOnline: true,
        offlineSince: null,
        syncPending: true
      }));

      // Trigger background sync
      if (swRegistration.current && 'sync' in swRegistration.current) {
        (swRegistration.current as any).sync.register('sync-game-state');
      }

      // Check connection quality
      checkConnectionQuality();
    };

    const handleOffline = () => {
      console.log('Connection lost');
      setState(prev => ({
        ...prev,
        isOnline: false,
        offlineSince: new Date(),
        connectionQuality: 'offline'
      }));
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    // Check connection quality periodically
    connectionCheckInterval.current = setInterval(checkConnectionQuality, finalConfig.checkInterval);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      
      if (connectionCheckInterval.current) {
        clearInterval(connectionCheckInterval.current);
      }
    };
  }, [checkConnectionQuality, finalConfig.checkInterval]);

  // Initialize service worker
  useEffect(() => {
    registerServiceWorker();
  }, [registerServiceWorker]);

  // Update service worker
  const updateServiceWorker = useCallback(() => {
    if (swRegistration.current?.waiting) {
      // Tell waiting service worker to take control
      swRegistration.current.waiting.postMessage({ type: 'SKIP_WAITING' });
      
      // Reload once the new service worker takes control
      navigator.serviceWorker.addEventListener('controllerchange', () => {
        window.location.reload();
      });
    }
  }, []);

  // Cache game state
  const cacheGameState = useCallback(async (gameState: any) => {
    if (navigator.serviceWorker.controller) {
      const channel = new MessageChannel();
      const controller = navigator.serviceWorker.controller;

      return new Promise((resolve) => {
        channel.port1.onmessage = () => resolve(true);

        controller!.postMessage(
          { type: 'CACHE_GAME_STATE', data: gameState },
          [channel.port2]
        );
      });
    }
    return false;
  }, []);

  // Get cached game state
  const getCachedGameState = useCallback(async () => {
    if ('caches' in window) {
      try {
        const cache = await caches.open('connect4-game-state');
        const response = await cache.match('/api/game/current-state');
        
        if (response) {
          return await response.json();
        }
      } catch (error) {
        console.error('Failed to get cached game state:', error);
      }
    }
    return null;
  }, []);

  // Compute AI move offline
  const computeAiMoveOffline = useCallback(async (board: any[][], player: string) => {
    if (!navigator.serviceWorker.controller) {
      throw new Error('Service worker not available');
    }

    const controller = navigator.serviceWorker.controller;
    const channel = new MessageChannel();

    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error('AI computation timeout'));
      }, 10000);

      channel.port1.onmessage = (event) => {
        clearTimeout(timeout);
        if (event.data.type === 'AI_MOVE_RESULT') {
          resolve(event.data.move);
        } else {
          reject(new Error('AI computation failed'));
        }
      };

      controller!.postMessage(
        { type: 'COMPUTE_AI_MOVE', data: { board, player } },
        [channel.port2]
      );
    });
  }, []);

  // Check if app can work offline
  const canWorkOffline = useCallback(async () => {
    if (!state.isServiceWorkerReady) return false;

    // Check if critical assets are cached
    try {
      const cache = await caches.open('connect4-v1');
      const cachedUrls = await cache.keys();
      
      const criticalAssets = ['/', '/index.html', '/ai-worker.js'];
      return criticalAssets.every(url => 
        cachedUrls.some(req => req.url.includes(url))
      );
    } catch (error) {
      return false;
    }
  }, [state.isServiceWorkerReady]);

  // Prefetch AI models
  const prefetchAiModels = useCallback(async () => {
    if (navigator.serviceWorker.controller) {
      navigator.serviceWorker.controller.postMessage({
        type: 'PREFETCH_AI_MODELS'
      });
    }
  }, []);

  return {
    ...state,
    updateServiceWorker,
    cacheGameState,
    getCachedGameState,
    computeAiMoveOffline,
    canWorkOffline,
    prefetchAiModels,
    isOfflineReady: state.isServiceWorkerReady && !state.isUpdateAvailable
  };
}