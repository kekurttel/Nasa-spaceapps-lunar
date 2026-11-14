export type Vector3 = { x: number; y: number; z: number };

export type MoonFixedSample = {
  timeUtc: string;
  sunKm: Vector3;
  earthKm: Vector3;
};

export type MoonFixedDataset = {
  id: string;
  frame: string;
  source: string;
  sourceUrl: string;
  timeScale: 'UTC';
  corrections: 'geometric';
  dataKind: 'real' | 'synthetic';
  samples: MoonFixedSample[];
};

export type EphemerisErrorCode =
  | 'EPHEMERIS_INVALID_DATASET'
  | 'EPHEMERIS_INVALID_METADATA'
  | 'EPHEMERIS_INVALID_DATE'
  | 'EPHEMERIS_INVALID_SAMPLES'
  | 'EPHEMERIS_INVALID_VECTOR'
  | 'EPHEMERIS_OUT_OF_RANGE';

export class EphemerisVectorError extends Error {
  readonly code: EphemerisErrorCode;

  constructor(code: EphemerisErrorCode, message: string) {
    super(`${code}: ${message}`);
    this.name = 'EphemerisVectorError';
    this.code = code;
  }
}

function fail(code: EphemerisErrorCode, message: string): never {
  throw new EphemerisVectorError(code, message);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function parseUtc(value: unknown, label: string): number {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?Z$/.test(value)) {
    return fail('EPHEMERIS_INVALID_DATE', `${label} must be an ISO UTC timestamp ending in Z`);
  }
  const milliseconds = Date.parse(value);
  if (!Number.isFinite(milliseconds) || new Date(milliseconds).toISOString() !== normalizeIso(value)) {
    return fail('EPHEMERIS_INVALID_DATE', `${label} is not a valid round-tripping UTC date`);
  }
  return milliseconds;
}

function normalizeIso(value: string): string {
  const [whole, fraction] = value.slice(0, -1).split('.');
  return `${whole}.${(fraction ?? '').padEnd(3, '0')}Z`;
}

function validateDataset(dataset: unknown): asserts dataset is MoonFixedDataset {
  if (!isRecord(dataset)) fail('EPHEMERIS_INVALID_DATASET', 'dataset must be an object');
  if (dataset.frame !== 'IAU_MOON') fail('EPHEMERIS_INVALID_METADATA', "frame must be 'IAU_MOON'");
  if (typeof dataset.id !== 'string' || !dataset.id.trim() || typeof dataset.source !== 'string' || !dataset.source.trim()) {
    fail('EPHEMERIS_INVALID_METADATA', 'id and source must be non-empty strings');
  }
  if (typeof dataset.sourceUrl !== 'string' || !dataset.sourceUrl.trim()) {
    fail('EPHEMERIS_INVALID_METADATA', 'sourceUrl must be a non-empty URL');
  }
  try {
    new URL(dataset.sourceUrl);
  } catch {
    fail('EPHEMERIS_INVALID_METADATA', 'sourceUrl must be an absolute URL');
  }
  if (dataset.timeScale !== 'UTC' || dataset.corrections !== 'geometric') {
    fail('EPHEMERIS_INVALID_METADATA', "timeScale must be UTC and corrections must be 'geometric'");
  }
  if (dataset.dataKind !== 'real' && dataset.dataKind !== 'synthetic') {
    fail('EPHEMERIS_INVALID_METADATA', "dataKind must be 'real' or 'synthetic'");
  }
  if (!Array.isArray(dataset.samples) || dataset.samples.length < 2) {
    fail('EPHEMERIS_INVALID_SAMPLES', 'at least two samples are required');
  }
  let previous = -Infinity;
  dataset.samples.forEach((sample, index) => {
    if (!isRecord(sample)) fail('EPHEMERIS_INVALID_SAMPLES', `sample ${index} must be an object`);
    const current = parseUtc(sample.timeUtc, `sample ${index} timeUtc`);
    if (current <= previous) fail('EPHEMERIS_INVALID_SAMPLES', 'sample times must be strictly ascending');
    previous = current;
    for (const key of ['sunKm', 'earthKm'] as const) {
      const vector = sample[key];
      if (!isRecord(vector) || !['x', 'y', 'z'].every((axis) => typeof vector[axis] === 'number' && Number.isFinite(vector[axis]))) {
        fail('EPHEMERIS_INVALID_VECTOR', `sample ${index} ${key} must contain finite x, y, z numbers`);
      }
    }
  });
}

/** Linearly samples geometric, UTC-indexed IAU_MOON vectors; performs no UTC/TDB or frame conversion. */
export function createMoonFixedSampler(dataset: MoonFixedDataset): (timeUtc: string) => MoonFixedSample {
  validateDataset(dataset);
  // Copy all validated values so later caller mutations cannot alter this sampler's results.
  const samples = dataset.samples.map((sample) => ({
    timeUtc: sample.timeUtc,
    sunKm: { ...sample.sunKm },
    earthKm: { ...sample.earthKm },
  }));
  const times = samples.map((sample) => Date.parse(sample.timeUtc));
  const first = times[0];
  const last = times[times.length - 1];

  return (timeUtc: string): MoonFixedSample => {
    const target = parseUtc(timeUtc, 'timeUtc');
    if (target < first || target > last) {
      fail('EPHEMERIS_OUT_OF_RANGE', 'requested time is outside dataset coverage; extrapolation is not supported');
    }

    let low = 0;
    let high = times.length - 1;
    while (low <= high) {
      const middle = (low + high) >>> 1;
      if (times[middle] === target) {
        const exact = samples[middle];
        return { timeUtc, sunKm: { ...exact.sunKm }, earthKm: { ...exact.earthKm } };
      }
      if (times[middle] < target) low = middle + 1;
      else high = middle - 1;
    }

    const lower = samples[high];
    const upper = samples[low];
    const fraction = (target - times[high]) / (times[low] - times[high]);
    const interpolate = (a: Vector3, b: Vector3): Vector3 => ({
      x: a.x + (b.x - a.x) * fraction,
      y: a.y + (b.y - a.y) * fraction,
      z: a.z + (b.z - a.z) * fraction,
    });
    return { timeUtc, sunKm: interpolate(lower.sunKm, upper.sunKm), earthKm: interpolate(lower.earthKm, upper.earthKm) };
  };
}

/** Backward-compatible one-shot sampling helper. */
export function sampleMoonFixedVectors(dataset: MoonFixedDataset, timeUtc: string): MoonFixedSample {
  return createMoonFixedSampler(dataset)(timeUtc);
}
