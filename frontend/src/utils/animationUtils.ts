/**
 * Utility functions for safe animation handling
 */

/**
 * Ensures a valid color value for boxShadow animations
 * @param color - The color value to validate
 * @param fallbackColor - Fallback color if the provided color is invalid
 * @returns A valid color string
 */
export const getValidColor = (color: string | undefined, fallbackColor: string = '#10b981'): string => {
    if (!color || color === 'undefined' || color === 'null' || color === 'NaN') {
        return fallbackColor;
    }
    return color;
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
    return `0 0 ${blur} ${spread} ${validColor}`;
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
    // Convert hex to rgba if needed
    if (validColor.startsWith('#')) {
        const hex = validColor.replace('#', '');
        const r = parseInt(hex.substr(0, 2), 16);
        const g = parseInt(hex.substr(2, 2), 16);
        const b = parseInt(hex.substr(4, 2), 16);
        return `0 0 ${blur} rgba(${r}, ${g}, ${b}, ${opacity})`;
    }
    return `0 0 ${blur} ${validColor}${Math.round(opacity * 255).toString(16).padStart(2, '0')}`;
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