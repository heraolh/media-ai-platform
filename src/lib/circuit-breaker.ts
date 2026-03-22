/**
 * Circuit Breaker — in-memory implementation
 * States: CLOSED → OPEN → HALF_OPEN → CLOSED
 */

export type CircuitState = 'CLOSED' | 'OPEN' | 'HALF_OPEN';

interface CircuitBreakerConfig {
  failureThreshold: number;    // consecutive failures before OPEN (default 5)
  errorRateThreshold: number;  // error rate 0-1 (default 0.5)
  resetTimeout: number;        // ms to stay OPEN before HALF_OPEN (default 600_000 = 10 min)
  halfOpenRequests: number;    // probe requests allowed in HALF_OPEN (default 1)
}

interface CircuitBreakerState {
  state: CircuitState;
  failures: number;
  successes: number;
  requests: number;
  lastFailureTime: number;
  halfOpenAttempts: number;
}

const DEFAULT_CONFIG: CircuitBreakerConfig = {
  failureThreshold: 5,
  errorRateThreshold: 0.5,
  resetTimeout: 10 * 60 * 1000, // 10 minutes
  halfOpenRequests: 1,
};

// Global in-memory store (lives for the lifetime of the Node process)
const store = new Map<string, CircuitBreakerState>();

function getState(service: string): CircuitBreakerState {
  if (!store.has(service)) {
    store.set(service, {
      state: 'CLOSED',
      failures: 0,
      successes: 0,
      requests: 0,
      lastFailureTime: 0,
      halfOpenAttempts: 0,
    });
  }
  return store.get(service)!;
}

function setState(service: string, patch: Partial<CircuitBreakerState>) {
  const current = getState(service);
  store.set(service, { ...current, ...patch });
}

/** Returns current circuit state for a service (transitions OPEN→HALF_OPEN if timeout elapsed). */
export function getCircuitState(service: string, config: Partial<CircuitBreakerConfig> = {}): CircuitState {
  const cfg = { ...DEFAULT_CONFIG, ...config };
  const s = getState(service);

  if (s.state === 'OPEN') {
    const elapsed = Date.now() - s.lastFailureTime;
    if (elapsed >= cfg.resetTimeout) {
      setState(service, { state: 'HALF_OPEN', halfOpenAttempts: 0 });
      return 'HALF_OPEN';
    }
  }

  return s.state;
}

/** Call before making a request. Returns false if circuit is OPEN (should skip the call). */
export function canRequest(service: string, config: Partial<CircuitBreakerConfig> = {}): boolean {
  const cfg = { ...DEFAULT_CONFIG, ...config };
  const state = getCircuitState(service, cfg);

  if (state === 'CLOSED') return true;
  if (state === 'OPEN') return false;

  // HALF_OPEN: allow only cfg.halfOpenRequests probes
  const s = getState(service);
  if (s.halfOpenAttempts < cfg.halfOpenRequests) {
    setState(service, { halfOpenAttempts: s.halfOpenAttempts + 1 });
    return true;
  }
  return false;
}

/** Call after a successful request. */
export function recordSuccess(service: string, config: Partial<CircuitBreakerConfig> = {}) {
  const s = getState(service);
  if (s.state === 'HALF_OPEN') {
    // Probe succeeded → close circuit
    setState(service, { state: 'CLOSED', failures: 0, successes: 0, requests: 0, halfOpenAttempts: 0 });
  } else {
    setState(service, { successes: s.successes + 1, requests: s.requests + 1 });
  }
}

/** Call after a failed request. */
export function recordFailure(service: string, config: Partial<CircuitBreakerConfig> = {}) {
  const cfg = { ...DEFAULT_CONFIG, ...config };
  const s = getState(service);
  const newFailures = s.failures + 1;
  const newRequests = s.requests + 1;
  const errorRate = newRequests > 0 ? newFailures / newRequests : 0;

  if (
    s.state === 'HALF_OPEN' ||
    newFailures >= cfg.failureThreshold ||
    (newRequests >= 10 && errorRate >= cfg.errorRateThreshold)
  ) {
    setState(service, {
      state: 'OPEN',
      failures: newFailures,
      requests: newRequests,
      lastFailureTime: Date.now(),
      halfOpenAttempts: 0,
    });
  } else {
    setState(service, { failures: newFailures, requests: newRequests, lastFailureTime: Date.now() });
  }
}

/** Get full status info for health checks. */
export function getCircuitInfo(service: string, config: Partial<CircuitBreakerConfig> = {}) {
  const state = getCircuitState(service, config);
  const s = getState(service);
  return {
    state,
    failures: s.failures,
    requests: s.requests,
    lastFailureTime: s.lastFailureTime,
  };
}

/**
 * Wrap an async call with circuit breaker logic.
 * Throws CircuitOpenError if the circuit is OPEN.
 */
export class CircuitOpenError extends Error {
  constructor(service: string) {
    super(`Circuit breaker OPEN for service: ${service}`);
    this.name = 'CircuitOpenError';
  }
}

export async function withCircuitBreaker<T>(
  service: string,
  fn: () => Promise<T>,
  config: Partial<CircuitBreakerConfig> = {}
): Promise<T> {
  if (!canRequest(service, config)) {
    throw new CircuitOpenError(service);
  }
  try {
    const result = await fn();
    recordSuccess(service, config);
    return result;
  } catch (err) {
    recordFailure(service, config);
    throw err;
  }
}

/**
 * Exponential backoff retry helper.
 * @param fn async function to retry
 * @param maxAttempts total attempts (default 3)
 * @param baseDelayMs initial delay in ms (default 1000)
 */
export async function withRetry<T>(
  fn: () => Promise<T>,
  maxAttempts = 3,
  baseDelayMs = 1000
): Promise<T> {
  let lastErr: unknown;
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastErr = err;
      if (attempt < maxAttempts - 1) {
        await new Promise((r) => setTimeout(r, baseDelayMs * Math.pow(2, attempt)));
      }
    }
  }
  throw lastErr;
}
