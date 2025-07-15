#!/usr/bin/env node

/**
 * 🚀 Smart Turbo Launcher with Enhanced Process Management
 * Bulletproof service management with intelligent conflict resolution
 * Integrates enhanced process manager with parallel launcher
 */

const { spawn, execSync } = require('child_process');
const path = require('path');
const EnhancedProcessManager = require('./enhanced-process-manager');

// Color constants
const colors = {
    red: '\x1b[31m',
    green: '\x1b[32m',
    yellow: '\x1b[33m',
    blue: '\x1b[34m',
    magenta: '\x1b[35m',
    cyan: '\x1b[36m',
    white: '\x1b[37m',
    reset: '\x1b[0m',
    bright: '\x1b[1m',
    gray: '\x1b[90m'
};

class SmartTurboLauncher {
    constructor() {
        this.processManager = new EnhancedProcessManager();
        this.processManager.logLevel = 'info';
    }

    log(message, color = colors.blue) {
        console.log(`${color}${message}${colors.reset}`);
    }

    error(message) {
        console.log(`${colors.red}❌ ${message}${colors.reset}`);
    }

    success(message) {
        console.log(`${colors.green}✅ ${message}${colors.reset}`);
    }

    warning(message) {
        console.log(`${colors.yellow}⚠️  ${message}${colors.reset}`);
    }

    /**
     * Pre-startup system preparation
     */
    async prepareSystem(force = false) {
        this.log('🔧 Preparing system for launch...', colors.bright + colors.cyan);

        // Step 1: System status check
        this.log('📊 Checking system status...', colors.cyan);
        const statusBefore = await this.processManager.getStatus();

        if (statusBefore.healthy) {
            this.success('System is already clean and ready');
            return true;
        }

        // Step 2: Enhanced cleanup
        this.log('🧹 Performing intelligent cleanup...', colors.cyan);
        const cleanupResult = await this.processManager.fullCleanup(force);

        if (!cleanupResult.success) {
            this.error('Failed to clean up system conflicts');
            this.log('💡 Try running with --force flag', colors.yellow);
            return false;
        }

        // Step 3: Final verification
        this.log('🔍 Verifying system cleanliness...', colors.cyan);
        const statusAfter = await this.processManager.getStatus();

        if (statusAfter.healthy) {
            this.success('✨ System prepared successfully');
            return true;
        } else {
            this.warning(`${statusAfter.conflicts} conflicts remain after cleanup`);
            return false;
        }
    }

    /**
     * Enhanced start with bulletproof process management
     */
    async smartStart(options = {}) {
        const {
            services = null,
            build = false,
            fast = false,
            force = false,
            skipPrep = false
        } = options;

        this.log('🚀 Starting Smart Turbo Launcher...', colors.bright + colors.magenta);

        // Pre-startup preparation
        if (!skipPrep) {
            const prepared = await this.prepareSystem(force);
            if (!prepared && !force) {
                this.error('System preparation failed. Use --force to override.');
                return false;
            }
        }

        // Build launcher arguments
        const launcherArgs = ['start'];
        if (services) launcherArgs.push(services);
        if (build) launcherArgs.push('--build');
        if (fast) launcherArgs.push('--fast');

        // Launch services
        this.log('🎯 Launching services with parallel launcher...', colors.cyan);

        try {
            const launcherPath = path.join(__dirname, 'parallel-launcher.js');
            const child = spawn('node', [launcherPath, ...launcherArgs], {
                stdio: 'inherit',
                cwd: path.dirname(__dirname)
            });

            // Handle launcher process
            return new Promise((resolve, reject) => {
                child.on('exit', (code) => {
                    if (code === 0) {
                        this.success('🎉 Services launched successfully');
                        resolve(true);
                    } else {
                        this.error(`Service launcher failed with code ${code}`);
                        resolve(false);
                    }
                });

                child.on('error', (error) => {
                    this.error(`Launcher error: ${error.message}`);
                    reject(error);
                });
            });

        } catch (error) {
            this.error(`Failed to start services: ${error.message}`);
            return false;
        }
    }

    /**
     * Enhanced stop with comprehensive cleanup
     */
    async smartStop(options = {}) {
        const { force = false, gentle = false } = options;

        this.log('🛑 Starting Smart Stop Process...', colors.bright + colors.cyan);

        try {
            // Step 1: Try graceful stop via parallel launcher first
            if (!force && gentle) {
                this.log('🤝 Attempting graceful stop via parallel launcher...', colors.cyan);

                try {
                    const launcherPath = path.join(__dirname, 'parallel-launcher.js');
                    const stopArgs = ['stop'];
                    if (force) stopArgs.push('--force');

                    const child = spawn('node', [launcherPath, ...stopArgs], {
                        stdio: 'inherit',
                        cwd: path.dirname(__dirname)
                    });

                    await new Promise((resolve) => {
                        child.on('exit', () => resolve());
                        child.on('error', () => resolve());

                        // Timeout graceful stop
                        setTimeout(() => {
                            child.kill();
                            resolve();
                        }, 10000);
                    });
                } catch (error) {
                    this.warning(`Graceful stop failed: ${error.message}`);
                }
            }

            // Step 2: Enhanced cleanup
            this.log('🧹 Performing comprehensive cleanup...', colors.cyan);
            const result = await this.processManager.fullCleanup(force);

            if (result.success) {
                this.success('🎉 All services stopped successfully');
                return true;
            } else {
                this.warning(`Partial cleanup: ${result.remainingConflicts} conflicts remain`);
                return false;
            }

        } catch (error) {
            this.error(`Stop process failed: ${error.message}`);
            return false;
        }
    }

    /**
     * Smart restart with enhanced reliability
     */
    async smartRestart(options = {}) {
        this.log('🔄 Starting Smart Restart Process...', colors.bright + colors.magenta);

        // Step 1: Enhanced stop
        const stopped = await this.smartStop({ force: true });

        if (!stopped) {
            this.warning('Stop phase had issues, but continuing with restart...');
        }

        // Step 2: Wait for complete shutdown
        this.log('⏳ Waiting for complete system shutdown...', colors.gray);
        await new Promise(resolve => setTimeout(resolve, 3000));

        // Step 3: Enhanced start
        return await this.smartStart(options);
    }

    /**
     * System health monitoring
     */
    async healthCheck() {
        this.log('💊 Performing system health check...', colors.cyan);

        const status = await this.processManager.getStatus();

        // Additional checks
        const checks = {
            processes: status.healthy,
            ports: Object.values(status.ports).every(p => !p.inUse),
            conflicts: status.conflicts === 0
        };

        const overallHealth = Object.values(checks).every(check => check);

        this.log('\n🏥 Health Report:', colors.cyan);
        Object.entries(checks).forEach(([check, passing]) => {
            const icon = passing ? '✅' : '❌';
            const color = passing ? colors.green : colors.red;
            this.log(`  ${icon} ${check}`, color);
        });

        this.log(`\n💊 Overall: ${overallHealth ? '🟢 HEALTHY' : '🔴 ISSUES DETECTED'}`,
            overallHealth ? colors.green : colors.red);

        return { healthy: overallHealth, details: checks, status };
    }
}

// CLI Interface
async function main() {
    const command = process.argv[2] || 'help';
    const args = process.argv.slice(3);
    const flags = args.filter(arg => arg.startsWith('--'));
    const services = args.filter(arg => !arg.startsWith('--')).join(',') || null;

    const launcher = new SmartTurboLauncher();

    // Parse common flags
    const force = flags.includes('--force');
    const build = flags.includes('--build');
    const fast = flags.includes('--fast') || flags.includes('--skip-health');
    const gentle = flags.includes('--gentle');
    const debug = flags.includes('--debug');

    if (debug) launcher.processManager.logLevel = 'debug';

    try {
        switch (command) {
            case 'start':
                const startSuccess = await launcher.smartStart({
                    services,
                    build,
                    fast,
                    force
                });
                process.exit(startSuccess ? 0 : 1);
                break;

            case 'stop':
                const stopSuccess = await launcher.smartStop({ force, gentle });
                process.exit(stopSuccess ? 0 : 1);
                break;

            case 'restart':
                const restartSuccess = await launcher.smartRestart({
                    services,
                    build,
                    fast,
                    force
                });
                process.exit(restartSuccess ? 0 : 1);
                break;

            case 'status':
            case 'health':
                const healthResult = await launcher.healthCheck();
                process.exit(healthResult.healthy ? 0 : 1);
                break;

            case 'cleanup':
                const cleanupResult = await launcher.processManager.fullCleanup(force);
                process.exit(cleanupResult.success ? 0 : 1);
                break;

            default:
                console.log(`
${colors.cyan}🚀 Smart Turbo Launcher with Enhanced Process Management${colors.reset}

Usage: node smart-turbo-launcher.js <command> [services] [options]

Commands:
  start     Smart start with automatic conflict resolution
  stop      Enhanced stop with comprehensive cleanup  
  restart   Intelligent restart with full system preparation
  status    System health check and process status
  cleanup   Manual system cleanup

Options:
  --build      Include build step before starting
  --fast       Skip health checks for faster startup
  --force      Force operations and aggressive cleanup
  --gentle     Use graceful shutdown methods
  --debug      Enable debug logging

Examples:
  node smart-turbo-launcher.js start --build
  node smart-turbo-launcher.js start backend,frontend --fast
  node smart-turbo-launcher.js stop --force
  node smart-turbo-launcher.js restart --build --force
  node smart-turbo-launcher.js status
  node smart-turbo-launcher.js cleanup --force

${colors.yellow}Enhanced Features:${colors.reset}
  ✅ Automatic process conflict detection and resolution
  ✅ Intelligent cleanup before startup
  ✅ Bulletproof stop with comprehensive process termination
  ✅ Real-time system health monitoring
  ✅ Smart restart with full system preparation
`);
                process.exit(1);
        }
    } catch (error) {
        console.error(`${colors.red}Fatal Error: ${error.message}${colors.reset}`);
        if (debug) console.error(error.stack);
        process.exit(1);
    }
}

// Handle cleanup on interrupt
process.on('SIGINT', async () => {
    console.log('\n🛑 Interrupt received, performing emergency cleanup...');
    const launcher = new SmartTurboLauncher();
    await launcher.smartStop({ force: true });
    process.exit(0);
});

if (require.main === module) {
    main();
}

module.exports = SmartTurboLauncher; 