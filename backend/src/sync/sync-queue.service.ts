import { Injectable } from '@nestjs/common';

interface QueueItem {
  id: string;
  priority: number;
  data: any;
  timestamp: number;
}

@Injectable()
export class SyncQueueService {
  private queue: QueueItem[] = [];
  private processing: Set<string> = new Set();

  enqueue(item: any): void {
    const queueItem: QueueItem = {
      id: item.syncJobId || this.generateId(),
      priority: item.priority || 1,
      data: item,
      timestamp: Date.now()
    };

    this.queue.push(queueItem);
    this.queue.sort((a, b) => b.priority - a.priority || a.timestamp - b.timestamp);
  }

  dequeue(): any | null {
    const item = this.queue.shift();
    if (item) {
      this.processing.add(item.id);
      return item.data;
    }
    return null;
  }

  getBatch(size: number): any[] {
    const batch: any[] = [];
    
    while (batch.length < size && this.queue.length > 0) {
      const item = this.dequeue();
      if (item) {
        batch.push(item);
      }
    }
    
    return batch;
  }

  markComplete(id: string): void {
    this.processing.delete(id);
  }

  markFailed(id: string, requeue: boolean = false): void {
    this.processing.delete(id);
    
    if (requeue) {
      const item = this.queue.find(item => item.id === id);
      if (item) {
        item.priority = Math.max(0, item.priority - 1);
        this.enqueue(item.data);
      }
    }
  }

  size(): number {
    return this.queue.length;
  }

  isEmpty(): boolean {
    return this.queue.length === 0;
  }

  clear(): void {
    this.queue = [];
    this.processing.clear();
  }

  getQueueStats(): any {
    return {
      queued: this.queue.length,
      processing: this.processing.size,
      priorities: this.queue.reduce((acc, item) => {
        acc[item.priority] = (acc[item.priority] || 0) + 1;
        return acc;
      }, {} as Record<number, number>)
    };
  }

  private generateId(): string {
    return `queue_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
}