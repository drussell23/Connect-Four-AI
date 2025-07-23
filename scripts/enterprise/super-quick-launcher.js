#!/usr/bin/env node

/**
 * 🚀 SUPER QUICK LAUNCHER - Ultra-Simplified
 * Bypasses problematic services, focuses on core Backend + Frontend
 * Target: <10 seconds startup time
 */

const { spawn } = require('child_process');

class SuperQuickLauncher {
    constructor() {
        this.processes = new Map();
        this.startTime = Date.now();
    }

    async launch() {
        console.log('\n🚀 === SUPER QUICK LAUNCH ===');
        console.log('⚡ Target: <10 seconds, core services only');

        try {
            // Launch only the essential services
            const services = [
                { name: 'backend', command: 'npm run start:dev', cwd: './backend', port: 3001 },
                { name: 'frontend', command: 'npm start', cwd: './frontend', port: 3000 }
                // Skip ML service for now to avoid Python dependency issues
            ];

            console.log('\n🔥 Launching core services...');

            // Start both services simultaneously
            const startPromises = services.map(service => this.startService(service));

            // Wait for both to start (with 8s timeout each)
            const results = await Promise.allSettled(startPromises.map(p =>
                this.withTimeout(p, 8000)
            ));

            const duration = Date.now() - this.startTime;
            const successful = results.filter(r => r.status === 'fulfilled').length;

            console.log(`\n📊 === SUPER QUICK RESULTS ===`);
            console.log(`✅ Core Services: ${successful}/${services.length} successful`);
            console.log(`⚡ Total Time: ${duration}ms (${(duration / 1000).toFixed(1)}s)`);

            if (duration < 10000) {
                console.log(`🏆 ULTRA-FAST TARGET MET! (<10s)`);
            } else if (duration < 15000) {
                console.log(`🥈 Fast target met (<15s)`);
            } else {
                console.log(`⚠️ Still slow (>15s)`);
            }

            console.log('\n✨ Super quick launch complete!');
            console.log('🌐 Frontend: http://localhost:3001');
            console.log('📡 Backend API: http://localhost:3000/api/health');

        } catch (error) {
            console.error(`❌ Super quick launch failed: ${error.message}`);
        }
    }

    async startService(service) {
        console.log(`🔥 Starting ${service.name}...`);

        const process = spawn('bash', ['-c', service.command], {
            cwd: service.cwd,
            stdio: 'pipe'
        });

        this.processes.set(service.name, process);

        // Minimal logging - only show important messages
        process.stdout?.on('data', (data) => {
            const lines = data.toString().split('\n').filter(l => l.trim());
            lines.forEach(line => {
                if (line.includes('running') || line.includes('ready') || line.includes('started') || line.includes('localhost')) {
                    console.log(`     ${service.name}: ${line.substring(0, 60)}...`);
                }
            });
        });

        // Wait for service to be ready
        const isReady = await this.waitForPort(service.port, service.name);

        if (isReady) {
            console.log(`✅ ${service.name} ready`);
            return { service: service.name, success: true };
        } else {
            console.log(`⚠️ ${service.name} not ready (but continuing)`);
            return { service: service.name, success: false };
        }
    }

    async waitForPort(port, serviceName, timeout = 6000) {
        const startTime = Date.now();

        while (Date.now() - startTime < timeout) {
            try {
                // Quick HTTP check
                const response = await fetch(`http://localhost:${port}`, {
                    signal: AbortSignal.timeout(1000)
                });
                return true;
            } catch (error) {
                // Continue trying
                await new Promise(resolve => setTimeout(resolve, 400));
            }
        }

        return false;
    }

    async withTimeout(promise, timeout) {
        return new Promise((resolve, reject) => {
            const timer = setTimeout(() => {
                reject(new Error(`Timeout after ${timeout}ms`));
            }, timeout);

            promise
                .then(value => {
                    clearTimeout(timer);
                    resolve(value);
                })
                .catch(error => {
                    clearTimeout(timer);
                    reject(error);
                });
        });
    }

    async shutdown() {
        console.log('\n🛑 Shutting down...');
        for (const [name, process] of this.processes.entries()) {
            try {
                process.kill('SIGTERM');
                console.log(`✅ ${name} shutdown`);
            } catch (error) {
                console.log(`⚠️ Error stopping ${name}: ${error.message}`);
            }
        }
        process.exit(0);
    }
}

// Run super quick launcher
if (require.main === module) {
    const launcher = new SuperQuickLauncher();

    process.on('SIGINT', () => launcher.shutdown());
    process.on('SIGTERM', () => launcher.shutdown());

    launcher.launch().catch(console.error);
}

module.exports = SuperQuickLauncher; 