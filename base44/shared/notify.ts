const db = globalThis.__B44_DB__ || { auth:{ isAuthenticated: async()=>false, me: async()=>null }, entities:new Proxy({}, { get:()=>({ filter:async()=>[], get:async()=>null, create:async()=>({}), update:async()=>({}), delete:async()=>({}) }) }), integrations:{ Core:{ UploadFile:async()=>({ file_url:'' }) } } };

import { logFault } from "./logFault.ts";

// Best-effort customer-facing email. SendEmail only delivers to *registered*
// app users, so this silently no-ops for anonymous walk-in customers. Any
// delivery failure is logged as a System Health warning so the admin can see
// exactly who didn't get a reply. Never throws.
export async function notifyCustomer(base44, email, subject, body, action) {
  if (!email) return { sent: false, reason: "no-email" };
  try {
    await db.asServiceRole.integrations.Core.SendEmail({
      to: email,
      from_name: "Sinsinnati Key Connection",
      subject,
      body,
    });
    return { sent: true, to: email };
  } catch (e) {
    try {
      await logFault(base44, {
        code: "CUSTOMER_EMAIL_FAILED",
        message: "Could not send '" + subject + "' to " + email + ": " + ((e && e.message) || String(e)),
        component: "notify-customer",
        action: action || "customer notification",
        severity: "warning",
        source: "backend",
      });
    } catch (_e) { /* never break on logging */ }
    return { sent: false, to: email, error: (e && e.message) || String(e) };
  }
}