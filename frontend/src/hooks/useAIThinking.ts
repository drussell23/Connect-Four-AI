import { useState, useEffect, useCallback, useRef } from 'react';
import socket from '../api/socket';

interface AIThinkingState {
  isThinking: boolean;
  phase: 'analyzing' | 'evaluating' | 'deciding' | 'moving';
  progress: number;
  message: string;
  estimatedTime: number;
}

export const useAIThinking = () => {
  const [thinkingState, setThinkingState] = useState<AIThinkingState>({
    isThinking: false,
    phase: 'analyzing',
    progress: 0,
    message: '',
    estimatedTime: 0,
  });
  
  const lastUpdateRef = useRef<number>(0);
  const updateTimeoutRef = useRef<NodeJS.Timeout>();
  
  // Debounced update function to prevent too frequent updates
  const updateThinkingState = useCallback((data: Partial<AIThinkingState>) => {
    const now = Date.now();
    const timeSinceLastUpdate = now - lastUpdateRef.current;
    
    // Throttle updates to max once per 100ms
    if (timeSinceLastUpdate < 100) {
      if (updateTimeoutRef.current) {
        clearTimeout(updateTimeoutRef.current);
      }
      
      updateTimeoutRef.current = setTimeout(() => {
        setThinkingState(prev => ({ ...prev, ...data }));
        lastUpdateRef.current = Date.now();
      }, 100 - timeSinceLastUpdate);
      
      return;
    }
    
    lastUpdateRef.current = now;
    setThinkingState(prev => ({ ...prev, ...data }));
  }, []);
  
  useEffect(() => {
    const handleAIThinking = (data: any) => {
      if (data.organic) {
        updateThinkingState({
          isThinking: true,
          phase: data.phase || 'analyzing',
          progress: data.progress || 0,
          message: data.message || 'AI is thinking...',
          estimatedTime: data.estimatedTime || 0,
        });
      }
    };
    
    const handleAIMove = () => {
      // Clear thinking state when move is made
      setThinkingState({
        isThinking: false,
        phase: 'analyzing',
        progress: 100,
        message: '',
        estimatedTime: 0,
      });
    };
    
    const handlePlayerMove = () => {
      // Start AI thinking when player moves
      setThinkingState({
        isThinking: true,
        phase: 'analyzing',
        progress: 0,
        message: 'Analyzing board state...',
        estimatedTime: 2000, // Default estimate
      });
    };
    
    socket.on('aiThinking', handleAIThinking);
    socket.on('aiMove', handleAIMove);
    socket.on('playerMove', handlePlayerMove);
    
    return () => {
      socket.off('aiThinking', handleAIThinking);
      socket.off('aiMove', handleAIMove);
      socket.off('playerMove', handlePlayerMove);
      
      if (updateTimeoutRef.current) {
        clearTimeout(updateTimeoutRef.current);
      }
    };
  }, [updateThinkingState]);
  
  return thinkingState;
};