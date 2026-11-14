import type { MoonFixedDataset, Vector3 } from './vectorData.ts';

/** Conservative diagnostics, not a replacement for independent source validation. */
export function datasetWarnings(dataset: MoonFixedDataset): string[] {
  const warnings = new Set<string>();
  if (dataset.dataKind !== 'real') return [];
  const length = (v: Vector3) => Math.hypot(v.x, v.y, v.z);
  for (let i = 0; i < dataset.samples.length; i++) {
    const sample = dataset.samples[i];
    for (const body of ['sunKm', 'earthKm'] as const) {
      const distance = length(sample[body]);
      const [min, max] = body === 'sunKm' ? [130e6, 170e6] : [300000, 450000];
      if (distance < min || distance > max) warnings.add(`Potential outlier: ${body} magnitude outside conservative Moon-center bounds (${min}–${max} km). Verify source; data is not modified.`);
      if (i === 0) continue;
      const previous = dataset.samples[i - 1];
      const hours = (Date.parse(sample.timeUtc) - Date.parse(previous.timeUtc)) / 3600000;
      const a = previous[body], b = sample[body], la = length(a);
      const chord = Math.hypot(a.x / la - b.x / distance, a.y / la - b.y / distance, a.z / la - b.z / distance);
      const rate = 2 * Math.asin(Math.min(1, chord / 2)) * 180 / Math.PI / hours;
      if (!Number.isFinite(rate) || rate > 2) warnings.add(`Potential discontinuity: ${body} direction changes by more than 2 deg/hour. Verify cadence and frame; data is not modified.`);
    }
  }
  return [...warnings];
}
