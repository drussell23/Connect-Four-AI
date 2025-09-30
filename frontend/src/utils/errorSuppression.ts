/**
 * Browser Extension Error Suppression
 * Filters out noisy console errors from browser extensions in production
 */

export function initializeErrorSuppression() {
  // Only run in browser environment
  if (typeof window === 'undefined') return;

  // Store original console methods
  const originalError = console.error;
  const originalWarn = console.warn;
  const originalLog = console.log;

  // Patterns of extension-related errors to suppress
  const suppressPatterns = [
    /Unchecked runtime\.lastError/i,
    /The message port closed before a response was received/i,
    /Extension context invalidated/i,
    /Failed to load resource.*chrome-extension/i,
    /Access to .* from origin .* has been blocked/i,
    /content\.js:\d+/i,
    /Manifest.*Syntax error/i,
    /code:\s*403/i,
    /httpStatus:\s*200.*code:\s*403/i,
    /chrome-extension:\/\//i,
    /moz-extension:\/\//i,
    /safari-extension:\/\//i,
    /edge-extension:\/\//i,
  ];

  // Helper to check if message should be suppressed
  const shouldSuppress = (args: any[]): boolean => {
    try {
      const message = args
        .map(arg => {
          if (typeof arg === 'object') {
            return JSON.stringify(arg);
          }
          return String(arg);
        })
        .join(' ');
      
      return suppressPatterns.some(pattern => pattern.test(message));
    } catch {
      return false;
    }
  };

  // Override console.error
  console.error = function(...args: any[]) {
    if (!shouldSuppress(args)) {
      originalError.apply(console, args);
    }
  };

  // Override console.warn
  console.warn = function(...args: any[]) {
    if (!shouldSuppress(args)) {
      originalWarn.apply(console, args);
    }
  };

  // Override console.log
  console.log = function(...args: any[]) {
    if (!shouldSuppress(args)) {
      originalLog.apply(console, args);
    }
  };

  // Catch window error events
  window.addEventListener(
    'error',
    function(event: ErrorEvent) {
      if (event.message && suppressPatterns.some(pattern => pattern.test(event.message))) {
        event.preventDefault();
        event.stopPropagation();
        return false;
      }
    },
    true // Use capture phase
  );

  // Catch unhandled promise rejections
  window.addEventListener(
    'unhandledrejection',
    function(event: PromiseRejectionEvent) {
      try {
        const reason = String(event.reason);
        if (suppressPatterns.some(pattern => pattern.test(reason))) {
          event.preventDefault();
          event.stopPropagation();
          return false;
        }
      } catch {
        // Ignore errors in error handler
      }
    },
    true // Use capture phase
  );

  // Also suppress fetch errors from extensions
  const originalFetch = window.fetch;
  window.fetch = async function(...args: Parameters<typeof fetch>) {
    try {
      return await originalFetch.apply(window, args);
    } catch (error: any) {
      const errorStr = String(error);
      if (suppressPatterns.some(pattern => pattern.test(errorStr))) {
        // Silently fail for extension errors
        return new Response('{}', { status: 200 });
      }
      throw error;
    }
  };
}