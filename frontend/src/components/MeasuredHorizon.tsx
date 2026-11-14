import React, { useId, useMemo } from 'react';
import {
  CartesianGrid, ComposedChart, Line, ReferenceLine, ResponsiveContainer,
  Tooltip, XAxis, YAxis,
} from 'recharts';
import { EphemerisPoint } from '../types';
import './MeasuredHorizon.css';

export interface MeasuredHorizonProps {
  /** Supplied terrain-horizon samples, in degrees; never synthesized from ephemeris. */
  profile: { azimuth: number; elevation: number }[];
  data: EphemerisPoint[];
  language: 'tr' | 'en';
  /** Receives the original ephemeris sample selected in the accessible table. */
  onPin?: (point: EphemerisPoint) => void;
}

interface PlotPoint {
  azimuth: number;
  elevation: number;
  datetime?: string;
}

const wrap = (angle: number) => ((angle % 360) + 360) % 360;
const validAngle = (azimuth: number, elevation: number) =>
  Number.isFinite(azimuth) && Number.isFinite(elevation) && elevation >= -90 && elevation <= 90;
const angle = (value: number) => Number.isFinite(value) ? `${value.toFixed(2)}°` : '—';

/** Break chronological paths at north: never draw a false line across the plot. */
function tracks(data: EphemerisPoint[], body: 'sun' | 'earth'): PlotPoint[][] {
  const segments: PlotPoint[][] = [];
  let segment: PlotPoint[] = [];
  data.forEach((sample) => {
    const azimuth = sample[`${body}_azimuth`];
    const elevation = sample[`${body}_elevation`];
    if (!validAngle(azimuth, elevation)) {
      if (segment.length) segments.push(segment);
      segment = [];
      return;
    }
    const point = { azimuth: wrap(azimuth), elevation, datetime: sample.datetime };
    if (segment.length && Math.abs(point.azimuth - segment[segment.length - 1].azimuth) > 180) {
      segments.push(segment);
      segment = [];
    }
    segment.push(point);
  });
  if (segment.length) segments.push(segment);
  return segments;
}

export const MeasuredHorizon: React.FC<MeasuredHorizonProps> = ({ profile, data, language, onPin }) => {
  const id = useId();
  const tr = language === 'tr';
  const text = tr ? {
    title: 'Ölçülen ufuk profili', terrain: 'Ölçülen arazi ufku', sun: 'Güneş açısal izi',
    earth: 'Dünya açısal izi', azimuth: 'Azimut', elevation: 'Yükseklik açısı',
    note: 'Arazi ufku ile gökcisimlerinin açıları ayrı verilerdir. 0° yerel yatay düzlemdir; arazi ufku değildir. Açılar tek başına görünürlük veya bağlantı garantisi vermez.',
    noProfile: 'Ölçülen ufuk profili yok. Arazi engelleri gösterilmiyor.',
    noTracks: 'Geçerli efemeris açısı yok. Gökcismi izleri gösterilmiyor.',
    empty: 'Çizilecek geçerli açı verisi yok.', table: 'Açı verilerini aç',
    samples: 'Ölçülen ufuk örnekleri', ephemeris: 'Efemeris açıları', time: 'Zaman (UTC)',
    pin: 'Zamanı sabitle', north: 'K', east: 'D', south: 'G', west: 'B',
    convention: 'Azimut: kuzeyden saat yönünde, 0–360°. İzler zaman sırasındadır; kuzey geçişinde kesilir.',
  } : {
    title: 'Measured horizon profile', terrain: 'Measured terrain horizon', sun: 'Sun angular track',
    earth: 'Earth angular track', azimuth: 'Azimuth', elevation: 'Elevation angle',
    note: 'Terrain horizon and celestial angles are separate data. 0° is the local horizontal plane, not the terrain horizon. Angles alone do not guarantee visibility or a communications link.',
    noProfile: 'No measured horizon profile. Terrain obstructions are not shown.',
    noTracks: 'No valid ephemeris angles. Celestial tracks are not shown.',
    empty: 'No valid angle data to plot.', table: 'Show angle data',
    samples: 'Measured horizon samples', ephemeris: 'Ephemeris angles', time: 'Time (UTC)',
    pin: 'Pin time', north: 'N', east: 'E', south: 'S', west: 'W',
    convention: 'Azimuth: clockwise from north, 0–360°. Tracks follow time order and break at north.',
  };
  const measured = useMemo(() => profile
    .filter((p) => validAngle(p.azimuth, p.elevation))
    .map((p) => ({ azimuth: wrap(p.azimuth), elevation: p.elevation }))
    .sort((a, b) => a.azimuth - b.azimuth), [profile]);
  const sun = useMemo(() => tracks(data, 'sun'), [data]);
  const earth = useMemo(() => tracks(data, 'earth'), [data]);
  const hasTracks = sun.length > 0 || earth.length > 0;
  const elevations = [...measured, ...sun.flat(), ...earth.flat()].map((p) => p.elevation);
  const lower = Math.max(-90, Math.floor(elevations.reduce((min, v) => Math.min(min, v), 0) - 2));
  const upper = Math.min(90, Math.ceil(elevations.reduce((max, v) => Math.max(max, v), 0) + 2));
  const cardinal = (value: number) => {
    const labels: Record<number, string> = { 0: text.north, 90: text.east, 180: text.south, 270: text.west, 360: text.north };
    return `${value}° ${labels[value] || ''}`;
  };

  return (
    <section className="instrument-panel measured-horizon" aria-labelledby={`${id}-title`} lang={language}>
      <header className="measured-horizon__heading">
        <h3 id={`${id}-title`}>{text.title}</h3>
        <ul className="measured-horizon__legend" aria-label={tr ? 'Veri serileri' : 'Data series'}>
          <li className="measured-horizon__terrain">{text.terrain}</li>
          <li className="measured-horizon__sun">{text.sun}</li>
          <li className="measured-horizon__earth">{text.earth}</li>
        </ul>
        <p id={`${id}-note`}>{text.note}</p>
      </header>
      {!measured.length && <p className="measured-horizon__notice" role="status">{text.noProfile}</p>}
      {!hasTracks && <p className="measured-horizon__notice" role="status">{text.noTracks}</p>}
      {measured.length || hasTracks ? (
        <div className="measured-horizon__chart" role="img" aria-label={`${text.title}. ${text.convention}`} aria-describedby={`${id}-note`}>
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart margin={{ top: 16, right: 30, bottom: 34, left: 14 }} accessibilityLayer={false}>
              <CartesianGrid stroke="#34383d" strokeDasharray="3 3" />
              <XAxis type="number" dataKey="azimuth" domain={[0, 360]} ticks={[0, 90, 180, 270, 360]}
                allowDataOverflow tickFormatter={cardinal} stroke="#adb3bc" fontSize={11}
                label={{ value: `${text.azimuth} (°)`, position: 'bottom', offset: 16, fill: '#adb3bc' }} />
              <YAxis type="number" dataKey="elevation" domain={[lower, upper]} tickFormatter={(v) => `${v}°`}
                stroke="#adb3bc" fontSize={11} width={52}
                label={{ value: `${text.elevation} (°)`, angle: -90, position: 'insideLeft', fill: '#adb3bc', fontSize: 11 }} />
              <ReferenceLine y={0} stroke="#89919c" strokeDasharray="5 5" />
              <Tooltip content={({ active, payload }) => {
                if (!active || !payload?.length) return null;
                return <div className="measured-horizon__tooltip">{payload.map((item, index) => {
                  const point = item.payload as PlotPoint;
                  return <div key={index}><strong>{item.name}</strong><br />
                    {text.azimuth}: {angle(point.azimuth)} · {text.elevation}: {angle(point.elevation)}
                    {point.datetime && <><br />{text.time}: {point.datetime}</>}
                  </div>;
                })}</div>;
              }} />
              <Line data={measured} dataKey="elevation" name={text.terrain} type="linear" stroke="#d5d8dc"
                strokeWidth={2} dot={{ r: 2 }} isAnimationActive={false} connectNulls={false} />
              {sun.map((segment, index) => <Line key={`sun-${index}`} data={segment} dataKey="elevation" name={text.sun}
                type="linear" stroke="#e2b764" strokeWidth={2} dot={{ r: 2 }} isAnimationActive={false} />)}
              {earth.map((segment, index) => <Line key={`earth-${index}`} data={segment} dataKey="elevation" name={text.earth}
                type="linear" stroke="#8dcbd5" strokeWidth={2} strokeDasharray="5 3" dot={{ r: 2 }} isAnimationActive={false} />)}
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      ) : <p className="measured-horizon__notice">{text.empty}</p>}
      <p className="measured-horizon__convention">{text.convention}</p>
      {(measured.length > 0 || data.length > 0) && <details className="measured-horizon__details">
        <summary>{text.table}</summary>
        {measured.length > 0 && <div className="measured-horizon__table" role="region" aria-label={text.samples} tabIndex={0}>
          <table><caption>{text.samples}</caption><thead><tr><th scope="col">{text.azimuth}</th><th scope="col">{text.elevation}</th></tr></thead>
            <tbody>{measured.map((p, i) => <tr key={i}><td>{angle(p.azimuth)}</td><td>{angle(p.elevation)}</td></tr>)}</tbody>
          </table>
        </div>}
        {data.length > 0 && <div className="measured-horizon__table" role="region" aria-label={text.ephemeris} tabIndex={0}>
          <table><caption>{text.ephemeris}</caption><thead><tr>
            <th scope="col">{text.time}</th><th scope="col">{text.sun}: {text.azimuth}</th><th scope="col">{text.sun}: {text.elevation}</th>
            <th scope="col">{text.earth}: {text.azimuth}</th><th scope="col">{text.earth}: {text.elevation}</th>
            {onPin && <th scope="col">{text.pin}</th>}
          </tr></thead><tbody>{data.map((p, i) => <tr key={`${p.timestamp}-${i}`}>
            <td>{p.datetime}</td><td>{angle(wrap(p.sun_azimuth))}</td><td>{angle(p.sun_elevation)}</td>
            <td>{angle(wrap(p.earth_azimuth))}</td><td>{angle(p.earth_elevation)}</td>
            {onPin && <td><button type="button" onClick={() => onPin(p)} aria-label={`${text.pin}: ${p.datetime}`}>{text.pin}</button></td>}
          </tr>)}</tbody></table>
        </div>}
      </details>}
    </section>
  );
};

export default MeasuredHorizon;
