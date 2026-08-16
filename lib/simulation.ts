export type Environment =
  "School Campus" | "Hospital" | "Smart Home" | "Factory";
export type ScenarioId =
  "hvac" | "ev" | "solar" | "degradation" | "capacity" | "outage";
export type AnomalySeverity = "Normal" | "Unusual" | "High" | "Critical";
export type AnomalyAnalysis = {
  expectedKW: number;
  observedKW: number;
  rollingMeanKW: number;
  rollingStdDevKW: number;
  zScore: number;
  deviationPercent: number;
  rateOfChangePercent: number;
  score: number;
  severity: AnomalySeverity;
  reason: string;
};
export type Device = {
  id: string;
  name: string;
  zone: string;
  category: string;
  base: number;
  power: number;
  expectedPower: number;
  health: number;
  efficiency: number;
  critical: boolean;
  priority: "Essential" | "High" | "Flexible";
  anomaly: number;
  anomalySeverity: AnomalySeverity;
  anomalyReason: string;
  deviationPercent: number;
  zScore: number;
  rateOfChangePercent: number;
  status: "Normal" | "Warning" | "Critical";
};
export type Point = {
  time: string;
  load: number;
  forecast: number;
  capacity: number;
};
export type BatteryConfig = {
  capacityKWh: number;
  minimumReserveFraction: number;
  maxChargeKW: number;
  maxDischargeKW: number;
  chargeEfficiency: number;
  dischargeEfficiency: number;
  initialSoCFraction: number;
};
export type Tariff = {
  basePerKWh: number;
  peakPerKWh: number;
  peakStartHour: number;
  peakEndHour: number;
};
export type EnvironmentConfig = {
  capacity: number;
  solar: number;
  emergencyBackupKW: number;
  battery: BatteryConfig;
  tariff: Tariff;
  emissionsKgPerGridKWh: number;
  devices: Omit<
    Device,
    | "power"
    | "expectedPower"
    | "anomaly"
    | "anomalySeverity"
    | "anomalyReason"
    | "deviationPercent"
    | "zScore"
    | "rateOfChangePercent"
    | "status"
  >[];
};
export type EnergyTotals = {
  facilityKWh: number;
  gridImportKWh: number;
  solarGeneratedKWh: number;
  solarUsedKWh: number;
  batteryChargeKWh: number;
  batteryDischargeKWh: number;
  backupGeneratedKWh: number;
  curtailedSolarKWh: number;
  unservedKWh: number;
  cost: number;
  emissionsKg: number;
};
export type PowerBalance = {
  facilityDemandKW: number;
  solarGenerationKW: number;
  solarToFacilityKW: number;
  batteryChargeKW: number;
  batteryDischargeKW: number;
  backupGenerationKW: number;
  gridImportKW: number;
  curtailedSolarKW: number;
  unservedLoadKW: number;
};
export type StepResult = {
  balance: PowerBalance;
  batteryEnergyKWh: number;
  batterySoCFraction: number;
  totals: EnergyTotals;
};
export type RecommendationAction =
  | "throttle"
  | "delay"
  | "discharge_battery"
  | "reduce_hvac"
  | "isolate"
  | "shift";
export type Recommendation = {
  id: string;
  deviceId: string;
  deviceName: string;
  action: RecommendationAction;
  actionLabel: string;
  reason: string;
  expectedImpact: string;
  priority: "Low" | "Medium" | "High" | "Critical";
  riskScore: number;
  reductionFraction: number;
  expectedReductionKW: number;
  expectedDemandReductionKW: number;
  expectedGridReductionKW: number;
  beforePowerKW: number;
  afterPowerKW: number;
};
export type RecommendationContext = {
  env: Environment;
  minute: number;
  devices: Device[];
  incident: ScenarioId | null;
  batteryEnergyKWh: number;
  appliedRecommendationIds?: string[];
};
export type RecommendationState = {
  devices: Device[];
  batteryEnergyKWh: number;
  forcePeakShaving: boolean;
  applied: boolean;
};
export type DemandForecast = {
  currentKW: number;
  at15KW: number;
  at30KW: number;
  at60KW: number;
  peakKW: number;
  trendKWPerMinute: number;
  riskScore: number;
  condition: "Available" | "Warning" | "Overload";
  direction: "toward" | "away" | "stable";
  points: Point[];
};
export const TELEMETRY_WINDOW_SAMPLES = 12;
export const FORECAST_HISTORY_SAMPLES = 18;
export const FORECAST_FUTURE_SAMPLES = 12;
export const FORECAST_POINT_LIMIT =
  FORECAST_HISTORY_SAMPLES + FORECAST_FUTURE_SAMPLES;

const battery = (capacityKWh: number): BatteryConfig => ({
  capacityKWh,
  minimumReserveFraction: 0.15,
  maxChargeKW: capacityKWh * 0.25,
  maxDischargeKW: capacityKWh * 0.3,
  chargeEfficiency: 0.94,
  dischargeEfficiency: 0.92,
  initialSoCFraction: 0.74,
});
const tariff: Tariff = {
  basePerKWh: 0.18,
  peakPerKWh: 0.27,
  peakStartHour: 16,
  peakEndHour: 21,
};
const common = (capacity: number, solar: number, batteryKWh: number) => ({
  capacity,
  solar,
  emergencyBackupKW: 0,
  battery: battery(batteryKWh),
  tariff,
  emissionsKgPerGridKWh: 0.42,
});

const catalog: Record<Environment, EnvironmentConfig> = {
  "School Campus": {
    ...common(500, 145, 260),
    devices: [
      {
        id: "hvac",
        name: "Central HVAC",
        zone: "Mechanical",
        category: "Climate",
        base: 105,
        health: 94,
        efficiency: 91,
        critical: false,
        priority: "High",
      },
      {
        id: "ev",
        name: "Campus EV Chargers",
        zone: "Mobility Hub",
        category: "Transport",
        base: 16,
        health: 98,
        efficiency: 94,
        critical: false,
        priority: "Flexible",
      },
      {
        id: "class",
        name: "Classroom Lighting",
        zone: "Academic Wing",
        category: "Lighting",
        base: 54,
        health: 98,
        efficiency: 95,
        critical: false,
        priority: "Flexible",
      },
      {
        id: "computers",
        name: "Computer Lab",
        zone: "Technology",
        category: "IT",
        base: 48,
        health: 96,
        efficiency: 93,
        critical: false,
        priority: "Flexible",
      },
      {
        id: "science",
        name: "Science Lab",
        zone: "Laboratories",
        category: "Equipment",
        base: 58,
        health: 92,
        efficiency: 89,
        critical: false,
        priority: "High",
      },
      {
        id: "server",
        name: "Server & Network",
        zone: "Data Room",
        category: "IT",
        base: 36,
        health: 97,
        efficiency: 94,
        critical: true,
        priority: "Essential",
      },
      {
        id: "cafe",
        name: "Cafeteria",
        zone: "Commons",
        category: "Appliances",
        base: 44,
        health: 90,
        efficiency: 88,
        critical: false,
        priority: "Flexible",
      },
      {
        id: "safety",
        name: "Safety Systems",
        zone: "Campus-wide",
        category: "Safety",
        base: 18,
        health: 99,
        efficiency: 97,
        critical: true,
        priority: "Essential",
      },
    ],
  },
  Hospital: {
    ...common(850, 190, 520),
    emergencyBackupKW: 320,
    battery: { ...battery(520), maxDischargeKW: 280 },
    devices: [
      {
        id: "emergency",
        name: "Emergency & Trauma Systems",
        zone: "Emergency Department",
        category: "Medical",
        base: 92,
        health: 99,
        efficiency: 96,
        critical: true,
        priority: "Essential",
      },
      {
        id: "icu",
        name: "ICU Life Support",
        zone: "Critical Care",
        category: "Medical",
        base: 132,
        health: 99,
        efficiency: 96,
        critical: true,
        priority: "Essential",
      },
      {
        id: "refrig",
        name: "Medical Refrigeration",
        zone: "Pharmacy",
        category: "Cooling",
        base: 55,
        health: 96,
        efficiency: 93,
        critical: true,
        priority: "Essential",
      },
      {
        id: "essential-light",
        name: "Essential Clinical Lighting",
        zone: "Clinical Areas",
        category: "Lighting",
        base: 38,
        health: 99,
        efficiency: 97,
        critical: true,
        priority: "Essential",
      },
      {
        id: "comms",
        name: "Communications & Safety",
        zone: "Command Center",
        category: "Safety",
        base: 34,
        health: 99,
        efficiency: 96,
        critical: true,
        priority: "Essential",
      },
      {
        id: "hvac",
        name: "Sterile HVAC",
        zone: "Mechanical",
        category: "Climate",
        base: 126,
        health: 94,
        efficiency: 91,
        critical: true,
        priority: "Essential",
      },
      {
        id: "rooms",
        name: "Patient Room Essentials",
        zone: "Inpatient",
        category: "General",
        base: 68,
        health: 97,
        efficiency: 94,
        critical: true,
        priority: "High",
      },
      {
        id: "imaging",
        name: "Elective Imaging Systems",
        zone: "Radiology",
        category: "Medical",
        base: 104,
        health: 95,
        efficiency: 90,
        critical: false,
        priority: "High",
      },
      {
        id: "public-light",
        name: "Public Area Lighting",
        zone: "Public Areas",
        category: "Lighting",
        base: 54,
        health: 95,
        efficiency: 94,
        critical: false,
        priority: "Flexible",
      },
      {
        id: "admin",
        name: "Admin & Amenities",
        zone: "Administration",
        category: "General",
        base: 64,
        health: 91,
        efficiency: 87,
        critical: false,
        priority: "Flexible",
      },
    ],
  },
  "Smart Home": {
    ...common(30, 9, 18),
    devices: [
      {
        id: "hvac",
        name: "Heat Pump",
        zone: "Whole Home",
        category: "Climate",
        base: 6.8,
        health: 94,
        efficiency: 92,
        critical: false,
        priority: "High",
      },
      {
        id: "ev",
        name: "EV Charger",
        zone: "Garage",
        category: "Transport",
        base: 7.2,
        health: 98,
        efficiency: 94,
        critical: false,
        priority: "Flexible",
      },
      {
        id: "refrig",
        name: "Refrigerator",
        zone: "Kitchen",
        category: "Cooling",
        base: 1.2,
        health: 96,
        efficiency: 93,
        critical: true,
        priority: "Essential",
      },
      {
        id: "water",
        name: "Water Heater",
        zone: "Utility",
        category: "Heating",
        base: 4.5,
        health: 91,
        efficiency: 88,
        critical: false,
        priority: "Flexible",
      },
      {
        id: "lights",
        name: "Lighting",
        zone: "Living Areas",
        category: "Lighting",
        base: 1.8,
        health: 99,
        efficiency: 96,
        critical: false,
        priority: "Flexible",
      },
    ],
  },
  Factory: {
    ...common(1250, 280, 640),
    devices: [
      {
        id: "line1",
        name: "Production Line A",
        zone: "Production",
        category: "Machinery",
        base: 265,
        health: 93,
        efficiency: 89,
        critical: true,
        priority: "Essential",
      },
      {
        id: "motors",
        name: "Industrial Motors",
        zone: "Assembly",
        category: "Machinery",
        base: 210,
        health: 88,
        efficiency: 84,
        critical: false,
        priority: "High",
      },
      {
        id: "compress",
        name: "Air Compressors",
        zone: "Utilities",
        category: "Machinery",
        base: 142,
        health: 91,
        efficiency: 86,
        critical: false,
        priority: "High",
      },
      {
        id: "hvac",
        name: "Process HVAC",
        zone: "Mechanical",
        category: "Climate",
        base: 118,
        health: 94,
        efficiency: 91,
        critical: false,
        priority: "Flexible",
      },
      {
        id: "warehouse",
        name: "Warehouse",
        zone: "Logistics",
        category: "General",
        base: 82,
        health: 96,
        efficiency: 93,
        critical: false,
        priority: "Flexible",
      },
      {
        id: "safety",
        name: "Safety Controls",
        zone: "Plant-wide",
        category: "Safety",
        base: 44,
        health: 99,
        efficiency: 97,
        critical: true,
        priority: "Essential",
      },
    ],
  },
};

export const emptyTotals = (): EnergyTotals => ({
  facilityKWh: 0,
  gridImportKWh: 0,
  solarGeneratedKWh: 0,
  solarUsedKWh: 0,
  batteryChargeKWh: 0,
  batteryDischargeKWh: 0,
  backupGeneratedKWh: 0,
  curtailedSolarKWh: 0,
  unservedKWh: 0,
  cost: 0,
  emissionsKg: 0,
});
export const config = (env: Environment) => catalog[env];
export const facilityDemand = (devices: Device[]) =>
  devices.reduce((sum, device) => sum + device.power, 0);
export const tariffRate = (tariffConfig: Tariff, minute: number) => {
  const hour = (minute / 60) % 24;
  return hour >= tariffConfig.peakStartHour && hour < tariffConfig.peakEndHour
    ? tariffConfig.peakPerKWh
    : tariffConfig.basePerKWh;
};

export function detectAnomaly(
  telemetry: number[],
  expectedKW: number,
): AnomalyAnalysis {
  const safeExpected = Math.max(0.01, expectedKW),
    observedKW = telemetry.at(-1) ?? safeExpected,
    prior = telemetry.slice(Math.max(0, telemetry.length - 9), -1),
    reference = prior.length ? prior : [safeExpected];
  const rollingMeanKW =
      reference.reduce((sum, value) => sum + value, 0) / reference.length,
    variance =
      reference.reduce((sum, value) => sum + (value - rollingMeanKW) ** 2, 0) /
      reference.length,
    rollingStdDevKW = Math.max(Math.sqrt(variance), safeExpected * 0.015);
  const zScore = (observedKW - rollingMeanKW) / rollingStdDevKW,
    deviationPercent = ((observedKW - safeExpected) / safeExpected) * 100,
    lookback = telemetry[Math.max(0, telemetry.length - 5)] ?? safeExpected,
    rateOfChangePercent = ((observedKW - lookback) / safeExpected) * 100,
    totalTrendPercent =
      ((observedKW - (telemetry[0] ?? safeExpected)) / safeExpected) * 100;
  const score = Math.min(
    100,
    Math.max(
      Math.abs(deviationPercent) * 1.4,
      Math.min(30, Math.abs(zScore) * 4),
      Math.abs(rateOfChangePercent) * 1.6,
      Math.abs(totalTrendPercent) * 1.2,
    ),
  );
  const severity: AnomalySeverity =
    score >= 85
      ? "Critical"
      : score >= 60
        ? "High"
        : score >= 30
          ? "Unusual"
          : "Normal";
  const direction = deviationPercent >= 0 ? "above" : "below",
    reason =
      severity === "Normal"
        ? `Observed demand remains within expected variation (${Math.abs(deviationPercent).toFixed(1)}%).`
        : `Observed demand is ${Math.abs(deviationPercent).toFixed(1)}% ${direction} baseline; Z-score ${zScore.toFixed(1)} and recent change ${rateOfChangePercent >= 0 ? "+" : ""}${rateOfChangePercent.toFixed(1)}%.`;
  return {
    expectedKW: safeExpected,
    observedKW,
    rollingMeanKW,
    rollingStdDevKW,
    zScore,
    deviationPercent,
    rateOfChangePercent,
    score,
    severity,
    reason,
  };
}

function normalTelemetry(expectedKW: number, phase = 0) {
  return Array.from(
    { length: TELEMETRY_WINDOW_SAMPLES - 1 },
    (_, i) => expectedKW * (1 + Math.sin(i * 0.91 + phase) * 0.012),
  );
}
function analyzedDevice(
  device: Omit<
    Device,
    | "power"
    | "expectedPower"
    | "anomaly"
    | "anomalySeverity"
    | "anomalyReason"
    | "deviationPercent"
    | "zScore"
    | "rateOfChangePercent"
    | "status"
  >,
  expectedPower: number,
  power: number,
  telemetry: number[],
): Device {
  const analysis = detectAnomaly(telemetry, expectedPower);
  return {
    ...device,
    power,
    expectedPower,
    anomaly: analysis.score,
    anomalySeverity: analysis.severity,
    anomalyReason: analysis.reason,
    deviationPercent: analysis.deviationPercent,
    zScore: analysis.zScore,
    rateOfChangePercent: analysis.rateOfChangePercent,
    status:
      analysis.severity === "Critical"
        ? "Critical"
        : analysis.severity === "Normal"
          ? "Normal"
          : "Warning",
  };
}

function usageFactor(env: Environment, hour: number) {
  if (env === "Hospital") return 0.94 + 0.035 * Math.sin((hour * Math.PI) / 6);
  if (env === "School Campus")
    return hour >= 8 && hour < 16 ? 1 : hour >= 7 && hour < 18 ? 0.62 : 0.3;
  if (env === "Factory")
    return hour >= 7 && hour < 15 ? 1 : hour >= 15 && hour < 23 ? 0.78 : 0.38;
  const morning = hour >= 6 && hour < 9,
    evening = hour >= 17 && hour < 23,
    overnight = hour < 6;
  return evening ? 1.08 : morning ? 0.9 : overnight ? 0.58 : 0.68;
}

export function createDevices(env: Environment, minute = 540): Device[] {
  const hour = (minute / 60) % 24;
  const factor = usageFactor(env, hour);
  return catalog[env].devices.map((d, i) => {
    let deviceFactor = factor;
    if (env === "Smart Home" && d.id === "ev")
      deviceFactor = hour < 6 ? 0.95 : 0.12;
    if (d.critical) deviceFactor = Math.max(deviceFactor, 0.82);
    const expectedPower = d.base * deviceFactor,
      wave = 1 + Math.sin((minute + i * 17) / 19) * 0.025,
      power = expectedPower * wave;
    return analyzedDevice(d, expectedPower, power, [
      ...normalTelemetry(expectedPower, i),
      power,
    ]);
  });
}

export function solarOutput(
  env: Environment,
  minute: number,
  cloudFactor = 0.92,
) {
  const hour = (minute / 60) % 24;
  if (hour <= 6 || hour >= 19) return 0;
  const boundedCloud = Math.max(0, Math.min(1, cloudFactor));
  return (
    catalog[env].solar * Math.sin((Math.PI * (hour - 6)) / 13) * boundedCloud
  );
}

export function stepEnergy(args: {
  env: Environment;
  minute: number;
  devices: Device[];
  batteryEnergyKWh: number;
  durationHours: number;
  previousTotals?: EnergyTotals;
  cloudFactor?: number;
  gridAvailable?: boolean;
  forcePeakShaving?: boolean;
}): StepResult {
  const cfg = catalog[args.env],
    dt = Math.max(0, args.durationHours),
    demand = facilityDemand(args.devices),
    solar = solarOutput(args.env, args.minute, args.cloudFactor ?? 0.92),
    gridAvailable = args.gridAvailable ?? true;
  const solarToFacility = Math.min(demand, solar),
    surplus = Math.max(0, solar - solarToFacility),
    netLoad = Math.max(0, demand - solarToFacility),
    backupGenerationKW = gridAvailable
      ? 0
      : Math.min(netLoad, cfg.emergencyBackupKW),
    loadAfterBackup = Math.max(0, netLoad - backupGenerationKW),
    reserve = cfg.battery.capacityKWh * cfg.battery.minimumReserveFraction;
  const stored = Math.max(
    reserve,
    Math.min(cfg.battery.capacityKWh, args.batteryEnergyKWh),
  );
  const maxChargeBySpace =
    dt > 0
      ? (cfg.battery.capacityKWh - stored) / (cfg.battery.chargeEfficiency * dt)
      : cfg.battery.maxChargeKW;
  const maxDischargeByEnergy =
    dt > 0
      ? ((stored - reserve) * cfg.battery.dischargeEfficiency) / dt
      : cfg.battery.maxDischargeKW;
  let chargeKW = Math.min(
    surplus,
    cfg.battery.maxChargeKW,
    Math.max(0, maxChargeBySpace),
  );
  const shouldDischarge =
    !gridAvailable ||
    args.forcePeakShaving ||
    loadAfterBackup > cfg.capacity * 0.8;
  const dischargeKW = shouldDischarge
    ? Math.min(
        loadAfterBackup,
        cfg.battery.maxDischargeKW,
        Math.max(0, maxDischargeByEnergy),
      )
    : 0;
  if (!gridAvailable) chargeKW = 0;
  const gridImportKW = gridAvailable
    ? Math.max(0, loadAfterBackup - dischargeKW + chargeKW)
    : 0;
  const unservedLoadKW = gridAvailable
    ? 0
    : Math.max(0, loadAfterBackup - dischargeKW);
  const curtailedSolarKW = Math.max(0, surplus - chargeKW);
  const nextBattery = Math.max(
    reserve,
    Math.min(
      cfg.battery.capacityKWh,
      stored +
        chargeKW * cfg.battery.chargeEfficiency * dt -
        (dischargeKW / cfg.battery.dischargeEfficiency) * dt,
    ),
  );
  const prior = args.previousTotals ?? emptyTotals(),
    gridEnergy = gridImportKW * dt;
  const totals: EnergyTotals = {
    facilityKWh: prior.facilityKWh + demand * dt,
    gridImportKWh: prior.gridImportKWh + gridEnergy,
    solarGeneratedKWh: prior.solarGeneratedKWh + solar * dt,
    solarUsedKWh: prior.solarUsedKWh + solarToFacility * dt,
    batteryChargeKWh: prior.batteryChargeKWh + chargeKW * dt,
    batteryDischargeKWh: prior.batteryDischargeKWh + dischargeKW * dt,
    backupGeneratedKWh: prior.backupGeneratedKWh + backupGenerationKW * dt,
    curtailedSolarKWh: prior.curtailedSolarKWh + curtailedSolarKW * dt,
    unservedKWh: prior.unservedKWh + unservedLoadKW * dt,
    cost: prior.cost + gridEnergy * tariffRate(cfg.tariff, args.minute),
    emissionsKg: prior.emissionsKg + gridEnergy * cfg.emissionsKgPerGridKWh,
  };
  return {
    balance: {
      facilityDemandKW: demand,
      solarGenerationKW: solar,
      solarToFacilityKW: solarToFacility,
      batteryChargeKW: chargeKW,
      batteryDischargeKW: dischargeKW,
      backupGenerationKW,
      gridImportKW,
      curtailedSolarKW,
      unservedLoadKW,
    },
    batteryEnergyKWh: nextBattery,
    batterySoCFraction: nextBattery / cfg.battery.capacityKWh,
    totals,
  };
}

export function forecastValue(
  recentDemandKW: number[],
  horizonMinutes: number,
  baselineNowKW: number,
  baselineFutureKW: number,
  sampleMinutes = 5,
) {
  const values = recentDemandKW.slice(-6),
    weights = values.map((_, i) => i + 1),
    weightTotal = weights.reduce((sum, value) => sum + value, 0),
    weighted =
      values.reduce((sum, value, i) => sum + value * weights[i], 0) /
      weightTotal,
    current = values.at(-1) ?? baselineNowKW;
  const xMean = (values.length - 1) / 2,
    yMean = values.reduce((sum, value) => sum + value, 0) / values.length,
    numerator = values.reduce(
      (sum, value, i) => sum + (i - xMean) * (value - yMean),
      0,
    ),
    denominator = values.reduce((sum, _, i) => sum + (i - xMean) ** 2, 0) || 1,
    trendKWPerMinute = numerator / denominator / sampleMinutes;
  const damping =
      horizonMinutes <= 15 ? 0.75 : horizonMinutes <= 30 ? 0.6 : 0.4,
    anchored = current * 0.65 + weighted * 0.35,
    forecastKW = Math.max(
      0,
      anchored +
        trendKWPerMinute * horizonMinutes * damping +
        (baselineFutureKW - baselineNowKW),
    );
  return { forecastKW, trendKWPerMinute, weightedRecentKW: weighted };
}

export function demandForecast(
  env: Environment,
  minute: number,
  devices: Device[],
  _incident: ScenarioId | null,
): DemandForecast {
  const cfg = catalog[env],
    normalNow = facilityDemand(createDevices(env, minute)),
    currentKW = facilityDemand(devices),
    measuredEffect = currentKW - normalNow;
  const recent = Array.from({ length: FORECAST_HISTORY_SAMPLES }, (_, i) => {
    const delta = i - (FORECAST_HISTORY_SAMPLES - 1),
      expected = facilityDemand(createDevices(env, minute + delta * 5)),
      effectRamp = delta >= -4 ? Math.max(0, 1 + delta / 4) : 0;
    return expected + measuredEffect * effectRamp;
  });
  const baseline = (horizon: number) =>
      facilityDemand(createDevices(env, minute + horizon)),
    at = (horizon: number) =>
      forecastValue(recent, horizon, normalNow, baseline(horizon));
  const f15 = at(15),
    f30 = at(30),
    f60 = at(60),
    peakKW = Math.max(f15.forecastKW, f30.forecastKW, f60.forecastKW),
    maxRatio = peakKW / cfg.capacity,
    proximity = Math.max(0, Math.min(85, ((maxRatio - 0.75) / 0.25) * 85)),
    trendContribution = Math.max(
      0,
      Math.min(15, ((f15.trendKWPerMinute * 60) / cfg.capacity) * 100),
    ),
    riskScore = Math.max(0, Math.min(100, proximity + trendContribution)),
    condition =
      maxRatio >= 1 ? "Overload" : maxRatio >= 0.9 ? "Warning" : "Available",
    direction =
      f60.forecastKW > currentKW * 1.01
        ? "toward"
        : f60.forecastKW < currentKW * 0.99
          ? "away"
          : "stable";
  const pastPoints = recent.map((load, i) => ({
      time: new Date(
        2026,
        7,
        16,
        0,
        minute + (i - (FORECAST_HISTORY_SAMPLES - 1)) * 5,
      ).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
      load: +load.toFixed(1),
      forecast: +load.toFixed(1),
      capacity: cfg.capacity,
    })),
    futurePoints = Array.from({ length: FORECAST_FUTURE_SAMPLES }, (_, i) => {
      const horizon = (i + 1) * 5,
        result = at(horizon);
      return {
        time: new Date(2026, 7, 16, 0, minute + horizon).toLocaleTimeString(
          [],
          { hour: "2-digit", minute: "2-digit" },
        ),
        load: +result.forecastKW.toFixed(1),
        forecast: +result.forecastKW.toFixed(1),
        capacity: cfg.capacity,
      };
    });
  return {
    currentKW,
    at15KW: f15.forecastKW,
    at30KW: f30.forecastKW,
    at60KW: f60.forecastKW,
    peakKW,
    trendKWPerMinute: f15.trendKWPerMinute,
    riskScore,
    condition,
    direction,
    points: [...pastPoints, ...futurePoints],
  };
}
export function makeHistory(
  env: Environment,
  minute: number,
  devices: Device[],
  incident: ScenarioId | null,
): Point[] {
  return demandForecast(env, minute, devices, incident).points;
}
export function trigger(
  devices: Device[],
  id: ScenarioId,
  env: Environment,
): Device[] {
  return devices.map((d) => {
    let power = d.power;
    if (id === "ev" && d.id === "ev")
      power = Math.max(
        d.power * 6,
        catalog[env].capacity * (env === "Smart Home" ? 0.5 : 0.23),
      );
    if (id === "hvac" && d.id === "hvac") power = d.power * 1.72;
    if (id === "degradation" && (d.id === "motors" || d.id === "hvac"))
      power = d.expectedPower * 1.38;
    if (id === "capacity" && !d.critical) power = d.power * 1.5;
    if (id === "outage" && !d.critical) power = d.power * 0.2;
    const telemetry =
        id === "degradation" && power !== d.power
          ? Array.from(
              { length: 12 },
              (_, i) => d.expectedPower * (1 + (0.38 * i) / 11),
            )
          : [...normalTelemetry(d.expectedPower, d.id.length), power],
      analysis = detectAnomaly(telemetry, d.expectedPower);
    return {
      ...d,
      power,
      health: analysis.severity !== "Normal" ? d.health - 12 : d.health,
      anomaly: analysis.score,
      anomalySeverity: analysis.severity,
      anomalyReason: analysis.reason,
      deviationPercent: analysis.deviationPercent,
      zScore: analysis.zScore,
      rateOfChangePercent: analysis.rateOfChangePercent,
      status:
        analysis.severity === "Critical"
          ? "Critical"
          : analysis.severity === "Normal"
            ? "Normal"
            : "Warning",
    };
  });
}
function deviceRecommendation(
  device: Device,
  action: RecommendationAction,
  fraction: number,
  priority: Recommendation["priority"],
  riskScore: number,
  reason: string,
  impact: string,
): Recommendation {
  const boundedFraction = Math.max(0, Math.min(0.9, fraction)),
    floor =
      action === "isolate"
        ? 0
        : Math.min(device.power, device.expectedPower * 0.55),
    afterPowerKW = Math.max(floor, device.power * (1 - boundedFraction)),
    expectedReductionKW = Math.max(0, device.power - afterPowerKW);
  const labels: Record<RecommendationAction, string> = {
    throttle: "Throttle EV charging",
    delay: "Delay nonessential equipment",
    discharge_battery: "Discharge battery",
    reduce_hvac: "Reduce HVAC demand",
    isolate: "Isolate inefficient equipment",
    shift: "Shift discretionary load",
  };
  return {
    id: `${action}:${device.id}`,
    deviceId: device.id,
    deviceName: device.name,
    action,
    actionLabel: labels[action],
    reason,
    expectedImpact: impact,
    priority,
    riskScore,
    reductionFraction: device.power ? expectedReductionKW / device.power : 0,
    expectedReductionKW,
    expectedDemandReductionKW: expectedReductionKW,
    expectedGridReductionKW: expectedReductionKW,
    beforePowerKW: device.power,
    afterPowerKW,
  };
}

export function recommendationsFor(
  context: RecommendationContext,
): Recommendation[] {
  const { env, minute, devices, incident, batteryEnergyKWh } = context,
    cfg = catalog[env],
    applied = new Set(context.appliedRecommendationIds ?? []),
    demand = facilityDemand(devices),
    utilization = (demand / cfg.capacity) * 100,
    noncritical = devices.filter((d) => !d.critical && d.power > 0),
    recommendations: Recommendation[] = [];
  const add = (item: Recommendation | null) => {
    if (
      item &&
      item.expectedReductionKW > 0.05 &&
      !applied.has(item.id) &&
      !recommendations.some((existing) => existing.deviceId === item.deviceId)
    )
      recommendations.push(item);
  };
  const ev = noncritical.find((d) => d.id === "ev"),
    hvac = noncritical.find((d) => d.id === "hvac"),
    inefficient = [...noncritical]
      .filter(
        (d) =>
          d.efficiency < 90 ||
          d.anomalySeverity === "High" ||
          d.anomalySeverity === "Critical",
      )
      .sort((a, b) => b.anomaly - a.anomaly || a.efficiency - b.efficiency)[0],
    flexible = [...noncritical]
      .filter((d) => d.priority === "Flexible")
      .sort((a, b) => b.power - a.power)[0],
    largest = [...noncritical].sort((a, b) => b.power - a.power)[0];
  if (incident === "ev" && ev) {
    const projectedDemand =
      demand -
      Math.max(
        0,
        ev.power - Math.max(ev.expectedPower * 0.55, ev.power * 0.15),
      );
    add(
      deviceRecommendation(
        ev,
        "throttle",
        0.85,
        "Critical",
        Math.max(85, ev.anomaly),
        `EV demand is ${Math.max(0, ev.deviationPercent).toFixed(0)}% above its time-of-day baseline and site utilization is ${utilization.toFixed(1)}%.`,
        `Reduce facility and grid demand immediately; projected utilization falls to ${((projectedDemand / cfg.capacity) * 100).toFixed(1)}%.`,
      ),
    );
  }
  if ((incident === "hvac" || utilization >= 82) && hvac)
    add(
      deviceRecommendation(
        hvac,
        "reduce_hvac",
        incident === "hvac" ? 0.32 : 0.2,
        utilization >= 95 ? "Critical" : "High",
        Math.max(hvac.anomaly, Math.min(100, utilization)),
        `Noncritical HVAC is drawing ${hvac.power.toFixed(1)} kW while site utilization is ${utilization.toFixed(1)}%.`,
        `Temporarily relax temperature setpoints while keeping HVAC above its safe operating floor.`,
      ),
    );
  if ((incident === "degradation" || inefficient?.anomaly >= 60) && inefficient)
    add(
      deviceRecommendation(
        inefficient,
        "isolate",
        Math.min(0.55, Math.max(0.2, inefficient.deviationPercent / 100)),
        inefficient.anomaly >= 85 ? "Critical" : "High",
        inefficient.anomaly,
        `${inefficient.name} is operating at ${inefficient.efficiency}% efficiency with an anomaly score of ${inefficient.anomaly.toFixed(0)}/100.`,
        `Remove abnormal excess demand and route the equipment for inspection.`,
      ),
    );
  if ((incident === "outage" || incident === "capacity") && flexible)
    add(
      deviceRecommendation(
        flexible,
        incident === "outage" ? "delay" : "shift",
        incident === "outage" ? 0.65 : 0.35,
        incident === "outage" ? "Critical" : "High",
        incident === "outage" ? 100 : Math.min(100, utilization),
        incident === "outage"
          ? `Grid supply is unavailable; ${flexible.name} is noncritical and can be deferred without risking protected services.`
          : `Site utilization is ${utilization.toFixed(1)}%; ${flexible.name} is the largest available discretionary load.`,
        incident === "outage"
          ? "Extend backup duration while all critical devices remain untouched."
          : "Move flexible operation outside the current capacity event.",
      ),
    );
  const reserve = cfg.battery.capacityKWh * cfg.battery.minimumReserveFraction,
    availableKWh = Math.max(0, batteryEnergyKWh - reserve),
    availableBatteryKW = Math.min(
      cfg.battery.maxDischargeKW,
      (availableKWh * cfg.battery.dischargeEfficiency) / 0.25,
    );
  if (
    (incident === "solar" || utilization >= 90) &&
    incident !== "outage" &&
    availableBatteryKW > 0.05
  ) {
    const cloudFactor = incident === "solar" ? 0.22 : 0.92;
    const kw = Math.min(
      availableBatteryKW,
      Math.max(0, demand - solarOutput(env, minute, cloudFactor)),
    );
    if (kw > 0.05) {
      const item: Recommendation = {
        id: "discharge_battery:battery",
        deviceId: "battery",
        deviceName: `${env} battery`,
        action: "discharge_battery",
        actionLabel: "Discharge battery",
        reason: `Grid import is elevated while ${availableKWh.toFixed(1)} kWh remains above the protected reserve.`,
        expectedImpact: `Reduce grid import without changing facility equipment demand; reserve and discharge-rate limits remain enforced.`,
        priority: utilization >= 95 ? "Critical" : "High",
        riskScore: Math.min(100, Math.max(55, utilization)),
        reductionFraction: 0,
        expectedReductionKW: kw,
        expectedDemandReductionKW: 0,
        expectedGridReductionKW: kw,
        beforePowerKW: 0,
        afterPowerKW: kw,
      };
      if (!applied.has(item.id)) recommendations.push(item);
    }
  }
  if ((incident === "capacity" || utilization >= 90) && largest)
    add(
      deviceRecommendation(
        largest,
        "delay",
        0.25,
        utilization >= 100 ? "Critical" : "High",
        Math.min(100, utilization),
        `${largest.name} is a noncritical load contributing ${largest.power.toFixed(1)} kW during a capacity event.`,
        `Delay part of its operating cycle until feeder headroom recovers.`,
      ),
    );
  const cloudFactor = incident === "solar" ? 0.22 : 0.92;
  const beforeGrid = stepEnergy({
    env,
    minute,
    devices,
    batteryEnergyKWh,
    durationHours: 0.25,
    cloudFactor,
    gridAvailable: incident !== "outage",
  }).balance.gridImportKW;
  const measured = recommendations.map((item) => {
    if (item.action === "discharge_battery") return item;
    const hypothetical = devices.map((device) =>
      device.id === item.deviceId
        ? { ...device, power: item.afterPowerKW }
        : device,
    );
    const afterGrid = stepEnergy({
      env,
      minute,
      devices: hypothetical,
      batteryEnergyKWh,
      durationHours: 0.25,
      cloudFactor,
      gridAvailable: incident !== "outage",
    }).balance.gridImportKW;
    return {
      ...item,
      expectedGridReductionKW: Math.max(0, beforeGrid - afterGrid),
    };
  });
  const priorityRank = { Critical: 4, High: 3, Medium: 2, Low: 1 };
  return measured.sort(
    (a, b) =>
      priorityRank[b.priority] - priorityRank[a.priority] ||
      b.expectedReductionKW - a.expectedReductionKW,
  );
}

export function recommendationFor(
  devices: Device[],
  incident: ScenarioId | null,
  env: Environment = "School Campus",
  minute = 548,
  batteryEnergyKWh = catalog[env].battery.capacityKWh *
    catalog[env].battery.initialSoCFraction,
  appliedRecommendationIds: string[] = [],
): Recommendation | null {
  return (
    recommendationsFor({
      env,
      minute,
      devices,
      incident,
      batteryEnergyKWh,
      appliedRecommendationIds,
    })[0] ?? null
  );
}
export function applyRecommendationState(
  devices: Device[],
  batteryEnergyKWh: number,
  recommendation: Recommendation,
  env: Environment,
): RecommendationState {
  const cfg = catalog[env],
    reserve = cfg.battery.capacityKWh * cfg.battery.minimumReserveFraction;
  if (recommendation.action === "discharge_battery") {
    const availableKW = Math.min(
      cfg.battery.maxDischargeKW,
      (Math.max(0, batteryEnergyKWh - reserve) *
        cfg.battery.dischargeEfficiency) /
        0.25,
    );
    return {
      devices,
      batteryEnergyKWh,
      forcePeakShaving:
        availableKW > 0 &&
        recommendation.expectedGridReductionKW <= availableKW + 0.01,
      applied:
        availableKW > 0 &&
        recommendation.expectedGridReductionKW <= availableKW + 0.01,
    };
  }
  const target = devices.find((d) => d.id === recommendation.deviceId);
  if (
    !target ||
    target.critical ||
    recommendation.afterPowerKW < 0 ||
    recommendation.afterPowerKW > target.power + 0.01
  )
    return {
      devices,
      batteryEnergyKWh,
      forcePeakShaving: false,
      applied: false,
    };
  const next = devices.map((d) => {
    if (d.id !== recommendation.deviceId) return d;
    const power = Math.max(0, Math.min(d.power, recommendation.afterPowerKW)),
      analysis = detectAnomaly(
        [...normalTelemetry(d.expectedPower, d.id.length), power],
        d.expectedPower,
      );
    return {
      ...d,
      power,
      anomaly: analysis.score,
      anomalySeverity: analysis.severity,
      anomalyReason: analysis.reason,
      deviationPercent: analysis.deviationPercent,
      zScore: analysis.zScore,
      rateOfChangePercent: analysis.rateOfChangePercent,
      status:
        analysis.severity === "Critical"
          ? ("Critical" as const)
          : analysis.severity === "Normal"
            ? ("Normal" as const)
            : ("Warning" as const),
    };
  });
  return {
    devices: next,
    batteryEnergyKWh,
    forcePeakShaving: false,
    applied: true,
  };
}
export function applyRecommendation(
  devices: Device[],
  recommendation: Pick<Recommendation, "deviceId" | "afterPowerKW"> &
    Partial<Recommendation>,
): Device[] {
  const target = devices.find((d) => d.id === recommendation.deviceId);
  if (
    recommendation.action === "discharge_battery" ||
    !target ||
    target.critical ||
    recommendation.afterPowerKW < 0 ||
    recommendation.afterPowerKW > target.power + 0.01
  )
    return devices;
  return devices.map((device) =>
    device.id === target.id
      ? { ...device, power: recommendation.afterPowerKW }
      : device,
  );
}
