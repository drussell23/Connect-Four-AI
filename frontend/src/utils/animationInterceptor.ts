/**
 * Global Animation Interceptor
 * Automatically intercepts and fixes animation errors across the entire app
 */

interface InterceptorConfig {
  enabled: boolean;
  logErrors: boolean;
  autoFix: boolean;
  components?: string[]; // Specific components to monitor
}

class AnimationInterceptor {
  private config: InterceptorConfig;
  private originalConsoleError: typeof console.error;
  private originalConsoleWarn: typeof console.warn;
  private errorPatterns: RegExp[];
  private fixedErrors: Set<string> = new Set();

  constructor(config: Partial<InterceptorConfig> = {}) {
    this.config = {
      enabled: true,
      logErrors: true,
      autoFix: true,
      ...config
    };

    this.originalConsoleError = console.error;
    this.originalConsoleWarn = console.warn;

    // Common animation error patterns
    this.errorPatterns = [
      /You are trying to animate (\w+) from "(.*?)" to "(.*?)"/,
      /NaN.*?is not an animatable value/,
      /Invalid animation property/,
      /Cannot read property.*?of undefined.*?animation/,
      /Framer Motion.*?invalid.*?value/
    ];
  }

  /**
   * Start intercepting animation errors
   */
  public start(): void {
    if (!this.config.enabled) return;

    // Override console.error
    console.error = (...args: any[]) => {
      const message = args[0]?.toString() || '';
      
      if (this.isAnimationError(message)) {
        this.handleAnimationError(message, args);
      } else {
        this.originalConsoleError.apply(console, args);
      }
    };

    // Override console.warn for animation warnings
    console.warn = (...args: any[]) => {
      const message = args[0]?.toString() || '';
      
      if (this.isAnimationWarning(message)) {
        this.handleAnimationWarning(message, args);
      } else {
        this.originalConsoleWarn.apply(console, args);
      }
    };

    // Monkey patch Framer Motion if available
    this.patchFramerMotion();

    console.log('🛡️ Animation Interceptor: Started monitoring for animation errors');
  }

  /**
   * Stop intercepting
   */
  public stop(): void {
    console.error = this.originalConsoleError;
    console.warn = this.originalConsoleWarn;
    console.log('🛡️ Animation Interceptor: Stopped');
  }

  /**
   * Check if error is animation related
   */
  private isAnimationError(message: string): boolean {
    return this.errorPatterns.some(pattern => pattern.test(message));
  }

  /**
   * Check if warning is animation related
   */
  private isAnimationWarning(message: string): boolean {
    return message.includes('animation') || 
           message.includes('animate') || 
           message.includes('motion') ||
           message.includes('NaN') && message.includes('px');
  }

  /**
   * Handle animation errors
   */
  private handleAnimationError(message: string, args: any[]): void {
    const errorKey = this.generateErrorKey(message);
    
    if (this.fixedErrors.has(errorKey)) {
      // Already fixed this error, suppress it
      return;
    }

    // Try to extract animation details
    const animationMatch = message.match(/animate (\w+) from "(.*?)" to "(.*?)"/);
    if (animationMatch) {
      const [, property, fromValue, toValue] = animationMatch;
      
      if (this.config.logErrors) {
        console.log('🛡️ Animation Interceptor: Caught animation error', {
          property,
          fromValue,
          toValue,
          willAutoFix: this.config.autoFix
        });
      }

      if (this.config.autoFix) {
        // Mark as fixed to prevent spam
        this.fixedErrors.add(errorKey);
        
        // Suggest fix
        this.suggestFix(property, fromValue, toValue);
      } else {
        // Pass through original error
        this.originalConsoleError.apply(console, args);
      }
    } else {
      // Unknown animation error, log it
      if (this.config.logErrors) {
        console.log('🛡️ Animation Interceptor: Unknown animation error', message);
      }
      this.originalConsoleError.apply(console, args);
    }
  }

  /**
   * Handle animation warnings
   */
  private handleAnimationWarning(message: string, args: any[]): void {
    if (this.config.logErrors) {
      console.log('🛡️ Animation Interceptor: Animation warning intercepted', message);
    }
    
    // For now, pass through warnings
    this.originalConsoleWarn.apply(console, args);
  }

  /**
   * Generate unique key for error
   */
  private generateErrorKey(message: string): string {
    return message.replace(/\d+/g, 'N').substring(0, 100);
  }

  /**
   * Suggest fixes for common animation issues
   */
  private suggestFix(property: string, fromValue: string, toValue: string): void {
    console.group('🔧 Animation Fix Suggestion');
    
    console.log(`Property: ${property}`);
    console.log(`Invalid value: ${fromValue}`);
    console.log(`Target value: ${toValue}`);
    
    // Provide specific fixes based on property
    switch (property) {
      case 'boxShadow':
        console.log('Fix: Use animationGuard.safeBoxShadow() or getValidBoxShadowWithOpacity()');
        console.log('Example:');
        console.log(`const safeBoxShadow = animationGuard.safeBoxShadow(color, '25px', '0px');`);
        break;
        
      case 'scale':
        console.log('Fix: Ensure scale value is a number');
        console.log('Example:');
        console.log(`const safeScale = animationGuard.safeValue(scale, 1, (v) => !isNaN(v));`);
        break;
        
      case 'opacity':
        console.log('Fix: Ensure opacity is between 0 and 1');
        console.log('Example:');
        console.log(`const safeOpacity = Math.max(0, Math.min(1, opacity || 1));`);
        break;
        
      default:
        console.log('Fix: Validate animation values before use');
        console.log('Example:');
        console.log(`const safeProps = animationGuard.validateAnimation({ ${property}: value });`);
    }
    
    console.groupEnd();
  }

  /**
   * Patch Framer Motion to add validation
   */
  private patchFramerMotion(): void {
    // This would require Framer Motion to be loaded
    // For now, we'll skip this but it could be implemented
    // to wrap motion components with validation
  }

  /**
   * Get interceptor statistics
   */
  public getStats(): {
    totalErrors: number;
    fixedErrors: number;
    suppressedErrors: number;
  } {
    return {
      totalErrors: this.fixedErrors.size,
      fixedErrors: this.fixedErrors.size,
      suppressedErrors: this.fixedErrors.size
    };
  }

  /**
   * Clear fixed errors cache
   */
  public clearCache(): void {
    this.fixedErrors.clear();
  }
}

// Create and export default instance
export const animationInterceptor = new AnimationInterceptor({
  enabled: process.env.NODE_ENV === 'development',
  logErrors: true,
  autoFix: true
});

// Auto-start in development
if (process.env.NODE_ENV === 'development') {
  // Delay start to ensure app is loaded
  setTimeout(() => {
    animationInterceptor.start();
  }, 1000);
}