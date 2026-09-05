// Strictly-typed idempotency primitives for client-side mutations.
//
// A stable key is generated once per *intent* (e.g. one booking submission) and
// persisted in sessionStorage for the form's lifetime — including across a
// dropped-connection retry. The backend createBooking function uses this key to
// collapse duplicate submits into a single stored record, so rapid clicking or
// a retried request can never produce duplicate data.

export function newIdempotencyKey(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `${Date.now()}-${Math.random().toString(16).slice(2)}-${Math.random().toString(16).slice(2)}`;
}

const KEY_PREFIX = "skc_idem_";

export function persistIdempotencyKey(formKey: string, idempotencyKey: string): void {
  try {
    sessionStorage.setItem(KEY_PREFIX + formKey, idempotencyKey);
  } catch {
    // sessionStorage unavailable (private mode) — a fresh key is generated
    // instead; only cross-retry dedup is lost, not correctness.
  }
}

export function loadIdempotencyKey(formKey: string): string | null {
  try {
    return sessionStorage.getItem(KEY_PREFIX + formKey);
  } catch {
    return null;
  }
}

export function clearIdempotencyKey(formKey: string): void {
  try {
    sessionStorage.removeItem(KEY_PREFIX + formKey);
  } catch {
    // ignore
  }
}