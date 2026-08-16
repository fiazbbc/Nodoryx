import test from "node:test";
import assert from "node:assert/strict";
import {
  applyRecommendation,
  applyRecommendationState,
  config,
  createDevices,
  demandForecast,
  detectAnomaly,
  emptyTotals,
  FORECAST_POINT_LIMIT,
  facilityDemand,
  forecastValue,
  makeHistory,
  recommendationFor,
  recommendationsFor,
  solarOutput,
  stepEnergy,
  tariffRate,
  trigger,
  type Environment,
} from "../lib/simulation.ts";

const close = (actual: number, expected: number, tolerance = 1e-9) =>
  assert.ok(
    Math.abs(actual - expected) <= tolerance,
    `${actual} != ${expected}`,
  );

test("facility demand is exactly the sum of device demand", () => {
  for (const env of [
    "School Campus",
    "Hospital",
    "Smart Home",
    "Factory",
  ] as Environment[]) {
    const devices = createDevices(env, 540);
    close(
      facilityDemand(devices),
      devices.reduce((sum, d) => sum + d.power, 0),
    );
  }
});

test("power balance conserves energy while grid is available", () => {
  const env = "School Campus",
    cfg = config(env),
    devices = createDevices(env, 720);
  const result = stepEnergy({
    env,
    minute: 720,
    devices,
    batteryEnergyKWh: cfg.battery.capacityKWh * 0.5,
    durationHours: 0.25,
  });
  const b = result.balance;
  close(
    b.gridImportKW + b.solarToFacilityKW + b.batteryDischargeKW,
    b.facilityDemandKW + b.batteryChargeKW,
  );
  close(
    b.solarGenerationKW,
    b.solarToFacilityKW + b.batteryChargeKW + b.curtailedSolarKW,
  );
});

test("energy equals power multiplied by simulated elapsed time", () => {
  const env = "Hospital",
    devices = createDevices(env, 600),
    dt = 0.5;
  const result = stepEnergy({
    env,
    minute: 600,
    devices,
    batteryEnergyKWh: config(env).battery.capacityKWh * 0.74,
    durationHours: dt,
    previousTotals: emptyTotals(),
  });
  close(result.totals.facilityKWh, facilityDemand(devices) * dt);
  close(result.totals.gridImportKWh, result.balance.gridImportKW * dt);
});

test("cost and emissions derive only from integrated grid-imported energy", () => {
  const env = "Factory",
    minute = 1020,
    dt = 0.25,
    cfg = config(env);
  const result = stepEnergy({
    env,
    minute,
    devices: createDevices(env, minute),
    batteryEnergyKWh: cfg.battery.capacityKWh * 0.5,
    durationHours: dt,
  });
  close(
    result.totals.cost,
    result.totals.gridImportKWh * tariffRate(cfg.tariff, minute),
  );
  close(
    result.totals.emissionsKg,
    result.totals.gridImportKWh * cfg.emissionsKgPerGridKWh,
  );
});

test("battery charge respects capacity, rate, and charging efficiency", () => {
  const env = "Smart Home",
    cfg = config(env),
    nearFull = cfg.battery.capacityKWh - 0.1;
  const devices = createDevices(env, 720).map((d) => ({ ...d, power: 0 }));
  const dt = 1;
  const result = stepEnergy({
    env,
    minute: 720,
    devices,
    batteryEnergyKWh: nearFull,
    durationHours: dt,
  });
  assert.ok(result.balance.batteryChargeKW <= cfg.battery.maxChargeKW);
  assert.ok(result.batteryEnergyKWh <= cfg.battery.capacityKWh);
  close(
    result.batteryEnergyKWh,
    nearFull +
      result.balance.batteryChargeKW * cfg.battery.chargeEfficiency * dt,
  );
});

test("battery discharge respects reserve, rate, and discharging efficiency", () => {
  const env = "Smart Home",
    cfg = config(env),
    reserve = cfg.battery.capacityKWh * cfg.battery.minimumReserveFraction;
  const energy = reserve + 0.2;
  const devices = createDevices(env, 1080).map((d) => ({ ...d, power: 20 }));
  const dt = 1;
  const result = stepEnergy({
    env,
    minute: 1080,
    devices,
    batteryEnergyKWh: energy,
    durationHours: dt,
    forcePeakShaving: true,
  });
  assert.ok(result.balance.batteryDischargeKW <= cfg.battery.maxDischargeKW);
  assert.ok(result.batteryEnergyKWh >= reserve);
  close(
    result.batteryEnergyKWh,
    energy -
      (result.balance.batteryDischargeKW / cfg.battery.dischargeEfficiency) *
        dt,
  );
});

test("outage has zero grid import and reports unmet load after battery limits", () => {
  const env = "Hospital",
    cfg = config(env),
    devices = createDevices(env, 600),
    reserve = cfg.battery.capacityKWh * cfg.battery.minimumReserveFraction;
  const result = stepEnergy({
    env,
    minute: 600,
    devices,
    batteryEnergyKWh: reserve,
    durationHours: 0.25,
    gridAvailable: false,
  });
  assert.equal(result.balance.gridImportKW, 0);
  assert.equal(result.balance.batteryDischargeKW, 0);
  assert.ok(result.balance.unservedLoadKW > 0);
});

test("solar is deterministic and follows the daylight curve", () => {
  assert.equal(solarOutput("School Campus", 120), 0);
  assert.equal(solarOutput("School Campus", 1200), 0);
  assert.ok(
    solarOutput("School Campus", 720) > solarOutput("School Campus", 480),
  );
  assert.equal(
    solarOutput("Factory", 720, 0.5),
    solarOutput("Factory", 720, 0.5),
  );
});

test("presets change inventory, critical loads, capacity, and schedules", () => {
  const hospital = createDevices("Hospital", 120),
    home = createDevices("Smart Home", 120);
  assert.notEqual(hospital.length, home.length);
  assert.notEqual(
    hospital.filter((d) => d.critical).length,
    home.filter((d) => d.critical).length,
  );
  assert.notEqual(config("Hospital").capacity, config("Smart Home").capacity);
  assert.ok(
    facilityDemand(createDevices("School Campus", 600)) >
      facilityDemand(createDevices("School Campus", 120)),
  );
  assert.ok(
    facilityDemand(createDevices("Factory", 600)) >
      facilityDemand(createDevices("Factory", 120)),
  );
});

test("scenarios modify the same device state consumed by the balance", () => {
  const env = "School Campus",
    base = createDevices(env, 540),
    scenario = trigger(base, "hvac", env);
  assert.ok(facilityDemand(scenario) > facilityDemand(base));
  const result = stepEnergy({
    env,
    minute: 540,
    devices: scenario,
    batteryEnergyKWh: config(env).battery.capacityKWh * 0.74,
    durationHours: 0.1,
  });
  close(result.balance.facilityDemandKW, facilityDemand(scenario));
  assert.ok(scenario.find((d) => d.id === "hvac")!.anomaly > 50);
});

test("capacity and outage scenarios never increase critical device demand", () => {
  const base = createDevices("Hospital", 540);
  for (const id of ["capacity", "outage"] as const) {
    const changed = trigger(base, id, "Hospital");
    for (const device of changed.filter((d) => d.critical))
      close(device.power, base.find((d) => d.id === device.id)!.power);
  }
});

test("EV surge demo is reproducible from reset through mitigation and savings", () => {
  const env = "School Campus",
    minute = 548,
    cfg = config(env),
    resetA = createDevices(env, minute),
    resetB = createDevices(env, minute);
  assert.deepEqual(
    resetA,
    resetB,
    "reset must reproduce identical device state",
  );
  const batteryEnergy =
    cfg.battery.capacityKWh * cfg.battery.initialSoCFraction;
  const normal = stepEnergy({
    env,
    minute,
    devices: resetA,
    batteryEnergyKWh: batteryEnergy,
    durationHours: 0,
  });
  assert.ok(
    normal.balance.facilityDemandKW / cfg.capacity < 0.8,
    "normal facility load must be healthy",
  );
  const surged = trigger(resetA, "ev", env),
    surgeBalance = stepEnergy({
      env,
      minute,
      devices: surged,
      batteryEnergyKWh: batteryEnergy,
      durationHours: 0,
    });
  const normalEv = resetA.find((d) => d.id === "ev")!,
    surgedEv = surged.find((d) => d.id === "ev")!;
  assert.ok(surgedEv.power > normalEv.power, "EV power must visibly increase");
  assert.ok(
    surgeBalance.balance.facilityDemandKW > normal.balance.facilityDemandKW,
    "facility demand must increase",
  );
  assert.ok(
    surgeBalance.balance.facilityDemandKW / cfg.capacity >= 0.9,
    "surge must approach the critical band",
  );
  assert.equal(surgedEv.status, "Critical");
  assert.ok(surgedEv.anomaly >= 90);
  const forecast = makeHistory(env, minute, surged, "ev");
  assert.ok(forecast.at(-1)!.forecast > forecast[17].load);
  assert.ok(forecast.at(-1)!.forecast / cfg.capacity > 0.95);
  const recommendation = recommendationFor(surged, "ev");
  assert.ok(recommendation);
  assert.equal(recommendation.deviceId, "ev");
  assert.equal(recommendation.action, "throttle");
  assert.ok(recommendation.expectedReductionKW > 0);
  const mitigated = applyRecommendation(surged, recommendation),
    mitigatedBalance = stepEnergy({
      env,
      minute,
      devices: mitigated,
      batteryEnergyKWh: batteryEnergy,
      durationHours: 0,
    });
  close(
    facilityDemand(surged) - facilityDemand(mitigated),
    recommendation.expectedReductionKW,
  );
  assert.ok(
    mitigatedBalance.balance.facilityDemandKW <
      surgeBalance.balance.facilityDemandKW,
  );
  assert.ok(
    mitigatedBalance.balance.facilityDemandKW / cfg.capacity < 0.82,
    "mitigation must return the site below warning",
  );
  assert.ok(
    mitigatedBalance.balance.gridImportKW < surgeBalance.balance.gridImportKW,
  );
  const elapsedHours = 0.5,
    avoidedEnergy = recommendation.expectedReductionKW * elapsedHours;
  close(avoidedEnergy, recommendation.expectedReductionKW * 0.5);
  close(
    avoidedEnergy * tariffRate(cfg.tariff, minute),
    recommendation.expectedReductionKW * 0.5 * tariffRate(cfg.tariff, minute),
  );
});

test("Hospital outage preserves critical services and activates backup resources", () => {
  const env = "Hospital",
    minute = 548,
    cfg = config(env),
    normal = createDevices(env, minute),
    outage = trigger(normal, "outage", env),
    batteryEnergy = cfg.battery.capacityKWh * cfg.battery.initialSoCFraction;
  const critical = outage.filter((d) => d.critical),
    noncritical = outage.filter((d) => !d.critical);
  assert.ok(critical.length >= 5);
  assert.ok(noncritical.length >= 2);
  for (const device of critical)
    close(device.power, normal.find((d) => d.id === device.id)!.power);
  for (const device of noncritical)
    assert.ok(device.power < normal.find((d) => d.id === device.id)!.power);
  const result = stepEnergy({
    env,
    minute,
    devices: outage,
    batteryEnergyKWh: batteryEnergy,
    durationHours: 0,
    gridAvailable: false,
  });
  assert.equal(result.balance.gridImportKW, 0);
  assert.ok(result.balance.backupGenerationKW > 0);
  assert.ok(result.balance.batteryDischargeKW > 0);
  assert.equal(result.balance.unservedLoadKW, 0);
  const duration =
    ((batteryEnergy -
      cfg.battery.capacityKWh * cfg.battery.minimumReserveFraction) *
      cfg.battery.dischargeEfficiency) /
    result.balance.batteryDischargeKW;
  assert.ok(duration > 0);
  const recommendation = recommendationFor(outage, "outage");
  assert.ok(recommendation);
  assert.equal(
    outage.find((d) => d.id === recommendation.deviceId)!.critical,
    false,
  );
});

test("business logic rejects a forged attempt to shed a critical device", () => {
  const devices = createDevices("Hospital", 548),
    critical = devices.find((d) => d.critical)!;
  const forged = {
    deviceId: critical.id,
    deviceName: critical.name,
    action: "delay" as const,
    reductionFraction: 1,
    expectedReductionKW: critical.power,
    beforePowerKW: critical.power,
    afterPowerKW: 0,
  };
  const result = applyRecommendation(devices, forged);
  assert.equal(
    result,
    devices,
    "critical safety rejection should leave state unchanged",
  );
  close(result.find((d) => d.id === critical.id)!.power, critical.power);
});

test("normal telemetry fluctuations are ignored", () => {
  const expected = 100,
    telemetry = [100, 101, 99.5, 100.8, 98.9, 101.1, 100.2, 99.7, 101.2, 100.4];
  const result = detectAnomaly(telemetry, expected);
  assert.equal(result.severity, "Normal");
  assert.ok(result.score < 30);
});

test("moderate baseline deviation is classified from measured telemetry", () => {
  const expected = 100,
    telemetry = [100, 101, 99, 100.5, 99.5, 100.2, 99.8, 100.4, 100, 125];
  const result = detectAnomaly(telemetry, expected);
  assert.equal(result.severity, "Unusual");
  close(result.deviationPercent, 25);
  assert.ok(result.zScore > 3);
});

test("severe sudden spike is classified critical", () => {
  const expected = 100,
    telemetry = [100, 101, 99, 100, 101, 99, 100, 100.5, 99.5, 180];
  const result = detectAnomaly(telemetry, expected);
  assert.equal(result.severity, "Critical");
  close(result.deviationPercent, 80);
  assert.ok(result.score >= 85);
  assert.match(result.reason, /above baseline/);
});

test("gradual degradation is eventually detected despite a smooth ramp", () => {
  const expected = 100,
    telemetry = Array.from(
      { length: 16 },
      (_, i) => expected * (1 + (0.38 * i) / 15),
    );
  const result = detectAnomaly(telemetry, expected);
  assert.notEqual(result.severity, "Normal");
  assert.ok(result.deviationPercent >= 37);
  assert.ok(result.rateOfChangePercent > 0);
});

test("stable recent demand produces a stable short-term forecast", () => {
  const recent = [100, 100.5, 99.5, 100.2, 99.8, 100];
  for (const horizon of [15, 30, 60]) {
    const result = forecastValue(recent, horizon, 100, 100);
    assert.ok(Math.abs(result.forecastKW - 100) < 1);
    assert.ok(Math.abs(result.trendKWPerMinute) < 0.05);
  }
});

test("rising demand forecasts higher future demand", () => {
  const recent = [75, 80, 85, 90, 95, 100];
  const f15 = forecastValue(recent, 15, 100, 100),
    f60 = forecastValue(recent, 60, 100, 100);
  assert.ok(f15.forecastKW > 100);
  assert.ok(f60.forecastKW > f15.forecastKW);
  assert.ok(f15.trendKWPerMinute > 0);
});

test("falling demand forecasts movement away from capacity", () => {
  const recent = [125, 120, 115, 110, 105, 100];
  const result = forecastValue(recent, 30, 100, 100);
  assert.ok(result.forecastKW < 100);
  assert.ok(result.trendKWPerMinute < 0);
});

test("imminent overload produces a measured high risk condition", () => {
  const env = "School Campus",
    minute = 548,
    surged = trigger(createDevices(env, minute), "ev", env),
    result = demandForecast(env, minute, surged, "ev");
  assert.ok(result.peakKW >= config(env).capacity * 0.9);
  assert.ok(result.riskScore >= 50);
  assert.notEqual(result.condition, "Available");
  assert.equal(result.direction, "toward");
});

test("state-derived EV recommendation measurably lowers demand, utilization, and forecast", () => {
  const env = "School Campus",
    minute = 548,
    cfg = config(env),
    surged = trigger(createDevices(env, minute), "ev", env),
    batteryEnergyKWh = cfg.battery.capacityKWh * cfg.battery.initialSoCFraction;
  const beforeDemand = facilityDemand(surged),
    beforeForecast = demandForecast(env, minute, surged, "ev"),
    recommendations = recommendationsFor({
      env,
      minute,
      devices: surged,
      incident: "ev",
      batteryEnergyKWh,
    });
  const recommendation = recommendations[0];
  assert.equal(recommendation.action, "throttle");
  assert.equal(recommendation.deviceId, "ev");
  assert.match(recommendation.reason, /baseline/);
  const applied = applyRecommendationState(
    surged,
    batteryEnergyKWh,
    recommendation,
    env,
  );
  assert.equal(applied.applied, true);
  close(
    beforeDemand - facilityDemand(applied.devices),
    recommendation.expectedDemandReductionKW,
  );
  assert.ok(
    facilityDemand(applied.devices) / cfg.capacity <
      beforeDemand / cfg.capacity,
  );
  assert.ok(
    demandForecast(env, minute, applied.devices, "ev").peakKW <
      beforeForecast.peakKW,
  );
});

test("applied actions disappear and remaining recommendations are recalculated without conflicts", () => {
  const env = "School Campus",
    minute = 548,
    cfg = config(env),
    devices = trigger(createDevices(env, minute), "capacity", env),
    batteryEnergyKWh = cfg.battery.capacityKWh * cfg.battery.initialSoCFraction;
  const first = recommendationsFor({
    env,
    minute,
    devices,
    incident: "capacity",
    batteryEnergyKWh,
  })[0];
  const applied = applyRecommendationState(
    devices,
    batteryEnergyKWh,
    first,
    env,
  );
  const remaining = recommendationsFor({
    env,
    minute,
    devices: applied.devices,
    incident: "capacity",
    batteryEnergyKWh,
    appliedRecommendationIds: [first.id],
  });
  assert.ok(remaining.every((item) => item.id !== first.id));
  assert.equal(
    new Set(remaining.map((item) => item.deviceId)).size,
    remaining.length,
  );
  assert.ok(
    remaining.every(
      (item) =>
        !applied.devices.find((device) => device.id === item.deviceId)
          ?.critical,
    ),
  );
});

test("battery recommendation respects reserve and discharge-rate limits and lowers grid import", () => {
  const env = "School Campus",
    minute = 548,
    cfg = config(env),
    devices = createDevices(env, minute),
    batteryEnergyKWh = cfg.battery.capacityKWh * cfg.battery.initialSoCFraction;
  const recommendation = recommendationsFor({
    env,
    minute,
    devices,
    incident: "solar",
    batteryEnergyKWh,
  }).find((item) => item.action === "discharge_battery");
  assert.ok(recommendation);
  assert.equal(recommendation.expectedDemandReductionKW, 0);
  assert.ok(
    recommendation.expectedGridReductionKW <= cfg.battery.maxDischargeKW,
  );
  const applied = applyRecommendationState(
    devices,
    batteryEnergyKWh,
    recommendation,
    env,
  );
  assert.equal(applied.forcePeakShaving, true);
  const before = stepEnergy({
    env,
    minute,
    devices,
    batteryEnergyKWh,
    durationHours: 0.25,
    cloudFactor: 0.22,
  });
  const after = stepEnergy({
    env,
    minute,
    devices,
    batteryEnergyKWh,
    durationHours: 0.25,
    cloudFactor: 0.22,
    forcePeakShaving: true,
  });
  assert.ok(after.balance.gridImportKW < before.balance.gridImportKW);
  assert.ok(
    after.batteryEnergyKWh >=
      cfg.battery.capacityKWh * cfg.battery.minimumReserveFraction,
  );
});

test("forecast chart telemetry remains bounded across time, environments, and scenarios", () => {
  for (const env of [
    "School Campus",
    "Hospital",
    "Smart Home",
    "Factory",
  ] as Environment[]) {
    for (const minute of [0, 360, 720, 1080, 1439]) {
      const normal = createDevices(env, minute);
      assert.equal(
        demandForecast(env, minute, normal, null).points.length,
        FORECAST_POINT_LIMIT,
      );
      const surged = trigger(normal, "capacity", env);
      assert.equal(
        demandForecast(env, minute, surged, "capacity").points.length,
        FORECAST_POINT_LIMIT,
      );
    }
  }
});

test("every scenario transition is deterministic from the same reset state", () => {
  const environments: Environment[] = [
      "School Campus",
      "Hospital",
      "Smart Home",
      "Factory",
    ],
    scenarios = ["ev", "hvac", "solar", "degradation", "capacity", "outage"] as const;
  for (const environment of environments) {
    const firstReset = createDevices(environment, 548),
      secondReset = createDevices(environment, 548);
    assert.deepEqual(firstReset, secondReset, `${environment} reset drifted`);
    for (const scenario of scenarios) {
      assert.deepEqual(
        trigger(firstReset, scenario, environment),
        trigger(secondReset, scenario, environment),
        `${environment}/${scenario} was not reproducible`,
      );
    }
  }
});

test("solar-drop scenario changes the real power balance without changing demand", () => {
  const env: Environment = "School Campus",
    minute = 720,
    devices = createDevices(env, minute),
    batteryEnergyKWh = config(env).battery.capacityKWh;
  const normal = stepEnergy({
      env,
      minute,
      devices,
      batteryEnergyKWh,
      durationHours: 0,
      cloudFactor: 0.92,
    }),
    solarDrop = stepEnergy({
      env,
      minute,
      devices,
      batteryEnergyKWh,
      durationHours: 0,
      cloudFactor: 0.22,
    });
  close(solarDrop.balance.facilityDemandKW, normal.balance.facilityDemandKW);
  assert.ok(solarDrop.balance.solarGenerationKW < normal.balance.solarGenerationKW);
  assert.ok(solarDrop.balance.gridImportKW > normal.balance.gridImportKW);
});
