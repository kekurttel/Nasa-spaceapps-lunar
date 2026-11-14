import test from 'node:test';
import assert from 'node:assert/strict';
import { analyzeVisibility, compareScenarios, serializeComparisonCsv } from '../index.mjs';

const scenario = (id = 's', endUtc = '2026-01-01T00:00:10.000Z', stepSeconds = 4) => ({ id, site: { sourceIds: ['LOLA-demo'] }, startUtc: '2026-01-01T00:00:00.000Z', endUtc, stepSeconds });
const series = (id, timesUtc, sunVisibleFraction, earthVisible) => ({ scenarioId: id, timesUtc, sunVisibleFraction, earthVisible, bothAvailable: sunVisibleFraction.map((v, i) => v > 0 && earthVisible[i]), quality: { dataKind: 'synthetic', horizonModel: 'flat', earthRule: 'center', warnings: ['synthetic test input'] } });
const times = ['2026-01-01T00:00:00.000Z', '2026-01-01T00:00:04.000Z', '2026-01-01T00:00:08.000Z'];

test('weighted windows include partial final interval and distinguish any sun from disk fraction', () => {
  const result = analyzeVisibility(scenario(), series('s', times, [0.5, 0, 1], [true, false, true]));
  assert.equal(result.metrics.durationSeconds, 10);
  assert.equal(result.metrics.sunAnyFraction, 0.6);
  assert.equal(result.metrics.sunEquivalentFraction, 0.4);
  assert.equal(result.metrics.earthVisibleFraction, 0.6);
  assert.equal(result.metrics.bothFraction, 0.6);
  assert.equal(result.metrics.longestDarkSeconds, 4);
  assert.deepEqual(result.windows.sun, [
    { startUtc: times[0], endUtc: times[1], durationSeconds: 4 },
    { startUtc: times[2], endUtc: scenario().endUtc, durationSeconds: 2 },
  ]);
  assert.equal(result.quality.resolutionSeconds, 4);
  assert.match(result.quality.warnings.at(-1), /not interpolated astronomical events/);
});

test('continuous visible intervals merge and period-edge windows stay clipped', () => {
  const result = analyzeVisibility(scenario(), series('s', times, [1, 1, 1], [true, true, true]));
  assert.deepEqual(result.windows.sun, [{ startUtc: times[0], endUtc: scenario().endUtc, durationSeconds: 10 }]);
  assert.equal(result.metrics.longestDarkSeconds, 0);
});

test('accepts seconds-only UTC and normalizes output, but rejects invalid dates', () => {
  const secondsScenario = { ...scenario('seconds', '2026-01-01T00:00:10Z'), startUtc: '2026-01-01T00:00:00Z' };
  const secondsSeries = series('seconds', ['2026-01-01T00:00:00Z', '2026-01-01T00:00:04Z', '2026-01-01T00:00:08Z'], [1, 0, 1], [true, false, true]);
  assert.equal(analyzeVisibility(secondsScenario, secondsSeries).windows.sun[0].startUtc, '2026-01-01T00:00:00.000Z');
  assert.throws(() => analyzeVisibility({ ...secondsScenario, startUtc: '2026-02-30T00:00:00Z' }, secondsSeries), /round-tripping/);
});

test('reject empty, malformed, misaligned, duplicate, reversed, and mismatched series', () => {
  const base = series('s', times, [1, 0, 1], [true, false, true]);
  assert.throws(() => analyzeVisibility(scenario(), series('s', [], [], [])), /nonempty/);
  assert.throws(() => analyzeVisibility(scenario(), { ...base, scenarioId: 'other' }), /must match/);
  assert.throws(() => analyzeVisibility(scenario(), { ...base, timesUtc: [times[1], ...times.slice(1)] }), /equal scenario.startUtc/);
  assert.throws(() => analyzeVisibility(scenario(), { ...base, timesUtc: [times[0], times[0], times[2]] }), /strictly increasing/);
  assert.throws(() => analyzeVisibility(scenario(), { ...base, timesUtc: [times[0], times[2]] , sunVisibleFraction: [1, 1], earthVisible: [true, true], bothAvailable: [true, true] }), /coverage gap/);
  assert.throws(() => analyzeVisibility(scenario(), { ...base, bothAvailable: [false, false, true] }), /must equal/);
  assert.throws(() => analyzeVisibility(scenario(), { ...base, sunVisibleFraction: [1.1, 0, 1] }), /\[0, 1\]/);
  assert.throws(() => analyzeVisibility(scenario('long-gap', '2026-01-02T00:00:00.000Z', 3600), series('long-gap', [times[0]], [1], [true])), /final sample leaves a coverage gap/);
});

test('zero-duration end-boundary sample does not create zero-duration window', () => {
  const end = scenario().endUtc;
  const boundarySeries = series('s', [...times, end], [1, 1, 0, 1], [true, true, false, true]);
  const result = analyzeVisibility(scenario(), boundarySeries);
  assert.equal(result.metrics.durationSeconds, 10);
  assert.deepEqual(result.windows.sun, [{ startUtc: times[0], endUtc: times[2], durationSeconds: 8 }]);
});

test('mixed input quality is preserved without reclassification', () => {
  const mixedSeries = series('mixed-site', times, [1, 0, 1], [true, false, true]);
  mixedSeries.quality.dataKind = 'mixed';
  assert.equal(analyzeVisibility(scenario('mixed-site'), mixedSeries).quality.dataKind, 'mixed');
});

test('CSV keeps model/frame/source metadata and protects formula-like text cells', () => {
  const s = scenario('=SUM(1,1)');
  s.site.sourceIds = ['+cmd'];
  s.quality = { model: '@model', frame: '-frame', sourceIds: ['series-source'] };
  const v = series(s.id, times, [1, 0, 1], [true, false, true]);
  v.quality.model = '=injected';
  v.quality.frame = '+frame';
  v.quality.sourceIds = ['@dataset'];
  const csv = serializeComparisonCsv([{ scenario: s, series: v }, { scenario: scenario('other'), series: series('other', times, [0, 1, 0], [false, true, false]) }]);
  assert.match(csv, /"model","frame","sourceIds"/);
  assert.match(csv, /"'=SUM\(1,1\)"/);
  assert.match(csv, /"'\+cmd;series-source;@dataset"/);
  assert.match(csv, /"'=injected"/);
  assert.match(csv, /"unknown"/);
});

test('accepts fractional UTC with one or two digits without changing point API', () => {
  for (const digits of ['1', '12', '123']) {
    const startUtc = `2026-01-01T00:00:00.${digits}Z`;
    const s = { ...scenario('fraction'), startUtc, stepSeconds: 10 };
    const v = series('fraction', [startUtc], [1], [true]);
    assert.ok(analyzeVisibility(s, v).metrics.durationSeconds > 0);
  }
});

test('CSV guards whitespace-prefixed formulas and escapes multiline Unicode metadata without mutation', () => {
  const metadata = [' =1+1', '\t=1+1', '\ttext', '\rtext', '\ntext', '=HYPERLINK("bad","click")', 'Ay, Dünya "ufuk"\r\nİzmir'];
  for (const model of metadata) {
    const entries = ['one', 'two'].map(id => {
      const v = series(id, times, [1, 0, 1], [true, false, true]);
      v.quality.model = model;
      return { scenario: scenario(id), series: v };
    });
    const before = structuredClone(entries);
    const csv = serializeComparisonCsv(entries);
    const safe = /^\s*[=+@-]/.test(model) || /^[\t\r\n]/.test(model) ? `'${model}` : model;
    assert.ok(csv.includes(`"${safe.replaceAll('"', '""')}"`));
    assert.deepEqual(entries, before);
  }
});

test('comparison supports unequal durations, CSV retains quality and source metadata, and rejects outside 2–4', () => {
  const entries = [
    { scenario: scenario('s'), series: series('s', times, [1, 0, 1], [true, false, true]) },
    { scenario: scenario('short', '2026-01-01T00:00:04.000Z', 4), series: series('short', times.slice(0, 1), [0.5], [true]) },
  ];
  const comparison = compareScenarios(entries);
  assert.equal(comparison.comparisons[0].metrics.durationSeconds, 10);
  assert.equal(comparison.comparisons[1].metrics.durationSeconds, 4);
  const csv = serializeComparisonCsv(entries);
  assert.match(csv, /scenarioId/);
  assert.match(csv, /synthetic/);
  assert.match(csv, /LOLA-demo/);
  assert.match(csv, /flat/);
  assert.match(csv, /resolutionSeconds/);
  assert.throws(() => compareScenarios(entries.slice(0, 1)), /2 to 4/);
});
