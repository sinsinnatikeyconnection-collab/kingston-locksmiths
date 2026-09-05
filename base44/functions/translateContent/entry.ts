import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';

// Neural-net localization engine. Translates a bounded map of UI strings into the
// requested language via InvokeLLM. Kept narrow: max 60 strings; brand tokens and
// numeric/eyebrow prefixes preserved. Uses a stronger model and parses JSON from
// the plain-text response for reliability.
export default async function(req) {
  try {
    const body = await req.json().catch(() => ({}));
    const language = String(body.language || "English");
    const strings = body.strings && typeof body.strings === "object" ? body.strings : null;
    if (!strings) return Response.json({ error: "strings object required" }, { status: 400 });
    const keys = Object.keys(strings);
    if (keys.length === 0) return Response.json({ translations: {} });
    if (keys.length > 60) return Response.json({ error: "Too many strings (max 60)" }, { status: 400 });

    const base44 = createClientFromRequest(req);
    const prompt =
      "You are a localization engine for an automotive engineering website. Translate every input string value into " +
      language + ". Respond with ONLY a JSON object (no markdown, no explanation) that uses the EXACT SAME KEYS as the input " +
      "and sets each value to the " + language + " translation of the corresponding text. Translate every key — never omit " +
      "or leave any value empty. Do NOT translate brand names (\"Sinsinnati Key Connection\", \"Kingston's Locksmiths\"), phone " +
      "numbers, or tokens that begin with \"//\" or wrap \"//\".\n\n" +
      "Input map (id -> text):\n" + JSON.stringify(strings, null, 2) +
      "\n\nOutput JSON now:";

    const result = await base44.asServiceRole.integrations.Core.InvokeLLM({
      prompt,
      model: "gpt_5_mini",
    });

    let translations = {};
    try {
      const txt = typeof result === "string" ? result : JSON.stringify(result);
      const match = txt.match(/\{[\s\S]*\}/);
      translations = JSON.parse(match ? match[0] : txt);
    } catch (e) {
      translations = {};
    }
    // merge so every requested key is present (fallback to original)
    const merged = { ...strings };
    Object.keys(merged).forEach((k) => { if (translations[k] && typeof translations[k] === "string") merged[k] = translations[k]; });
    return Response.json({ translations: merged });
  } catch (error) {
    console.error("translateContent error", error);
    return Response.json({ error: error.message }, { status: 500 });
  }
}