/**
 * React Hook for Animation Safety
 * Provides easy-to-use animation validation in components
 */

import { useMemo, useCallback } from 'react';
import { useAnimationGuard } from '../utils/animationGuard';
import { MotionProps } from 'framer-motion';

interface SafeAnimationConfig {
  componentName?: string;
  enableLogging?: boolean;
  strictMode?: boolean;
}

export function useAnimationSafety(config: SafeAnimationConfig = {}) {
  const guard = useAnimationGuard({
    enableLogging: config.enableLogging ?? process.env.NODE_ENV === 'development',
    enableAutoFix: true,
    throwOnError: config.strictMode ?? false,
  });

  // Memoized safe animation props creator
  const createSafeAnimationProps = useCallback(<T extends MotionProps>(
    props: T,
    variantName?: string
  ): T => {
    const contextName = config.componentName 
      ? `${config.componentName}${variantName ? `.${variantName}` : ''}`
      : variantName;

    return guard.validate(props, contextName);
  }, [config.componentName, guard]);

  // Safe motion variants creator
  const createSafeVariants = useCallback((
    variants: Record<string, any>
  ): Record<string, any> => {
    return guard.createVariants(variants, config.componentName);
  }, [config.componentName, guard]);

  // Safe value wrapper with component context
  const safeValue = useCallback(<T>(
    value: T,
    fallback: T,
    propertyName?: string
  ): T => {
    const result = guard.safeValue(value, fallback);
    
    if (value !== result && config.enableLogging) {
      console.warn(
        `🛡️ AnimationSafety: Fixed ${propertyName || 'value'} in ${config.componentName || 'Component'}`,
        { original: value, fixed: result }
      );
    }
    
    return result;
  }, [config.componentName, config.enableLogging, guard]);

  // Common animation presets with safety
  const safeAnimationPresets = useMemo(() => ({
    fadeIn: createSafeAnimationProps({
      initial: { opacity: 0 },
      animate: { opacity: 1 },
      exit: { opacity: 0 },
    }, 'fadeIn'),

    scaleIn: createSafeAnimationProps({
      initial: { scale: 0.8, opacity: 0 },
      animate: { scale: 1, opacity: 1 },
      exit: { scale: 0.8, opacity: 0 },
    }, 'scaleIn'),

    slideInFromLeft: createSafeAnimationProps({
      initial: { x: -100, opacity: 0 },
      animate: { x: 0, opacity: 1 },
      exit: { x: -100, opacity: 0 },
    }, 'slideInFromLeft'),

    slideInFromRight: createSafeAnimationProps({
      initial: { x: 100, opacity: 0 },
      animate: { x: 0, opacity: 1 },
      exit: { x: 100, opacity: 0 },
    }, 'slideInFromRight'),

    bounce: createSafeAnimationProps({
      animate: {
        scale: [1, 1.2, 1],
        transition: {
          duration: 0.3,
          times: [0, 0.5, 1],
        },
      },
    }, 'bounce'),
  }), [createSafeAnimationProps]);

  // Box shadow helpers
  const createSafeBoxShadow = useCallback((
    color?: string,
    options?: {
      blur?: string;
      spread?: string;
      x?: string;
      y?: string;
    }
  ): string => {
    return guard.safeBoxShadow(
      color,
      options?.blur,
      options?.spread,
      options?.x,
      options?.y
    );
  }, [guard]);

  // Hover animation helper
  const createSafeHoverAnimation = useCallback((
    scale: number = 1.05,
    boxShadowColor?: string
  ): MotionProps => {
    return createSafeAnimationProps({
      whileHover: {
        scale: guard.safeValue(scale, 1.05, (s) => s > 0 && s < 2),
        boxShadow: boxShadowColor 
          ? createSafeBoxShadow(boxShadowColor, { blur: '20px' })
          : undefined,
      },
      whileTap: {
        scale: guard.safeValue(scale * 0.95, 0.95, (s) => s > 0 && s < 2),
      },
    }, 'hover');
  }, [createSafeAnimationProps, createSafeBoxShadow, guard]);

  return {
    // Core functions
    createSafeAnimationProps,
    createSafeVariants,
    safeValue,
    
    // Helpers
    createSafeBoxShadow,
    createSafeHoverAnimation,
    
    // Presets
    animations: safeAnimationPresets,
    
    // Direct access to guard
    guard,
  };
}

// Example usage in a component:
/*
function MyComponent() {
  const { createSafeAnimationProps, createSafeBoxShadow, animations } = useAnimationSafety({
    componentName: 'MyComponent',
    enableLogging: true,
  });

  const boxShadow = createSafeBoxShadow(someColor, { blur: '30px' });
  
  return (
    <motion.div
      {...animations.fadeIn}
      whileHover={{ 
        scale: 1.1,
        boxShadow // This is guaranteed to be safe!
      }}
    >
      Content
    </motion.div>
  );
}
*/