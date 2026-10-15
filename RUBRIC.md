# MAESTRO ↔ Hackathon Rubric Mapping
### Preface Hackathon · 16 Oct 2026 · "Reimagining Hospitality Operations and Customer Engagement"

Copy-paste-ready answers tying each event question to a concrete, demonstrable Maestro feature.

---

## 1. Bottleneck Identification
**Q: How to identify operational bottlenecks across hospitality and facilities management?**

Maestro's **Conductor** ingests a unified snapshot of the whole property every beat — arrivals pipeline,
front-desk agent count, gym occupancy, towel stock & laundry queue, equipment telemetry, roster state,
open tasks — and Claude reasons over *converging* risks rather than single metrics.

*Live in the demo (17:40):* it identifies three bottlenecks no single department could see alone —
a 28-guest check-in surge against one agent, towel depletion projected for ≈19:30 (15 minutes before the
laundry run lands), and a treadmill with a vibration anomaly trending to failure. The towel card shows a
**projected depletion time computed from the occupancy curve**, not just a current count — bottlenecks are
identified *before* they happen, across both hospitality (check-in, classes) and facilities (laundry, equipment).

## 2. Workflow Automation
**Q: How AI can support gym management, staff rostering and check-in and check-out workflows?**

- **Gym management:** equipment health tiles auto-flag anomalies; the playbook takes machines offline,
  schedules maintenance in low-impact windows, migrates bookings and notifies affected guests — no clipboard rounds.
- **Staff rostering:** AI-drafted reassignments (Spa → Front Desk for the surge window) and overtime
  call-ins (trainer sick 20 min before a full class), each with the trade-offs spelled out for the manager.
- **Check-in:** arrivals feed a live queue model; staffing decisions visibly move the average-wait KPI
  (12 min → under 3 min after one reassignment).
- **Check-out:** express check-out from the guest's phone auto-closes the folio, dispatches the room-refresh
  audit to housekeeping, and delivers a personalised "Stay Story" receipt — a front-of-house tap cascading
  into back-of-house work with zero phone calls.

## 3. Experience Integration
**Q: How to connect operational data with customer experience outcomes?**

Every operational decision in Maestro *rewrites what the guest experiences*, and the demo shows both sides
simultaneously: T-03 taken offline for preventive maintenance → Ms. Chan's welcome message already offers
her T-02 with saved settings and a knee-friendly note; the trainer swap → her phone is informed before she
wonders. In the failure branch (manager ignores the playbook), the connection is equally visible: towel
stock hits zero and the guest-facing impact appears on the same screen as the ops data that caused it.
The Evening Brief closes the loop by reporting operational actions in *experience* terms (waits avoided,
classes saved, requests honoured).

## 4. Resource Tracking
**Q: How to improve the tracking of facilities, supplies, maintenance and service requests?**

One task spine for everything: supplies (towel floor ⇄ laundry loop with live counts and projections),
facilities (equipment health %, status: in service / watch / load-limited / offline / maintenance),
maintenance (predicted-failure work orders scheduled outside peak), and service requests (guest asks become
tracked work orders with owner, department, ETA and status). Requests are visible from both ends —
the guest sees a delivery-style tracker (Received → Assigned → On the way → Done) while the ops board
shows the same task dispatched to a named staff member.

## 5. Smart Coordination
**Q: How to reduce manual coordination while keeping staff in control of important decisions?**

The Conductor never acts alone: it proposes **typed, parameterised actions** as approval cards —
Approve, Edit (change quantities/times before approving) or Reject. A rejection asks *why*
(reason chips: "overtime not allowed tonight"…) and Claude **re-plans live around the constraint**.
Every decision lands in an on-screen decision history — an audit trail of human judgment.
Coordination cost collapses (no phone tree, no group chats) while authority stays exactly where the
event brief demands: with the staff.

## 6. Service Personalisation
**Q: How to build a prototype that makes service more consistent, responsive and personalised?**

Ms. Chan's journey demonstrates the loop: profile (Gold, 47 stays, knee note, usual machine, locker
preference) → arrival welcome composed from *tonight's actual ops state* → free-text concierge that
answers with context and converts asks into tracked work orders with ETAs → express check-out that
delivers a Stay Story and **writes learned preferences back to her profile** ("likes towels pre-staged",
"Friday HIIT regular — flag trainer changes early") so stay #48 is better than #47. Consistency comes
from the same system serving every guest; responsiveness from second-level request triage;
personalisation from the closed memory loop.

---

### Honest scope notes (say these if judges probe)

- The evening is a **deterministic simulation** with realistic physics (occupancy curves, consumption,
  queueing, telemetry drift). Claude's reasoning is real and live; the sensor/PMS feeds are simulated.
  Production needs webhooks from the PMS, gym access control, laundry/RFID and maintenance systems —
  the Conductor's contract (snapshot in → typed actions out) is integration-agnostic by design.
- The browser-direct API key is a **demo convenience**; the repo ships a server-side proxy example
  (`DEPLOY.md`) for any real deployment.
