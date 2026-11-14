// Run explicitly to refresh independent reference answers; runtime is offline.
import { writeFile } from 'node:fs/promises';
const sites = [{ latDeg: 0, lonDeg: 0 }, { latDeg: 45, lonDeg: 30 }, { latDeg: -89.5, lonDeg: 45 }];
const records = [];
for (const site of sites) {
  for (const [body, command] of [['sun', '10'], ['earth', '399']]) {
    const parameters = { format: 'json', COMMAND: `'${command}'`, CENTER: "'coord@301'",
      COORD_TYPE: "'GEODETIC'", SITE_COORD: `'${site.lonDeg},${site.latDeg},0.002'`,
      MAKE_EPHEM: "'YES'", EPHEM_TYPE: "'OBSERVER'", START_TIME: "'2026-01-01'",
      STOP_TIME: "'2026-01-01 02:00'", STEP_SIZE: "'10m'", QUANTITIES: "'4'",
      CSV_FORMAT: "'YES'", APPARENT: "'AIRLESS'" };
    const url = 'https://ssd.jpl.nasa.gov/api/horizons.api?' + new URLSearchParams(parameters);
    const response = await fetch(url);
    if (!response.ok) throw new Error(`HTTP ${response.status}: ${url}`);
    const data = await response.json();
    if (data.error || !data.result.includes('$$SOE')) throw new Error(data.error ?? data.result);
    const table = data.result.split('$$SOE')[1].split('$$EOE')[0].trim();
    records.push({ site, body, httpStatus: response.status, parameters, url,
      first5: data.result.split('\n').slice(0, 5), table, raw: data.result });
  }
}
await writeFile(new URL('../fixtures/horizons-reference.json', import.meta.url), JSON.stringify({
  source: 'NASA/JPL Horizons', description: 'Independent airless apparent observer directions; not geometric vector inputs.', records,
}, null, 2) + '\n');
console.log(`Saved ${records.length} queries; ${records.reduce((n, r) => n + r.table.split('\n').length, 0)} rows.`);
