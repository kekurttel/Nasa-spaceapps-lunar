const deepFreeze = value => {
  if (value && typeof value === 'object' && !Object.isFrozen(value)) {
    Object.freeze(value);
    for (const child of Object.values(value)) deepFreeze(child);
  }
  return value;
};

export const polarRegionSources = deepFreeze([
  {
    id: 'usgs-shackleton',
    agency: 'USGS/IAU',
    usageTerms: 'Usage and redistribution terms not verified; consult the source provider before redistribution.',
    url: 'https://planetarynames.wr.usgs.gov/Feature/5450',
    productId: 'USGS/IAU Gazetteer feature 5450, Shackleton crater; first Control Network coordinate set (exact network name unknown; multiple sets listed)',
    accessedDate: '2026-11-14',
    coordinateVerbatim: 'Coordinate System: Planetographic, +East, -180 - 180; Center Latitude -89.67 °; Center Longitude 129.78 °; Diameter 20.92 km.',
    derivation: 'Transcribed Control Network feature-centre latitude and east longitude; no transformation or precision extension.',
    coordinateFrame: 'Planetographic, east-positive, longitude [-180, 180], as stated by the Gazetteer; source centre is approximate crater-centre reference, not a rim point.',
    identityLimitations: 'The catalogue request is the Shackleton crater rim. Gazetteer coordinates identify the crater centre and do not locate any particular rim site or landing area.',
  },
  {
    id: 'usgs-de-gerlache',
    agency: 'USGS/IAU',
    usageTerms: 'Usage and redistribution terms not verified; consult the source provider before redistribution.',
    url: 'https://planetarynames.wr.usgs.gov/Feature/1439',
    productId: 'USGS/IAU Gazetteer feature 1439, de Gerlache crater; Control Network coordinate set',
    accessedDate: '2026-11-14',
    coordinateVerbatim: 'Coordinate System: Planetographic, +East, -180 - 180; Center Latitude -88.48 °; Center Longitude -88.34 °; Diameter 32.71 km.',
    derivation: 'Transcribed Control Network feature-centre latitude and east longitude; no transformation or precision extension.',
    coordinateFrame: 'Planetographic, east-positive, longitude [-180, 180], as stated by the Gazetteer; source centre is approximate crater-centre reference, not a rim point.',
    identityLimitations: 'The catalogue request is the de Gerlache crater rim. Gazetteer coordinates identify the crater centre and do not locate any particular rim site or landing area.',
  },
  {
    id: 'usgs-nobile',
    agency: 'USGS/IAU',
    usageTerms: 'Usage and redistribution terms not verified; consult the source provider before redistribution.',
    url: 'https://planetarynames.wr.usgs.gov/Feature/4321',
    productId: 'USGS/IAU Gazetteer feature 4321, Nobile crater; Control Network coordinate set',
    accessedDate: '2026-11-14',
    coordinateVerbatim: 'Coordinate System: Planetographic, +East, -180 - 180; Center Latitude -85.28 °; Center Longitude 53.27 °; Diameter 79.27 km.',
    derivation: 'Transcribed Control Network feature-centre latitude and east longitude; no transformation or precision extension.',
    coordinateFrame: 'Planetographic, east-positive, longitude [-180, 180], as stated by the Gazetteer; source centre is an approximate crater-centre reference.',
    identityLimitations: 'This is a representative crater centre only; a requested subregion, rim segment, or landing area within Nobile is unspecified.',
  },
  {
    id: 'nasa-pgda-south-pole-dem',
    agency: 'NASA GSFC PGDA',
    usageTerms: 'Usage and redistribution terms not verified; consult the source provider before redistribution.',
    url: 'https://pgda.gsfc.nasa.gov/data/LOLA_5mpp/',
    productId: 'South Pole Landing Site LOLA DEMs, site-indexed LDEM products',
    accessedDate: '2026-11-14',
    coordinateVerbatim: 'The sites are: Site04: Shackleton rim; Site11: de Gerlache rim; Site23: Malapert massif. All these files (except the points clouds) are 5 m/pix GeoTiffs with south polar stereographic X/Y coords in meters, MOON_ME reference frame of ephemeris DE421.',
    derivation: 'Direct transcription of named site associations, raster resolution, projection, and frame. No latitude/longitude was derived because no site coordinates or raster transform was established here.',
    coordinateFrame: 'MOON_ME reference frame of ephemeris DE421; south polar stereographic X/Y for the stated DEMs.',
    identityLimitations: 'Dataset confirms named coverage products, not exact target coordinates or footprints in geographic degrees. Site04/Site11/Site23 do not locate a specific point on their named terrain.',
  },
]);

const requestedAreaLimit = 'Named area is broader than any source point; subregion is unspecified, so representative coordinates must not be treated as a rim/massif landing location.';
const demLimit = 'LDEM_80S_80M geographic coverage is a candidate only; no raster sampling was performed. These control-network coordinates are planetographic and their exact realization is unverified, whereas the DEM is planetocentric MOON_ME DE421; a verified coordinate-frame conversion is required before sampling.';

export const polarRegions = deepFreeze([
  {
    id: 'shackleton-rim',
    name: 'Shackleton crater (centre marker; rim unlocated)',
    latDeg: -89.67,
    lonDeg: 129.78,
    regionType: 'crater',
    requestedRegionType: 'crater-rim',
    sourceIds: ['usgs-shackleton', 'nasa-pgda-south-pole-dem'],
    coordinateProvenance: {
      kind: 'representative-feature-centre',
      sourceId: 'usgs-shackleton',
      sourceCoordinateVerbatim: 'Center Latitude -89.67 °; Center Longitude 129.78 °.',
      derivation: 'USGS Gazetteer Control Network crater centre copied as a representative marker; not a rim coordinate.',
      coordinateFrame: 'Planetographic, +East, -180 - 180 (USGS Gazetteer; exact control-network realization unverified).',
      accessedDate: '2026-11-14',
    },
    demSupport: { productId: 'LDEM_80S_80M', geographicCandidate: true, localTerrainAnalysis: 'conditional', limitations: [demLimit, 'NASA PGDA identifies Site04 as Shackleton rim; its landing-site DEM is distinct from an assertion that this marker samples a particular rim pixel.'] },
    limitations: [requestedAreaLimit, 'Crater-centre marker is not the requested rim itself.'],
  },
  {
    id: 'de-gerlache-rim',
    name: 'de Gerlache crater (centre marker; rim unlocated)',
    latDeg: -88.48,
    lonDeg: -88.34,
    regionType: 'crater',
    requestedRegionType: 'crater-rim',
    sourceIds: ['usgs-de-gerlache', 'nasa-pgda-south-pole-dem'],
    coordinateProvenance: {
      kind: 'representative-feature-centre',
      sourceId: 'usgs-de-gerlache',
      sourceCoordinateVerbatim: 'Center Latitude -88.48 °; Center Longitude -88.34 °.',
      derivation: 'USGS Gazetteer Control Network crater centre copied as a representative marker; not a rim coordinate.',
      coordinateFrame: 'Planetographic, +East, -180 - 180 (USGS Gazetteer; exact control-network realization unverified).',
      accessedDate: '2026-11-14',
    },
    demSupport: { productId: 'LDEM_80S_80M', geographicCandidate: true, localTerrainAnalysis: 'conditional', limitations: [demLimit, 'NASA PGDA identifies Site11 as de Gerlache rim; its landing-site DEM is distinct from an assertion that this marker samples a particular rim pixel.'] },
    limitations: [requestedAreaLimit, 'Crater-centre marker is not the requested rim itself.'],
  },
  {
    id: 'malapert-massif',
    name: 'Malapert Massif',
    latDeg: null,
    lonDeg: null,
    regionType: 'massif',
    sourceIds: ['nasa-pgda-south-pole-dem'],
    coordinateProvenance: {
      kind: 'unlocated-named-region',
      sourceId: 'nasa-pgda-south-pole-dem',
      sourceCoordinateVerbatim: 'Site23: Malapert massif.',
      derivation: 'No geographic point coordinates published on the cited dataset page; no point inferred.',
      coordinateFrame: 'DEM products use south polar stereographic X/Y, MOON_ME DE421; no point coordinate established.',
      accessedDate: '2026-11-14',
    },
    demSupport: { productId: 'LDEM_80S_80M', geographicCandidate: false, localTerrainAnalysis: 'unsupported', limitations: ['Named Site23 product exists, but no coordinates or raster footprint supplied to establish a query candidate.'] },
    limitations: ['Massif identity supported by NASA PGDA; exact massif point or landing subregion is not specified or located.'],
  },
  {
    id: 'nobile',
    name: 'Nobile crater region',
    latDeg: -85.28,
    lonDeg: 53.27,
    regionType: 'crater-region',
    sourceIds: ['usgs-nobile'],
    coordinateProvenance: {
      kind: 'representative-feature-centre',
      sourceId: 'usgs-nobile',
      sourceCoordinateVerbatim: 'Center Latitude -85.28 °; Center Longitude 53.27 °.',
      derivation: 'USGS Gazetteer Control Network crater centre copied as a representative marker; no transformation.',
      coordinateFrame: 'Planetographic, +East, -180 - 180 (USGS Gazetteer; exact control-network realization unverified).',
      accessedDate: '2026-11-14',
    },
    demSupport: { productId: 'LDEM_80S_80M', geographicCandidate: true, localTerrainAnalysis: 'conditional', limitations: [demLimit, 'Nobile has no cited named 5 m landing-site product; this candidate claim concerns the broader LDEM_80S_80M coverage only.'] },
    limitations: ['Crater centre is only a representative marker; no specific subregion, rim segment, or landing site is identified.'],
  },
]);

function nonemptyStrings(value) {
  return Array.isArray(value) && value.length > 0 && value.every(item => typeof item === 'string' && item.trim().length > 0);
}

function validDate(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(date.valueOf()) && date.toISOString().slice(0, 10) === value;
}

export function validatePolarRegions(regions = polarRegions, sources = polarRegionSources) {
  const errors = [];
  const fail = (field, code, message) => errors.push({ field, code, message });
  if (!Array.isArray(regions)) return { ok: false, errors: [{ field: 'regions', code: 'invalid_array', message: 'Regions must be an array.' }] };
  if (!Array.isArray(sources)) return { ok: false, errors: [{ field: 'sources', code: 'invalid_array', message: 'Sources must be an array.' }] };
  const sourceIds = new Set();
  sources.forEach((source, i) => {
    const field = `sources[${i}]`;
    if (!source || typeof source !== 'object' || Array.isArray(source)) { fail(field, 'invalid_object', 'Source must be an object.'); return; }
    if (typeof source.id !== 'string' || !source.id.trim()) fail(`${field}.id`, 'required', 'Source id must be nonblank.');
    else if (sourceIds.has(source.id)) fail(`${field}.id`, 'duplicate_id', `Duplicate source id: ${source.id}.`);
    else sourceIds.add(source.id);
    for (const key of ['agency', 'usageTerms', 'url', 'productId', 'accessedDate', 'coordinateVerbatim', 'derivation', 'coordinateFrame', 'identityLimitations']) {
      if (typeof source[key] !== 'string' || !source[key].trim()) fail(`${field}.${key}`, 'required', `${key} must be nonblank.`);
    }
    if (typeof source.url === 'string') {
      try { const url = new URL(source.url); if (!['http:', 'https:'].includes(url.protocol)) throw new Error('scheme'); }
      catch { fail(`${field}.url`, 'invalid_url', 'Source URL must be an absolute HTTP(S) URL.'); }
    }
    if (typeof source.accessedDate === 'string' && !validDate(source.accessedDate)) fail(`${field}.accessedDate`, 'invalid_date', 'accessedDate must be a real YYYY-MM-DD date.');
  });
  const ids = new Set();
  regions.forEach((region, i) => {
    const field = `regions[${i}]`;
    if (!region || typeof region !== 'object' || Array.isArray(region)) { fail(field, 'invalid_object', 'Region must be an object.'); return; }
    for (const key of ['id', 'name', 'regionType']) if (typeof region[key] !== 'string' || !region[key].trim()) fail(`${field}.${key}`, 'required', `${key} must be nonblank.`);
    if (typeof region.id === 'string') { if (ids.has(region.id)) fail(`${field}.id`, 'duplicate_id', `Duplicate region id: ${region.id}.`); ids.add(region.id); }
    for (const key of ['latDeg', 'lonDeg']) if (region[key] !== null && (typeof region[key] !== 'number' || !Number.isFinite(region[key]))) fail(`${field}.${key}`, 'invalid_coordinate', `${key} must be finite or null.`);
    if (typeof region.latDeg === 'number' && (region.latDeg < -90 || region.latDeg > 90)) fail(`${field}.latDeg`, 'out_of_range', 'Latitude must be in [-90, 90].');
    if (typeof region.lonDeg === 'number' && (region.lonDeg < -180 || region.lonDeg >= 180)) fail(`${field}.lonDeg`, 'out_of_range', 'Longitude must be in [-180, 180).');
    if ((region.latDeg === null) !== (region.lonDeg === null)) fail(field, 'incomplete_coordinate', 'Latitude and longitude must both be null or both be numeric.');
    if (!Array.isArray(region.sourceIds) || region.sourceIds.length === 0) fail(`${field}.sourceIds`, 'invalid_sources', 'sourceIds must be a nonempty array.');
    else region.sourceIds.forEach((id, j) => { if (!sourceIds.has(id)) fail(`${field}.sourceIds[${j}]`, 'unknown_source', `Unknown source id: ${id}.`); });
    const provenance = region.coordinateProvenance;
    if (!provenance || typeof provenance !== 'object' || Array.isArray(provenance)) fail(`${field}.coordinateProvenance`, 'required', 'Coordinate provenance is required.');
    else {
      for (const key of ['kind', 'sourceId', 'sourceCoordinateVerbatim', 'derivation', 'coordinateFrame', 'accessedDate']) {
        if (typeof provenance[key] !== 'string' || !provenance[key].trim()) fail(`${field}.coordinateProvenance.${key}`, 'required', `coordinateProvenance.${key} must be nonblank.`);
      }
      if (typeof provenance.sourceId === 'string' && !sourceIds.has(provenance.sourceId)) fail(`${field}.coordinateProvenance.sourceId`, 'unknown_source', `Unknown provenance source id: ${provenance.sourceId}.`);
      if (typeof provenance.sourceId === 'string' && Array.isArray(region.sourceIds) && !region.sourceIds.includes(provenance.sourceId)) fail(`${field}.coordinateProvenance.sourceId`, 'unlinked_provenance', 'Provenance sourceId must also appear in region.sourceIds.');
      if (typeof provenance.accessedDate === 'string' && !validDate(provenance.accessedDate)) fail(`${field}.coordinateProvenance.accessedDate`, 'invalid_date', 'accessedDate must be a real YYYY-MM-DD date.');
    }
    if (!region.demSupport || region.demSupport.productId !== 'LDEM_80S_80M') fail(`${field}.demSupport`, 'invalid_dem_support', 'demSupport must identify LDEM_80S_80M.');
    else {
      if (typeof region.demSupport.geographicCandidate !== 'boolean') fail(`${field}.demSupport.geographicCandidate`, 'invalid_boolean', 'geographicCandidate must be boolean.');
      if (!['conditional', 'unsupported'].includes(region.demSupport.localTerrainAnalysis)) fail(`${field}.demSupport.localTerrainAnalysis`, 'invalid_status', 'localTerrainAnalysis must be conditional or unsupported.');
      if (!nonemptyStrings(region.demSupport.limitations)) fail(`${field}.demSupport.limitations`, 'invalid_limitations', 'DEM limitations must be a nonempty array of nonblank strings.');
      if ((region.latDeg === null || region.lonDeg === null) && (region.demSupport.geographicCandidate !== false || region.demSupport.localTerrainAnalysis !== 'unsupported')) fail(`${field}.demSupport`, 'unlocated_dem_claim', 'Unlocated regions cannot be geographic candidates or support local terrain analysis.');
      const inLdem80SCap = typeof region.latDeg === 'number' && typeof region.lonDeg === 'number' && region.latDeg >= -90 && region.latDeg <= -80;
      if (region.demSupport.geographicCandidate === true && !inLdem80SCap) fail(`${field}.demSupport.geographicCandidate`, 'outside_coverage', 'A geographic candidate must have coordinates within the LDEM_80S_80M latitude coverage [-90, -80].');
      if (region.demSupport.localTerrainAnalysis === 'conditional' && (region.demSupport.geographicCandidate !== true || !inLdem80SCap)) fail(`${field}.demSupport.localTerrainAnalysis`, 'candidate_mismatch', 'Conditional DEM analysis requires a geographic candidate within the LDEM_80S_80M latitude coverage [-90, -80].');
    }
    if (!nonemptyStrings(region.limitations)) fail(`${field}.limitations`, 'invalid_limitations', 'limitations must be a nonempty array of nonblank strings.');
  });
  return errors.length ? { ok: false, errors } : { ok: true };
}
