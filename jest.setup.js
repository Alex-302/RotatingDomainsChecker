// Suppress console logs during tests for cleaner output
// Only show errors and warnings during test runs

const originalConsole = global.console;

beforeAll(() => {
  global.console = {
    ...originalConsole,
    // Keep errors and warnings for debugging
    error: originalConsole.error,
    warn: originalConsole.warn,
    // Suppress info and debug logs
    log: () => {},  // No-op function
    info: () => {}, // No-op function
    debug: () => {}, // No-op function
  };
});

afterAll(() => {
  global.console = originalConsole;
});
