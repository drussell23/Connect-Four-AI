/**
 * Utility functions for safe animation handling
 * Enhanced with intelligent validation system
 */

import { animationGuard } from './animationGuard';

/**
 * Ensures a valid color value for boxShadow animations
 * @param color - The color value to validate
 * @param fallbackColor - Fallback color if the provided color is invalid
 * @returns A valid color string
 */
export const getValidColor = (color: string | undefined, fallbackColor: string = '#10b981'): string => {
    return animationGuard.safeValue(
        color,
        fallbackColor,
        (c) => !!c && c !== 'undefined' && c !== 'null' && c !== 'NaN' && !c.includes('NaN')
    ) as string;
};

/**
 * Creates a safe boxShadow value for animations
 * @param color - The color value to use
 * @param fallbackColor - Fallback color if the provided color is invalid
 * @param blur - The blur radius (default: 25px)
 * @param spread - The spread radius (default: 0px)
 * @returns A valid boxShadow string
 */
export const getValidBoxShadow = (
    color: string | undefined,
    fallbackColor: string = '#10b981',
    blur: string = '25px',
    spread: string = '0px'
): string => {
    const validColor = getValidColor(color, fallbackColor);
    return animationGuard.safeBoxShadow(validColor, blur, spread);
};

/**
 * Creates a safe boxShadow value with opacity for animations
 * @param color - The color value to use
 * @param fallbackColor - Fallback color if the provided color is invalid
 * @param opacity - The opacity value (0-1, default: 0.5)
 * @param blur - The blur radius (default: 30px)
 * @returns A valid boxShadow string with opacity
 */
export const getValidBoxShadowWithOpacity = (
    color: string | undefined,
    fallbackColor: string = '#10b981',
    opacity: number = 0.5,
    blur: string = '30px'
): string => {
    const validColor = getValidColor(color, fallbackColor);
    const safeOpacity = animationGuard.safeValue(opacity, 0.5, (o) => o >= 0 && o <= 1);
    
    // Convert hex to rgba if needed
    if (validColor.startsWith('#')) {
        const hex = validColor.replace('#', '');
        const r = parseInt(hex.substring(0, 2), 16) || 0;
        const g = parseInt(hex.substring(2, 4), 16) || 0;
        const b = parseInt(hex.substring(4, 6), 16) || 0;
        
        // Validate RGB values
        const safeR = animationGuard.safeValue(r, 0, (v) => v >= 0 && v <= 255);
        const safeG = animationGuard.safeValue(g, 0, (v) => v >= 0 && v <= 255);
        const safeB = animationGuard.safeValue(b, 0, (v) => v >= 0 && v <= 255);
        
        return animationGuard.safeBoxShadow(
            `rgba(${safeR}, ${safeG}, ${safeB}, ${safeOpacity})`,
            blur
        );
    }
    
    // For non-hex colors, append opacity if it's a simple color name
    if (/^[a-zA-Z]+$/.test(validColor)) {
        return animationGuard.safeBoxShadow(`${validColor}${Math.round(safeOpacity * 255).toString(16).padStart(2, '0')}`, blur);
    }
    
    // For other formats (rgb, rgba, hsl, etc.), return as is
    return animationGuard.safeBoxShadow(validColor, blur);
};

/**
 * Validates and sanitizes motion animation values
 * @param value - The value to validate
 * @param fallback - The fallback value if the provided value is invalid
 * @returns A valid animation value
 */
export const getValidAnimationValue = (value: any, fallback: any): any => {
    if (value === undefined || value === null || value === 'undefined' || value === 'null' || value === 'NaN') {
        return fallback;
    }
    return value;
};

/**
 * Creates a safe motion animation object with validated values
 * @param animationProps - The animation properties to validate
 * @param fallbacks - Fallback values for each property
 * @returns A safe animation object
 */
export const createSafeAnimation = (
    animationProps: Record<string, any>,
    fallbacks: Record<string, any> = {}
): Record<string, any> => {
    const safeAnimation: Record<string, any> = {};

    Object.entries(animationProps).forEach(([key, value]) => {
        const fallback = fallbacks[key] || value;
        safeAnimation[key] = getValidAnimationValue(value, fallback);
    });

    return safeAnimation;
};

/**
 * Validates that a motion component's props are safe for animation
 * @param props - The motion component props to validate
 * @returns True if the props are safe, false otherwise
 */
export const validateMotionProps = (props: Record<string, any>): boolean => {
    const dangerousProps = ['boxShadow', 'transform', 'scale', 'rotate', 'x', 'y'];

    return dangerousProps.every(prop => {
        const value = props[prop];
        if (value === undefined || value === null) return true;
        if (typeof value === 'string' && (value.includes('NaN') || value.includes('undefined'))) {
            console.warn(`Invalid motion prop detected: ${prop} = ${value}`);
            return false;
        }
        return true;
    });
}; 