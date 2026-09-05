const db = globalThis.__B44_DB__ || { auth:{ isAuthenticated: async()=>false, me: async()=>null }, entities:new Proxy({}, { get:()=>({ filter:async()=>[], get:async()=>null, create:async()=>({}), update:async()=>({}), delete:async()=>({}) }) }), integrations:{ Core:{ UploadFile:async()=>({ file_url:'' }) } } };

// Creates (or returns an existing) unpaid Invoice for a per-VIN premium
// diagnostic unlock. Public app — customers are not logged in, so the unlock is
// keyed by their email. Service-role creates the invoice (RLS create is admin-only).
// Idempotent: an existing unpaid invoice for the same email+VIN is reused instead
// of creating a duplicate — the client then calls `create-checkout` to open payment.

import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import { waitUntil } from 'base44:runtime';
import { logFault } from "../../shared/logFault.ts";
import { notifyCustomer } from "../../shared/notify.ts";

const VIN_RE = /^[A-HJ-NPR-Z0-9]{17}$/;
const PRICE = 25.00;
const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;
const ADMINS = ["tcincy23@gmail.com", "sinsinnatikeyconnection@gmail.com"];

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
    try { existing = await db.asServiceRole.entities.Invoice.filter({ owner_email_lower: email }); } catch (_e) {}
    const dup = (existing || []).find((i) => String(i.description || "").includes(vin) && i.status === "unpaid");
    if (dup) return Response.json({ invoiceId: dup.id, idempotent: true });

    const invoice_code = "VIN-" + vin.slice(-6) + "-" + Math.random().toString(36).slice(2, 8);
    const inv = await db.asServiceRole.entities.Invoice.create({
      invoice_code,
      owner_email: email,
      owner_email_lower: email,
      description: "Premium VIN Diagnostic Unlock — " + vin,
      amount: PRICE,
      status: "unpaid",
    });
    // Notify both company addresses + (best-effort) the buyer.
    waitUntil((async () => {
      const subj = "NEW VIN DIAGNOSTIC REQUEST // " + vin;
      const aBody = [
        "VIN DIAGNOSTIC UNLOCK REQUESTED — Sinsinnati Key Connection",
        "",
        "VIN:     " + vin,
        "Buyer:   " + email,
        "Price:   $" + PRICE.toFixed(2) + " (invoice unpaid — awaiting checkout)",
        "Invoice: " + invoice_code,
      ].join("\n");
      for (const a of ADMINS) {
        try { await db.asServiceRole.integrations.Core.SendEmail({ to: a, from_name: "Sinsinnati Key Connection", subject: subj, body: aBody }); } catch (_e) {}
      }
      const cBody = [
        "Hi there,",
        "",
        "We received your request for a Premium VIN Diagnostic Report for " + vin + ".",
        "Complete the $" + PRICE.toFixed(2) + " checkout from your customer portal to unlock the full deep-OEM report instantly.",
        "",
        "— Sinsinnati Key Connection",
      ].join("\n");
      await notifyCustomer(base44, email, "VIN Diagnostic Request Received — Sinsinnati Key Connection", cBody, "vin unlock request");
    })().catch(() => {}));

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