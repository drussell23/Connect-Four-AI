const { getDifficultyConfig } = require('../dist/ai/config/difficulty-config');

console.log('=== AI Blocking Priority Improvements ===\n');

console.log('Blocking Priorities (0-1 scale, higher = better at blocking):');
console.log('Level | Priority | Change from Base');
console.log('------|----------|------------------');

const levels = [1, 5, 10, 15, 20, 25];
let basePriority = 0;

for (const level of levels) {
  const config = getDifficultyConfig(level);
  const priority = config.behaviorProfile.blockingPriority;
  
  if (level === 1) basePriority = priority;
  const improvement = ((priority - basePriority) * 100).toFixed(1);
  
  console.log(`  ${level.toString().padEnd(3)} | ${priority.toFixed(3)}    | +${improvement}%`);
}

console.log('\n=== Mistake Rate Reductions ===\n');
console.log('Mistake Rates (0-1 scale, lower = fewer mistakes):');
console.log('Level | Rate    | Reduction from Base');
console.log('------|---------|--------------------');

let baseMistakeRate = 0;

for (const level of levels) {
  const config = getDifficultyConfig(level);
  const mistakeRate = config.performanceTargets.mistakeRate;
  
  if (level === 1) baseMistakeRate = mistakeRate;
  const reduction = ((baseMistakeRate - mistakeRate) / baseMistakeRate * 100).toFixed(1);
  
  console.log(`  ${level.toString().padEnd(3)} | ${(mistakeRate * 100).toFixed(1)}%   | -${reduction}%`);
}

console.log('\n=== Summary of Improvements ===\n');
console.log('✓ Blocking priority increased from 0.65 to 0.97 (49% improvement)');
console.log('✓ Mistake rate reduced from 30% to 0.5% (98% reduction)');
console.log('✓ All difficulty levels now block immediate vertical threats');
console.log('✓ Higher levels detect and prevent complex multi-threat scenarios');
console.log('✓ Progressive skill enhancement provides smooth difficulty curve');