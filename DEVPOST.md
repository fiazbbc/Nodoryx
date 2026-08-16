# Nodoryx — Devpost Submission Draft

## Tagline

Predict energy problems before they become outages.

## Short description

Nodoryx is a deterministic energy-operations digital twin that detects abnormal device demand, forecasts short-term capacity risk, and applies criticality-aware recommendations in a live browser simulation.

## Inspiration

Most energy dashboards stop at reporting current consumption. That leaves the operator to work out which device caused a change, whether the situation is getting worse, and what can safely be done about it. Those questions become especially important when flexible loads such as EV chargers create a peak or when a hospital loses grid supply.

I wanted to build a demo where detection, forecasting, and response all use the same electrical state. That makes it possible to show not only a warning, but also why it appeared and what changed after an operator acted.

## What it does

Nodoryx simulates a School Campus, Hospital, Smart Home, or Factory at device level. Each environment has distinct equipment, schedules, grid and renewable capacity, battery storage, and critical-load definitions.

The simulation balances facility demand against solar generation, battery charging and discharging, backup supply, and grid import. It integrates those power flows into energy, tariff cost, and estimated grid emissions.

Operators can trigger six reproducible scenarios: an EV charging surge, HVAC failure, solar production drop, gradual equipment degradation, grid-capacity emergency, and critical-facility outage. Nodoryx then:

1. evaluates every device independently for statistical anomalies;
2. forecasts demand 15, 30, and 60 minutes ahead;
3. compares the forecast with safe grid capacity;
4. generates a recommendation from current state;
5. protects critical equipment in business logic;
6. applies the selected action to the real simulation; and
7. recalculates demand, utilization, forecasts, incidents, and avoided impact.

The primary judging story is a deterministic ten-step EV Charging Surge demo. A second Hospital Outage story shows emergency mode, battery/backup response, protected clinical systems, noncritical shedding candidates, and estimated backup duration.

## How I built it

The core is a pure TypeScript simulation engine shared by every product view. Environment-specific device catalogs and usage schedules generate expected demand. A deterministic waveform adds small normal variation, while scenarios alter the relevant device or supply condition.

Solar follows simulated time of day. Battery dispatch respects storage capacity, a minimum reserve, maximum charge and discharge rates, and separate efficiencies. Each simulation step conserves the modeled power balance and integrates power over simulated time.

The anomaly detector uses rolling mean, rolling standard deviation, Z-score, baseline deviation, rate of change, and longer trend. It is intentionally described as statistical detection, not machine learning.

The forecasting model combines a recency-weighted average, recent linear trend, trend damping, and the environment's future time-of-day baseline. Capacity risk is a calculated heuristic score rather than an invented confidence percentage.

The recommendation engine considers current utilization, device flexibility, criticality, battery state, incident context, and actions already applied. It calculates expected impact by comparing power balances before and after each candidate action. A second safety check in the apply path rejects any attempt to shed a critical device.

The interface is built with React 19 and TypeScript on Vinext/Vite. A static production export is deployed on Vercel. Automated tests cover calculation consistency, anomalies, forecasts, battery constraints, critical-load protection, scenarios, recommendations, resets, runtime behavior, responsive contracts, and production rendering.

## Challenges I ran into

- Keeping the simulation visually alive while making Reset and every scenario reproducible
- Ensuring all dashboard metrics came from one state instead of drifting copies
- Creating anomalies from telemetry measurements rather than scenario flags
- Making recommendation impact measurable without hard-coded “after” numbers
- Modeling outage response while guaranteeing that critical hospital devices could never be selected for shedding
- Keeping continuous updates efficient by bounding history and avoiding duplicate timers and unnecessary rerenders
- Presenting enough technical evidence for judges without covering the dashboard with tutorial UI

## Accomplishments I'm proud of

- One central simulation state drives the dashboard, digital twin, incidents, forecasts, recommendations, and guided demo
- Facility demand, grid import, integrated energy, cost, emissions, and battery state follow explicit conservation and limit checks
- The EV surge flows from device telemetry through anomaly detection, overload forecasting, recommendation, mitigation, and measured avoided impact
- Hospital Mode distinguishes critical and noncritical equipment, activates available backup resources, and enforces critical-load protection inside business logic
- Recommendations produce real state changes and are removed or recalculated after application
- The release-candidate suite passes 28 unit tests, 12 integration tests, 2 production-render checks, strict TypeScript, lint, and a production build

## What I learned

A convincing digital-twin demo depends more on internal consistency than on visual complexity. Once device demand, supply, storage, forecasts, and actions shared the same model, explanations became clearer and tests became much more meaningful.

I also learned that transparent statistical methods are a good fit for an infrastructure prototype. A judge can see the expected value, observed value, deviation, trend, and capacity limit without being asked to trust a black-box accuracy claim.

## What's next

The next step would be replacing the synthetic telemetry boundary with real integrations: smart meters, EV charge-management systems, solar inverters, battery controllers, MQTT, Modbus, BACnet, building-management systems, and utility demand-response APIs.

A production pilot would also require durable telemetry storage, site-specific baseline calibration, authentication and operator roles, audit logs, secure command delivery, equipment acknowledgement, fail-safe behavior, and review by facility and electrical engineers.

## Technologies and tags

**Technologies:** TypeScript, React 19, Vinext, Vite, Vercel, Node.js test runner, ESLint, CSS

**Suggested Devpost tags:** energy, sustainability, digital twin, smart buildings, anomaly detection, forecasting, demand response, EV charging, critical infrastructure

## Screenshot recommendations

Use screenshots that prove a state transition rather than a collection of static pages:

1. **Normal command center** — School Campus in a healthy state, with demand below the warning band and energy flow visible.
2. **EV surge detected** — the red incident banner, elevated EV demand, facility utilization, and anomaly evidence in one frame.
3. **Forecast and recommendation** — capacity trajectory plus the recommendation's equipment, reason, priority, and expected kW reduction.
4. **Mitigation verified** — reduced EV demand, improved grid status, incident timeline entry, and Nodoryx Impact values.
5. **Hospital Emergency Mode** — grid supply lost, backup resources active, and the protected critical-services list visible.
6. **Digital twin or architecture** — one supporting image showing device-level state or the transparent calculation pipeline.

Avoid using the illustrative landing-page dashboard as evidence of a live result; capture the operational dashboard after entering the simulation.

## Suggested 2–3 minute demo video

### 0:00–0:15 — Set up the problem

“Energy dashboards tell operators what is happening. Nodoryx also shows what is abnormal, what is likely to happen next, and what can safely be changed.”

### 0:15–0:35 — Establish the healthy baseline

Enter the School Campus command center after Reset. Point out current facility demand, solar, battery flow, grid import, and the safe capacity limit. Briefly state that all values come from the same deterministic digital twin.

### 0:35–1:15 — Trigger EV Charging Surge

Start the Guided Demo or open Scenario Lab and trigger EV Charging Surge. Show the EV charger demand increase, facility demand increase, elevated utilization, device-level anomaly evidence, and the forecast moving toward capacity.

### 1:15–1:45 — Explain and apply the action

Show that Nodoryx identifies EV charging as the cause. Read the expected kW reduction and why the charger is safe to throttle. Apply the recommendation, then show the EV load and total demand fall, grid status improve, and mitigation appear in the incident timeline.

### 1:45–2:05 — Show measured impact

Point to avoided peak demand, avoided energy, tariff savings, and estimated emissions impact. Clarify that these values are calculated from the applied intervention and simulated elapsed time.

### 2:05–2:30 — Prove safety with Hospital Mode

Trigger Critical Facility Outage. Show Emergency Mode, zero grid import, battery/backup activation, protected ICU and emergency services, estimated backup duration, and a recommendation that targets only noncritical equipment.

### 2:30–2:50 — Close with implementation honesty

Show the Architecture view. State that anomaly detection and forecasting use transparent statistical methods, all current telemetry is synthetic, and real meter or building-protocol adapters are future work.

## Disclosure

All telemetry and facility data in the submission are synthetic. Nodoryx does not currently connect to physical equipment, persist sessions, or use an external AI model. Its anomaly explanations, forecasts, recommendations, costs, emissions, and savings are calculated from the local simulation state.
