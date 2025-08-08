import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import '../styles/AIThinkingIndicator.css';

interface AIThinkingIndicatorProps {
  isThinking: boolean;
  phase?: 'analyzing' | 'evaluating' | 'deciding' | 'moving';
  progress?: number;
  message?: string;
  estimatedTime?: number;
}

export const AIThinkingIndicator: React.FC<AIThinkingIndicatorProps> = ({
  isThinking,
  phase = 'analyzing',
  progress = 0,
  message = 'AI is thinking...',
  estimatedTime = 0,
}) => {
  const [dots, setDots] = useState('');
  
  // Animated dots effect
  useEffect(() => {
    if (!isThinking) return;
    
    const interval = setInterval(() => {
      setDots(prev => {
        if (prev.length >= 3) return '';
        return prev + '.';
      });
    }, 400);
    
    return () => clearInterval(interval);
  }, [isThinking]);
  
  const getPhaseIcon = () => {
    switch (phase) {
      case 'analyzing': return '🔍';
      case 'evaluating': return '🤔';
      case 'deciding': return '💭';
      case 'moving': return '✨';
      default: return '🤖';
    }
  };
  
  const getPhaseColor = () => {
    switch (phase) {
      case 'analyzing': return '#3498db';
      case 'evaluating': return '#e74c3c';
      case 'deciding': return '#f39c12';
      case 'moving': return '#2ecc71';
      default: return '#95a5a6';
    }
  };
  
  return (
    <AnimatePresence>
      {isThinking && (
        <motion.div
          className="ai-thinking-indicator"
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -20 }}
          transition={{ duration: 0.3, ease: 'easeOut' }}
        >
          <div className="thinking-content">
            <motion.div
              className="phase-icon"
              animate={{ rotate: phase === 'analyzing' ? [0, 360] : 0 }}
              transition={{ duration: 2, repeat: Infinity, ease: 'linear' }}
            >
              {getPhaseIcon()}
            </motion.div>
            
            <div className="thinking-details">
              <div className="thinking-message">
                {message}{dots}
              </div>
              
              <div className="progress-container">
                <motion.div
                  className="progress-bar"
                  style={{ backgroundColor: getPhaseColor() }}
                  initial={{ width: 0 }}
                  animate={{ width: `${progress}%` }}
                  transition={{ duration: 0.3, ease: 'easeOut' }}
                />
              </div>
              
              {estimatedTime > 0 && (
                <div className="estimated-time">
                  ~{(estimatedTime / 1000).toFixed(1)}s remaining
                </div>
              )}
            </div>
          </div>
          
          {/* Thinking bubbles animation */}
          <div className="thinking-bubbles">
            {[0, 1, 2].map((i) => (
              <motion.div
                key={i}
                className="bubble"
                initial={{ scale: 0, opacity: 0 }}
                animate={{
                  scale: [0, 1, 0],
                  opacity: [0, 0.6, 0],
                  y: [0, -10, -20],
                }}
                transition={{
                  duration: 1.5,
                  delay: i * 0.3,
                  repeat: Infinity,
                  ease: 'easeInOut',
                }}
              />
            ))}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};