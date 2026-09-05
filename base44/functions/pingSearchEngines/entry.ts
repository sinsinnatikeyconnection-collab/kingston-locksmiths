import { waitUntil } from "base44:runtime";

// Pings Google & Bing sitemap submission endpoints when new content (case studies,
// services) is published, prompting the engines to re-crawl. Fire-and-forget — the
// function returns immediately and the fetches complete in the background.
export default async function(req) {
  try {
    const sitemap = "https://www.kingston-locksmiths.com/sitemap.xml";
    const endpoints = [
      "https://www.google.com/ping?sitemap=" + encodeURIComponent(sitemap),
      "https://www.bing.com/ping?sitemap=" + encodeURIComponent(sitemap),
    ];
    waitUntil(Promise.all(endpoints.map((u) => fetch(u).then((r) => r.status).catch(() => "error"))));
    return Response.json({ status: "pinged", endpoints });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}