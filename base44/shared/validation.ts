// Server-side input validation shared by the public booking + mail-in
// endpoints. The public client forms (IntakeForm / MailIn) run the same
// checks client-side, but those are bypassable on a public function — so
// validating again here is the real gatekeeper that keeps malformed/
// spam/garbage submissions out of the database and out of the admin alert
// emails. Each validator returns a human-readable error string, or null on
// success.

const VIN_RE = /^[A-HJ-NPR-Z0-9]{17}$/;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function validateVinField(vin: string): string | null {
  const v = String(vin || "").toUpperCase().trim();
  // VIN is optional — only validate the format when one is provided.
  if (!v) return null;
  if (!VIN_RE.test(v)) return "Invalid VIN — must be 17 characters (no I, O, Q).";
  return null;
}

export function validateContact(payload: Record<string, unknown>): string | null {
  const email = String((payload && payload.customer_email) || "").trim();
  if (!EMAIL_RE.test(email)) return "A valid email address is required.";
  const phone = String((payload && payload.customer_phone) || "").trim();
  if (phone.replace(/\D/g, "").length < 7) return "A valid phone number is required.";
  const name = String((payload && payload.customer_name) || "").trim();
  if (name.length < 2) return "A valid name is required.";
  return null;
}