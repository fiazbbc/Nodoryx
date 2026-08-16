"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  applyRecommendationState,
  config,
  createDevices,
  demandForecast,
  emptyTotals,
  FORECAST_HISTORY_SAMPLES,
  facilityDemand,
  recommendationsFor,
  stepEnergy,
  tariffRate,
  trigger,
  type Device,
  type EnergyTotals,
  type Environment,
  type Recommendation,
  type ScenarioId,
} from "../lib/simulation";

const nav = [
  "Overview",
  "Digital Twin",
  "Devices",
  "Forecast",
  "Scenario Lab",
  "Incidents",
  "Analytics",
  "Architecture",
];
const scenarios: {
  id: ScenarioId;
  title: string;
  desc: string;
  severity: string;
}[] = [
  {
    id: "ev",
    title: "EV Charging Surge",
    desc: "Simultaneous charging pushes flexible demand toward site capacity.",
    severity: "High",
  },
  {
    id: "hvac",
    title: "HVAC Failure",
    desc: "A failing unit draws abnormal power and loses efficiency.",
    severity: "High",
  },
  {
    id: "solar",
    title: "Solar Production Drop",
    desc: "Dense cloud cover abruptly reduces renewable generation.",
    severity: "Medium",
  },
  {
    id: "degradation",
    title: "Equipment Degradation",
    desc: "A motor's efficiency declines and consumption trends upward.",
    severity: "Medium",
  },
  {
    id: "capacity",
    title: "Grid Capacity Emergency",
    desc: "Non-critical demand pushes the feeder beyond its safe band.",
    severity: "Critical",
  },
  {
    id: "outage",
    title: "Critical Facility Outage",
    desc: "Grid supply fails; critical loads receive battery priority.",
    severity: "Critical",
  },
];
const fmt = (n: number, d = 0) =>
  n.toLocaleString(undefined, { maximumFractionDigits: d });
const demoSteps = [
  {
    title: "Healthy baseline",
    body: "Start with a healthy School Campus. Demand, grid import, solar, and battery values all come from the live simulation.",
    view: "Overview",
  },
  {
    title: "Energy flow + digital twin",
    body: "The digital twin rolls every device into facility demand while solar, storage, and the grid balance that load in real time.",
    view: "Digital Twin",
  },
  {
    title: "Trigger EV Charging Surge",
    body: "Nodoryx now injects the reproducible EV surge into the same device state used across the dashboard.",
    view: "Overview",
  },
  {
    title: "Demand rises",
    body: "EV charger demand and total facility demand jump visibly, pushing feeder utilization toward its warning band.",
    view: "Overview",
  },
  {
    title: "Anomaly detected",
    body: "Telemetry—not a scenario flag—shows expected versus observed EV demand, deviation, Z-score, and measured severity.",
    view: "Overview",
  },
  {
    title: "Capacity risk forecast",
    body: "The 15, 30, and 60 minute forecast now moves toward the safe capacity line using recent trend and time-of-day baseline.",
    view: "Forecast",
  },
  {
    title: "Actionable recommendation",
    body: "Nodoryx identifies flexible EV charging, explains why it was selected, and calculates the expected kW impact.",
    view: "Overview",
  },
  {
    title: "Apply the real action",
    body: "The recommendation is applied to the central simulation state. EV charger operating power is safely throttled.",
    view: "Overview",
  },
  {
    title: "Load returns toward safety",
    body: "Facility demand, utilization, grid import, anomaly evidence, and forecast all recalculate from the mitigated state.",
    view: "Overview",
  },
  {
    title: "Verified 30-minute impact",
    body: "The final scorecard integrates measured avoided grid demand over 30 simulated minutes into energy, tariff cost, and emissions impact.",
    view: "Overview",
  },
] as const;

export default function Nodoryx() {
  const [entered, setEntered] = useState(false),
    [view, setView] = useState("Overview"),
    [env, setEnv] = useState<Environment>("School Campus"),
    [minute, setMinute] = useState(548),
    [speed, setSpeed] = useState(5),
    [playing, setPlaying] = useState(true),
    [incident, setIncident] = useState<ScenarioId | null>(null),
    [devices, setDevices] = useState<Device[]>(() =>
      createDevices("School Campus", 548),
    ),
    [batteryEnergy, setBatteryEnergy] = useState(
      () =>
        config("School Campus").battery.capacityKWh *
        config("School Campus").battery.initialSoCFraction,
    ),
    [totals, setTotals] = useState<EnergyTotals>(emptyTotals),
    [mitigated, setMitigated] = useState(false),
    [intervention, setIntervention] = useState<Recommendation | null>(null),
    [appliedIds, setAppliedIds] = useState<string[]>([]),
    [forcePeakShaving, setForcePeakShaving] = useState(false),
    [savings, setSavings] = useState({ energyKWh: 0, cost: 0, emissionsKg: 0 }),
    [demo, setDemo] = useState(0),
    [selectedId, setSelectedId] = useState<string | null>(null),
    [query, setQuery] = useState(""),
    [about, setAbout] = useState(false);
  const selected = selectedId
    ? devices.find((device) => device.id === selectedId) ?? null
    : null;
  const runtimeRef = useRef({
    env,
    minute,
    devices,
    batteryEnergy,
    totals,
    incident,
    intervention,
    forcePeakShaving,
  });
  useEffect(() => {
    runtimeRef.current = {
      env,
      minute,
      devices,
      batteryEnergy,
      totals,
      incident,
      intervention,
      forcePeakShaving,
    };
  }, [
    env,
    minute,
    devices,
    batteryEnergy,
    totals,
    incident,
    intervention,
    forcePeakShaving,
  ]);
  useEffect(() => {
    if (!playing) return;
    const t = setInterval(() => {
      const snapshot = runtimeRef.current,
        nextMinute = (snapshot.minute + speed) % 1440,
        dt = speed / 60,
        result = stepEnergy({
          env: snapshot.env,
          minute: snapshot.minute,
          devices: snapshot.devices,
          batteryEnergyKWh: snapshot.batteryEnergy,
          durationHours: dt,
          previousTotals: snapshot.totals,
          cloudFactor: snapshot.incident === "solar" ? 0.22 : 0.92,
          gridAvailable: snapshot.incident !== "outage",
          forcePeakShaving: snapshot.forcePeakShaving,
        });
      setBatteryEnergy(result.batteryEnergyKWh);
      setTotals(result.totals);
      if (snapshot.intervention)
        setSavings((s) => ({
          energyKWh:
            s.energyKWh + snapshot.intervention!.expectedGridReductionKW * dt,
          cost:
            s.cost +
            snapshot.intervention!.expectedGridReductionKW *
              dt *
              tariffRate(config(snapshot.env).tariff, snapshot.minute),
          emissionsKg:
            s.emissionsKg +
            snapshot.intervention!.expectedGridReductionKW *
              dt *
              config(snapshot.env).emissionsKgPerGridKWh,
        }));
      setMinute(nextMinute);
      if (!snapshot.incident)
        setDevices(createDevices(snapshot.env, nextMinute));
    }, 1200);
    return () => clearInterval(t);
  }, [playing, speed]);
  useEffect(() => {
    if (!selectedId && !about && !demo) return;
    const closeTransientUi = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      setSelectedId(null);
      setAbout(false);
      setDemo(0);
    };
    window.addEventListener("keydown", closeTransientUi);
    return () => window.removeEventListener("keydown", closeTransientUi);
  }, [selectedId, about, demo]);
  const cfg = config(env),
    gross = useMemo(() => facilityDemand(devices), [devices]),
    instant = useMemo(
      () =>
        stepEnergy({
          env,
          minute,
          devices,
          batteryEnergyKWh: batteryEnergy,
          durationHours: 0,
          cloudFactor: incident === "solar" ? 0.22 : 0.92,
          gridAvailable: incident !== "outage",
          forcePeakShaving,
        }),
      [env, minute, devices, batteryEnergy, incident, forcePeakShaving],
    ),
    solar = instant.balance.solarGenerationKW,
    batteryFlow =
      instant.balance.batteryDischargeKW - instant.balance.batteryChargeKW,
    grid = instant.balance.gridImportKW,
    battery = instant.batterySoCFraction * 100,
    ratio = (gross / cfg.capacity) * 100,
    forecastModel = useMemo(
      () => demandForecast(env, minute, devices, incident),
      [env, minute, devices, incident],
    ),
    history = forecastModel.points,
    forecast = forecastModel.peakKW,
    alerts =
      devices.filter((d) => d.status !== "Normal").length + (incident ? 1 : 0),
    health = Math.max(
      18,
      Math.round(
        100 -
          Math.max(0, ratio - 72) * 0.7 -
          alerts * 7 -
          (devices.reduce((s, d) => s + (100 - d.health), 0) / devices.length) *
            0.25,
      ),
    ),
    risk = forecastModel.riskScore;
  const activeScenario = scenarios.find((s) => s.id === incident),
    recommendations = useMemo(
      () =>
        recommendationsFor({
          env,
          minute,
          devices,
          incident,
          batteryEnergyKWh: batteryEnergy,
          appliedRecommendationIds: appliedIds,
        }),
      [env, minute, devices, incident, batteryEnergy, appliedIds],
    ),
    recommendation = recommendations[0] ?? null,
    activeAction = intervention ?? recommendation,
    recommendedTarget = recommendation
      ? devices.find((d) => d.id === recommendation.deviceId)
      : undefined,
    target = activeAction
      ? devices.find((d) => d.id === activeAction.deviceId)
      : undefined,
    reduction = activeAction?.expectedReductionKW ?? 0;
  const baselineEvPower = useMemo(
      () => createDevices(env, minute).find((d) => d.id === "ev")?.power ?? 0,
      [env, minute],
    ),
    currentEvPower = devices.find((d) => d.id === "ev")?.power ?? 0;
  const criticalDevices = useMemo(
      () => devices.filter((d) => d.critical),
      [devices],
    ),
    protectedCriticalKW = facilityDemand(criticalDevices),
    availableBatteryKWh = Math.max(
      0,
      batteryEnergy -
        cfg.battery.capacityKWh * cfg.battery.minimumReserveFraction,
    ),
    backupDurationHours =
      instant.balance.batteryDischargeKW > 0
        ? (availableBatteryKWh * cfg.battery.dischargeEfficiency) /
          instant.balance.batteryDischargeKW
        : 0;
  const topAnomaly = useMemo(
    () =>
      devices.reduce(
        (top, device) => (device.anomaly > top.anomaly ? device : top),
        devices[0],
      ),
    [devices],
  );
  const reset = (next = env) => {
    const nextConfig = config(next);
    setIncident(null);
    setMitigated(false);
    setIntervention(null);
    setAppliedIds([]);
    setForcePeakShaving(false);
    setSavings({ energyKWh: 0, cost: 0, emissionsKg: 0 });
    setMinute(548);
    setBatteryEnergy(
      nextConfig.battery.capacityKWh * nextConfig.battery.initialSoCFraction,
    );
    setTotals(emptyTotals());
    setDevices(createDevices(next, 548));
    setSelectedId(null);
    setAbout(false);
    setPlaying(true);
    setDemo(0);
  };
  const changeEnv = (e: Environment) => {
    setEnv(e);
    reset(e);
  };
  const run = (id: ScenarioId) => {
    const scenarioEnv: Environment = id === "outage" ? "Hospital" : env,
      sourceDevices =
        scenarioEnv === env ? devices : createDevices(scenarioEnv, minute);
    if (scenarioEnv !== env) {
      setEnv(scenarioEnv);
      const nextConfig = config(scenarioEnv);
      setBatteryEnergy(
        nextConfig.battery.capacityKWh * nextConfig.battery.initialSoCFraction,
      );
      setTotals(emptyTotals());
    }
    setIncident(id);
    setMitigated(false);
    setIntervention(null);
    setAppliedIds([]);
    setForcePeakShaving(false);
    setSavings({ energyKWh: 0, cost: 0, emissionsKg: 0 });
    setSelectedId(null);
    setDevices(trigger(sourceDevices, id, scenarioEnv));
  };
  const apply = () => {
    if (!recommendation) return;
    const result = applyRecommendationState(
      devices,
      batteryEnergy,
      recommendation,
      env,
    );
    if (!result.applied) return;
    setDevices(result.devices);
    setForcePeakShaving(result.forcePeakShaving);
    setAppliedIds((ids) => [...ids, recommendation.id]);
    setIntervention(recommendation);
    setMitigated(true);
  };
  const goDemoStep = (step: number) => {
    const nextStep = Math.max(1, Math.min(10, step)),
      demoEnv: Environment = "School Campus",
      demoMinute = 548,
      demoConfig = config(demoEnv),
      initialBattery =
        demoConfig.battery.capacityKWh * demoConfig.battery.initialSoCFraction;
    let nextDevices = createDevices(demoEnv, demoMinute),
      nextRecommendation: Recommendation | null = null,
      nextForcePeakShaving = false;
    if (nextStep >= 3) nextDevices = trigger(nextDevices, "ev", demoEnv);
    if (nextStep >= 8) {
      nextRecommendation =
        recommendationsFor({
          env: demoEnv,
          minute: demoMinute,
          devices: nextDevices,
          incident: "ev",
          batteryEnergyKWh: initialBattery,
        })[0] ?? null;
      if (nextRecommendation) {
        const applied = applyRecommendationState(
          nextDevices,
          initialBattery,
          nextRecommendation,
          demoEnv,
        );
        nextDevices = applied.devices;
        nextForcePeakShaving = applied.forcePeakShaving;
      }
    }
    const impactHours = nextStep === 10 && nextRecommendation ? 0.5 : 0,
      avoidedGridKWh =
        (nextRecommendation?.expectedGridReductionKW ?? 0) * impactHours;
    setPlaying(false);
    setEnv(demoEnv);
    setMinute(demoMinute);
    setBatteryEnergy(initialBattery);
    setTotals(emptyTotals());
    setDevices(nextDevices);
    setIncident(nextStep >= 3 ? "ev" : null);
    setIntervention(nextRecommendation);
    setAppliedIds(nextRecommendation ? [nextRecommendation.id] : []);
    setForcePeakShaving(nextForcePeakShaving);
    setMitigated(nextStep >= 8);
    setSavings({
      energyKWh: avoidedGridKWh,
      cost: avoidedGridKWh * tariffRate(demoConfig.tariff, demoMinute),
      emissionsKg: avoidedGridKWh * demoConfig.emissionsKgPerGridKWh,
    });
    setSelectedId(null);
    setView(demoSteps[nextStep - 1].view);
    setDemo(nextStep);
  };
  if (!entered) return <Landing onLaunch={() => setEntered(true)} />;
  return (
    <div className={`shell ${demo ? `demo-step-${demo}` : ""}`}>
      <aside>
        <div className="brand">
          <span className="logo">G</span>
          <div>
            Nodoryx
            <small>ENERGY INTELLIGENCE</small>
          </div>
        </div>
        <nav>
          {nav.map((n) => (
            <button
              key={n}
              className={view === n ? "active" : ""}
              onClick={() => setView(n)}
              aria-current={view === n ? "page" : undefined}
              title={`Open ${n}`}
            >
              <span data-label="Device">
                {
                  (
                    {
                      Overview: "⌂",
                      "Digital Twin": "◇",
                      Devices: "▤",
                      Forecast: "↗",
                      "Scenario Lab": "⚡",
                      Incidents: "!",
                      Analytics: "◫",
                      Architecture: "⌘",
                    } as Record<string, string>
                  )[n]
                }
              </span>
              {n}
            </button>
          ))}
        </nav>
        <div className="sidefoot">
          <i /> Synthetic Live Simulation
          <small>Deterministic telemetry · No hardware</small>
        </div>
      </aside>
      <main>
        <header>
          <div className="mobilebrand">Nodoryx</div>
          <div className="crumb">
            OPERATIONS / <b>{view.toUpperCase()}</b>
          </div>
          <div className="headcontrols">
            <label>
              Environment
              <select
                value={env}
                onChange={(e) => changeEnv(e.target.value as Environment)}
              >
                {Object.keys({
                  "School Campus": 1,
                  Hospital: 1,
                  "Smart Home": 1,
                  Factory: 1,
                }).map((e) => (
                  <option key={e}>{e}</option>
                ))}
              </select>
            </label>
            <div className="clock">
              <small>SIMULATION TIME</small>
              <strong>
                {new Date(2026, 7, 16, 0, minute).toLocaleTimeString([], {
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </strong>
            </div>
            <button
              className="iconbtn"
              onClick={() => setPlaying(!playing)}
              aria-label={playing ? "Pause" : "Play"}
              title={
                playing
                  ? "Pause simulated telemetry"
                  : "Resume simulated telemetry"
              }
            >
              {playing ? "Ⅱ" : "▶"}
            </button>
            <select
              className="speed"
              value={speed}
              onChange={(e) => setSpeed(+e.target.value)}
              aria-label="Simulation speed"
            >
              {[1, 5, 20, 60].map((x) => (
                <option key={x} value={x}>
                  {x}×
                </option>
              ))}
            </select>
            <button
              className="ghost"
              onClick={() => reset()}
              title="Restore the selected environment to its deterministic baseline"
            >
              ↻ Reset
            </button>
            <button
              className="demo"
              onClick={() => goDemoStep(1)}
              title="Start the ten-step VoltHacks walkthrough"
            >
              ▷ Judge Demo
            </button>
          </div>
        </header>
        {view === "Overview" && Overview()}
        {view === "Digital Twin" && Twin()}
        {view === "Devices" && Devices()}
        {view === "Forecast" && Forecast()}
        {view === "Scenario Lab" && ScenarioLab()}
        {view === "Incidents" && Incidents()}
        {view === "Analytics" && Analytics()}
        {view === "Architecture" && Architecture()}
        {view === "Overview" && incident === "ev" && (
          <section
            className={`surgebanner ${mitigated ? "mitigated" : "critical"}`}
            role="alert"
          >
            <div>
              <span>
                {mitigated ? "MITIGATION VERIFIED" : "LIVE INCIDENT · CRITICAL"}
              </span>
              <h2>
                {mitigated
                  ? "EV charging throttled"
                  : "EV charging surge detected"}
              </h2>
              <p>
                {mitigated
                  ? `Facility demand fell by ${fmt(intervention?.expectedReductionKW ?? 0, 1)} kW and utilization improved to ${fmt(ratio, 1)}%.`
                  : `Campus EV Chargers increased from ${fmt(baselineEvPower, 1)} kW to ${fmt(currentEvPower, 1)} kW and now account for ${fmt((currentEvPower / gross) * 100)}% of demand.`}
              </p>
            </div>
            <div className="surgevalues">
              <Metric
                label="EV CHARGING"
                value={`${fmt(currentEvPower, 1)} kW`}
              />
              <Metric label="FACILITY LOAD" value={`${fmt(gross, 1)} kW`} />
              <Metric label="GRID UTILIZATION" value={`${fmt(ratio, 1)}%`} />
              <Metric label="FORECAST PEAK" value={`${fmt(forecast, 1)} kW`} />
            </div>
          </section>
        )}
        {view === "Overview" && incident === "outage" && (
          <section className="emergency">
            <div className="emergencyhead">
              <div>
                <span>EMERGENCY MODE · GRID SUPPLY LOST</span>
                <h2>Critical clinical services protected</h2>
                <p>
                  <b>Nodoryx Engineer:</b> Emergency, ICU, refrigeration,
                  essential lighting, and communications remain prioritized
                  because interruption creates patient-safety risk. Only
                  noncritical systems are eligible for shedding.
                </p>
              </div>
              <strong>
                GRID
                <br />
                <b>0 kW</b>
              </strong>
            </div>
            <div className="emergencyflow">
              <Metric
                label="BACKUP GENERATION"
                value={`${fmt(instant.balance.backupGenerationKW, 1)} kW`}
              />
              <Metric
                label="BATTERY SUPPORT"
                value={`${fmt(instant.balance.batteryDischargeKW, 1)} kW`}
              />
              <Metric
                label="BACKUP DURATION"
                value={`${fmt(backupDurationHours, 1)} hours`}
              />
              <Metric
                label="PROTECTED LOAD"
                value={`${fmt(protectedCriticalKW, 1)} kW`}
              />
              <Metric
                label="CRITICAL SERVICES"
                value={`${criticalDevices.length} online`}
              />
            </div>
            <div className="protectedlist">
              {criticalDevices.map((d) => (
                <span key={d.id}>
                  ✓ <b>{d.name}</b> · {fmt(d.power, 1)} kW
                </span>
              ))}
            </div>
            <div className="emergencytimeline">
              <span>GRID FAILURE DETECTED</span>
              <i>→</i>
              <span>BACKUP ACTIVATED</span>
              <i>→</i>
              <span>NONCRITICAL LOADS SHED</span>
              <i>→</i>
              <span>CRITICAL SERVICES PRESERVED</span>
            </div>
          </section>
        )}
        {view === "Overview" &&
          topAnomaly &&
          topAnomaly.anomalySeverity !== "Normal" && (
            <section className="anomalyevidence" role="status">
              <div>
                <span>
                  STATISTICAL ANOMALY ·{" "}
                  {topAnomaly.anomalySeverity.toUpperCase()}
                </span>
                <h3>{topAnomaly.name}</h3>
                <p>{topAnomaly.anomalyReason}</p>
              </div>
              <div>
                <Metric
                  label="EXPECTED"
                  value={`${fmt(topAnomaly.expectedPower, 1)} kW`}
                />
                <Metric
                  label="OBSERVED"
                  value={`${fmt(topAnomaly.power, 1)} kW`}
                />
                <Metric
                  label="DEVIATION"
                  value={`${topAnomaly.deviationPercent >= 0 ? "+" : ""}${fmt(topAnomaly.deviationPercent, 1)}%`}
                />
                <Metric label="Z-SCORE" value={fmt(topAnomaly.zScore, 1)} />
                <button onClick={() => setSelectedId(topAnomaly.id)}>
                  Inspect telemetry →
                </button>
              </div>
            </section>
          )}
        {view === "Overview" && (
          <section className="sessionimpact">
            <span>
              <small>NODORYX IMPACT</small>
              <b>Measured from intervention state</b>
            </span>
            <Metric
              label="Avoided peak"
              value={`${fmt(intervention?.expectedReductionKW ?? 0, 1)} kW`}
            />
            <Metric
              label="Energy avoided"
              value={`${fmt(savings.energyKWh, 1)} kWh`}
            />
            <Metric label="Cost avoided" value={`$${fmt(savings.cost, 2)}`} />
            <Metric
              label="CO₂ avoided (est.)"
              value={`${fmt(savings.emissionsKg, 1)} kg`}
            />
            <Metric
              label="Grid energy used"
              value={`${fmt(totals.gridImportKWh, 1)} kWh`}
            />
          </section>
        )}
        {view === "Overview" && (
          <button className="abouttrigger" onClick={() => setAbout(true)}>
            ⓘ About this simulation
          </button>
        )}
      </main>
      {selected && (
        <div className="overlay">
          <section
            className="drawer"
            role="dialog"
            aria-modal="true"
            aria-label={`${selected.name} details`}
          >
            <button
              className="close"
              onClick={() => setSelectedId(null)}
              aria-label="Close device details"
            >
              ×
            </button>
            <span className="eyebrow">DEVICE TELEMETRY</span>
            <h2>{selected.name}</h2>
            <p>
              {selected.zone} · {selected.category}
            </p>
            <div className="devicehero">
              <strong>{fmt(selected.power, 1)} kW</strong>
              <span className={`pill ${selected.status.toLowerCase()}`}>
                {selected.status}
              </span>
            </div>
            <MiniChart
              data={history.map((p, i) => ({
                ...p,
                load:
                  p.load * (selected.power / gross) * (1 + Math.sin(i) * 0.03),
              }))}
            />
            <div className="details">
              <Metric label="Health" value={`${selected.health}%`} />
              <Metric label="Efficiency" value={`${selected.efficiency}%`} />
              <Metric
                label="Anomaly score"
                value={`${fmt(selected.anomaly)} / 100`}
              />
              <Metric label="Load priority" value={selected.priority} />
            </div>
          </section>
        </div>
      )}
      {selected && selected.anomalySeverity !== "Normal" && (
        <aside className="drawerEvidence">
          <span>WHY THIS WAS DETECTED</span>
          <p>{selected.anomalyReason}</p>
          <div>
            <Metric
              label="Expected"
              value={`${fmt(selected.expectedPower, 1)} kW`}
            />
            <Metric label="Observed" value={`${fmt(selected.power, 1)} kW`} />
            <Metric
              label="Deviation"
              value={`${selected.deviationPercent >= 0 ? "+" : ""}${fmt(selected.deviationPercent, 1)}%`}
            />
            <Metric label="Severity" value={selected.anomalySeverity} />
          </div>
        </aside>
      )}
      {demo > 0 && (
        <div
          className="tour"
          role="region"
          aria-live="polite"
          aria-label={`Guided demo step ${demo} of 10`}
        >
          <div className="tourhead">
            <span>VOLTHACKS GUIDED DEMO · {demo} / 10</span>
            <button onClick={() => setDemo(0)}>Exit Demo</button>
          </div>
          <i>
            <em style={{ width: `${demo * 10}%` }} />
          </i>
          <h3>{demoSteps[demo - 1].title}</h3>
          <p>{demoSteps[demo - 1].body}</p>
          <div className="tourcontrols">
            <button onClick={() => goDemoStep(1)}>Restart</button>
            <button onClick={() => goDemoStep(demo - 1)} disabled={demo === 1}>
              Previous
            </button>
            <button
              className="primary"
              onClick={() => (demo === 10 ? setDemo(0) : goDemoStep(demo + 1))}
            >
              {demo === 10 ? "Finish" : "Next"}
            </button>
          </div>
        </div>
      )}
      {about && (
        <div className="overlay">
          <section
            className="aboutbox"
            role="dialog"
            aria-modal="true"
            aria-label="About this simulation"
          >
            <button
              className="close"
              onClick={() => setAbout(false)}
              aria-label="Close about dialog"
            >
              ×
            </button>
            <span className="eyebrow">ABOUT THIS SIMULATION</span>
            <h2>Real analytics. Synthetic telemetry.</h2>
            <p>
              Nodoryx generates deterministic device telemetry that models
              schedules, load behavior, solar production, battery response, and
              electrical constraints.
            </p>
            <ul>
              <li>
                All telemetry is synthetic; no real facility or personal data is
                used.
              </li>
              <li>
                Every incident is reproducible and uses the same live simulation
                engine.
              </li>
              <li>
                Analytics and recommendations derive from generated state.
              </li>
              <li>
                No external hardware, paid API, or credential is required.
              </li>
            </ul>
            <button className="primary" onClick={() => setAbout(false)}>
              Understood
            </button>
          </section>
        </div>
      )}
    </div>
  );

  function Overview() {
    return (
      <div className="content">
        <section className="statusbar">
          <div>
            <span
              className={`statusdot ${ratio > 90 ? "bad" : ratio > 80 ? "warn" : ""}`}
            />
            <b>
              {ratio > 95
                ? "Critical capacity risk"
                : ratio > 82
                  ? "Elevated load detected"
                  : "All systems operational"}
            </b>
            <small>
              {activeScenario
                ? activeScenario.title
                : "Live telemetry nominal across all zones"}
            </small>
          </div>
          <span className="synthetic">SYNTHETIC LIVE</span>
        </section>
        <div className="pagehead">
          <div>
            <span className="eyebrow">LIVE OPERATIONS</span>
            <h1>{env} energy overview</h1>
            <p>
              Nodoryx is monitoring {devices.length} electrical systems and
              forecasting feeder capacity.
            </p>
          </div>
          <button className="scenario" onClick={() => setView("Scenario Lab")}>
            ⚡ Trigger incident
          </button>
        </div>
        <section className="kpis">
          <Kpi
            label="CURRENT DEMAND"
            value={`${fmt(gross)} kW`}
            sub={`${fmt(ratio, 1)}% of ${fmt(cfg.capacity)} kW capacity`}
            tone={ratio > 88 ? "red" : "cyan"}
          />
          <Kpi
            label="GRID IMPORT"
            value={`${fmt(grid)} kW`}
            sub={`${fmt(Math.max(0, gross - grid), 0)} kW locally supplied`}
          />
          <Kpi
            label="SOLAR OUTPUT"
            value={`${fmt(solar)} kW`}
            sub={`${fmt((solar / Math.max(1, gross)) * 100)}% facility contribution`}
            tone="yellow"
          />
          <Kpi
            label="BATTERY"
            value={`${fmt(battery)}%`}
            sub={`${batteryFlow >= 0 ? "Discharging" : "Charging"} ${fmt(Math.abs(batteryFlow))} kW`}
            tone="purple"
          />
          <Kpi
            label="SYSTEM HEALTH"
            value={`${health} / 100`}
            sub={
              health > 84 ? "Healthy operating range" : "Intervention advised"
            }
            tone="green"
          />
        </section>
        <div className="grid2">
          <section className="panel chartpanel">
            <PanelTitle
              title="Demand & capacity forecast"
              sub="Live load · 60 minute statistical forecast"
              tag={`Risk ${fmt(risk)}%`}
            />
            <MiniChart data={history} />
            <div className="legend">
              <span>
                <i className="lcyan" />
                Actual load
              </span>
              <span>
                <i className="ldash" />
                Forecast
              </span>
              <span>
                <i className="lred" />
                Safe capacity
              </span>
            </div>
          </section>
          <section className="panel">
            <PanelTitle title="Energy flow" sub="Real-time power balance" />
            <div className="flow">
              <div className="source sun">
                <b>☀</b>
                <span>
                  SOLAR<strong>{fmt(solar)} kW</strong>
                </span>
              </div>
              <div className="arrow">······›</div>
              <div className="facility">
                <b>GG</b>
                <span>
                  FACILITY<strong>{fmt(gross)} kW</strong>
                </span>
              </div>
              <div className="arrow right">······›</div>
              <div className="source">
                <b>▦</b>
                <span>
                  LOADS<strong>{devices.length} online</strong>
                </span>
              </div>
              <div className="bottom">
                <span>
                  GRID <b>{fmt(grid)} kW</b>
                </span>
                <span>
                  BATTERY <b>{fmt(Math.abs(batteryFlow))} kW</b>
                </span>
              </div>
            </div>
          </section>
        </div>
        <div className="grid3">
          <section className="panel span2">
            <PanelTitle
              title="Largest energy consumers"
              sub="Current demand by device"
            />
            <div className="consumers">
              {[...devices]
                .sort((a, b) => b.power - a.power)
                .slice(0, 5)
                .map((d) => (
                  <button key={d.id} onClick={() => setSelectedId(d.id)}>
                    <span>
                      <b>{d.name}</b>
                      <small>{d.zone}</small>
                    </span>
                    <div className="bar">
                      <i
                        style={{
                          width: `${(d.power / Math.max(...devices.map((x) => x.power))) * 100}%`,
                        }}
                      />
                    </div>
                    <strong>{fmt(d.power, 1)} kW</strong>
                  </button>
                ))}
            </div>
          </section>
          <section className="panel alertpanel">
            <PanelTitle
              title="Nodoryx Engineer"
              sub="Contextual local intelligence"
            />
            <div className="aiicon">G</div>
            {recommendation ? (
              <div className="recommendation-detail">
                <span
                  className={`severity ${recommendation.priority.toLowerCase()}`}
                >
                  {recommendation.priority} priority · risk{" "}
                  {fmt(recommendation.riskScore)}/100
                </span>
                <h3>{recommendation.actionLabel}</h3>
                <p>
                  <b>Affects:</b>{" "}
                  {recommendedTarget?.name ?? recommendation.deviceName}
                </p>
                <p>
                  <b>Why:</b> {recommendation.reason}
                </p>
                <p>
                  <b>Expected impact:</b> {recommendation.expectedImpact}
                </p>
                <p>
                  <b>Measured reduction:</b>{" "}
                  {fmt(recommendation.expectedReductionKW, 1)} kW{" "}
                  {recommendation.expectedDemandReductionKW === 0
                    ? "of grid import"
                    : "of facility demand"}
                  .
                </p>
              </div>
            ) : (
              <p>
                {incident
                  ? `No further safe actions are justified by current simulation state. ${appliedIds.length} action${appliedIds.length === 1 ? " has" : "s have"} been applied; demand is ${fmt(gross, 1)} kW and forecast risk is ${fmt(risk)}/100.`
                  : `Demand is stable at ${fmt(ratio, 1)}% of safe capacity. Solar supplies ${fmt((solar / Math.max(1, gross)) * 100)}% of current load; no corrective action is justified.`}
              </p>
            )}
            {incident && recommendation && (
              <button className="primary full" onClick={apply}>
                {appliedIds.length ? "Apply next" : "Apply recommendation"}{" "}
                <b>−{fmt(recommendation.expectedReductionKW, 1)} kW</b>
              </button>
            )}
            {appliedIds.length > 0 && (
              <div className="resolved">
                ✓ {appliedIds.length} action{appliedIds.length === 1 ? "" : "s"}{" "}
                applied · {recommendations.length} remaining
              </div>
            )}
          </section>
        </div>
        <section className="impact">
          <span>
            <small>TODAY’S IMPACT</small>
            <b>Nodoryx interventions</b>
          </span>
          <Metric
            label="Energy avoided"
            value={`${fmt(savings.energyKWh, 1)} kWh`}
          />
          <Metric label="Cost avoided" value={`$${fmt(savings.cost, 2)}`} />
          <Metric
            label="CO₂ avoided (est.)"
            value={`${fmt(savings.emissionsKg, 1)} kg`}
          />
          <Metric label="Incidents detected" value={incident ? "1" : "0"} />
          <Metric label="Actions applied" value={`${appliedIds.length}`} />
        </section>
      </div>
    );
  }
  function Twin() {
    return (
      <Page
        title="Digital twin"
        sub="A live spatial view of power, equipment health, and risk across the facility."
      >
        <div className="twin">
          <div className="floorhead">
            <b>{env.toUpperCase()} · ELECTRICAL MODEL</b>
            <span>Click a zone to inspect devices</span>
          </div>
          <div className="floors">
            {devices.map((d, i) => (
              <button
                key={d.id}
                onClick={() => setSelectedId(d.id)}
                className={d.status.toLowerCase()}
              >
                <span>ZONE {String(i + 1).padStart(2, "0")}</span>
                <b>{d.zone}</b>
                <strong>{fmt(d.power, 1)} kW</strong>
                <small>
                  {d.name} · {d.status}
                </small>
                <i
                  style={{
                    width: `${Math.min(100, (d.power / (cfg.capacity * 0.25)) * 100)}%`,
                  }}
                />
              </button>
            ))}
          </div>
          <div className="twinrail">
            <Metric label="Total demand" value={`${fmt(gross)} kW`} />
            <Metric
              label="Online systems"
              value={`${devices.length} / ${devices.length}`}
            />
            <Metric
              label="Critical loads"
              value={`${devices.filter((d) => d.critical).length}`}
            />
            <Metric
              label="Anomalous zones"
              value={`${devices.filter((d) => d.anomaly > 40).length}`}
            />
          </div>
        </div>
      </Page>
    );
  }
  function Devices() {
    const list = devices.filter((d) =>
      (d.name + d.zone + d.category)
        .toLowerCase()
        .includes(query.toLowerCase()),
    );
    return (
      <Page
        title="Device registry"
        sub="Search and inspect every simulated electrical asset."
      >
        <div className="toolbar">
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search device, zone, category…"
          />
          <span>{list.length} systems online</span>
        </div>
        <div className="table">
          <div className="tr th">
            <span>DEVICE</span>
            <span>ZONE</span>
            <span>POWER</span>
            <span>HEALTH</span>
            <span>PRIORITY</span>
            <span>ANOMALY</span>
          </div>
          {list.map((d) => (
            <button
              className="tr"
              key={d.id}
              onClick={() => setSelectedId(d.id)}
            >
              <span>
                <b>{d.name}</b>
                <small>{d.category}</small>
              </span>
              <span data-label="Zone">{d.zone}</span>
              <span data-label="Power">
                <b>{fmt(d.power, 1)} kW</b>
              </span>
              <span data-label="Health">{d.health}%</span>
              <span data-label="Priority">
                <i className={`pill ${d.critical ? "critical" : ""}`}>
                  {d.critical ? "Critical" : d.priority}
                </i>
              </span>
              <span data-label="Anomaly">
                <b className={d.anomaly > 45 ? "danger" : ""}>
                  {fmt(d.anomaly)}
                </b>{" "}
                / 100
              </span>
            </button>
          ))}
        </div>
      </Page>
    );
  }
  function Forecast() {
    return (
      <Page
        title="Capacity forecast"
        sub="Weighted recent demand, measured trend, and time-of-day baseline compared with safe capacity."
      >
        <div className="forecastHero">
          <div>
            <span className="eyebrow">
              NEXT 60 MINUTES · {forecastModel.direction.toUpperCase()} CAPACITY
            </span>
            <h2>
              {forecastModel.condition === "Overload"
                ? "Safe capacity expected to be exceeded"
                : forecastModel.condition === "Warning"
                  ? "Demand is approaching the warning zone"
                  : "Capacity remains available"}
            </h2>
            <p>
              Heuristic risk score: <b>{fmt(risk)} / 100</b>. Calculated from
              forecast proximity to {fmt(cfg.capacity)} kW and the measured
              trend of {forecastModel.trendKWPerMinute >= 0 ? "+" : ""}
              {fmt(forecastModel.trendKWPerMinute, 2)} kW/min.
            </p>
          </div>
          <strong>
            {fmt(forecast)}
            <small>kW predicted peak</small>
          </strong>
        </div>
        <section className="panel tall">
          <PanelTitle
            title="Demand trajectory vs safe capacity"
            sub={`Current ${fmt(gross, 1)} kW · ${forecastModel.direction} the limit · capacity-relative risk score`}
          />
          <MiniChart data={history} />
        </section>
        <div className="forecastcards">
          <Kpi
            label="CURRENT"
            value={`${fmt(gross, 1)} kW`}
            sub={`${fmt(ratio, 1)}% of capacity`}
          />
          <Kpi
            label="15 MIN"
            value={`${fmt(forecastModel.at15KW, 1)} kW`}
            sub={
              forecastModel.at15KW >= cfg.capacity
                ? "Overload"
                : forecastModel.at15KW >= cfg.capacity * 0.9
                  ? "Warning zone"
                  : "Within capacity"
            }
          />
          <Kpi
            label="30 MIN"
            value={`${fmt(forecastModel.at30KW, 1)} kW`}
            sub={
              forecastModel.at30KW >= cfg.capacity
                ? "Overload"
                : forecastModel.at30KW >= cfg.capacity * 0.9
                  ? "Warning zone"
                  : "Within capacity"
            }
          />
          <Kpi
            label="60 MIN"
            value={`${fmt(forecastModel.at60KW, 1)} kW`}
            sub={`${fmt(cfg.capacity - forecastModel.at60KW, 1)} kW headroom`}
          />
        </div>
      </Page>
    );
  }
  function ScenarioLab() {
    return (
      <Page
        title="Scenario lab"
        sub="Inject reproducible incidents into the real simulation and observe Nodoryx respond."
      >
        <div className="scenarioGrid">
          {scenarios.map((s) => (
            <article key={s.id} className={incident === s.id ? "running" : ""}>
              <div>
                <span className={`severity ${s.severity.toLowerCase()}`}>
                  {s.severity}
                </span>
                <span className="scenarioid">
                  SCENARIO {s.id.toUpperCase()}
                </span>
              </div>
              <h3>{s.title}</h3>
              <p>{s.desc}</p>
              <small>
                Affects:{" "}
                {s.id === "outage"
                  ? "Grid, battery, critical systems"
                  : s.id === "solar"
                    ? "Generation, storage, grid import"
                    : "Flexible loads, feeder capacity"}
              </small>
              <button onClick={() => run(s.id)} disabled={incident === s.id}>
                {incident === s.id ? "● Scenario active" : "Trigger scenario →"}
              </button>
            </article>
          ))}
        </div>
        {incident && (
          <button className="restore" onClick={() => reset()}>
            ↻ Restore normal operation
          </button>
        )}
      </Page>
    );
  }
  function Incidents() {
    return (
      <Page
        title="Incident center"
        sub="Detection evidence, response decisions, and mitigated impact in one timeline."
      >
        {!incident ? (
          <Empty
            text="No incidents recorded in this session"
            action="Open Scenario Lab"
            onClick={() => setView("Scenario Lab")}
          />
        ) : (
          <div className="incidentlayout">
            <section className="timeline">
              <Timeline
                time="09:08"
                title={`${activeScenario?.title} initiated`}
                text="Synthetic telemetry departed from expected baseline."
              />
              <Timeline
                time="09:09"
                title="Anomaly detected"
                text={`${devices.filter((d) => d.anomaly > 40).length} device signals exceeded deviation thresholds.`}
              />
              <Timeline
                time="09:10"
                title="Capacity risk forecast"
                text={`Projected peak reached ${fmt(forecast)} kW, or ${fmt((forecast / cfg.capacity) * 100)}% of safe capacity.`}
              />
              <Timeline
                time="09:11"
                title="Corrective action recommended"
                text={`${target?.name} selected because it is flexible and non-critical.`}
              />
              {mitigated && (
                <Timeline
                  time="09:12"
                  title="Incident mitigated"
                  text={`${fmt(reduction)} kW of avoidable peak demand prevented.`}
                />
              )}
            </section>
            <section className="incidentcard">
              <span className={`severity ${mitigated ? "low" : "high"}`}>
                {mitigated ? "MITIGATED" : "ACTION RECOMMENDED"}
              </span>
              <h2>{activeScenario?.title}</h2>
              <p>
                Peak anomaly score{" "}
                <b>{fmt(Math.max(...devices.map((d) => d.anomaly)))}/100</b>
              </p>
              <hr />
              <Metric
                label="Affected system"
                value={target?.name || "Site feeder"}
              />
              <Metric label="Current load" value={`${fmt(gross)} kW`} />
              <Metric
                label="Prevented impact"
                value={mitigated ? `${fmt(reduction)} kW` : "Pending action"}
              />
              {!mitigated && (
                <button className="primary full" onClick={apply}>
                  Apply recommended action
                </button>
              )}
            </section>
          </div>
        )}
      </Page>
    );
  }
  function Analytics() {
    const cats = Object.entries(
      devices.reduce(
        (a, d) => ({ ...a, [d.category]: (a[d.category] || 0) + d.power }),
        {} as Record<string, number>,
      ),
    ).sort((a, b) => b[1] - a[1]);
    return (
      <Page
        title="Energy analytics"
        sub="Operational signals that explain where energy goes and what Nodoryx changes."
      >
        <div className="analytics">
          <section className="panel span2">
            <PanelTitle
              title="Demand profile"
              sub="Actual consumption across the simulation window"
            />
            <MiniChart data={history} />
          </section>
          <section className="panel">
            <PanelTitle
              title="Demand by category"
              sub="Current load allocation"
            />
            <div className="categorybars">
              {cats.map(([c, v]) => (
                <div key={c}>
                  <span>
                    {c}
                    <b>{fmt(v)} kW</b>
                  </span>
                  <i>
                    <em style={{ width: `${(v / cats[0][1]) * 100}%` }} />
                  </i>
                </div>
              ))}
            </div>
          </section>
          <section className="panel">
            <PanelTitle
              title="Accumulated session energy"
              sub="Integrated from each simulated time step"
            />
            <div className="bigstat">
              {fmt(totals.facilityKWh, 1)}
              <small>kWh consumed since reset</small>
            </div>
            <div className="split">
              <Metric
                label="Actual tariff cost"
                value={`$${fmt(totals.cost, 2)}`}
              />
              <Metric
                label="Grid CO₂ estimate"
                value={`${fmt(totals.emissionsKg, 1)} kg`}
              />
            </div>
          </section>
          <section className="panel span2">
            <PanelTitle
              title="Energy balance"
              sub="Accumulated generation and imported energy"
            />
            <div className="renew">
              <strong>
                {fmt(
                  totals.facilityKWh
                    ? (totals.solarUsedKWh / totals.facilityKWh) * 100
                    : 0,
                )}
                %
              </strong>
              <div>
                <span>
                  Grid import <b>{fmt(totals.gridImportKWh, 1)} kWh</b>
                </span>
                <i>
                  <em
                    style={{
                      width: `${totals.facilityKWh ? Math.min(100, (totals.gridImportKWh / totals.facilityKWh) * 100) : 0}%`,
                    }}
                  />
                </i>
                <small>
                  Solar generated {fmt(totals.solarGeneratedKWh, 1)} kWh ·
                  battery charged {fmt(totals.batteryChargeKWh, 1)} kWh ·
                  discharged {fmt(totals.batteryDischargeKWh, 1)} kWh.
                </small>
              </div>
            </div>
          </section>
        </div>
      </Page>
    );
  }
  function Architecture() {
    return (
      <Page
        title="How Nodoryx works"
        sub="A transparent, local-first intelligence pipeline—no black-box claims."
      >
        <div className="architecture">
          {[
            [
              "01",
              "Synthetic sensors",
              "Deterministic device telemetry models occupancy, time, health, and operating state.",
            ],
            [
              "02",
              "Digital twin engine",
              "Balances facility demand, solar generation, battery flow, grid import, cost, and emissions.",
            ],
            [
              "03",
              "Anomaly detection",
              "Expected-baseline deviation and rolling trend checks score each device independently.",
            ],
            [
              "04",
              "Demand forecasting",
              "Weighted recent demand, slope, and time-of-day behavior produce a 60-minute projection.",
            ],
            [
              "05",
              "Optimization engine",
              "Ranks safe corrective actions by reduction, criticality, cost, and emissions impact.",
            ],
            [
              "06",
              "Nodoryx Engineer",
              "A local explanation engine turns current metrics and decisions into operator-ready language.",
            ],
          ].map(([n, t, d], i) => (
            <div className="archstep" key={n}>
              <b>{n}</b>
              <span>
                <h3>{t}</h3>
                <p>{d}</p>
              </span>
              {i < 5 && <i>↓</i>}
            </div>
          ))}
        </div>
        <div className="production">
          <h3>Path to production telemetry</h3>
          <p>
            The simulation boundary can be replaced with adapters for smart
            meters, MQTT, Modbus, BACnet, building-management systems, and
            utility APIs. These integrations are architectural targets—not
            claimed as implemented.
          </p>
        </div>
      </Page>
    );
  }
}

function Landing({ onLaunch }: { onLaunch: () => void }) {
  return (
    <div className="landing">
      <header>
        <div className="brand">
          <span className="logo">G</span>
          <div>
            Nodoryx
          </div>
        </div>
        <nav>
          <a href="#system">System</a>
          <a href="#capabilities">Capabilities</a>
          <a href="#architecture">Architecture</a>
        </nav>
        <button onClick={onLaunch}>Launch Simulation →</button>
      </header>
      <main>
        <div className="herocopy">
          <span className="eyebrow">
            <i /> LIVE DIGITAL TWIN · SYNTHETIC TELEMETRY
          </span>
          <h1>
            Predict energy problems
            <br />
            before they become <em>outages.</em>
          </h1>
          <p>
            Nodoryx continuously compares live device demand against expected
            behavior, forecasts capacity risk, and recommends corrective
            actions.
          </p>
          <div>
            <button className="launch" onClick={onLaunch}>
              Launch Live Simulation <span>→</span>
            </button>
            <a href="#architecture">See how it works ↓</a>
          </div>
          <small>NO LOGIN · NO HARDWARE · FULLY REPRODUCIBLE</small>
        </div>
        <div className="heroDash">
          <div className="hdtop">
            <span>
              <i /> SCHOOL CAMPUS · LIVE
            </span>
            <b>09:08:42</b>
          </div>
          <div className="hmetric">
            <small>CURRENT DEMAND</small>
            <strong>
              412.8 <b>kW</b>
            </strong>
            <span>82.6% of safe capacity</span>
          </div>
          <div className="spark">
            {Array.from({ length: 38 }, (_, i) => (
              <i
                key={i}
                style={{ height: `${25 + Math.sin(i / 4) * 10 + i * 0.8}%` }}
              />
            ))}
            <em>500 kW CAPACITY</em>
          </div>
          <div className="alert">
            <span>!</span>
            <div>
              <b>Capacity risk detected</b>
              <small>EV charging is driving 61% of the load increase</small>
            </div>
            <strong>HIGH</strong>
          </div>
          <div className="recommend">
            <span>NODORYX RECOMMENDS</span>
            <p>Throttle flexible EV charging by 40%</p>
            <small>ILLUSTRATIVE RESPONSE · 30 kW REDUCTION</small>
          </div>
        </div>
      </main>
      <section className="proof" id="capabilities">
        <div>
          <strong>6</strong>
          <span>INCIDENT SCENARIOS</span>
        </div>
        <div>
          <strong>60m</strong>
          <span>DEMAND FORECAST</span>
        </div>
        <div>
          <strong>4</strong>
          <span>FACILITY MODELS</span>
        </div>
        <div>
          <strong>0</strong>
          <span>REQUIRED API KEYS</span>
        </div>
      </section>
      <section className="manifesto" id="system">
        <span>MONITORING ISN’T ENOUGH</span>
        <h2>
          Know what’s abnormal.
          <br />
          What happens next.
          <br />
          <em>What to do about it.</em>
        </h2>
        <p>
          Traditional dashboards report the present. Nodoryx models the
          system, detects deviations, projects risk, and connects every
          recommendation to a measurable simulation outcome.
        </p>
      </section>
      <section className="landingarch" id="architecture">
        <span className="eyebrow">INTELLIGENCE PIPELINE</span>
        <div>
          {[
            "Synthetic sensors",
            "Digital twin",
            "Anomaly detection",
            "Forecasting",
            "Optimization",
            "Operator action",
          ].map((x, i) => (
            <div key={x}>
              <b>{String(i + 1).padStart(2, "0")}</b>
              <span>{x}</span>
              {i < 5 && <i>→</i>}
            </div>
          ))}
        </div>
        <button onClick={onLaunch}>Enter the command center →</button>
      </section>
    </div>
  );
}
function Page({
  title,
  sub,
  children,
}: {
  title: string;
  sub: string;
  children: React.ReactNode;
}) {
  return (
    <div className="content">
      <div className="pagehead">
        <div>
          <span className="eyebrow">NODORYX OPERATIONS</span>
          <h1>{title}</h1>
          <p>{sub}</p>
        </div>
      </div>
      {children}
    </div>
  );
}
function Kpi({
  label,
  value,
  sub,
  tone = "cyan",
}: {
  label: string;
  value: string;
  sub: string;
  tone?: string;
}) {
  return (
    <article className={`kpi ${tone}`}>
      <span>{label}</span>
      <strong>{value}</strong>
      <small>{sub}</small>
    </article>
  );
}
function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="metric">
      <small>{label}</small>
      <b>{value}</b>
    </div>
  );
}
function PanelTitle({
  title,
  sub,
  tag,
}: {
  title: string;
  sub: string;
  tag?: string;
}) {
  return (
    <div className="paneltitle">
      <div>
        <h3>{title}</h3>
        <p>{sub}</p>
      </div>
      {tag && <span>{tag}</span>}
    </div>
  );
}
function MiniChart({
  data,
}: {
  data: { time?: string; load: number; forecast: number; capacity: number }[];
}) {
  const max =
    Math.max(...data.map((d) => Math.max(d.capacity, d.forecast))) * 1.06;
  return (
    <div
      className="linechart"
      role="img"
      aria-label="Historical and forecast demand moving relative to safe grid capacity"
    >
      <div
        className="capacity"
        style={{ bottom: `${(data[0].capacity / max) * 100}%` }}
      >
        <span>{fmt(data[0].capacity)} kW SAFE LIMIT</span>
      </div>
      <div className="bars">
        {data.map((d, i) => (
          <i
            key={i}
            className={i >= FORECAST_HISTORY_SAMPLES ? "future" : ""}
            style={{ height: `${(d.load / max) * 100}%` }}
            title={`${d.time ?? (i >= FORECAST_HISTORY_SAMPLES ? "Forecast" : "Observed")} · ${fmt(d.load, 1)} kW · safe capacity ${fmt(d.capacity, 1)} kW`}
          />
        ))}
      </div>
      <div className="axis">
        <span>−90m</span>
        <span>−45m</span>
        <span>NOW</span>
        <span>+60m</span>
      </div>
    </div>
  );
}
function Timeline({
  time,
  title,
  text,
}: {
  time: string;
  title: string;
  text: string;
}) {
  return (
    <div className="timeitem">
      <time>{time}</time>
      <i />
      <div>
        <b>{title}</b>
        <p>{text}</p>
      </div>
    </div>
  );
}
function Empty({
  text,
  action,
  onClick,
}: {
  text: string;
  action: string;
  onClick: () => void;
}) {
  return (
    <div className="empty">
      <b>✓</b>
      <h2>{text}</h2>
      <p>
        Trigger a reproducible incident to populate detection evidence and
        response history.
      </p>
      <button className="primary" onClick={onClick}>
        {action} →
      </button>
    </div>
  );
}
