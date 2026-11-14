export const POLAR_SNAPSHOT_CONTRACT = 'polar-illumination-snapshot/v1';
const REQUIRED_FRAME = 'MOON_ME_DE421';
const CELL_COUNT = 9;
const TIME_COUNT = 3;

function isRecord(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function validUtc(value, name) {
  if (typeof value !== 'string' || !/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d(?:\.\d{1,3})?Z$/.test(value)) {
    throw new TypeError(`${name} must be an explicit UTC timestamp ending in Z`);
  }
  const millis = Date.parse(value);
  const normalized = value.replace(/(?:\.(\d{1,3}))?Z$/, (_, digits) => `.${(digits ?? '').padEnd(3, '0')}Z`);
  if (!Number.isFinite(millis) || new Date(millis).toISOString() !== normalized) {
    throw new TypeError(`${name} must be a valid UTC timestamp`);
  }
  return millis;
}

function validateInputs(grid, cells, timesUtc, evaluateSite, quality) {
  if (!isRecord(grid) || grid.width !== 3 || grid.height !== 3 || grid.units !== 'm' ||
      typeof grid.crs !== 'string' || !grid.crs.trim() ||
      /GEOGCRS|GEOGCS|4326|4269|4258|CRS\s*:?\s*84|geographic|longlat|latlong/i.test(grid.crs)) {
    throw new TypeError('grid must be a projected 3x3 metric grid');
  }
  if (grid.frame !== REQUIRED_FRAME || !Number.isFinite(grid.epoch)) throw new TypeError(`grid.frame must be ${REQUIRED_FRAME} with finite epoch`);
  for (const key of ['originXM', 'originYM']) if (!Number.isFinite(grid[key])) throw new TypeError(`grid.${key} must be finite`);
  for (const key of ['pixelSizeXM', 'pixelSizeYM']) if (!Number.isFinite(grid[key]) || grid[key] <= 0) throw new TypeError(`grid.${key} must be finite and positive`);
  if (grid.pixelSizeXM !== 80 || grid.pixelSizeYM !== 80) throw new TypeError('grid pixel sizes must be 80 m');
  if (grid.originConvention !== 'cell-corner' || grid.xAxis !== 'projected-x-positive' || grid.yAxis !== 'projected-y-positive' || grid.rowDirection !== 'decreasing-y') {
    throw new TypeError('grid requires cell-corner origin, projected-positive axes, and decreasing-y rows');
  }
  if (!Array.isArray(cells) || cells.length !== CELL_COUNT) throw new TypeError('cells must contain exactly 9 row-major cell coordinates');
  for (let i = 0; i < CELL_COUNT; i++) {
    const cell = cells[i];
    const column = i % 3;
    const row = Math.floor(i / 3);
    const expectedX = grid.originXM + (column + 0.5) * grid.pixelSizeXM;
    const expectedY = grid.originYM - (row + 0.5) * grid.pixelSizeYM;
    const tolerance = 1e-9 * Math.max(1, Math.abs(expectedX), Math.abs(expectedY));
    if (!isRecord(cell) || cell.index !== i || !Number.isFinite(cell.xM) || !Number.isFinite(cell.yM) ||
        Math.abs(cell.xM - expectedX) > tolerance || Math.abs(cell.yM - expectedY) > tolerance) {
      throw new TypeError(`cells[${i}] coordinates must match projected row-major grid center`);
    }
  }
  if (!Array.isArray(timesUtc) || timesUtc.length !== TIME_COUNT) throw new TypeError('timesUtc must contain exactly 3 UTC instants');
  for (let i = 0; i < TIME_COUNT; i++) if (!(i in timesUtc)) throw new TypeError(`timesUtc[${i}] must be present`);
  const timestamps = timesUtc.map((time, i) => validUtc(time, `timesUtc[${i}]`));
  if (timestamps.some((time, i) => i > 0 && time <= timestamps[i - 1])) throw new TypeError('timesUtc must be strictly increasing');
  if (typeof evaluateSite !== 'function') throw new TypeError('evaluateSite must be a function');
  if (!isRecord(quality)) throw new TypeError('quality provenance object is required');
}

function warningsOf(...objects) {
  const warnings = [];
  for (const object of objects) {
    const values = object?.warnings ?? object?.quality?.warnings;
    if (values === undefined) continue;
    if (!Array.isArray(values) || values.some((warning) => typeof warning !== 'string')) throw new TypeError('warnings must be an array of strings');
    warnings.push(...values);
  }
  return warnings;
}

function validateEvaluation(result, timesUtc, grid, cellIndex) {
  if (!isRecord(result)) throw new TypeError(`evaluation for cell ${cellIndex} must be an object`);
  if (result.status === 'NoData') {
    if (result.frame !== grid.frame) throw new TypeError(`NoData evaluation for cell ${cellIndex} frame mismatch`);
    if (!isRecord(result.provenance) || !Object.keys(result.provenance).length || typeof result.reason !== 'string' || !result.reason.trim()) {
      throw new TypeError(`NoData evaluation for cell ${cellIndex} requires reason and provenance`);
    }
    return { fractions: Array(TIME_COUNT).fill(null), warnings: warningsOf(result) };
  }
  if (result.status !== undefined && result.status !== 'ok') throw new TypeError(`evaluation for cell ${cellIndex} has unsupported status`);
  if (result.frame !== grid.frame) throw new TypeError(`evaluation for cell ${cellIndex} frame mismatch`);
  if (!isRecord(result.provenance) || !Object.keys(result.provenance).length) throw new TypeError(`evaluation for cell ${cellIndex} requires provenance`);
  if (!isRecord(result.sky) || result.sky.frame !== 'ME_DE421_LOCAL_NORTH_EAST' || result.sky.quality?.frame !== 'ME_DE421_LOCAL_NORTH_EAST') throw new TypeError(`evaluation for cell ${cellIndex} sky frame metadata mismatch`);
  if (!Array.isArray(result.sky.timesUtc) || result.sky.timesUtc.length !== TIME_COUNT ||
      Array.from({ length: TIME_COUNT }, (_, i) => !(i in result.sky.timesUtc) || result.sky.timesUtc[i] !== timesUtc[i]).some(Boolean)) throw new TypeError(`evaluation for cell ${cellIndex} response times mismatch`);
  if (!isRecord(result.visibility) || !Array.isArray(result.visibility.timesUtc) ||
      result.visibility.timesUtc.length !== TIME_COUNT || Array.from({ length: TIME_COUNT }, (_, i) => !(i in result.visibility.timesUtc) || result.visibility.timesUtc[i] !== timesUtc[i]).some(Boolean)) {
    throw new TypeError(`evaluation for cell ${cellIndex} visibility times mismatch`);
  }
  const fractions = result.visibility.sunVisibleFraction;
  if (!Array.isArray(fractions) || fractions.length !== TIME_COUNT) throw new TypeError(`evaluation for cell ${cellIndex} fractions must contain 3 values`);
  for (let i = 0; i < TIME_COUNT; i++) {
    if (!(i in fractions) || !Number.isFinite(fractions[i]) || fractions[i] < 0 || fractions[i] > 1) {
      throw new TypeError(`evaluation for cell ${cellIndex} fraction ${i} must be finite and in [0, 1]`);
    }
  }
  return { fractions: [...fractions], warnings: warningsOf(result, result.sky, result.visibility) };
}

/** Build bounded snapshots from existing per-site horizon/sky/visibility evaluations. */
export async function producePolarSnapshots({ grid, cells, timesUtc, evaluateSite, quality }) {
  validateInputs(grid, cells, timesUtc, evaluateSite, quality);
  const frames = timesUtc.map((timestampUtc) => ({ timestampUtc, fractions: Array(CELL_COUNT) }));
  const warnings = warningsOf({ warnings: quality.warnings ?? [] });
  const evaluations = [];
  for (const cell of cells) {
    const result = await evaluateSite({ cell: { ...cell }, timesUtc: [...timesUtc] });
    const validated = validateEvaluation(result, timesUtc, grid, cell.index);
    evaluations.push({ cellIndex: cell.index, source: result.provenance ?? result.quality ?? null, warnings: validated.warnings });
    warnings.push(...validated.warnings);
    for (let t = 0; t < TIME_COUNT; t++) frames[t].fractions[cell.index] = validated.fractions[t];
  }
  if (frames.some((frame) => frame.fractions.some((value, i) => !(i in frame.fractions) || (value !== null && (!Number.isFinite(value) || value < 0 || value > 1))))) {
    throw new TypeError('snapshot fractions must be dense 0..1 or explicit null NoData');
  }
  if (frames.every((frame) => frame.fractions.every((value) => value === null))) throw new TypeError('all grid cells are NoData');
  return {
    schemaVersion: POLAR_SNAPSHOT_CONTRACT,
    quantity: 'visible-solar-disk-fraction',
    timestampsUtc: [...timesUtc],
    grid: structuredClone(grid),
    cells: cells.map((cell) => ({ ...cell })),
    frames,
    quality: {
      ...structuredClone(quality),
      frame: grid.frame,
      evaluations,
      warnings,
      timeSemantics: 'three-explicit-UTC-instants; snapshots only; no interval support',
    },
  };
}
