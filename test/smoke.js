/* MAESTRO smoke test — run: node test/smoke.js */
const fs = require("fs"), path = require("path"), vm = require("vm");

const ctx = { console, setTimeout, clearTimeout, performance, Math, JSON };
vm.createContext(ctx);
for (const f of ["data.js", "engine.js"]) {
  vm.runInContext(fs.readFileSync(path.join(__dirname, "..", f), "utf8"), ctx, { filename: f });
}
const Engine = vm.runInContext("Engine", ctx);
const BAKED = vm.runInContext("BAKED", ctx);
const SEED = vm.runInContext("SEED", ctx);

const assert = (cond, msg) => { if (!cond) { console.error("FAIL:", msg); process.exitCode = 1; } else console.log("ok:", msg); };
const events = [];

Engine.init();
Engine.on("event", ev => events.push(ev));
Engine.on("state", () => {});

// advance to just past beat A (17:40)
Engine.advance(11); // 17:30 -> 17:41
assert(events.some(e => e.kind === "conductor" && e.beat === "beatA"), "beatA conductor fires at 17:40");

// project towel depletion BEFORE approving (curve-based projection lives in ai.js; replicate quickly)
const proj = (() => {
  const s = Engine.state; let stock = s.towels.stock;
  const hiit = s.classes.find(c => c.id === "hiit");
  for (let m = Math.ceil(s.t); m <= SEED.endMin; m++) {
    if (Math.floor(SEED.laundryRunAt) === m) stock += SEED.laundryRunQty;
    let occ = Engine.occupancyCurve(m);
    if (hiit && m >= 1110 && m <= 1155 && hiit.status !== "cancelled") occ += 12;
    stock -= occ * SEED.towels.usagePerGuestMin;
    if (stock <= 0) return m;
  }
  return null;
})();
console.log("   projected towel depletion (no action):", proj ? Engine.fmt(proj) : "none");
assert(proj && proj >= 19*60 && proj <= 19*60+50, "depletion projected between 19:00–19:50 without action");

// propose + approve all three beatA actions
const card = Engine.proposeApproval("beatA", BAKED.beatA.analysis, BAKED.beatA.actions);
for (const a of BAKED.beatA.actions) Engine.decide(card.id, a.id, "approved");
assert(Engine.state.equipment.find(e => e.id === "T-03").status === "offline", "T-03 offline after approval");
assert(Engine.state.staff.find(s => s.id === "priya").reassignedTo === "Front Desk", "Priya reassigned to Front Desk");
assert(Engine.state.scheduledRestocks.length === 1 && Engine.state.scheduledRestocks[0].qty === 120, "+120 towel restock scheduled");

// advance to 18:06 → Ms. Chan arrives
Engine.advance(25);
assert(events.some(e => e.kind === "chan-arrives"), "chan-arrives fires ~18:05");
Engine.chanCheckIn();
const welcome = Engine.state.guest.messages[0].text;
assert(welcome.includes("T-02"), "welcome message mentions reserved T-02 (T-03 offline)");
assert(Engine.state.guest.unlocked, "guest phone unlocked after check-in");

// advance to 18:11 → sickness beat
Engine.advance(6);
assert(events.some(e => e.kind === "sickness"), "sickness beat fires ~18:10");
// app-level reaction (engine emits; replicate what app does):
Engine.state.staff.find(s => s.id === "ben").status = "sick";
Engine.state.classes.find(c => c.id === "hiit").status = "at-risk";
const cardB = Engine.proposeApproval("beatB", BAKED.beatB.analysis, BAKED.beatB.actions);
for (const a of BAKED.beatB.actions) Engine.decide(cardB.id, a.id, "approved");
assert(Engine.state.classes.find(c => c.id === "hiit").status === "swapped", "HIIT class saved via trainer swap");
assert(Engine.state.guest.messages.some(m => m.text.includes("Trainer Mei")), "Ms. Chan notified of trainer change");

// advance to 18:35 → restock should have landed at 18:30
const stockBefore = Engine.state.towels.stock;
Engine.advance(24);
assert(Engine.state.scheduledRestocks.length === 0, "restock effect executed by 18:35");
assert(Engine.state.towels.stock > stockBefore, "towel stock increased after restock");
console.log("   towel stock @18:35:", Engine.state.towels.stock);

// concierge request
const t = Engine.createTask({ title: "Extra towels to gym floor", department: "Housekeeping", etaMin: 6, guestId: "chan" });
assert(t.assignee, "task auto-assigned: " + t.assignee);

// run to close
Engine.checkoutChan(); // app triggers this via the 21:40 timeline beat
assert(Engine.state.guest.checkedOut, "express check-out processed");
assert(Engine.state.guest.learnedPrefs.length >= 1, "preferences learned for next stay: " + JSON.stringify(Engine.state.guest.learnedPrefs));
assert(Engine.state.tasks.some(t => t.title.includes("Room 1208 refresh")), "check-out cascaded a housekeeping task");
const stayStory = Engine.state.guest.messages[Engine.state.guest.messages.length - 1].text;
assert(stayStory.includes("Stay") || stayStory.includes("evening at Harbour Grand"), "Stay Story delivered to guest");
Engine.advance(SEED.endMin - Engine.state.t);
const s = Engine.state;
console.log("   final towel stock:", s.towels.stock, "| flags:", JSON.stringify(s.flags), "| checkedIn:", s.arrivals.checkedIn, "| maxWait:", s.stats.maxWait);
assert(s.towels.stock > 0 && !s.flags.includes("towel-out") && s.stats.towelCrisisAverted, "NO towel crisis when playbook approved");
assert(s.arrivals.checkedIn === SEED.arrivalsTotal, "all 28 arrivals checked in");
assert(s.stats.maxWait <= 5, "check-in waits stayed low with 2 agents (max " + s.stats.maxWait + "m)");
assert(s.stats.classSaved, "class saved stat recorded");
const stats = Engine.briefStats();
assert(stats.bottlenecksCaught === 4, "bottlenecks counted: " + stats.bottlenecksCaught);

console.log("\n--- BRANCH 2: manager ignores everything ---");
Engine.init();
Engine.on && null;
const ev2 = [];
// re-register listener (listeners persist across init; fine)
Engine.advance(SEED.endMin - Engine.state.t); // 17:30 → 22:00, no approvals
const s2 = Engine.state;
console.log("   final towel stock:", s2.towels.stock, "| flags:", JSON.stringify(s2.flags), "| maxWait:", s2.stats.maxWait, "| towelCrisisAverted:", s2.stats.towelCrisisAverted);
assert(s2.flags.includes("towel-out") || s2.stats.towelCrisisAverted === false, "towel crisis happens when ignored");
assert(s2.stats.maxWait >= 8, "check-in queue crisis with 1 agent (max " + s2.stats.maxWait + "m)");
assert(s2.classes.find(c => c.id === "hiit").status !== "swapped", "class not saved without approval");

console.log("\nSMOKE TEST DONE");
