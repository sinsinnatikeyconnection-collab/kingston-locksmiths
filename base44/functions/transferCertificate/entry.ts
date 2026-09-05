const db = globalThis.__B44_DB__ || { auth:{ isAuthenticated: async()=>false, me: async()=>null }, entities:new Proxy({}, { get:()=>({ filter:async()=>[], get:async()=>null, create:async()=>({}), update:async()=>({}), delete:async()=>({}) }) }), integrations:{ Core:{ UploadFile:async()=>({ file_url:'' }) } } };

import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';

// Transfer an immutable repair certificate to a new owner (e.g., when the car is sold).
// Ownership is verified server-side so a transfer can only be initiated by the current owner.
export default async function(req) {
  try {
    const body = await req.json().catch(() => ({}));
    const certificateId = String(body.certificateId || "");
    const newEmail = String(body.newOwnerEmail || "").toLowerCase().trim();
    if (!certificateId || !newEmail) {
      return Response.json({ error: "certificateId and newOwnerEmail are required" }, { status: 400 });
    }
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(newEmail)) {
      return Response.json({ error: "A valid new owner email is required" }, { status: 400 });
    }

    const base44 = createClientFromRequest(req);

    // Authenticate the caller server-side — never trust a client-supplied email.
    // Only the authenticated owner of the certificate may transfer it.
    let caller;
    try {
      caller = await db.auth.me();
    } catch (_e) {
      return Response.json({ error: "Authentication required to transfer a certificate" }, { status: 401 });
    }
    if (!caller || !caller.email) {
      return Response.json({ error: "Authentication required to transfer a certificate" }, { status: 401 });
    }

    const cert = await db.asServiceRole.entities.Certificate.get(certificateId);
    if (String(cert.owner_email || "").toLowerCase().trim() !== caller.email.toLowerCase().trim()) {
      return Response.json({ error: "Only the certificate owner can transfer it" }, { status: 403 });
    }

    const transferNote = `Ownership transferred to ${newEmail} on ${new Date().toISOString().slice(0, 10)}.${cert.notes ? " Previous notes: " + cert.notes : ""}`;
    await db.asServiceRole.entities.Certificate.update(certificateId, {
      owner_email: newEmail,
      notes: transferNote.slice(0, 1000)
    });
    return Response.json({ status: "transferred", newOwner: newEmail });
  } catch (error) {
    console.error("transferCertificate error", error);
    return Response.json({ error: error.message }, { status: 500 });
  }
}