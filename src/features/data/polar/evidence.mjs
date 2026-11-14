const deepFreeze = value => {
  if (value && typeof value === 'object' && !Object.isFrozen(value)) {
    Object.freeze(value);
    for (const child of Object.values(value)) deepFreeze(child);
  }
  return value;
};

const pdsTerms = { url: 'https://pds.nasa.gov/datastandards/citing/', verificationState: 'NASA/PDS citation guidance; not a license or reuse-terms determination' };

export const polarEvidenceSources = deepFreeze([
  {
    id: 'lro-diviner-polar-cumulative-product', title: 'LRO Diviner Polar Cumulative Product (PCP)', agency: 'NASA / Planetary Data System Geosciences Node',
    url: 'https://pds-geosciences.wustl.edu/lro/urn-nasa-pds-lro_diviner_derived1/data_derived_pcp/', metadataUrls: ['https://pds-geosciences.wustl.edu/missions/lro/diviner.htm', 'https://pds-geosciences.wustl.edu/lro/urn-nasa-pds-lro_diviner_derived1/data_derived_pcp/'], accessedDate: '2026-11-14', productId: null,
    evidenceType: 'thermal-observation', provenance: 'PDS Geosciences Node mission page and PDS4 derived-data directory inspected directly. The directory identifies the Polar Cumulative Product (PCP); no collection XML/product label was inspected to verify a specific product ID or binning details. Thermal measurements are not a direct illumination record.',
    coordinateFrame: 'Unknown: coordinate-frame convention not established from the inspected mission page/directory', temporalCoverage: '2009-07-05 through 2020-03-15 (mission page coverage)', spatialCoverage: 'Polar cumulative product; exact mapped bounds and resolution not established from the inspected page/directory',
    usageTerms: pdsTerms, localDataAvailable: false
  },
  {
    id: 'lro-lamp-gridded-data-record', title: 'LRO LAMP Level 5 Gridded Data Record', agency: 'NASA / Planetary Data System',
    url: 'https://pds.nasa.gov/ds-view/pds/viewProfile.jsp?dsid=LRO-L-LAMP-5-GDR-V1.0', accessedDate: '2026-11-14', productId: 'LRO-L-LAMP-5-GDR-V1.0',
    evidenceType: 'ultraviolet-observation', provenance: 'Primary PDS archive profile inspected: calibrated LAMP night-side photon detections binned into brightness, albedo, illumination, exposure, quality and water-absorption maps. Map NoData is encoded as NaN. Albedo depends on illumination modeling (IPM Ly-alpha/SOHO-SWAN, stellar flux/IUE, and LOLA topography); reflectance/albedo is not a direct all-time shadow measurement.',
    coordinateFrame: 'LRO lunar ME/body-fixed, planetocentric; east-positive longitude 0–360°; polar stereographic maps; exact map-frame realization/DE version unknown pending product-label inspection', temporalCoverage: 'Profile observation coverage 2009-09-16T12:00:00Z through 2010-09-14T12:00:00Z; monthly and cumulative maps', spatialCoverage: 'North and south polar maps extending to 80° latitude; 240 m/pixel at pole; 2501 × 2501 pixels; NoData=NaN',
    usageTerms: { url: 'https://pds.nasa.gov/datastandards/citing/', verificationState: 'NASA/PDS citation guidance; not a license or reuse-terms determination' }, localDataAvailable: false
  },
  {
    id: 'lola-polar-illumination-psr', title: 'LOLA Lunar Polar Illumination / Permanent Shadow products', agency: 'NASA Goddard Space Flight Center / LOLA team',
    url: 'https://pgda.gsfc.nasa.gov/products/69', accessedDate: '2026-11-14', productId: 'LPSR_85S_060M_201608.TIF (example; registry page also lists 75S/120m and 65S/240m products)',
    evidenceType: 'model-derived', provenance: 'NASA GSFC PGDA product page inspected directly. It describes LOLA-terrain illumination modeling over hourly steps spanning an approximately 18.6-year lunar nutation cycle and provides LPSR shadow map downloads. This is modeled illumination, not a direct instrument observation. Page requests citation of Mazarico et al. (2011), DOI 10.1016/j.icarus.2010.10.030. The filename suffix 201608 is retained as product identifier only; no epoch meaning inferred.',
    coordinateFrame: 'Polar stereographic projection, reference radius 1737.4 km, true scale at pole; frame convention not established by inspected page', temporalCoverage: 'Hourly illumination model spanning approximately 18.6-year lunar nutation cycle; exact epoch/window not specified on inspected page', spatialCoverage: 'North/south polar maps; 85°–90° at 60 m/pixel, 75°–90° at 120 m/pixel, 65°–90° at 240 m/pixel',
    usageTerms: { url: 'https://pgda.gsfc.nasa.gov/products/69', verificationState: 'Product page requests Mazarico et al. (2011) citation; copyright/license terms not verified' }, localDataAvailable: false
  }
]);

export const psrValidationOptions = deepFreeze({
  acceptedEvidenceTypes: ['thermal-observation', 'ultraviolet-observation', 'model-derived'],
  requiredFamilies: ['thermal-observation', 'ultraviolet-observation', 'model-derived'],
  requireExplicitCoordinateFrame: true,
  requireProductIdOrNull: true
});

function isHttpsUrl(value) {
  if (typeof value !== 'string' || /\s/.test(value)) return false;
  try { const url = new URL(value); return url.protocol === 'https:' && Boolean(url.hostname); } catch { return false; }
}

function isCalendarDate(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [year, month, day] = value.split('-').map(Number);
  const date = new Date(0);
  date.setUTCFullYear(year, month - 1, day);
  return month >= 1 && month <= 12 && day >= 1 && day <= 31 && date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day;
}

export function validatePolarEvidence(sources = polarEvidenceSources, options = psrValidationOptions) {
  const errors = [];
  if (!Array.isArray(sources)) return { ok: false, errors: [{ field: 'sources', code: 'invalid_array', message: 'sources must be an array.' }] };
  if (!options || typeof options !== 'object' || Array.isArray(options)) return { ok: false, errors: [{ field: 'options', code: 'invalid_object', message: 'options must be an object.' }] };
  for (const key of ['acceptedEvidenceTypes', 'requiredFamilies']) {
    if (!Array.isArray(options[key]) || options[key].some(item => typeof item !== 'string' || !item.trim())) errors.push({ field: `options.${key}`, code: 'invalid_options', message: `${key} must be an array of nonblank strings.` });
  }
  for (const key of ['requireProductIdOrNull', 'requireExplicitCoordinateFrame']) {
    if (typeof options[key] !== 'boolean') errors.push({ field: `options.${key}`, code: 'invalid_options', message: `${key} must be boolean.` });
  }
  if (errors.length) return { ok: false, errors };
  const ids = new Set();
  for (const [i, source] of sources.entries()) {
    const field = `sources[${i}]`;
    if (!source || typeof source !== 'object' || Array.isArray(source)) { errors.push({ field, code: 'invalid_object', message: 'Source must be an object.' }); continue; }
    for (const key of ['id', 'title', 'agency', 'url', 'accessedDate', 'provenance']) if (typeof source[key] !== 'string' || !source[key].trim()) errors.push({ field: `${field}.${key}`, code: 'required', message: `${key} must be a nonblank string.` });
    if (ids.has(source.id)) errors.push({ field: `${field}.id`, code: 'duplicate', message: 'Source IDs must be unique.' });
    ids.add(source.id);
    if (source.url && !isHttpsUrl(source.url)) errors.push({ field: `${field}.url`, code: 'invalid_url', message: 'Source URL must be a valid HTTPS URL without whitespace.' });
    if (!isCalendarDate(source.accessedDate)) errors.push({ field: `${field}.accessedDate`, code: 'invalid_date', message: 'accessedDate must be a real calendar date in YYYY-MM-DD format.' });
    if (!options.acceptedEvidenceTypes?.includes(source.evidenceType)) errors.push({ field: `${field}.evidenceType`, code: 'invalid_type', message: 'Unsupported evidenceType.' });
    if (options.requireProductIdOrNull && source.productId !== null && (typeof source.productId !== 'string' || !source.productId.trim())) errors.push({ field: `${field}.productId`, code: 'invalid_product_id', message: 'productId must be a nonblank identifier or null.' });
    if (options.requireExplicitCoordinateFrame && (typeof source.coordinateFrame !== 'string' || !source.coordinateFrame.trim())) errors.push({ field: `${field}.coordinateFrame`, code: 'required', message: 'coordinateFrame must be explicit; use an explicit unknown statement when unavailable.' });
    if (typeof source.temporalCoverage !== 'string' || !source.temporalCoverage.trim()) errors.push({ field: `${field}.temporalCoverage`, code: 'required', message: 'temporalCoverage must be known or explicitly unknown.' });
    if (typeof source.spatialCoverage !== 'string' || !source.spatialCoverage.trim()) errors.push({ field: `${field}.spatialCoverage`, code: 'required', message: 'spatialCoverage must be known or explicitly unknown.' });
    if (!source.usageTerms || !isHttpsUrl(source.usageTerms.url) || typeof source.usageTerms.verificationState !== 'string' || !source.usageTerms.verificationState.trim()) errors.push({ field: `${field}.usageTerms`, code: 'invalid_terms', message: 'usageTerms requires a valid HTTPS URL and verificationState.' });
    if (source.localDataAvailable !== false) errors.push({ field: `${field}.localDataAvailable`, code: 'local_data_state', message: 'This evidence manifest records metadata only; localDataAvailable must be false.' });
  }
  for (const family of options.requiredFamilies ?? []) if (!sources.some(source => source?.evidenceType === family)) errors.push({ field: 'sources', code: 'missing_family', message: `No source for required evidence family ${family}.` });
  return errors.length ? { ok: false, errors } : { ok: true };
}
