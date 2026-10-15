# MAESTRO · Deploy & Publish Guide

Maestro is a **static, zero-dependency front-end** — deploying it is trivial.
The only real decision is *where the Anthropic API key lives*.

---

## A. Publish the source on GitHub (for the application form)

```bash
cd maestro
git init -b main
git add -A
git commit -m "MAESTRO — AI operations conductor for hospitality (Preface Hackathon, 16 Oct 2026)"
# create an empty repo on github.com (no README/license — they're already here), then:
git remote add origin https://github.com/<you>/maestro.git
git push -u origin main
```

Suggested repo description:
> *MAESTRO — one live AI conductor unifying hotel check-in/out, gym, laundry, equipment & rostering. Claude-powered, human-approved. Built in 30 minutes at the Preface Hackathon.*

The repo already ships: `LICENSE` (MIT), `.gitignore`, `README.md` (with the 30-min stage-build plan),
`RUBRIC.md` (point-by-point answers to the event's six questions), `DEMO-SCRIPT.md`, automated tests
(`bash test/run-all.sh`), and `maestro-standalone.html` (single-file build).

## B. Deploy the live demo (pick one)

| Host | Steps | URL you get |
|---|---|---|
| **GitHub Pages** | Repo → Settings → Pages → Source: `main` / root | `https://<you>.github.io/maestro/` |
| **Netlify** | Drag the `maestro/` folder onto app.netlify.com/drop | instant `*.netlify.app` |
| **Vercel** | `npx vercel` inside `maestro/` (no build settings needed) | `*.vercel.app` |
| **Anywhere static** | Even email `maestro-standalone.html` — it runs from `file://` | — |

No build step, no env vars required for the site itself.

## C. The API key — three modes, in order of safety

1. **Baked (default, zero setup).** No key anywhere. Pre-baked responses identical in shape to
   Claude's. Perfect for the stage if Wi-Fi is doubtful — the demo never breaks.
2. **Proxy (recommended for any public URL).** The key stays server-side:
   ```bash
   ANTHROPIC_API_KEY=sk-ant-... PORT=8787 node server/proxy.mjs
   ```
   Deploy `server/proxy.mjs` to Render/Fly/Railway/a VPS (any Node ≥18 host), then in the UI:
   ⚙ Settings → *Claude proxy base URL* → `https://your-proxy.onrender.com`, browser key left **empty**.
   The header badge flips to `● LIVE`. For an internet-exposed proxy also set
   `MAESTRO_PROXY_SECRET` and add the matching `x-proxy-secret` header in `ai.js` (one line),
   or IP-allowlist the venue.
3. **Browser-direct key (laptop demo only).** ⚙ Settings → paste key. It stays in that browser's
   localStorage and goes straight to Anthropic. **Never use this on a public deployment** —
   anyone could lift the key.

## D. Production-readiness — honest checklist

This repo is a **hackathon-grade prototype that deploys and demos live safely**.
To become a real hotel product it still needs:

- [ ] **Real data feeds** — PMS (Opera/Mews/Cloudbeds) webhooks for arrivals/check-in-out, gym access
      control, RFID/laundry counts, equipment IoT. The Conductor contract (snapshot JSON in → typed
      actions out) is integration-agnostic; only `data.js`/`engine.js` sim layers get replaced.
- [ ] **Backend + persistence** — state currently lives in browser memory; production needs a server,
      DB (tasks, approvals, audit log), and auth/SSO per role (manager vs. staff vs. guest).
- [ ] **Guest channel** — the phone pane is a mock; production goes through WhatsApp / WeChat /
      the hotel app SDK, with consent + PDPO/GDPR handling of guest profiles & preferences.
- [ ] **Approval governance** — spend limits, labour-law constraint engine, multi-manager escalation,
      immutable audit trail (the decision-history pane is its seed).
- [ ] **Observability & evals** — logging, alerting, and regression evals for conductor JSON quality.
- [ ] **Key security** — proxy mode (C.2) plus rate-limiting and per-property tenancy.

Judges hear this kind of honesty as seniority, not weakness — the prototype proves the *concept and
the human-in-the-loop UX*; this list proves you know the road to revenue.
