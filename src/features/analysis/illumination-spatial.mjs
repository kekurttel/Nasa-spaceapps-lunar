const DEFAULT_MAX_COMPARISONS = 1_000_000;

function utc(value, name) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?Z$/.test(value)) throw new TypeError(`${name} must be an explicit UTC timestamp ending in Z`);
  const time = Date.parse(value);
  const normalized = value.replace(/(?:\.(\d{1,3}))?Z$/, (_, digits) => `.${(digits ?? '').padEnd(3, '0')}Z`);
  if (!Number.isFinite(time) || new Date(time).toISOString() !== normalized) throw new TypeError(`${name} must be a valid UTC timestamp`);
  return time;
}

function validate(grid, frames) {
  if (!grid || grid.units !== 'm' || typeof grid.crs !== 'string' || !grid.crs.trim() || /^(?:\s*(?:GEOGCRS|GEOGCS))|4326|4269|4258|CRS\s*:?\s*84|geographic|longlat|latlong/i.test(grid.crs)) throw new TypeError('grid requires a projected metric crs and units: m');
  for (const key of ['width', 'height']) if (!Number.isSafeInteger(grid[key]) || grid[key] <= 0) throw new TypeError(`grid.${key} must be a positive integer`);
  if (!Number.isSafeInteger(grid.width * grid.height)) throw new TypeError('grid dimensions exceed safe integer range');
  for (const key of ['originXM', 'originYM', 'pixelSizeXM', 'pixelSizeYM']) if (!Number.isFinite(grid[key]) || (key.startsWith('pixel') && grid[key] <= 0)) throw new TypeError(`grid.${key} must be finite${key.startsWith('pixel') ? ' and positive' : ''}`);
  if (!Number.isFinite(grid.originXM + grid.width * grid.pixelSizeXM) || !Number.isFinite(grid.originYM + grid.height * grid.pixelSizeYM)) throw new TypeError('grid extent must be finite');
  if (!Array.isArray(frames) || frames.length === 0) throw new TypeError('frames must be nonempty');
  const times = frames.map((frame, i) => {
    if (!frame || typeof frame !== 'object') throw new TypeError(`frames[${i}] is required`);
    // A single canonical grid applies to every frame; reject conflicting per-frame metadata.
    for (const key of ['width', 'height', 'crs', 'units', 'originXM', 'originYM', 'pixelSizeXM', 'pixelSizeYM']) {
      if ((key in frame && frame[key] !== grid[key]) || (frame.grid && frame.grid[key] !== grid[key])) throw new TypeError(`frames[${i}] grid/resolution change is not supported`);
    }
    if (!Array.isArray(frame.fractions) || frame.fractions.length !== grid.width * grid.height) throw new TypeError(`frames[${i}].fractions must match grid dimensions`);
    for (let j = 0; j < frame.fractions.length; j++) {
      const v = frame.fractions[j];
      if (v !== null && (!Number.isFinite(v) || v < 0 || v > 1)) throw new TypeError(`frames[${i}].fractions[${j}] must be null or in [0, 1]`);
    }
    const start = utc(frame.startUtc, `frames[${i}].startUtc`);
    const end = utc(frame.endUtc, `frames[${i}].endUtc`);
    if (end <= start) throw new TypeError('frame endUtc must be after startUtc');
    return { start, end };
  });
  for (let i = 1; i < times.length; i++) if (times[i].start < times[i - 1].end) throw new TypeError('frames must be ordered and nonoverlapping');
  return times;
}

function neighbors(index, grid) {
  const x = index % grid.width;
  const y = Math.floor(index / grid.width);
  const result = [];
  if (x > 0) result.push(index - 1);
  if (x + 1 < grid.width) result.push(index + 1);
  if (y > 0) result.push(index - grid.width);
  if (y + 1 < grid.height) result.push(index + grid.width);
  return result;
}

function components(mask, grid) {
  const seen = new Uint8Array(mask.length);
  const result = [];
  for (let i = 0; i < mask.length; i++) {
    if (!mask[i] || seen[i]) continue;
    const cells = [i];
    seen[i] = 1;
    for (let head = 0; head < cells.length; head++) for (const next of neighbors(cells[head], grid)) {
      if (mask[next] && !seen[next]) { seen[next] = 1; cells.push(next); }
    }
    result.push({ cells, cellCount: cells.length, areaM2: cells.length * grid.pixelSizeXM * grid.pixelSizeYM });
  }
  return result;
}

function center(index, grid) {
  return { index, xM: grid.originXM + (index % grid.width + 0.5) * grid.pixelSizeXM, yM: grid.originYM + (Math.floor(index / grid.width) + 0.5) * grid.pixelSizeYM };
}

function tree(points, depth = 0) {
  if (!points.length) return null;
  const axis = depth % 2 ? 'yM' : 'xM';
  points.sort((a, b) => a[axis] - b[axis] || a.index - b.index);
  const mid = Math.floor(points.length / 2);
  return { point: points[mid], axis, left: tree(points.slice(0, mid), depth + 1), right: tree(points.slice(mid + 1), depth + 1) };
}

// Supercover traversal: even corner-touching unknown cells prohibit a match.
function supportedSegment(a, b, known, grid) {
  let x = a.index % grid.width;
  let y = Math.floor(a.index / grid.width);
  const dx = b.index % grid.width - x;
  const dy = Math.floor(b.index / grid.width) - y;
  const sx = Math.sign(dx), sy = Math.sign(dy);
  let ix = 0, iy = 0;
  while (ix < Math.abs(dx) || iy < Math.abs(dy)) {
    const decision = (1 + 2 * ix) * Math.abs(dy) - (1 + 2 * iy) * Math.abs(dx);
    if (decision === 0) {
      if (!known[y * grid.width + x + sx] || !known[(y + sy) * grid.width + x]) return false;
      x += sx; y += sy; ix++; iy++;
    } else if (decision < 0) { x += sx; ix++; }
    else { y += sy; iy++; }
    if (!known[y * grid.width + x]) return false;
  }
  return true;
}

function nearest(root, point, known, grid, budget) {
  let best = null, distance = Infinity;
  function visit(node) {
    if (!node) return;
    if (++budget.used > budget.max) throw new RangeError('boundary nearest-neighbor comparison cap exceeded; reduce grid or raise maxComparisons');
    const delta = point[node.axis] - node.point[node.axis];
    const d = (point.xM - node.point.xM) ** 2 + (point.yM - node.point.yM) ** 2;
    if ((!best || d < distance || (d === distance && node.point.index < best.index)) && supportedSegment(point, node.point, known, grid)) { best = node.point; distance = d; }
    visit(delta < 0 ? node.left : node.right);
    if (delta * delta <= distance) visit(delta < 0 ? node.right : node.left);
  }
  visit(root);
  return best;
}

/**
 * Experimental grid analysis, not ray tracing or physical boundary tracking.
 * Input: {grid:{width,height,crs,units:'m',originXM,originYM,pixelSizeXM,pixelSizeYM},
 * frames:[{startUtc,endUtc,fractions}], scenario:{startUtc,endUtc}, maxComparisons?}.
 * Row-major arrays; null means unknown. Intervals are explicit half-open [start,end).
 * Positive fractions define illumination for migration/crossings; connectivity requires ===1.
 * Migration matches illuminated-side 4-neighbor boundary cell centers, directed old to new,
 * many-to-one allowed. Only contiguous frames and common known neighborhood support qualify.
 * Segment supercover must also be known in both frames. No map exterior boundary is inferred.
 * Velocity uses interval-start separation, not interval duration or inferred event timing.
 * Direction: degrees counterclockwise from projected +X; null for zero displacement.
 * KD-tree search has a global candidate-comparison cap (default 1,000,000); exceeding it
 * throws rather than returning approximate matches. Cells/components use linear storage.
 * Persistent corridors mean connected components of the fully-sunlit intersection, not
 * navigable routes. Returned only with complete scenario temporal coverage; unknown cells
 * cannot belong. No extrapolation beyond supplied intervals.
 */
export function analyzeIlluminationSpatial({ grid, frames, scenario, maxComparisons = DEFAULT_MAX_COMPARISONS }) {
  const times = validate(grid, frames);
  if (!Number.isSafeInteger(maxComparisons) || maxComparisons <= 0) throw new TypeError('maxComparisons must be a positive safe integer');
  const start = utc(scenario?.startUtc, 'scenario.startUtc');
  const end = utc(scenario?.endUtc, 'scenario.endUtc');
  if (end <= start) throw new TypeError('scenario.endUtc must be after scenario.startUtc');
  if (times.some((t) => t.start < start || t.end > end)) throw new TypeError('frames must lie inside scenario interval');
  const completeTemporalCoverage = times[0].start === start && times.at(-1).end === end && times.every((t, i) => !i || t.start === times[i - 1].end);
  const size = grid.width * grid.height;
  const crossingsPerCell = Array(size).fill(0);
  let stableLitCells = 0, stableDarkCells = 0, variableCells = 0, unknownCells = 0;
  for (let cell = 0; cell < size; cell++) {
    let unknown = !completeTemporalCoverage, lit = false, dark = false;
    for (let i = 0; i < frames.length; i++) {
      const value = frames[i].fractions[cell];
      if (value === null) unknown = true;
      else if (value > 0) lit = true;
      else dark = true;
      if (i && times[i].start === times[i - 1].end && value !== null && frames[i - 1].fractions[cell] !== null && (value > 0) !== (frames[i - 1].fractions[cell] > 0)) crossingsPerCell[cell]++;
    }
    if (unknown) unknownCells++;
    else if (lit && dark) variableCells++;
    else if (lit) stableLitCells++;
    else stableDarkCells++;
  }
  const budget = { used: 0, max: maxComparisons };
  const transitions = [];
  for (let f = 1; f < frames.length; f++) {
    if (times[f].start !== times[f - 1].end) {
      transitions.push({ fromFrame: f - 1, toFrame: f, status: 'gap', matches: [] });
      continue;
    }
    const old = frames[f - 1].fractions, next = frames[f].fractions;
    const known = old.map((v, i) => v !== null && next[i] !== null);
    const supported = known.map((v, i) => v && neighbors(i, grid).every((j) => known[j]));
    const boundary = (values) => values.flatMap((v, i) => supported[i] && v > 0 && neighbors(i, grid).some((j) => values[j] === 0) ? [center(i, grid)] : []);
    const before = boundary(old), after = boundary(next), root = tree(after);
    const elapsedSeconds = (times[f].start - times[f - 1].start) / 1000;
    const matches = [];
    for (const from of before) {
      const to = nearest(root, from, known, grid, budget);
      if (!to) continue;
      const dxM = to.xM - from.xM, dyM = to.yM - from.yM;
      const displacementM = Math.hypot(dxM, dyM), velocityMps = displacementM / elapsedSeconds;
      matches.push({ fromCell: from.index, toCell: to.index, from, to, dxM, dyM, displacementM, velocityMps, velocityKmh: velocityMps * 3.6, directionDegrees: displacementM === 0 ? null : (Math.atan2(dyM, dxM) * 180 / Math.PI + 360) % 360 });
    }
    transitions.push({ fromFrame: f - 1, toFrame: f, status: 'contiguous', elapsedSeconds, sourceBoundaryCells: before.length, targetBoundaryCells: after.length, unmatchedSourceCells: before.length - matches.length, matches });
  }
  const persistentMask = Array.from({ length: size }, (_, i) => frames.every((frame) => frame.fractions[i] === 1));
  return {
    experimental: true,
    method: 'nearest boundary geometry; not tracked physical correspondence; not ray tracing',
    boundaryRule: 'fraction > 0 versus fraction === 0; illuminated-side 4-neighbor cell centers',
    connectivityRule: '4-neighbor fraction === 1; null is unknown, not dark',
    completeTemporalCoverage,
    migration: { transitions, comparisons: budget.used, maxComparisons },
    variability: { crossingsPerCell, repeatedCrossingCells: crossingsPerCell.filter((n) => n > 1).length, stableLitCells, stableDarkCells, variableCells, unknownCells },
    connectivity: {
      frames: frames.map((frame, i) => ({ frame: i, unknownCells: frame.fractions.filter((v) => v === null).length, components: components(frame.fractions.map((v) => v === 1), grid) })),
      persistent: { status: completeTemporalCoverage ? 'complete' : 'incomplete-temporal-coverage', components: completeTemporalCoverage ? components(persistentMask, grid) : null },
    },
  };
}
