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
- `validateScenario(input, { manifest, maxSamples = 10000 })` expects `input.site` to be the full `Site` object and returns that full site in the successful scenario. It validates date and location coverage, positive step, and sample budget. The half-open interval is `[startUtc, endUtc)`; sample count is `ceil(durationSeconds / stepSeconds)`. `maxSamples` must be a positive safe integer.
- `validateCatalog(siteRecords?, sourceRecords?)` checks catalog records and source references, returning the validated input arrays on success.

Scenario timestamps must be strict UTC strings in `YYYY-MM-DDTHH:mm:ss.sssZ` form, with real calendar dates. Coordinates are decimal degrees; validation helpers accept finite numeric strings where applicable and return normalized numeric coordinates. Surface elevation and observer height are metres; longitude is east-positive.

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

No package dependencies are required; use Node.js 18 or newer.

From the repository root, run the test suite and demo separately:

```sh
node --test src/features/data/tests/*.test.mjs
node src/features/data/examples/demo.mjs
```

Optional declaration check (when TypeScript is installed and the shared typecheck fixture is present):

```sh
tsc --noEmit --strict --module nodenext --moduleResolution nodenext --target es2022 src/features/data/tests/typecheck.mts
```
