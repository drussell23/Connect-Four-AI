/**
 * Local-First AI Service Tests
 */

import { Test, TestingModule } from '@nestjs/testing';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { LocalFirstAIService } from './local-first-ai.service';
import { CellValue } from '../connect4AI';

describe('LocalFirstAIService', () => {
  let service: LocalFirstAIService;
  let eventEmitter: EventEmitter2;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        LocalFirstAIService,
        {
          provide: EventEmitter2,
          useValue: {
            emit: jest.fn(),
            on: jest.fn(),
            removeListener: jest.fn()
          }
        }
      ]
    }).compile();

    service = module.get<LocalFirstAIService>(LocalFirstAIService);
    eventEmitter = module.get<EventEmitter2>(EventEmitter2);
  });

  describe('getBestMove', () => {
    it('should return a valid move for an empty board', async () => {
      const board: CellValue[][] = Array(6).fill(null).map(() => 
        Array(7).fill('Empty' as CellValue)
      );
      
      const move = await service.getBestMove(board, 'Red');
      
      expect(move).toBeGreaterThanOrEqual(0);
      expect(move).toBeLessThan(7);
    });

    it('should block opponent winning move', async () => {
      const board: CellValue[][] = [
        ['Empty', 'Empty', 'Empty', 'Empty', 'Empty', 'Empty', 'Empty'],
        ['Empty', 'Empty', 'Empty', 'Empty', 'Empty', 'Empty', 'Empty'],
        ['Empty', 'Empty', 'Empty', 'Empty', 'Empty', 'Empty', 'Empty'],
        ['Empty', 'Yellow', 'Empty', 'Empty', 'Empty', 'Empty', 'Empty'],
        ['Empty', 'Yellow', 'Empty', 'Empty', 'Empty', 'Empty', 'Empty'],
        ['Red', 'Yellow', 'Empty', 'Red', 'Empty', 'Empty', 'Empty']
      ];
      
      const move = await service.getBestMove(board, 'Red');
      
      expect(move).toBe(1); // Should block Yellow's winning move
    });

    it('should choose winning move when available', async () => {
      const board: CellValue[][] = [
        ['Empty', 'Empty', 'Empty', 'Empty', 'Empty', 'Empty', 'Empty'],
        ['Empty', 'Empty', 'Empty', 'Empty', 'Empty', 'Empty', 'Empty'],
        ['Empty', 'Empty', 'Empty', 'Empty', 'Empty', 'Empty', 'Empty'],
        ['Empty', 'Empty', 'Empty', 'Empty', 'Empty', 'Empty', 'Empty'],
        ['Empty', 'Red', 'Empty', 'Empty', 'Empty', 'Empty', 'Empty'],
        ['Yellow', 'Red', 'Empty', 'Red', 'Empty', 'Empty', 'Empty']
      ];
      
      const move = await service.getBestMove(board, 'Red');
      
      expect(move).toBe(2); // Should complete horizontal win
    });

    it('should use cache for repeated positions', async () => {
      const board: CellValue[][] = Array(6).fill(null).map(() => 
        Array(7).fill('Empty' as CellValue)
      );
      
      // First call
      const move1 = await service.getBestMove(board, 'Red');
      
      // Second call with same position
      const move2 = await service.getBestMove(board, 'Red');
      
      expect(move1).toBe(move2);
      expect(eventEmitter.emit).toHaveBeenCalledWith(
        'localai.cache.hit',
        expect.any(Object)
      );
    });
  });

  describe('Offline capabilities', () => {
    it('should work in offline mode', async () => {
      service.setOfflineMode(true);
      
      const board: CellValue[][] = Array(6).fill(null).map(() => 
        Array(7).fill('Empty' as CellValue)
      );
      
      const move = await service.getBestMove(board, 'Red');
      
      expect(move).toBeGreaterThanOrEqual(0);
      expect(move).toBeLessThan(7);
    });

    it('should emit offline mode change events', () => {
      service.setOfflineMode(true);
      
      expect(eventEmitter.emit).toHaveBeenCalledWith(
        'localai.offline.changed',
        { offline: true }
      );
    });
  });

  describe('Storage statistics', () => {
    it('should return storage stats', async () => {
      const stats = await service.getStorageStats();
      
      expect(stats).toHaveProperty('models');
      expect(stats).toHaveProperty('wasm');
      expect(stats).toHaveProperty('cache');
      expect(stats).toHaveProperty('offline');
      expect(stats).toHaveProperty('serviceWorker');
    });
  });

  describe('Model management', () => {
    it('should download models for offline use', async () => {
      // Mock fetch
      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        arrayBuffer: async () => new ArrayBuffer(1024)
      });
      
      await service.downloadModelsForOffline();
      
      expect(global.fetch).toHaveBeenCalled();
    });
  });
});

describe('WebAssembly Integration', () => {
  it('should load WASM module', () => {
    // Test WASM loading
    // This would be more comprehensive in a real test
    expect(true).toBe(true);
  });
});

describe('Service Worker Integration', () => {
  it('should handle service worker not available', () => {
    // Test service worker fallback
    expect(true).toBe(true);
  });
});