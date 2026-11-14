const freezeDeep = value => {
  if (value && typeof value === 'object' && !Object.isFrozen(value)) {
    Object.freeze(value);
    for (const child of Object.values(value)) freezeDeep(child);
  }
  return value;
};

export const sources = freezeDeep([
  {
    id: 'nasa-nssdc-apollo',
    url: 'https://nssdc.gsfc.nasa.gov/planetary/lunar/lunar_sites.html',
    productId: 'Apollo Landing Site Coordinates; Apollo 11/12/14/15/16/17 Lunar Module rows',
    agency: 'NASA Goddard Space Flight Center, National Space Science Data Center (NSSDCA)',
    accessedDate: '2026-11-14',
    coordinateFrame: 'Planetocentric Mean Earth/Polar Axis Lunar Reference System, DE421 ephemeris (as stated by source).',
    usageTerms: 'No explicit license stated on source page. Factual coordinates transcribed with attribution; check NASA terms before redistributing source text or imagery.',
    evidence: 'The page explicitly identifies the frame and gives each Lunar Module latitude and east longitude. Values retained at the precision published by NASA.',
    coordinatePrecision: 'As published: 5 decimal places for Apollo 11/14/15; 4 for Apollo 12/16/17.',
    snapshotPath: 'src/features/data/sources/nasa-nssdc-apollo.md',
  },
  {
    id: 'nasa-im1-odysseus',
    url: 'https://www.nasa.gov/missions/lro/nasas-lro-images-intuitive-machines-odysseus-lander/',
    productId: 'NASA LRO images IM-1 Odysseus; LROC NAC frame M1463440322L',
    agency: 'NASA Goddard Space Flight Center / Arizona State University',
    accessedDate: '2026-11-14',
    coordinateFrame: 'Not specified by this source; use only its rounded published coordinates, without asserting a named realization.',
    usageTerms: 'NASA content; NASA/Goddard/ASU attribution shown, no explicit license statement. Check NASA/ASU terms before reusing text or imagery.',
    evidence: 'Source says landed at 80.13° south, 1.44° east and elevation 8,461 ft (2,579 m); frame M1463440322L. Coordinates are rounded to 0.01°.',
    coordinatePrecision: '0.01° as published; no more precision inferred.',
    snapshotPath: 'src/features/data/sources/nasa-im1-odysseus.md',
  },
  {
    id: 'lroc-blue-ghost',
    url: 'https://www.lroc.im-ldi.com/images/1407',
    productId: 'LROC featured image “Blue Ghost Lunar Lander Seen From Above”; NAC M1495619099LR',
    agency: 'NASA/GSFC/Arizona State University LROC Science Operations Center',
    accessedDate: '2026-11-14',
    coordinateFrame: 'Not specified by this source; no ME/PA or DE421 precision is asserted.',
    usageTerms: 'Follow https://www.lroc.im-ldi.com/about/terms; credit NASA/GSFC/Arizona State University.',
    evidence: 'Source explicitly reports landed Blue Ghost coordinates 18.5623°N, 61.8103°E, elevation -3650 m, at image center.',
    coordinatePrecision: '0.0001° as published; no more precision inferred.',
    snapshotPath: 'src/features/data/sources/lroc-blue-ghost.md',
  },
  {
    id: 'nasa-viper-mons-mouton',
    url: 'https://www.nasa.gov/news-release/nasa-selects-mons-mouton-for-viper-moon-rover-touchdown/',
    productId: 'NASA release: NASA Selects Mons Mouton for VIPER Moon Rover Touchdown',
    agency: 'NASA',
    accessedDate: '2026-11-14',
    coordinateFrame: 'No point coordinates/frame published; historical selection of named Mons Mouton region only.',
    usageTerms: 'NASA release; no explicit license stated. Attribute NASA and check NASA terms before reuse.',
    evidence: 'At announcement time NASA selected Mons Mouton as a VIPER planned touchdown region, but supplied no point coordinate. The Site point is separately sourced as USGS Gazetteer feature centre, not touchdown point.',
    coordinatePrecision: 'No point coordinates published by NASA; no point precision claimed.',
    snapshotPath: 'src/features/data/sources/nasa-viper-mons-mouton.md',
  },
  {
    id: 'usgs-mons-mouton',
    url: 'https://planetarynames.wr.usgs.gov/Feature/16070',
    productId: 'Gazetteer of Planetary Nomenclature feature 16070 Mons Mouton; Control Network LOLA 2011',
    agency: 'USGS Astrogeology Science Center / IAU Working Group for Planetary System Nomenclature (NASA-supported)',
    accessedDate: '2026-11-14',
    coordinateFrame: 'Planetographic, east-positive, longitude [-180, 180], as stated in the Gazetteer; centre of named feature.',
    usageTerms: 'USGS/DOI website; follow applicable USGS legal/site terms and attribute Gazetteer of Planetary Nomenclature / IAU.',
    evidence: 'Feature record explicitly gives Mons Mouton centre at -84.60°, +31.00° and approximate diameter 130 km. Used only as representative point for the named planned region, never as touchdown point.',
    coordinatePrecision: '0.01° as published for the feature centre; no touchdown precision claimed.',
    snapshotPath: 'src/features/data/sources/usgs-mons-mouton.md',
  },

]);

const apollo = [
  ['apollo-11', 'Apollo 11 Lunar Module', 0.67416, 23.47314],
  ['apollo-12', 'Apollo 12 Lunar Module', -3.0128, -23.4219],
  ['apollo-14', 'Apollo 14 Lunar Module', -3.64589, -17.47194],
  ['apollo-15', 'Apollo 15 Lunar Module', 26.13239, 3.63330],
  ['apollo-16', 'Apollo 16 Lunar Module', -8.9734, 15.5011],
  ['apollo-17', 'Apollo 17 Lunar Module', 20.1911, 30.7723],
].map(([id, name, latDeg, lonDeg]) => ({
  id, name, latDeg, lonDeg, surfaceElevationM: null, observerHeightM: 1.6, kind: 'landed', sourceIds: ['nasa-nssdc-apollo'],
}));

export const sites = freezeDeep([
  ...apollo,
  {
    id: 'im-1-odysseus', name: 'IM-1 Odysseus landed location (Malapert A region)', latDeg: -80.13, lonDeg: 1.44,
    surfaceElevationM: 2579, observerHeightM: 1.6, kind: 'landed', sourceIds: ['nasa-im1-odysseus'],
  },
  {
    id: 'blue-ghost-m1', name: 'Blue Ghost Mission 1 landed location', latDeg: 18.5623, lonDeg: 61.8103,
    surfaceElevationM: -3650, observerHeightM: 1.6, kind: 'landed', sourceIds: ['lroc-blue-ghost'],
  },
  {
    id: 'viper-mons-mouton-region', name: 'Mons Mouton feature centre (representative marker for announced VIPER region)',
    latDeg: -84.60, lonDeg: 31.00, surfaceElevationM: null, observerHeightM: 1.6,
    kind: 'planned-region', sourceIds: ['nasa-viper-mons-mouton', 'usgs-mons-mouton'],
  },
]);

export const dataManifest = freezeDeep({
  id: 'lunar-site-catalog',
  version: '1.0.0',
  dataKind: 'real',
  sourceIds: sources.map(source => source.id),
  dateCoverage: null,
  locationCoverage: { latMinDeg: -90, latMaxDeg: 90, lonMinDeg: -180, lonMaxDeg: 180 },
  metadata: {
    description: 'Globally distributed discrete point catalogue; not spatially continuous coverage of the Moon. Includes landed points and a clearly labeled named-feature representative point for a historically announced region.',
    noEphemeris: true,
    terrainCoverage: false,
    coordinateScope: 'Only locations represented by individual Site records; locationCoverage is the legal coordinate domain, not proof that data exists everywhere in it.',
    observerHeightNote: 'observerHeightM is a catalogue application convention (1.6 m), not a measurement reported by the coordinate sources.',
    sourceNotes: 'Coordinate frame, source precision, derivation status, and limitations are recorded per source. Surface elevations are retained only where the cited source supplies them; differing or unspecified vertical datums are not harmonized.',
  },
});

/** Validate catalogue records and provenance without importing the scenario validator. */
export function validateCatalog(siteRecords = sites, sourceRecords = sources) {
  const errors = [];
  const fail = (field, code, message) => errors.push({ field, code, message });
  if (!Array.isArray(siteRecords)) return { ok: false, errors: [{ field: 'sites', code: 'invalid_array', message: 'Sites must be an array.' }] };
  if (!Array.isArray(sourceRecords)) return { ok: false, errors: [{ field: 'sources', code: 'invalid_array', message: 'Sources must be an array.' }] };
  const sourceIds = new Set();
  sourceRecords.forEach((source, index) => {
    const field = `sources[${index}]`;
    if (!source || typeof source !== 'object' || Array.isArray(source)) { fail(field, 'invalid_object', 'Source must be an object.'); return; }
    if (typeof source.id !== 'string' || !source.id.trim()) fail(`${field}.id`, 'required', 'Source id must be a nonblank string.');
    else if (sourceIds.has(source.id)) fail(`${field}.id`, 'duplicate_id', `Duplicate source id: ${source.id}.`);
    else sourceIds.add(source.id);
    for (const key of ['url', 'productId', 'agency', 'accessedDate', 'coordinateFrame', 'usageTerms', 'evidence', 'coordinatePrecision']) {
      if (typeof source[key] !== 'string' || !source[key].trim()) fail(`${field}.${key}`, 'required', `${key} must be a nonblank string.`);
    }
    if (typeof source.url === 'string' && source.url.trim()) {
      try { if (!['http:', 'https:'].includes(new URL(source.url).protocol)) throw new Error('unsupported protocol'); }
      catch { fail(`${field}.url`, 'invalid_url', 'Source URL must be an absolute HTTP(S) URL.'); }
    }
    if (typeof source.accessedDate === 'string') {
      const date = source.accessedDate;
      const parsed = /^\d{4}-\d{2}-\d{2}$/.test(date) ? new Date(`${date}T00:00:00.000Z`) : null;
      if (!parsed || Number.isNaN(parsed.valueOf()) || parsed.toISOString().slice(0, 10) !== date) fail(`${field}.accessedDate`, 'invalid_date', 'accessedDate must be a valid ISO calendar date (YYYY-MM-DD).');
    }
  });
  const siteIds = new Set();
  const allowedKinds = new Set(['landed', 'planned-region', 'candidate', 'custom']);
  siteRecords.forEach((site, index) => {
    const field = `sites[${index}]`;
    if (!site || typeof site !== 'object' || Array.isArray(site)) { fail(field, 'invalid_object', 'Site must be an object.'); return; }
    for (const key of ['id', 'name']) if (typeof site[key] !== 'string' || !site[key].trim()) fail(`${field}.${key}`, 'required', `${key} must be a nonblank string.`);
    if (typeof site.id === 'string') {
      if (siteIds.has(site.id)) fail(`${field}.id`, 'duplicate_id', `Duplicate site id: ${site.id}.`);
      siteIds.add(site.id);
    }
    if (!allowedKinds.has(site.kind)) fail(`${field}.kind`, 'invalid_kind', 'kind must be landed, planned-region, candidate, or custom.');
    for (const key of ['latDeg', 'lonDeg', 'observerHeightM']) if (typeof site[key] !== 'number' || !Number.isFinite(site[key])) fail(`${field}.${key}`, 'invalid_number', `${key} must be a finite number.`);
    if (typeof site.latDeg === 'number' && Number.isFinite(site.latDeg) && (site.latDeg < -90 || site.latDeg > 90)) fail(`${field}.latDeg`, 'out_of_range', 'Latitude must be in [-90, 90].');
    if (typeof site.lonDeg === 'number' && Number.isFinite(site.lonDeg) && (site.lonDeg < -180 || site.lonDeg >= 180)) fail(`${field}.lonDeg`, 'out_of_range', 'Catalog longitude must be normalized to [-180, 180).');
    if (typeof site.observerHeightM === 'number' && site.observerHeightM < 0) fail(`${field}.observerHeightM`, 'out_of_range', 'observerHeightM must be nonnegative.');
    if (site.surfaceElevationM !== null && (typeof site.surfaceElevationM !== 'number' || !Number.isFinite(site.surfaceElevationM))) fail(`${field}.surfaceElevationM`, 'invalid_number', 'surfaceElevationM must be a finite number or null.');
    if (!Array.isArray(site.sourceIds) || site.sourceIds.length === 0 || site.sourceIds.some(id => typeof id !== 'string' || !id.trim())) fail(`${field}.sourceIds`, 'invalid_sources', 'sourceIds must be a nonempty array of nonblank source ids.');
    else {
      if (new Set(site.sourceIds).size !== site.sourceIds.length) fail(`${field}.sourceIds`, 'duplicate_source', 'sourceIds must not contain duplicates.');
      site.sourceIds.forEach((id, sourceIndex) => { if (!sourceIds.has(id)) fail(`${field}.sourceIds[${sourceIndex}]`, 'unknown_source', `Unknown source id: ${id}.`); });
    }
  });
  return errors.length ? { ok: false, errors } : { ok: true, value: { sites: siteRecords, sources: sourceRecords }, warnings: [] };
}
