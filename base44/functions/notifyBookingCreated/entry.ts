const db = globalThis.__B44_DB__ || { auth:{ isAuthenticated: async()=>false, me: async()=>null }, entities:new Proxy({}, { get:()=>({ filter:async()=>[], get:async()=>null, create:async()=>({}), update:async()=>({}), delete:async()=>({}) }) }), integrations:{ Core:{ UploadFile:async()=>({ file_url:'' }) } } };

import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import { notifyCustomer } from '../../shared/notify.ts';

const ADMIN_EMAILS = [
  "tcincy23@gmail.com",
  "sinsinnatikeyconnection@gmail.com",
];

export default async function(req) {
  try {
    const base44 = createClientFromRequest(req);
    const body = await req.json().catch(() => ({}));
    const bookingId = body && body.bookingId;
    if (!bookingId) {
      return Response.json({ error: "bookingId required" }, { status: 400 });
    }

    // Fetch the booking (service role) and guard against re-notification spam
    const booking = await db.asServiceRole.entities.ServiceBooking.get(bookingId);
    if (!booking) {
      return Response.json({ error: "booking not found" }, { status: 404 });
    }
    if (booking.status && booking.status !== "received") {
      return Response.json({ ok: true, alreadyNotified: true });
    }

    const subject = `NEW BOOKING // ${booking.problem_category || "Service"} — ${booking.year || ""} ${booking.make || ""} ${booking.model || ""}`.trim();
    const bodyText = [
      "NEW INTAKE RECEIVED — Sinsinnati Key Connection",
      "",
      `Vehicle:   ${booking.year || ""} ${booking.make || ""} ${booking.model || ""} ${booking.engine_size ? "(" + booking.engine_size + ")" : ""}`.trim(),
      `VIN:       ${booking.vin || "n/a"}`,
      `Category:  ${booking.problem_category || "n/a"}`,
      `Area:      ${booking.problem_location || "n/a"}`,
      `Detail:    ${booking.problem_detail || "n/a"}`,
      `Urgency:   ${booking.urgency || "n/a"}`,
      `Slot:      ${booking.scheduled_date || "Emergency dispatch"}`,
      "",
      "Customer:",
      `  Name:  ${booking.customer_name || "n/a"}`,
      `  Email: ${booking.customer_email || "n/a"}`,
      `  Phone: ${booking.customer_phone || "n/a"}`,
      "",
      `Photos: ${(booking.photo_urls && booking.photo_urls.length) ? booking.photo_urls.join(" , ") : "none"}`,
    ].join("\n");

    const results = [];
    for (const email of ADMIN_EMAILS) {
      try {
        await db.asServiceRole.integrations.Core.SendEmail({
          to: email,
          from_name: "Sinsinnati Key Connection",
          subject,
          body: bodyText,
        });
        results.push({ email, sent: true });
      } catch (e) {
        results.push({ email, sent: false, error: e.message });
      }
    }

    // Best-effort confirmation to the buyer (only registered customers receive it).
    if (booking.customer_email) {
      const vline = `${booking.year || ""} ${booking.make || ""} ${booking.model || ""}`.trim();
      const custBody = [
        "Hi " + ((booking.customer_name || "there").split(" ")[0]) + ",",
        "",
        "We received your service booking for " + (vline || "your vehicle") + ".",
        "Category:  " + (booking.problem_category || "Service"),
        "Urgency:   " + (booking.urgency || "Standard"),
        (booking.scheduled_date ? "Appointment: " + booking.scheduled_date : "Dispatch:  Emergency / mobile — a tech will call you."),
        "",
        "A technician will reach out shortly to confirm details. For urgent roadside help, call or text us directly.",
        "",
        "— Sinsinnati Key Connection",
      ].join("\n");
      const cr = await notifyCustomer(base44, booking.customer_email, "Booking Received — Sinsinnati Key Connection", custBody, "booking confirmation");
      results.push({ email: booking.customer_email, customer: true, sent: cr.sent });
    }

    // Mark as reviewing so a re-invoke won't spam duplicates
    try {
      await db.asServiceRole.entities.ServiceBooking.update(bookingId, { status: "reviewing" });
    } catch (_e) {
      // non-fatal
    }

    return Response.json({ ok: true, results });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}