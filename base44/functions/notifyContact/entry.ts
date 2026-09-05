const db = globalThis.__B44_DB__ || { auth:{ isAuthenticated: async()=>false, me: async()=>null }, entities:new Proxy({}, { get:()=>({ filter:async()=>[], get:async()=>null, create:async()=>({}), update:async()=>({}), delete:async()=>({}) }) }), integrations:{ Core:{ UploadFile:async()=>({ file_url:'' }) } } };

import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import { notifyCustomer } from "../../shared/notify.ts";

const ADMINS = ["tcincy23@gmail.com", "sinsinnatikeyconnection@gmail.com"];

// Notifies both company addresses the instant a public contact message is
// submitted, and sends a best-effort auto-reply to the customer (only registered
// users receive it). The message is already persisted by the client; this reads
// it by id (service role) so the full content is mailed, not re-typed in the body.
export default async function (req) {
  try {
    const base44 = createClientFromRequest(req);
    const body = await req.json().catch(() => ({}));
    const messageId = String(body.messageId || "");
    if (!messageId) return Response.json({ error: "messageId required" }, { status: 400 });

    const msg = await db.asServiceRole.entities.ContactMessage.get(messageId);
    if (!msg) return Response.json({ error: "message not found" }, { status: 404 });

    const subject = "NEW CONTACT MESSAGE // " + (msg.name || "Website visitor");
    const adminBody = [
      "CONTACT MESSAGE RECEIVED — Sinsinnati Key Connection",
      "",
      "From:   " + (msg.name || "n/a"),
      "Email:  " + (msg.email || "n/a"),
      "Phone:  " + (msg.phone || "n/a"),
      "",
      "Message:",
      String(msg.message || "").slice(0, 2000),
    ].join("\n");

    for (const a of ADMINS) {
      try {
        await db.asServiceRole.integrations.Core.SendEmail({
          to: a,
          from_name: "Sinsinnati Key Connection",
          subject,
          body: adminBody,
        });
      } catch (_e) { /* best-effort per recipient */ }
    }

    const first = (msg.name || "there").split(" ")[0] || "there";
    const customerBody = [
      "Hi " + first + ",",
      "",
      "Thanks for reaching out to Sinsinnati Key Connection. We received your message:",
      "",
      '"""',
      String(msg.message || "").slice(0, 500),
      '"""',
      "",
      "A technician will get back to you shortly. For emergencies, call or text us directly.",
      "",
      "— Sinsinnati Key Connection",
    ].join("\n");
    const cres = await notifyCustomer(
      base44,
      msg.email,
      "We received your message — Sinsinnati Key Connection",
      customerBody,
      "contact auto-reply"
    );

    return Response.json({ ok: true, customer: cres });
  } catch (error) {
    console.error("notifyContact error", error);
    return Response.json({ error: error.message }, { status: 500 });
  }
}