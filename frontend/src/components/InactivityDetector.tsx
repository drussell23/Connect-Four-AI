import React, { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import './InactivityDetector.css';

interface InactivityDetectorProps {
  inactivityTimeout?: number; // Time in ms before showing popup (default: 2 minutes)
  onInactive?: () => void;
  onResume?: () => void;
  onQuit?: () => void;
  enabled: boolean;
  isGameActive: boolean;
}

const InactivityDetector: React.FC<InactivityDetectorProps> = ({
  inactivityTimeout = 120000, // 2 minutes default
  onInactive,
  onResume,
  onQuit,
  enabled,
  isGameActive
}) => {
  const [showPopup, setShowPopup] = useState(false);
  const [countdown, setCountdown] = useState(30); // 30 second countdown
  const [isTabVisible, setIsTabVisible] = useState(true);
  const [timeAway, setTimeAway] = useState(0);
  
  const inactivityTimer = useRef<NodeJS.Timeout | null>(null);
  const countdownTimer = useRef<NodeJS.Timeout | null>(null);
  const lastActivityTime = useRef<number>(Date.now());
  const tabHiddenTime = useRef<number>(0);

  // Reset inactivity timer
  const resetTimer = () => {
    if (!enabled || !isGameActive) return;
    
    lastActivityTime.current = Date.now();
    
    if (inactivityTimer.current) {
      clearTimeout(inactivityTimer.current);
    }
    
    inactivityTimer.current = setTimeout(() => {
      handleInactivity();
    }, inactivityTimeout);
  };

  // Handle when user becomes inactive
  const handleInactivity = () => {
    console.log('⏰ User inactive for', inactivityTimeout / 1000, 'seconds');
    setShowPopup(true);
    setCountdown(30);
    
    if (onInactive) {
      onInactive();
    }
    
    // Start countdown
    countdownTimer.current = setInterval(() => {
      setCountdown(prev => {
        if (prev <= 1) {
          handleQuit();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  };

  // Handle resume button click
  const handleResume = () => {
    console.log('▶️ User resumed game');
    setShowPopup(false);
    
    if (countdownTimer.current) {
      clearInterval(countdownTimer.current);
    }
    
    resetTimer();
    
    if (onResume) {
      onResume();
    }
  };

  // Handle quit button click or countdown expiry
  const handleQuit = () => {
    console.log('🚪 User quit due to inactivity');
    setShowPopup(false);
    
    if (countdownTimer.current) {
      clearInterval(countdownTimer.current);
    }
    
    if (inactivityTimer.current) {
      clearTimeout(inactivityTimer.current);
    }
    
    if (onQuit) {
      onQuit();
    }
  };

  // Track user activity
  useEffect(() => {
    if (!enabled || !isGameActive) return;

    const activities = ['mousedown', 'mousemove', 'keypress', 'scroll', 'touchstart', 'click'];
    
    const handleActivity = () => {
      if (!showPopup) {
        resetTimer();
      }
    };
    
    // Add event listeners
    activities.forEach(activity => {
      document.addEventListener(activity, handleActivity);
    });
    
    // Start timer
    resetTimer();
    
    // Cleanup
    return () => {
      activities.forEach(activity => {
        document.removeEventListener(activity, handleActivity);
      });
      
      if (inactivityTimer.current) {
        clearTimeout(inactivityTimer.current);
      }
      
      if (countdownTimer.current) {
        clearInterval(countdownTimer.current);
      }
    };
  }, [enabled, isGameActive, showPopup, inactivityTimeout]);

  // Track tab visibility
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.hidden) {
        // Tab is hidden
        setIsTabVisible(false);
        tabHiddenTime.current = Date.now();
        console.log('👁️ Tab hidden');
        
        // Reduce inactivity timeout when tab is hidden
        if (inactivityTimer.current) {
          clearTimeout(inactivityTimer.current);
        }
        
        // Show popup after 30 seconds if tab is hidden
        if (enabled && isGameActive) {
          inactivityTimer.current = setTimeout(() => {
            handleInactivity();
          }, 30000);
        }
      } else {
        // Tab is visible again
        setIsTabVisible(true);
        const awayTime = Date.now() - tabHiddenTime.current;
        setTimeAway(Math.floor(awayTime / 1000));
        console.log('👁️ Tab visible again, away for', awayTime / 1000, 'seconds');
        
        // If away for more than 5 minutes, show popup
        if (awayTime > 300000 && enabled && isGameActive) {
          handleInactivity();
        } else {
          resetTimer();
        }
      }
    };
    
    document.addEventListener('visibilitychange', handleVisibilityChange);
    
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [enabled, isGameActive]);

  // Clear timers when game becomes inactive
  useEffect(() => {
    if (!isGameActive) {
      if (inactivityTimer.current) {
        clearTimeout(inactivityTimer.current);
      }
      if (countdownTimer.current) {
        clearInterval(countdownTimer.current);
      }
      setShowPopup(false);
    }
  }, [isGameActive]);

  return (
    <AnimatePresence>
      {showPopup && (
        <motion.div
          className="inactivity-overlay"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        >
          <motion.div
            className="inactivity-popup"
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.8, opacity: 0 }}
            transition={{ type: 'spring', damping: 15 }}
          >
            <div className="inactivity-icon">
              <span className="clock-icon">⏰</span>
            </div>
            
            <h2 className="inactivity-title">Are you still playing?</h2>
            
            <p className="inactivity-message">
              {isTabVisible 
                ? "We haven't detected any activity for a while."
                : `You've been away for ${timeAway} seconds.`}
            </p>
            
            <div className="countdown-container">
              <div className="countdown-circle">
                <svg width="100" height="100">
                  <circle
                    cx="50"
                    cy="50"
                    r="45"
                    stroke="#e0e0e0"
                    strokeWidth="5"
                    fill="none"
                  />
                  <circle
                    cx="50"
                    cy="50"
                    r="45"
                    stroke="#4CAF50"
                    strokeWidth="5"
                    fill="none"
                    strokeDasharray={`${(countdown / 30) * 283} 283`}
                    strokeLinecap="round"
                    transform="rotate(-90 50 50)"
                    style={{ transition: 'stroke-dasharray 1s linear' }}
                  />
                </svg>
                <div className="countdown-text">{countdown}s</div>
              </div>
              <p className="countdown-message">
                Game will end in {countdown} seconds
              </p>
            </div>
            
            <div className="inactivity-buttons">
              <button
                className="resume-button"
                onClick={handleResume}
              >
                Yes, I'm still here!
              </button>
              <button
                className="quit-button"
                onClick={handleQuit}
              >
                Quit to Menu
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default InactivityDetector;