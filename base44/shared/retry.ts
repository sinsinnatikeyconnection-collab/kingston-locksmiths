// Shared server-side retry helper. Retries a flaky external call up to `tries`
// times with exponential backoff. Used by decodeVin (NHTSA), createMailInLabel
// (EasyPost), and create-checkout (Wix Payments) so a transient timeout is
// retried silently behind the scenes before the user is ever alerted.

export async function withRetry(fn, opts) {
  opts = opts || {};
  const tries = opts.tries || 3;
  const baseDelay = opts.baseDelay != null ? opts.baseDelay : 250;
  const factor = opts.backoff || 2;
  let lastErr;
  for (let i = 0; i < tries; i++) {
    try {
      return await fn(i);
    } catch (e) {
      lastErr = e;
      if (i < tries - 1) {
        const delay = baseDelay * Math.pow(factor, i);
        await new Promise((r) => setTimeout(r, delay));
      }
    }
  }
  throw lastErr;
}