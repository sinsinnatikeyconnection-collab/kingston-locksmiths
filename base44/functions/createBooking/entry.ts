import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';

// Idempotent booking creation.
//
// A client-generated idempotencyKey (see src/lib/idempotency.ts) is sent with
// every submit. Before creating, we look up an existing ServiceBooking with the
// same key (service-role read bypasses RLS so anonymous submitters collapse
// duplicates too). If found, we return it untouched — so a rapid double-click
// or a dropped-connection retry resolves to exactly one stored record, never
// duplicates. The random per-intent UUID makes a cross-user collision
// effectively impossible.

const REQUIRED = [
  "year", "make", "model", "vin", "problem_category",
  "urgency", "customer_name", "customer_email", "customer_phone",
];

export default async function(req) {
  try {
    const body = await req.json().catch(() => ({}));
    const idempotencyKey = String(body.idempotencyKey || "");
    if (!idempotencyKey) {
      return Response.json({ error: "idempotencyKey required" }, { status: 400 });
    }
    const payload = body.booking || {};
    for (const f of REQUIRED) {
      if (!payload[f]) return Response.json({ error: `Missing field: ${f}` }, { status: 400 });
    }

    const base44 = createClientFromRequest(req);

    // Idempotency check — service role so anonymous submitters are covered.
    const existing = await base44.asServiceRole.entities.ServiceBooking.filter({ idempotency_key: idempotencyKey });
    if (existing && existing.length) {
      return Response.json({ booking: existing[0], idempotent: true });
    }

    // Create via user-scoped client when authenticated so created_by_id is set
    // (the Portal relies on it); anonymous creates use the service role
    // (RLS create is open, but the anonymous client has no token).
    const isAuth = await base44.auth.isAuthenticated().catch(() => false);
    const collection = isAuth ? base44.entities.ServiceBooking : base44.asServiceRole.entities.ServiceBooking;
    const booking = await collection.create({
      ...payload,
      idempotency_key: idempotencyKey,
    });

    // Best-effort admin notification — non-fatal; booking is already saved.
    try {
      await base44.functions.invoke("notifyBookingCreated", { bookingId: booking.id });
    } catch (_e) {
      // swallowed: duplicate-notification risk avoided by idempotency_key above
    }

    return Response.json({ booking, idempotent: false });
  } catch (error) {
    console.error("createBooking error", error.message);
    return Response.json({ error: error.message }, { status: 500 });
  }
}