/* ============================================================
   MAESTRO · data.js — seed data, scripted timeline, fallbacks
   Harbour Grand Hotel · Friday evening simulation
   ============================================================ */

const SEED = {
  hotel: "Harbour Grand Hotel & Club",
  dayLabel: "Friday",
  startMin: 17 * 60 + 30, // 17:30
  endMin: 22 * 60,        // 22:00

  // ---- Guests / arrivals -------------------------------------
  arrivalsTotal: 28,       // booking surge 18:00–19:00
  arrivals: [              // arrival times in sim-minutes (spread 18:00–19:00)
    1080,1083,1086,1089,1092,1095,1098,1101,1104,1107,1110,1113,
    1116,1119,1122,1125,1128,1131,1134,1137,1140,1143,1146,1149,
    1152,1155,1158,1160
  ],

  // ---- VIP guest for the front-of-house story ----------------
  vip: {
    name: "Ms. Chan",
    room: "1208",
    tier: "Gold Member · 47 stays",
    arrivalMin: 18 * 60 + 5, // 18:05
    locker: 12,
    usualMachine: "T-03",
    notes: "Prefers low-impact options (left knee). Books HIIT Fridays.",
    klass: "HIIT Burn · 18:30"
  },

  // ---- Gym & resources ---------------------------------------
  gymCapacity: 60,
  towels: { stock: 120, laundryPending: 150, usagePerGuestMin: 0.024 },
  laundryRunAt: 19 * 60 + 45,   // scheduled laundry delivery 19:45 (+120)
  laundryRunQty: 120,

  // ---- Equipment ----------------------------------------------
  equipment: [
    { id: "T-01", name: "Treadmill 01", kind: "treadmill", health: 97 },
    { id: "T-02", name: "Treadmill 02", kind: "treadmill", health: 94 },
    { id: "T-03", name: "Treadmill 03", kind: "treadmill", health: 82, anomaly: true },
    { id: "T-04", name: "Treadmill 04", kind: "treadmill", health: 96 },
    { id: "B-01", name: "Spin Bike 01", kind: "bike",      health: 91 },
    { id: "R-01", name: "Rower 01",     kind: "rower",     health: 98 }
  ],

  // ---- Staff roster --------------------------------------------
  staff: [
    { id: "ana",   name: "Ana",   role: "Front Desk",   shift: "16:00–22:00", status: "on" },
    { id: "sofia", name: "Sofia", role: "Concierge",    shift: "16:00–22:00", status: "on" },
    { id: "priya", name: "Priya", role: "Spa",          shift: "16:00–22:00", status: "on" },
    { id: "marco", name: "Marco", role: "Housekeeping", shift: "14:00–22:00", status: "on" },
    { id: "lena",  name: "Lena",  role: "Housekeeping", shift: "16:00–00:00", status: "on" },
    { id: "ben",   name: "Ben",   role: "Trainer",      shift: "14:00–20:00", status: "on" },
    { id: "mei",   name: "Mei",   role: "Trainer",      shift: "OFF today",   status: "off" },
    { id: "jun",   name: "Jun",   role: "Engineering",  shift: "on-call",     status: "call" }
  ],

  // ---- Classes --------------------------------------------------
  classes: [
    { id: "hiit", name: "HIIT Burn", time: "18:30", trainerId: "ben", booked: 14, status: "scheduled" },
    { id: "yoga", name: "Restorative Yoga", time: "19:30", trainerId: "mei", booked: 9, status: "needs-trainer" }
  ]
};

/* ---------- Scripted timeline (fires by sim-minute) ------------
   kinds: conductor | arrival-surge | sickness | chan-arrives |
          class-time | towel-cliff | close
-----------------------------------------------------------------*/
const TIMELINE = [
  { at: 17*60+40, kind: "conductor",   beat: "beatA",
    log: "Conductor scan: check-in surge, towel trajectory & T-03 telemetry flagged" },
  { at: 18*60+5,  kind: "chan-arrives", log: "Ms. Chan scans QR at the kiosk — check-in" },
  { at: 18*60+10, kind: "sickness",     beat: "beatB",
    log: "📞 Trainer Ben calls in sick — HIIT Burn (18:30, 14 booked) has no trainer" },
  { at: 18*60+30, kind: "class-time",   log: "HIIT Burn class window opens" },
  { at: 19*60+15, kind: "towel-cliff",  log: "Towel projection checkpoint (19:15)" },
  { at: 21*60+40, kind: "chan-checkout", log: "Ms. Chan taps express check-out — Stay Story & preference learning" },
  { at: 21*60+55, kind: "close",        log: "Operations day closing — Evening Brief ready" }
];

/* ---------- Pre-baked AI responses (offline fallback) ----------
   Used when no API key / network fails. Shaped exactly like the
   JSON we ask Claude for, so the UI path is identical.
-----------------------------------------------------------------*/
const BAKED = {
  beatA: {
    analysis:
`Three converging risks detected for the 18:00–19:00 window:

1) CHECK-IN SURGE — 28 arrivals booked between 18:00 and 19:00. With one front-desk agent on duty, projected average wait climbs past 9 minutes by 18:35.
2) TOWEL TRAJECTORY — gym stock is 120 units. At projected occupancy (peak ~46 guests + the 18:30 HIIT class), consumption reaches zero by ≈19:30. Laundry holds 150 clean units, but the next scheduled run does not land until 19:45 — 15 minutes of guests waiting with nothing to dry off on.
3) EQUIPMENT RISK — Treadmill T-03 shows a vibration anomaly (health 82%, falling ~1.4%/hr under load). Failure probability within 72 hrs: high. Two bookings reference T-03 tonight, including Ms. Chan's usual machine.

Proposed playbook keeps every decision with the duty manager.`,
    actions: [
      { id: "a1", title: "Pre-stage 120 clean towels: laundry → gym floor",
        department: "Housekeeping", severity: "high",
        rationale: "Closes the ≈19:30 towel gap before the peak lands. Lena is on duty and laundry holds 150 clean units.",
        effect: { type: "restock_towels", qty: 120, at: "18:30" } },
      { id: "a2", title: "Take T-03 offline tonight · maintenance 06:00 · migrate bookings to T-02/T-04",
        department: "Engineering", severity: "high",
        rationale: "Removes failure risk during peak load; Jun (on-call) can service at 06:00 before the gym opens. Affected guests get a proactive note — no 'out of order' surprise.",
        effect: { type: "equipment_offline", id: "T-03", maintenanceAt: "06:00 tomorrow", migrateBookings: 2 } },
      { id: "a3", title: "Reassign Priya (Spa → Front Desk) for 18:00–20:00",
        department: "Rostering", severity: "medium",
        rationale: "Spa utilisation tonight is 31%. A second check-in agent holds average wait under 3 minutes through the surge.",
        effect: { type: "reassign_staff", name: "Priya", to: "Front Desk", window: "18:00–20:00" } }
    ]
  },

  beatB: {
    analysis:
`Rostering shock: Trainer Ben (HIIT Burn, 18:30) is out sick. 14 guests booked — 9 are hotel guests, 5 external members. The 19:30 Yoga also lists Mei (already off today).

Options weighed: (a) cancel & rebook — refunds + churn risk on a Friday flagship class; (b) run with Mei on 1.5 hrs overtime — she is HIIT-certified, rested, 12 min away; (c) merge into Yoga — capacity/format mismatch.

Recommendation: (b), with immediate guest comms so nobody arrives to a cancelled class.`,
    actions: [
      { id: "b1", title: "Call in Trainer Mei — HIIT Burn 18:30 (+1.5 h overtime)",
        department: "Rostering", severity: "high",
        rationale: "Mei is HIIT-certified and off today (rested). Overtime cost ≈ 1.5 h vs. 14 rebooking refunds and churn on the flagship Friday class.",
        effect: { type: "swap_trainer", newTrainer: "Mei", overtimeHrs: 1.5, notifyCount: 14 } },
      { id: "b2", title: "Notify 14 class guests: trainer change + free rebook option",
        department: "Guest Comms", severity: "medium",
        rationale: "Proactive message before 18:30 keeps satisfaction neutral; the rebook option covers guests who preferred Ben's format.",
        effect: { type: "notify_guests", count: 14, message: "Tonight's HIIT Burn (18:30) will be led by Trainer Mei. Your spot is held — reply REBOOK for a free transfer to any class this week." } }
    ]
  },

  replan: {
    analysis:
`Understood — previous proposal declined by the duty manager. Re-planning with tighter constraints: no laundry overtime, no external call-ins, minimal guest impact.`,
    actions: [
      { id: "r1", title: "Divert 60 towels from pool stock to gym (pool closes 20:00)",
        department: "Housekeeping", severity: "medium",
        rationale: "Pool demand drops after 19:00; 60 units bridge the gym gap to the 19:45 laundry run without overtime.",
        effect: { type: "restock_towels", qty: 60, at: "18:45" } },
      { id: "r2", title: "Load-limit T-03 (walk/jog only) + service tonight at 21:30",
        department: "Engineering", severity: "medium",
        rationale: "Interim derating cuts failure risk ~70%; Jun services after the evening peak instead of 06:00.",
        effect: { type: "equipment_limit", id: "T-03", maintenanceAt: "21:30" } }
    ]
  },

  conciergeRules: [
    { match: ["towel"],            order: { type: "towels",       title: "Extra towels to gym floor",        etaMin: 6  },
      reply: "Of course, Ms. Chan — fresh towels are on their way to the gym floor. Tracker updated below. 🧖‍♀️" },
    { match: ["cold","sauna","temperature","ac","air"], order: { type: "maintenance", title: "Sauna temperature check", etaMin: 12 },
      reply: "Sorry about that — I've flagged the sauna temperature to engineering right now. Jun is on it; I'll confirm the moment it's back in range." },
    { match: ["broken","not working","stuck","noise","smell"], order: { type: "maintenance", title: "Equipment fault reported", etaMin: 10 },
      reply: "Thanks for telling me — I've logged the fault and tagged the machine out so nobody else hits it. Engineering is en route." },
    { match: ["clean","tidy","spill","mess"], order: { type: "housekeeping", title: "Clean-up requested", etaMin: 8 },
      reply: "On it — housekeeping has been pinged with the exact location. Should be spotless within minutes." },
    { match: ["water","bottle","drink"], order: { type: "amenity", title: "Water & refreshments", etaMin: 5 },
      reply: "Chilled water and a citrus towel are coming over now. Enjoy the session! 💧" }
  ],

  conciergeFallbackReply:
    "Noted, Ms. Chan — I've passed this to the floor team and opened a tracked request. You'll see live status below; anything urgent, just tap the bell."
};

/* ---------- Evening Brief fallback template -------------------- */
function bakedBrief(stats, state) {
  const towelLine = stats.towelCrisisAverted
    ? "Towel gap closed proactively — stock never fell below " + stats.towelLowest + " units."
    : "⚠ Towel stock hit zero at the gym. Next time, approve the pre-stage playbook earlier.";
  return {
    headline: stats.bottlenecksCaught + " bottlenecks caught before guests felt them.",
    bullets: [
      "Check-in surge absorbed: " + stats.checkedIn + " of " + SEED.arrivalsTotal + " arrivals processed, peak wait " + stats.maxWait + " min" + (stats.maxWait <= 4 ? " (target <5 ✅)" : " (target <5 missed)"),
      towelLine,
      "Equipment: T-03 taken out of rotation on predictive flag — no in-service failure, " + stats.bookingsMigrated + " bookings migrated with proactive guest notes",
      stats.classSaved ? "HIIT Burn saved: 14 guests kept their Friday class (trainer swap, 1.5 h OT)" : "HIIT Burn cancelled — 14 rebooks issued",
      "Guest requests handled: " + stats.guestRequests + ", average first response " + stats.avgResponse + " min",
      stats.checkouts
        ? "Express check-out closed the loop: Stay Story delivered, " + stats.prefsLearned + " preference(s) learned for the next visit, room refresh auto-dispatched"
        : "No check-outs processed this evening",
      "Decisions stayed human: " + stats.approved + " approved · " + stats.edited + " edited · " + stats.rejected + " rejected & re-planned"
    ],
    tomorrow: "Tomorrow's forecast: 22 arrivals (lighter), laundry run 20:00 as scheduled, T-03 back in service after 06:00 maintenance. Suggested focus: pool-side towel loop after 19:00."
  };
}
