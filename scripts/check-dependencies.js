#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

console.log('🏥 Dependency Health Check\n');

const issues = [];

// Check backend dependencies
console.log('Checking backend dependencies...');
try {
    require.resolve(path.join(__dirname, '../backend/node_modules/@nestjs/core'));
    console.log('✅ NestJS core found');
} catch (e) {
    issues.push('❌ NestJS core missing');
}

try {
    require.resolve(path.join(__dirname, '../backend/node_modules/@tensorflow/tfjs'));
    console.log('✅ TensorFlow.js found');
} catch (e) {
    console.log('⚠️  TensorFlow.js missing (using fallback)');
}

// Check frontend dependencies
console.log('\nChecking frontend dependencies...');
try {
    require.resolve(path.join(__dirname, '../frontend/node_modules/react'));
    console.log('✅ React found');
} catch (e) {
    issues.push('❌ React missing');
}

// Check Python dependencies
console.log('\nChecking Python dependencies...');
try {
    execSync('python3 -c "import fastapi, torch, numpy"', { stdio: 'ignore' });
    console.log('✅ Python ML dependencies found');
} catch (e) {
    console.log('⚠️  Some Python dependencies missing');
}

// Check services
console.log('\nChecking services...');
const services = [
    { name: 'Backend', port: 3000 },
    { name: 'Frontend', port: 3001 },
    { name: 'ML Service', port: 8000 },
];

services.forEach(service => {
    try {
        execSync(`curl -s http://localhost:${service.port}/health`, { stdio: 'ignore' });
        console.log(`✅ ${service.name} is running on port ${service.port}`);
    } catch (e) {
        console.log(`⚠️  ${service.name} not running on port ${service.port}`);
    }
});

if (issues.length > 0) {
    console.log('\n❌ Critical issues found:');
    issues.forEach(issue => console.log(issue));
    console.log('\nRun: npm run fix:dependencies');
    process.exit(1);
} else {
    console.log('\n✅ All critical dependencies healthy!');
}