/**
 * Advanced Browser Extension Error Suppression
 * Multi-layered approach to eliminate all extension-related errors in production
 */

export function initializeErrorSuppression() {
  // Only run in browser environment
  if (typeof window === 'undefined') return;

  // Store original console methods
  const originalError = console.error;
  const originalWarn = console.warn;
  const originalLog = console.log;
  const originalTrace = console.trace;
  const originalDebug = console.debug;

  // Comprehensive patterns of extension-related errors to suppress
  const suppressPatterns = [
    // Browser Extension Errors
    /Unchecked runtime\.lastError/i,
    /The message port closed before a response was received/i,
    /Extension context invalidated/i,
    /chrome-extension:\/\//i,
    /moz-extension:\/\//i,
    /safari-extension:\/\//i,
    /edge-extension:\/\//i,
    /content\.js:\d+/i,
    /contentscript\.js:\d+/i,
    /inject\.js:\d+/i,
    
    // Manifest Errors
    /Manifest.*Syntax error/i,
    /Manifest.*Line:\s*\d+,\s*column:\s*\d+/i,
    /Failed to load resource.*manifest/i,
    
    // Network/Permission Errors from Extensions
    /code:\s*403/i,
    /httpStatus:\s*200.*code:\s*403/i,
    /\{.*name:\s*['"]i['"].*code:\s*403.*\}/i,
    /httpError:\s*false.*code:\s*403/i,
    /Access to .* from origin .* has been blocked/i,
    /Failed to load resource.*chrome-extension/i,
    
    // Stack trace patterns
    /^\s*at\s+.*\(chrome-extension:\/\//i,
    /Error in event handler for/i,
    /Cannot read properties of undefined.*chrome\./i,
    /chrome\.runtime\.sendMessage/i,
    /chrome\.runtime\.connect/i,
    /chrome\.storage/i,
    /browser\.runtime/i,
  ];

  // Helper to stringify arguments safely
  const stringifyArg = (arg: any): string => {
    try {
      if (arg === null || arg === undefined) return String(arg);
      if (typeof arg === 'string') return arg;
      if (arg instanceof Error) return arg.toString() + ' ' + (arg.stack || '');
      if (typeof arg === 'object') return JSON.stringify(arg);
      return String(arg);
    } catch {
      return '[Unstringifiable Object]';
    }
  };

  // Helper to check if message should be suppressed
  const shouldSuppress = (args: any[]): boolean => {
    try {
      const message = args.map(stringifyArg).join(' ');
      return suppressPatterns.some(pattern => pattern.test(message));
    } catch {
      return false;
    }
  };

  // Override all console methods
  console.error = function(...args: any[]) {
    if (!shouldSuppress(args)) {
      originalError.apply(console, args);
    }
  };

  console.warn = function(...args: any[]) {
    if (!shouldSuppress(args)) {
      originalWarn.apply(console, args);
    }
  };

  console.log = function(...args: any[]) {
    if (!shouldSuppress(args)) {
      originalLog.apply(console, args);
    }
  };

  console.trace = function(...args: any[]) {
    if (!shouldSuppress(args)) {
      originalTrace.apply(console, args);
    }
  };

  console.debug = function(...args: any[]) {
    if (!shouldSuppress(args)) {
      originalDebug.apply(console, args);
    }
  };

  // Global error handler (capture phase)
  window.addEventListener(
    'error',
    function(event: ErrorEvent) {
      const errorInfo = [
        event.message,
        event.filename,
        event.error?.stack
      ].filter(Boolean).join(' ');

      if (suppressPatterns.some(pattern => pattern.test(errorInfo))) {
        event.preventDefault();
        event.stopPropagation();
        event.stopImmediatePropagation();
        return false;
      }
    },
    true // Use capture phase
  );

  // Additional global error handler
  const originalOnError = window.onerror;
  window.onerror = function(message, source, lineno, colno, error) {
    const errorInfo = [
      String(message),
      source,
      error?.stack
    ].filter(Boolean).join(' ');

    if (suppressPatterns.some(pattern => pattern.test(errorInfo))) {
      return true; // Suppress error
    }

    if (originalOnError) {
      return originalOnError(message, source, lineno, colno, error);
    }
    return false;
  };

  // Catch unhandled promise rejections
  window.addEventListener(
    'unhandledrejection',
    function(event: PromiseRejectionEvent) {
      try {
        const reasonStr = stringifyArg(event.reason);
        if (suppressPatterns.some(pattern => pattern.test(reasonStr))) {
          event.preventDefault();
          event.stopPropagation();
          event.stopImmediatePropagation();
          return false;
        }
      } catch {
        // Ignore errors in error handler
      }
    },
    true // Use capture phase
  );

  // Intercept fetch to suppress extension errors
  const originalFetch = window.fetch;
  window.fetch = async function(...args: Parameters<typeof fetch>) {
    try {
      return await originalFetch.apply(window, args);
    } catch (error: any) {
      const errorStr = stringifyArg(error);
      if (suppressPatterns.some(pattern => pattern.test(errorStr))) {
        // Return mock response for extension errors
        return new Response('{}', {
          status: 200,
          statusText: 'OK',
          headers: new Headers({ 'content-type': 'application/json' })
        });
      }
      throw error;
    }
  };

  // Intercept XMLHttpRequest
  const OriginalXHR = window.XMLHttpRequest;
  window.XMLHttpRequest = class extends OriginalXHR {
    constructor() {
      super();
      
      const originalOpen = this.open;
      this.open = function(...args: any[]) {
        const url = args[1];
        if (typeof url === 'string' && /chrome-extension|moz-extension|safari-extension/.test(url)) {
          // Don't actually make the request
          return;
        }
        return originalOpen.apply(this, args as any);
      };
    }
  } as any;

  // Remove dynamically injected extension scripts
  if (typeof MutationObserver !== 'undefined') {
    const observer = new MutationObserver((mutations) => {
      mutations.forEach(mutation => {
        mutation.addedNodes.forEach(node => {
          if (node.nodeName === 'SCRIPT' && node instanceof HTMLScriptElement) {
            const src = node.src;
            if (src && /chrome-extension|moz-extension|content\.js|inject\.js/.test(src)) {
              node.remove();
            }
          }
        });
      });
    });

    // Start observing when DOM is ready
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', () => {
        observer.observe(document.documentElement, {
          childList: true,
          subtree: true
        });
      });
    } else {
      observer.observe(document.documentElement, {
        childList: true,
        subtree: true
      });
    }
  }

  // Override Error.prototype.stack to filter extension frames
  const originalStackDescriptor = Object.getOwnPropertyDescriptor(Error.prototype, 'stack');
  if (originalStackDescriptor) {
    Object.defineProperty(Error.prototype, 'stack', {
      get: function() {
        const stack = originalStackDescriptor.get?.call(this);
        if (typeof stack === 'string') {
          // Filter out extension-related stack frames
          return stack
            .split('\n')
            .filter(line => !/(chrome-extension|moz-extension|content\.js|inject\.js)/.test(line))
            .join('\n');
        }
        return stack;
      },
      set: originalStackDescriptor.set,
      enumerable: originalStackDescriptor.enumerable,
      configurable: true
    });
  }
}