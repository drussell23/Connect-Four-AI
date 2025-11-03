/**
 * Intelligent Animation Guard System
 * Prevents invalid animation values and provides smart fallbacks
 */

import React from 'react';

interface ValidationResult {
  isValid: boolean;
  value: any;
  fallback?: any;
  warning?: string;
}

interface AnimationGuardConfig {
  enableLogging?: boolean;
  enableAutoFix?: boolean;
  throwOnError?: boolean;
  customValidators?: Record<string, (value: any) => ValidationResult>;
}

// Animation property validators
const PROPERTY_VALIDATORS: Record<string, (value: any) => ValidationResult> = {
  // Box shadow validation
  boxShadow: (value: any): ValidationResult => {
    if (!value || typeof value !== 'string') {
      return {
        isValid: false,
        value: '0 0 0px rgba(0,0,0,0)',
        warning: 'Invalid boxShadow value'
      };
    }

    // Check for NaN values
    if (value.includes('NaN') || value.includes('undefined') || value.includes('null')) {
      return {
        isValid: false,
        value: '0 0 0px rgba(0,0,0,0)',
        warning: `BoxShadow contains invalid values: ${value}`
      };
    }

    // Validate boxShadow format
    const boxShadowRegex = /^([+-]?\d*\.?\d+px?\s*){2,4}(rgba?\([^)]+\)|#[0-9a-fA-F]{3,8}|[a-z]+)?$/;
    if (!boxShadowRegex.test(value.trim())) {
      return {
        isValid: false,
        value: '0 0 0px rgba(0,0,0,0)',
        warning: `Invalid boxShadow format: ${value}`
      };
    }

    return { isValid: true, value };
  },

  // Scale validation
  scale: (value: any): ValidationResult => {
    if (value === undefined || value === null) {
      return { isValid: true, value: 1 };
    }

    const numValue = Number(value);
    if (isNaN(numValue)) {
      return {
        isValid: false,
        value: 1,
        warning: `Invalid scale value: ${value}`
      };
    }

    // Reasonable scale bounds
    if (numValue < 0 || numValue > 10) {
      return {
        isValid: false,
        value: Math.max(0, Math.min(10, numValue)),
        warning: `Scale value out of bounds: ${value}`
      };
    }

    return { isValid: true, value: numValue };
  },

  // Opacity validation
  opacity: (value: any): ValidationResult => {
    if (value === undefined || value === null) {
      return { isValid: true, value: 1 };
    }

    const numValue = Number(value);
    if (isNaN(numValue)) {
      return {
        isValid: false,
        value: 1,
        warning: `Invalid opacity value: ${value}`
      };
    }

    // Clamp between 0 and 1
    if (numValue < 0 || numValue > 1) {
      return {
        isValid: false,
        value: Math.max(0, Math.min(1, numValue)),
        warning: `Opacity value out of bounds: ${value}`
      };
    }

    return { isValid: true, value: numValue };
  },

  // Transform validation
  transform: (value: any): ValidationResult => {
    if (!value || typeof value !== 'string') {
      return { isValid: true, value: 'none' };
    }

    if (value.includes('NaN') || value.includes('undefined')) {
      return {
        isValid: false,
        value: 'none',
        warning: `Transform contains invalid values: ${value}`
      };
    }

    return { isValid: true, value };
  },

  // Position validation (x, y)
  x: (value: any): ValidationResult => validateNumericValue(value, 0, 'x'),
  y: (value: any): ValidationResult => validateNumericValue(value, 0, 'y'),

  // Rotation validation
  rotate: (value: any): ValidationResult => validateNumericValue(value, 0, 'rotate'),

  // Size validation
  width: (value: any): ValidationResult => validateSizeValue(value, 'auto', 'width'),
  height: (value: any): ValidationResult => validateSizeValue(value, 'auto', 'height'),

  // Color validation
  color: (value: any): ValidationResult => validateColorValue(value, '#000000', 'color'),
  backgroundColor: (value: any): ValidationResult => validateColorValue(value, 'transparent', 'backgroundColor'),
};

// Helper validators
function validateNumericValue(value: any, fallback: number, propName: string): ValidationResult {
  if (value === undefined || value === null) {
    return { isValid: true, value: fallback };
  }

  const numValue = Number(value);
  if (isNaN(numValue) || !isFinite(numValue)) {
    return {
      isValid: false,
      value: fallback,
      warning: `Invalid ${propName} value: ${value}`
    };
  }

  return { isValid: true, value: numValue };
}

function validateSizeValue(value: any, fallback: string | number, propName: string): ValidationResult {
  if (value === undefined || value === null) {
    return { isValid: true, value: fallback };
  }

  if (typeof value === 'string') {
    if (value.includes('NaN') || value.includes('undefined')) {
      return {
        isValid: false,
        value: fallback,
        warning: `Invalid ${propName} value: ${value}`
      };
    }
    return { isValid: true, value };
  }

  const numValue = Number(value);
  if (isNaN(numValue)) {
    return {
      isValid: false,
      value: fallback,
      warning: `Invalid ${propName} value: ${value}`
    };
  }

  return { isValid: true, value: numValue };
}

function validateColorValue(value: any, fallback: string, propName: string): ValidationResult {
  if (!value || typeof value !== 'string') {
    return { isValid: true, value: fallback };
  }

  if (value.includes('NaN') || value.includes('undefined') || value === 'null') {
    return {
      isValid: false,
      value: fallback,
      warning: `Invalid ${propName} value: ${value}`
    };
  }

  // Basic color validation
  const isValidColor = /^(#[0-9a-fA-F]{3,8}|rgb|rgba|hsl|hsla|[a-z]+)/.test(value);
  if (!isValidColor) {
    return {
      isValid: false,
      value: fallback,
      warning: `Invalid ${propName} format: ${value}`
    };
  }

  return { isValid: true, value };
}

// Main Animation Guard Class
export class AnimationGuard {
  private config: AnimationGuardConfig;
  private validators: Record<string, (value: any) => ValidationResult>;
  private warningCache: Set<string> = new Set();

  constructor(config: AnimationGuardConfig = {}) {
    this.config = {
      enableLogging: true,
      enableAutoFix: true,
      throwOnError: false,
      ...config
    };

    this.validators = {
      ...PROPERTY_VALIDATORS,
      ...config.customValidators
    };
  }

  /**
   * Validate and sanitize animation properties
   */
  public validateAnimation<T extends Record<string, any>>(
    animationProps: T,
    componentName?: string
  ): T {
    const sanitized: any = {};
    const errors: string[] = [];

    Object.entries(animationProps).forEach(([key, value]) => {
      const validator = this.validators[key];
      
      if (validator) {
        const result = validator(value);
        
        if (!result.isValid) {
          const errorKey = `${componentName || 'Component'}.${key}`;
          
          if (result.warning && this.config.enableLogging && !this.warningCache.has(errorKey)) {
            console.warn(`🛡️ AnimationGuard: ${result.warning}`, {
              component: componentName,
              property: key,
              invalidValue: value,
              fixedValue: result.value
            });
            this.warningCache.add(errorKey);
          }

          if (this.config.enableAutoFix) {
            sanitized[key] = result.value;
          } else {
            errors.push(result.warning || `Invalid ${key}`);
          }
        } else {
          sanitized[key] = result.value;
        }
      } else {
        // No validator for this property, pass through
        sanitized[key] = value;
      }
    });

    if (errors.length > 0 && this.config.throwOnError) {
      throw new Error(`Animation validation failed: ${errors.join(', ')}`);
    }

    return sanitized as T;
  }

  /**
   * Create safe animation variants for Framer Motion
   */
  public createSafeVariants(variants: Record<string, any>, componentName?: string): Record<string, any> {
    const safeVariants: Record<string, any> = {};

    Object.entries(variants).forEach(([variantName, variantProps]) => {
      safeVariants[variantName] = this.validateAnimation(
        variantProps,
        `${componentName}.${variantName}`
      );
    });

    return safeVariants;
  }

  /**
   * Wrap animation values with safety checks
   */
  public safeValue<T>(value: T, fallback: T, validator?: (value: T) => boolean): T {
    if (value === undefined || value === null || (typeof value === 'number' && isNaN(value))) {
      return fallback;
    }

    if (validator && !validator(value)) {
      return fallback;
    }

    return value;
  }

  /**
   * Create safe box shadow with validation
   */
  public safeBoxShadow(
    color?: string,
    blur: string = '25px',
    spread: string = '0px',
    x: string = '0',
    y: string = '0'
  ): string {
    const safeColor = this.safeValue(color, 'rgba(0,0,0,0.1)', (c) => !c?.includes('NaN'));
    const safeBlur = this.safeValue(blur, '25px', (b) => !b?.includes('NaN'));
    const safeSpread = this.safeValue(spread, '0px', (s) => !s?.includes('NaN'));
    const safeX = this.safeValue(x, '0', (x) => !x?.includes('NaN'));
    const safeY = this.safeValue(y, '0', (y) => !y?.includes('NaN'));

    return `${safeX} ${safeY} ${safeBlur} ${safeSpread} ${safeColor}`;
  }

  /**
   * Clear warning cache (useful for development)
   */
  public clearWarningCache(): void {
    this.warningCache.clear();
  }
}

// Default instance
export const animationGuard = new AnimationGuard();

// React Hook for animation validation
export function useAnimationGuard(config?: AnimationGuardConfig) {
  const guard = new AnimationGuard(config);

  return {
    validate: guard.validateAnimation.bind(guard),
    createVariants: guard.createSafeVariants.bind(guard),
    safeValue: guard.safeValue.bind(guard),
    safeBoxShadow: guard.safeBoxShadow.bind(guard),
  };
}

// HOC for components with animations
export function withAnimationGuard<P extends object>(
  Component: React.ComponentType<P>,
  componentName?: string
): React.ComponentType<P> {
  return (props: P) => {
    const guard = useAnimationGuard();
    
    // Intercept and validate animation props
    const safeProps = { ...props };
    
    // Check for common animation prop patterns
    ['animate', 'initial', 'exit', 'whileHover', 'whileTap', 'whileDrag'].forEach(propName => {
      if (propName in safeProps) {
        (safeProps as any)[propName] = guard.validate(
          (safeProps as any)[propName],
          `${componentName}.${propName}`
        );
      }
    });

    return React.createElement(Component, safeProps);
  };
}