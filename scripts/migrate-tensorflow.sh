#!/bin/bash

# Script to migrate TensorFlow imports to use the self-healing loader

echo "🔄 Migrating TensorFlow imports to self-healing loader..."

# Find all TypeScript files with TensorFlow imports
FILES=$(grep -r "import.*@tensorflow/tfjs" backend/src --include="*.ts" -l | grep -v tensorflow-loader.ts)

for file in $FILES; do
    echo "📝 Updating: $file"
    
    # Replace direct TensorFlow imports with the loader
    sed -i.bak "s|import \* as tf from '@tensorflow/tfjs-node';|import { getTensorFlow } from '../utils/tensorflow-loader';\nconst tf = await getTensorFlow();|g" "$file"
    sed -i.bak "s|import \* as tf from '@tensorflow/tfjs';|import { getTensorFlow } from '../utils/tensorflow-loader';\nconst tf = await getTensorFlow();|g" "$file"
    
    # Handle different import styles
    sed -i.bak "s|import tf from '@tensorflow/tfjs-node';|import { getTensorFlow } from '../utils/tensorflow-loader';\nconst tf = await getTensorFlow();|g" "$file"
    sed -i.bak "s|import tf from '@tensorflow/tfjs';|import { getTensorFlow } from '../utils/tensorflow-loader';\nconst tf = await getTensorFlow();|g" "$file"
    
    # Clean up backup files
    rm "$file.bak"
done

echo "✅ Migration complete!"
echo "⚠️  Note: You may need to adjust import paths and make functions async where needed."