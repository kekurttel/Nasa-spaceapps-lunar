import { SiteEphemeris } from '../types';

const SUMMARY_FIELDS: Array<keyof SiteEphemeris['summary']> = [
  'total_hours',
  'sun_hours',
  'dark_hours',
  'earth_visible_hours',
  'no_earth_hours',
  'sun_percentage',
  'earth_percentage',
  'max_continuous_sun_hours',
  'max_continuous_dark_hours',
  'max_continuous_comm_hours',
  'max_continuous_no_comm_hours',
  'avg_sun_elevation_when_visible',
  'avg_earth_elevation_when_visible',
];

function escapeCsv(value: unknown): string {
  let text = value == null ? '' : String(value);
  // Quoting alone does not stop spreadsheet formula execution. Keep numbers numeric.
  if (typeof value === 'string' && (/^\s*[=+\-@]/.test(text) || /^[\t\r\n]/.test(text))) {
    text = `'${text}`;
  }
  return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

function row(values: unknown[]): string {
  return values.map(escapeCsv).join(',');
}

/** Build a CSV containing export metadata, each site's summary, and all ephemeris records. */
export function exportCsv(
  data: SiteEphemeris[],
  source: string,
  rangeStart: string,
  rangeEnd: string,
): string {
  const lines: string[] = [
    row(['record_type', 'source', 'range_start', 'range_end', 'site_name', 'latitude', 'longitude', ...SUMMARY_FIELDS]),
    row(['metadata', source, rangeStart, rangeEnd, '', '', '', ...SUMMARY_FIELDS.map(() => '')]),
  ];

  for (const site of data) {
    lines.push(row([
      'summary', '', '', '', site.site.name ?? '', site.site.lat, site.site.lon,
      ...SUMMARY_FIELDS.map((field) => site.summary[field]),
    ]));
  }

  lines.push(row([
    'sample', '', '', '', 'site_name', 'latitude', 'longitude',
    'datetime', 'timestamp', 'sun_elevation', 'sun_azimuth', 'earth_elevation',
    'earth_azimuth', 'sun_visible', 'earth_visible', 'solar_flux_pct',
  ]));

  for (const site of data) {
    for (const point of site.data) {
      lines.push(row([
        'sample', '', '', '', site.site.name ?? '', site.site.lat, site.site.lon,
        point.datetime, point.timestamp, point.sun_elevation, point.sun_azimuth,
        point.earth_elevation, point.earth_azimuth, point.sun_visible,
        point.earth_visible, point.solar_flux_pct,
      ]));
    }
  }

  return `${lines.join('\r\n')}\r\n`;
}
