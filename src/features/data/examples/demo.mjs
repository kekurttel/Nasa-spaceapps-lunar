import { createCustomSite, validateScenario } from '../index.mjs';

const site = createCustomSite({ id: 'demo-crater', name: 'Demo Crater', latDeg: -89.5, lonDeg: 270, surfaceElevationM: null, observerHeightM: 1, sourceIds: [] });
const manifest = { id: 'demo-synthetic', version: '1.0.0', dataKind: 'synthetic', sourceIds: [], dateCoverage: { startUtc: '2030-01-01T00:00:00.000Z', endUtc: '2030-01-02T00:00:00.000Z' }, locationCoverage: { latMinDeg: -90, latMaxDeg: 90, lonMinDeg: -180, lonMaxDeg: 180 } };
const scenario = validateScenario({ id: 'demo-one-hour', site: site.ok ? site.value : null, startUtc: '2030-01-01T00:00:00.000Z', endUtc: '2030-01-01T01:00:00.000Z', stepSeconds: 60 }, { manifest });
if (!site.ok || !scenario.ok) throw new Error(JSON.stringify({ site, scenario }));
console.log(JSON.stringify({ site: site.value, scenario: scenario.value, dataKind: manifest.dataKind }, null, 2));
