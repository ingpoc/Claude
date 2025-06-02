#!/usr/bin/env node

const { exec } = require('child_process');
const fs = require('fs');
const path = require('path');

console.log('🔍 MCP Knowledge Graph Diagnostics');
console.log('==================================\n');

// Check Node version
console.log('Node.js Version:', process.version);
if (parseInt(process.version.split('.')[0].substring(1)) < 18) {
    console.log('❌ Node.js 18+ required');
} else {
    console.log('✅ Node.js version OK');
}

// Check if .env.local exists
const envPath = path.join(__dirname, '.env.local');
if (fs.existsSync(envPath)) {
    console.log('✅ .env.local found');
    
    // Check for required env vars
    const envContent = fs.readFileSync(envPath, 'utf8');
    const hasOpenAI = envContent.includes('OPENAI_API_KEY=') && !envContent.includes('OPENAI_API_KEY=your_openai_api_key_here');
    const hasQdrant = envContent.includes('QDRANT_URL=');
    
    console.log(hasOpenAI ? '✅ OpenAI API key configured' : '⚠️  OpenAI API key not configured (embeddings will use random vectors)');
    console.log(hasQdrant ? '✅ Qdrant URL configured' : '❌ Qdrant URL not configured');
} else {
    console.log('❌ .env.local not found - copy from .env.local.example');
}

// Check if dist folder exists
if (fs.existsSync(path.join(__dirname, 'dist'))) {
    console.log('✅ Server build found');
} else {
    console.log('❌ Server not built - run: npm run build:server');
}

// Check if .next folder exists  
if (fs.existsSync(path.join(__dirname, '.next'))) {
    console.log('✅ Next.js build found');
} else {
    console.log('⚠️  Next.js not built - run: npm run build');
}

// Check Qdrant status
console.log('\nChecking Qdrant...');
exec('curl -s http://localhost:6333/health', (error, stdout, stderr) => {
    if (error) {
        console.log('❌ Qdrant not running');
        console.log('   Run: docker run -p 6333:6333 qdrant/qdrant');
    } else {
        console.log('✅ Qdrant is running');
        try {
            const health = JSON.parse(stdout);
            console.log('   Status:', health.status || 'OK');
        } catch (e) {
            // Ignore parse errors
        }
    }
    
    // Check ports
    console.log('\nChecking ports...');
    checkPort(4000, 'Dashboard & API Server');
    checkPort(6333, 'Qdrant');
    checkPort(3155, 'Legacy API Port (should be free)');
});

function checkPort(port, service) {
    exec(`lsof -i :${port} || netstat -an | grep ${port}`, (error, stdout) => {
        if (stdout && stdout.trim()) {
            console.log(`⚠️  Port ${port} (${service}) is in use`);
        } else {
            console.log(`✅ Port ${port} (${service}) is available`);
        }
    });
}

// Check npm packages
console.log('\nChecking dependencies...');
const packageJson = JSON.parse(fs.readFileSync(path.join(__dirname, 'package.json'), 'utf8'));
const requiredPackages = [
    '@modelcontextprotocol/sdk',
    '@qdrant/js-client-rest',
    'openai',
    'next',
    'express'
];

const installedPackages = Object.keys(packageJson.dependencies || {});
requiredPackages.forEach(pkg => {
    if (installedPackages.includes(pkg)) {
        console.log(`✅ ${pkg} installed`);
    } else {
        console.log(`❌ ${pkg} not found`);
    }
});

console.log('\n📋 Summary:');
console.log('If you see any ❌ above, address those issues first.');
console.log('For ⚠️  warnings, the system may work but with reduced functionality.\n');
