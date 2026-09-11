// Defensive, strictly-typed Result + retry-on-network-dropout wrapper for
// backend calls. Network dropouts (AbortError / TypeError "Failed to fetch")
// are retried with exponential backoff; non-network errors surface immediately
// as an Err. safeInvoke NEVER throws to the caller — every outcome is a typed
// Result, so a caller can never produce an unhandled exception from a call.
//
// Rejecting malformed inputs BEFORE the call is the responsibility of
// validation.ts; safeInvoke only protects the transport layer.

export type Result<T> =
  | { ok: true; value: T }
  | { ok: false; error: string; retryable: boolean };

function isNetworkDropout(e: unknown): boolean {
  const m = String((e as Error)?.message || e || "").toLowerCase();
  return (
    (e instanceof DOMException && (e as DOMException).name === "AbortError") ||
    e instanceof TypeError ||
    m.includes("failed to fetch") ||
    m.includes("network") ||
    m.includes("timeout") ||
    m.includes("aborted") ||
    m.includes("load failed")
  );
}

export async function safeInvoke<T>(
  fn: () => Promise<T>,
  opts: { retries?: number; baseMs?: number } = {},
): Promise<Result<T>> {
  const retries = opts.retries ?? 2;
  const baseMs = opts.baseMs ?? 400;
  let lastErr: unknown = null;

  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const value = await fn();
      return { ok: true, value };
    } catch (e) {
      lastErr = e;
      if (attempt < retries && isNetworkDropout(e)) {
        const delay = baseMs * Math.pow(2, attempt);
        await new Promise((r) => setTimeout(r, delay));
        continue;
      }
      return { ok: false, error: String((e as Error)?.message || e || "Unknown error"), retryable: isNetworkDropout(e) };
    }
  }
  return {
    ok: false,
    error: String((lastErr as Error)?.message || lastErr || "Unknown error"),
    retryable: isNetworkDropout(lastErr),
  };
}