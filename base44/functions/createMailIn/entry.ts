const db = globalThis.__B44_DB__ || { auth:{ isAuthenticated: async()=>false, me: async()=>null }, entities:new Proxy({}, { get:()=>({ filter:async()=>[], get:async()=>null, create:async()=>({}), update:async()=>({}), delete:async()=>({}) }) }), integrations:{ Core:{ UploadFile:async()=>({ file_url:'' }) } } };

import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import { validateContact } from '../../shared/validation.ts';

// Idempotent mail-in request creation + label generation.
//
// Mirrors createBooking: a client-generated idempotencyKey collapses duplicate
// submits (rapid clicks, dropped-connection retries) into a single stored
// request. Critically, on a replay we return the already-generated label from
// the existing record instead of calling createMailInLabel again — so a retried
// request never buys a second EasyPost label (a real shipping charge).
//
// Service role is used for the dedup read so anonymous submitters are covered.

const REQUIRED = ["customer_name", "customer_email", "item_type", "vehicle", "problem"];

export default async function(req) {
  try {
    const body = await req.json().catch(() => ({}));
    const idempotencyKey = String(body.idempotencyKey || "");
    if (!idempotencyKey) {
      return Response.json({ error: "idempotencyKey required" }, { status: 400 });
    }
    const payload = body.request || {};
    for (const f of REQUIRED) {
      if (!payload[f]) return Response.json({ error: `Missing field: ${f}` }, { status: 400 });
    }

    // Server-side format validation — the public mail-in endpoint only checked
    // non-empty before, so malformed/spam submits could reach the database and
    // trigger an admin label/email. Reject bad email/phone/name up front.
    const contactErr = validateContact(payload);
    if (contactErr) return Response.json({ error: contactErr }, { status: 400 });

    const base44 = createClientFromRequest(req);

    // Idempotency: return the existing record + its existing label on a replay.
    const existing = await db.asServiceRole.entities.MailInRequest.filter({ idempotency_key: idempotencyKey });
    if (existing && existing.length) {
      const r = existing[0];
      return Response.json({
        request: r,
        labelResult: { status: r.status, tracking: r.tracking_number, label: r.label_pdf_url || "" },
        idempotent: true,
      });
    }

    // Create the request — user-scoped when authenticated (Portal visibility),
    // service role otherwise (RLS create is open).
    const collection = db.entities.MailInRequest;
    const request = await collection.create({
      ...payload,
      status: "requested",
      idempotency_key: idempotencyKey,
    });

    // Generate the shipping label — best-effort; updates the record in place.
    let labelResult = { status: "requested", tracking: "", label: "" };
    try {
      const lr = await db.functions.invoke("createMailInLabel", { requestId: request.id });
      labelResult = (lr && lr.data) || labelResult;
    } catch (_e) {
      // Label generation failed — record remains "requested"; user is emailed later.
    }

    return Response.json({ request, labelResult, idempotent: false });
  } catch (error) {
    console.error("createMailIn error", error.message);
    return Response.json({ error: error.message }, { status: 500 });
  }
}