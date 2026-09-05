// Encrypted mail-in label generation via EasyPost.
// - Blind shipping: the printed label routes to a configurable blind hub
//   (EASYPOST_BLIND_DEST secret JSON) instead of the admin's private street;
//   falls back to the default receiving facility if unset.
// - The destination is NEVER returned to the frontend — only a masked label.
// - Admin is emailed tracking + full shipper details the instant a label is bought.
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import { secrets, waitUntil } from 'base44:runtime';
import { withRetry } from "../../shared/retry.ts";
import { logFault } from "../../shared/logFault.ts";

const ADMINS = ["tcincy23@gmail.com", "sinsinnatikeyconnection@gmail.com"];
const MASKED_LABEL = "SKC Secure Receiving Hub · Cincinnati, OH";
const DEFAULT_BLIND_DEST = { name: "SKC Secure Receiving", street1: "528 Bessinger Dr", city: "Cincinnati", state: "OH", zip: "45240", country: "US" };
const FROM = { company: "Sinsinnati Key Connection", street1: "528 Bessinger Dr", city: "Cincinnati", state: "OH", zip: "45240", country: "US" };

function blindDest() {
  const raw = secrets.get("EASYPOST_BLIND_DEST");
  if (!raw) return DEFAULT_BLIND_DEST;
  try {
    const o = JSON.parse(raw);
    if (o && o.street1 && o.city && o.state && o.zip) return o;
  } catch (_e) { /* malformed config — fall back */ }
  return DEFAULT_BLIND_DEST;
}

export default async function (req) {
  const MASKED = MASKED_LABEL;
  try {
    const body = await req.json().catch(() => ({}));
    const requestId = String(body.requestId || "");
    const weight = Number(body.weight) > 0 ? Number(body.weight) : 16;
    const base44 = createClientFromRequest(req);
    const TO = blindDest();

    let status = "requested", tracking = "", label = null;
    const key = secrets.get("EASYPOST_API_KEY");
    if (key) {
      try {
        const auth = btoa(key + ":");
        const shipRes = await withRetry(() => fetch("https://api.easypost.com/v2/shipments", {
          method: "POST",
          headers: { "Content-Type": "application/json", "Authorization": "Basic " + auth },
          body: JSON.stringify({ shipment: { from_address: FROM, to_address: TO, parcel: { weight } } }),
        }), { tries: 3 });
        const ship = await shipRes.json();
        if (shipRes.ok && ship.id) {
          const buyRes = await withRetry(() => fetch("https://api.easypost.com/v2/shipments/" + ship.id + "/buy", {
            method: "POST",
            headers: { "Content-Type": "application/json", "Authorization": "Basic " + auth },
            body: JSON.stringify({ carrier: "USPS", service: "Priority" }),
          }), { tries: 3 });
          const bought = await buyRes.json();
          if (buyRes.ok) {
            tracking = bought.tracking_code || ship.tracking_code || "";
            label = (bought.postage_label && bought.postage_label.label_url) || null;
            status = "label_ready";
          }
        }
      } catch (e) {
        try {
          waitUntil(logFault(base44, {
            code: "EASYPOST_FAILED",
            message: (e && e.message) ? e.message : String(e),
            stack: String((e && e.stack) || ""),
            component: "createMailInLabel",
            action: "blind mail-in label — requestId " + requestId,
            severity: "error",
            source: "backend",
          }).catch(() => {}));
        } catch (_le) { /* never break the response */ }
      }
    }

    if (requestId) {
      try {
        await base44.asServiceRole.entities.MailInRequest.update(requestId, {
          status, tracking_number: tracking, label_pdf_url: label || "",
        });
      } catch (_e) { /* non-fatal */ }
    }

    let rec = null;
    try { rec = requestId ? await base44.asServiceRole.entities.MailInRequest.get(requestId) : null; } catch (_e) {}

    // Instant admin alert — tracking + full shipper details.
    waitUntil((async () => {
      const bodyTxt =
        "MAIL-IN LABEL GENERATED — Sinsinnati Key Connection\n\n" +
        "Shipper:\n" +
        "  Name:    " + (rec ? rec.customer_name || "n/a" : "n/a") + "\n" +
        "  Email:   " + (rec ? rec.customer_email || "n/a" : "n/a") + "\n" +
        "  Phone:   " + (rec ? rec.customer_phone || "n/a" : "n/a") + "\n" +
        "  Item:    " + (rec ? rec.item_type || "n/a" : "n/a") + "\n" +
        "  Vehicle: " + (rec ? rec.vehicle || "n/a" : "n/a") + "\n" +
        "  Problem: " + (rec ? rec.problem || "n/a" : "n/a") + "\n\n" +
        "Tracking: " + (tracking || "label pending generation") + "\n" +
        "Destination (blind): " + MASKED + "\n" +
        "Status: " + status;
      for (const a of ADMINS) {
        try { await base44.asServiceRole.integrations.Core.SendEmail({ to: a, subject: "MAIL-IN // Label Generated — " + (tracking || "pending"), body: bodyTxt }); } catch (_e) {}
      }
    })().catch(() => {}));

    return Response.json({ status, tracking, label, destinationLabel: MASKED });
  } catch (error) {
    return Response.json({ status: "pending", message: "Label generation is being processed; you'll receive it by email shortly.", destinationLabel: MASKED });
  }
}