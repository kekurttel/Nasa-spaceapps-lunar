export interface Site {
  id: string;
  name: string;
  latDeg: number;
  lonDeg: number;
  surfaceElevationM: number | null;
  observerHeightM: number;
  kind: string;
  sourceIds: string[];
}

export interface Scenario {
  id: string;
  site: Site;
  startUtc: string;
  endUtc: string;
  stepSeconds: number;
}

export class ScenarioError extends Error {
  readonly code: `EPHEMERIS_${string}`;

  constructor(code: `EPHEMERIS_${string}`, message: string) {
    super(message);
    this.name = "ScenarioError";
    this.code = code;
  }
}

const MAX_SAMPLES = 100_000;
const UTC_ISO = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?Z$/;

function parseUtc(value: string, field: string): number {
  if (typeof value !== "string" || !UTC_ISO.test(value)) {
    throw new ScenarioError("EPHEMERIS_INVALID_UTC", `${field} must be a UTC ISO timestamp ending in Z with optional millisecond precision`);
  }
  const millis = Date.parse(value);
  const normalized = value.includes(".") ? value.replace(/\.(\d{1,3})Z$/, (_, fraction: string) => `.${fraction.padEnd(3, "0")}Z`) : value.replace(/Z$/, ".000Z");
  if (!Number.isFinite(millis) || new Date(millis).toISOString() !== normalized) {
    throw new ScenarioError("EPHEMERIS_INVALID_UTC", `${field} is not a valid round-tripping UTC date`);
  }
  return millis;
}

/** Validate a scenario and return its inclusive-start UTC sample grid. */
export function buildScenarioTimes(scenario: Scenario): string[] {
  if (!scenario || typeof scenario !== "object" || !scenario.site || typeof scenario.site !== "object") {
    throw new ScenarioError("EPHEMERIS_INVALID_SCENARIO", "scenario and site are required");
  }

  const { site } = scenario;
  if (!Number.isFinite(site.latDeg) || site.latDeg < -90 || site.latDeg > 90) {
    throw new ScenarioError("EPHEMERIS_INVALID_LATITUDE", "latitude must be finite and within [-90, 90]");
  }
  if (!Number.isFinite(site.lonDeg) || site.lonDeg < -180 || site.lonDeg > 180) {
    throw new ScenarioError("EPHEMERIS_INVALID_LONGITUDE", "longitude must be finite and within [-180, 180]");
  }
  if (site.latDeg === -90 || site.latDeg === 90) {
    throw new ScenarioError("EPHEMERIS_POLAR_AZIMUTH", "azimuth is undefined at an exact geographic pole");
  }
  if (!Number.isFinite(site.observerHeightM) || site.observerHeightM < 0) {
    throw new ScenarioError("EPHEMERIS_INVALID_OBSERVER_HEIGHT", "observer height must be finite and >= 0 m");
  }
  if (site.surfaceElevationM !== null && !Number.isFinite(site.surfaceElevationM)) {
    throw new ScenarioError("EPHEMERIS_INVALID_SURFACE_ELEVATION", "surface elevation must be finite or null");
  }

  const start = parseUtc(scenario.startUtc, "startUtc");
  const end = parseUtc(scenario.endUtc, "endUtc");
  if (start > end) {
    throw new ScenarioError("EPHEMERIS_INVALID_TIME_RANGE", "startUtc must be at or before endUtc");
  }
  if (!Number.isFinite(scenario.stepSeconds) || scenario.stepSeconds <= 0) {
    throw new ScenarioError("EPHEMERIS_INVALID_STEP", "stepSeconds must be finite and > 0");
  }
  const stepMillis = scenario.stepSeconds * 1000;
  if (!Number.isSafeInteger(stepMillis)) {
    throw new ScenarioError("EPHEMERIS_INVALID_STEP", "stepSeconds must resolve to an exact, safe integer number of milliseconds");
  }

  const count = Math.floor((end - start) / stepMillis) + 1;
  if (!Number.isSafeInteger(count) || count > MAX_SAMPLES) {
    throw new ScenarioError("EPHEMERIS_SAMPLE_LIMIT", `scenario exceeds the ${MAX_SAMPLES} sample limit`);
  }

  return Array.from({ length: count }, (_, index) => new Date(start + index * stepMillis).toISOString());
}
