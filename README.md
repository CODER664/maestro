# MAESTRO · The Hospitality Operations Conductor

> One live AI system that unifies **check-in, gym, laundry, equipment and rostering** —
> predicting bottlenecks before guests feel them, while the duty manager approves every move.
> Built for the **Preface Hackathon · 16 Oct 2026 · Reimagining Hospitality Operations & Customer Engagement**.

---

## Run it

**Easiest (offline-safe):** double-click `index.html`. Everything works without internet —
Maestro falls back to pre-baked intelligence.

**Recommended (for live Claude calls from `file://` can be blocked by some browsers):**
```bash
cd maestro
python3 -m http.server 8931
# open http://localhost:8931
```

**Wire up live Claude (optional but show-stopping):**
1. Click ⚙ Settings
2. Paste an Anthropic API key (stays in `localStorage` of that browser only; requests go browser → Anthropic directly)
3. Model defaults to `claude-sonnet-4-5` (change if you have access to a newer one)
4. Mode: **Auto** (live if key present, silent fallback offline) · **Live** (fail loudly) · **Baked** (rehearsal-safe)
5. The header badge flips to `● LIVE · Claude …`

## Controls

| Control | Action |
|---|---|
| ▶ / ⏸ or `Space` | Start/pause the simulated Friday evening (17:30 → 22:00) |
| Speed selector | 10× – 300× (default 60× ≈ 4.5 min full evening) |
| ⏭ Next beat or `N` | Jump the clock to the next scripted story beat |
| 🌙 Evening Brief or `B` | Maestro's AI-written end-of-day summary |
| ⚙ | API key / model / mode |

## The story beats (scripted timeline)

| Sim time | Beat | What happens |
|---|---|---|
| **17:40** | Conductor scan (Beat A) | Claude analyses the live snapshot → 3 threats: check-in surge (28 arrivals), towel depletion ≈19:30, T-03 vibration anomaly. Proposes a 3-action playbook → **Approve / Edit / Reject** cards |
| **18:05** | Ms. Chan checks in | Guest phone unlocks with a personalised welcome that *reacts to your earlier decisions* (T-03 offline → T-02 reserved; her knee note → low-impact cue) |
| **18:10** | Rostering shock (Beat B) | Trainer Ben calls in sick 20 min before HIIT Burn (14 booked). Playbook: call in Mei (+1.5 h OT) & notify guests |
| **18:30** | Class window | Saved (✅ swapped) or cancelled (🚨) depending on the manager's decision |
| **19:15** | Towel checkpoint | If the restock was rejected: stock critical → **TOWELS OUT** crisis banner, visible guest impact |
| **19:45** | Laundry run | Scheduled delivery (+120) — the "next run" the Conductor warned was too late for the peak |
| **21:40** | Express check-out | Ms. Chan checks out from her phone → folio closes, room-refresh task auto-dispatches, she receives a personalised **Stay Story** with preferences learned for her next visit |
| **21:55** | Close | Evening Brief ready — bottlenecks caught, waits, towel curve, decisions, tomorrow's look-ahead |

**Reject flow (the "human stays in control" money shot):** click ✋ on any action → pick a reason chip
("Overtime not allowed tonight") → the Conductor *re-plans live* around your constraint.

**Guest concierge:** after 18:05, type anything into Ms. Chan's phone ("the sauna feels cold").
Claude turns it into a tracked back-of-house work order; she watches a delivery-style tracker
(Received → Assigned → On the way → Done) while the ops board shows the same task dispatched to staff.

## Architecture

```
index.html ── styles.css
   │
   ├── data.js     seed hotel (staff, gym, equipment, 28 arrivals, Ms. Chan),
   │               scripted timeline, pre-baked AI responses (offline twin of Claude)
   ├── engine.js   deterministic sim clock (float sim-minutes, interleaved effects),
   │               ambient physics: occupancy curve, towel consumption, equipment decay,
   │               check-in queueing vs. agent count; approval → effect → task lifecycle
   ├── ai.js       Claude API (SSE streaming to the "AI thinking" panel):
   │               Conductor (snapshot → analysis + effect-typed actions),
   │               Concierge (free text → reply + work order), Evening Brief writer;
   │               lenient JSON extraction; graceful fallback to data.js
   └── app.js      3-pane render (Ops Board / Conductor / Guest Phone),
                   approve·edit·reject UI, reject-reason → re-plan loop, modals

server/proxy.mjs        zero-dependency Node proxy — keeps the API key server-side (see DEPLOY.md)
build-standalone.js     inlines everything into maestro-standalone.html (run: node build-standalone.js)
test/run-all.sh         full suite: syntax checks + engine smoke + 3 jsdom suites + sandboxed standalone
RUBRIC.md               point-by-point answers to the event's six questions (application-form ready)
DEPLOY.md               GitHub publish, static hosting, API-key modes, production checklist
DEMO-SCRIPT.md          minute-by-minute stage script, failure drills, Q&A ammo
LICENSE                 MIT
```

Design rules that make it demo-proof:
- **Zero dependencies.** No npm, no build, no CDN. Four JS files + one CSS file.
- **Deterministic sim.** Same decisions → same evening. Randomness is bounded noise.
- **Every AI call has an offline twin** shaped identically, so the UI path never changes when Wi-Fi dies.
- **Effects are typed** (`restock_towels`, `equipment_offline`, `reassign_staff`, `swap_trainer`, …).
  If live Claude invents an unknown effect, it degrades to a plain tracked task instead of breaking.

## Tests

```bash
node test/smoke.js        # engine-level: both branches (approved vs ignored) + stats
# DOM-level (needs jsdom once):
cd /tmp && npm i jsdom    # then see test notes below
```
`test/smoke.js` asserts: beat firing, towel projection window, T-03 offline, roster move,
trainer swap + guest notification, all-28 check-ins, low waits with 2 agents,
and the full crisis branch when everything is ignored.

---

## ⏱ STAGE BUILD PLAN — rebuilding this in 30 minutes with Claude Code

The hackathon builds live. This is the exact order and prompts so you finish with 5 minutes to spare.
Pre-write `data.js` (seed + timeline) *before* the event in your head/notes — on stage, paste it in 2 min.

| Min | Build | Prompt skeleton for Claude Code |
|---|---|---|
| 0–2 | Scaffold | "Create a zero-dependency single-page app: index.html + styles.css + data.js + engine.js + ai.js + app.js. Dark navy ops-dashboard theme, 3-column grid: Ops Board / AI Conductor / Guest Phone. Big tabular numbers, stage-readable from 5 m." |
| 2–6 | Seed + sim clock | "In data.js seed a hotel: 8 staff (roles/shifts), 6 gym machines with health %, 120 gym towels, 28 arrivals 18:00–19:00, VIP Ms. Chan (Gold, arrival 18:05, usual machine T-03, knee note). In engine.js a float-minute clock (speed 10–300×, pause, jump-to-next-beat) firing a scripted timeline: 17:40 conductor scan, 18:05 VIP check-in, 18:10 trainer sick, 18:30 class, 19:15 towel checkpoint, 21:55 close." |
| 6–12 | Ops board | "Render KPIs (gym occupancy, checked-in, avg wait, open tasks), towel bar with projected-depletion line from an occupancy curve, equipment tiles with health bars, roster chips, class rows, task board, scrolling activity feed, pulsing crisis banners. Re-render on engine state events." |
| 12–19 | Conductor + Claude | "ai.js: call Anthropic /v1/messages from the browser (stream SSE deltas into an 'AI thinking' panel). Conductor system prompt: given ops snapshot JSON return {analysis, actions[]} with typed effects (restock_towels, equipment_offline, reassign_staff, swap_trainer, notify_guests). Render each action as an Approve/Edit/Reject card; approve applies the effect at its scheduled sim-time; reject asks for a reason and re-plans. Offline fallback: pre-baked JSON of identical shape." |
| 19–25 | Guest phone | "Phone frame pane: locked until VIP check-in, then a personalised welcome that reflects current ops state (T-03 offline → T-02 reserved). Chat input → Claude concierge returning {reply, order}; orders become tracked tasks with a delivery-style progress tracker (received/assigned/en-route/done) and status messages back to the guest." |
| 25–28 | Evening Brief | "Modal: gather stats (bottlenecks caught, approved/edited/rejected, waits, towel low, class saved) → Claude writes {headline, bullets, tomorrow}; offline template fallback." |
| 28–30 | Rehearse | Run one full evening at 300×, approve everything, confirm no console errors. |

**If you can pre-rehearse (like now): your stage job is narration + typing the prompts you already know work.**
