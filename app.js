/* ============================================================
   MAESTRO · app.js — rendering & interaction layer
   Three panes: OPS BOARD · CONDUCTOR · GUEST PHONE
   ============================================================ */

const App = (() => {
  const $ = sel => document.querySelector(sel);
  const esc = s => String(s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const S = () => Engine.state;

  /* =============== boot =============== */
  let booted = false;
  function boot() {
    if (booted) return;
    booted = true;
    Engine.init();
    wireControls();
    wireSettings();
    wireGuestInput();
    wireEngineEvents();
    renderAll();
    // gentle idle: start paused so operator controls the curtain
    Engine.log("Maestro online · watching Harbour Grand operations. Press ▶ to start the evening.", "ai");
    renderAll();
  }

  /* =============== engine wiring =============== */
  function wireEngineEvents() {
    Engine.on("tick", () => renderClock());
    Engine.on("state", () => renderAll());
    Engine.on("event", ev => {
      if (ev.kind === "conductor") runConductor(ev.beat);
      if (ev.kind === "sickness") {
        const ben = S().staff.find(s => s.id === "ben");
        ben.status = "sick"; ben.shift = "OUT — sick";
        const hiit = S().classes.find(c => c.id === "hiit");
        hiit.status = "at-risk";
        runConductor(ev.beat);
      }
      if (ev.kind === "chan-arrives") Engine.chanCheckIn();
      if (ev.kind === "chan-checkout") Engine.checkoutChan();
      if (ev.kind === "class-time") {
        const hiit = S().classes.find(c => c.id === "hiit");
        if (hiit.status === "at-risk" || hiit.status === "scheduled") {
          hiit.status = "cancelled";
          Engine.log("🚨 HIIT Burn cancelled — no trainer. 14 guests affected.", "crisis");
        } else if (hiit.status === "swapped") {
          Engine.log("🎉 HIIT Burn runs on time with Trainer Mei — 14 guests kept their Friday class.", "ok");
          if (S().guest.checkedIn) Engine.pushGuestMsg("💪 HIIT Burn starts in moments with Trainer Mei — she's got low-impact variations ready for your knee. Locker " + SEED.vip.locker + ", towels staged. Have a great session!");
        }
      }
      if (ev.kind === "towel-cliff") {
        const proj = AI.projectTowelDepletion();
        if (proj && S().towels.stock < 40 && !S().flags.includes("towel-low")) {
          S().flags.push("towel-low");
          Engine.log("⚠ Towel stock below 40 with depletion projected at " + Engine.fmt(proj) + ".", "crisis");
        }
      }
      if (ev.kind === "close") {
        Engine.log("🌙 Evening close — tap “Evening Brief” for Maestro's summary of the night.", "ai");
      }
    });
  }

  async function runConductor(beat, extra) {
    const thinkEl = $("#think-stream");
    thinkEl.classList.add("live");
    thinkEl.textContent = "";
    setConductorStatus("Maestro is analysing live operations…");
    const res = await AI.conductor({
      beat,
      extra,
      onDelta: (d, full) => { thinkEl.textContent = full; thinkEl.scrollTop = thinkEl.scrollHeight; }
    });
    thinkEl.classList.remove("live");
    setConductorStatus(res.live ? "Analysis complete · live from Claude" : "Analysis complete · offline intelligence");
    if (!res.live && !thinkEl.textContent) thinkEl.textContent = res.analysis;
    Engine.proposeApproval(beat, res.analysis, res.actions);
    renderConductor();
  }
  function setConductorStatus(txt) { $("#conductor-status").textContent = txt; }

  /* =============== controls =============== */
  function wireControls() {
    $("#btn-play").onclick = () => { Engine.toggle(); renderClock(); };
    $("#btn-jump").onclick = () => Engine.jumpToNextBeat();
    $("#btn-brief").onclick = showBrief;
    $("#btn-settings").onclick = () => $("#settings-modal").classList.add("open");
    $("#btn-close-settings").onclick = () => $("#settings-modal").classList.remove("open");
    $("#btn-close-brief").onclick = () => $("#brief-modal").classList.remove("open");
    $("#speed").onchange = e => Engine.setSpeed(+e.target.value);
    document.addEventListener("keydown", e => {
      if (e.target.tagName === "INPUT" || e.target.tagName === "TEXTAREA") return;
      if (e.code === "Space") { e.preventDefault(); Engine.toggle(); renderClock(); }
      if (e.key.toLowerCase() === "n") Engine.jumpToNextBeat();
      if (e.key.toLowerCase() === "b") showBrief();
    });
  }

  /* =============== settings =============== */
  function wireSettings() {
    const s = AI.settings();
    $("#set-key").value = s.apiKey;
    $("#set-model").value = s.model;
    $("#set-base").value = s.base === "https://api.anthropic.com" ? "" : s.base;
    $("#set-mode").value = s.mode;
    $("#btn-save-settings").onclick = () => {
      AI.save("maestro_key", $("#set-key").value.trim());
      AI.save("maestro_model", $("#set-model").value.trim() || "claude-sonnet-4-5");
      AI.save("maestro_base", $("#set-base").value.trim() || "https://api.anthropic.com");
      AI.save("maestro_mode", $("#set-mode").value);
      $("#settings-modal").classList.remove("open");
      renderModeBadge();
      Engine.log("⚙ Settings saved · mode: " + $("#set-mode").value, "info");
    };
    renderModeBadge();
  }
  function renderModeBadge() {
    const s = AI.settings();
    const badge = $("#mode-badge");
    const live = AI.isLive();
    badge.textContent = live ? "● LIVE · Claude " + s.model : "○ OFFLINE · baked intelligence";
    badge.className = live ? "badge live" : "badge baked";
  }

  /* =============== renderers =============== */
  function renderAll() {
    renderClock(); renderKPIs(); renderTowels(); renderEquipment();
    renderRoster(); renderClasses(); renderTasks(); renderLog(); renderFlags();
    renderConductor(); renderGuest(); renderModeBadge();
  }

  function renderClock() {
    const s = S();
    $("#clock").textContent = Engine.fmt(s.t);
    $("#clock-day").textContent = SEED.dayLabel + " · " + SEED.hotel;
    $("#btn-play").textContent = s.running ? "⏸" : "▶";
    const pct = ((s.t - SEED.startMin) / (SEED.endMin - SEED.startMin)) * 100;
    $("#timeline-bar").style.width = pct + "%";
    const nextBeat = s.timeline.filter(e => !e.fired).sort((a, b) => a.at - b.at)[0];
    $("#next-beat").textContent = nextBeat ? "Next beat: " + Engine.fmt(nextBeat.at) : "Final beat";
  }

  function renderKPIs() {
    const s = S();
    const avgWait = s.arrivals.waits.length ? (s.arrivals.waits.reduce((a, b) => a + b, 0) / s.arrivals.waits.length).toFixed(1) : "0";
    setKPI("kpi-gym", s.inGym + "/" + SEED.gymCapacity, "Gym occupancy", s.inGym > 42 ? "warn" : "ok");
    setKPI("kpi-arrivals", s.arrivals.checkedIn + "/" + s.arrivals.total, "Checked in", s.arrivals.queue > 2 ? "bad" : "ok");
    setKPI("kpi-wait", avgWait + "m", "Avg check-in wait", avgWait > 6 ? "bad" : avgWait > 3 ? "warn" : "ok");
    setKPI("kpi-tasks", s.tasks.filter(t => t.status !== "done").length, "Open tasks", "ok");
  }
  function setKPI(id, value, label, tone) {
    const el = document.getElementById(id);
    el.querySelector(".kpi-value").textContent = value;
    el.querySelector(".kpi-label").textContent = label;
    el.querySelector(".kpi-value").className = "kpi-value " + tone;
  }

  function renderTowels() {
    const s = S();
    const pct = Math.min(100, (s.towels.stock / 160) * 100);
    $("#towel-bar").style.width = pct + "%";
    $("#towel-bar").className = "bar-fill " + (s.towels.stock < 25 ? "bad" : s.towels.stock < 60 ? "warn" : "ok");
    $("#towel-num").textContent = Math.round(s.towels.stock);
    $("#towel-laundry").textContent = s.towels.laundry + " clean in laundry";
    const proj = AI.projectTowelDepletion();
    $("#towel-proj").textContent = proj ? "⚠ projected depletion " + Engine.fmt(proj) : "✓ no depletion projected before close";
    $("#towel-proj").className = "towel-proj " + (proj ? "warn" : "ok");
  }

  function renderEquipment() {
    $("#equipment-grid").innerHTML = S().equipment.map(e => {
      const tone = e.status === "offline" || e.status === "maintenance" ? "bad"
        : e.status === "limited" ? "warn"
        : e.health < 70 ? "bad" : e.health < 85 ? "warn" : "ok";
      const statusLabel = { ok: "IN SERVICE", watch: "WATCH", limited: "LOAD-LIMITED", offline: "OFFLINE", maintenance: "MAINTENANCE" }[e.status] || e.status.toUpperCase();
      return `<div class="eq-tile ${tone}">
        <div class="eq-id">${esc(e.id)}</div>
        <div class="eq-name">${esc(e.name)}</div>
        <div class="eq-health"><div class="eq-health-fill ${tone}" style="width:${Math.max(4, e.health)}%"></div></div>
        <div class="eq-meta"><span>${e.health.toFixed(0)}%</span><span class="eq-status ${tone}">${statusLabel}</span></div>
      </div>`;
    }).join("");
  }

  function renderRoster() {
    $("#roster").innerHTML = S().staff.map(s => {
      const tone = s.status === "sick" ? "bad" : s.status === "off" ? "dim" : s.reassignedTo ? "moved" : "ok";
      const role = s.reassignedTo && s.reassignUntil >= S().t ? s.role + " → " + s.reassignedTo : s.role;
      const dot = { on: "●", off: "○", sick: "✕", call: "◐" }[s.status] || "●";
      return `<div class="staff-chip ${tone}" title="${esc(s.name)} · ${esc(s.shift)}">
        <span class="staff-dot">${dot}</span>
        <div><div class="staff-name">${esc(s.name)}</div><div class="staff-role">${esc(role)}</div><div class="staff-shift">${esc(s.shift)}</div></div>
      </div>`;
    }).join("");
  }

  function renderClasses() {
    $("#classes").innerHTML = S().classes.map(c => {
      const trainer = (S().staff.find(x => x.id === c.trainerId) || {}).name || "—";
      const tone = c.status === "cancelled" ? "bad" : c.status === "at-risk" || c.status === "needs-trainer" ? "warn" : "ok";
      const label = { scheduled: "SCHEDULED", swapped: "SAVED · trainer swapped", cancelled: "CANCELLED", "at-risk": "AT RISK · no trainer", "needs-trainer": "NEEDS TRAINER" }[c.status] || c.status;
      return `<div class="class-row ${tone}"><b>${esc(c.name)}</b> ${esc(c.time)} · ${esc(trainer)} · ${c.booked} booked<span class="class-status ${tone}">${label}</span></div>`;
    }).join("");
  }

  function renderTasks() {
    const tasks = S().tasks.slice(0, 9);
    $("#task-board").innerHTML = tasks.length ? tasks.map(t => `
      <div class="task-row ${t.status === "done" ? "done" : ""}">
        <span class="task-dept ${deptClass(t.department)}">${esc(t.department)}</span>
        <span class="task-title">${esc(t.title)}</span>
        <span class="task-who">${esc(t.assignee || "")}</span>
        <span class="task-status ${t.status}">${Engine.labelFor(t.status) || t.status}</span>
      </div>`).join("") : `<div class="empty">No tasks yet — the floor is quiet. For now.</div>`;
  }
  function deptClass(d) { return d.toLowerCase().replace(/[^a-z]/g, ""); }

  function renderLog() {
    $("#log").innerHTML = S().log.slice(0, 24).map(l =>
      `<div class="log-row ${l.tag}"><span class="log-t">${l.t}</span><span>${esc(l.text)}</span></div>`).join("");
  }

  function renderFlags() {
    const map = {
      "towel-out": "🚨 TOWELS OUT — gym floor",
      "towel-low": "⚠ Towel stock critical",
      "queue": "🚨 Check-in queue > 8 min",
      "t03-crit": "⚠ T-03 failure risk severe"
    };
    $("#flags").innerHTML = S().flags.map(f => map[f] ? `<div class="flag">${map[f]}</div>` : "").join("");
  }

  /* =============== conductor pane =============== */
  function renderConductor() {
    const s = S();
    const q = $("#approval-queue");
    q.innerHTML = s.approvals.map(card => `
      <div class="appr-card" data-card="${card.id}">
        <div class="appr-head">🧠 Maestro playbook · ${card.created} <span class="appr-beat">${card.beat === "beatA" ? "bottleneck scan" : card.beat === "beatB" ? "rostering shock" : "re-plan"}</span></div>
        <div class="appr-analysis">${esc(card.analysis).replace(/\n/g, "<br>")}</div>
        ${card.actions.map(a => actionHTML(card.id, a)).join("")}
      </div>`).join("") ||
      (s.history.length ? "" : `<div class="empty">Conductor standing by — watching arrivals, gym telemetry, laundry, roster & requests.</div>`);

    // history (collapsed)
    $("#conductor-history").innerHTML = s.history.map(card =>
      `<div class="hist-row">${card.created} · ${card.actions.map(a => decisionIcon(a.decision)).join(" ")}</div>`).join("");

    // wire buttons
    q.querySelectorAll("[data-approve]").forEach(b => b.onclick = () => onDecide(b.dataset.approve, b.dataset.action, "approved"));
    q.querySelectorAll("[data-reject]").forEach(b => b.onclick = () => onRejectPending(b.dataset.reject, b.dataset.action));
    q.querySelectorAll("[data-edit]").forEach(b => b.onclick = () => toggleEdit(b.dataset.edit, b.dataset.action));
    q.querySelectorAll("[data-saveedit]").forEach(b => b.onclick = () => saveEdit(b.dataset.saveedit, b.dataset.action));
  }
  function decisionIcon(d) { return d === "approved" ? "✅" : d === "edited" ? "✏️" : d === "rejected" ? "✋" : "·"; }

  function actionHTML(cardId, a) {
    const sev = a.severity || "medium";
    if (a.decision && a.decision !== "rejected") {
      return `<div class="action resolved ${a.decision}">
        <div class="action-title">${a.decision === "edited" ? "✏️" : "✅"} ${esc(a.title)}</div>
        <div class="action-dept"><span class="dept-pill ${deptClass(a.department)}">${esc(a.department)}</span><span class="sev ${sev}">${sev}</span><span class="decision-note">${a.decision === "edited" ? "approved with edits — effects applied as amended" : "approved — effects applied"}</span></div>
      </div>`;
    }
    if (a.decision === "rejected") {
      return `<div class="action resolved rejected">
        <div class="action-title">✋ ${esc(a.title)}</div>
        <div class="action-dept"><span class="dept-pill ${deptClass(a.department)}">${esc(a.department)}</span><span class="decision-note">rejected — Maestro is re-planning around the manager's constraint</span></div>
      </div>`;
    }
    if (a.pendingReject) {
      return `<div class="action rejected-card">
        <div class="action-title">✋ ${esc(a.title)}</div>
        <div class="reject-box">
          <div class="reject-label">Tell Maestro why — it will re-plan:</div>
          <div class="reject-chips">
            <button class="chip" data-reason="${cardId}" data-action="${a.id}">Laundry is short-staffed</button>
            <button class="chip" data-reason="${cardId}" data-action="${a.id}">Overtime not allowed tonight</button>
            <button class="chip" data-reason="${cardId}" data-action="${a.id}">Handle it after the peak</button>
          </div>
        </div>
      </div>`;
    }
    const editable = a.effect && typeof a.effect === "object"
      ? Object.entries(a.effect).filter(([k, v]) => k !== "type" && (typeof v === "number" || typeof v === "string"))
      : [];
    return `<div class="action" id="action-${cardId}-${a.id}">
      <div class="action-title">${esc(a.title)}</div>
      <div class="action-dept"><span class="dept-pill ${deptClass(a.department)}">${esc(a.department)}</span><span class="sev ${sev}">${sev}</span></div>
      <div class="action-why">${esc(a.rationale || "")}</div>
      <div class="edit-box hidden" id="edit-${cardId}-${a.id}">
        ${editable.map(([k, v]) => `<label>${esc(k)} <input class="edit-field" data-k="${esc(k)}" value="${esc(v)}" ${typeof v === "number" ? 'type="number"' : ""}></label>`).join("")}
      </div>
      <div class="action-btns">
        <button class="btn approve" data-approve="${cardId}" data-action="${a.id}">✓ Approve</button>
        <button class="btn edit" data-edit="${cardId}" data-action="${a.id}">✏️ Edit</button>
        <button class="btn reject" data-reject="${cardId}" data-action="${a.id}">✋ Reject</button>
        <button class="btn approve hidden" data-saveedit="${cardId}" data-action="${a.id}">Save & approve</button>
      </div>
    </div>`;
  }

  function onDecide(cardId, actionId, decision) {
    Engine.decide(cardId, actionId, decision);
    renderAll();
  }
  function onRejectPending(cardId, actionId) {
    const card = S().approvals.find(c => c.id === cardId);
    if (!card) return;
    const a = card.actions.find(x => x.id === actionId);
    if (a) a.pendingReject = true;
    renderConductor();
  }
  function toggleEdit(cardId, actionId) {
    const box = document.getElementById("edit-" + cardId + "-" + actionId);
    box.classList.toggle("hidden");
  }
  function saveEdit(cardId, actionId) {
    const box = document.getElementById("edit-" + cardId + "-" + actionId);
    const patch = {};
    box.querySelectorAll(".edit-field").forEach(inp => {
      const v = inp.value;
      patch[inp.dataset.k] = inp.type === "number" ? +v : v;
    });
    Engine.decide(cardId, actionId, "edited", patch);
    renderAll();
  }
  // reject-with-reason → re-plan through the Conductor
  document.addEventListener("click", async e => {
    const chip = e.target.closest("[data-reason]");
    if (!chip) return;
    const cardId = chip.dataset.reason, actionId = chip.dataset.action;
    const card = S().history.find(c => c.id === cardId) || S().approvals.find(c => c.id === cardId);
    const beat = card ? card.beat : "replan";
    Engine.decide(cardId, actionId, "rejected");
    renderAll();
    await runConductor("replan", "Manager rejected: \"" + chip.textContent + "\". Respect this constraint and propose an alternative playbook.");
  });

  /* =============== guest phone =============== */
  function renderGuest() {
    const s = S();
    const feed = $("#guest-feed");
    if (!s.guest.unlocked) {
      $("#guest-lock").classList.remove("hidden");
      feed.innerHTML = "";
      $("#guest-tracker").innerHTML = "";
      return;
    }
    $("#guest-lock").classList.add("hidden");
    $("#phone-sub").textContent = s.guest.checkedOut ? "Room 1208 · Checked out ✓" : "Room 1208 · Gold Member";
    feed.innerHTML = s.guest.messages.map(m =>
      `<div class="msg ${m.from === "chan" ? "them" : "bot"}"><div class="msg-text">${esc(m.text).replace(/\n/g, "<br>")}</div><div class="msg-t">${m.t}</div></div>`).join("");
    feed.scrollTop = feed.scrollHeight;

    const open = s.tasks.filter(t => t.guestId === "chan" && t.status !== "done");
    const recent = s.tasks.filter(t => t.guestId === "chan").slice(0, 3);
    const input = $("#guest-input");
    input.disabled = !!s.guest.checkedOut;
    input.placeholder = s.guest.checkedOut ? "Folio closed — see you next time ✨" : "Ask Maestro anything…";
    $("#guest-tracker").innerHTML = recent.length ? recent.map(t => `
      <div class="tracker-card ${t.status === "done" ? "done" : ""}">
        <div class="tracker-title">${esc(t.title)}</div>
        <div class="tracker-steps">
          ${["received", "assigned", "en_route", "done"].map((k, i) => `
            <div class="tstep ${i <= t.stepIdx ? "on" : ""}">
              <div class="tdot"></div><div class="tlabel">${{ received: "Received", assigned: "Assigned", en_route: "On the way", done: "Done" }[k]}</div>
            </div>`).join('<div class="tline"></div>')}
        </div>
        <div class="tracker-eta">${t.status === "done" ? "Completed ✨" : "ETA " + t.etaMin + " min · " + esc(t.assignee || "")}</div>
      </div>`).join("") : "";
  }

  function wireGuestInput() {
    const input = $("#guest-input");
    const send = async () => {
      const text = input.value.trim();
      if (!text) return;
      const s = S();
      if (!s.guest.unlocked) { Engine.log("Guest pane unlocks when Ms. Chan checks in at 18:05 (or tap “Jump to next beat”).", "warn"); return; }
      input.value = "";
      s.guest.messages.push({ from: "chan", text, t: Engine.fmt(s.t) });
      renderGuest();
      const t0 = performance.now();
      const think = $("#guest-think");
      think.classList.remove("hidden");
      think.textContent = "Maestro is reading…";
      const res = await AI.concierge(text, s.guest.messages, (d, full) => { think.textContent = full.slice(-240); });
      think.classList.add("hidden");
      const respMin = Math.max(1, Math.round((performance.now() - t0) / 1000));
      s.stats.responses.push(respMin);
      Engine.addGuestRequest(res.order, res.reply);
      Engine.log("💬 Guest request handled via concierge (" + (res.live ? "live Claude" : "offline") + "): " + (res.order ? res.order.title : "chat only"), "guest");
      renderAll();
    };
    input.addEventListener("keydown", e => { if (e.key === "Enter") send(); });
    $("#guest-send").onclick = send;
  }

  /* =============== evening brief =============== */
  async function showBrief() {
    const modal = $("#brief-modal");
    modal.classList.add("open");
    const body = $("#brief-body");
    body.innerHTML = `<div class="brief-loading">Maestro is writing tonight's brief<span class="dots">…</span></div>`;
    const stats = Engine.briefStats();
    const think = document.createElement("div");
    think.className = "think-stream small";
    body.appendChild(think);
    const res = await AI.eveningBrief(stats, (d, full) => { think.textContent = full; });
    body.innerHTML = `
      <div class="brief-head">🌙 Evening Brief · ${SEED.dayLabel} ${Engine.fmt(S().t)} · ${esc(SEED.hotel)}</div>
      <div class="brief-headline">${esc(res.headline)}</div>
      <ul class="brief-bullets">${(res.bullets || []).map(b => `<li>${esc(b)}</li>`).join("")}</ul>
      <div class="brief-tomorrow"><b>Tomorrow</b><br>${esc(res.tomorrow || "")}</div>
      <div class="brief-foot">${res.live ? "Written live by Claude from tonight's ops telemetry" : "Offline template · wire an API key for live writing"}</div>`;
  }

  return { boot };
})();

document.addEventListener("DOMContentLoaded", App.boot);
