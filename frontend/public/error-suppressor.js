/**
 * Ultra-early error suppression for production
 * This runs before ANY other script, including React
 */
(function() {
  'use strict';
  
  // Store original methods immediately
  var originalError = console.error;
  var originalWarn = console.warn;
  var originalLog = console.log;
  var originalTrace = console.trace;
  var originalOnError = window.onerror;
  
  // Comprehensive patterns to suppress
  var patterns = [
    /Manifest.*Line.*column.*Syntax error/i,
    /content\.js:\d+/,
    /contentscript\.js/,
    /inject\.js/,
    /Unchecked runtime\.lastError/,
    /The message port closed before a response was received/,
    /Extension context invalidated/,
    /chrome-extension:\/\//,
    /moz-extension:\/\//,
    /safari-extension:\/\//,
    /edge-extension:\/\//,
    /\{.*name:\s*['"]i['"].*code:\s*403.*\}/,
    /httpStatus:\s*200.*code:\s*403/,
    /code:\s*403.*httpError:\s*false/,
    /Failed to load resource.*extension/,
    /Access to.*blocked.*CORS/,
    /chrome\.runtime\.sendMessage/,
    /chrome\.runtime\.connect/,
    /chrome\.storage/,
    /browser\.runtime/
  ];
  
  // Helper to check if should suppress
  function shouldSuppress(str) {
    if (!str) return false;
    var text = typeof str === 'object' ? JSON.stringify(str) : String(str);
    return patterns.some(function(pattern) {
      return pattern.test(text);
    });
  }
  
  // Helper to check all arguments
  function anyArgMatches(args) {
    return Array.prototype.slice.call(args).some(function(arg) {
      try {
        if (arg && arg.stack) return shouldSuppress(arg.stack);
        return shouldSuppress(arg);
      } catch (e) {
        return false;
      }
    });
  }
  
  // Override console methods
  console.error = function() {
    if (!anyArgMatches(arguments)) {
      originalError.apply(console, arguments);
    }
  };
  
  console.warn = function() {
    if (!anyArgMatches(arguments)) {
      originalWarn.apply(console, arguments);
    }
  };
  
  console.log = function() {
    if (!anyArgMatches(arguments)) {
      originalLog.apply(console, arguments);
    }
  };
  
  console.trace = function() {
    if (!anyArgMatches(arguments)) {
      originalTrace.apply(console, arguments);
    }
  };
  
  // Global error handler
  window.onerror = function(message, source, lineno, colno, error) {
    var errorInfo = [message, source, error && error.stack].filter(Boolean).join(' ');
    if (shouldSuppress(errorInfo)) {
      return true; // Suppress
    }
    if (originalOnError) {
      return originalOnError(message, source, lineno, colno, error);
    }
    return false;
  };
  
  // Error event listener (capture phase)
  window.addEventListener('error', function(e) {
    var errorInfo = [e.message, e.filename, e.error && e.error.stack].filter(Boolean).join(' ');
    if (shouldSuppress(errorInfo)) {
      e.preventDefault();
      e.stopPropagation();
      e.stopImmediatePropagation();
      return false;
    }
  }, true);
  
  // Promise rejection handler
  window.addEventListener('unhandledrejection', function(e) {
    try {
      var reason = e.reason;
      var reasonStr = reason instanceof Error ? 
        reason.toString() + ' ' + reason.stack : 
        JSON.stringify(reason);
      
      if (shouldSuppress(reasonStr)) {
        e.preventDefault();
        e.stopPropagation();
        e.stopImmediatePropagation();
        return false;
      }
    } catch (err) {
      // Ignore errors in error handler
    }
  }, true);
  
  // Intercept dynamically added scripts
  if (typeof MutationObserver !== 'undefined') {
    var observer = new MutationObserver(function(mutations) {
      mutations.forEach(function(mutation) {
        Array.prototype.forEach.call(mutation.addedNodes, function(node) {
          if (node.tagName === 'SCRIPT' && node.src) {
            if (/chrome-extension|moz-extension|content\.js|inject\.js/.test(node.src)) {
              node.remove();
            }
          }
        });
      });
    });
    
    // Start observing as soon as possible
    var startObserving = function() {
      observer.observe(document.documentElement || document, {
        childList: true,
        subtree: true
      });
    };
    
    if (document.documentElement) {
      startObserving();
    } else {
      // If documentElement doesn't exist yet, wait for it
      var checkInterval = setInterval(function() {
        if (document.documentElement) {
          clearInterval(checkInterval);
          startObserving();
        }
      }, 1);
    }
  }
  
  // Override fetch to suppress extension errors
  if (window.fetch) {
    var originalFetch = window.fetch;
    window.fetch = function() {
      var args = arguments;
      return originalFetch.apply(window, args).catch(function(error) {
        if (shouldSuppress(error.toString())) {
          return new Response('{}', { status: 200 });
        }
        throw error;
      });
    };
  }
})();