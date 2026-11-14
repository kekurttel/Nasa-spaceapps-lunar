import { exportCsv } from './exportCsv';
import { SiteEphemeris } from '../types';

const site: SiteEphemeris = {
  site: { name: 'South pole', lat: -89.9, lon: 0 },
  summary: {
    total_hours: 2, sun_hours: 1, dark_hours: 1, earth_visible_hours: 2,
    no_earth_hours: 0, sun_percentage: 50, earth_percentage: 100,
    max_continuous_sun_hours: 1, max_continuous_dark_hours: 1,
    max_continuous_comm_hours: 2, max_continuous_no_comm_hours: 0,
    avg_sun_elevation_when_visible: 12, avg_earth_elevation_when_visible: 8,
  },
  data: [{
    datetime: '2027-01-01T00:00:00Z', timestamp: 1798761600,
    sun_elevation: -5, sun_azimuth: 90, earth_elevation: 8, earth_azimuth: 180,
    sun_visible: false, earth_visible: true, solar_flux_pct: 0,
  }],
};

const csvFor = (name: string, source = 'Test service') => exportCsv(
  [{ ...site, site: { ...site.site, name } }], source, '2027-01-01', '2027-01-02',
);

test('exports metadata, all summary fields, sample headers and sample values with CRLF', () => {
  const csv = csvFor('South pole');
  const lines = csv.split('\r\n');
  expect(lines).toHaveLength(6);
  expect(lines[0]).toBe(`record_type,source,range_start,range_end,site_name,latitude,longitude,${Object.keys(site.summary).join(',')}`);
  expect(lines[1]).toMatch(/^metadata,Test service,2027-01-01,2027-01-02,/);
  expect(lines[2]).toBe(`summary,,,,South pole,-89.9,0,${Object.values(site.summary).join(',')}`);
  expect(lines[3]).toBe('sample,,,,site_name,latitude,longitude,datetime,timestamp,sun_elevation,sun_azimuth,earth_elevation,earth_azimuth,sun_visible,earth_visible,solar_flux_pct');
  expect(lines[4]).toBe('sample,,,,South pole,-89.9,0,2027-01-01T00:00:00Z,1798761600,-5,90,8,180,false,true,0');
  expect(lines[5]).toBe('');
  expect(csv.replace(/\r\n/g, '')).not.toMatch(/[\r\n]/);
});

test.each([
  ['Rim, south', '"Rim, south"'],
  ['Rim "A"', '"Rim ""A"""'],
  ['Rim\nsouth', '"Rim\nsouth"'],
  ['Rim\rsouth', '"Rim\rsouth"'],
  ['Rim\r\nsouth', '"Rim\r\nsouth"'],
  ['Güney kutbu', 'Güney kutbu'],
])('escapes site names and metadata: %j', (value, escaped) => {
  const csv = csvFor(value, value);
  expect(csv).toContain(`metadata,${escaped},2027-01-01,2027-01-02,`);
  expect(csv).toContain(`summary,,,,${escaped},-89.9,0,`);
  expect(csv).toContain(`sample,,,,${escaped},-89.9,0,`);
});

test.each(['=1+1', '+SUM(A1:A2)', '-1+1', '@SUM(A1:A2)', '  =1+1', '\t=1+1', '\ttext'])('neutralizes spreadsheet formulas: %j', (value) => {
  const csv = csvFor(value, value);
  expect(csv).toContain(`metadata,'${value},2027-01-01,2027-01-02,`);
  expect(csv).toContain(`summary,,,,'${value},-89.9,0,`);
  expect(csv).toContain(`sample,,,,'${value},-89.9,0,`);
});

test('formula protection composes with CSV quotes and embedded newlines', () => {
  expect(csvFor('=HYPERLINK("bad","click")')).toContain('"\'=HYPERLINK(""bad"",""click"")"');
  expect(csvFor('\r=1')).toContain('"\'\r=1"');
  expect(csvFor('\n=1')).toContain('"\'\n=1"');
});

test('exports every site and sample without mutating input', () => {
  const second = { ...site, site: { ...site.site, name: 'Second' }, data: [site.data[0], { ...site.data[0], timestamp: 1798765200 }] };
  const data = [site, second];
  const before = JSON.stringify(data);
  const csv = exportCsv(data, '', '', '');
  expect(csv.split('\r\n').filter(line => line.startsWith('summary,'))).toHaveLength(2);
  expect(csv.split('\r\n').filter(line => line.startsWith('sample,,,,Second,'))).toHaveLength(2);
  expect(csv).toContain('1798765200');
  expect(JSON.stringify(data)).toBe(before);
});

test('handles empty results and unnamed sites', () => {
  expect(exportCsv([], '', '', '').split('\r\n')).toHaveLength(4);
  const csv = exportCsv([{ ...site, site: { lat: -90, lon: 0 }, data: [] }], '', '', '');
  expect(csv).toContain('summary,,,,,-90,0,');
  expect(csv.split('\r\n')).toHaveLength(5);
});
