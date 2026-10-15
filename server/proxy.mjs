/* MAESTRO · Claude proxy (zero-dependency Node ≥18)
 * Keeps the Anthropic API key SERVER-SIDE for a deployed demo.
 *
 *   ANTHROPIC_API_KEY=sk-ant-... node server/proxy.mjs
 *   → listens on :8787, forwards POST /v1/messages (SSE streaming preserved)
 *
 * In the Maestro UI: ⚙ Settings → "Claude proxy base URL" = http://localhost:8787
 * (or your deployed proxy URL). Leave the browser API key EMPTY — the proxy holds it.
 * For internet-wide exposure add auth (e.g. a shared header check) and deploy behind HTTPS:
 * Render / Fly.io / a Vercel-Firebase function all work; see DEPLOY.md.
 */
import http from "node:http";

const KEY = process.env.ANTHROPIC_API_KEY || "";
const PORT = process.env.PORT || 8787;
const SHARED_SECRET = process.env.MAESTRO_PROXY_SECRET || ""; // optional extra guard

http.createServer(async (req, res) => {
  res.setHeader("access-control-allow-origin", "*");
  res.setHeader("access-control-allow-headers", "content-type,anthropic-version,anthropic-dangerous-direct-browser-access,x-proxy-secret");
  res.setHeader("access-control-allow-methods", "POST,OPTIONS");
  if (req.method === "OPTIONS") { res.writeHead(204); res.end(); return; }
  if (req.url.split("?")[0] !== "/v1/messages" || req.method !== "POST") {
    res.writeHead(404, { "content-type": "application/json" }); res.end(JSON.stringify({ error: "not found" })); return;
  }
  if (!KEY) { res.writeHead(500, { "content-type": "application/json" }); res.end(JSON.stringify({ error: "ANTHROPIC_API_KEY not set on proxy" })); return; }
  if (SHARED_SECRET && req.headers["x-proxy-secret"] !== SHARED_SECRET) {
    res.writeHead(401, { "content-type": "application/json" }); res.end(JSON.stringify({ error: "bad secret" })); return;
  }
  let body = "";
  for await (const chunk of req) body += chunk;
  try {
    const upstream = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: { "content-type": "application/json", "x-api-key": KEY, "anthropic-version": "2023-06-01" },
      body
    });
    res.writeHead(upstream.status, { "content-type": upstream.headers.get("content-type") || "application/json" });
    if (!upstream.body) { res.end(await upstream.text()); return; }
    const writer = new WritableStream({ write(c) { res.write(c); }, close() { res.end(); } });
    await upstream.body.pipeTo(writer);
  } catch (e) {
    if (!res.headersSent) res.writeHead(502, { "content-type": "application/json" });
    res.end(JSON.stringify({ error: String(e && e.message || e) }));
  }
}).listen(PORT, () => console.log(`Maestro Claude proxy listening on :${PORT} (key ${KEY ? "loaded" : "MISSING"})`));
