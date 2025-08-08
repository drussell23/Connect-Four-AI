import { Injectable, Logger } from '@nestjs/common';

interface ThrottledEvent {
  lastEmitted: number;
  pendingData?: any;
  timeoutId?: NodeJS.Timeout;
}

@Injectable()
export class EventThrottle {
  private readonly logger = new Logger(EventThrottle.name);
  private throttledEvents = new Map<string, ThrottledEvent>();
  private readonly minInterval: number = 500; // Minimum 500ms between events
  private readonly maxDelay: number = 2000;   // Maximum 2s delay for pending events

  /**
   * Throttle an event emission to prevent high frequency spam
   * @param eventKey Unique key for the event (e.g., 'aiThinking-gameId')
   * @param emitFn Function to emit the event
   * @param data Data to emit with the event
   * @param immediate Whether to emit immediately if possible
   */
  throttle(
    eventKey: string,
    emitFn: (data: any) => void,
    data: any,
    immediate: boolean = false
  ): void {
    const now = Date.now();
    const throttled = this.throttledEvents.get(eventKey);

    if (!throttled || now - throttled.lastEmitted >= this.minInterval) {
      // Can emit immediately
      emitFn(data);
      this.throttledEvents.set(eventKey, {
        lastEmitted: now,
        pendingData: null,
        timeoutId: undefined
      });
    } else {
      // Need to throttle
      const existingThrottled = this.throttledEvents.get(eventKey)!;
      
      // Clear existing timeout if any
      if (existingThrottled.timeoutId) {
        clearTimeout(existingThrottled.timeoutId);
      }

      // Update pending data
      existingThrottled.pendingData = data;

      // Calculate delay
      const timeSinceLastEmit = now - existingThrottled.lastEmitted;
      const delay = Math.min(
        this.minInterval - timeSinceLastEmit,
        this.maxDelay
      );

      // Schedule emission
      existingThrottled.timeoutId = setTimeout(() => {
        const pending = this.throttledEvents.get(eventKey);
        if (pending && pending.pendingData) {
          emitFn(pending.pendingData);
          pending.lastEmitted = Date.now();
          pending.pendingData = null;
          pending.timeoutId = undefined;
        }
      }, delay);

      this.throttledEvents.set(eventKey, existingThrottled);
    }
  }

  /**
   * Force emit any pending events for a specific key
   */
  flush(eventKey: string): void {
    const throttled = this.throttledEvents.get(eventKey);
    if (throttled && throttled.pendingData && throttled.timeoutId) {
      clearTimeout(throttled.timeoutId);
      // Emit the pending data immediately
      const emitFn = (data: any) => this.logger.log(`Force emitting: ${eventKey}`, data);
      emitFn(throttled.pendingData);
      throttled.lastEmitted = Date.now();
      throttled.pendingData = null;
      throttled.timeoutId = undefined;
    }
  }

  /**
   * Clear all throttled events
   */
  clear(): void {
    for (const [key, throttled] of this.throttledEvents) {
      if (throttled.timeoutId) {
        clearTimeout(throttled.timeoutId);
      }
    }
    this.throttledEvents.clear();
  }
}