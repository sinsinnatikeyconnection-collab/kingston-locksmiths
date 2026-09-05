const db = globalThis.__B44_DB__ || { auth:{ isAuthenticated: async()=>false, me: async()=>null }, entities:new Proxy({}, { get:()=>({ filter:async()=>[], get:async()=>null, create:async()=>({}), update:async()=>({}), delete:async()=>({}) }) }), integrations:{ Core:{ UploadFile:async()=>({ file_url:'' }) } } };

// Centralized backend fault logger. Persists a SystemHealthLog record and, for
// error/critical severity, emails the admin so silent failures surface fast.
// Never throws — best-effort only; a logging failure must never break the
// user-facing response. Lives in shared so every backend function and the
// public logSystemHealth endpoint report identically.

const ADMINS = ["tcincy23@gmail.com", "sinsinnatikeyconnection@gmail.com"];
const cap = (s, n) => String(s || "").slice(0, n);

export async function logFault(base44, payload) {
  const severity = payload.severity === "info" || payload.severity === "warning" || payload.severity === "critical"
    ? payload.severity
    : "error";
  const record = {
    code: cap(payload.code || "UNKNOWN", 120),
    message: cap(payload.message || "", 1000),
    stack: cap(payload.stack || "", 4000),
    component: cap(payload.component || "", 120),
    action: cap(payload.action || "", 500),
    severity,
    source: payload.source === "backend" ? "backend" : "frontend",
  };
  try {
    await db.asServiceRole.entities.SystemHealthLog.create(record);
  } catch (_e) {
    /* entity write failure must not propagate */
  }
  if (severity === "error" || severity === "critical") {
    const bodyTxt =
      "CODE: " + record.code + "\n" +
      "SEVERITY: " + severity + "\n" +
      "COMPONENT: " + record.component + "\n" +
      "ACTION: " + record.action + "\n\n" +
      "MESSAGE:\n" + record.message + "\n\n" +
      "STACK:\n" + record.stack + "\n" +
      "SOURCE: " + record.source;
    for (const a of ADMINS) {
      try {
        await db.asServiceRole.integrations.Core.SendEmail({
          to: a,
          subject: "[SKC Health] " + severity.toUpperCase() + " \u2014 " + record.code,
          body: bodyTxt,
        });
      } catch (_e) {
        /* email is best-effort */
      }
    }
  }
}