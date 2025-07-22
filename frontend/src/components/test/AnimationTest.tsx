import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { getValidBoxShadow, getValidBoxShadowWithOpacity, validateMotionProps } from '../../utils/animationUtils';

const AnimationTest: React.FC = () => {
    const [testColor, setTestColor] = useState<string>('#10b981');
    const [invalidColor, setInvalidColor] = useState<string>('undefined');

    const testAnimations = [
        {
            name: 'Valid Color',
            color: testColor,
            animation: { scale: 1.05, boxShadow: getValidBoxShadow(testColor) }
        },
        {
            name: 'Invalid Color',
            color: invalidColor,
            animation: { scale: 1.05, boxShadow: getValidBoxShadow(invalidColor) }
        },
        {
            name: 'Valid Color with Opacity',
            color: testColor,
            animation: { scale: 1.05, boxShadow: getValidBoxShadowWithOpacity(testColor) }
        },
        {
            name: 'Invalid Color with Opacity',
            color: invalidColor,
            animation: { scale: 1.05, boxShadow: getValidBoxShadowWithOpacity(invalidColor) }
        }
    ];

    return (
        <div className="p-8 bg-gray-900 text-white">
            <h2 className="text-2xl font-bold mb-4">Animation Test</h2>

            <div className="mb-4">
                <label className="block mb-2">Test Color:</label>
                <input
                    type="text"
                    value={testColor}
                    onChange={(e) => setTestColor(e.target.value)}
                    className="p-2 bg-gray-800 border border-gray-600 rounded"
                />
            </div>

            <div className="mb-4">
                <label className="block mb-2">Invalid Color:</label>
                <input
                    type="text"
                    value={invalidColor}
                    onChange={(e) => setInvalidColor(e.target.value)}
                    className="p-2 bg-gray-800 border border-gray-600 rounded"
                />
            </div>

            <div className="grid grid-cols-2 gap-4">
                {testAnimations.map((test, index) => {
                    const isValid = validateMotionProps(test.animation);

                    return (
                        <motion.div
                            key={index}
                            className={`p-4 rounded-lg border-2 ${isValid ? 'border-green-500 bg-green-900' : 'border-red-500 bg-red-900'
                                }`}
                            whileHover={test.animation}
                            whileTap={{ scale: 0.95 }}
                        >
                            <h3 className="font-bold mb-2">{test.name}</h3>
                            <p className="text-sm opacity-80">Color: {test.color}</p>
                            <p className="text-sm opacity-80">BoxShadow: {test.animation.boxShadow}</p>
                            <p className={`text-sm ${isValid ? 'text-green-400' : 'text-red-400'}`}>
                                {isValid ? '✅ Valid' : '❌ Invalid'}
                            </p>
                        </motion.div>
                    );
                })}
            </div>

            <div className="mt-8 p-4 bg-gray-800 rounded">
                <h3 className="font-bold mb-2">Test Results:</h3>
                <p className="text-sm">
                    All animations should work without NaN errors. Check the browser console for any warnings.
                </p>
            </div>
        </div>
    );
};

export default AnimationTest; 