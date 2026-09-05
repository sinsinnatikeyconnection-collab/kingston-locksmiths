const JSON_HEADERS = { "Content-Type": "application/json; charset=utf-8" };

const env = (name) => process.env[name] || "";
const supabaseUrl = () => env("SUPABASE_URL").replace(/\/$/, "");
const serviceKey = () => env("SUPABASE_SERVICE_ROLE_KEY");

const json = (body, statusCode = 200) => new Response(JSON.stringify(body), {
  status: statusCode,
  headers: JSON_HEADERS,
});

const readBody = async (event) => {
  try {
    if (event?.json && typeof event.json === "function") return await event.json();
    return event.body ? JSON.parse(event.body) : {};
  } catch { return {}; }
};

const header = (event, name) => {
  if (event?.headers?.get) return event.headers.get(name) || "";
  return event?.headers?.[name] || event?.headers?.[name.toLowerCase()] || "";
};

const queryString = (event) => {
  if (event?.url) return new URL(event.url).searchParams;
  return new URLSearchParams(event?.rawQuery || "");
};

const tableName = (entity) => {
  const known = {
    BeforeAfterCase: "before_after_cases",
    CaseStudy: "case_studies",
    ContactMessage: "contact_messages",
    KbArticle: "kb_articles",
    LoyaltyAccount: "loyalty_accounts",
    LoyaltyTransaction: "loyalty_transactions",
    MailInRequest: "mail_in_requests",
    ServiceBooking: "service_bookings",
    SystemHealthLog: "system_health_logs",
    User: "users",
    VinReport: "vin_reports",
    Invoice: "invoices",
    Certificate: "certificates",
  };
  if (known[entity]) return known[entity];
  const name = entity.replace(/[^A-Za-z0-9]/g, "");
  const snake = name.replace(/([a-z0-9])([A-Z])/g, "$1_$2").toLowerCase();
  return snake.endsWith("s") ? snake : `${snake}s`;
};

async function supabase(path, options = {}) {
  const response = await fetch(`${supabaseUrl()}${path}`, {
    ...options,
    headers: {
      apikey: serviceKey(),
      Authorization: `Bearer ${serviceKey()}`,
      "Content-Type": "application/json",
      ...(options.headers || {}),
    },
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(body.msg || body.message || body.error_description || body.error || `Supabase request failed (${response.status})`);
  return body;
}

async function currentUser(event) {
  const token = header(event, "authorization");
  if (!token) return null;
  const response = await fetch(`${supabaseUrl()}/auth/v1/user`, {
    headers: { apikey: serviceKey(), Authorization: token },
  });
  return response.ok ? response.json() : null;
}

async function authRoute(event, parts) {
  const body = await readBody(event);
  if (parts[1] === "me") {
    const user = await currentUser(event);
    if (!user) return json({ error: "Authentication required" }, 401);
    return json(user);
  }
  if (parts[1] === "provider") {
    const provider = encodeURIComponent(parts[2] || "google");
    const returnTo = queryString(event).get("returnTo") || "/";
    const origin = event?.url ? new URL(event.url).origin : `https://${header(event, "host")}`;
    const redirectTo = `${origin}/api/auth/callback?returnTo=${encodeURIComponent(returnTo)}`;
    const url = `${supabaseUrl()}/auth/v1/authorize?provider=${provider}&redirect_to=${encodeURIComponent(redirectTo)}`;
    return new Response(null, { status: 302, headers: { Location: url } });
  }
  const actions = {
    login: ["token", "password"],
    register: ["signup", "password"],
  };
  if (actions[parts[1]]) {
    const [endpoint, grant] = actions[parts[1]];
    const result = await supabase(`/auth/v1/${endpoint}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: body.email, password: body.password, grant_type: grant }),
    });
    return json(result);
  }
  if (parts[1] === "verify-otp") {
    return json(await supabase("/auth/v1/verify", { method: "POST", body: JSON.stringify({ email: body.email, token: body.otpCode, type: "signup" }) }));
  }
  if (parts[1] === "resend-otp") {
    return json(await supabase("/auth/v1/resend", { method: "POST", body: JSON.stringify({ email: body.email, type: "signup" }) }));
  }
  if (parts[1] === "reset-password-request") {
    return json(await supabase("/auth/v1/recover", { method: "POST", body: JSON.stringify({ email: body.email, redirect_to: `${env("SITE_URL")}/reset-password` }) }));
  }
  if (parts[1] === "reset-password") {
    const token = String(body.resetToken || "");
    if (!token || !body.newPassword) return json({ error: "Reset token and new password are required" }, 400);
    return json(await supabase("/auth/v1/user", { method: "PUT", headers: { Authorization: `Bearer ${token}` }, body: JSON.stringify({ password: body.newPassword }) }));
  }
  return json({ error: "Unsupported auth operation" }, 404);
}

async function entityRoute(event, parts) {
  const entity = parts[1];
  const table = tableName(entity);
  const id = parts[2];
  const method = event.httpMethod || event.method || "GET";
  const publicReads = new Set(["BeforeAfterCase", "CaseStudy", "KbArticle"]);
  const publicCreates = new Set(["ContactMessage", "ServiceBooking", "MailInRequest"]);
  const user = await currentUser(event);
  if (!user && ((method === "GET" && !publicReads.has(entity)) || (method !== "GET" && !publicCreates.has(entity)))) {
    return json({ error: "Authentication required" }, 401);
  }
  if (method === "GET" && id) return json(await supabase(`/rest/v1/${table}?id=eq.${encodeURIComponent(id)}&select=*`).then((rows) => rows[0] || null));
  if (method === "GET") {
    const query = queryString(event);
    const limit = Math.min(Number(query.get("limit") || 100), 200);
    const order = query.get("sort") || "-created_date";
    const column = order.replace(/^-/, "");
    const direction = order.startsWith("-") ? "desc" : "asc";
    return json(await supabase(`/rest/v1/${table}?select=*&order=${column}.${direction}&limit=${limit}`));
  }
  if (method === "POST" && parts[2] === "search") {
    const filters = await readBody(event);
    const query = Object.entries(filters).map(([key, value]) => `${key}=eq.${encodeURIComponent(String(value))}`).join("&");
    return json(await supabase(`/rest/v1/${table}?select=*&${query}`));
  }
  if (method === "POST") return json(await supabase(`/rest/v1/${table}`, { method: "POST", headers: { Prefer: "return=representation" }, body: JSON.stringify(await readBody(event)) }).then((rows) => rows[0] || rows));
  if (method === "PATCH" && id) return json(await supabase(`/rest/v1/${table}?id=eq.${encodeURIComponent(id)}`, { method: "PATCH", headers: { Prefer: "return=representation" }, body: JSON.stringify(await readBody(event)) }).then((rows) => rows[0] || null));
  if (method === "DELETE" && id) return json({ ok: true, deleted: await supabase(`/rest/v1/${table}?id=eq.${encodeURIComponent(id)}`, { method: "DELETE", headers: { Prefer: "return=representation" } }) });
  return json({ error: "Unsupported entity operation" }, 405);
}

async function decodeVin(vin) {
  const response = await fetch(`https://vpic.nhtsa.dot.gov/api/vehicles/DecodeVin/${encodeURIComponent(vin)}?format=json`);
  const data = await response.json();
  const values = Object.fromEntries((data.Results || []).map((item) => [item.Variable, item.Value]).filter(([, value]) => value));
  return { vin, year: values["Model Year"] || "", make: values.Make || "", model: values.Model || "", trim: values.Trim || values.Series || "", engine_size: values["Displacement (L)"] || "", cylinders: values["Engine Number of Cylinders"] || "", fuelType: values["Fuel Type - Primary"] || "", driveType: values["Drive Type"] || "", transmission: values["Transmission Style"] || "", bodyClass: values["Body Class"] || "", vehicleType: values["Vehicle Type"] || "" };
}

async function sendEmail(to, subject, text) {
  if (!env("RESEND_API_KEY") || !to) return { skipped: true };
  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${env("RESEND_API_KEY")}`, "Content-Type": "application/json" },
    body: JSON.stringify({ from: env("RESEND_FROM_EMAIL") || "onboarding@resend.dev", to: Array.isArray(to) ? to : [to], subject, text }),
  });
  if (!response.ok) throw new Error(`Email delivery failed (${response.status})`);
  return response.json();
}

async function aiResponse(body) {
  if (!env("OPENAI_API_KEY")) return { result: "AI assistance is not configured yet. Please call or book a technician for help.", kind: body.kind || "chat" };
  const message = String(body.message || body.symptoms || "").slice(0, 1200);
  if (!message) throw new Error("message required");
  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: { Authorization: `Bearer ${env("OPENAI_API_KEY")}`, "Content-Type": "application/json" },
    body: JSON.stringify({ model: "gpt-4o-mini", temperature: 0.2, messages: [{ role: "system", content: "You are the automotive service concierge for Sinsinnati Key Connection. Give concise, practical guidance and recommend an in-person technician when safety is involved." }, { role: "user", content: message }] }),
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error?.message || "AI request failed");
  return { result: data.choices?.[0]?.message?.content || "Please contact a technician for assistance.", kind: body.kind || "chat" };
}

async function functionRoute(event, name) {
  const body = await readBody(event);
  if (name === "decodeVin") {
    const vin = String(body.vin || "").toUpperCase().trim();
    if (!/^[A-HJ-NPR-Z0-9]{17}$/.test(vin)) return json({ error: "Invalid VIN" }, 400);
    return json({ decoded: await decodeVin(vin), premiumReport: null });
  }
  if (name === "createBooking") {
    const booking = { ...(body.booking || {}), idempotency_key: body.idempotencyKey || null };
    if (!booking.customer_email || !booking.customer_name) return json({ error: "Customer name and email are required" }, 400);
    const result = await supabase("/rest/v1/service_bookings", { method: "POST", headers: { Prefer: "return=representation" }, body: JSON.stringify(booking) });
    return json({ booking: result[0] || result, idempotent: false });
  }
  if (name === "createVinUnlock") {
    const vin = String(body.vin || "").toUpperCase().trim();
    const email = String(body.email || "").toLowerCase().trim();
    if (!/^[A-HJ-NPR-Z0-9]{17}$/.test(vin) || !email.includes("@")) return json({ error: "Valid VIN and email required" }, 400);
    const result = await supabase("/rest/v1/invoices", { method: "POST", headers: { Prefer: "return=representation" }, body: JSON.stringify({ invoice_code: `VIN-${vin.slice(-6)}-${Date.now().toString(36)}`, owner_email: email, owner_email_lower: email, description: `Premium VIN Diagnostic Unlock - ${vin}`, amount: 25, status: "unpaid" }) });
    return json({ invoiceId: result[0]?.id });
  }
  if (name === "create-checkout") {
    const invoice = await supabase(`/rest/v1/invoices?id=eq.${encodeURIComponent(body.invoiceId || "")}&select=*`).then((rows) => rows[0]);
    if (!invoice) return json({ error: "Invoice not found" }, 404);
    const params = new URLSearchParams({ mode: "payment", success_url: `${env("SITE_URL")}/portal?payment=success`, cancel_url: `${env("SITE_URL")}/portal?payment=cancelled`, "line_items[0][price_data][currency]": "usd", "line_items[0][price_data][product_data][name]": invoice.description || "Automotive service", "line_items[0][price_data][unit_amount]": String(Math.round(Number(invoice.amount) * 100)), "line_items[0][quantity]": "1" });
    const stripe = await fetch("https://api.stripe.com/v1/checkout/sessions", { method: "POST", headers: { Authorization: `Bearer ${env("STRIPE_SECRET_KEY")}`, "Content-Type": "application/x-www-form-urlencoded" }, body: params });
    const session = await stripe.json();
    if (!stripe.ok) return json({ error: session.error?.message || "Stripe checkout failed" }, 502);
    await supabase(`/rest/v1/invoices?id=eq.${encodeURIComponent(invoice.id)}`, { method: "PATCH", body: JSON.stringify({ checkout_session_id: session.id, checkout_url: session.url }) });
    return json({ redirectUrl: session.url, sessionId: session.id });
  }
  if (name === "aiService") return json(await aiResponse(body));
  if (name === "notifyContact") {
    const rows = await supabase(`/rest/v1/contact_messages?id=eq.${encodeURIComponent(body.messageId || "")}&select=*`);
    const message = rows[0];
    if (!message) return json({ error: "Message not found" }, 404);
    await sendEmail(env("ADMIN_EMAILS").split(",").filter(Boolean), `NEW CONTACT MESSAGE // ${message.name || "Website visitor"}`, `From: ${message.name || "n/a"}\nEmail: ${message.email || "n/a"}\nPhone: ${message.phone || "n/a"}\n\n${message.message || ""}`);
    return json({ ok: true });
  }
  if (name === "emergencyDispatch") {
    const lat = Number(body.latitude); const lon = Number(body.longitude);
    if (!Number.isFinite(lat) || !Number.isFinite(lon)) return json({ success: false, error: "Valid coordinates required" }, 400);
    const vehicle = body.vehicleInfo || {};
    await sendEmail(env("ADMIN_EMAILS").split(",").filter(Boolean), "EMERGENCY DISPATCH REQUEST", `Location: https://www.google.com/maps?q=${lat},${lon}\nVehicle: ${vehicle.year || ""} ${vehicle.make || ""} ${vehicle.model || ""}\nPhone: ${body.customerPhone || "n/a"}\n${body.description || "Customer stranded"}`);
    return json({ success: true, mapLink: `https://www.google.com/maps?q=${lat},${lon}` });
  }
  if (name === "createMailIn") {
    const request = { ...(body.request || {}), idempotency_key: body.idempotencyKey || null, status: "submitted" };
    const rows = await supabase("/rest/v1/mail_in_requests", { method: "POST", headers: { Prefer: "return=representation" }, body: JSON.stringify(request) });
    return json({ labelResult: { status: "pending", requestId: rows[0]?.id || null } });
  }
  if (name === "transferCertificate") {
    const email = String(body.newOwnerEmail || "").toLowerCase().trim();
    if (!email.includes("@")) return json({ error: "Valid email required" }, 400);
    await supabase(`/rest/v1/certificates?id=eq.${encodeURIComponent(body.certificateId || "")}`, { method: "PATCH", body: JSON.stringify({ owner_email: email }) });
    return json({ status: "transferred" });
  }
  if (name === "pingSearchEngines") return json({ ok: true });
  if (name === "translateContent") return json({ strings: body.strings || {}, language: body.language });
  if (name === "logSystemHealth") return json({ ok: true });
  return json({ error: `Unsupported function: ${name}` }, 404);
}

export async function handler(event) {
  try {
    const requestUrl = event.url || event.rawUrl;
    const rawPath = requestUrl
      ? new URL(requestUrl).pathname
      : (event.path || "/api");
    const routedPath = queryString(event).get("path") || rawPath;
    const path = routedPath.replace(/^\/\.netlify\/functions\/api\/?/, "").replace(/^\/api\/?/, "");
    const parts = path.split("/").filter(Boolean);
    if (parts[0] === "auth") return await authRoute(event, parts);
    if (parts[0] === "entities" && parts[1]) return await entityRoute(event, parts);
    if (parts[0] === "functions" && parts[1]) return await functionRoute(event, parts[1]);
    return json({ error: "API route not found" }, 404);
  } catch (error) {
    console.error("API error", error);
    return json({ error: error.message || "Internal server error" }, 500);
  }
}

export default handler;