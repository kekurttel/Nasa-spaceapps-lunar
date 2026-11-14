/** Temporal reduction only. No shadow casting; input intervals must be certified by producer. */
export const ILLUMINATION_CONTRACT = 'temporal-illumination/v1';
const YEAR_SECONDS = 365.25 * 86400;
function utc(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d(?:\.\d{1,3})?Z$/.test(value)) throw new TypeError('Expected ISO UTC');
  const t = Date.parse(value);
  const canonical = value.includes('.') ? value.replace(/\.(\d{1,3})Z$/, (_, n) => `.${n.padEnd(3, '0')}Z`) : value.replace('Z', '.000Z');
  if (!Number.isFinite(t) || new Date(t).toISOString() !== canonical) throw new TypeError('Invalid UTC calendar date');
  return t;
}
function gridCheck(g) {
  if (!g || !Number.isSafeInteger(g.width) || !Number.isSafeInteger(g.height) || g.width < 1 || g.height < 1 || g.width * g.height > 10000000) throw new TypeError('Invalid or oversized raster dimensions');
  if (g.units !== 'm' || typeof g.crs !== 'string' || !g.crs.trim() || /GEOGCRS|GEOGCS|4326|4269|4258|CRS\s*:?\s*84|geographic|longlat|latlong/i.test(g.crs) || !['originXM', 'originYM', 'pixelSizeXM', 'pixelSizeYM'].every(k => Number.isFinite(g[k])) || g.pixelSizeXM <= 0 || g.pixelSizeYM <= 0) throw new TypeError('Explicit projected metre grid required');
}
/** Isolated adapter contract, not a claim of Agent3 wire compatibility. */
export function validateIlluminationSeries(input) {
  if (input?.schemaVersion !== ILLUMINATION_CONTRACT) throw new TypeError('Unsupported illumination contract version');
  gridCheck(input.grid);
  const start = utc(input.startUtc), end = utc(input.endUtc);
  if (end <= start) throw new TypeError('Positive evaluation interval required');
  if (!Array.isArray(input.frames)) throw new TypeError('frames array required');
  let previous = start;
  const n = input.grid.width * input.grid.height;
  const frames = input.frames.map(f => {
    if (f.grid && JSON.stringify(f.grid) !== JSON.stringify(input.grid)) throw new TypeError('Resolution/grid changes require explicit resampling outside analysis');
    const a = utc(f.startUtc), b = utc(f.endUtc);
    if (a < previous || b <= a || a < start || b > end) throw new TypeError('Intervals must be ordered, nonoverlapping and inside evaluation coverage');
    previous = b;
    if (!Array.isArray(f.fractions) || f.fractions.length !== n) throw new TypeError('Raster length mismatch');
    for (let i = 0; i < n; i++) if (!(i in f.fractions) || (f.fractions[i] !== null && (!Number.isFinite(f.fractions[i]) || f.fractions[i] < 0 || f.fractions[i] > 1))) throw new TypeError('Fractions must be dense 0..1 or explicit null NoData');
    return { a, b, fractions: f.fractions };
  });
  return { start, end, frames, cellCount: n };
}
function classification(covered, duration, sunlit, penumbra, umbra) {
  if (covered !== duration || covered === 0) return 'UNKNOWN_OR_INSUFFICIENT_COVERAGE';
  if (umbra === duration) return 'PERSISTENT_SHADOW_IN_INTERVAL';
  if (sunlit === duration) return 'ALWAYS_ILLUMINATED_IN_INTERVAL';
  if (umbra === 0 && penumbra > 0) return 'PARTIAL_ILLUMINATION_REGIME';
  return 'INTERMITTENTLY_ILLUMINATED';
}
/** Durations are interval support, not snapshot counts. Seasonal bins must be supplied explicitly. */
export function analyzeIllumination(input, { atUtc = input.startUtc, seasons = [] } = {}) {
  const { start, end, frames, cellCount } = validateIlluminationSeries(input);
  const at = utc(atUtc);
  if (at < start || at > end) throw new TypeError('atUtc outside evaluated interval');
  const bins = seasons.map(s => ({ id: s.id, a: utc(s.startUtc), b: utc(s.endUtc) }));
  for (let i = 0; i < bins.length; i++) if (typeof bins[i].id !== 'string' || !bins[i].id || bins[i].a < start || bins[i].b > end || bins[i].b <= bins[i].a || (i && bins[i].a < bins[i - 1].b)) throw new TypeError('Season bins must be named, ordered, disjoint and within coverage');
  if (new Set(bins.map(s => s.id)).size !== bins.length) throw new TypeError('Season IDs must be unique');
  const duration = (end - start) / 1000;
  const cells = Array.from({ length: cellCount }, (_, index) => {
    let covered = 0, illuminated = 0, weighted = 0, penumbra = 0, umbra = 0, full = 0;
    let maxDark = 0, maxLight = 0, darkRun = 0, lightRun = 0, previousEnd = null, previousState = null, transitions = 0, illuminationTransitions = 0;
    let first = null, last = null, next = null, searchCoveredUntil = at;
    for (const f of frames) {
      const v = f.fractions[index], dt = (f.b - f.a) / 1000;
      if (v === null) { darkRun = lightRun = 0; previousState = null; previousEnd = null; continue; }
      const state = v === 0 ? 'umbra' : v === 1 ? 'sunlit' : 'penumbra';
      const contiguous = previousEnd === f.a;
      if (!contiguous) darkRun = lightRun = 0;
      if (contiguous && previousState !== null && state !== previousState) transitions++;
      if (contiguous && previousState !== null && (state === 'umbra') !== (previousState === 'umbra')) illuminationTransitions++;
      covered += dt; weighted += v * dt;
      if (v > 0) { illuminated += dt; lightRun += dt; darkRun = 0; first ??= f.a; last = f.b; }
      else { umbra += dt; darkRun += dt; lightRun = 0; }
      if (v === 1) full += dt;
      else if (v > 0) penumbra += dt;
      maxDark = Math.max(maxDark, darkRun); maxLight = Math.max(maxLight, lightRun);
      if (next === null && f.b > at && f.a <= searchCoveredUntil) {
        if (v > 0) next = Math.max(at, f.a);
        else searchCoveredUntil = f.b;
      }
      previousEnd = f.b; previousState = state;
    }
    const seasonal = bins.map(s => {
      let support = 0, light = 0;
      for (const f of frames) {
        const dt = Math.max(0, Math.min(f.b, s.b) - Math.max(f.a, s.a)) / 1000;
        if (f.fractions[index] !== null) { support += dt; light += dt * (f.fractions[index] > 0 ? 1 : 0); }
      }
      return { id: s.id, coverageFraction: support / ((s.b - s.a) / 1000), dutyCycle: support > 0 ? light / support : null, seconds: support };
    });
    const completeSeasons = seasonal.length >= 2 && seasonal.every(s => s.coverageFraction === 1);
    const seasonWeight = seasonal.reduce((sum, s) => sum + s.seconds, 0);
    const mean = completeSeasons ? seasonal.reduce((sum, s) => sum + s.dutyCycle * s.seconds, 0) / seasonWeight : null;
    const variance = completeSeasons ? seasonal.reduce((sum, s) => sum + s.seconds * (s.dutyCycle - mean) ** 2, 0) / seasonWeight : null;
    if (Math.abs(covered - duration) < 1e-9) covered = duration;
    if (Math.abs(umbra - duration) < 1e-9) umbra = duration;
    if (Math.abs(full - duration) < 1e-9) full = duration;
    const coverage = covered / duration;
    const uncertaintyClass = covered === 0 ? 'NO_DATA' : coverage < 1 ? 'INCOMPLETE_TEMPORAL_COVERAGE' : 'INTERVAL_SUPPORTED_MODEL';
    const metrics = { totalIlluminatedSeconds: illuminated, equivalentFullSunSeconds: weighted, totalPenumbralSeconds: penumbra, totalUmbralSeconds: umbra, totalFullySunlitSeconds: full, coveredSeconds: covered, missingSeconds: Math.max(0, duration - covered), illuminationDutyCycle: covered ? illuminated / covered : null, penumbraDutyCycle: covered ? penumbra / covered : null, maxContinuousDarkSeconds: covered ? maxDark : null, maxContinuousSunlitSeconds: covered ? maxLight : null, shadowTransitionCount: transitions, illuminationTransitionCount: illuminationTransitions, firstIlluminationUtc: first === null ? null : new Date(first).toISOString(), lastIlluminationEndExclusiveUtc: last === null ? null : new Date(last).toISOString(), timeToNextSunlightSeconds: next === null ? null : (next - at) / 1000, seasonalIlluminationVariance: variance, illuminationCoverageFraction: coverage, uncertaintyClass };
    return { cellIndex: index, classification: classification(covered, duration, full, penumbra, umbra), longTermAssessment: { status: umbra === duration && covered === duration ? 'PERSISTENT_SHADOW_IN_EVALUATED_INTERVAL' : 'NO_LONG_TERM_PSR_CONCLUSION', nodalCycleDurationSatisfied: duration >= 18.6 * YEAR_SECONDS && coverage === 1, permanentShadowClaim: false }, metrics, seasonal, sdf: { schemaVersion: 'shadow-dynamics-fingerprint/v1', illuminationDutyCycle: metrics.illuminationDutyCycle, penumbraDutyCycle: metrics.penumbraDutyCycle, maxContinuousDarkSeconds: metrics.maxContinuousDarkSeconds, maxContinuousSunlitSeconds: metrics.maxContinuousSunlitSeconds, shadowTransitionCount: transitions, seasonalIlluminationVariance: variance, timeToNextSunlightSeconds: metrics.timeToNextSunlightSeconds, illuminationCoverageFraction: coverage, uncertaintyClass } };
  });
  return { schemaVersion: 'temporal-illumination-analysis/v1', grid: structuredClone(input.grid), startUtc: input.startUtc, endUtc: input.endUtc, cells, quality: { inputContract: ILLUMINATION_CONTRACT, durationPolicy: 'explicit-half-open-intervals-only', sourceQuality: structuredClone(input.quality ?? null), cadenceSeconds: frames.map(f => (f.b - f.a) / 1000), spatialResolutionM: { x: input.grid.pixelSizeXM, y: input.grid.pixelSizeYM }, classificationMethod: 'explicit-interval-state-duration/v1', illuminationThreshold: { illuminated: 'fraction > 0', fullySunlit: 'fraction === 1', penumbra: '0 < fraction < 1', umbra: 'fraction === 0' }, metadataComplete: ['dataSource', 'demSha256', 'solarEphemerisSource', 'frame'].every(k => typeof input.quality?.[k] === 'string' && input.quality[k].length > 0), warnings: ['Snapshot timestamps alone do not certify interval support.', 'Continuous durations are model-supported runs, not proof of unsampled physical extrema.', 'No permanent-shadow, power, communication or landing-safety claim.'] } };
}
/** Planning only. Does not generate maps, execute refinement, or certify convergence. */
export function planHierarchicalIllumination({ sourceResolutionM = 80, screeningResolutionM = 1280, coarseStepSeconds = 21600, transitionStepSeconds = 300 } = {}) {
  if (![sourceResolutionM, screeningResolutionM, coarseStepSeconds, transitionStepSeconds].every(v => Number.isFinite(v) && v > 0) || screeningResolutionM < sourceResolutionM || transitionStepSeconds > coarseStepSeconds) throw new TypeError('Invalid hierarchy resolution/cadence');
  return { status: 'PLAN_ONLY_NOT_EXECUTED', stages: [{ stage: 'A', role: 'polar screening over at least 18.6 years', resolutionM: screeningResolutionM, stepSeconds: coarseStepSeconds }, { stage: 'B', role: 'refine brackets around state transitions; preserve unresolved gaps', stepSeconds: transitionStepSeconds }, { stage: 'C', role: 'selected candidate regions/windows only', resolutionM: sourceResolutionM }], requiredEvidence: ['source DEM finest supported resolution', 'spatial and temporal convergence study', 'kernel coverage validation', 'unresolved intervals remain unknown', 'runtime and peak-memory benchmark'] };
}
