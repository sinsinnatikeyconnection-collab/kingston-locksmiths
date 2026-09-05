const db = globalThis.__B44_DB__ || { auth:{ isAuthenticated: async()=>false, me: async()=>null }, entities:new Proxy({}, { get:()=>({ filter:async()=>[], get:async()=>null, create:async()=>({}), update:async()=>({}), delete:async()=>({}) }) }), integrations:{ Core:{ UploadFile:async()=>({ file_url:'' }) } } };

import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';

const DIAG_SCHEMA = {
  type: "object",
  additionalProperties: true,
  properties: {
    cause: { type: "string" },
    confidence: { type: "string", enum: ["low", "medium", "high"] },
    category: { type: "string", enum: ["Lost Keys / Security & Lockout", "Electrical & Diagnostics", "Mechanical Repair", "Performance & Tuning"] },
    summary: { type: "string" },
    book_cta: { type: "string" }
  },
  required: ["cause", "confidence", "category", "summary", "book_cta"]
};

export default async function(req) {
  try {
    const body = await req.json().catch(() => ({}));
    const kind = String(body.kind || "chat");
    const base44 = createClientFromRequest(req);
    let callArgs;

    if (kind === "diagnostic") {
      const symptoms = String(body.symptoms || "").slice(0, 1000);
      if (!symptoms) return Response.json({ error: "symptoms required" }, { status: 400 });
      const fileUrls = Array.isArray(body.fileUrls) ? body.fileUrls : (body.fileUrls ? [body.fileUrls] : null);
      const vehicle = String(body.vehicle || "").slice(0, 120);
      const vehicleLine = vehicle ? `\nVehicle context: ${vehicle}\n` : "";
      const prompt = `You are a master automotive diagnostician for Sinsinnati Key Connection, a Cincinnati shop that handles all-keys-lost key generation, immobilizer bypass, ECU/BCM cloning, EEPROM & MCU flashing, J2534 pass-thru, CAN/LIN bus diagnosis, parasitic-draw tracing, ADAS recalibration, SRS reset, ECU remapping, engine swaps & rebuilds, and performance tuning.

${vehicleLine}Customer-reported symptoms / sound description:
"${symptoms}"

Produce a single estimated diagnosis. If media is attached, consider whatever is audible or visible, but rely primarily on the written symptoms. Be specific and practical — name the likely failed subsystem, then give the plain-English meaning for the customer. Return JSON with: cause (most likely cause, 1-2 sentences), confidence (low|medium|high), category (exactly one enum value), summary (what it means for the customer + whether it is safe to drive), book_cta (a 1-line call to action to book).`;
      callArgs = { prompt, response_json_schema: DIAG_SCHEMA, ...(fileUrls ? { file_urls: fileUrls } : {}) };
    } else {
      const message = String(body.message || "").slice(0, 800);
      if (!message) return Response.json({ error: "message required" }, { status: 400 });
      const vehicle = String(body.vehicle || "").slice(0, 120);
      const historyIn = Array.isArray(body.history) ? body.history : [];
      const history = historyIn
        .slice(-6)
        .map((h) => ({ role: String(h.role || "user").slice(0, 8), text: String(h.text || "").slice(0, 300) }))
        .filter((h) => h.text);
      const ctx = vehicle ? `\nCustomer's vehicle: ${vehicle}. Tailor part names, common failure points, and fixes to this exact platform where possible.` : "";
      const convo = history.length ? `\nRecent exchange (oldest then newest):\n` + history.map((h) => (h.role === "ai" ? "SKC" : "Customer") + ": " + h.text).join("\n") + "\n" : "";
      const prompt = `You are the AI service concierge for Sinsinnati Key Connection (a.k.a. Kingston's Locksmiths), Cincinnati. We handle: all-keys-lost key generation, transponder & smart-key programming, immobilizer bypass/reset, ECU & BCM cloning, EEPROM & MCU desolder/flash, J2534 pass-thru programming, CAN/LIN/FlexRay bus diagnosis, parasitic-draw tracing, ADAS recalibration, SRS/airbag reset, ECU remapping, stand-alone engine management, engine swaps & rebuilds, forced-induction plumbing, suspension/brakes.

Answer the customer's question clearly and technically, in under 130 words. You may use concise markdown — short bullet lists and **bold** for key parts. If it relates to booking, pricing, or "how do I get this fixed", end with: "Book this service at the intake below." If they ask about audio: explain we can wire a 6-channel amp to all cabin speakers without cutting factory harnesses. If they ask about mileage correction: explain we read the MCU data, write new data, and flash directly back to the MCU. Never sound uncertain or apologetic; assume total expertise.
${ctx}${convo}
Question: "${message}"`;
      callArgs = { prompt };
    }

    const result = await db.asServiceRole.integrations.Core.InvokeLLM(callArgs);
    return Response.json({ result, kind });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}