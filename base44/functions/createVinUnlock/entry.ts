// Creates (or returns an existing) unpaid Invoice for a per-VIN premium
// diagnostic unlock. Public app — customers are not logged in, so the unlock is
// keyed by their email. Service-role creates the invoice (RLS create is admin-only).
// Idempotent: an existing unpaid invoice for the same email+VIN is reused instead
// of creating a duplicate — the client then calls `create-checkout` to open payment.

import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import { waitUntil } from 'base44:runtime';
import { logFault } from "../../shared/logFault.ts";

const VIN_RE = /^[A-HJ-NPR-Z0-9]{17}$/;
const PRICE = 25.00;
const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

export default async function (req) {
  const base44 = createClientFromRequest(req);
  try {
    const body = await req.json().catch(() => ({}));
    const vin = String(body.vin || "").toUpperCase().trim();
    const email = String(body.email || "").toLowerCase().trim();
    if (!VIN_RE.test(vin)) return Response.json({ error: "Invalid VIN" }, { status: 400 });
    if (!email || !EMAIL_RE.test(email)) return Response.json({ error: "Valid email required" }, { status: 400 });

    // Idempotent reuse of an existing unpaid invoice for this email+VIN.
    let existing = [];
    try { existing = await base44.asServiceRole.entities.Invoice.filter({ owner_email_lower: email }); } catch (_e) {}
    const dup = (existing || []).find((i) => String(i.description || "").includes(vin) && i.status === "unpaid");
    if (dup) return Response.json({ invoiceId: dup.id, idempotent: true });

    const invoice_code = "VIN-" + vin.slice(-6) + "-" + Math.random().toString(36).slice(2, 8);
    const inv = await base44.asServiceRole.entities.Invoice.create({
      invoice_code,
      owner_email: email,
      owner_email_lower: email,
      description: "Premium VIN Diagnostic Unlock — " + vin,
      amount: PRICE,
      status: "unpaid",
    });
    return Response.json({ invoiceId: inv.id });
  } catch (error) {
    waitUntil(logFault(base44, {
      code: "VIN_UNLOCK_ERR",
      message: error.message,
      stack: String(error.stack || ""),
      component: "createVinUnlock",
      action: "VIN unlock invoice",
      severity: "error",
      source: "backend",
    }).catch(() => {}));
    return Response.json({ error: error.message }, { status: 500 });
  }
}