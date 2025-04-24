import fetch, { RequestInit } from 'node-fetch';
import AbortController from 'abort-controller';

export interface BoardState {
  board: ('Empty' | 'Red' | 'Yellow')[][];
}

export interface PredictResponse {
  move: number;
  probs: number[];
}

export class MLInferenceClient {
  private baseUrl: string;
  private timeoutMs: number;
  private maxRetries: number;
  private retryDelayMs: number;

  constructor({ baseUrl, timeoutMs = 5000, maxRetries = 3, retryDelayMs = 200 }: {
    baseUrl: string;
    timeoutMs?: number;
    maxRetries?: number;
    retryDelayMs?: number;
  }) {
    this.baseUrl = baseUrl;
    this.timeoutMs = timeoutMs;
    this.maxRetries = maxRetries;
    this.retryDelayMs = retryDelayMs;
  }

  async predict(boardState: BoardState): Promise<PredictResponse> {
    const url = `${this.baseUrl}/predict`;
    let attempt = 0;
    while (attempt < this.maxRetries) {
      attempt += 1;
      try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), this.timeoutMs);

        const init: RequestInit = {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(boardState),
          signal: controller.signal,
        };

        const response = await fetch(url, init);
        clearTimeout(timeout);

        if (!response.ok) {
          throw new Error(`HTTP ${response.status}`);
        }
        const data = (await response.json()) as PredictResponse;
        return data;
      } catch (err: any) {
        console.warn(`MLInferenceClient: Attempt ${attempt} failed: ${err.message}`);
        if (attempt >= this.maxRetries) {
          throw err;
        }
        await new Promise(res => setTimeout(res, this.retryDelayMs * Math.pow(2, attempt - 1)));
      }
    }
    // should never happen
    throw new Error('Max retries exceeded');
  }
}
