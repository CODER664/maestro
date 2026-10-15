/* ============================================================
   MAESTRO · engine.js — simulation clock, ambient model,
   timeline firing, effect application, task lifecycle, stats.
   Pure state machine — no DOM. Emits via Engine.listeners.
   ============================================================ */

const Engine = (() => {
  const listeners = { tick: [], event: [], state: [] };
  const on = (name, fn) => listeners[name].push(fn);
  const emit = (name, payload) => listeners[name].forEach(fn => fn(payload));

  let state = null;
  let raf = null, lastReal = 0;

  /* ---------------- helpers ---------------- */
  const fmt = m => {
    m = ((Math.floor(m) % 1440) + 1440) % 1440;
    return String(Math.floor(m / 60)).padStart(2, "0") + ":" + String(m % 60).padStart(2, "0");
  };
  const toMin = hhmm => { const [h, m] = hhmm.split(":").map(Number); return h * 60 + m; };
  const rnd = (a, b) => a + Math.random() * (b - a);
  const irnd = (a, b) => Math.round(rnd(a, b));
  const uid = (() => { let n = 0; return p => p + "-" + (++n); })();

  function log(text, tag = "info") {
    state.log.unshift({ t: fmt(state.t), text, tag });
    if (state.log.length > 60) state.log.pop();
    emit("state", { why: "log" });
  }

  /* ---------------- init ---------------- */
  function init() {
    state = {
      t: SEED.startMin,            // sim clock (float minutes)
      speed: 60,                   // sim-minutes per real minute
      running: false,
      lastWholeMin: Math.floor(SEED.startMin),

      inGym: 18,
      towels: { stock: SEED.towels.stock, laundry: SEED.towels.laundryPending },
      arrivals: { total: SEED.arrivalsTotal, arrived: 0, checkedIn: 0, queue: 0, waits: [] },

      equipment: SEED.equipment.map(e => ({ ...e, status: e.anomaly ? "watch" : "ok" })),
      staff: SEED.staff.map(s => ({ ...s })),
      classes: SEED.classes.map(c => ({ ...c })),

      tasks: [],
      approvals: [],       // pending
      history: [],         // resolved approvals
      guest: { checkedIn: false, checkedOut: false, messages: [], requests: [], unlocked: false, learnedPrefs: [] },
      flags: [],           // crisis banners
      stats: {
        bottlenecksCaught: 0, actionsProposed: 0, approved: 0, edited: 0, rejected: 0,
        guestRequests: 0, responses: [], towelLowest: SEED.towels.stock, towelCrisisAverted: true,
        maxWait: 0, checkedIn: 0, bookingsMigrated: 0, classSaved: false
      },
      log: [],
      timeline: TIMELINE.map(e => ({ ...e, fired: false })),
      pendingEffects: [],  // {at, fn, label}
      scheduledRestocks: [], // for towel projection: {at, qty}
      beatContext: {}      // beat id -> context for re-plan
    };
    // scheduled laundry delivery 19:45 (+70 clean) — the "next run" the Conductor mentions
    state.pendingEffects.push({
      at: SEED.laundryRunAt,
      label: "🧺 Scheduled laundry run delivered +" + SEED.laundryRunQty + " clean towels to the gym floor",
      fn: () => {
        state.towels.stock += SEED.laundryRunQty;
        if (state.flags.includes("towel-out")) { state.flags = state.flags.filter(f => f !== "towel-out"); }
      }
    });
    emit("state", { why: "init" });
  }

  /* ---------------- clock loop ---------------- */
  function start() { state.running = true; lastReal = performance.now(); loop(lastReal); emit("state", { why: "clock" }); }
  function pause() { state.running = false; if (raf) cancelAnimationFrame(raf); emit("state", { why: "clock" }); }
  function toggle() { state.running ? pause() : start(); }
  function setSpeed(s) { state.speed = s; emit("state", { why: "clock" }); }
  function loop(now) {
    if (!state.running) return;
    const dtMin = ((now - lastReal) / 60000) * state.speed; // sim minutes elapsed
    lastReal = now;
    advance(dtMin);
    raf = requestAnimationFrame(loop);
  }
  function advance(dtMin) {
    const target = Math.min(state.t + dtMin, SEED.endMin);
    // step whole sim-minutes one at a time so effects, timeline & ambient
    // stay correctly interleaved even on big jumps ("Next beat")
    while (Math.floor(target) > state.lastWholeMin) {
      state.lastWholeMin++;
      state.t = state.lastWholeMin;
      ambientMinute(state.lastWholeMin);
      fireTimeline();
      firePendingEffects();
      progressTasks();
    }
    state.t = target;
    fireTimeline();
    firePendingEffects();
    progressTasks();
    if (state.t >= SEED.endMin && state.running) pause();
    emit("tick", state.t);
  }
  function jumpToNextBeat() {
    const next = state.timeline.filter(e => !e.fired).sort((a, b) => a.at - b.at)[0];
    if (!next) { log("No further beats scheduled.", "warn"); return; }
    advance(Math.max(0.01, next.at - state.t));
  }

  /* ---------------- ambient model (per sim-minute) ---------------- */
  function occupancyCurve(m) {
    // ramp from 18 @17:30 to peak ~46 @18:45, plateau, decline to ~20 @21:30
    if (m < 1050) return 16;
    if (m < 1125) return 16 + (m - 1050) * (26 / 75);   // ramp 16 -> 42 by 18:45
    if (m < 1215) return 42;                            // peak plateau
    return Math.max(12, 42 - (m - 1215) * (30 / 105));  // wind down to ~12 by 22:00
  }

  function ambientMinute(m) {
    // gym occupancy (class adds a bump 18:30–19:15 if running)
    let occ = occupancyCurve(m) + rnd(-3, 3);
    const hiit = state.classes.find(c => c.id === "hiit");
    if (hiit && m >= 1110 && m <= 1155 && hiit.status !== "cancelled") occ += 10;
    state.inGym = Math.max(8, Math.min(SEED.gymCapacity, Math.round(occ)));

    // towel consumption
    const used = state.inGym * SEED.towels.usagePerGuestMin;
    if (state.towels.stock > 0) {
      state.towels.stock = Math.max(0, Math.round((state.towels.stock - used) * 10) / 10);
      state.towels.stock = Math.floor(state.towels.stock);
    }
    state.stats.towelLowest = Math.min(state.stats.towelLowest, state.towels.stock);
    if (state.towels.stock === 0 && !state.flags.includes("towel-out")) {
      state.flags.push("towel-out");
      state.stats.towelCrisisAverted = false;
      log("🚨 TOWELS OUT at the gym floor — guests waiting. Front-of-house impact is now visible.", "crisis");
      emit("event", { kind: "crisis", what: "towel-out" });
    }

    // arrivals / check-in
    while (state.arrivals.arrived < SEED.arrivals.length && SEED.arrivals[state.arrivals.arrived] <= m) {
      state.arrivals.arrived++;
      processCheckIn();
    }

    // equipment drift
    state.equipment.forEach(e => {
      if (e.status === "offline" || e.status === "maintenance") return;
      const load = e.anomaly && e.status !== "limited" ? 1.4 : 0.15;
      e.health = Math.max(5, +(e.health - load * rnd(0.5, 1.2) + rnd(-0.05, 0.05)).toFixed(1));
      if (e.anomaly && e.status === "watch" && e.health < 60 && !state.flags.includes("t03-crit")) {
        state.flags.push("t03-crit");
        log("⚠ T-03 health below 60% — failure risk now severe under load.", "crisis");
      }
    });

    emit("state", { why: "ambient" });
  }

  function frontDeskAgents() {
    return state.staff.filter(s =>
      s.status === "on" &&
      (s.role === "Front Desk" || (s.reassignedTo === "Front Desk" && s.reassignUntil >= state.t))
    ).length;
  }

  function processCheckIn() {
    const agents = frontDeskAgents();
    state.arrivals.queue++;
    const wait = agents >= 2 ? irnd(1, 3) : irnd(4, 12);
    state.arrivals.waits.push(wait);
    state.stats.maxWait = Math.max(state.stats.maxWait, wait);
    state.pendingEffects.push({
      at: state.t + wait,
      fn: () => {
        state.arrivals.queue = Math.max(0, state.arrivals.queue - 1);
        state.arrivals.checkedIn++;
        state.stats.checkedIn = state.arrivals.checkedIn;
        if (wait >= 8 && !state.flags.includes("queue")) {
          state.flags.push("queue");
          log("🚨 Check-in queue building — a guest just waited " + wait + " minutes.", "crisis");
          emit("event", { kind: "crisis", what: "queue" });
        }
        if (agents >= 2 && state.arrivals.queue === 0 && state.flags.includes("queue")) {
          state.flags = state.flags.filter(f => f !== "queue");
        }
      }
    });
  }

  /* ---------------- timeline ---------------- */
  function fireTimeline() {
    state.timeline.forEach(ev => {
      if (!ev.fired && state.t >= ev.at) {
        ev.fired = true;
        if (ev.log) log(ev.log, ev.kind === "conductor" || ev.kind === "sickness" ? "ai" : "info");
        emit("event", ev);
      }
    });
  }

  function firePendingEffects() {
    state.pendingEffects = state.pendingEffects.filter(pe => {
      if (state.t >= pe.at) {
        pe.fn();
        if (pe.label) log(pe.label, "ok");
        emit("state", { why: "effect" });
        return false;
      }
      return true;
    });
  }

  /* ---------------- tasks ---------------- */
  function createTask({ title, department, priority = "normal", etaMin = 8, guestId = null, source = "ops" }) {
    const assignee = pickAssignee(department);
    const task = {
      id: uid("task"), title, department, priority, etaMin, guestId, source,
      assignee, status: "assigned", createdMin: state.t,
      steps: [
        { key: "received", at: state.t },
        { key: "assigned", at: state.t + 1 },
        { key: "en_route", at: state.t + Math.max(2, etaMin * 0.4) },
        { key: "done",     at: state.t + etaMin }
      ],
      stepIdx: 0
    };
    state.tasks.unshift(task);
    if (task.steps[1].at <= state.t) task.stepIdx = 1;
    log("🧾 Task → " + department + ": " + title + (assignee ? " (" + assignee + ")" : ""), "task");
    emit("state", { why: "task" });
    return task;
  }

  function pickAssignee(department) {
    const map = {
      "Housekeeping": ["marco", "lena"],
      "Engineering": ["jun"],
      "Front Desk": ["ana", "priya"],
      "Rostering": ["ana"],
      "Guest Comms": ["sofia"],
      "Concierge": ["sofia"]
    };
    const ids = map[department] || [];
    for (const id of ids) {
      const s = state.staff.find(x => x.id === id);
      if (s && s.status !== "sick" && s.status !== "off") return s.name;
    }
    return state.staff.find(s => s.status === "on")?.name || "Duty team";
  }

  function progressTasks() {
    let changed = false;
    state.tasks.forEach(task => {
      if (task.status === "done") return;
      while (task.stepIdx < task.steps.length - 1 && state.t >= task.steps[task.stepIdx + 1].at) {
        task.stepIdx++;
        task.status = task.steps[task.stepIdx].key === "done" ? "done" : task.steps[task.stepIdx].key;
        changed = true;
        if (task.status === "done") {
          log("✅ Done: " + task.title, "ok");
          if (task.guestId === "chan") pushGuestMsg("✅ Your request is complete: " + task.title + ". Anything else, just ask — enjoy your evening, Ms. Chan!");
        } else if (task.guestId === "chan") {
          pushGuestMsg("🛎 Status: " + labelFor(task.status) + " — " + task.title + (task.assignee ? " · " + task.assignee + " is on it" : ""));
        }
      }
    });
    if (changed) emit("state", { why: "tasks" });
  }
  const labelFor = s => ({ assigned: "Assigned", en_route: "On the way", done: "Completed" }[s] || s);

  /* ---------------- guest (Ms. Chan) ---------------- */
  function pushGuestMsg(text, from = "maestro") {
    state.guest.messages.push({ from, text, t: fmt(state.t) });
    emit("state", { why: "guest" });
  }

  function chanCheckIn() {
    if (state.guest.checkedIn) return;
    state.guest.unlocked = true;
    state.guest.checkedIn = true;
    state.guest.checkedInMin = state.t;
    const t03 = state.equipment.find(e => e.id === "T-03");
    const hiit = state.classes.find(c => c.id === "hiit");
    const trainer = hiit.status === "swapped" ? "Trainer Mei" : (hiit.status === "cancelled" ? null : "Trainer Ben");
    let machineLine = "Your usual " + SEED.vip.usualMachine + " is ready for you.";
    if (t03.status === "offline" || t03.status === "maintenance") {
      machineLine = "Your usual T-03 is in preventive maintenance tonight — we've reserved T-02 for you, already set to your saved incline & pace.";
    } else if (t03.status === "limited") {
      machineLine = "Heads-up: T-03 is on a light load-limit tonight — T-02 is reserved for you with your saved settings.";
    }
    let classLine = trainer
      ? "HIIT Burn at 18:30 — " + (hiit.status === "swapped" ? "led by Trainer Mei tonight (Ben is off sick). Your spot is held, and we've noted your knee: Mei will offer low-impact variations." : "led by Trainer Ben. We've noted your knee: low-impact variations will be offered.")
      : "Tonight's HIIT Burn was cancelled — we've transferred you free of charge to Saturday's 10:00 session (spot held).";
    pushGuestMsg(
      "Welcome back, Ms. Chan! ✨ Gold Member · stay #47\n\n" +
      "• Check-in complete — Room 1208, key on your phone\n" +
      "• Locker " + SEED.vip.locker + " reserved (near the treadmills, as usual)\n" +
      "• " + machineLine + "\n" +
      "• " + classLine + "\n\nNeed anything at all, message me here — I'm live all evening.",
      "maestro"
    );
    emit("event", { kind: "chan-checked-in" });
  }

  /* ---------------- express check-out + Stay Story ---------------- */
  function checkoutChan() {
    if (!state.guest.checkedIn) { log("Check-out skipped — guest never checked in.", "warn"); return; }
    if (state.guest.checkedOut) return;
    state.guest.checkedOut = true;
    state.guest.checkedOutMin = state.t;

    // back-of-house cascade triggered by a front-of-house event
    createTask({ title: "Room 1208 refresh & mini-bar audit", department: "Housekeeping", priority: "normal", etaMin: 12 });
    createTask({ title: "Express folio settlement — Room 1208", department: "Front Desk", priority: "normal", etaMin: 4 });

    // learn preferences from tonight's actual behaviour
    const reqs = state.tasks.filter(t => t.guestId === "chan");
    const done = reqs.filter(t => t.status === "done").length;
    const prefs = [];
    if (reqs.some(t => /towel/i.test(t.title))) prefs.push("likes extra towels staged at the gym");
    if (reqs.some(t => /sauna|temperature|cold/i.test(t.title))) prefs.push("sensitive to sauna temperature — pre-check before arrival");
    const hiit = state.classes.find(c => c.id === "hiit");
    if (hiit.status === "swapped") prefs.push("Friday HIIT regular — notify early if the trainer changes");
    if (!prefs.length) prefs.push("prefers low-impact options (left knee)");
    state.guest.learnedPrefs = prefs;

    const classLine = hiit.status === "swapped" ? "HIIT Burn — attended with Trainer Mei 💪"
      : hiit.status === "cancelled" ? "HIIT Burn — cancelled (free rebook added to your account)"
      : "HIIT Burn — attended";
    pushGuestMsg(
      "🌙 Express check-out complete — thank you, Ms. Chan!\n\n" +
      "✨ Your evening at Harbour Grand:\n" +
      "• In " + fmt(state.guest.checkedInMin || 1085) + " · out " + fmt(state.t) + " — folio closed, receipt emailed\n" +
      "• " + classLine + "\n" +
      "• " + reqs.length + " request" + (reqs.length === 1 ? "" : "s") + " · " + done + " completed · locker " + SEED.vip.locker + " released\n\n" +
      "📝 Notes for your next stay: " + prefs.join(" · ") + "\n\nUntil next time — the team is already looking forward to it. 🏨",
      "maestro"
    );
    log("🌙 Ms. Chan checked out — Stay Story delivered, " + prefs.length + " preference(s) learned, room refresh dispatched.", "guest");
    emit("event", { kind: "chan-checked-out" });
  }

  /* ---------------- approvals & effects ---------------- */
  function proposeApproval(beat, analysis, actions) {
    const card = { id: uid("appr"), beat, analysis, actions: actions.map(a => ({ ...a, decision: null })), created: fmt(state.t), resolved: false };
    state.approvals.push(card);
    state.stats.actionsProposed += actions.length;
    state.stats.bottlenecksCaught += beat === "beatA" ? 3 : beat === "beatB" ? 1 : 0;
    state.beatContext[card.id] = { beat, analysis, actions };
    log("🧠 Maestro proposes " + actions.length + " action(s) — awaiting duty-manager decision.", "ai");
    emit("state", { why: "approval" });
    return card;
  }

  function applyEffect(effect, actionTitle) {
    const at = m => { const t = typeof m === "number" ? m : toMin(String(m).split(" ")[0]); return t <= state.t ? state.t + 3 : t; };
    switch (effect.type) {
      case "restock_towels": {
        const qty = +effect.qty || 25;
        const atMin = at(effect.at || fmt(state.t + 20));
        const restock = { at: atMin, qty };
        state.scheduledRestocks.push(restock);
        state.pendingEffects.push({
          at: atMin,
          label: "🧺 +" + qty + " clean towels staged on the gym floor (from laundry)",
          fn: () => {
            state.towels.stock += qty;
            state.towels.laundry = Math.max(0, state.towels.laundry - qty);
            state.scheduledRestocks = state.scheduledRestocks.filter(r => r !== restock);
            if (state.flags.includes("towel-out")) { state.flags = state.flags.filter(f => f !== "towel-out"); state.stats.towelCrisisAverted = true; }
          }
        });
        createTask({ title: actionTitle, department: "Housekeeping", priority: "high", etaMin: 10 });
        break;
      }
      case "equipment_offline": {
        const eq = state.equipment.find(e => e.id === effect.id);
        if (eq) { eq.status = "offline"; state.flags = state.flags.filter(f => f !== "t03-crit"); }
        state.stats.bookingsMigrated += +effect.migrateBookings || 0;
        createTask({ title: actionTitle, department: "Engineering", priority: "high", etaMin: 12 });
        break;
      }
      case "equipment_limit": {
        const eq = state.equipment.find(e => e.id === effect.id);
        if (eq) { eq.status = "limited"; eq.anomaly = true; }
        createTask({ title: actionTitle, department: "Engineering", priority: "medium", etaMin: 12 });
        break;
      }
      case "reassign_staff": {
        const s = state.staff.find(x => x.name === effect.name);
        if (s) {
          s.reassignedTo = effect.to;
          s.reassignUntil = at((effect.window || "").includes("20:00") ? 1200 : state.t + 120);
          s.status = "on";
        }
        break;
      }
      case "swap_trainer": {
        const hiit = state.classes.find(c => c.id === "hiit");
        hiit.status = "swapped";
        hiit.trainerId = "mei";
        const mei = state.staff.find(s => s.id === "mei");
        mei.status = "on"; mei.shift = "Called in · OT 1.5h";
        state.stats.classSaved = true;
        if (state.guest.checkedIn) {
          pushGuestMsg("🔄 Small update: tonight's HIIT Burn (18:30) will be led by Trainer Mei — Ben is off sick. Your spot is held, and Mei has your knee note: she'll cue low-impact variations for you.");
        }
        createTask({ title: actionTitle, department: "Rostering", priority: "high", etaMin: 6 });
        break;
      }
      case "notify_guests": {
        createTask({ title: actionTitle + " (" + effect.count + " guests)", department: "Guest Comms", priority: "normal", etaMin: 5 });
        break;
      }
      case "create_task": {
        createTask({ title: effect.title || actionTitle, department: effect.department || "Operations", priority: effect.priority || "normal", etaMin: effect.etaMin || 8 });
        break;
      }
      default:
        createTask({ title: actionTitle, department: effect.department || "Operations", priority: "normal", etaMin: 8 });
    }
    emit("state", { why: "effect-applied" });
  }

  function decide(cardId, actionId, decision, patch) {
    const card = state.approvals.find(c => c.id === cardId);
    const action = card.actions.find(a => a.id === actionId);
    action.decision = decision;
    if (patch) action.effect = { ...action.effect, ...patch };
    if (decision === "approved" || decision === "edited") {
      state.stats[decision]++;
      applyEffect(action.effect, action.title);
    } else if (decision === "rejected") {
      state.stats.rejected++;
      log("✋ Rejected: " + action.title, "warn");
    }
    if (card.actions.every(a => a.decision)) {
      card.resolved = true;
      state.approvals = state.approvals.filter(c => c.id !== cardId);
      state.history.unshift(card);
    }
    emit("state", { why: "decision" });
    return action.decision === "rejected";
  }

  /* ---------------- guest requests (concierge) ---------------- */
  function addGuestRequest(order, replyText) {
    if (order) {
      const task = createTask({
        title: order.title, department: deptForType(order.type),
        priority: order.priority || "normal", etaMin: order.etaMin || 8, guestId: "chan", source: "guest"
      });
      state.stats.guestRequests++;
      state.guest.requests.push({ taskId: task.id, title: order.title });
    }
    if (replyText) pushGuestMsg(replyText, "maestro");
  }
  function deptForType(t) {
    return { towels: "Housekeeping", maintenance: "Engineering", housekeeping: "Housekeeping", amenity: "Concierge" }[t] || "Concierge";
  }

  /* ---------------- evening brief ---------------- */
  function briefStats() {
    const s = state.stats;
    s.avgResponse = s.responses.length
      ? Math.round((s.responses.reduce((a, b) => a + b, 0) / s.responses.length) * 10) / 10
      : 1;
    return {
      ...s,
      checkouts: state.guest.checkedOut ? 1 : 0,
      prefsLearned: (state.guest.learnedPrefs || []).length,
      time: fmt(state.t)
    };
  }

  /* ---------------- public ---------------- */
  return {
    init, on, start, pause, toggle, setSpeed, jumpToNextBeat, advance,
    fmt, toMin, get state() { return state; }, occupancyCurve,
    log, proposeApproval, decide, createTask, addGuestRequest, pushGuestMsg,
    chanCheckIn, checkoutChan, briefStats, labelFor
  };
})();
