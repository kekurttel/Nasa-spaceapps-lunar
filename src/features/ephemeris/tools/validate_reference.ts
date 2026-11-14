import { readFile, writeFile } from 'node:fs/promises';
import { computeSkySeries } from '../index.ts';
import type { MoonFixedDataset } from '../index.ts';
const base = new URL('../fixtures/', import.meta.url);
const dataset: MoonFixedDataset = JSON.parse(await readFile(new URL('real-moon-vectors.json', base), 'utf8'));
const reference = JSON.parse(await readFile(new URL('horizons-reference.json', base), 'utf8'));
const rad = Math.PI / 180;
function direction(az: number, alt: number) {
  return [Math.cos(alt * rad) * Math.sin(az * rad), Math.cos(alt * rad) * Math.cos(az * rad), Math.sin(alt * rad)];
}
const measurements = [];
for (const record of reference.records) {
  const series = computeSkySeries({ id: 'independent-reference', site: {
    id: 'reference', name: 'Reference', ...record.site, surfaceElevationM: 0,
    observerHeightM: 2, kind: 'custom', sourceIds: [],
  }, startUtc: '2026-01-01T00:00:00.000Z', endUtc: '2026-01-01T02:00:00.000Z', stepSeconds: 600 }, dataset);
  const rows = record.table.split('\n');
  if (rows.length !== series.timesUtc.length) throw new Error('Reference time count mismatch');
  rows.forEach((row: string, i: number) => {
    const fields = row.split(',');
    const az = Number(fields[3]);
    const alt = Number(fields[4]);
    const actualAz = record.body === 'sun' ? series.sunAzDeg[i] : series.earthAzDeg[i];
    const actualAlt = record.body === 'sun' ? series.sunAltDeg[i] : series.earthAltDeg[i];
    const a = direction(az, alt), b = direction(actualAz, actualAlt);
    const chord = Math.hypot(...a.map((v, j) => v - b[j]));
    const separationDeg = 2 * Math.asin(Math.min(1, chord / 2)) / rad;
    measurements.push({ site: record.site, body: record.body, timeUtc: series.timesUtc[i],
      referenceAzDeg: az, referenceAltDeg: alt, actualAzDeg: actualAz, actualAltDeg: actualAlt, separationDeg });
  });
}
const maxSeparationDeg = Math.max(...measurements.map(m => m.separationDeg));
const report = { targetDeg: 0.1, maxSeparationDeg, passed: maxSeparationDeg <= 0.1,
  comparison: 'SPICE DE440s geometric IAU_MOON vs Horizons DE441 airless apparent lunar surface observer. Frame/correction differences are included, not fitted away.',
  limitations: 'Three sites x thirteen ten-minute times over two hours. Between-grid error is measured here, not guaranteed for other dates or datasets.', measurements };
await writeFile(new URL('validation-report.json', base), JSON.stringify(report, null, 2) + '\n');
console.log(JSON.stringify({ count: measurements.length, maxSeparationDeg, targetDeg: 0.1, passed: report.passed }));
if (!report.passed) process.exitCode = 1;
