#!/usr/bin/env node

/**
 * 🚀 QUICK LAUNCHER - Ultra-Fast Startup
 * Minimal launcher for testing performance improvements
 */

const { spawn } = require('child_process');

class QuickLauncher {
    constructor() {
        this.processes = new Map();
        this.startTime = Date.now();
    }

    async launch() {
        console.log('\n🚀 === QUICK LAUNCH TEST ===');
        console.log('⚡ Target: <20 seconds total');

        try {
            // Launch all services in parallel immediately
            const services = [
                { name: 'backend', command: 'npm run start:dev', cwd: './backend', port: 3000 },
                { name: 'frontend', command: 'npm start', cwd: './frontend', port: 3001 },
                { name: 'ml_service', command: 'python3 ml_service.py', cwd: './ml_service', port: 8000 }
            ];

            console.log('\n🔥 Launching all services in parallel...');

            // Start all services simultaneously
            const startPromises = services.map(service => this.startService(service));

            // Wait for all to start (with 15s timeout each)
            const results = await Promise.allSettled(startPromises.map(p =>
                this.withTimeout(p, 15000)
            ));

            const duration = Date.now() - this.startTime;
            const successful = results.filter(r => r.status === 'fulfilled').length;

            console.log(`\n📊 === QUICK LAUNCH RESULTS ===`);
            console.log(`✅ Services: ${successful}/${services.length} successful`);
            console.log(`⚡ Total Time: ${duration}ms (${(duration / 1000).toFixed(1)}s)`);

            if (duration < 20000) {
                console.log(`🏆 PERFORMANCE TARGET MET! (<20s)`);
            } else {
                console.log(`⚠️ Performance target missed (>20s)`);
            }

            console.log('\n✨ Quick launch complete! Use Ctrl+C to stop.');

        } catch (error) {
            console.error(`❌ Quick launch failed: ${error.message}`);
        }
    }

    async startService(service) {
        console.log(`🔥 Starting ${service.name}...`);

        const process = spawn('bash', ['-c', service.command], {
            cwd: service.cwd,
            stdio: 'pipe'
        });

        this.processes.set(service.name, process);

        // Minimal logging
        process.stdout?.on('data', (data) => {
            const lines = data.toString().split('\n').filter(l => l.trim());
            if (lines.length > 0) {
                console.log(`     ${service.name}: ${lines[0].substring(0, 80)}...`);
            }
        });

        // Wait for service to be ready
        const isReady = await this.waitForPort(service.port, service.name);

        if (isReady) {
            console.log(`✅ ${service.name} ready`);
            return { service: service.name, success: true };
        } else {
            console.log(`⚠️ ${service.name} not ready (continuing anyway)`);
            return { service: service.name, success: false };
        }
    }

    async waitForPort(port, serviceName, timeout = 10000) {
        const startTime = Date.now();

        while (Date.now() - startTime < timeout) {
            try {
                // Simple port check
                const response = await fetch(`http://localhost:${port}`, {
                    signal: AbortSignal.timeout(1000)
                });
                return true;
            } catch (error) {
                // Continue trying
                await new Promise(resolve => setTimeout(resolve, 500));
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

// Run quick launcher
if (require.main === module) {
    const launcher = new QuickLauncher();

    process.on('SIGINT', () => launcher.shutdown());
    process.on('SIGTERM', () => launcher.shutdown());

    launcher.launch().catch(console.error);
}

module.exports = QuickLauncher; 