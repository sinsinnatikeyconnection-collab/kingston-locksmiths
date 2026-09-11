import { createServer } from "node:http";

const port = Number(process.env.PORT || 8787);
const jsonHeaders = { "Content-Type": "application/json; charset=utf-8" };
const env = (name) => process.env[name] || "";
const supabaseUrl = () => env("SUPABASE_URL").replace(/\/$/, "");

const send = (res, status, body) => {
  res.writeHead(status, jsonHeaders);
  res.end(JSON.stringify(body));
};

const readBody = async (req) => {
  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  const raw = Buffer.concat(chunks).toString("utf8");
  if (!raw) return {};
  try { return JSON.parse(raw); } catch { throw new Error("Request body must be valid JSON"); }
};

const request = async (url, options = {}) => {
  const response = await fetch(url, options);
  const text = await response.text();
  let body = {};
  try { body = text ? JSON.parse(text) : {}; } catch { body = { error: text }; }
  if (!response.ok) throw new Error(body.msg || body.message || body.error_description || body.error || `Upstream request failed (${response.status})`);
  return body;
};

const supabase = (path, options = {}) => request(`${supabaseUrl()}${path}`, {
  ...options,
  headers: {
    apikey: env("SUPABASE_SERVICE_ROLE_KEY"),
    Authorization: "Bearer " + env("SUPABASE_SERVICE_ROLE_KEY"),
    "Content-Type": "application/json",
    ...(options.headers || {}),
  },
});

const authToken = (req) => req.headers.authorization || "";
const currentUser = (req) => authToken(req)
  ? request(`${supabaseUrl()}/auth/v1/user`, { headers: { apikey: env("SUPABASE_SERVICE_ROLE_KEY"), Authorization: authToken(req) } }).catch(() => null)
  : Promise.resolve(null);

const tableName = (entity) => {
  const known = { BeforeAfterCase: "before_after_cases", CaseStudy: "case_studies", ContactMessage: "contact_messages", KbArticle: "kb_articles", LoyaltyAccount: "loyalty_accounts", LoyaltyTransaction: "loyalty_transactions", MailInRequest: "mail_in_requests", ServiceBooking: "service_bookings", SystemHealthLog: "system_health_logs", User: "users", VinReport: "vin_reports", Invoice: "invoices", Certificate: "certificates" };
  if (known[entity]) return known[entity];
  const snake = entity.replace(/[^A-Za-z0-9]/g, "").replace(/([a-z0-9])([A-Z])/g, "$1_$2").toLowerCase();
  return snake.endsWith("s") ? snake : `${snake}s`;
};

const requireConfig = (names) => {
  const missing = names.filter((name) => !env(name));
  if (missing.length) throw Object.assign(new Error(`Backend is not configured: ${missing.join(", ")}`), { status: 503 });
};

async function authRoute(req, res, parts, url) {
  const body = await readBody(req);
  const action = parts[1];
  requireConfig(["SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY"]);
  if (action === "me") {
    const user = await currentUser(req);
    return user ? send(res, 200, user) : send(res, 401, { error: "Authentication required" });
  }
  if (action === "provider") return send(res, 501, { error: "OAuth requires provider credentials and callback wiring." });
  if (action === "reset-password") {
    if (!authToken(req) || !body.newPassword) return send(res, 400, { error: "Authenticated reset token and new password are required" });
    return send(res, 200, await request(`${supabaseUrl()}/auth/v1/user`, {
      method: "PUT",
      headers: { apikey: env("SUPABASE_SERVICE_ROLE_KEY"), Authorization: authToken(req), "Content-Type": "application/json" },
      body: JSON.stringify({ password: body.newPassword }),
    }));
  }
  const endpoints = { login: "/auth/v1/token?grant_type=password", register: "/auth/v1/signup", "verify-otp": "/auth/v1/verify", "resend-otp": "/auth/v1/resend", "reset-password-request": "/auth/v1/recover" };
  if (!endpoints[action]) return send(res, 404, { error: "Unsupported auth operation" });
  const payload = action === "verify-otp" ? { email: body.email, token: body.otpCode, type: "signup" }
    : action === "resend-otp" ? { email: body.email, type: "signup" }
      : action === "reset-password-request" ? { email: body.email, redirect_to: `${env("SITE_URL") || url.origin}/reset-password` }
        : body;
  return send(res, 200, await request(`${supabaseUrl()}${endpoints[action]}`, {
    method: "POST",
    headers: { apikey: env("SUPABASE_SERVICE_ROLE_KEY"), "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  }));
}

async function entityRoute(req, res, parts, url) {
  requireConfig(["SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY"]);
  const table = tableName(parts[1]);
  const id = parts[2];
  const user = await currentUser(req);
  const publicReads = new Set(["BeforeAfterCase", "CaseStudy", "KbArticle"]);
  if (!user && !publicReads.has(parts[1])) return send(res, 401, { error: "Authentication required" });
  const query = new URLSearchParams(url.search);
  const base = `/rest/v1/${table}?select=*`;
  if (req.method === "GET") {
    const suffix = id ? `&id=eq.${encodeURIComponent(id)}` : `&order=${(query.get("sort") || "-created_date").replace(/^-/, "")}.${(query.get("sort") || "").startsWith("-") ? "desc" : "asc"}&limit=${Math.min(Number(query.get("limit") || 100), 200)}`;
    const rows = await supabase(`${base}${suffix}`);
    return send(res, 200, id ? (rows[0] || null) : rows);
  }
  const body = await readBody(req);
  if (req.method === "POST" && parts[2] === "search") {
    const filters = Object.entries(body).map(([key, value]) => `${key}=eq.${encodeURIComponent(String(value))}`).join("&");
    return send(res, 200, await supabase(`${base}&${filters}`));
  }
  const target = id ? `${base}&id=eq.${encodeURIComponent(id)}` : `/rest/v1/${table}`;
  const result = await supabase(target, { method: req.method, headers: { Prefer: "return=representation" }, body: JSON.stringify(body) });
  return send(res, 200, Array.isArray(result) ? (result[0] || result) : result);
}

async function functionRoute(req, res, name) {
  const body = await readBody(req);
  if (name === "decodeVin") {
    const vin = String(body.vin || "").toUpperCase().trim();
    if (!/^[A-HJ-NPR-Z0-9]{17}$/.test(vin)) return send(res, 400, { error: "Invalid VIN" });
    const data = await request(`https://vpic.nhtsa.dot.gov/api/vehicles/DecodeVinValuesExtended/${encodeURIComponent(vin)}?format=json`);
    const values = Object.fromEntries((data.Results || []).map((item) => [item.Variable, item.Value]).filter(([, value]) => value));
    return send(res, 200, { decoded: { vin, year: values["Model Year"] || "", make: values.Make || "", model: values.Model || "", trim: values.Trim || values.Series || "", engine_size: values["Displacement (L)"] || "", cylinders: values["Engine Number of Cylinders"] || "", fuelType: values["Fuel Type - Primary"] || "", driveType: values["Drive Type"] || "", transmission: values["Transmission Style"] || "", bodyClass: values["Body Class"] || "" } });
  }
  if (name === "aiService") {
    requireConfig(["OPENAI_API_KEY"]);
    const message = String(body.message || body.symptoms || "").slice(0, 1200);
    if (!message) return send(res, 400, { error: "message required" });
    const data = await request("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: "Bearer " + env("OPENAI_API_KEY"), "Content-Type": "application/json" },
      body: JSON.stringify({
        model: env("OPENAI_MODEL") || "gpt-4o-mini",
        temperature: 0.2,
        messages: [
          { role: "system", content: "You are an automotive service concierge. Give concise guidance, state uncertainty, never claim a camera proves continuity, shorts, opens, or temperature without appropriate hardware, and recommend technician measurement when safety is involved." },
          { role: "user", content: message },
        ],
      }),
    });
    return send(res, 200, { result: data.choices?.[0]?.message?.content || "Please contact a technician.", kind: body.kind || "chat" });
  }
  if (name === "logSystemHealth" || name === "pingSearchEngines" || name === "translateContent") return send(res, 200, { ok: true, ...(name === "translateContent" ? { strings: body.strings || {}, language: body.language } : {}) });
  return send(res, 501, { error: `Function requires backend integration: ${name}` });
}

const server = createServer(async (req, res) => {
  try {
    const url = new URL(req.url, `http://${req.headers.host || "localhost"}`);
    const parts = url.pathname.replace(/^\/api\/?/, "").split("/").filter(Boolean);
    if (parts[0] === "auth") return await authRoute(req, res, parts, url);
    if (parts[0] === "entities" && parts[1]) return await entityRoute(req, res, parts, url);
    if (parts[0] === "functions" && parts[1]) return await functionRoute(req, res, parts[1]);
    if (parts[0] === "uploads") return send(res, 501, { error: "Configure object storage upload handling on the backend." });
    return send(res, 404, { error: "API route not found" });
  } catch (error) {
    console.error("API error", error);
    return send(res, error.status || 500, { error: error.message || "Internal server error" });
  }
});

server.listen(port, () => console.log(`API listening on port ${port}`));
