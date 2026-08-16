# Nodoryx

**Predict energy problems before they become outages.**

Nodoryx is a browser-based energy-operations digital twin built for VoltHacks 2026. It simulates a facility at device level, detects abnormal electrical demand, forecasts short-term capacity risk, and recommends actions that respect operational limits and critical services.

## The problem

Energy dashboards are good at showing current consumption, but operators still have to answer harder questions: Which device caused a spike? Is the site moving toward a capacity limit? What can be changed safely? During an outage, which loads must remain powered?

Nodoryx explores how one shared operational model can connect telemetry, detection, forecasting, response, and measured impact instead of presenting them as separate tools.

## The solution

The application provides a deterministic, interactive simulation of four facility types: School Campus, Hospital, Smart Home, and Factory. Each preset has its own device inventory, demand schedule, grid capacity, solar capacity, battery capacity, and critical-load assignments.

Operators can run normal telemetry or trigger one of six scenarios:

- EV Charging Surge
- HVAC Failure
- Solar Production Drop
- Equipment Degradation
- Grid Capacity Emergency
- Critical Facility Outage

Scenario effects feed the same central state used by the dashboard, device registry, digital twin, incident timeline, forecasts, recommendations, and impact metrics.

## Implemented features

- Device-level demand with environment-specific schedules and bounded deterministic variation
- Live simulation clock with play, pause, reset, and 1×, 5×, 20×, and 60× speed controls
- Power balancing across facility demand, solar generation, battery charging, battery discharging, backup supply, grid import, curtailment, and unmet load
- Energy integration in kWh from power and simulated elapsed time
- Tariff cost based on grid-imported energy and time of day
- Estimated CO₂ emissions based on grid-imported energy and a configured factor
- Per-device anomaly detection with expected demand, observed demand, deviation, Z-score, rate of change, score, severity, and explanation
- Transparent 15-, 30-, and 60-minute demand forecasts
- State-derived recommendations with equipment, reason, priority, expected kW reduction, and expected impact
- Business-logic protection that prevents critical devices from being selected for shedding
- Hospital Emergency Mode with protected clinical services, battery/backup response, noncritical shedding candidates, and estimated backup duration
- Recommendation actions that update the real simulation and recalculate demand, grid utilization, forecasts, incidents, savings, and remaining actions
- A deterministic ten-step guided demo centered on the EV Charging Surge story
- Bounded telemetry and chart history to keep continuous simulation updates efficient
- Responsive command-center views for overview, digital twin, devices, forecasting, scenarios, incidents, analytics, and architecture

## How the simulation works

`lib/simulation.ts` contains the domain model and pure calculation functions. `app/nodoryx.tsx` owns the current session state and advances it with one cleaned-up simulation interval.

At each step:

1. Environment schedules establish expected demand for every device.
2. Deterministic oscillation produces normal synthetic variation.
3. An active scenario, if any, changes the relevant device demand or supply condition.
4. Solar output is calculated from simulated time of day and cloud factor.
5. Battery dispatch is constrained by capacity, minimum reserve, rate limits, and charge/discharge efficiency.
6. The engine balances all power flows and reports grid import, backup supply, curtailment, or unmet load.
7. Power is integrated over the simulated duration to update energy, cost, and emissions totals.

Facility demand is always the sum of device demand. With the grid available, the balance accounts for facility load, solar, battery charging, and battery discharging. During an outage, grid import is zero and the model reports any load that cannot be served by solar, storage, or configured hospital backup.

The configured battery defaults are a 15% minimum reserve, a maximum charge rate of 25% of capacity per hour, a maximum discharge rate of 30% of capacity per hour, 94% charge efficiency, 92% discharge efficiency, and 74% initial state of charge. Hospital discharge capacity is explicitly increased for its emergency model.

Solar uses a deterministic daylight curve between 06:00 and 19:00. It is not randomly generated. The current tariff is $0.18/kWh outside the 16:00–21:00 peak window and $0.27/kWh during that window. Estimated grid emissions use 0.42 kg CO₂ per imported kWh.

## Anomaly detection

Nodoryx does not claim machine learning. Each device is evaluated independently with a lightweight statistical detector using:

- expected time-of-day demand;
- a rolling mean over recent telemetry;
- rolling standard deviation with a small stability floor;
- Z-score of the latest observation;
- percentage deviation from baseline;
- recent rate of change; and
- total trend across the telemetry window.

The largest measured signal becomes a bounded 0–100 anomaly score. Scores below 30 are Normal, 30–59 are Unusual, 60–84 are High, and 85–100 are Critical. The interface explains the contributing measurements rather than treating a scenario flag as an anomaly.

Telemetry is bounded to 12 samples per device analysis.

## Forecasting

The forecast is also transparent rather than machine-learned. For each 15-, 30-, and 60-minute horizon, it combines:

- a recency-weighted average of the latest demand values;
- a linear recent trend;
- horizon-dependent trend damping; and
- the expected change in the environment's time-of-day baseline.

The model compares the projected peak with the environment's safe grid capacity. Its 0–100 risk score is a heuristic derived from capacity proximity plus a bounded contribution from positive measured trend; it is not a probability or an AI-confidence percentage.

Charts receive 18 historical points and 12 future points, for a fixed maximum of 30.

## Recommendation engine

Recommendations are generated from the current environment, devices, incident, utilization, battery energy, and actions already applied. Implemented action types include throttling EV charging, delaying or shifting flexible equipment, reducing noncritical HVAC demand, isolating inefficient equipment, and discharging the battery.

The engine:

- filters out critical devices before considering load reduction;
- enforces device power floors and battery reserve/rate limits;
- avoids duplicate recommendations for the same device;
- removes actions that have already been applied;
- ranks actions by priority and measurable reduction; and
- compares pre-action and post-action power balances to calculate expected grid impact.

Applying a recommendation updates the central simulation state. Critical-device protection is also enforced inside the apply logic, so a forged request to shed a critical device is rejected.

## Architecture

```text
Environment schedules and device catalog
                  ↓
       Deterministic telemetry
                  ↓
  Power balance and energy integration
          ↙                 ↘
 Per-device anomaly      Demand forecast
          ↘                 ↙
       Recommendation engine
                  ↓
      Central React session state
                  ↓
 Dashboard, incidents, analytics, guided demo
```

Important project areas:

- `lib/simulation.ts` — simulation, anomaly, forecast, scenario, and recommendation business logic
- `app/nodoryx.tsx` — live session state and product interface
- `app/globals.css` and `app/polish.css` — responsive command-center styling
- `worker/index.ts` — Cloudflare-compatible application entry point and image handling
- `tests/` — calculation, safety, scenario, interaction, responsiveness, runtime, and rendered-output checks
- `scripts/export-static.mjs` — static export used by the Vercel deployment

## Tech stack

- React 19 and TypeScript
- Vinext and Vite 8
- Cloudflare Workers-compatible local build and Vercel hosting
- Plain responsive CSS with Geist Sans and Geist Mono
- Node.js built-in test runner
- ESLint with React, hooks, accessibility, and TypeScript rules

## Local setup

Requirements: Node.js 22.13 or newer and npm.

```bash
git clone https://github.com/fiazbbc/Nodoryx.git
cd Nodoryx
npm ci
npm run dev
```

Use the local URL printed by the development server.

## Environment variables

No application environment variables, credentials, database, or external API keys are required for the implemented demo.

The build tooling sets project-local Wrangler and Miniflare log paths. These are development-tool settings, not application configuration. The running application does not use persistent storage.

## Testing

Run the complete suite:

```bash
npm test
```

Run individual release checks:

```bash
npm run test:unit        # simulation and business-logic tests
npm run test:integration # interaction, runtime, and responsive contracts
npm run test:e2e         # production build plus rendered Worker checks
npm run typecheck        # strict TypeScript check
npm run lint             # ESLint
npm run build            # production build
```

The current suite covers power and energy consistency, tariffs, emissions, battery limits, solar behavior, environment presets, anomaly severity, forecasting direction and overload risk, critical-load safety, recommendation effects, scenario determinism, reset behavior, bounded telemetry, runtime cleanup, responsive contracts, and production rendering.

## Deployment

The project builds the Vinext application, renders the production route to static HTML, and deploys the resulting client assets to Vercel.

```bash
npm run build
npm run build:vercel
```

Connect the repository to a Vercel project and use the included `vercel.json`; no runtime secrets are required.

## Synthetic-data disclosure

All facilities, devices, telemetry, incidents, forecasts, tariffs, emissions factors, costs, and savings in this project are simulated. The numbers are internally calculated rather than manually inserted into dashboard state, but they do not represent a real building or utility account. No personal, customer, or physical-facility data is collected.

## Limitations

- Nodoryx is a deterministic demonstration, not a production control system.
- It does not connect to meters, inverters, chargers, building-management systems, or utility APIs.
- It does not issue commands to physical equipment.
- Statistical baselines are configured models, not learned from historical facility data.
- Forecasts are short-term heuristics and have not been calibrated against a real site.
- Cost and emissions calculations use one configured tariff and one emissions factor rather than a live utility feed.
- Session state is in memory and resets when the page reloads; there is no active database or authentication.
- The local “Nodoryx Engineer” produces templated explanations from simulation state; it is not an LLM integration.

## Future real-IoT integration

The synthetic telemetry boundary could be replaced with adapters for smart meters, EV charge-management systems, solar inverters, battery-management systems, MQTT, Modbus, BACnet, building-management systems, and utility demand-response APIs. A production version would also need secure device identity, durable telemetry storage, site-specific baseline calibration, operator permissions, audit logs, command acknowledgement, fail-safe controls, and validation with electrical and facility engineers.

Built for **VoltHacks 2026**.
