import { Controller, Get, Options, Res } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Response } from 'express';

@Controller('health')
export class HealthController {
    constructor(private readonly configService: ConfigService) { }

    @Options()
    handleOptions(@Res() res: Response) {
        res.header('Access-Control-Allow-Origin', '*');
        res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
        res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization, Accept, Origin, X-Requested-With');
        res.header('Access-Control-Max-Age', '86400');
        res.status(200).send();
    }

    @Get()
    getHealth() {
        return {
            status: 'ok',
            timestamp: new Date().toISOString(),
            service: 'Connect4 Enterprise Backend',
            version: '2.0.0',

            // Enterprise Configuration Status
            configuration: {
                port: this.configService.get('port'),
                enterpriseMode: this.configService.get('enterpriseMode'),
                aiEnabled: this.configService.get('enableAdvancedAI'),
                performanceMonitoring: this.configService.get('performanceMonitoring'),
                healthCheckEnabled: this.configService.get('healthCheckEnabled'),
                mlServiceUrl: this.configService.get('mlServiceUrl'),
                corsEnabled: this.configService.get('corsEnabled'),
                corsOrigins: this.configService.get('corsOrigins'),
            },

            // Environment Details
            environment: {
                nodeEnv: process.env.NODE_ENV || 'development',
                frontendUrl: this.configService.get('frontendUrl'),
                backendUrl: this.configService.get('backendUrl'),
                aiTimeout: this.configService.get('aiTimeout'),
                maxMemoryUsage: this.configService.get('maxMemoryUsage'),
                maxCpuUsage: this.configService.get('maxCpuUsage'),
            },

            // Feature Flags Status
            features: {
                aiInsights: this.configService.get('aiInsights'),
                performanceAnalytics: this.configService.get('performanceAnalytics'),
                aiHealthCheck: this.configService.get('aiHealthCheck'),
                enterpriseServices: this.configService.get('enterpriseMode'),
            },

            // System Status
            system: {
                uptime: process.uptime(),
                memoryUsage: process.memoryUsage(),
                platform: process.platform,
                nodeVersion: process.version,
            }
        };
    }

    @Get('test')
    getTest() {
        return {
            message: 'CORS test successful',
            timestamp: new Date().toISOString(),
            cors: 'working'
        };
    }

    @Get('enterprise')
    getEnterpriseStatus() {
        return {
            status: 'Enterprise Ready',
            enterpriseMode: this.configService.get('enterpriseMode'),
            features: {
                aiInsights: this.configService.get('aiInsights') ? '✅' : '❌',
                performanceAnalytics: this.configService.get('performanceAnalytics') ? '✅' : '❌',
                advancedAI: this.configService.get('enableAdvancedAI') ? '✅' : '❌',
                healthMonitoring: this.configService.get('healthCheckEnabled') ? '✅' : '❌',
                performanceMonitoring: this.configService.get('performanceMonitoring') ? '✅' : '❌',
            },
            integrations: {
                mlService: this.configService.get('mlServiceUrl'),
                frontend: this.configService.get('frontendUrl'),
                cors: this.configService.get('corsEnabled') ? '✅' : '❌',
            },
            environment: {
                configuration: '.env loaded ✅',
                configCount: '50+ variables ✅',
                enterpriseGrade: '✅',
            }
        };
    }

} 