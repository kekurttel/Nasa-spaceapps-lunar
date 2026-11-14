import { createHash } from 'node:crypto';

const WIDTH = 1440;
const HEIGHT = 720;
const RADIUS_M = 1_737_400;
const SOURCE_URL = 'https://pds-geosciences.wustl.edu/lro/lro-l-lola-3-rdr-v1/lrolol_1xxx/data/lola_gdr/cylindrical/float_img/ldem_4_float.img';
const SOURCE_ID = 'nasa-pds-ldem-4-float-v3';
const DEG = Math.PI / 180;
const EXPECTED_IMAGE_SHA256 = '6eaee9376442dc851b8f8e94790499ec339d923367d7b8608a4316088b85bd45';
const EXPECTED_LABEL_SHA256 = '37315910c3064d66623180fe49e91abc6c0c6b43b064042d2ac8002d997479d4';
const loadedRealDems = new WeakMap();

function requireMatch(text, expression, description) {
  const match = text.match(expression);
  if (!match) throw new TypeError(`Unsupported LOLA label: ${description}`);
  return match[1];
}

export function loadLolaDem(imageBytes, labelText) {
  if (!(imageBytes instanceof Uint8Array) || typeof labelText !== 'string') throw new TypeError('Image bytes and PDS label text are required');
  const valuesCount = WIDTH * HEIGHT;
  if (imageBytes.byteLength !== valuesCount * 4) throw new RangeError(`LOLA image must be exactly ${valuesCount * 4} bytes`);
  const checks = [
    [/PRODUCT_ID\s*=\s*"?([^"\s]+)"?/i, 'LDEM_4_FLOAT', 'product'],
    [/PRODUCT_VERSION_ID\s*=\s*"?([^"\s]+)"?/i, 'V3.0', 'version'],
    [/DATA_SET_ID\s*=\s*"?([^"\s]+)"?/i, 'LRO-L-LOLA-4-GDR-V1.0', 'dataset'],
    [/LINES\s*=\s*(\d+)/i, '720', 'lines'],
    [/LINE_SAMPLES\s*=\s*(\d+)/i, '1440', 'samples'],
    [/SAMPLE_BITS\s*=\s*(\d+)/i, '32', 'sample bits'],
    [/SAMPLE_TYPE\s*=\s*(\w+)/i, 'PC_REAL', 'sample type'],
    [/UNIT\s*=\s*(\w+)/i, 'KILOMETER', 'height units'],
    [/SCALING_FACTOR\s*=\s*([\d.]+)/i, '1', 'scaling factor'],
    [/OFFSET\s*=\s*([\d.]+)/i, '1737.4', 'reference radius'],
    [/MAP_RESOLUTION\s*=\s*(\d+)/i, '4', 'map resolution'],
    [/A_AXIS_RADIUS\s*=\s*([\d.]+)/i, '1737.4', 'A axis'],
    [/B_AXIS_RADIUS\s*=\s*([\d.]+)/i, '1737.4', 'B axis'],
    [/C_AXIS_RADIUS\s*=\s*([\d.]+)/i, '1737.4', 'C axis'],
    [/COORDINATE_SYSTEM_NAME\s*=\s*"([^"]+)"/i, 'MEAN EARTH/POLAR AXIS OF DE421', 'coordinate frame'],
    [/MAP_PROJECTION_TYPE\s*=\s*"([^"]+)"/i, 'SIMPLE CYLINDRICAL', 'map projection'],
    [/POSITIVE_LONGITUDE_DIRECTION\s*=\s*"([^"]+)"/i, 'EAST', 'longitude direction'],
    [/COORDINATE_SYSTEM_TYPE\s*=\s*"([^"]+)"/i, 'BODY-FIXED ROTATING', 'coordinate system type'],
    [/CENTER_LATITUDE\s*=\s*(-?[\d.]+)/i, '0', 'center latitude'],
    [/CENTER_LONGITUDE\s*=\s*(-?[\d.]+)/i, '180', 'center longitude'],
    [/LINE_FIRST_PIXEL\s*=\s*(\d+)/i, '1', 'first line'],
    [/LINE_LAST_PIXEL\s*=\s*(\d+)/i, '720', 'last line'],
    [/SAMPLE_FIRST_PIXEL\s*=\s*(\d+)/i, '1', 'first sample'],
    [/SAMPLE_LAST_PIXEL\s*=\s*(\d+)/i, '1440', 'last sample'],
    [/WESTERNMOST_LONGITUDE\s*=\s*(-?[\d.]+)/i, '0', 'westernmost longitude'],
    [/EASTERNMOST_LONGITUDE\s*=\s*(-?[\d.]+)/i, '360', 'easternmost longitude'],
    [/MAXIMUM_LATITUDE\s*=\s*(-?[\d.]+)/i, '90', 'maximum latitude'],
    [/MINIMUM_LATITUDE\s*=\s*(-?[\d.]+)/i, '-90', 'minimum latitude'],
    [/LINE_PROJECTION_OFFSET\s*=\s*(-?[\d.]+)/i, '359.5', 'line projection offset'],
    [/SAMPLE_PROJECTION_OFFSET\s*=\s*(-?[\d.]+)/i, '719.5', 'sample projection offset']
  ];
  for (const [pattern, expected, name] of checks) if (requireMatch(labelText, pattern, name) !== expected) throw new TypeError(`Unsupported LOLA label ${name}`);
  if (createHash('sha256').update(labelText, 'utf8').digest('hex') !== EXPECTED_LABEL_SHA256) throw new TypeError('LOLA PDS label does not match the authoritative product label');
  const minimum = Number(requireMatch(labelText, /MINIMUM\s*=\s*(-?[\d.]+)/i, 'minimum'));
  const maximum = Number(requireMatch(labelText, /MAXIMUM\s*=\s*(-?[\d.]+)/i, 'maximum'));
  if (Math.abs(minimum + 8.879) > 0.001 || Math.abs(maximum - 10.504) > 0.001) throw new TypeError('Unsupported LOLA label limits');
  const imageHash = createHash('sha256').update(imageBytes).digest('hex');
  const view = new DataView(imageBytes.buffer, imageBytes.byteOffset, imageBytes.byteLength);
  const valuesKm = new Float32Array(valuesCount);
  for (let i = 0; i < valuesCount; i++) {
    const value = view.getFloat32(i * 4, true);
    if (!Number.isFinite(value) || value < minimum - 0.001 || value > maximum + 0.001) throw new RangeError(`Invalid LOLA sample at index ${i}`);
    valuesKm[i] = value;
  }
  if (imageHash !== EXPECTED_IMAGE_SHA256) throw new TypeError('LOLA image SHA-256 does not match the authoritative product');
  const dem = { width: WIDTH, height: HEIGHT, radiusM: RADIUS_M, valuesKm, product: 'LDEM_4_FLOAT', version: 'V3.0', sha256: imageHash };
  loadedRealDems.set(dem, imageHash);
  return dem;
}

export function isVerifiedLolaDem(dem) {
  const expectedHash = dem && loadedRealDems.get(dem);
  return Boolean(expectedHash && dem.sha256 === expectedHash && createHash('sha256').update(new Uint8Array(dem.valuesKm.buffer, dem.valuesKm.byteOffset, dem.valuesKm.byteLength)).digest('hex') === expectedHash);
}

export function sampleLolaHeightM(dem, latitudeDeg, longitudeDeg) {
  if (!dem || dem.width !== WIDTH || dem.height !== HEIGHT || !(dem.valuesKm instanceof Float32Array) || dem.valuesKm.length !== WIDTH * HEIGHT) throw new TypeError('Invalid LOLA DEM');
  if (!Number.isFinite(latitudeDeg) || !Number.isFinite(longitudeDeg)) throw new TypeError('Latitude and longitude must be finite');
  if (latitudeDeg < -90 || latitudeDeg > 90) throw new RangeError('Latitude must be within [-90, 90] degrees');
  const y = Math.max(0, Math.min(HEIGHT - 1, (90 - latitudeDeg) * 4 - 0.5));
  const y0 = Math.floor(y), y1 = Math.min(HEIGHT - 1, y0 + 1), fy = y - y0;
  const x = (((longitudeDeg % 360) + 360) % 360) * 4 - 0.5;
  const xFloor = Math.floor(x), fx = x - xFloor;
  const x0 = ((xFloor % WIDTH) + WIDTH) % WIDTH, x1 = (x0 + 1) % WIDTH;
  const at = (row, col) => dem.valuesKm[row * WIDTH + col] * 1000;
  const north = at(y0, x0) * (1 - fx) + at(y0, x1) * fx;
  const south = at(y1, x0) * (1 - fx) + at(y1, x1) * fx;
  return north * (1 - fy) + south * fy;
}

export function buildLolaHorizon(dem, { siteId, latitudeDeg, longitudeDeg, observerHeightM, azimuthStepDeg = 5, distanceStepM = 2000, maxDistanceM = 200000 } = {}) {
  if (!dem || dem.width !== WIDTH || dem.height !== HEIGHT || !(dem.valuesKm instanceof Float32Array) || dem.valuesKm.length !== WIDTH * HEIGHT) throw new TypeError('Invalid LOLA DEM');
  const expectedHash = loadedRealDems.get(dem);
  if (expectedHash && (createHash('sha256').update(new Uint8Array(dem.valuesKm.buffer, dem.valuesKm.byteOffset, dem.valuesKm.byteLength)).digest('hex') !== expectedHash)) throw new TypeError('Verified LOLA DEM was modified after loading');
  if (!expectedHash && dem.synthetic !== true) throw new TypeError('DEM must be loaded from the verified LOLA product or explicitly marked synthetic');
  if (typeof siteId !== 'string' || !siteId.trim() || !Number.isFinite(latitudeDeg) || latitudeDeg < -90 || latitudeDeg > 90 || !Number.isFinite(longitudeDeg)) throw new TypeError('Valid site and geographic coordinates are required');
  if (!Number.isFinite(observerHeightM) || observerHeightM < 0) throw new RangeError('observerHeightM must be finite and non-negative');
  if (!Number.isFinite(azimuthStepDeg) || azimuthStepDeg <= 0 || Math.abs(360 / azimuthStepDeg - Math.round(360 / azimuthStepDeg)) > 1e-9 || 360 / azimuthStepDeg < 2) throw new RangeError('azimuthStepDeg must divide 360 into at least two bearings');
  if (!Number.isFinite(distanceStepM) || distanceStepM <= 0 || !Number.isFinite(maxDistanceM) || maxDistanceM <= 0 || maxDistanceM > 500000 || distanceStepM > maxDistanceM || Math.ceil(maxDistanceM / distanceStepM) * (360 / azimuthStepDeg) > 200000) throw new RangeError('Distance bounds exceed supported range or workload');
  const lastDistanceM = Math.floor(maxDistanceM / distanceStepM) * distanceStepM;
  const siteHeight = sampleLolaHeightM(dem, latitudeDeg, longitudeDeg);
  const observerRadius = RADIUS_M + siteHeight + observerHeightM;
  const count = Math.round(360 / azimuthStepDeg);
  const azimuthDeg = [], elevationDeg = [];
  for (let a = 0; a < count; a++) {
    const azimuth = a * azimuthStepDeg * DEG;
    let highest = -90;
    for (let distance = distanceStepM; distance <= lastDistanceM; distance += distanceStepM) {
      const angularDistance = distance / RADIUS_M;
      const lat1 = latitudeDeg * DEG, lon1 = longitudeDeg * DEG;
      const lat2 = Math.asin(Math.max(-1, Math.min(1, Math.sin(lat1) * Math.cos(angularDistance) + Math.cos(lat1) * Math.sin(angularDistance) * Math.cos(azimuth))));
      const lon2 = lon1 + Math.atan2(Math.sin(azimuth) * Math.sin(angularDistance) * Math.cos(lat1), Math.cos(angularDistance) - Math.sin(lat1) * Math.sin(lat2));
      const terrainRadius = RADIUS_M + sampleLolaHeightM(dem, lat2 / DEG, lon2 / DEG);
      const elevation = Math.atan2(terrainRadius * Math.cos(angularDistance) - observerRadius, terrainRadius * Math.sin(angularDistance)) / DEG;
      if (elevation > highest) highest = elevation;
    }
    azimuthDeg.push(a * azimuthStepDeg);
    elevationDeg.push(highest);
  }
  const warnings = ['LOLA LDEM_4_FLOAT is coarse (~7.58 km per pixel); not suitable for landing-safety or local hazard/near-field horizon assessment.', 'Finite radial search ignores terrain beyond maxDistanceM; features between raster sample points or within one pixel may be under-resolved.'];
  if (dem.synthetic) warnings.push('This DEM is synthetic test data, not NASA/LOLA terrain.');
  if (Math.abs(latitudeDeg) > 89.875 || (Math.abs(latitudeDeg) < 90 && maxDistanceM / RADIUS_M > (90 - Math.abs(latitudeDeg)) * DEG)) warnings.push('Polar cap uses the nearest latitude row; longitude-varying extrapolation can create artificial slopes; not reliable for a local polar horizon.');
  const isSynthetic = dem.synthetic === true;
  const sourceId = isSynthetic ? 'synthetic-grid-test-data' : SOURCE_ID;
  return {
    profile: { siteId, azimuthDeg, elevationDeg, model: 'terrain', dataKind: isSynthetic ? 'synthetic' : 'real', sourceIds: [sourceId], observerHeightM, warnings },
    coverage: { siteId, latitudeDeg, longitudeDeg, observerHeightM, frame: 'ME_DE421_LOCAL_NORTH_EAST', azimuthCoverage: 'full-circle', minimumDistanceM: distanceStepM, maximumDistanceM: lastDistanceM, requestedMaximumDistanceM: maxDistanceM, distanceStepM },
    sources: [isSynthetic ? { id: sourceId, url: 'https://example.invalid/synthetic-grid', description: 'Synthetic hand-built test grid; not observed terrain or NASA/LOLA data.' } : { id: sourceId, url: SOURCE_URL, description: 'NASA PDS Geosciences Node LRO/LOLA LDEM_4_FLOAT V3.0, 4 pixels/degree. Coarse global radius map; no NASA endorsement implied.' }],
    provenance: { product: isSynthetic ? 'synthetic-grid-test-data' : 'LDEM_4_FLOAT', productVersion: isSynthetic ? null : 'V3.0', dataSetId: isSynthetic ? null : 'LRO-L-LOLA-4-GDR-V1.0', heightReference: isSynthetic ? 'Test-only synthetic values interpreted as radius offsets from 1737.4 km.' : '1737.4 km reference sphere; DN is radius offset, not geoid/sea-level elevation.', coordinateSystem: isSynthetic ? 'Test-only synthetic coordinates.' : 'MEAN EARTH/POLAR AXIS OF DE421, body-fixed rotating; simple cylindrical, pixel centers.', resolutionKmPerPixel: isSynthetic ? null : 7.58084, latitudeDeg, longitudeDeg, observerHeightM, minimumDistanceM: distanceStepM, maximumDistanceM: lastDistanceM, requestedMaximumDistanceM: maxDistanceM, distanceStepM, algorithm: 'Spherical great-circle destination samples; radial apparent elevation atan2(Rterrain*cos(delta)-Robserver, Rterrain*sin(delta)); maximum over positive distances.', sha256: isSynthetic ? null : dem.sha256, synthetic: isSynthetic }
  };
}
