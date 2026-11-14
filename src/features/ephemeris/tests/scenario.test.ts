import test from 'node:test';
import assert from 'node:assert/strict';
import { buildScenarioTimes, ScenarioError, type Scenario } from '../scenario.ts';

const describe = (name: string, fn: () => void) => test(name, fn);
const it = test;

const base: Scenario = {
  id: "test",
  site: {
    id: "site",
    name: "Test site",
    latDeg: 0,
    lonDeg: 0,
    surfaceElevationM: null,
    observerHeightM: 0,
    kind: "custom",
    sourceIds: [],
  },
  startUtc: "2024-01-01T00:00:00.000Z",
  endUtc: "2024-01-01T00:00:02.500Z",
  stepSeconds: 1,
};

function expectCode(scenario: Scenario, code: string): void {
  assert.throws(() => buildScenarioTimes(scenario), (error: unknown) => {
    assert.ok(error instanceof ScenarioError);
    assert.equal(error.code, code);
    return true;
  });
}

function withSite(change: Partial<Scenario["site"]>): Scenario {
  return { ...base, site: { ...base.site, ...change } };
}

describe("buildScenarioTimes", () => {
  it("returns deterministic UTC ISO samples, includes start and only grid-aligned end", () => {
    const expected = [
      "2024-01-01T00:00:00.000Z",
      "2024-01-01T00:00:01.000Z",
      "2024-01-01T00:00:02.000Z",
    ];
    assert.deepEqual(buildScenarioTimes(base), expected);
    assert.deepEqual(buildScenarioTimes(base), expected);
    assert.deepEqual(buildScenarioTimes({ ...base, endUtc: "2024-01-01T00:00:02.000Z" }), expected);
    assert.deepEqual(buildScenarioTimes({ ...base, endUtc: "2024-01-01T00:00:03.000Z", stepSeconds: 1.5 }), [
      "2024-01-01T00:00:00.000Z",
      "2024-01-01T00:00:01.500Z",
      "2024-01-01T00:00:03.000Z",
    ]);
  });

  it("accepts valid coordinate, elevation and observer-height boundaries", () => {
    assert.equal(buildScenarioTimes(withSite({ latDeg: -89.999, lonDeg: -180, surfaceElevationM: null, observerHeightM: 0 })).length, 3);
    assert.equal(buildScenarioTimes(withSite({ latDeg: 89.999, lonDeg: 180, surfaceElevationM: -500, observerHeightM: 10 })).length, 3);
  });

  it("accepts UTC timestamps with optional fractional milliseconds", () => {
    assert.deepEqual(buildScenarioTimes({ ...base, startUtc: "2024-01-01T00:00:00Z", endUtc: "2024-01-01T00:00:02Z" }), [
      "2024-01-01T00:00:00.000Z", "2024-01-01T00:00:01.000Z", "2024-01-01T00:00:02.000Z",
    ]);
    assert.equal(buildScenarioTimes({ ...base, startUtc: "2024-01-01T00:00:00.1Z" })[0], "2024-01-01T00:00:00.100Z");
  });

  it("rejects malformed dates, impossible dates and offsets", () => {
    for (const value of ["2024-02-30T00:00:00.000Z", "2024-01-01T00:00:00+00:00", "bad"]) {
      expectCode({ ...base, startUtc: value }, "EPHEMERIS_INVALID_UTC");
    }
    expectCode({ ...base, endUtc: "2024-02-30T00:00:00.000Z" }, "EPHEMERIS_INVALID_UTC");
  });

  it("rejects reversed time ranges", () => {
    expectCode({ ...base, startUtc: "2024-01-02T00:00:00.000Z" }, "EPHEMERIS_INVALID_TIME_RANGE");
  });

  it("rejects invalid latitude and exact poles with the documented error", () => {
    for (const latDeg of [-90.001, 90.001, Number.NaN, Infinity]) expectCode(withSite({ latDeg }), "EPHEMERIS_INVALID_LATITUDE");
    for (const latDeg of [-90, 90]) expectCode(withSite({ latDeg }), "EPHEMERIS_POLAR_AZIMUTH");
  });

  it("rejects invalid longitude", () => {
    for (const lonDeg of [-180.001, 180.001, Number.NaN, Infinity]) expectCode(withSite({ lonDeg }), "EPHEMERIS_INVALID_LONGITUDE");
  });

  it("rejects invalid observer and surface elevations while permitting unknown surface elevation", () => {
    for (const observerHeightM of [-1, Number.NaN, Infinity]) expectCode(withSite({ observerHeightM }), "EPHEMERIS_INVALID_OBSERVER_HEIGHT");
    for (const surfaceElevationM of [Number.NaN, Infinity, -Infinity]) expectCode(withSite({ surfaceElevationM }), "EPHEMERIS_INVALID_SURFACE_ELEVATION");
    assert.equal(buildScenarioTimes(withSite({ surfaceElevationM: null })).length, 3);
  });

  it("requires a positive finite step resolving to an exact millisecond", () => {
    for (const stepSeconds of [0, -1, Number.NaN, Infinity, 0.0001]) expectCode({ ...base, stepSeconds }, "EPHEMERIS_INVALID_STEP");
    assert.equal(buildScenarioTimes({ ...base, stepSeconds: 0.001 }).length, 2501);
  });

  it("enforces the maximum sample count without building an oversized array", () => {
    const accepted = { ...base, endUtc: "2024-01-02T03:46:39.000Z", stepSeconds: 1 };
    assert.equal(buildScenarioTimes(accepted).length, 100_000);
    expectCode({ ...accepted, endUtc: "2024-01-02T03:46:40.000Z" }, "EPHEMERIS_SAMPLE_LIMIT");
  });
});
