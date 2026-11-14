const DATA_KINDS = new Set(['real', 'synthetic', 'mixed']);

function fail(message) {
  throw new TypeError(message);
}

function utcMillis(value, label) {
  if (typeof value !== 'string' || !/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d(?:\.\d{1,3})?Z$/.test(value)) {
    fail(`${label} must be a UTC ISO timestamp ending in Z with optional millisecond precision`);
  }
  const millis = Date.parse(value);
  if (!Number.isFinite(millis)) fail(`${label} must be a valid UTC timestamp`);
  const normalizedInput = value.includes('.') ? value.replace(/\.(\d{1,3})Z$/, (_, digits) => `.${digits.padEnd(3, '0')}Z`) : `${value.slice(0, -1)}.000Z`;
  if (new Date(millis).toISOString() !== normalizedInput) fail(`${label} must be a valid round-tripping UTC timestamp`);
  return millis;
}

function validateScenario(scenario) {
  if (!scenario || typeof scenario !== 'object' || typeof scenario.id !== 'string' || !scenario.id.trim()) fail('scenario.id must be nonempty');
  const start = utcMillis(scenario.startUtc, 'scenario.startUtc');
  const end = utcMillis(scenario.endUtc, 'scenario.endUtc');
  if (end <= start) fail('scenario.endUtc must be after scenario.startUtc');
  if (!Number.isFinite(scenario.stepSeconds) || scenario.stepSeconds <= 0) fail('scenario.stepSeconds must be finite and > 0');
  return { start, end };
}

function validateSeries(series, scenario) {
  if (!series || typeof series !== 'object') fail('series is required');
  if (series.scenarioId !== scenario.id) fail('series.scenarioId must match scenario.id');
  const { start, end } = validateScenario(scenario);
  const { timesUtc, sunVisibleFraction, earthVisible, bothAvailable, quality } = series;
  if (!Array.isArray(timesUtc) || timesUtc.length === 0) fail('timesUtc must be a nonempty array');
  for (const [name, values] of [['sunVisibleFraction', sunVisibleFraction], ['earthVisible', earthVisible], ['bothAvailable', bothAvailable]]) {
    if (!Array.isArray(values) || values.length !== timesUtc.length) fail(`${name} length must match timesUtc`);
    if (Array.from({ length: values.length }, (_, i) => i).some((i) => !(i in values))) fail(`${name} must not be sparse`);
  }
  if (!quality || typeof quality !== 'object') fail('quality is required');
  if (!DATA_KINDS.has(quality.dataKind)) fail('quality.dataKind must be real, synthetic, or mixed');
  for (const name of ['horizonModel', 'earthRule']) if (typeof quality[name] !== 'string' || !quality[name].trim()) fail(`quality.${name} must be nonempty`);
  if (!Array.isArray(quality.warnings) || quality.warnings.some((warning) => typeof warning !== 'string')) fail('quality.warnings must be an array of strings');
  const times = timesUtc.map((time, i) => utcMillis(time, `timesUtc[${i}]`));
  if (times[0] !== start) fail('first timesUtc entry must equal scenario.startUtc');
  for (let i = 0; i < times.length; i++) {
    if (times[i] > end || (times[i] === end && i !== times.length - 1)) fail('only final timesUtc entry may equal scenario.endUtc');
    if (i && times[i] <= times[i - 1]) fail('timesUtc must be strictly increasing');
    if (i && times[i] - times[i - 1] > scenario.stepSeconds * 1000) fail('timesUtc contains a coverage gap larger than scenario.stepSeconds');
    const fraction = sunVisibleFraction[i];
    if (!Number.isFinite(fraction) || fraction < 0 || fraction > 1) fail(`sunVisibleFraction[${i}] must be finite and in [0, 1]`);
    if (typeof earthVisible[i] !== 'boolean' || typeof bothAvailable[i] !== 'boolean') fail(`visibility flags at index ${i} must be booleans`);
    if (bothAvailable[i] !== (fraction > 0 && earthVisible[i])) fail(`bothAvailable[${i}] must equal sunVisibleFraction > 0 && earthVisible`);
  }
  if (end - times.at(-1) > scenario.stepSeconds * 1000) fail('final sample leaves a coverage gap larger than scenario.stepSeconds');
  return { times, start, end };
}

function mergeWindows(times, durations, predicate, end) {
  const windows = [];
  let open = -1;
  for (let i = 0; i < times.length; i++) {
    if (durations[i] > 0 && predicate(i)) {
      if (open < 0) open = i;
    } else if (open >= 0) {
      windows.push({ startUtc: new Date(times[open]).toISOString(), endUtc: new Date(times[i]).toISOString(), durationSeconds: (times[i] - times[open]) / 1000 });
      open = -1;
    }
  }
  if (open >= 0) windows.push({ startUtc: new Date(times[open]).toISOString(), endUtc: new Date(end).toISOString(), durationSeconds: (end - times[open]) / 1000 });
  return windows;
}

function longestRun(times, durations, predicate) {
  let current = 0;
  let longest = 0;
  for (let i = 0; i < times.length; i++) {
    current = predicate(i) ? current + durations[i] : 0;
    longest = Math.max(longest, current);
  }
  return longest;
}

/** Analyze sampled visibility, holding each sample over [t_i,t_(i+1)); final sample extends to scenario.endUtc. */
export function analyzeVisibility(scenario, series) {
  const { times, start, end } = validateSeries(series, scenario);
  const durations = times.map((time, i) => ((i + 1 < times.length ? times[i + 1] : end) - time) / 1000);
  const total = (end - start) / 1000;
  const weighted = (predicate, value = () => 1) => durations.reduce((sum, duration, i) => sum + (predicate(i) ? duration * value(i) : 0), 0) / total;
  const sun = (i) => series.sunVisibleFraction[i] > 0;
  const earth = (i) => series.earthVisible[i];
  const both = (i) => series.bothAvailable[i];
  const quality = {
    dataKind: series.quality.dataKind,
    warnings: [...series.quality.warnings, `Sampled visibility held constant over intervals; temporal resolution is bounded by ${scenario.stepSeconds} s cadence. Window boundaries are sample boundaries, not interpolated astronomical events.`],
    horizonModel: series.quality.horizonModel,
    earthRule: series.quality.earthRule,
    model: series.quality.model ?? scenario.quality?.model ?? 'unknown',
    frame: series.quality.frame ?? scenario.quality?.frame ?? 'unknown',
    sourceIds: [...new Set([
      ...(Array.isArray(scenario.site?.sourceIds) ? scenario.site.sourceIds : []),
      ...(Array.isArray(scenario.quality?.sourceIds) ? scenario.quality.sourceIds : []),
      ...(Array.isArray(series.quality.sourceIds) ? series.quality.sourceIds : []),
    ])],
    resolutionSeconds: scenario.stepSeconds,
  };
  return {
    scenarioId: scenario.id,
    metrics: {
      durationSeconds: total,
      sunAnyFraction: weighted(sun),
      sunEquivalentFraction: durations.reduce((sum, duration, i) => sum + duration * series.sunVisibleFraction[i], 0) / total,
      earthVisibleFraction: weighted(earth),
      bothFraction: weighted(both),
      longestDarkSeconds: longestRun(times, durations, (i) => !sun(i)),
      longestEarthGapSeconds: longestRun(times, durations, (i) => !earth(i)),
    },
    windows: {
      sun: mergeWindows(times, durations, sun, end),
      earth: mergeWindows(times, durations, earth, end),
      both: mergeWindows(times, durations, both, end),
    },
    quality,
  };
}

/** Analyze and compare 2–4 scenarios using the same named metrics; no ranking or recommendation. */
export function compareScenarios(entries) {
  if (!Array.isArray(entries) || entries.length < 2 || entries.length > 4) fail('entries must contain 2 to 4 scenarios');
  const results = entries.map(({ scenario, series }) => analyzeVisibility(scenario, series));
  if (new Set(results.map((result) => result.scenarioId)).size !== results.length) fail('scenario IDs must be unique');
  return { comparisons: results };
}

/** Serialize comparison rows as RFC 4180-style CSV; absent metadata is explicit, never invented. */
export function serializeComparisonCsv(entries) {
  const { comparisons } = compareScenarios(entries);
  const columns = ['scenarioId', 'durationSeconds', 'sunAnyFraction', 'sunEquivalentFraction', 'earthVisibleFraction', 'bothFraction', 'longestDarkSeconds', 'longestEarthGapSeconds', 'dataKind', 'horizonModel', 'earthRule', 'model', 'frame', 'sourceIds', 'resolutionSeconds', 'warnings'];
  const quote = (value) => {
    let text = String(value ?? '');
    if (typeof value === 'string' && (/^\s*[=+@-]/.test(text) || /^[\t\r\n]/.test(text))) text = `'${text}`;
    return `"${text.replaceAll('"', '""')}"`;
  };
  const rows = comparisons.map(({ scenarioId, metrics, quality }) => [scenarioId, metrics.durationSeconds, metrics.sunAnyFraction, metrics.sunEquivalentFraction, metrics.earthVisibleFraction, metrics.bothFraction, metrics.longestDarkSeconds, metrics.longestEarthGapSeconds, quality.dataKind, quality.horizonModel, quality.earthRule, quality.model, quality.frame, quality.sourceIds.length ? quality.sourceIds.join(';') : 'unknown', quality.resolutionSeconds, quality.warnings.join('; ')]);
  return [columns, ...rows].map((row) => row.map(quote).join(',')).join('\r\n');
}
