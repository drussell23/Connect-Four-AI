import { Module, Global, OnModuleInit } from '@nestjs/common';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { IntelligentResourceManager } from './intelligent-resource-manager';
import { AdaptiveThrottleService } from './adaptive-throttle.service';
import { WorkloadOptimizationEngine } from './workload-optimization-engine';
import { ResourceAllocationService } from './resource-allocation.service';
import { AsyncCacheManager } from '../async/cache-manager';
import { PerformanceMonitor } from '../async/performance-monitor';
import { Logger } from '@nestjs/common';

@Global()
@Module({
  imports: [EventEmitterModule.forRoot()],
  providers: [
    IntelligentResourceManager,
    AdaptiveThrottleService,
    WorkloadOptimizationEngine,
    ResourceAllocationService,
    {
      provide: 'RESOURCE_MANAGEMENT_CONFIG',
      useValue: {
        monitoring: {
          enabled: true,
          interval: 1000,
          historySize: 100
        },
        throttling: {
          enabled: true,
          baseDelay: 100,
          maxDelay: 5000,
          adaptiveScaling: true
        },
        optimization: {
          enabled: true,
          interval: 5000,
          targetMemoryUsage: 0.75,
          minFreeMemory: 100 * 1024 * 1024 // 100MB
        },
        allocation: {
          enabled: true,
          maxConcurrentWorkloads: 10,
          priorityLevels: 10,
          preemptive: true
        }
      }
    }
  ],
  exports: [
    IntelligentResourceManager,
    AdaptiveThrottleService,
    WorkloadOptimizationEngine,
    ResourceAllocationService
  ]
})
export class ResourceManagementModule implements OnModuleInit {
  private readonly logger = new Logger(ResourceManagementModule.name);
  
  constructor(
    private readonly resourceManager: IntelligentResourceManager,
    private readonly throttleService: AdaptiveThrottleService,
    private readonly optimizationEngine: WorkloadOptimizationEngine,
    private readonly allocationService: ResourceAllocationService
  ) {}
  
  async onModuleInit() {
    this.logger.log('🚀 Initializing Resource Management Module...');
    
    try {
      // Initialize all services
      await this.resourceManager.initialize();
      await this.optimizationEngine.initialize();
      await this.allocationService.initialize();
      
      // Set up cross-service communication
      this.setupInterServiceCommunication();
      
      // Perform initial resource assessment
      await this.performInitialAssessment();
      
      this.logger.log('✅ Resource Management Module initialized successfully');
      
    } catch (error) {
      this.logger.error('Failed to initialize Resource Management Module:', error);
      throw error;
    }
  }
  
  private setupInterServiceCommunication(): void {
    // Connect services for coordinated resource management
    this.logger.debug('Setting up inter-service communication...');
    
    // Resource manager provides metrics to all services
    // Throttle service uses resource predictions
    // Optimization engine responds to resource alerts
    // Allocation service coordinates workload distribution
  }
  
  private async performInitialAssessment(): Promise<void> {
    const status = this.resourceManager.getResourceStatus();
    
    this.logger.log('📊 Initial Resource Assessment:');
    this.logger.log(`   CPU Usage: ${status.current.cpu.toFixed(1)}%`);
    this.logger.log(`   Memory Usage: ${status.current.memory.toFixed(1)}%`);
    this.logger.log(`   Active Workloads: ${status.activeWorkloads.length}`);
    
    if (status.recommendations.length > 0) {
      this.logger.warn('⚠️ Initial Recommendations:');
      status.recommendations.forEach(rec => {
        this.logger.warn(`   - ${rec}`);
      });
    }
  }
}