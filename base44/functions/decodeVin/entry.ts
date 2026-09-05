const db = globalThis.__B44_DB__ || { auth:{ isAuthenticated: async()=>false, me: async()=>null }, entities:new Proxy({}, { get:()=>({ filter:async()=>[], get:async()=>null, create:async()=>({}), update:async()=>({}), delete:async()=>({}) }) }), integrations:{ Core:{ UploadFile:async()=>({ file_url:'' }) } } };

// VIN decoder — server-side proxy to free NHTSA endpoints + deep OEM intelligence.
//   VPIC DecodeVin     -> Year/Make/Model/Trim/Engine specs
//   NHTSA Recalls      -> safety campaigns / defect reports
//   NHTSA Complaints   -> consumer complaints w/ component breakdown + severity
//   NHTSA SafetyRatings -> NCAP 5-Star crash ratings + ADAS + on-file counts
// Free tier always returns the NHTSA block.
// When `premium: true`, a deep OEM report (CAN/MOST topology, DTC library, TSBs,
// electrical schematics overview, diagnostic workflow, component pinouts, repair
// solutions) is synthesized once via web-context AI, cached in the VinReport entity,
// and returned BLURRED (headings + teaser only) until a linked Invoice is paid — then
// the full bodies unlock. Immobilizer-kill, odometer-alteration, and key-bitting
// steps are explicitly excluded from generation.

import { withRetry } from "../../shared/retry.ts";
import { logFault } from "../../shared/logFault.ts";
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import { waitUntil } from 'base44:runtime';

const VIN_RE = /^[A-HJ-NPR-Z0-9]{17}$/;
const PRICE = 25;

function timedFetch(url, ms = 6000) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), ms);
  return fetch(url, { signal: ctrl.signal }).finally(() => clearTimeout(timer));
}

function pick(results, name) {
  const row = results.find((r) => r.Variable === name);
  return row && typeof row.Value === "string" && row.Value.trim() ? row.Value.trim() : "";
}

async function fetchRecalls(year, make, model) {
  const params = new URLSearchParams({
    make: make.toUpperCase(),
    model,
    modelYear: String(year),
    format: "json",
  });
  const res = await timedFetch(`https://api.nhtsa.gov/recalls/recallsByVehicle?${params.toString()}`);
  if (!res.ok) throw new Error(`Recalls request failed (${res.status})`);
  const json = await res.json();
  const list = json.results || json.Results || [];
  return list.map((c) => ({
    number: c.NHTSACampaignNumber || c.NHTSAActionNumber || "",
    date: c.ReportReceivedDate || c.RecallDate || "",
    component: c.Component || "",
    summary: c.Summary || "",
    consequence: c.Consequence || "",
    remedy: c.Remedy || "",
  }));
}

async function fetchComplaints(year, make, model) {
  const params = new URLSearchParams({ make, model, modelYear: String(year) });
  const res = await timedFetch(`https://api.nhtsa.gov/complaints/complaintsByVehicle?${params.toString()}`);
  if (!res.ok) throw new Error(`Complaints request failed (${res.status})`);
  const json = await res.json();
  const list = json.results || json.Results || [];
  const componentCounts = {};
  let crashes = 0, fire = 0, injuries = 0, deaths = 0;
  for (const c of list) {
    if (c.crash) crashes++;
    if (c.fire) fire++;
    injuries += Number(c.numberOfInjuries) || 0;
    deaths += Number(c.numberOfDeaths) || 0;
    for (const comp of String(c.components || "").split(/[,;]/)) {
      const t = comp.trim();
      if (t) componentCounts[t] = (componentCounts[t] || 0) + 1;
    }
  }
  const topComponents = Object.entries(componentCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 6)
    .map(([component, count]) => ({ component, count }));
  const recent = list.slice(0, 4).map((c) => ({
    odiNumber: c.odiNumber ? String(c.odiNumber) : "",
    dateComplaintFiled: c.dateComplaintFiled || "",
    components: String(c.components || ""),
    summary: String(c.summary || "").slice(0, 200),
    crash: !!c.crash,
    fire: !!c.fire,
    injuries: Number(c.numberOfInjuries) || 0,
    deaths: Number(c.numberOfDeaths) || 0,
  }));
  return { total: list.length, topComponents, recent, crashes, fire, injuries, deaths };
}

async function fetchSafetyRating(year, make, model) {
  const varsUrl = `https://api.nhtsa.gov/SafetyRatings/modelyear/${encodeURIComponent(year)}/make/${encodeURIComponent(make)}/model/${encodeURIComponent(model)}?format=json`;
  const vRes = await timedFetch(varsUrl);
  if (!vRes.ok) throw new Error(`Safety variants failed (${vRes.status})`);
  const vJson = await vRes.json();
  const variants = (vJson.Results || []).filter((v) => v.VehicleId != null && Number(v.VehicleId) > 0);
  if (variants.length === 0) {
    return { hasRating: false, variantCount: 0, note: "No NCAP (5-Star) crash-test data on file for this exact model (trucks/heavy-duty often untested)." };
  }
  const rRes = await timedFetch(`https://api.nhtsa.gov/SafetyRatings/VehicleId/${variants[0].VehicleId}?format=json`);
  if (!rRes.ok) throw new Error(`Safety rating failed (${rRes.status})`);
  const rJson = await rRes.json();
  const raw = rJson.Results && rJson.Results[0];
  if (!raw) return { hasRating: false, variantCount: variants.length };
  return {
    hasRating: true,
    variantCount: variants.length,
    vehicleDescription: raw.VehicleDescription || variants[0].VehicleDescription || "",
    overallRating: raw.OverallRating || "",
    frontal: { overall: raw.OverallFrontCrashRating || "", driver: raw.FrontCrashDriversideRating || "", passenger: raw.FrontCrashPassengersideRating || "", picture: raw.FrontCrashPicture || "" },
    side: { overall: raw.OverallSideCrashRating || "", driver: raw.SideCrashDriversideRating || "", passenger: raw.SideCrashPassengersideRating || "", pole: raw.SidePoleCrashRating || "", picture: raw.SideCrashPicture || "" },
    rollover: { rating: raw.RolloverRating || "", possibility: raw.RolloverPossibility != null ? Number(raw.RolloverPossibility) : null, dynamicTip: raw.dynamicTipResult || "" },
    adas: { esc: raw.NHTSAElectronicStabilityControl || "", forwardCollisionWarning: raw.NHTSAForwardCollisionWarning || "", laneDepartureWarning: raw.NHTSALaneDepartureWarning || "" },
    counts: { complaints: raw.ComplaintsCount != null ? Number(raw.ComplaintsCount) : null, recalls: raw.RecallsCount != null ? Number(raw.RecallsCount) : null, investigations: raw.InvestigationCount != null ? Number(raw.InvestigationCount) : null },
  };
}

// --- Premium deep-OEM report (web-context AI, cached) -----------------------
async function generatePremiumReport(base44, decoded, vin) {
  const prompt =
    "You are a senior automotive diagnostic engineer. Using public sources (NHTSA, OEM service portals, TSB databases, forums), produce a deep OEM diagnostic brief for this exact vehicle:\n" +
    "Year: " + (decoded.year || "?") + "\nMake: " + (decoded.make || "?") + "\nModel: " + (decoded.model || "?") + "\nTrim: " + (decoded.trim || "n/a") + "\nEngine: " + (decoded.engine_size || "?") + "L, " + (decoded.cylinders || "?") + " cyl, " + (decoded.fuelType || "?") + "\nVIN: " + vin + "\n\n" +
    "Return JSON with a `sections` array. Each section has `key`, `title`, and `body` (markdown service-grade text). Include these keys:\n" +
    "can_bus — CAN / J2284 topology for this platform: gateway modules, HS/MS/LS bus layout, terminator & voltage notes.\n" +
    "most_network — MOST / FlexRay / LIN media & chassis-bus architecture if present for this platform; else state n/a.\n" +
    "dtc_library — common manufacturer-specific DTCs grouped by system with plain-English meaning.\n" +
    "tsbs — relevant NHTSA/OEM Technical Service Bulletins for this year/make/model with bulletins numbers where known.\n" +
    "electrical_schematics — overview of key electrical subsystems & connector pinout guidance (power/ground/signals).\n" +
    "diagnostic_workflow — step-by-step diagnostic workflow for the most common faults on this platform.\n" +
    "pinouts — notable component pinouts, connector locations, and bus access points.\n" +
    "repair_solutions — common repair solutions, cautions, and torque/setting notes.\n\n" +
    "STRICT RULES: Do NOT include immobilizer bypass/kill steps, odometer or mileage alteration/calibration procedures, or key bitting/cut codes. Provide only factual, service-grade diagnostic info. If a section has no reliable public data for this platform, say so in that section. Keep each body concise (a few paragraphs).";
  const llm = await db.asServiceRole.integrations.Core.InvokeLLM({
    prompt,
    add_context_from_internet: true,
    model: "gemini_3_flash",
    response_json_schema: {
      type: "object",
      properties: {
        sections: {
          type: "array",
          items: {
            type: "object",
            properties: { key: { type: "string" }, title: { type: "string" }, body: { type: "string" } },
            required: ["key", "title", "body"],
          },
        },
      },
      required: ["sections"],
    },
  });
  return (llm && Array.isArray(llm.sections)) ? llm.sections : [];
}

async function ensureVinReport(base44, decoded, vin) {
  try {
    const existing = await db.asServiceRole.entities.VinReport.filter({ vin }, "-created_date", 1);
    if (existing && existing.length) return existing[0];
  } catch (_e) { /* miss */ }
  const sections = await withRetry(() => generatePremiumReport(base44, decoded, vin), { tries: 2 });
  const preview = sections.map((s) => ({ key: s.key, title: s.title, teaser: String(s.body || "").slice(0, 160) }));
  return await db.asServiceRole.entities.VinReport.create({
    vin, year: decoded.year, make: decoded.make, model: decoded.model,
    report_json: JSON.stringify(sections),
    preview_sections: preview,
    price: PRICE,
  });
}

async function determineUnlock(base44, vin, email) {
  if (!email) return { unlocked: false, invoiceId: null };
  let invoices = [];
  try { invoices = await db.asServiceRole.entities.Invoice.filter({ owner_email_lower: String(email).toLowerCase() }); } catch (_e) {}
  const mine = (invoices || []).filter((i) => String(i.description || "").includes(vin));
  const paid = mine.find((i) => i.status === "paid");
  const unpaid = mine.find((i) => i.status === "unpaid");
  return { unlocked: !!paid, invoiceId: unpaid ? unpaid.id : null };
}

export default async function (req) {
  const base44 = createClientFromRequest(req);
  try {
    const body = await req.json().catch(() => ({}));
    const vin = String(body.vin || "").toUpperCase().trim();
    if (!VIN_RE.test(vin)) {
      return Response.json({ error: "Invalid VIN — must be 17 chars, excluding I/O/Q." }, { status: 400 });
    }

    const vpicRes = await withRetry(async () => {
      const r = await timedFetch(`https://vpic.nhtsa.dot.gov/api/vehicles/DecodeVin/${vin}?format=json`, 8000);
      if (!r.ok) throw new Error(`VPIC decode failed (${r.status})`);
      return r;
    }, { tries: 3 });
    const vpic = await vpicRes.json();
    const R = vpic.Results || [];

    const year = pick(R, "Model Year");
    const make = pick(R, "Make");
    const model = pick(R, "Model");
    const trim = pick(R, "Trim") || pick(R, "Series");
    const engineSize = pick(R, "Displacement (L)");
    const cylinders = pick(R, "Engine Number of Cylinders");
    const engineModel = pick(R, "Engine Model");
    const fuelType = pick(R, "Fuel Type - Primary");
    const driveType = pick(R, "Drive Type");
    const transmission = pick(R, "Transmission Style");
    const bodyClass = pick(R, "Body Class");
    const plantCity = pick(R, "Plant City");
    const plantCountry = pick(R, "Plant Country");
    const vehicleType = pick(R, "Vehicle Type");

    const decoded = {
      year, make, model, trim, engine_size: engineSize,
      cylinders, engineModel, fuelType, driveType, transmission, bodyClass,
      plant: plantCity ? `${plantCity}, ${plantCountry}` : plantCountry,
      vehicleType,
    };

    const hasVehicle = !!(year && make && model);
    const success = (r, fallback) => (r.status === "fulfilled" ? r.value : fallback);
    const errOf = (r) => (r.status === "rejected" ? String(r.reason?.message || r.reason) : null);

    const [recallsR, complaintsR, safetyR] = hasVehicle
      ? await Promise.allSettled([
          withRetry(() => fetchRecalls(year, make, model), { tries: 3 }),
          withRetry(() => fetchComplaints(year, make, model), { tries: 3 }),
          withRetry(() => fetchSafetyRating(year, make, model), { tries: 3 }),
        ])
      : [
          { status: "fulfilled", value: [] },
          { status: "fulfilled", value: { total: 0, topComponents: [], recent: [], crashes: 0, fire: 0, injuries: 0, deaths: 0 } },
          { status: "fulfilled", value: { hasRating: false, variantCount: 0, note: "Vehicle specs unavailable to query ratings." } },
        ];

    const recalls = success(recallsR, []);
    const recallError = errOf(recallsR);
    const complaints = success(complaintsR, { total: 0, topComponents: [], recent: [], crashes: 0, fire: 0, injuries: 0, deaths: 0 });
    const complaintError = errOf(complaintsR);
    const safetyRating = success(safetyR, { hasRating: false, variantCount: 0, note: "Safety ratings unavailable." });
    const safetyError = errOf(safetyR);

    const yr = parseInt(year, 10);
    const diagnosticBus = Number.isNaN(yr)
      ? "Unknown — model year not encoded in VIN"
      : yr >= 2008 ? "CAN (ISO 15765-4 / J2284)"
      : yr > 1995 ? "ISO 9141 / KWP / J1850 (pre-CAN era)"
      : "Pre-OBD-II";
    const network = {
      diagnosticBus,
      notes: "US-spec vehicles use CAN for OBD-II diagnostics from MY2008 onward; MOST/FlexRay appear in select luxury infotainment & chassis networks. Exact onboard topology is OEM-licensed; the premium report synthesizes public-source topology below.",
    };

    const oemResources = {
      recallsUrl: make ? `https://www.nhtsa.gov/recalls?vin=${vin}` : "",
      complaintsUrl: hasVehicle ? `https://www-odi.nhtsa.dot.gov/owners/SearchSafetyIssues` : "",
      vpicSource: `https://vpic.nhtsa.dot.gov/vehicles/DecodeVin/${vin}`,
      tSBsAvailable: false,
      wiringDiagramsAvailable: false,
      investigationsAvailable: false,
      dataGap: "Free NHTSA data covers recalls, complaints, and NCAP ratings. The premium deep-OEM report (CAN/MOST topology, DTC library, TSBs, schematic overview, diagnostic workflow, pinouts, repair solutions) is AI-synthesized from public sources and unlocked per-VIN.",
    };

    let premiumReport = null;
    if (body.premium) {
      try {
        const rec = await ensureVinReport(base44, decoded, vin);
        let sections = [];
        try { sections = JSON.parse(rec.report_json || "[]"); } catch (_e) { /* empty */ }
        const unlock = await determineUnlock(base44, vin, String(body.email || ""));
        premiumReport = {
          reportId: rec.id,
          price: Number(rec.price) || PRICE,
          locked: !unlock.unlocked,
          sections: unlock.unlocked ? sections : (rec.preview_sections || []),
          invoiceId: unlock.invoiceId,
        };
      } catch (e) {
        premiumReport = { error: e.message, locked: true, sections: [], price: PRICE, invoiceId: null };
      }
    }

    return Response.json({
      vin, decoded, recalls, recallError, complaints, complaintError,
      safetyRating, safetyError, network, oemResources,
      source: "NHTSA VPIC + Recalls + Complaints + NCAP Ratings",
      premiumReport,
    });
  } catch (error) {
    try {
      waitUntil(logFault(base44, {
        code: "DECODE_VIN_" + (error.name || "ERROR"),
        message: error.message,
        stack: String(error.stack || ""),
        component: "decodeVin",
        action: "VIN decode (NHTSA + premium OEM)",
        severity: "error",
        source: "backend",
      }).catch(() => {}));
    } catch (_e) { /* logging best-effort */ }
    return Response.json({ error: error.message }, { status: 500 });
  }
}