/**
 * Resource Manager - System Resource Allocation and Monitoring
 * 
 * This system manages CPU, memory, and GPU resources for AI components
 * with intelligent allocation, monitoring, and optimization.
 * 
 * Features:
 * - Real-time resource monitoring
 * - Intelligent resource allocation
 * - Component-specific resource limits
 * - Resource usage forecasting
 * - Automatic resource optimization
 * - Emergency resource management
 * - Resource usage analytics
 * - Memory leak detection
 * 
 * @author Connect4 AI Team
 */

import { Logger } from '@nestjs/common';
import { EventEmitter } from 'events';
import { performance } from 'perf_hooks';
import * as os from 'os';
import * as process from 'process';
import {
    ResourceUsage,
    ResourceLimits,
    ResourceAvailability,
    AIComponent,
    AIRequest,
    AIResponse
} from './interfaces';

export interface ResourceManagerConfig {
    // Resource limits
    limits: ResourceLimits;

    // Monitoring configuration
    monitoring: {
        interval: number;
        historySize: number;
        alertThresholds: {
            cpu: number;
            memory: number;
            gpu: number;
        };
        criticalThresholds: {
            cpu: number;
            memory: number;
            gpu: number;
        };
    };

    // Optimization settings
    optimization: {
        enabled: boolean;
        aggressiveMode: boolean;
        autoScaling: boolean;
        loadBalancing: boolean;
        predictiveAllocation: boolean;
    };

    // Safety settings
    safety: {
        emergencyMode: boolean;
        killUnresponsive: boolean;
        maxResourceWait: number;
        memoryLeakDetection: boolean;
        resourceQuarantine: boolean;
    };

    // Performance settings
    performance: {
        cachingEnabled: boolean;
        batchProcessing: boolean;
        priorityScheduling: boolean;
        resourcePooling: boolean;
    };
}

export interface ResourceAllocation {
    componentName: string;
    resourceType: 'cpu' | 'memory' | 'gpu';
    allocated: number;
    used: number;
    limit: number;
    timestamp: number;

    // Allocation metadata
    priority: number;
    duration: number;
    requestId?: string;

    // Performance data
    efficiency: number;
    wastedResources: number;
}

export interface ResourceForecast {
    timeHorizon: number;
    predictions: {
        cpu: number;
        memory: number;
        gpu: number;
    };
    confidence: number;

    // Forecasting details
    trends: {
        cpu: 'increasing' | 'decreasing' | 'stable';
        memory: 'increasing' | 'decreasing' | 'stable';
        gpu: 'increasing' | 'decreasing' | 'stable';
    };

    // Recommendations
    recommendations: {
        scaleUp?: boolean;
        scaleDown?: boolean;
        optimize?: boolean;
        redistribute?: boolean;
    };
}

export interface ResourceMetrics {
    current: ResourceUsage;
    peak: ResourceUsage;
    average: ResourceUsage;

    // Historical data
    history: ResourceUsage[];

    // Allocation tracking
    allocations: ResourceAllocation[];

    // Performance metrics
    performance: {
        allocationTime: number;
        deallocationTime: number;
        fragmentationLevel: number;
        efficiency: number;
    };

    // Health indicators
    health: {
        memoryLeaks: number;
        resourceContention: number;
        allocationFailures: number;
        criticalEvents: number;
    };
}

export interface ResourcePool {
    type: 'cpu' | 'memory' | 'gpu';
    total: number;
    available: number;
    reserved: number;

    // Pool management
    chunks: Array<{
        id: string;
        size: number;
        allocated: boolean;
        component?: string;
        timestamp: number;
    }>;

    // Pool statistics
    stats: {
        utilization: number;
        fragmentation: number;
        allocations: number;
        deallocations: number;
        failures: number;
    };
}

/**
 * Resource Manager - System Resource Management
 */
export class ResourceManager extends EventEmitter {
    private readonly logger = new Logger(ResourceManager.name);
    private readonly config: ResourceManagerConfig;

    // Resource tracking
    private currentUsage: ResourceUsage = {
        cpuUsage: 0,
        memoryUsage: 0,
        gpuUsage: 0,
        activeComponents: 0
    };

    private resourceHistory: ResourceUsage[] = [];
    private allocations = new Map<string, ResourceAllocation>();

    // Resource pools
    private resourcePools = new Map<string, ResourcePool>();

    // Component tracking
    private componentResources = new Map<string, {
        cpu: number;
        memory: number;
        gpu: number;
        timestamp: number;
    }>();

    // Monitoring
    private monitoringInterval?: NodeJS.Timeout;
    private optimizationInterval?: NodeJS.Timeout;

    // State management
    private isInitialized = false;
    private emergencyMode = false;
    private resourceRequests = new Map<string, {
        request: AIRequest;
        timestamp: number;
        priority: number;
    }>();

    // Performance tracking for TODOs
    private allocationStartTimes = new Map<string, number>();
    private totalAllocationTime = 0;
    private totalDeallocationTime = 0;
    private allocationCount = 0;
    private deallocationCount = 0;
    private allocationFailures = 0;
    private criticalEvents = 0;

    constructor(config: Partial<ResourceManagerConfig> = {}) {
        super();

        this.config = {
            limits: {
                maxCpuUsage: 80,
                maxMemoryUsage: 2048,
                maxGpuUsage: 90,
                maxConcurrentAI: 5,
                ...config.limits
            },
            monitoring: {
                interval: 1000,
                historySize: 3600,
                alertThresholds: {
                    cpu: 70,
                    memory: 1536,
                    gpu: 70
                },
                criticalThresholds: {
                    cpu: 90,
                    memory: 1792,
                    gpu: 95
                },
                ...config.monitoring
            },
            optimization: {
                enabled: true,
                aggressiveMode: false,
                autoScaling: true,
                loadBalancing: true,
                predictiveAllocation: true,
                ...config.optimization
            },
            safety: {
                emergencyMode: true,
                killUnresponsive: true,
                maxResourceWait: 10000,
                memoryLeakDetection: true,
                resourceQuarantine: true,
                ...config.safety
            },
            performance: {
                cachingEnabled: true,
                batchProcessing: true,
                priorityScheduling: true,
                resourcePooling: true,
                ...config.performance
            }
        };
    }

    /**
     * Initialize the resource manager
     */
    async initialize(): Promise<void> {
        if (this.isInitialized) {
            this.logger.warn('Resource Manager already initialized');
            return;
        }

        try {
            this.logger.log('🔧 Initializing Resource Manager...');

            // Initialize resource pools
            await this.initializeResourcePools();

            // Start monitoring
            this.startResourceMonitoring();

            // Start optimization
            if (this.config.optimization.enabled) {
                this.startResourceOptimization();
            }

            // Initial resource check
            await this.updateResourceUsage();

            this.isInitialized = true;
            this.logger.log('✅ Resource Manager initialized');
            this.emit('initialized');

        } catch (error) {
            this.logger.error('❌ Failed to initialize Resource Manager:', error);
            throw error;
        }
    }

    /**
     * Check resource availability
     */
    async checkAvailability(): Promise<ResourceAvailability> {
        await this.updateResourceUsage();

        const cpu = this.currentUsage.cpuUsage;
        const memory = this.currentUsage.memoryUsage;
        const gpu = this.currentUsage.gpuUsage;
        const concurrent = this.currentUsage.activeComponents;

        // Check individual limits
        const cpuAvailable = cpu < this.config.limits.maxCpuUsage;
        const memoryAvailable = memory < this.config.limits.maxMemoryUsage;
        const gpuAvailable = gpu < this.config.limits.maxGpuUsage;
        const concurrentAvailable = concurrent < this.config.limits.maxConcurrentAI;

        const available = cpuAvailable && memoryAvailable && gpuAvailable && concurrentAvailable;

        let reason = '';
        if (!available) {
            const issues = [];
            if (!cpuAvailable) issues.push(`CPU usage ${cpu}% > ${this.config.limits.maxCpuUsage}%`);
            if (!memoryAvailable) issues.push(`Memory usage ${memory}MB > ${this.config.limits.maxMemoryUsage}MB`);
            if (!gpuAvailable) issues.push(`GPU usage ${gpu}% > ${this.config.limits.maxGpuUsage}%`);
            if (!concurrentAvailable) issues.push(`Concurrent AI ${concurrent} > ${this.config.limits.maxConcurrentAI}`);
            reason = issues.join(', ');
        }

        return {
            available,
            reason,
            details: {
                cpu: { available: cpuAvailable, current: cpu, limit: this.config.limits.maxCpuUsage },
                memory: { available: memoryAvailable, current: memory, limit: this.config.limits.maxMemoryUsage },
                gpu: { available: gpuAvailable, current: gpu, limit: this.config.limits.maxGpuUsage },
                concurrent: { available: concurrentAvailable, current: concurrent, limit: this.config.limits.maxConcurrentAI }
            }
        };
    }

    /**
     * Allocate resources for a component
     */
    async allocateResources(
        componentName: string,
        request: AIRequest,
        requirements: {
            cpu?: number;
            memory?: number;
            gpu?: number;
            priority?: number;
        }
    ): Promise<ResourceAllocation[]> {
        const allocations: ResourceAllocation[] = [];
        const timestamp = Date.now();
        const priority = requirements.priority || 1;
        
        // Track allocation start time
        const allocationStartTime = Date.now();
        this.allocationStartTimes.set(componentName, allocationStartTime);

        try {
            // Check availability first
            const availability = await this.checkAvailability();
            if (!availability.available) {
                throw new Error(`Resources not available: ${availability.reason}`);
            }

            // Allocate CPU
            if (requirements.cpu) {
                const cpuAllocation = await this.allocateCPU(componentName, requirements.cpu, priority);
                allocations.push(cpuAllocation);
            }

            // Allocate Memory
            if (requirements.memory) {
                const memoryAllocation = await this.allocateMemory(componentName, requirements.memory, priority);
                allocations.push(memoryAllocation);
            }

            // Allocate GPU
            if (requirements.gpu) {
                const gpuAllocation = await this.allocateGPU(componentName, requirements.gpu, priority);
                allocations.push(gpuAllocation);
            }

            // Track component resources
            this.componentResources.set(componentName, {
                cpu: requirements.cpu || 0,
                memory: requirements.memory || 0,
                gpu: requirements.gpu || 0,
                timestamp
            });

            // Update active component count
            this.currentUsage.activeComponents++;

            // Update allocation metrics
            const allocationTime = Date.now() - allocationStartTime;
            this.totalAllocationTime += allocationTime;
            this.allocationCount++;
            
            this.logger.debug(`Allocated resources for ${componentName}:`, requirements);
            this.emit('resources-allocated', componentName, allocations);

            return allocations;

        } catch (error) {
            // Track allocation failures
            this.allocationFailures++;
            this.logger.error(`Failed to allocate resources for ${componentName}:`, error);

            // Rollback any successful allocations
            for (const allocation of allocations) {
                await this.deallocateResource(allocation.componentName, allocation.resourceType);
            }

            throw error;
        }
    }

    /**
     * Allocate resources and execute a component
     */
    async allocateAndExecute(component: AIComponent, request: AIRequest): Promise<AIResponse> {
        // Allocate resources
        const allocations = await this.allocateResources(component.name, request, {
            memory: component.memoryLimit,
            priority: component.priority
        });

        try {
            // Execute the component
            const result = await component.execute!(request);

            return result;
        } finally {
            // Deallocate resources
            await this.deallocateResources(component.name);
        }
    }

    /**
     * Deallocate resources for a component
     */
    async deallocateResources(componentName: string): Promise<void> {
        const deallocationStartTime = Date.now();
        
        try {
            const componentResource = this.componentResources.get(componentName);
            if (!componentResource) {
                this.logger.warn(`No resources allocated for component ${componentName}`);
                return;
            }

            // Deallocate each resource type
            if (componentResource.cpu > 0) {
                await this.deallocateResource(componentName, 'cpu');
            }

            if (componentResource.memory > 0) {
                await this.deallocateResource(componentName, 'memory');
            }

            if (componentResource.gpu > 0) {
                await this.deallocateResource(componentName, 'gpu');
            }

            // Remove from tracking
            this.componentResources.delete(componentName);

            // Update active component count
            this.currentUsage.activeComponents = Math.max(0, this.currentUsage.activeComponents - 1);

            // Update deallocation metrics
            const deallocationTime = Date.now() - deallocationStartTime;
            this.totalDeallocationTime += deallocationTime;
            this.deallocationCount++;
            this.allocationStartTimes.delete(componentName);
            
            this.logger.debug(`Deallocated resources for ${componentName}`);
            this.emit('resources-deallocated', componentName);

        } catch (error) {
            // Track critical events
            this.criticalEvents++;
            this.logger.error(`Failed to deallocate resources for ${componentName}:`, error);
            throw error;
        }
    }

    /**
     * Get current resource usage
     */
    async getCurrentUsage(): Promise<ResourceUsage> {
        await this.updateResourceUsage();
        return { ...this.currentUsage };
    }

    async getCurrentResourceUsage(): Promise<ResourceUsage> {
        return await this.getCurrentUsage();
    }

    async getCpuUsage(): Promise<number> {
        return this.getCPUUsage();
    }

    async getMemoryUsage(): Promise<number> {
        return this.getMemoryUsageInternal();
    }

    async getGpuUsage(): Promise<number> {
        return this.getGPUUsage();
    }

    /**
     * Get resource metrics
     */
    async getMetrics(): Promise<ResourceMetrics> {
        await this.updateResourceUsage();

        // Calculate peak usage
        const peak: ResourceUsage = {
            cpuUsage: Math.max(...this.resourceHistory.map(r => r.cpuUsage)),
            memoryUsage: Math.max(...this.resourceHistory.map(r => r.memoryUsage)),
            gpuUsage: Math.max(...this.resourceHistory.map(r => r.gpuUsage)),
            activeComponents: Math.max(...this.resourceHistory.map(r => r.activeComponents))
        };

        // Calculate average usage
        const average: ResourceUsage = {
            cpuUsage: this.resourceHistory.reduce((sum, r) => sum + r.cpuUsage, 0) / this.resourceHistory.length,
            memoryUsage: this.resourceHistory.reduce((sum, r) => sum + r.memoryUsage, 0) / this.resourceHistory.length,
            gpuUsage: this.resourceHistory.reduce((sum, r) => sum + r.gpuUsage, 0) / this.resourceHistory.length,
            activeComponents: this.resourceHistory.reduce((sum, r) => sum + r.activeComponents, 0) / this.resourceHistory.length
        };

        return {
            current: this.currentUsage,
            peak,
            average,
            history: [...this.resourceHistory],
            allocations: Array.from(this.allocations.values()),
            performance: {
                allocationTime: this.allocationCount > 0 ? this.totalAllocationTime / this.allocationCount : 0,
                deallocationTime: this.deallocationCount > 0 ? this.totalDeallocationTime / this.deallocationCount : 0,
                fragmentationLevel: this.calculateFragmentation(),
                efficiency: this.calculateEfficiency()
            },
            health: {
                memoryLeaks: this.detectMemoryLeaks(),
                resourceContention: this.detectResourceContention(),
                allocationFailures: this.allocationFailures,
                criticalEvents: this.criticalEvents
            }
        };
    }

    /**
     * Get resource forecast
     */
    async getForecast(timeHorizon: number = 3600): Promise<ResourceForecast> {
        const predictions = this.predictResourceUsage(timeHorizon);
        const confidence = this.calculateForecastConfidence();

        return {
            timeHorizon,
            predictions,
            confidence,
            trends: this.analyzeTrends(),
            recommendations: this.generateRecommendations(predictions)
        };
    }

    /**
     * Optimize resource allocation
     */
    async optimizeResources(): Promise<void> {
        if (!this.config.optimization.enabled) {
            return;
        }

        try {
            this.logger.debug('Starting resource optimization...');

            // Detect inefficient allocations
            const inefficiencies = this.detectInefficiencies();

            // Apply optimizations
            for (const inefficiency of inefficiencies) {
                await this.applyOptimization(inefficiency);
            }

            // Rebalance allocations
            if (this.config.optimization.loadBalancing) {
                await this.rebalanceAllocations();
            }

            this.logger.debug('Resource optimization completed');
            this.emit('optimization-completed');

        } catch (error) {
            this.logger.error('Resource optimization failed:', error);
            this.emit('optimization-failed', error);
        }
    }

    /**
     * Initialize resource pools
     */
    private async initializeResourcePools(): Promise<void> {
        if (!this.config.performance.resourcePooling) {
            return;
        }

        // Initialize CPU pool
        this.resourcePools.set('cpu', {
            type: 'cpu',
            total: this.config.limits.maxCpuUsage,
            available: this.config.limits.maxCpuUsage,
            reserved: 0,
            chunks: [],
            stats: {
                utilization: 0,
                fragmentation: 0,
                allocations: 0,
                deallocations: 0,
                failures: 0
            }
        });

        // Initialize Memory pool
        this.resourcePools.set('memory', {
            type: 'memory',
            total: this.config.limits.maxMemoryUsage,
            available: this.config.limits.maxMemoryUsage,
            reserved: 0,
            chunks: [],
            stats: {
                utilization: 0,
                fragmentation: 0,
                allocations: 0,
                deallocations: 0,
                failures: 0
            }
        });

        // Initialize GPU pool
        this.resourcePools.set('gpu', {
            type: 'gpu',
            total: this.config.limits.maxGpuUsage,
            available: this.config.limits.maxGpuUsage,
            reserved: 0,
            chunks: [],
            stats: {
                utilization: 0,
                fragmentation: 0,
                allocations: 0,
                deallocations: 0,
                failures: 0
            }
        });
    }

    /**
     * Start resource monitoring
     */
    private startResourceMonitoring(): void {
        this.monitoringInterval = setInterval(async () => {
            try {
                await this.updateResourceUsage();
                await this.checkResourceAlerts();

                if (this.config.safety.memoryLeakDetection) {
                    this.detectMemoryLeaks();
                }

            } catch (error) {
                this.logger.error('Resource monitoring error:', error);
            }
        }, this.config.monitoring.interval);
    }

    /**
     * Start resource optimization
     */
    private startResourceOptimization(): void {
        this.optimizationInterval = setInterval(async () => {
            try {
                await this.optimizeResources();
            } catch (error) {
                this.logger.error('Resource optimization error:', error);
            }
        }, 30000); // Optimize every 30 seconds
    }

    /**
     * Update current resource usage
     */
    private async updateResourceUsage(): Promise<void> {
        const startTime = performance.now();

        try {
            // Get system CPU usage
            const cpuUsage = await this.getCPUUsage();

            // Get memory usage
            const memoryUsage = this.getMemoryUsageInternal();

            // Get GPU usage (mock for now)
            const gpuUsage = this.getGPUUsage();

            // Update current usage
            this.currentUsage = {
                cpuUsage,
                memoryUsage,
                gpuUsage,
                activeComponents: this.componentResources.size
            };

            // Add to history
            this.resourceHistory.push({
                ...this.currentUsage,
                timestamp: Date.now()
            } as any);

            // Trim history
            if (this.resourceHistory.length > this.config.monitoring.historySize) {
                this.resourceHistory.shift();
            }

            // Update resource pools
            if (this.config.performance.resourcePooling) {
                this.updateResourcePools();
            }

        } catch (error) {
            this.logger.error('Failed to update resource usage:', error);
        }
    }

    /**
     * Get CPU usage percentage
     */
    private async getCPUUsage(): Promise<number> {
        const cpus = os.cpus();
        const processUsage = process.cpuUsage();

        // Calculate CPU percentage (simplified)
        const totalCPU = cpus.length * 100;
        const usedCPU = (processUsage.user + processUsage.system) / 1000 / 10; // Convert to percentage

        return Math.min(100, Math.max(0, usedCPU));
    }

    /**
     * Get memory usage in MB
     */
    private getMemoryUsageInternal(): number {
        const memoryUsage = process.memoryUsage();
        return Math.round(memoryUsage.heapUsed / 1024 / 1024);
    }

    /**
     * Get GPU usage percentage (mock implementation)
     */
    private getGPUUsage(): number {
        // Mock GPU usage - in real implementation, would use nvidia-ml-py or similar
        return Math.random() * 30; // Mock low GPU usage
    }

    /**
     * Allocate CPU resources
     */
    private async allocateCPU(componentName: string, amount: number, priority: number): Promise<ResourceAllocation> {
        const allocation: ResourceAllocation = {
            componentName,
            resourceType: 'cpu',
            allocated: amount,
            used: 0,
            limit: amount,
            timestamp: Date.now(),
            priority,
            duration: 0,
            efficiency: 0,
            wastedResources: 0
        };

        this.allocations.set(`${componentName}-cpu`, allocation);

        return allocation;
    }

    /**
     * Allocate memory resources
     */
    private async allocateMemory(componentName: string, amount: number, priority: number): Promise<ResourceAllocation> {
        const allocation: ResourceAllocation = {
            componentName,
            resourceType: 'memory',
            allocated: amount,
            used: 0,
            limit: amount,
            timestamp: Date.now(),
            priority,
            duration: 0,
            efficiency: 0,
            wastedResources: 0
        };

        this.allocations.set(`${componentName}-memory`, allocation);

        return allocation;
    }

    /**
     * Allocate GPU resources
     */
    private async allocateGPU(componentName: string, amount: number, priority: number): Promise<ResourceAllocation> {
        const allocation: ResourceAllocation = {
            componentName,
            resourceType: 'gpu',
            allocated: amount,
            used: 0,
            limit: amount,
            timestamp: Date.now(),
            priority,
            duration: 0,
            efficiency: 0,
            wastedResources: 0
        };

        this.allocations.set(`${componentName}-gpu`, allocation);

        return allocation;
    }

    /**
     * Deallocate a specific resource
     */
    private async deallocateResource(componentName: string, resourceType: string): Promise<void> {
        const key = `${componentName}-${resourceType}`;
        this.allocations.delete(key);
    }

    /**
     * Check resource alerts
     */
    private async checkResourceAlerts(): Promise<void> {
        const thresholds = this.config.monitoring.alertThresholds;
        const critical = this.config.monitoring.criticalThresholds;

        // Check CPU
        if (this.currentUsage.cpuUsage > critical.cpu) {
            this.emit('resource-critical', 'cpu', this.currentUsage.cpuUsage);
        } else if (this.currentUsage.cpuUsage > thresholds.cpu) {
            this.emit('resource-limit-reached', 'cpu', this.currentUsage.cpuUsage);
        }

        // Check Memory
        if (this.currentUsage.memoryUsage > critical.memory) {
            this.emit('resource-critical', 'memory', this.currentUsage.memoryUsage);
        } else if (this.currentUsage.memoryUsage > thresholds.memory) {
            this.emit('resource-limit-reached', 'memory', this.currentUsage.memoryUsage);
        }

        // Check GPU
        if (this.currentUsage.gpuUsage > critical.gpu) {
            this.emit('resource-critical', 'gpu', this.currentUsage.gpuUsage);
        } else if (this.currentUsage.gpuUsage > thresholds.gpu) {
            this.emit('resource-limit-reached', 'gpu', this.currentUsage.gpuUsage);
        }
    }

    /**
     * Detect memory leaks
     */
    private detectMemoryLeaks(): number {
        if (this.resourceHistory.length < 10) {
            return 0;
        }

        // Check for consistent memory growth
        const recent = this.resourceHistory.slice(-10);
        const trend = recent.reduce((sum, usage, index) => {
            if (index === 0) return sum;
            return sum + (usage.memoryUsage - recent[index - 1].memoryUsage);
        }, 0);

        return trend > 50 ? 1 : 0; // 1 leak detected if growing by 50MB consistently
    }

    /**
     * Detect resource contention
     */
    private detectResourceContention(): number {
        const recent = this.resourceHistory.slice(-5);
        const highUsage = recent.filter(usage =>
            usage.cpuUsage > 80 || usage.memoryUsage > 1500 || usage.gpuUsage > 80
        );

        return highUsage.length;
    }

    /**
     * Calculate fragmentation level
     */
    private calculateFragmentation(): number {
        // Simplified fragmentation calculation
        return Math.random() * 0.3; // Mock fragmentation
    }

    /**
     * Calculate efficiency
     */
    private calculateEfficiency(): number {
        if (this.allocations.size === 0) {
            return 1.0;
        }

        const totalAllocated = Array.from(this.allocations.values())
            .reduce((sum, allocation) => sum + allocation.allocated, 0);

        const totalUsed = Array.from(this.allocations.values())
            .reduce((sum, allocation) => sum + allocation.used, 0);

        return totalAllocated > 0 ? totalUsed / totalAllocated : 1.0;
    }

    /**
     * Predict resource usage
     */
    private predictResourceUsage(timeHorizon: number): { cpu: number; memory: number; gpu: number } {
        if (this.resourceHistory.length < 5) {
            return {
                cpu: this.currentUsage.cpuUsage,
                memory: this.currentUsage.memoryUsage,
                gpu: this.currentUsage.gpuUsage
            };
        }

        // Simple linear prediction
        const recent = this.resourceHistory.slice(-5);
        const cpuTrend = (recent[4].cpuUsage - recent[0].cpuUsage) / 4;
        const memoryTrend = (recent[4].memoryUsage - recent[0].memoryUsage) / 4;
        const gpuTrend = (recent[4].gpuUsage - recent[0].gpuUsage) / 4;

        const futureSteps = timeHorizon / this.config.monitoring.interval;

        return {
            cpu: Math.max(0, Math.min(100, this.currentUsage.cpuUsage + cpuTrend * futureSteps)),
            memory: Math.max(0, this.currentUsage.memoryUsage + memoryTrend * futureSteps),
            gpu: Math.max(0, Math.min(100, this.currentUsage.gpuUsage + gpuTrend * futureSteps))
        };
    }

    /**
     * Calculate forecast confidence
     */
    private calculateForecastConfidence(): number {
        if (this.resourceHistory.length < 10) {
            return 0.3;
        }

        // Higher confidence with more stable usage patterns
        const recent = this.resourceHistory.slice(-10);
        const variance = this.calculateVariance(recent.map(r => r.cpuUsage));

        return Math.max(0.1, 1 - variance / 100);
    }

    /**
     * Analyze resource trends
     */
    private analyzeTrends(): { cpu: 'increasing' | 'decreasing' | 'stable'; memory: 'increasing' | 'decreasing' | 'stable'; gpu: 'increasing' | 'decreasing' | 'stable' } {
        if (this.resourceHistory.length < 5) {
            return { cpu: 'stable', memory: 'stable', gpu: 'stable' };
        }

        const recent = this.resourceHistory.slice(-5);

        const cpuTrend = recent[4].cpuUsage - recent[0].cpuUsage;
        const memoryTrend = recent[4].memoryUsage - recent[0].memoryUsage;
        const gpuTrend = recent[4].gpuUsage - recent[0].gpuUsage;

        return {
            cpu: cpuTrend > 5 ? 'increasing' : cpuTrend < -5 ? 'decreasing' : 'stable',
            memory: memoryTrend > 20 ? 'increasing' : memoryTrend < -20 ? 'decreasing' : 'stable',
            gpu: gpuTrend > 5 ? 'increasing' : gpuTrend < -5 ? 'decreasing' : 'stable'
        };
    }

    /**
     * Generate recommendations
     */
    private generateRecommendations(predictions: { cpu: number; memory: number; gpu: number }): any {
        const recommendations: any = {};

        if (predictions.cpu > 80 || predictions.memory > 1600 || predictions.gpu > 80) {
            recommendations.scaleUp = true;
        }

        if (predictions.cpu < 30 && predictions.memory < 500 && predictions.gpu < 30) {
            recommendations.scaleDown = true;
        }

        if (this.calculateEfficiency() < 0.7) {
            recommendations.optimize = true;
        }

        return recommendations;
    }

    /**
     * Calculate variance
     */
    private calculateVariance(values: number[]): number {
        const mean = values.reduce((sum, val) => sum + val, 0) / values.length;
        const variance = values.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / values.length;
        return variance;
    }

    /**
     * Detect inefficiencies
     */
    private detectInefficiencies(): Array<{ type: string; component: string; suggestion: string }> {
        const inefficiencies: Array<{ type: string; component: string; suggestion: string }> = [];

        for (const [key, allocation] of Array.from(this.allocations.entries())) {
            if (allocation.efficiency < 0.5) {
                inefficiencies.push({
                    type: 'low_efficiency',
                    component: allocation.componentName,
                    suggestion: `Reduce ${allocation.resourceType} allocation`
                });
            }
        }

        return inefficiencies;
    }

    /**
     * Apply optimization
     */
    private async applyOptimization(inefficiency: { type: string; component: string; suggestion: string }): Promise<void> {
        this.logger.debug(`Applying optimization: ${inefficiency.suggestion} for ${inefficiency.component}`);
        // Implementation would adjust resource allocations
    }

    /**
     * Rebalance allocations
     */
    private async rebalanceAllocations(): Promise<void> {
        // Implementation would redistribute resources among components
        this.logger.debug('Rebalancing resource allocations');
    }

    /**
     * Update resource pools
     */
    private updateResourcePools(): void {
        // Update pool utilization and statistics
        for (const [type, pool] of Array.from(this.resourcePools.entries())) {
            const totalAllocated = Array.from(this.allocations.values())
                .filter(alloc => alloc.resourceType === type)
                .reduce((sum, alloc) => sum + alloc.allocated, 0);

            pool.available = pool.total - totalAllocated;
            pool.stats.utilization = totalAllocated / pool.total;
        }
    }

    /**
     * Shutdown the resource manager
     */
    async shutdown(): Promise<void> {
        this.logger.log('🛑 Shutting down Resource Manager...');

        // Stop monitoring
        if (this.monitoringInterval) {
            clearInterval(this.monitoringInterval);
        }

        if (this.optimizationInterval) {
            clearInterval(this.optimizationInterval);
        }

        // Deallocate all resources
        for (const [componentName] of this.componentResources) {
            await this.deallocateResources(componentName);
        }

        // Clear all data
        this.allocations.clear();
        this.componentResources.clear();
        this.resourcePools.clear();
        this.resourceHistory = [];
        this.resourceRequests.clear();

        this.logger.log('✅ Resource Manager shutdown complete');
        this.emit('shutdown');
    }
} 