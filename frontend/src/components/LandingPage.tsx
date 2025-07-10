import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import './LandingPage.css';

interface LandingPageProps {
  onStart: () => void;
}

const LandingPage: React.FC<LandingPageProps> = ({ onStart }) => {
  const [showInfo, setShowInfo] = useState(false);
  // Keyboard controls: Enter to start, Esc to close info modal
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Enter') onStart();
      if (e.key === 'Escape') setShowInfo(false);
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [onStart]);
  return (
    <motion.div
      className="landing-container"
      style={{ overflow: 'hidden', position: 'relative' }}
      
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 1 }}
    >
            {/* background disc clash */}
      <div style={{position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', overflow: 'hidden', zIndex: -1, pointerEvents: 'none'}}>
                <motion.div style={{ position: 'absolute', width: 80, height: 80, borderRadius: '50%', backgroundColor: 'rgba(255,0,0,0.3)' }} initial={{ x: '-100vw', y: '25vh' }} animate={{ x: '100vw', y: '25vh', scale: [1, 1.2, 1], rotate: [0, 360, 0] }} transition={{ duration: 6, repeat: Infinity, ease: 'linear' }} />
        <motion.div style={{ position: 'absolute', width: 60, height: 60, borderRadius: '50%', backgroundColor: 'rgba(255,0,0,0.5)' }} initial={{ x: '-100vw', y: '50vh' }} animate={{ x: '100vw', y: '50vh', scale: [1, 1.2, 1], rotate: [0, 360, 0] }} transition={{ duration: 4, repeat: Infinity, ease: 'easeInOut', delay: 1 }} />
                <motion.div style={{ position: 'absolute', width: 80, height: 80, borderRadius: '50%', backgroundColor: 'rgba(255,255,0,0.3)' }} initial={{ x: '100vw', y: '35vh' }} animate={{ x: '-100vw', y: '35vh', scale: [1, 1.2, 1], rotate: [0, -360, 0] }} transition={{ duration: 5, repeat: Infinity, ease: 'linear', delay: 0.5 }} />
        <motion.div style={{ position: 'absolute', width: 60, height: 60, borderRadius: '50%', backgroundColor: 'rgba(255,255,0,0.5)' }} initial={{ x: '100vw', y: '55vh' }} animate={{ x: '-100vw', y: '55vh', scale: [1, 1.2, 1], rotate: [0, -360, 0] }} transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut', delay: 1.5 }} />


      </div>
      <div className="title-animation">
        <h1 className="text-6xl font-extrabold title-gradient hover-wiggle title-float">Connect Four AI</h1>
        <div className="disc-row bounce">
          <div className="disc red disc-animation"></div>
          <div className="disc yellow disc-animation delay-200"></div>
          <div className="disc red disc-animation delay-400"></div>
        </div>
      </div>
      
      <motion.button
        className="info-button text-sm text-white mt-4"
        onClick={() => setShowInfo(true)}
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
        onTap={() => navigator.vibrate?.(50)}
        transition={{ type: 'spring', stiffness: 300 }}
      >
        Info
      </motion.button>

      {/* Instructions Modal */}
      <AnimatePresence>
        {showInfo && (
          <motion.div
            className="modal-overlay fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <motion.div
              className="bg-white rounded-lg p-6 max-w-md mx-auto"
              initial={{ scale: 0.8 }}
              animate={{ scale: 1 }}
              exit={{ scale: 0.8 }}
            >
              <h2 className="text-xl font-bold mb-4">How to Play</h2>
              <p className="mb-2">Drop discs into columns to connect four in a row before the AI does.</p>
              <p className="mb-4">Click on a column to drop your disc. Red goes first.</p>
              <button
                onClick={() => setShowInfo(false)}
                className="mt-4 bg-blue-500 hover:bg-blue-600 text-white px-3 py-1 rounded"
              >
                Close
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <motion.button
        className="start-button"
        onClick={onStart}
        initial={{ scale: 0, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
        onTap={() => navigator.vibrate?.(50)}
        transition={{ type: 'spring', stiffness: 300 }}
      >
        Play Now
      </motion.button>
    </motion.div>
  );
};

export default LandingPage;
