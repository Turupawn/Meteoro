import posthog from 'posthog-js';

// PostHog configuration
const POSTHOG_CONFIG = {
    api_key: 'phc_3vofleZVJy4GKoykZPb4bOEc7gjl6do5YoFDLB6NVYl',
    api_host: 'https://us.i.posthog.com',
    person_profiles: 'always',
    autocapture: true,
    capture_pageview: true,
    capture_pageleave: true,
    loaded: function(posthog) {
        // Enable exception autocapture
        posthog.capture('$exception_autocapture_enabled');
    }
};

// Initialize PostHog
posthog.init(POSTHOG_CONFIG.api_key, POSTHOG_CONFIG);

// Global error handler for unhandled errors
window.addEventListener('error', function(event) {
    const wallet = getWalletAddress();
    posthog.capture('$exception', {
        $exception_message: event.message,
        $exception_type: event.error?.name || 'Error',
        $exception_stack: event.error?.stack,
        $exception_filename: event.filename,
        $exception_lineno: event.lineno,
        $exception_colno: event.colno,
        wallet_address: wallet,
        user_agent: navigator.userAgent,
        url: window.location.href
    });
});

// Global error handler for unhandled promise rejections
window.addEventListener('unhandledrejection', function(event) {
    const wallet = getWalletAddress();
    posthog.capture('$exception', {
        $exception_message: event.reason?.message || 'Unhandled Promise Rejection',
        $exception_type: 'UnhandledPromiseRejection',
        $exception_stack: event.reason?.stack,
        $exception_promise_reason: event.reason,
        wallet_address: wallet,
        user_agent: navigator.userAgent,
        url: window.location.href
    });
});

// Helper function to get wallet address (will be set by main.js)
let getWalletAddress = () => 'unknown';

// Function to set the wallet address getter
export function setWalletAddressGetter(walletGetter) {
    getWalletAddress = walletGetter;
}

// Function to manually capture exceptions with wallet context
export function captureError(error, context = {}) {
    const wallet = getWalletAddress();
    posthog.captureException(error, {
        ...context,
        wallet_address: wallet,
        user_agent: navigator.userAgent,
        url: window.location.href,
        timestamp: new Date().toISOString()
    });
}

// Function to capture custom events
export function captureEvent(eventName, properties = {}) {
    const wallet = getWalletAddress();
    posthog.capture(eventName, {
        ...properties,
        wallet_address: wallet,
        timestamp: new Date().toISOString()
    });
}

// Function to capture blockchain operation errors
export function captureBlockchainError(error, operation, context = {}) {
    const wallet = getWalletAddress();
    posthog.captureException(error, {
        function: operation,
        wallet_address: wallet,
        error_type: 'blockchain_operation_failed',
        ...context
    });
}

// Function to capture game events
export function captureGameEvent(eventName, gameData = {}) {
    const wallet = getWalletAddress();
    posthog.capture(eventName, {
        ...gameData,
        wallet_address: wallet,
        timestamp: new Date().toISOString()
    });
}

// Test function for error tracking - can be called from browser console
export function testErrorTracking() {
    console.log("Testing error tracking...");
    
    // Test manual error capture
    const testError = new Error("Test error for PostHog tracking");
    captureError(testError, { 
        test: true, 
        function: 'testErrorTracking',
        timestamp: new Date().toISOString()
    });
    
    // Test PostHog event
    captureEvent('error_tracking_test', {
        test_successful: true
    });
    
    console.log("Error tracking test completed. Check PostHog dashboard for events.");
    return "Error tracking test completed";
}

// Make test function available globally for console testing
window.testErrorTracking = testErrorTracking;

// Export PostHog instance for direct access if needed
export { posthog };
