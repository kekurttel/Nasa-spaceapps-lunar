const SITE_KINDS = new Set(['landed', 'planned-region', 'candidate', 'custom']);
const DECIMAL = /^[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?$/;

function failure(field, code, message) {
  return { ok: false, errors: [{ field, code, message }] };
}

function numeric(value, field, { nullable = false } = {}) {
  if (nullable && value === null) return { value: null };
  if (typeof value === 'string') {
    if (!DECIMAL.test(value.trim())) return { error: failure(field, 'invalid_number', `${field} must be a finite decimal number.`) };
    value = Number(value);
  }
  return typeof value === 'number' && Number.isFinite(value)
    ? { value }
    : { error: failure(field, 'invalid_number', `${field} must be a finite decimal number.`) };
}

/** Normalize a numeric longitude in [-180, 360] to [-180, 180). */
export function normalizeLongitude(value) {
  if (typeof value === 'string' && !DECIMAL.test(value.trim())) throw new RangeError('Longitude must be a finite number in [-180, 360].');
  const parsed = numeric(value, 'longitude');
  if (parsed.error || parsed.value < -180 || parsed.value > 360) throw new RangeError('Longitude must be a finite number in [-180, 360].');
  if (parsed.value >= -180 && parsed.value < 180) return Object.is(parsed.value, -0) ? 0 : parsed.value;
  return parsed.value - 360;
}

/** Validate and normalize a structural Site record. */
export function validateSite(input) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) return failure('site', 'invalid_object', 'Site must be an object.');
  for (const field of ['id', 'name']) if (typeof input[field] !== 'string' || !input[field].trim()) return failure(field, 'required', `${field} must be a nonblank string.`);
  if (!SITE_KINDS.has(input.kind)) return failure('kind', 'invalid_kind', 'kind must be landed, planned-region, candidate, or custom.');
  if (!Array.isArray(input.sourceIds) || input.sourceIds.some(id => typeof id !== 'string' || !id.trim()) || new Set(input.sourceIds).size !== input.sourceIds.length) return failure('sourceIds', 'invalid_sources', 'sourceIds must contain unique nonblank strings.');
  if (input.kind !== 'custom' && input.sourceIds.length === 0) return failure('sourceIds', 'required', 'Non-custom sites require at least one source ID.');
  const lat = numeric(input.latDeg, 'latDeg');
  if (lat.error) return lat.error;
  if (lat.value < -90 || lat.value > 90) return failure('latDeg', 'out_of_range', 'Latitude must be in [-90, 90].');
  const lon = numeric(input.lonDeg, 'lonDeg');
  if (lon.error) return lon.error;
  if (lon.value < -180 || lon.value > 360) return failure('lonDeg', 'out_of_range', 'Longitude must be in [-180, 360].');
  const elevation = numeric(input.surfaceElevationM, 'surfaceElevationM', { nullable: true });
  if (elevation.error) return elevation.error;
  const observer = numeric(input.observerHeightM, 'observerHeightM');
  if (observer.error) return observer.error;
  if (observer.value < 0) return failure('observerHeightM', 'out_of_range', 'observerHeightM must be nonnegative.');
  return { ok: true, value: { id: input.id.trim(), name: input.name.trim(), latDeg: lat.value, lonDeg: normalizeLongitude(lon.value), surfaceElevationM: elevation.value, observerHeightM: observer.value, kind: input.kind, sourceIds: [...input.sourceIds] }, warnings: [] };
}

/** Validate a user coordinate as custom without substituting another location. */
export function createCustomSite(input) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) return failure('site', 'invalid_object', 'Site must be an object.');
  return validateSite({ ...input, kind: 'custom' });
}

function parseUtc(value, field) {
  const match = typeof value === 'string' && /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.(\d{3}))?Z$/.exec(value);
  if (!match) return { error: failure(field, 'invalid_utc', `${field} must be an ISO UTC timestamp ending in Z, with optional millisecond precision.`) };
  const [, year, month, day, hour, minute, second, millis = '0'] = match;
  const parts = [year, month, day, hour, minute, second, millis].map(Number);
  const [y, mo, d, h, mi, s, ms] = parts;
  const date = new Date(0);
  date.setUTCFullYear(y, mo - 1, d);
  date.setUTCHours(h, mi, s, ms);
  if (mo < 1 || mo > 12 || d < 1 || d > 31 || h > 23 || mi > 59 || s > 59 || date.getUTCFullYear() !== y || date.getUTCMonth() !== mo - 1 || date.getUTCDate() !== d || date.getUTCHours() !== h || date.getUTCMinutes() !== mi || date.getUTCSeconds() !== s || date.getUTCMilliseconds() !== ms) return { error: failure(field, 'invalid_utc', `${field} must be a real calendar date and time in UTC.`) };
  return { value: date.getTime() };
}

function validateCoverage(manifest) {
  if (!manifest || typeof manifest !== 'object' || Array.isArray(manifest)) return failure('manifest', 'required', 'A data manifest is required.');
  for (const field of ['id', 'version']) if (typeof manifest[field] !== 'string' || !manifest[field].trim()) return failure(`manifest.${field}`, 'required', `Manifest ${field} must be a nonblank string.`);
  if (!['real', 'synthetic', 'mixed'].includes(manifest.dataKind)) return failure('manifest.dataKind', 'invalid_data_kind', 'Manifest dataKind must be real, synthetic, or mixed.');
  if (!Array.isArray(manifest.sourceIds) || manifest.sourceIds.some(id => typeof id !== 'string' || !id.trim()) || new Set(manifest.sourceIds).size !== manifest.sourceIds.length) return failure('manifest.sourceIds', 'invalid_sources', 'Manifest sourceIds must contain unique nonblank strings.');
  const dates = manifest.dateCoverage;
  if (!dates || typeof dates !== 'object' || Array.isArray(dates)) return failure('manifest.dateCoverage', 'required', 'Non-null dateCoverage is required.');
  const start = parseUtc(dates.startUtc, 'manifest.dateCoverage.startUtc');
  if (start.error) return start.error;
  const end = parseUtc(dates.endUtc, 'manifest.dateCoverage.endUtc');
  if (end.error) return end.error;
  if (end.value < start.value) return failure('manifest.dateCoverage', 'invalid_interval', 'Coverage endUtc must not precede startUtc.');
  const bounds = manifest.locationCoverage;
  if (!bounds || typeof bounds !== 'object' || Array.isArray(bounds)) return failure('manifest.locationCoverage', 'required', 'Location coverage bounds are required.');
  const values = {};
  for (const [key, range] of [['latMinDeg', [-90, 90]], ['latMaxDeg', [-90, 90]], ['lonMinDeg', [-180, 180]], ['lonMaxDeg', [-180, 180]]]) {
    const result = numeric(bounds[key], `manifest.locationCoverage.${key}`);
    if (result.error) return result.error;
    if (result.value < range[0] || result.value > range[1]) return failure(`manifest.locationCoverage.${key}`, 'out_of_range', `${key} must be in [${range[0]}, ${range[1]}].`);
    values[key] = result.value;
  }
  if (values.latMinDeg > values.latMaxDeg) return failure('manifest.locationCoverage', 'invalid_bounds', 'Latitude minimum must not exceed maximum.');
  if (values.lonMinDeg > values.lonMaxDeg) return failure('manifest.locationCoverage', 'invalid_bounds', 'Longitude minimum must not exceed maximum; antimeridian-crossing bounds are unsupported.');
  return { dates: { start: start.value, end: end.value }, bounds: values };
}

/** Validate a half-open sampled scenario against its embedded Site and manifest coverage. */
export function validateScenario(input, options = {}) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) return failure('scenario', 'invalid_object', 'Scenario must be an object.');
  if (!options || typeof options !== 'object' || Array.isArray(options)) return failure('options', 'invalid_object', 'Options must be an object.');
  if (typeof input.id !== 'string' || !input.id.trim()) return failure('id', 'required', 'id must be a nonblank string.');
  const siteResult = validateSite(input.site);
  if (!siteResult.ok) return { ok: false, errors: siteResult.errors.map(error => ({ ...error, field: `site.${error.field}` })) };
  const start = parseUtc(input.startUtc, 'startUtc');
  if (start.error) return start.error;
  const end = parseUtc(input.endUtc, 'endUtc');
  if (end.error) return end.error;
  if (end.value <= start.value) return failure('endUtc', 'invalid_interval', 'endUtc must be later than startUtc.');
  const step = numeric(input.stepSeconds, 'stepSeconds');
  if (step.error) return step.error;
  if (step.value <= 0) return failure('stepSeconds', 'invalid_step', 'stepSeconds must be positive.');
  const coverage = validateCoverage(options.manifest);
  if (coverage.ok === false) return coverage;
  if (start.value < coverage.dates.start || end.value > coverage.dates.end) return failure('startUtc/endUtc', 'outside_coverage', 'Scenario interval must be within inclusive manifest date coverage.');
  const site = siteResult.value;
  const b = coverage.bounds;
  if (site.latDeg < b.latMinDeg || site.latDeg > b.latMaxDeg || site.lonDeg < b.lonMinDeg || site.lonDeg > b.lonMaxDeg) return failure('site', 'outside_location_coverage', 'Scenario site is outside manifest location coverage.');
  const maxSamples = options.maxSamples ?? 10000;
  if (!Number.isSafeInteger(maxSamples) || maxSamples < 1) return failure('maxSamples', 'invalid_limit', 'maxSamples must be a positive safe integer.');
  const durationSeconds = (end.value - start.value) / 1000;
  const sampleRatio = durationSeconds / step.value;
  if (!Number.isFinite(sampleRatio) || sampleRatio <= 0 || !Number.isSafeInteger(Math.ceil(sampleRatio)) || Math.ceil(sampleRatio) > maxSamples) return failure('stepSeconds', 'sample_limit', `Scenario requires ${Math.ceil(sampleRatio)} samples, exceeding maxSamples ${maxSamples}.`);
  const warnings = ['synthetic', 'mixed'].includes(options.manifest.dataKind) ? [`Scenario uses ${options.manifest.dataKind} data.`] : [];
  return { ok: true, value: { id: input.id.trim(), site, startUtc: input.startUtc, endUtc: input.endUtc, stepSeconds: step.value }, warnings };
}
