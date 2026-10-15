# MAESTRO · Stage Demo Script & Runbook
### Preface Hackathon · Fri 16 Oct 2026 · 6:30 PM · Tower 535, Causeway Bay

> Total demo time: **~3 minutes** (plus 30-second intro). Every line below maps to something
> visible on screen. Rehearse until you can do it while looking at the audience, not the laptop.

---

## PRE-SHOW CHECKLIST (arrive 6:00)

- [ ] Laptop charged + HDMI/USB-C adapter tested on the actual projector
- [ ] Resolution: 1920×1080, browser zoom 100%, dark mode page, hide bookmarks bar
- [ ] Serve locally: `python3 -m http.server 8931` → `localhost:8931` (avoids file:// quirks)
- [ ] ⚙ Settings: API key in, mode **Auto**, badge shows `● LIVE`
- [ ] **Phone hotspot ready** — if venue Wi-Fi dies, switch; if both die, flip mode to **Baked** and never mention it (the demo is identical)
- [ ] Full rehearsal run at 60×, approve-all path, no console errors (F12 → Console clean)
- [ ] Close all other tabs/apps. Disable notifications. Disable screen sleep.

## THE 30-SECOND OPENING (before touching the keyboard)

> "Every hotel runs on a hundred invisible phone calls — front desk to housekeeping, gym to laundry,
> manager to trainer. Tonight I'll show you **Maestro**: one AI conductor that replaces the phone tree.
> We're going to watch a Friday evening at the Harbour Grand in fast-forward — and the interesting part
> isn't the AI. It's that **every decision stays with the human**."

Then: press ▶. Clock starts at **17:30**. Speed **60×**.

---

## ACT I — THE CONDUCTOR SEES IT COMING (17:40 beat) · ~50 s

**On screen:** activity feed flags the scan; the Conductor panel starts *streaming Claude's analysis live*
(thinking panel glows purple — point at it).

> "It's 17:40. Watch the middle pane — that's Claude reading the live state of the hotel right now:
> 28 check-ins coming, the gym filling up, laundry counts, treadmill telemetry."

Approval card lands with 3 actions. Read the threats, not the titles:

> "Three converging problems, none of them visible to any single department:
> a check-in surge with one agent on duty… towels hitting zero at 19:30 while the laundry run doesn't land until 19:45…
> and Treadmill 3 — health 82 and falling — which happens to be our VIP's favourite machine."

**Do:** click ✓ Approve on action 1 (towels) and action 3 (Priya → Front Desk).
On action 2 (T-03), click ✏️ **Edit**, change maintenance time, then **Save & approve**:

> "I don't take the AI's word for it — 6 AM doesn't suit engineering, make it 7. Approved *with my edit*.
> That's the whole philosophy: AI proposes, humans dispose."

**Visible proof:** towel bar jumps at 18:30 (+120), Priya's chip turns teal "Spa → Front Desk", T-03 tile goes red OFFLINE.

## ACT II — THE GUEST FEELS NOTHING (18:05 beat) · ~40 s

Phone unlocks. Welcome message renders.

> "18:05. Ms. Chan — Gold member, 47 stays — scans in. Look what she sees: locker 12 near the treadmills,
> and because *we* took T-03 offline twenty minutes ago, she's told her usual machine is in preventive
> maintenance and T-02 is reserved with her saved settings. Her knee note is already with tonight's trainer.
> The back-of-house decision became a front-of-house experience — with zero phone calls."

**Do (the unscripted moment):** turn to the audience —
> "Someone give Ms. Chan a request. Anything."

Type it verbatim into her phone (if the room is shy: *"it's freezing in the sauna and I need two towels"*).
Claude streams → reply appears → work order spawns on the ops board → tracker animates
**Received → Assigned → On the way**.

> "Watch both screens: her phone gets a promise with an ETA — the ops board gets a task dispatched to Marco.
> One request, both sides of the house, instantly in sync."

## ACT III — THE ROSTERING SHOCK (18:10 beat) · ~40 s

Feed flags 📞 BEN SICK. Second playbook streams in.

> "18:10 — twenty minutes before a fully-booked HIIT class — the trainer calls in sick. The old world:
> a panicked group chat and 14 angry guests. Maestro has already weighed cancel-vs-rebook-vs-overtime…"

**Do:** ✓ Approve "Call in Trainer Mei (+1.5 h OT)". At 18:30 the class row flips green **SAVED · trainer swapped**,
and Ms. Chan's phone pings the trainer-change note.

> "The class is saved, the guests are notified before they notice, and Ms. Chan learns about it
> the way she should — as a courtesy, not an apology."

**(Optional 10 s — the killer beat if time allows):** ✋ Reject the overtime action, tap chip
**"Overtime not allowed tonight"** → Claude *re-plans live* around the constraint.

> "And when I say no — it doesn't argue, it re-plans. That's smart coordination: less manual chasing,
> but the manager owns every important call."

## ACT IV — THE LOOP CLOSES (21:40 check-out → 21:55 brief) · ~45 s

**Do:** click ⏭ Next beat until **21:40**. Ms. Chan's phone shows the Stay Story; the ops board shows
two new tasks spawning from her single tap.

> "21:40. Ms. Chan taps express check-out — and watch what one tap sets off: the folio closes,
> housekeeping gets the room-refresh audit before she's even out of the lobby… and *she* gets a Stay Story:
> her class, her requests, all fulfilled. And look at the last line — Maestro wrote down what it learned:
> towels pre-staged, HIIT Fridays, notify early about trainer changes. Stay 48 will be better than 47.
> That's personalisation with a memory, not a marketing blast."

**Do:** press `B` (Evening Brief).

> "End of shift. Instead of a paper log, Claude writes the duty manager's brief from the night's telemetry:
> four bottlenecks caught before guests felt them, 28 of 28 check-ins under three minutes, towel stock never hit zero,
> the class saved, the check-out loop closed — and my favourite line: *decisions stayed human*:
> approved, edited, rejected, re-planned."

**Close (deliver slowly, looking at the judges):**

> "The brief asked how AI bridges back-of-house and front-of-house into one intelligent system
> while keeping staff in control. That was the whole demo. Towels, treadmills, rosters, requests —
> one conductor, one screen, humans holding the baton. Thank you."

---

## FAILURE DRILLS (rehearse these too)

| Failure | Move | Cost |
|---|---|---|
| Venue Wi-Fi dies mid-stream | Settings → mode **Baked**. Analysis text still "streams" identically. Say nothing. | 5 s |
| Claude returns malformed action | Engine degrades unknown effects to plain tracked tasks — demo continues | 0 s |
| Projector colour wash | The theme is high-contrast by design; bump browser zoom to 125% | 10 s |
| Audience request breaks concierge | Fallback reply still creates a tracked task — the tracker still animates | 0 s |
| Clock raced ahead of your narration | ⏸ anytime; ⏭ Next beat to re-sync; the sim is deterministic | 0 s |
| Total laptop death | You have the story. Narrate Act I–IV from memory while a teammate opens the phone photos of the UI | ∞ style points |

## REHEARSAL SCHEDULE

1. **Tonight:** one full run reading the script. Time it. Target ≤ 3:00.
2. **Day before:** two runs — one at 60× (full), one at 300× + Next-beat jumps (stage pace). Then one run with Wi-Fi OFF in Baked mode. Then one run where you reject an action and take the re-plan live.
3. **Event day 6:00 PM:** projector test, one full all-approve run, one audience-request dry run with a friend typing something weird ("my goldfish is sick") to prove graceful fallback.

## Q&A AMMO

- **"Is this real-time?"** — The sim is scripted physics with live Claude reasoning on top; every number the AI quotes comes from the state snapshot you can see on the left.
- **"What would production need?"** — PMS/gym-system webhooks instead of the simulator, SSO, and an audit log of every approval (the decision history pane is already that log).
- **"Cost per hotel per month?"** — Conductor calls are tiny structured JSON prompts; a property this size runs well under a few dollars of tokens a day. The towel shrinkage alone (industry ~15–20%/yr) pays for it hundreds of times over.
- **"Why not just rules/alerts?"** — Rules tell you towels are low *now*. The conductor told you at 17:40 they'd be gone at 19:30, and *who* could fix it *before* the surge — then rewrote the plan when the manager said no.
