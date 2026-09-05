import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';

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
    const booking = await base44.asServiceRole.entities.ServiceBooking.get(bookingId);
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
        await base44.asServiceRole.integrations.Core.SendEmail({
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

    // Mark as reviewing so a re-invoke won't spam duplicates
    try {
      await base44.asServiceRole.entities.ServiceBooking.update(bookingId, { status: "reviewing" });
    } catch (_e) {
      // non-fatal
    }

    return Response.json({ ok: true, results });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}