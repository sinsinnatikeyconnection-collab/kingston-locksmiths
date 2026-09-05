export async function withRetry<T>(
  fn: (attempt: number) => Promise<T>,
  options: { tries?: number; baseDelay?: number; backoff?: number } = {},
): Promise<T> {
  const tries = options.tries || 3;
  const baseDelay = options.baseDelay ?? 250;
  const factor = options.backoff || 2;
  let lastError: unknown;

  for (let attempt = 0; attempt < tries; attempt += 1) {
    try {
      return await fn(attempt);
    } catch (error) {
      lastError = error;
      if (attempt < tries - 1) {
        await new Promise((resolve) => setTimeout(resolve, baseDelay * Math.pow(factor, attempt)));
      }
    }
  }

  throw lastError;
}