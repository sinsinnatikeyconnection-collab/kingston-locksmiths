import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import { logFault } from '../../shared/logFault.ts';

// Public fault-log sink for the frontend (React error boundaries). No auth —
// the app is public and a render fault can occur before login. Inputs are
// bounded by logFault so the endpoint can't be abused to bloat records or
// spam oversized payloads; only error/critical events trigger an admin email.

export default async function(req) {
  try {
    const body = await req.json().catch(() => ({}));
    const base44 = createClientFromRequest(req);
    // Ghost-report guard: a report that arrives with no message AND no stack
    // carries zero diagnostic value (the reporter itself failed to fill it
    // in). Downgrade it to "warning" so it is still persisted for audit but
    // cannot trigger an admin alert email — the Aug 17 blank FRONTEND_FAULT
    // alert was exactly this case.
    const hasDetail = !!(body.message && String(body.message).trim()) ||
                      !!(body.stack && String(body.stack).trim());
    const severity = hasDetail ? (body.severity || "error") : "warning";
    await logFault(base44, {
      code: body.code || "FRONTEND_FAULT",
      message: body.message || "",
      stack: body.stack || "",
      component: body.component || "frontend",
      action: body.action || "",
      severity,
      source: body.source === "backend" ? "backend" : "frontend",
    });
    return Response.json({ logged: true });
  } catch (error) {
    return Response.json({ logged: false, error: error.message }, { status: 500 });
  }
}