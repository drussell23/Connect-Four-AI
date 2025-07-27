#!/usr/bin/env node

/**
 * Build script for WebAssembly module
 * Compiles WAT to WASM and generates optimized binary
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const WAT_FILE = path.join(__dirname, 'connect4-core.wat');
const WASM_FILE = path.join(__dirname, 'connect4-core.wasm');
const WASM_B64_FILE = path.join(__dirname, 'connect4-core.wasm.b64');

console.log('🔧 Building WebAssembly module...');

try {
  // Check if wat2wasm is available
  try {
    execSync('wat2wasm --version', { stdio: 'ignore' });
  } catch (e) {
    console.error('❌ wat2wasm not found. Please install wabt:');
    console.error('   npm install -g wabt');
    console.error('   or');
    console.error('   brew install wabt');
    process.exit(1);
  }

  // Compile WAT to WASM
  console.log('📝 Compiling WAT to WASM...');
  execSync(`wat2wasm ${WAT_FILE} -o ${WASM_FILE}`, { stdio: 'inherit' });

  // Optimize WASM (if wasm-opt is available)
  try {
    execSync('wasm-opt --version', { stdio: 'ignore' });
    console.log('🚀 Optimizing WASM...');
    execSync(`wasm-opt -O3 ${WASM_FILE} -o ${WASM_FILE}`, { stdio: 'inherit' });
  } catch (e) {
    console.log('⚠️  wasm-opt not found, skipping optimization');
  }

  // Read WASM file
  const wasmBuffer = fs.readFileSync(WASM_FILE);
  console.log(`📦 WASM size: ${wasmBuffer.length} bytes`);

  // Convert to base64 for embedding
  const wasmBase64 = wasmBuffer.toString('base64');
  fs.writeFileSync(WASM_B64_FILE, wasmBase64);

  // Generate TypeScript module with embedded WASM
  const tsContent = `/**
 * Auto-generated WebAssembly module
 * Generated on: ${new Date().toISOString()}
 */

export const WASM_BASE64 = '${wasmBase64}';

export const WASM_SIZE = ${wasmBuffer.length};

export async function loadWasmModule(): Promise<WebAssembly.Module> {
  const wasmBuffer = Uint8Array.from(atob(WASM_BASE64), c => c.charCodeAt(0));
  return WebAssembly.compile(wasmBuffer);
}
`;

  const tsFile = path.join(__dirname, 'connect4-core.wasm.ts');
  fs.writeFileSync(tsFile, tsContent);

  console.log('✅ Build complete!');
  console.log(`   WASM file: ${WASM_FILE}`);
  console.log(`   TypeScript: ${tsFile}`);

} catch (error) {
  console.error('❌ Build failed:', error.message);
  process.exit(1);
}