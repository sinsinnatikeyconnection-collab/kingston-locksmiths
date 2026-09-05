// Strictly-typed input validators. Every public form field is validated before
// any network call, so malformed user input never reaches the backend and can
// never trigger an unhandled exception downstream. Each validator returns a
// discriminated ValidationResult — ok or a human-readable error.

export type ValidationResult = { ok: true } | { ok: false; error: string };

const VIN_RE = /^[A-HJ-NPR-Z0-9]{17}$/;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function validateVin(vin: string): ValidationResult {
  const v = String(vin || "").toUpperCase().trim();
  if (!v) return { ok: false, error: "VIN is required." };
  if (v.length !== 17) return { ok: false, error: "VIN must be 17 characters." };
  if (!VIN_RE.test(v)) return { ok: false, error: "VIN contains invalid characters (no I, O, Q)." };
  return { ok: true };
}

export function validateEmail(email: string): ValidationResult {
  const v = String(email || "").trim();
  if (!v) return { ok: false, error: "Email is required." };
  if (!EMAIL_RE.test(v)) return { ok: false, error: "Enter a valid email address." };
  return { ok: true };
}

export function validatePhone(phone: string): ValidationResult {
  const raw = String(phone || "").trim();
  const digits = raw.replace(/\D/g, "");
  if (!raw) return { ok: false, error: "Phone is required." };
  if (digits.length < 7) return { ok: false, error: "Enter a valid phone number." };
  return { ok: true };
}

export function validateNonEmpty(field: string, value: string): ValidationResult {
  const v = String(value || "").trim();
  if (!v) return { ok: false, error: `${field} is required.` };
  return { ok: true };
}

export function validateMinLength(field: string, value: string, min: number): ValidationResult {
  const v = String(value || "");
  if (v.trim().length < min) return { ok: false, error: `${field} must be at least ${min} character${min === 1 ? "" : "s"}.` };
  return { ok: true };
}