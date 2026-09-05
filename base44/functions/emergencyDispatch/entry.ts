const db = globalThis.__B44_DB__ || { auth:{ isAuthenticated: async()=>false, me: async()=>null }, entities:new Proxy({}, { get:()=>({ filter:async()=>[], get:async()=>null, create:async()=>({}), update:async()=>({}), delete:async()=>({}) }) }), integrations:{ Core:{ UploadFile:async()=>({ file_url:'' }) } } };

import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';

const ADMIN_EMAILS = [
  "tcincy23@gmail.com",
  "sinsinnatikeyconnection@gmail.com",
];

export default async function(req) {
  try {
    const base44 = createClientFromRequest(req);
    const body = await req.json().catch(() => ({}));
    const lat = Number(body.latitude);
    const lon = Number(body.longitude);
    if (!Number.isFinite(lat) || !Number.isFinite(lon)) {
      return Response.json({ success: false, error: "Valid coordinates required" }, { status: 400 });
    }

    const v = body.vehicleInfo || {};
    const phone = body.customerPhone || "";

    // reverse-geocode to a human-readable address (best-effort; coords are the source of truth)
    let address = `${lat.toFixed(6)}, ${lon.toFixed(6)}`;
    try {
      const r = await fetch(
        `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lon}&zoom=18&addressdetails=1`,
        { headers: { "User-Agent": "SinsinnatiKeyConnection-Dispatch/1.0" } }
      );
      if (r.ok) {
        const d = await r.json();
        if (d && d.display_name) address = d.display_name;
      }
    } catch (_e) { /* keep raw coordinates */ }

    const mapLink = `https://www.google.com/maps?q=${lat},${lon}`;
    const subject = "EMERGENCY DISPATCH REQUEST // Customer stranded";
    const bodyText = [
      "EMERGENCY — PANIC BUTTON ACTIVATED",
      "Sinsinnati Key Connection",
      "",
      `Location:  ${address}`,
      `GPS:       ${lat.toFixed(6)}, ${lon.toFixed(6)}`,
      `Map:       ${mapLink}`,
      "",
      "Vehicle:",
      `  Year:  ${v.year || "n/a"}`,
      `  Make:  ${v.make || "n/a"}`,
      `  Model: ${v.model || "n/a"}`,
      `  VIN:   ${v.vin || "n/a"}`,
      "",
      `Description: ${body.description || "Customer pressed panic button — stranded"}`,
      `Customer phone: ${phone || "n/a"}`,
      "",
      "Call the customer immediately and dispatch the nearest mobile tech."
    ].join("\n");

    const results = [];
    for (const email of ADMIN_EMAILS) {
      try {
        await db.asServiceRole.integrations.Core.SendEmail({
          to: email,
          from_name: "Sinsinnati Key Connection",
          subject,
          body: bodyText
        });
        results.push({ email, sent: true });
      } catch (e) {
        results.push({ email, sent: false, error: e.message });
      }
    }

    return Response.json({ success: true, address, mapLink, results });
  } catch (error) {
    return Response.json({ success: false, error: error.message }, { status: 500 });
  }
}