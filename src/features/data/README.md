# Lunar site data and scenario validation

This module provides a sourced point catalog and checks site/time-window inputs. It does not calculate ephemerides (a time-indexed table of celestial positions), terrain, or visibility.

## Catalog and provenance

The current catalog has **9 sites: 8 landed locations and 1 planned-region representative marker**. The Mons Mouton entry is the centre of the named feature, used as a representative marker for a historically announced VIPER region—not an exact touchdown point. No unsupported candidate coordinate is invented.

Coordinates are decimal degrees, latitude north-positive and longitude east-positive. The catalog's source records preserve `id`, `url`, `productId`, `agency`, `accessedDate`, `coordinateFrame`, `usageTerms`, `evidence`, `coordinatePrecision`, and `snapshotPath`. Frames differ between sources, some frames are unspecified, and elevation vertical datums are not harmonized. Consult each source record and its evidence before scientific comparison; the catalog does not claim a unified precision or datum. Unknown surface elevations are `null`.

`sites`, `sources`, and `dataManifest` are deeply frozen shared exports. `getSiteById(id)` returns a mutable defensive copy or `null`; `getSourcesForSite(id)` returns mutable defensive copies (or `[]` for an unknown site). Mutating those copies does not alter the catalog.

## API

- `normalizeLongitude(value)` accepts a number or numeric string in `[-180, 360]`, returns east-positive longitude in `[-180, 180)`, and throws `RangeError` for invalid/out-of-range input.
- `validateSite(input)` validates a structural site and returns a `ValidationResult`.
- `createCustomSite(input)` validates user coordinates with kind forced to `custom`; it does not substitute a catalog location.
- `validateScenario(input, { manifest, maxSamples = 10000 })` expects `input.site` to be the full `Site` object and returns that full site in the successful scenario. It validates date and location coverage, positive step, and sample budget. `maxSamples` is mutable per-call and must be a positive safe integer; it is not nullable. Default is 10000. The ephemeris consumer separately applies its own 100000 cap.
- Successful `startUtc` and `endUtc` values are canonical UTC strings in `YYYY-MM-DDTHH:mm:ss.sssZ` form. Inputs in either `YYYY-MM-DDTHH:mm:ssZ` or `YYYY-MM-DDTHH:mm:ss.sssZ` form are accepted, then normalized to canonical milliseconds UTC.
- `stepSeconds` must be strictly positive and resolve to a safe integer number of milliseconds. Sample budget follows the actual endpoint-grid contract: `floor(durationMs / stepMs) + 1`, including the start sample and including the end only when it lands exactly on the grid. This is not a duration-only calculation.
- `validateCatalog(siteRecords?, sourceRecords?)` checks catalog records and source references, returning the validated input arrays on success.

Scenario timestamp inputs accept strict UTC `YYYY-MM-DDTHH:mm:ssZ` and `YYYY-MM-DDTHH:mm:ss.sssZ` forms with real calendar dates; successful scenarios emit canonical `YYYY-MM-DDTHH:mm:ss.sssZ`. Coordinates are decimal degrees; validation helpers accept finite numeric strings where applicable and return normalized numeric coordinates. Surface elevation and observer height are metres; longitude is east-positive. Requested duration is `[startUtc, endUtc)`, while endpoint-grid sampling may include an exactly aligned end sample. Clip the last interval at `endUtc`; never infer elapsed duration as `sampleCount * stepSeconds`.

Validation results have the shape `{ ok: true, value, warnings }` or `{ ok: false, errors: [{ field, code, message }] }`. Useful error codes include `invalid_utc`, `invalid_interval`, `outside_coverage`, `outside_location_coverage`, `invalid_step`, and `sample_limit`.

## Example

This deliberately uses an explicitly synthetic manifest; its dates are a test fixture, not real lunar measurements or ephemeris. The real catalog manifest has `dataKind: 'real'` and `dateCoverage: null`, so it correctly cannot validate a dated scenario until actual date coverage is supplied.

```js
import { createCustomSite, validateScenario } from './index.mjs';

const siteResult = createCustomSite({
  id: 'demo-crater', name: 'Demo Crater', latDeg: -89.5, lonDeg: 270,
  surfaceElevationM: null, observerHeightM: 1, sourceIds: [],
});
if (!siteResult.ok) throw new Error(JSON.stringify(siteResult.errors));

const manifest = {
  id: 'demo-synthetic', version: '1.0.0', dataKind: 'synthetic', sourceIds: [],
  dateCoverage: { startUtc: '2030-01-01T00:00:00.000Z', endUtc: '2030-01-02T00:00:00.000Z' },
  locationCoverage: { latMinDeg: -90, latMaxDeg: 90, lonMinDeg: -180, lonMaxDeg: 180 },
};
const result = validateScenario({
  id: 'demo-hour', site: siteResult.value,
  startUtc: '2030-01-01T00:00:00.000Z', endUtc: '2030-01-01T01:00:00.000Z', stepSeconds: 60,
}, { manifest });
if (!result.ok) throw new Error(JSON.stringify(result.errors));
console.log(result.value);
```

## Requirements and checks

Core module and its local tests require no package dependencies; use Node.js 18 or newer. The optional cross-branch TypeScript contract test additionally requires Node.js with `--experimental-strip-types` support (verified with Node.js 24).

From the repository root, run the test suite and demo separately:

```sh
node --test src/features/data/tests/*.test.mjs
node src/features/data/examples/demo.mjs
```

### Two-module contract check (real packaged vector data)

This check calls this module's `validateScenario` and the actual Agent 2 `computeSkySeries`; it does not copy or replace the ephemeris implementation. Obtain the pinned snapshot from the same repository, outside this checkout:

```sh
git fetch origin feat/lunar-ephemeris-review
EPHEMERIS_SHA=84d02a566ae38d4f785720d3d2e4a4531daaa23e
CONTRACT_DIR=$(mktemp -d /tmp/opencode/data-ephemeris-XXXXXX)
git archive --format=tar --output="$CONTRACT_DIR/ephemeris.tar" "$EPHEMERIS_SHA" src/features/ephemeris
tar -xf "$CONTRACT_DIR/ephemeris.tar" -C "$CONTRACT_DIR"
node --experimental-strip-types src/features/data/tests/run-ephemeris-contract.mjs "$CONTRACT_DIR/src/features/ephemeris"
```

The required runner must fail if the external module root is missing. The regular local suite visibly skips this optional test when `EPHEMERIS_MODULE_ROOT` is unset; a skip is not evidence of integration. The real vector fixture covers only 2026-01-01–2026-01-02 UTC. Contract checks cover UTC shape, actual sample counts, rejection of dates outside coverage, and interval clipping—not scientific frame equivalence or complete UI integration. The sourced catalog remains the single catalog API intended for Agent 5's adapter; the Python/UI catalog has not been replaced here.

Optional declaration check (when TypeScript is installed and the shared typecheck fixture is present):

```sh
tsc --noEmit --strict --module nodenext --moduleResolution nodenext --target es2022 src/features/data/tests/typecheck.mts
```
