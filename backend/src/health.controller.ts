import { Controller, Get, Post, Inject, Logger } from '@nestjs/common';
import { GameService } from './game/game.service';

@Controller()
export class HealthController {
    private readonly logger = new Logger(HealthController.name);

    constructor(
        @Inject(GameService) private readonly gameService: GameService
    ) { }

    @Get('health')
    getHealth() {
        return {
            status: 'healthy',
            timestamp: new Date().toISOString(),
            uptime: process.uptime(),
            websocket: 'available',
            version: '1.0.0'
        };
    }

    @Get('api/health')
    getApiHealth() {
        return this.getHealth();
    }

    @Get('health/ready')
    getReadiness() {
        return {
            status: 'ready',
            timestamp: new Date().toISOString(),
            services: {
                websocket: 'ready',
                game: 'ready',
                ai: this.gameService.getAIHealthStatus()
            }
        };
    }

    @Get('health/live')
    getLiveness() {
        return {
            status: 'alive',
            timestamp: new Date().toISOString(),
            uptime: process.uptime(),
            memory: {
                used: Math.round(process.memoryUsage().heapUsed / 1024 / 1024),
                total: Math.round(process.memoryUsage().heapTotal / 1024 / 1024)
            }
        };
    }

    @Get('health/detailed')
    async getDetailedHealth() {
        try {
            const aiHealth = this.gameService.getAIHealthStatus();

            return {
                status: 'healthy',
                timestamp: new Date().toISOString(),
                uptime: process.uptime(),
                websocket: 'available',
                version: '1.0.0',
                ai: {
                    status: aiHealth.initialized ? 'ready' : 'initializing',
                    fallbackEnabled: aiHealth.fallbackEnabled,
                    retryCount: aiHealth.retryCount,
                    lastCheck: new Date().toISOString()
                },
                memory: {
                    used: Math.round(process.memoryUsage().heapUsed / 1024 / 1024),
                    total: Math.round(process.memoryUsage().heapTotal / 1024 / 1024)
                },
                environment: {
                    nodeVersion: process.version,
                    platform: process.platform,
                    arch: process.arch
                }
            };
        } catch (error) {
            this.logger.error(`❌ Detailed health check failed: ${error.message}`);
            return {
                status: 'unhealthy',
                error: error.message,
                timestamp: new Date().toISOString()
            };
        }
    }

    @Post('health/ai/retry')
    async retryAiInitialization() {
        try {
            this.logger.log('🔧 Manual AI initialization retry requested');
            const success = await this.gameService.retryAIInitialization();

            return {
                status: success ? 'success' : 'failed',
                timestamp: new Date().toISOString(),
                aiHealth: this.gameService.getAIHealthStatus()
            };
        } catch (error) {
            this.logger.error(`❌ AI retry failed: ${error.message}`);
            return {
                status: 'error',
                error: error.message,
                timestamp: new Date().toISOString()
            };
        }
    }

    @Get('health/ai/status')
    getAiStatus() {
        return {
            timestamp: new Date().toISOString(),
            ai: this.gameService.getAIHealthStatus()
        };
    }
} 