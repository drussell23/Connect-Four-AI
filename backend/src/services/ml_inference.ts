import fetch, { AbortController } from 'node-fetch';
import { EventEmitter } from 'events';

// Set up custom logging via EventEmitter
export const logger = new EventEmitter();
logger.on('info',  (...args) => console.log('[AI API INFO]',  ...args));
logger.on('warn',  (...args) => console.warn('[AI API WARN]',  ...args));
logger.on('error', (...args) => console.error('[AI API ERROR]', ...args));
logger.on('debug', (...args) => console.debug('[AI API DEBUG]', ...args));

/**
 * Two-channel Connect4 board mask: shape [2][6][7]
 */
export type Board2CH = number[][][];

/**
 * AI Prediction Service response shape
 */
export interface AIPrediction {
  move: number;
  probs: number[];
}

/**
 * Options for requests to the ML service
 */
export interface FetchOptions {
  baseUrl?: string;        // ML service base URL
  timeoutMs?: number;      // request timeout in ms
  maxRetries?: number;     // retry attempts on failure
  retryDelayMs?: number;   // initial retry delay
}

/**
 * Validate a two-channel 2×6×7 board mask
 */
function validateBoard2CH(board: unknown): asserts board is Board2CH {
  if (!Array.isArray(board) || board.length !== 2) {
    throw new TypeError('Board must be an array of length 2 (channels)');
  }
  board.forEach((plane, pi) => {
    if (!Array.isArray(plane) || plane.length !== 6) {
      throw new TypeError(`Channel ${pi} must have 6 rows`);
    }
    plane.forEach((row, ri) => {
      if (!Array.isArray(row) || row.length !== 7) {
        throw new TypeError(`Row ${ri} in channel ${pi} must have 7 columns`);
      }
      row.forEach((cell, ci) => {
        if (typeof cell !== 'number') {
          throw new TypeError(`Cell at [${pi}][${ri}][${ci}] must be a number`);
        }
      });
    });
  });
}

/**
 * Sleep for a duration
 */
function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Fetch with timeout support
 */
async function fetchWithTimeout(
  url: string,
  options: RequestInit,
  timeoutMs: number
): Promise<Response> {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } finally {
    clearTimeout(id);
  }
}

/**
 * Client for ML Prediction Service
 */
export class MLInferenceClient {
  private baseUrl: string;
  private timeoutMs: number;
  private maxRetries: number;
  private retryDelayMs: number;

  constructor(options: FetchOptions = {}) {
    this.baseUrl      = options.baseUrl     ?? process.env.ML_SERVICE_URL ?? 'http://localhost:8000';
    this.timeoutMs    = options.timeoutMs   ?? 5000;
    this.maxRetries   = options.maxRetries  ?? 3;
    this.retryDelayMs = options.retryDelayMs?? 200;
    logger.emit('info', 'MLInferenceClient initialized with:', {
      baseUrl: this.baseUrl,
      timeoutMs: this.timeoutMs,
      maxRetries: this.maxRetries,
      retryDelayMs: this.retryDelayMs
    });
  }

  /**
   * Request AI move via POST /predict with retries
   */
  async getAIMove(board2ch: Board2CH): Promise<AIPrediction> {
    validateBoard2CH(board2ch);
    const url = `${this.baseUrl}/predict`;
    const payload = JSON.stringify({ board: board2ch });
    let lastErr: unknown;

    for (let attempt = 1; attempt <= this.maxRetries + 1; attempt++) {
      const start = Date.now();
      try {
        logger.emit('info', `Attempt ${attempt} POST ${url}`);
        const res = await fetchWithTimeout(
          url,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: payload,
          },
          this.timeoutMs
        );
        logger.emit('debug', `HTTP status: ${res.status}`);
        if (!res.ok) {
          const text = await res.text();
          throw new Error(`HTTP ${res.status}: ${text}`);
        }
        const data = (await res.json()) as AIPrediction;
        if (typeof data.move !== 'number' || !Array.isArray(data.probs)) {
          throw new Error(`Invalid response structure: ${JSON.stringify(data)}`);
        }
        const elapsed = Date.now() - start;
        logger.emit('info', `Success in ${elapsed}ms, move=${data.move}`);
        return data;
      } catch (err: any) {
        const elapsed = Date.now() - start;
        lastErr = err;
        if (err.name === 'AbortError') {
          logger.emit('warn', `Request aborted after ${elapsed}ms`);
        } else {
          logger.emit('warn', `Error on attempt ${attempt}:`, err.message);
        }
        if (attempt <= this.maxRetries) {
          const delay = this.retryDelayMs * 2 ** (attempt - 1);
          logger.emit('info', `Retrying in ${delay}ms`);
          await sleep(delay);
        }
      }
    }
    logger.emit('error', `All ${this.maxRetries + 1} attempts failed`);
    throw lastErr;
  }

  /**
   * HEAD /predict health check
   */
  async healthCheck(): Promise<boolean> {
    const url = `${this.baseUrl}/predict`;
    try {
      logger.emit('info', `Health check (HEAD) ${url}`);
      const res = await fetchWithTimeout(url, { method: 'HEAD' }, this.timeoutMs);
      logger.emit('info', `Health check status: ${res.status}`);
      return res.ok;
    } catch (err) {
      logger.emit('error', 'Health check failed:', err);
      return false;
    }
  }
}

/**
 * Convenience function for game.service.ts
 * Wraps MLInferenceClient.getAIMove and returns only the move index.
 */
export async function getAIMoveViaAPI(
  board2ch: Board2CH,
  options?: FetchOptions
): Promise<number> {
  const client = new MLInferenceClient(options);
  const { move } = await client.getAIMove(board2ch);
  return move;
}

// Usage example:
// import { getAIMoveViaAPI, MLInferenceClient } from './ml_inference';
// const move = await getAIMoveViaAPI(board2ch);
// const client = new MLInferenceClient();
// const prediction = await client.getAIMove(board2ch);
// const healthy = await client.healthCheck();
