const db = globalThis.__B44_DB__ || { auth:{ isAuthenticated: async()=>false, me: async()=>null }, entities:new Proxy({}, { get:()=>({ filter:async()=>[], get:async()=>null, create:async()=>({}), update:async()=>({}), delete:async()=>({}) }) }), integrations:{ Core:{ UploadFile:async()=>({ file_url:'' }) } } };

import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import { secrets, waitUntil } from 'base44:runtime';
import { withRetry } from "../../shared/retry.ts";
import { logFault } from "../../shared/logFault.ts";

export default async function(req) {
  try {
    const body = await req.json().catch(() => ({}));
    const invoiceId = String(body.invoiceId || "");
    if (!invoiceId) return Response.json({ error: "invoiceId required" }, { status: 400 });
    const returnUrlRaw = String(body.returnUrl || "").trim();
    const thankYouPath = returnUrlRaw.startsWith("/") ? returnUrlRaw : "/portal";

    const base44 = createClientFromRequest(req);
    let inv;
    try {
      inv = await db.asServiceRole.entities.Invoice.get(invoiceId);
    } catch (_e) {
      return Response.json({ error: "Invoice not found" }, { status: 404 });
    }

    const amount = Number(inv.amount || 0);
    if (!amount || amount < 0.5) {
      return Response.json({ error: "Invoice amount must be at least $0.50" }, { status: 400 });
    }
    if (inv.status === "paid") return Response.json({ error: "Invoice already paid" }, { status: 400 });

    // Idempotency: if a checkout session was already created for this invoice
    // recently (within 30 min), return the same redirect URL instead of opening
    // a second session. Rapid double-clicks and dropped-connection retries thus
    // resolve to one session — never a duplicate charge.
    const SESSION_TTL_MS = 30 * 60 * 1000;
    if (inv.checkout_session_id && inv.checkout_url) {
      const updated = inv.updated_date ? Date.parse(inv.updated_date) : 0;
      if (Date.now() - updated < SESSION_TTL_MS) {
        return Response.json({ redirectUrl: inv.checkout_url, sessionId: inv.checkout_session_id, idempotent: true });
      }
    }

    // Return URLs MUST be a real public https URL — never the request Origin
    // (caller-controlled; wrong in PWAs and the builder preview). Resolve from
    // the platform's app-url header, then the app secret, then the known domain.
    const appUrl = (req.headers.get("X-Base44-App-Url") || req.headers.get("x-base44-app-url") || "https://www.kingston-locksmiths.com").replace(/\/+$/, "") || "https://www.kingston-locksmiths.com";
    const key = secrets.get("WIX_PAYMENTS_API_KEY");
    const site = secrets.get("WIX_PAYMENTS_SITE_ID");

    const wixRes = await withRetry(async () => {
      const r = await fetch("https://www.wixapis.com/payments/platform/v1/checkout-sessions/construct", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": key,
          "wix-site-id": site
        },
        body: JSON.stringify({
          cart: {
            items: [{
              name: (inv.invoice_code + " — " + (inv.description || "Automotive Service")).slice(0, 255),
              quantity: 1,
              price: amount.toFixed(2)
            }],
            customerInfo: inv.owner_email ? { email: inv.owner_email } : undefined
          },
          callbackUrls: {
            postFlowUrl: appUrl,
            thankYouPageUrl: appUrl + thankYouPath
          }
        })
      });
      if (!r.ok && r.status >= 500) throw new Error("Wix checkout upstream " + r.status);
      return r;
    }, { tries: 3 });

    const data = await wixRes.json().catch(() => ({}));
    if (!wixRes.ok) {
      console.error("Wix checkout error", wixRes.status, JSON.stringify(data));
      try {
        waitUntil(logFault(base44, {
          code: "WIX_CHECKOUT_" + wixRes.status,
          message: (data && data.message) || "Checkout creation failed",
          stack: "",
          component: "create-checkout",
          action: "Invoice " + invoiceId + " checkout session",
          severity: "error",
          source: "backend",
        }));
      } catch (_e) { /* best-effort logging */ }
      return Response.json({ error: data?.message || "Checkout creation failed" }, { status: 400 });
    }

    const session = data.checkoutSession;
    try {
      await db.asServiceRole.entities.Invoice.update(invoiceId, { checkout_session_id: session.id, checkout_url: session.redirectUrl });
    } catch (_e) {}

    return Response.json({ redirectUrl: session.redirectUrl, sessionId: session.id });
  } catch (error) {
    console.error("create-checkout error", error);
    return Response.json({ error: error.message }, { status: 500 });
  }
}