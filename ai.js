/* ============================================================
   MAESTRO · ai.js — Claude integration layer
   · Conductor agent (bottleneck analysis → action playbook)
   · Guest concierge (free-text → tracked work order)
   · Evening Brief writer
   · Streams deltas to the "AI thinking" panel
   · Falls back to pre-baked intelligence offline (demo-safe)
   ============================================================ */

const AI = (() => {
  // sandbox-proof storage (preview iframes may forbid localStorage)
  const mem = {};
  const store = {
    get(k) { try { const v = localStorage.getItem(k); return v === null ? (k in mem ? mem[k] : null) : v; } catch (e) { return k in mem ? mem[k] : null; } },
    set(k, v) { mem[k] = v; try { localStorage.setItem(k, v); } catch (e) { /* memory only */ } }
  };

  function settings() {
    return {
      apiKey: store.get("maestro_key") || "",
      model: store.get("maestro_model") || "claude-sonnet-4-5",
      base: (store.get("maestro_base") || "https://api.anthropic.com").replace(/\/+$/, ""),
      mode: store.get("maestro_mode") || "auto" // auto | live | baked
    };
  }
  const endpoint = () => settings().base + "/v1/messages";
  function save(k, v) { store.set(k, v); }
  // live = a key in the browser OR a custom proxy base URL (proxy holds the key server-side)
  function isLive() {
    const s = settings();
    return (s.mode === "live" || s.mode === "auto") && (!!s.apiKey || s.base !== "https://api.anthropic.com");
  }
  function canCall() { return isLive(); }

  /* ---------- low-level Claude call (browser direct, SSE stream) ---------- */
  async function callClaude({ system, user, onDelta, maxTokens = 2000, timeoutMs = 30000 }) {
    const { apiKey, model } = settings();
    const headers = {
      "content-type": "application/json",
      "anthropic-version": "2023-06-01",
      "anthropic-dangerous-direct-browser-access": "true"
    };
    if (apiKey) headers["x-api-key"] = apiKey;
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), timeoutMs);
    try {
      const res = await fetch(endpoint(), {
        method: "POST",
        signal: ctrl.signal,
        headers,
        body: JSON.stringify({ model, max_tokens: maxTokens, system, stream: true, messages: [{ role: "user", content: user }] })
      });
      if (!res.ok) {
        const txt = await res.text().catch(() => "");
        throw new Error("Claude API " + res.status + " " + txt.slice(0, 200));
      }
      const reader = res.body.getReader();
      const dec = new TextDecoder();
      let buf = "", full = "";
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buf += dec.decode(value, { stream: true });
        const parts = buf.split("\n\n");
        buf = parts.pop();
        for (const part of parts) {
          for (const line of part.split("\n")) {
            if (!line.startsWith("data: ")) continue;
            const data = line.slice(6);
            if (data === "[DONE]") continue;
            try {
              const ev = JSON.parse(data);
              if (ev.type === "content_block_delta" && ev.delta && ev.delta.type === "text_delta") {
                full += ev.delta.text;
                if (onDelta) onDelta(ev.delta.text, full);
              }
              if (ev.type === "error") throw new Error("stream error");
            } catch (e) { /* ignore keep-alive/parse noise */ }
          }
        }
      }
      return full;
    } finally {
      clearTimeout(timer);
    }
  }

  /* ---------- lenient JSON extraction ---------- */
  function extractJSON(text) {
    if (!text) return null;
    let t = text.replace(/```json/gi, "```").trim();
    const start = t.indexOf("{");
    if (start < 0) return null;
    let depth = 0, inStr = false, esc = false;
    for (let i = start; i < t.length; i++) {
      const ch = t[i];
      if (inStr) {
        if (esc) esc = false;
        else if (ch === "\\") esc = true;
        else if (ch === '"') inStr = false;
      } else {
        if (ch === '"') inStr = true;
        else if (ch === "{") depth++;
        else if (ch === "}") { depth--; if (depth === 0) { try { return JSON.parse(t.slice(start, i + 1)); } catch (e) { return null; } } }
      }
    }
    return null;
  }

  /* ================= CONDUCTOR ================= */
  const CONDUCTOR_SYSTEM =
`You are MAESTRO, the AI operations conductor for the Harbour Grand Hotel & Club (gym, spa, front desk, housekeeping).
You receive a JSON snapshot of live operations. Your job:
1. Identify converging bottlenecks BEFORE guests feel them (front-of-house AND back-of-house).
2. Propose 2–4 concrete actions. Every action keeps a HUMAN in control — the duty manager approves, edits or rejects each one.
Respond with ONLY a JSON object, no markdown fences:
{
  "analysis": "concise multi-line operational read-out; name numbers, times and risks; 3 short numbered findings then a one-line recommendation",
  "actions": [
    {
      "id": "short-unique-id",
      "title": "imperative one-liner a manager can approve at a glance",
      "department": "Housekeeping|Engineering|Rostering|Guest Comms|Front Desk|Concierge|Operations",
      "severity": "high|medium|low",
      "rationale": "why now, why this, with numbers from the snapshot",
      "effect": { "type": "restock_towels|equipment_offline|equipment_limit|reassign_staff|swap_trainer|notify_guests|create_task", ...params }
    }
  ]
}
Effect params by type:
· restock_towels: {qty:int, at:"HH:MM"}
· equipment_offline: {id:"T-03", maintenanceAt:"06:00 tomorrow", migrateBookings:int}
· equipment_limit: {id:"T-03", maintenanceAt:"HH:MM"}
· reassign_staff: {name:"StaffName", to:"Front Desk", window:"HH:MM–HH:MM"}
· swap_trainer: {newTrainer:"Name", overtimeHrs:number, notifyCount:int}
· notify_guests: {count:int, message:"guest-facing copy"}
· create_task: {title, department, priority:"high|normal", etaMin:int}
Stay strictly within the snapshot facts. Be decisive, specific, calm.`;

  function snapshotJSON() {
    const s = Engine.state;
    const proj = projectTowelDepletion();
    return JSON.stringify({
      sim_clock: Engine.fmt(s.t) + " (Friday evening)",
      front_desk: { arrivals_expected_tonight: s.arrivals.total, arrived: s.arrivals.arrived, checked_in: s.arrivals.checkedIn, queue_now: s.arrivals.queue, agents_on_duty: countFrontDesk(), recent_avg_wait_min: avgWait() },
      gym: { capacity: SEED.gymCapacity, occupancy_now: s.inGym, classes: s.classes.map(c => ({ name: c.name, time: c.time, trainer: (s.staff.find(x => x.id === c.trainerId) || {}).name, booked: c.booked, status: c.status })) },
      towels: { gym_stock: Math.round(s.towels.stock), laundry_clean_available: s.towels.laundry, projected_depletion: proj ? Engine.fmt(proj) + " (≈" + Math.max(0, Math.round(proj - s.t)) + " min from now)" : "not projected before close" },
      equipment: s.equipment.map(e => ({ id: e.id, health_pct: e.health, status: e.status, anomaly: !!e.anomaly })),
      staff: s.staff.map(x => ({ name: x.name, role: x.reassignedTo ? x.role + " → " + x.reassignedTo : x.role, shift: x.shift, status: x.status })),
      open_tasks: s.tasks.filter(t => t.status !== "done").slice(0, 6).map(t => ({ title: t.title, dept: t.department })),
      flags: s.flags,
      vip_guest_in_house: { name: SEED.vip.name, tier: SEED.vip.tier, notes: SEED.vip.notes, usual_machine: SEED.vip.usualMachine, booked_class: SEED.vip.klass }
    }, null, 1);
  }

  function countFrontDesk() {
    return Engine.state.staff.filter(s => s.status === "on" && (s.role === "Front Desk" || s.reassignedTo === "Front Desk")).length;
  }
  function avgWait() {
    const w = Engine.state.arrivals.waits.slice(-10);
    return w.length ? Math.round(w.reduce((a, b) => a + b, 0) / w.length) : 0;
  }
  function projectTowelDepletion() {
    const s = Engine.state;
    let stock = s.towels.stock;
    const restocks = s.scheduledRestocks || [];
    const hiit = s.classes.find(c => c.id === "hiit");
    for (let m = Math.ceil(s.t); m <= SEED.endMin; m++) {
      restocks.forEach(r => { if (Math.floor(r.at) === m) stock += r.qty; });
      if (Math.floor(SEED.laundryRunAt) === m) stock += SEED.laundryRunQty;
      let occ = Engine.occupancyCurve(m);
      if (hiit && m >= 1110 && m <= 1155 && hiit.status !== "cancelled") occ += 10;
      stock -= occ * SEED.towels.usagePerGuestMin;
      if (stock <= 0) return m;
    }
    return null;
  }

  async function conductor({ beat, onDelta, extra }) {
    let user = "LIVE OPERATIONS SNAPSHOT:\n" + snapshotJSON();
    if (extra) user += "\n\nMANAGER FEEDBACK (a previous action was rejected — re-plan around this constraint):\n" + extra;
    try {
      if (!canCall()) throw new Error("no-key");
      const raw = await callClaude({ system: CONDUCTOR_SYSTEM, user, onDelta, maxTokens: 1800 });
      const parsed = extractJSON(raw);
      if (!parsed || !Array.isArray(parsed.actions) || !parsed.actions.length) throw new Error("bad-json");
      parsed.actions = parsed.actions.slice(0, 4).map((a, i) => ({
        id: a.id || ("x" + i), title: a.title || "Action", department: a.department || "Operations",
        severity: a.severity || "medium", rationale: a.rationale || "", effect: a.effect || { type: "create_task", title: a.title }
      }));
      return { analysis: parsed.analysis || "", actions: parsed.actions, live: true };
    } catch (err) {
      if (err.message !== "no-key") toastFallback(err.message);
      const key = extra ? "replan" : beat;
      const baked = BAKED[key] || BAKED.beatA;
      return { analysis: baked.analysis, actions: JSON.parse(JSON.stringify(baked.actions)), live: false };
    }
  }

  /* ================= CONCIERGE ================= */
  function conciergeSystem() {
    const s = Engine.state;
    return `You are the AI concierge ("Maestro") chatting with ${SEED.vip.name}, ${SEED.vip.tier}, room ${SEED.vip.room}, at the Harbour Grand Hotel & Club gym, Friday ${Engine.fmt(s.t)}.
Her profile: ${SEED.vip.notes} Usual machine ${SEED.vip.usualMachine}. Tonight's context: gym occupancy ${s.inGym}/${SEED.gymCapacity}; towel stock ${Math.round(s.towels.stock)}; HIIT class status ${s.classes.find(c => c.id === "hiit").status}; T-03 status ${s.equipment.find(e => e.id === "T-03").status}.
Reply with ONLY JSON:
{"reply":"warm, concise, 1-3 sentences, human, lightly personal (use her context when relevant; a single emoji max)",
 "order": null | {"type":"towels|maintenance|housekeeping|amenity","title":"5-8 word work-order title","priority":"high|normal","etaMin":integer 4-15}}
Create an order ONLY if she asks for something actionable or reports a problem. Never invent facilities. Never expose internal ops details beyond reassurance.`;
  }

  async function concierge(userText, history, onDelta) {
    try {
      if (!canCall()) throw new Error("no-key");
      const convo = history.slice(-8).map(m => (m.from === "chan" ? "Guest: " : "Concierge: ") + m.text.replace(/\n/g, " ")).join("\n");
      const raw = await callClaude({
        system: conciergeSystem(),
        user: (convo ? convo + "\n" : "") + "Guest: " + userText,
        onDelta, maxTokens: 600
      });
      const parsed = extractJSON(raw);
      if (!parsed || !parsed.reply) throw new Error("bad-json");
      return { reply: parsed.reply, order: parsed.order || null, live: true };
    } catch (err) {
      if (err.message !== "no-key") toastFallback(err.message);
      const lower = userText.toLowerCase();
      for (const rule of BAKED.conciergeRules) {
        if (rule.match.some(k => lower.includes(k))) return { reply: rule.reply, order: rule.order, live: false };
      }
      return { reply: BAKED.conciergeFallbackReply, order: { type: "amenity", title: "Guest request — concierge follow-up", etaMin: 8 }, live: false };
    }
  }

  /* ================= EVENING BRIEF ================= */
  async function eveningBrief(stats, onDelta) {
    try {
      if (!canCall()) throw new Error("no-key");
      const raw = await callClaude({
        system: "You are MAESTRO writing the duty manager's Evening Brief for the Harbour Grand Hotel & Club. Given the night's ops stats JSON, respond ONLY with JSON: {\"headline\":\"one punchy sentence with the key number\",\"bullets\":[\"6-8 crisp bullets, numbers first, ✅/⚠ where earned\"],\"tomorrow\":\"2-3 sentence look-ahead with one suggested focus\"}. No markdown.",
        user: "TONIGHT'S STATS:\n" + JSON.stringify(stats, null, 1),
        onDelta, maxTokens: 1200
      });
      const parsed = extractJSON(raw);
      if (!parsed || !parsed.headline) throw new Error("bad-json");
      return { ...parsed, live: true };
    } catch (err) {
      if (err.message !== "no-key") toastFallback(err.message);
      return { ...bakedBrief(stats), live: false };
    }
  }

  function toastFallback(msg) {
    const el = document.getElementById("toast");
    if (!el) return;
    el.textContent = "⚡ Offline fallback engaged (" + msg + ") — using pre-baked Maestro intelligence";
    el.classList.add("show");
    setTimeout(() => el.classList.remove("show"), 4000);
  }

  return { settings, save, isLive, conductor, concierge, eveningBrief, callClaude, snapshotJSON, projectTowelDepletion, toastFallback };
})();
