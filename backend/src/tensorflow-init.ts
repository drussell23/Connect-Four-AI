/**
 * TensorFlow.js initialization for Node.js backend
 * This file should be imported at the top of main.ts to ensure the Node.js backend is loaded
 */

try {
  // Try to load the Node.js optimized version
  require('@tensorflow/tfjs-node');
  console.log('✅ TensorFlow.js Node.js backend loaded successfully');
} catch (error) {
  console.warn('⚠️ Failed to load TensorFlow.js Node.js backend, falling back to CPU version');
  console.warn('To improve performance, ensure @tensorflow/tfjs-node is properly installed');
  console.warn('Error:', error.message);
}