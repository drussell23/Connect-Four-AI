import React, { useState, useEffect, useTransition } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { getValidBoxShadowWithOpacity } from '../../utils/animationUtils';
import Footer from './Footer';
import './LandingPage.css';

interface LandingPageProps {
  onStart: () => void;
}

const LandingPage: React.FC<LandingPageProps> = ({ onStart }) => {
  const [isPending, startTransition] = useTransition();
  const [selectedDifficulty, setSelectedDifficulty] = useState(() => {
    const stored = localStorage.getItem('selectedDifficulty');
    return stored ? parseInt(stored) : 1;
  });
  const [showDifficultySelector, setShowDifficultySelector] = useState(false);
  const [showInfo, setShowInfo] = useState(false);

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Enter' && !showDifficultySelector && !showInfo) {
        handleStartWithDifficulty();
      }
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [showDifficultySelector, showInfo]);

  const getAIInfo = (level: number) => {
    if (level <= 3) return { name: 'Genesis', color: '#10b981', threat: 'ROOKIE', description: 'Perfect for beginners learning the ropes' };
    if (level <= 6) return { name: 'Prometheus', color: '#84cc16', threat: 'AMATEUR', description: 'Developing tactical awareness' };
    if (level <= 9) return { name: 'Athena', color: '#f59e0b', threat: 'SKILLED', description: 'Strategic mind awakening' };
    if (level <= 12) return { name: 'Nemesis', color: '#ef4444', threat: 'EXPERT', description: 'Calculating victory paths' };
    if (level <= 15) return { name: 'Chronos', color: '#dc2626', threat: 'MASTER', description: 'Time-space optimization' };
    if (level <= 18) return { name: 'Omega', color: '#991b1b', threat: 'GRANDMASTER', description: 'Transcendent intelligence' };
    if (level <= 21) return { name: 'Singularity', color: '#7c2d12', threat: 'LEGENDARY', description: 'Beyond human comprehension' };
    if (level <= 24) return { name: 'Nightmare', color: '#1f2937', threat: 'NIGHTMARE', description: 'The stuff of legends' };
    return { name: 'The Ultimate', color: '#000000', threat: 'ULTIMATE', description: 'Perfection incarnate' };
  };

  const currentAI = getAIInfo(selectedDifficulty) || { name: 'Genesis', color: '#10b981', threat: 'ROOKIE', description: 'Perfect for beginners learning the ropes' };

  const handleStartWithDifficulty = () => {
    localStorage.setItem('selectedDifficulty', selectedDifficulty.toString());
    onStart();
  };

  return (
    <motion.div
      className="landing-container"
      style={{ overflow: 'hidden', position: 'relative' }}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 1 }}
    >
      {/* Enhanced background disc animations */}
      <div style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', overflow: 'hidden', zIndex: -1, pointerEvents: 'none' }}>
        {/* Red discs */}
        <motion.div
          style={{ position: 'absolute', width: 80, height: 80, borderRadius: '50%', backgroundColor: 'rgba(255,0,0,0.3)', boxShadow: '0 0 20px rgba(255,0,0,0.3)' }}
          initial={{ x: '-100vw', y: '25vh' }}
          animate={{ x: '100vw', y: '25vh', scale: [1, 1.2, 1], rotate: [0, 360, 0] }}
          transition={{ duration: 6, repeat: Infinity, ease: 'linear' }}
        />
        <motion.div
          style={{ position: 'absolute', width: 60, height: 60, borderRadius: '50%', backgroundColor: 'rgba(255,0,0,0.5)', boxShadow: '0 0 15px rgba(255,0,0,0.5)' }}
          initial={{ x: '-100vw', y: '50vh' }}
          animate={{ x: '100vw', y: '50vh', scale: [1, 1.2, 1], rotate: [0, 360, 0] }}
          transition={{ duration: 4, repeat: Infinity, ease: 'easeInOut', delay: 1 }}
        />
        <motion.div
          style={{ position: 'absolute', width: 100, height: 100, borderRadius: '50%', backgroundColor: 'rgba(255,0,0,0.2)', boxShadow: '0 0 25px rgba(255,0,0,0.2)' }}
          initial={{ x: '-100vw', y: '75vh' }}
          animate={{ x: '100vw', y: '75vh', scale: [1, 1.3, 1], rotate: [0, 360, 0] }}
          transition={{ duration: 8, repeat: Infinity, ease: 'linear', delay: 2 }}
        />

        {/* Yellow discs */}
        <motion.div
          style={{ position: 'absolute', width: 80, height: 80, borderRadius: '50%', backgroundColor: 'rgba(255,255,0,0.3)', boxShadow: '0 0 20px rgba(255,255,0,0.3)' }}
          initial={{ x: '100vw', y: '35vh' }}
          animate={{ x: '-100vw', y: '35vh', scale: [1, 1.2, 1], rotate: [0, -360, 0] }}
          transition={{ duration: 5, repeat: Infinity, ease: 'linear', delay: 0.5 }}
        />
        <motion.div
          style={{ position: 'absolute', width: 60, height: 60, borderRadius: '50%', backgroundColor: 'rgba(255,255,0,0.5)', boxShadow: '0 0 15px rgba(255,255,0,0.5)' }}
          initial={{ x: '100vw', y: '55vh' }}
          animate={{ x: '-100vw', y: '55vh', scale: [1, 1.2, 1], rotate: [0, -360, 0] }}
          transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut', delay: 1.5 }}
        />
        <motion.div
          style={{ position: 'absolute', width: 90, height: 90, borderRadius: '50%', backgroundColor: 'rgba(255,255,0,0.25)', boxShadow: '0 0 22px rgba(255,255,0,0.25)' }}
          initial={{ x: '100vw', y: '15vh' }}
          animate={{ x: '-100vw', y: '15vh', scale: [1, 1.4, 1], rotate: [0, -360, 0] }}
          transition={{ duration: 7, repeat: Infinity, ease: 'linear', delay: 3 }}
        />
      </div>

      {/* Main Title Section */}
      <div className="title-animation px-4">
        <motion.h1
          className="text-4xl md:text-6xl lg:text-7xl font-extrabold title-gradient hover-wiggle title-float"
          initial={{ scale: 0.8, y: -50, opacity: 0 }}
          animate={{ scale: 1, y: 0, opacity: 1 }}
          transition={{ type: 'spring', stiffness: 100, damping: 15, delay: 0.2 }}
        >
          Connect Four AI
        </motion.h1>

        <motion.div
          className="disc-row bounce"
          initial={{ y: 50, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.5, duration: 0.8 }}
        >
          <div className="disc red disc-animation"></div>
          <div className="disc yellow disc-animation delay-200"></div>
          <div className="disc red disc-animation delay-400"></div>
          <div className="disc yellow disc-animation delay-600"></div>
        </motion.div>

        <motion.p
          className="text-base md:text-xl text-white opacity-90 mt-4 font-medium text-center px-4"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.8, duration: 0.6 }}
        >
          Challenge the most advanced AI minds in Connect Four
        </motion.p>
      </div>

      {/* AI Showcase Section */}
      <motion.div
        className="ai-showcase-section mt-8 px-4 w-full max-w-lg"
        initial={{ y: 100, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 1, duration: 0.8 }}
      >
        <div className="current-ai-display bg-white bg-opacity-10 backdrop-blur-md rounded-2xl p-4 md:p-6 border border-white border-opacity-20">
          <div className="text-base md:text-lg font-bold text-white mb-2">Current Challenge</div>
          <div className="flex items-center gap-3 md:gap-4">
            <div className="ai-avatar w-12 h-12 md:w-16 md:h-16 flex items-center justify-center rounded-full" style={{ backgroundColor: currentAI.color || '#10b981' }}>
              <span className="text-white font-bold text-lg md:text-xl">{currentAI.name.charAt(0)}</span>
            </div>
            <div className="flex-1">
              <div className="text-xl md:text-2xl font-bold" style={{ color: currentAI.color || '#10b981' }}>
                {currentAI.name} AI
              </div>
              <div className="text-sm md:text-base text-white opacity-80">{currentAI.description}</div>
              <div className="threat-badge inline-block text-xs md:text-sm px-2 py-1 rounded-full mt-1" style={{ backgroundColor: currentAI.color || '#10b981' }}>
                Level {selectedDifficulty} • {currentAI.threat}
              </div>
            </div>
          </div>
        </div>
      </motion.div>

      {/* Action Buttons */}
      <motion.div
        className="action-buttons-section mt-8 flex flex-col gap-4 px-4 w-full max-w-md"
        initial={{ y: 50, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 1.2, duration: 0.6 }}
      >
        <motion.button
          className="primary-action-button"
          onClick={handleStartWithDifficulty}
          initial={{ scale: 0, opacity: 0, boxShadow: '0 0 0px rgba(0,0,0,0)' }}
          animate={{ scale: 1, opacity: 1, boxShadow: '0 0 0px rgba(0,0,0,0)' }}
          whileHover={{ scale: 1.05, boxShadow: getValidBoxShadowWithOpacity(currentAI.color || '#10b981') }}
          whileTap={{ scale: 0.95 }}
          onTap={() => navigator.vibrate?.(50)}
          transition={{ type: 'spring', stiffness: 300, delay: 1.4 }}
          style={{ background: `linear-gradient(135deg, ${currentAI.color || '#10b981'}, #10b981)` }}
        >
          <span className="button-icon text-xl md:text-2xl">🚀</span>
          <span className="button-text text-sm md:text-base">CHALLENGE {currentAI.name.toUpperCase()}</span>
          <span className="button-subtitle text-xs md:text-sm">Level {selectedDifficulty} • {currentAI.threat}</span>
        </motion.button>

        <div className="secondary-buttons flex flex-col md:flex-row gap-2 md:gap-4 w-full">
          <motion.button
            className="secondary-action-button flex-1"
            onClick={() => startTransition(() => setShowDifficultySelector(true))}
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onTap={() => navigator.vibrate?.(30)}
            transition={{ type: 'spring', stiffness: 300 }}
          >
            <span className="button-icon text-lg md:text-xl">⚙️</span>
            <span className="button-text text-sm md:text-base">Select Difficulty</span>
          </motion.button>

          <motion.button
            className="secondary-action-button flex-1"
            onClick={() => startTransition(() => setShowInfo(true))}
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onTap={() => navigator.vibrate?.(30)}
            transition={{ type: 'spring', stiffness: 300 }}
          >
            <span className="button-icon text-lg md:text-xl">📖</span>
            <span className="button-text text-sm md:text-base">How to Play</span>
          </motion.button>
        </div>
      </motion.div>

      {/* Difficulty Selection Modal */}
      <AnimatePresence>
        {showDifficultySelector && (
          <motion.div
            className="modal-overlay fixed inset-0 bg-black bg-opacity-70 flex items-center justify-center z-50 backdrop-blur-sm"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <motion.div
              className="difficulty-modal bg-white bg-opacity-10 backdrop-blur-md rounded-3xl p-8 max-w-2xl w-full mx-4 border border-white border-opacity-20"
              initial={{ scale: 0.8, y: 50 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.8, y: 50 }}
              transition={{ type: 'spring', stiffness: 200, damping: 20 }}
            >
              <div className="text-center mb-6">
                <h2 className="text-3xl font-bold text-white mb-2">Choose Your Challenge</h2>
                <p className="text-white opacity-80">Select the AI difficulty level</p>
              </div>

              <div className="difficulty-grid grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                {[1, 3, 6, 9, 12, 15, 18, 21, 24, 25].map((level) => {
                  const aiInfo = getAIInfo(level);
                  const isSelected = selectedDifficulty === level;
                  const isMaxLevel = level === 25;

                  return (
                    <motion.div
                      key={level}
                      className={`difficulty-option cursor-pointer p-4 rounded-xl border-2 transition-all ${isSelected ? 'border-white bg-white bg-opacity-20' : 'border-white border-opacity-30 bg-white bg-opacity-5'
                        }`}
                      onClick={() => setSelectedDifficulty(level)}
                      initial={{ scale: 1, boxShadow: '0 0 0px rgba(0,0,0,0)' }}
                      whileHover={{ scale: 1.02, backgroundColor: 'rgba(255, 255, 255, 0.15)' }}
                      whileTap={{ scale: 0.98 }}
                      style={isSelected ? { boxShadow: getValidBoxShadowWithOpacity(aiInfo.color, '#10b981', 0.5, '20px') } : { boxShadow: '0 0 0px rgba(0,0,0,0)' }}
                    >
                      <div className="flex items-center gap-3">
                        <div
                          className="w-12 h-12 rounded-full flex items-center justify-center text-white font-bold"
                          style={{ backgroundColor: aiInfo.color || '#10b981' }}
                        >
                          {aiInfo.name.charAt(0)}
                        </div>
                        <div className="flex-1">
                          <div className="text-lg font-bold text-white">{aiInfo.name}</div>
                          <div className="text-sm text-white opacity-80">{aiInfo.description}</div>
                          <div
                            className="inline-block px-2 py-1 rounded-full text-xs font-bold text-white mt-1"
                            style={{ backgroundColor: aiInfo.color || '#10b981' }}
                          >
                            Level {level} • {aiInfo.threat}
                          </div>
                          {isMaxLevel && (
                            <div className="text-xs text-yellow-400 font-bold mt-1">
                              ⚡ ULTIMATE CHALLENGE
                            </div>
                          )}
                        </div>
                      </div>
                    </motion.div>
                  );
                })}
              </div>

              <div className="flex gap-4 justify-center">
                <motion.button
                  onClick={() => startTransition(() => setShowDifficultySelector(false))}
                  className="px-6 py-3 bg-gray-600 hover:bg-gray-700 text-white rounded-xl font-bold transition-colors"
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                >
                  Cancel
                </motion.button>
                <motion.button
                  onClick={() => {
                    setShowDifficultySelector(false);
                    handleStartWithDifficulty();
                  }}
                  className="px-8 py-3 text-white rounded-xl font-bold transition-colors"
                  style={{ background: `linear-gradient(135deg, ${currentAI.color || '#10b981'}, #10b981)` }}
                  initial={{ boxShadow: '0 0 0px rgba(0,0,0,0)' }}
                  whileHover={{ scale: 1.05, boxShadow: getValidBoxShadowWithOpacity(currentAI.color || '#10b981') }}
                  whileTap={{ scale: 0.95 }}
                >
                  Challenge {currentAI.name}
                </motion.button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Instructions Modal */}
      <AnimatePresence>
        {showInfo && (
          <motion.div
            className="modal-overlay fixed inset-0 bg-black bg-opacity-70 flex items-center justify-center z-50 backdrop-blur-sm"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <motion.div
              className="info-modal bg-white bg-opacity-10 backdrop-blur-md rounded-3xl p-8 max-w-lg mx-4 border border-white border-opacity-20"
              initial={{ scale: 0.8, y: 50 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.8, y: 50 }}
              transition={{ type: 'spring', stiffness: 200, damping: 20 }}
            >
              <h2 className="text-2xl font-bold mb-4 text-white text-center">How to Play Connect Four</h2>

              <div className="space-y-4 text-white">
                <div className="flex items-start gap-3">
                  <span className="text-2xl">🎯</span>
                  <div>
                    <div className="font-bold">Objective</div>
                    <div className="opacity-80">Connect four of your discs in a row - horizontally, vertically, or diagonally.</div>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <span className="text-2xl">🔴</span>
                  <div>
                    <div className="font-bold">Your Turn</div>
                    <div className="opacity-80">You play as Red. Click on any column to drop your disc.</div>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <span className="text-2xl">🤖</span>
                  <div>
                    <div className="font-bold">AI Challenge</div>
                    <div className="opacity-80">Face increasingly intelligent AI opponents with unique personalities and abilities.</div>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <span className="text-2xl">🏆</span>
                  <div>
                    <div className="font-bold">Progression</div>
                    <div className="opacity-80">Win to unlock higher difficulty levels and face legendary AI minds.</div>
                  </div>
                </div>
              </div>

              <motion.button
                onClick={() => startTransition(() => setShowInfo(false))}
                className="mt-6 w-full bg-blue-600 hover:bg-blue-700 text-white px-4 py-3 rounded-xl font-bold transition-colors"
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
              >
                Got it! Let's Play
              </motion.button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <Footer />
    </motion.div>
  );
};

export default LandingPage;
