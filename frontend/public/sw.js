/**
 * Connect Four Service Worker
 * Handles offline caching and background sync
 */

const CACHE_NAME = 'connect4-v1';
const AI_WORKER_CACHE = 'connect4-ai-v1';
const GAME_STATE_CACHE = 'connect4-game-state';

// Assets to cache for offline app shell
const urlsToCache = [
  '/',
  '/index.html',
  '/static/css/main.css',
  '/static/js/bundle.js',
  '/static/js/main.chunk.js',
  '/static/js/vendors~main.chunk.js',
  '/manifest.json',
  '/favicon.ico',
  '/logo192.png',
  '/logo512.png',
  // AI Worker files
  '/ai-worker.js',
  '/wasm/connect4-core.wasm'
];

// Install event - cache app shell
self.addEventListener('install', (event) => {
  console.log('[SW] Installing service worker...');
  
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => {
        console.log('[SW] Caching app shell');
        return cache.addAll(urlsToCache);
      })
      .then(() => {
        console.log('[SW] Skip waiting');
        return self.skipWaiting();
      })
  );
});

// Activate event - clean old caches
self.addEventListener('activate', (event) => {
  console.log('[SW] Activating service worker...');
  
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== CACHE_NAME && 
              cacheName !== AI_WORKER_CACHE && 
              cacheName !== GAME_STATE_CACHE) {
            console.log('[SW] Deleting old cache:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    }).then(() => {
      console.log('[SW] Claiming clients');
      return self.clients.claim();
    })
  );
});

// Fetch event - serve from cache when offline
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Handle API requests differently
  if (url.pathname.startsWith('/api')) {
    event.respondWith(handleApiRequest(request));
    return;
  }

  // Handle static assets
  event.respondWith(
    caches.match(request)
      .then((response) => {
        // Return cached version or fetch from network
        if (response) {
          return response;
        }

        return fetch(request).then((response) => {
          // Don't cache non-successful responses
          if (!response || response.status !== 200 || response.type !== 'basic') {
            return response;
          }

          // Clone the response
          const responseToCache = response.clone();

          // Cache the fetched response
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(request, responseToCache);
          });

          return response;
        });
      })
      .catch(() => {
        // Return offline fallback for navigation requests
        if (request.destination === 'document') {
          return caches.match('/index.html');
        }
      })
  );
});

// Handle API requests with offline fallback
async function handleApiRequest(request) {
  const url = new URL(request.url);
  
  // Game state endpoints that can work offline
  const offlineEndpoints = [
    '/api/game/ai-move',
    '/api/game/validate-move',
    '/api/game/check-winner',
    '/api/game/new'
  ];

  // Try network first
  try {
    const response = await fetch(request.clone());
    
    // Cache successful responses
    if (response.ok) {
      const cache = await caches.open(GAME_STATE_CACHE);
      cache.put(request, response.clone());
    }
    
    return response;
  } catch (error) {
    console.log('[SW] Network request failed, checking offline capabilities');
    
    // Check if this endpoint can be handled offline
    if (offlineEndpoints.some(endpoint => url.pathname.includes(endpoint))) {
      // Handle offline AI move
      if (url.pathname.includes('/api/game/ai-move')) {
        return handleOfflineAiMove(request);
      }
      
      // Return cached response if available
      const cachedResponse = await caches.match(request);
      if (cachedResponse) {
        return cachedResponse;
      }
    }
    
    // Return offline error response
    return new Response(
      JSON.stringify({ 
        error: 'Offline',
        message: 'This feature requires an internet connection'
      }),
      {
        status: 503,
        headers: { 'Content-Type': 'application/json' }
      }
    );
  }
}

// Handle offline AI moves
async function handleOfflineAiMove(request) {
  try {
    const body = await request.json();
    const { board, player } = body;
    
    // Send to AI worker for computation
    const move = await computeAiMoveOffline(board, player);
    
    return new Response(
      JSON.stringify({
        success: true,
        move,
        offline: true,
        message: 'Move computed offline'
      }),
      {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      }
    );
  } catch (error) {
    return new Response(
      JSON.stringify({
        error: 'Failed to compute move offline',
        message: error.message
      }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      }
    );
  }
}

// Compute AI move using local worker
async function computeAiMoveOffline(board, player) {
  // This will be handled by the AI worker we implemented
  // For now, return a simple heuristic move
  const validMoves = [];
  for (let col = 0; col < 7; col++) {
    if (board[0][col] === 'Empty') {
      validMoves.push(col);
    }
  }
  
  // Prefer center columns
  const centerCols = [3, 2, 4, 1, 5, 0, 6];
  for (const col of centerCols) {
    if (validMoves.includes(col)) {
      return col;
    }
  }
  
  return validMoves[0];
}

// Background sync for game state
self.addEventListener('sync', (event) => {
  console.log('[SW] Background sync triggered');
  
  if (event.tag === 'sync-game-state') {
    event.waitUntil(syncGameState());
  }
});

// Sync game state when online
async function syncGameState() {
  const cache = await caches.open(GAME_STATE_CACHE);
  const requests = await cache.keys();
  
  const syncPromises = requests
    .filter(request => request.method === 'POST' || request.method === 'PUT')
    .map(async (request) => {
      try {
        const response = await fetch(request.clone());
        if (response.ok) {
          // Remove from cache after successful sync
          await cache.delete(request);
        }
      } catch (error) {
        console.error('[SW] Sync failed for request:', request.url);
      }
    });
  
  await Promise.all(syncPromises);
}

// Message handling for AI worker communication
self.addEventListener('message', (event) => {
  const { type, data } = event.data;
  
  switch (type) {
    case 'CACHE_GAME_STATE':
      cacheGameState(data);
      break;
      
    case 'CLEAR_GAME_CACHE':
      clearGameCache();
      break;
      
    case 'COMPUTE_AI_MOVE':
      computeAiMove(data).then(move => {
        event.ports[0].postMessage({ type: 'AI_MOVE_RESULT', move });
      });
      break;
  }
});

// Cache game state for offline persistence
async function cacheGameState(gameState) {
  const cache = await caches.open(GAME_STATE_CACHE);
  const response = new Response(JSON.stringify(gameState));
  await cache.put('/api/game/current-state', response);
}

// Clear game cache
async function clearGameCache() {
  await caches.delete(GAME_STATE_CACHE);
}

// Advanced AI computation with WASM
async function computeAiMove(data) {
  // Import and use the AI worker we created
  if (self.AIWorker) {
    const result = await self.AIWorker.computeMove(data.board, data.player);
    return result.move;
  }
  
  // Fallback to simple heuristic
  return computeAiMoveOffline(data.board, data.player);
}

console.log('[SW] Service worker loaded');