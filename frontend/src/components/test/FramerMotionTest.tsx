import React from 'react';
import { motion } from 'framer-motion';

const FramerMotionTest: React.FC = () => {
    return (
        <div className="p-8 bg-gray-900 text-white">
            <h2 className="text-2xl font-bold mb-4">Framer Motion Test</h2>

            <motion.div
                className="p-4 bg-blue-600 rounded-lg mb-4"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5 }}
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
            >
                <p>✅ Framer Motion is working correctly!</p>
                <p>This component should animate in and respond to hover/tap.</p>
            </motion.div>

            <motion.button
                className="px-4 py-2 bg-green-600 rounded hover:bg-green-700"
                whileHover={{ scale: 1.1 }}
                whileTap={{ scale: 0.9 }}
            >
                Test Button
            </motion.button>

            <div className="mt-4 text-sm text-gray-400">
                <p>If you can see this component with animations, framer-motion is working!</p>
                <p>TypeScript should no longer show import errors for framer-motion.</p>
            </div>
        </div>
    );
};

export default FramerMotionTest; 