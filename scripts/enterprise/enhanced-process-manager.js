#!/usr/bin/env node

/**
 * 🛠️ Enhanced Process Manager for Connect Four Game
 * Comprehensive process conflict resolution and management
 * Designed to handle multiple nest processes intelligently
 */

const { execSync, spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

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

// Enhanced Process Management Configuration
const PROCESS_CONFIG = {
    // Process detection patterns
    patterns: {
        nest: ['nest start', 'nest build', 'npx nest', 'ts-node.*main.ts'],
        node_backend: ['node.*nest', 'node.*main.js', 'connect-four-backend'],
        react_frontend: ['react-scripts.*start', 'node.*react-scripts'],
        python_ml: ['python.*ml_service', 'python.*train', 'uvicorn'],
        general: ['node.*3000', 'node.*3001', 'npm.*start']
    },

    // Port mappings for services
    ports: {
        backend: [3000],  // Backend serves both API and frontend
        ml_service: [8000],
        ml_inference: [8001],
        ai_coordination: [8002]
    },

    // Cleanup configuration
    cleanup: {
        gracefulTimeout: 5000,
        forceTimeout: 10000,
        retryAttempts: 3,
        cleanupDelay: 1000
    }
};

class EnhancedProcessManager {
    constructor() {
        this.logLevel = 'info'; // 'debug', 'info', 'warn', 'error'
    }

    // Logging methods
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

    debug(message) {
        if (this.logLevel === 'debug') {
            console.log(`${colors.gray}🔍 ${message}${colors.reset}`);
        }
    }

    /**
     * Get all running processes with detailed information
     */
    async getAllProcesses() {
        try {
            // Use ps to get detailed process information
            const psOutput = execSync('ps aux', { encoding: 'utf8' }).trim();

            const processes = psOutput.split('\n').slice(1) // Skip header
                .map(line => {
                    const parts = line.trim().split(/\s+/);
                    const pid = parseInt(parts[1]);
                    const command = parts.slice(10).join(' ');

                    return {
                        pid,
                        user: parts[0],
                        cpu: parseFloat(parts[2]),
                        mem: parseFloat(parts[3]),
                        vsz: parts[4],
                        rss: parts[5],
                        tty: parts[6],
                        stat: parts[7],
                        start: parts[8],
                        time: parts[9],
                        command,
                        full: line
                    };
                })
                .filter(proc => proc.pid && !isNaN(proc.pid));

            return processes;
        } catch (error) {
            this.error(`Failed to get process list: ${error.message}`);
            return [];
        }
    }

    /**
     * Find processes matching our service patterns
     */
    async findServiceProcesses() {
        const allProcesses = await this.getAllProcesses();
        const serviceProcesses = {
            nest: [],
            backend: [],
            frontend: [],
            ml: [],
            other: []
        };

        allProcesses.forEach(proc => {
            const cmd = proc.command.toLowerCase();

            // Skip grep processes
            if (cmd.includes('grep')) return;

            // Categorize processes
            if (cmd.includes('nest start') || cmd.includes('nest build') ||
                (cmd.includes('node') && cmd.includes('nest'))) {
                serviceProcesses.nest.push(proc);
            } else if (cmd.includes('backend') || cmd.includes('3000') ||
                cmd.includes('main.js') || cmd.includes('main.ts')) {
                serviceProcesses.backend.push(proc);
            } else if (cmd.includes('react-scripts') || cmd.includes('frontend') ||
                cmd.includes('3001')) {
                serviceProcesses.frontend.push(proc);
            } else if (cmd.includes('ml_service') || cmd.includes('python') ||
                cmd.includes('uvicorn') || cmd.includes('8000') || cmd.includes('8001')) {
                serviceProcesses.ml.push(proc);
            } else if (cmd.includes('npm') && (cmd.includes('start') || cmd.includes('dev'))) {
                serviceProcesses.other.push(proc);
            }
        });

        return serviceProcesses;
    }

    /**
     * Analyze process conflicts and duplicates
     */
    async analyzeConflicts() {
        this.log('🔍 Analyzing process conflicts...', colors.cyan);

        const serviceProcesses = await this.findServiceProcesses();
        const conflicts = [];
        const summary = {};

        // Check each service category for conflicts
        Object.entries(serviceProcesses).forEach(([service, processes]) => {
            summary[service] = processes.length;

            if (processes.length > 1) {
                this.warning(`Multiple ${service} processes detected: ${processes.length}`);
                conflicts.push({
                    service,
                    count: processes.length,
                    processes: processes,
                    severity: service === 'nest' ? 'high' : 'medium'
                });

                // Log process details
                processes.forEach((proc, index) => {
                    this.debug(`  ${index + 1}. PID ${proc.pid}: ${proc.command.substring(0, 80)}...`);
                });
            } else if (processes.length === 1) {
                this.log(`${service}: 1 process (PID ${processes[0].pid})`, colors.gray);
            }
        });

        return {
            conflicts,
            summary,
            totalConflicts: conflicts.length,
            hasHighSeverity: conflicts.some(c => c.severity === 'high')
        };
    }

    /**
     * Check port usage for known services
     */
    async checkPortUsage() {
        this.log('🔍 Checking port usage...', colors.cyan);
        const portStatus = {};

        for (const [service, ports] of Object.entries(PROCESS_CONFIG.ports)) {
            for (const port of ports) {
                try {
                    const result = execSync(`lsof -ti:${port}`, { encoding: 'utf8' }).trim();
                    if (result) {
                        const pids = result.split('\n').map(p => parseInt(p)).filter(p => !isNaN(p));
                        portStatus[port] = {
                            service,
                            inUse: true,
                            pids
                        };
                        this.warning(`Port ${port} (${service}) in use by PIDs: ${pids.join(', ')}`);
                    } else {
                        portStatus[port] = { service, inUse: false, pids: [] };
                    }
                } catch (error) {
                    portStatus[port] = { service, inUse: false, pids: [] };
                }
            }
        }

        return portStatus;
    }

    /**
     * Kill a process gracefully with fallback to force kill
     */
    async terminateProcess(pid, command = '', force = false) {
        try {
            const processDesc = `PID ${pid}${command ? ` (${command.substring(0, 40)}...)` : ''}`;

            if (force) {
                this.log(`🔥 Force killing ${processDesc}`, colors.red);
                execSync(`kill -9 ${pid}`, { stdio: 'ignore' });
                return true;
            }

            this.log(`🤝 Gracefully terminating ${processDesc}`, colors.yellow);

            // Try SIGTERM first
            execSync(`kill -TERM ${pid}`, { stdio: 'ignore' });

            // Wait for graceful shutdown
            await new Promise(resolve => setTimeout(resolve, PROCESS_CONFIG.cleanup.gracefulTimeout));

            // Check if process still exists
            try {
                execSync(`kill -0 ${pid}`, { stdio: 'ignore' });
                // Process still exists, force kill
                this.warning(`Process ${pid} didn't respond to SIGTERM, using SIGKILL`);
                execSync(`kill -9 ${pid}`, { stdio: 'ignore' });
                await new Promise(resolve => setTimeout(resolve, 1000));
            } catch {
                // Process terminated successfully
                this.success(`Process ${pid} terminated gracefully`);
            }

            return true;
        } catch (error) {
            this.error(`Failed to terminate PID ${pid}: ${error.message}`);
            return false;
        }
    }

    /**
     * Clean up process conflicts intelligently
     */
    async cleanupConflicts(force = false) {
        this.log('🧹 Starting intelligent conflict cleanup...', colors.cyan);

        const analysis = await this.analyzeConflicts();

        if (analysis.totalConflicts === 0) {
            this.success('No process conflicts detected');
            return { success: true, cleaned: 0 };
        }

        this.log(`Found ${analysis.totalConflicts} conflict groups to resolve`, colors.yellow);

        let totalCleaned = 0;

        // Process each conflict group
        for (const conflict of analysis.conflicts) {
            this.log(`\n🎯 Resolving ${conflict.service} conflicts (${conflict.count} processes)`, colors.magenta);

            if (conflict.service === 'nest' || conflict.service === 'backend') {
                // For nest/backend processes, keep the newest and kill the rest
                conflict.processes.sort((a, b) => b.pid - a.pid); // Sort by PID (newer processes have higher PIDs)
                const processesToKill = conflict.processes.slice(1); // Kill all but the first (newest)

                this.log(`Keeping newest process PID ${conflict.processes[0].pid}, cleaning up ${processesToKill.length} older processes`);

                for (const proc of processesToKill) {
                    const success = await this.terminateProcess(proc.pid, proc.command, force);
                    if (success) totalCleaned++;
                }
            } else {
                // For other services, kill all but one
                const processesToKill = conflict.processes.slice(1);

                for (const proc of processesToKill) {
                    const success = await this.terminateProcess(proc.pid, proc.command, force);
                    if (success) totalCleaned++;
                }
            }
        }

        // Wait for processes to fully terminate
        if (totalCleaned > 0) {
            this.log('⏳ Waiting for processes to fully terminate...', colors.gray);
            await new Promise(resolve => setTimeout(resolve, 3000));
        }

        return { success: true, cleaned: totalCleaned };
    }

    /**
     * Clean up ports by killing processes using them
     */
    async cleanupPorts(force = false) {
        this.log('🔧 Cleaning up port conflicts...', colors.cyan);

        const portStatus = await this.checkPortUsage();
        const busyPorts = Object.entries(portStatus).filter(([port, status]) => status.inUse);

        if (busyPorts.length === 0) {
            this.success('No port conflicts detected');
            return { success: true, freed: 0 };
        }

        let totalFreed = 0;

        for (const [port, status] of busyPorts) {
            this.log(`🎯 Freeing port ${port} (${status.service})`, colors.yellow);

            for (const pid of status.pids) {
                const success = await this.terminateProcess(pid, `port ${port}`, force);
                if (success) totalFreed++;
            }
        }

        return { success: true, freed: totalFreed };
    }

    /**
     * Complete system cleanup
     */
    async fullCleanup(force = false) {
        this.log('🚀 Starting comprehensive system cleanup...', colors.bright + colors.cyan);

        // Step 1: Analyze current state
        const analysis = await this.analyzeConflicts();
        const portStatus = await this.checkPortUsage();

        // Step 2: Clean up process conflicts
        const conflictResult = await this.cleanupConflicts(force);

        // Step 3: Clean up port conflicts
        const portResult = await this.cleanupPorts(force);

        // Step 4: Final verification
        await new Promise(resolve => setTimeout(resolve, 2000));
        const finalAnalysis = await this.analyzeConflicts();

        // Summary
        this.log('\n📊 Cleanup Summary:', colors.cyan);
        this.log(`  Processes cleaned: ${conflictResult.cleaned}`, colors.gray);
        this.log(`  Ports freed: ${portResult.freed}`, colors.gray);
        this.log(`  Remaining conflicts: ${finalAnalysis.totalConflicts}`, colors.gray);

        const success = finalAnalysis.totalConflicts === 0;

        if (success) {
            this.success('🎉 System cleanup completed successfully!');
        } else {
            this.warning(`⚠️  ${finalAnalysis.totalConflicts} conflicts remain`);
            if (!force) {
                this.log('💡 Try running with --force for more aggressive cleanup', colors.yellow);
            }
        }

        return {
            success,
            processesKilled: conflictResult.cleaned,
            portsFreed: portResult.freed,
            remainingConflicts: finalAnalysis.totalConflicts
        };
    }

    /**
     * Status report of all processes and ports
     */
    async getStatus() {
        this.log('📊 System Status Report', colors.bright + colors.cyan);

        const analysis = await this.analyzeConflicts();
        const portStatus = await this.checkPortUsage();

        // Process summary
        this.log('\n🔧 Process Summary:', colors.cyan);
        Object.entries(analysis.summary).forEach(([service, count]) => {
            const status = count === 0 ? '⚫' : count === 1 ? '🟢' : '🔴';
            this.log(`  ${status} ${service}: ${count} processes`, count > 1 ? colors.yellow : colors.gray);
        });

        // Port summary  
        this.log('\n🔌 Port Summary:', colors.cyan);
        Object.entries(portStatus).forEach(([port, status]) => {
            const indicator = status.inUse ? '🔴' : '🟢';
            const pids = status.inUse ? ` (PIDs: ${status.pids.join(', ')})` : '';
            this.log(`  ${indicator} ${port} (${status.service})${pids}`, status.inUse ? colors.yellow : colors.gray);
        });

        // Overall health
        const isHealthy = analysis.totalConflicts === 0 &&
            Object.values(portStatus).every(s => !s.inUse);

        this.log(`\n💊 Overall Health: ${isHealthy ? '🟢 HEALTHY' : '🔴 CONFLICTS DETECTED'}`,
            isHealthy ? colors.green : colors.red);

        return {
            healthy: isHealthy,
            conflicts: analysis.totalConflicts,
            processes: analysis.summary,
            ports: portStatus
        };
    }
}

// CLI Interface
async function main() {
    const command = process.argv[2];
    const flags = process.argv.slice(3);
    const force = flags.includes('--force');
    const debug = flags.includes('--debug');

    const manager = new EnhancedProcessManager();
    if (debug) manager.logLevel = 'debug';

    try {
        switch (command) {
            case 'status':
            case 'check':
                await manager.getStatus();
                break;

            case 'cleanup':
            case 'clean':
                const result = await manager.fullCleanup(force);
                process.exit(result.success ? 0 : 1);
                break;

            case 'kill-nest':
                const analysis = await manager.analyzeConflicts();
                const nestConflicts = analysis.conflicts.filter(c => c.service === 'nest');
                if (nestConflicts.length > 0) {
                    await manager.cleanupConflicts(force);
                } else {
                    manager.success('No nest processes to kill');
                }
                break;

            case 'kill-ports':
                await manager.cleanupPorts(force);
                break;

            default:
                console.log(`
${colors.cyan}🛠️  Enhanced Process Manager${colors.reset}

Usage: node enhanced-process-manager.js <command> [options]

Commands:
  status       Show detailed process and port status
  cleanup      Clean up all process and port conflicts
  kill-nest    Kill only nest processes
  kill-ports   Kill processes using known ports

Options:
  --force      Use SIGKILL instead of graceful termination
  --debug      Enable debug logging

Examples:
  node enhanced-process-manager.js status
  node enhanced-process-manager.js cleanup --force
  node enhanced-process-manager.js kill-nest
`);
                process.exit(1);
        }
    } catch (error) {
        console.error(`${colors.red}Error: ${error.message}${colors.reset}`);
        process.exit(1);
    }
}

if (require.main === module) {
    main();
}

module.exports = EnhancedProcessManager; 