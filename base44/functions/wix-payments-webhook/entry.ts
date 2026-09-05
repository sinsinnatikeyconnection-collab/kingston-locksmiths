const db = globalThis.__B44_DB__ || { auth:{ isAuthenticated: async()=>false, me: async()=>null }, entities:new Proxy({}, { get:()=>({ filter:async()=>[], get:async()=>null, create:async()=>({}), update:async()=>({}), delete:async()=>({}) }) }), integrations:{ Core:{ UploadFile:async()=>({ file_url:'' }) } } };

import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import { secrets, waitUntil } from 'base44:runtime';
import jwt from 'npm:jsonwebtoken';
import { notifyCustomer } from '../../shared/notify.ts';

const ADMINS = ["tcincy23@gmail.com", "sinsinnatikeyconnection@gmail.com"];

export default async function(req) {
  try {
    const pub = secrets.get("WIX_CHECKOUT_WEBHOOK_PUBLIC_KEY") || secrets.get("WIX_PAYMENTS_WEBHOOK_PUBLIC_KEY");
    if (!pub) {
      console.error("wix-payments-webhook: missing public key");
      return new Response("ok", { status: 200 });
    }
    const text = await req.text();

    let raw;
    try {
      raw = jwt.verify(text, pub, { algorithms: ["RS256"] });
    } catch (e) {
      console.error("wix-payments-webhook: signature verification failed");
      return new Response("ok", { status: 200 });
    }

    const event = JSON.parse(raw.data);
    if (event.eventType === "wix.ecom.v1.order_approved") {
      const eventData = JSON.parse(event.data);
      const order = eventData?.actionEvent?.body?.order;
      const checkoutId = order?.checkoutId;
      if (checkoutId) {
        const base44 = createClientFromRequest(req);
        try {
          // Idempotent: only flip invoices still unpaid, so a duplicate
          // ORDER_APPROVED webhook (or a replay) is a no-op rather than a
          // double-process. Matches the invoice state machine (unpaid → paid).
          const pending = await db.asServiceRole.entities.Invoice.filter({
            checkout_session_id: checkoutId,
            status: "unpaid",
          });
          if (pending && pending.length) {
            await db.asServiceRole.entities.Invoice.updateMany(
              { checkout_session_id: checkoutId, status: "unpaid" },
              { $set: { status: "paid" } }
            );
            // Instant admin purchase alert (post-response, non-blocking).
            const buyerEmail = (order && order.buyerInfo && order.buyerInfo.email) || (pending[0] && pending[0].owner_email) || "unknown";
            const lines = pending.map((p) => (p.invoice_code || "") + " — " + (p.description || "Automotive service")).join("\n");
            waitUntil((async () => {
              const txt = "PURCHASE COMPLETED — Sinsinnati Key Connection\n\nBuyer: " + buyerEmail + "\n\nInvoices:\n" + lines + "\n\nWix order checkoutId: " + checkoutId;
              for (const a of ADMINS) {
                try { await db.asServiceRole.integrations.Core.SendEmail({ to: a, subject: "PURCHASE // Invoice Paid", body: txt }); } catch (_e) {}
              }
              // Best-effort receipt to the buyer (only registered users receive).
              await notifyCustomer(
                base44,
                buyerEmail,
                "Payment Received — Sinsinnati Key Connection",
                "Hi there,\n\nThanks — your payment was received and your invoice is now marked paid.\nIf this unlocked a VIN diagnostic report, it is available now in your customer portal.\n\n— Sinsinnati Key Connection",
                "purchase receipt"
              );
            })().catch(() => {}));
          }
        } catch (e) {
          console.error("wix-payments-webhook: invoice update failed", e.message);
        }
      }
    }
    return new Response("ok", { status: 200 });
  } catch (error) {
    console.error("wix-payments-webhook error", error);
    return new Response("ok", { status: 200 });
  }
}