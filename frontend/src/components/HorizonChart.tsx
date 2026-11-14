import React from 'react';
import {
  ResponsiveContainer,
  ComposedChart,
  Line,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  ReferenceLine,
} from 'recharts';
import { EphemerisPoint } from '../types';

interface HorizonChartProps {
  data: EphemerisPoint[];
  siteName: string;
}

export const HorizonChart: React.FC<HorizonChartProps> = ({ data, siteName }) => {
  if (!data || data.length === 0) {
    return (
      <section className="instrument-panel horizon-panel horizon-empty" aria-label="Elevation chart" role="status">
        <div className="panel-heading">
          <h3>Sun & Earth elevation</h3>
          <p>{siteName || 'Selected landing site'}</p>
        </div>
        <div className="empty-state">
          <span className="empty-state-label">No ephemeris data</span>
          <p>Choose a landing site and simulation period, then run the simulation to inspect elevation above the local horizon.</p>
          <p className="empty-state-note">Sun and Earth trajectories will appear here when results are available.</p>
        </div>
      </section>
    );
  }

  const chartData = data.map((d) => ({
    ...d,
    displayTime: d.datetime.replace('2026-', '').replace(':00', ''),
  }));
  const sunElevations = data.map((d) => d.sun_elevation);
  const earthElevations = data.map((d) => d.earth_elevation);
  const minEl = Math.min(...sunElevations, ...earthElevations, -3.0);
  const maxEl = Math.max(...sunElevations, ...earthElevations, 3.0);
  const signedAngle = (value: number) => `${value > 0 ? '+' : ''}${value.toFixed(2)}°`;

  return (
    <section className="instrument-panel horizon-panel" aria-label={`Elevation chart for ${siteName}`}>
      <div className="panel-heading horizon-heading">
        <div>
          <h3>Sun & Earth elevation vs local horizon</h3>
          <p>Site: {siteName} · Horizon at 0° · Elevation above 0° is visible</p>
        </div>
        <div className="chart-legend">
          <span className="legend-item data-sun"><span className="legend-line" />Sun angle (power)</span>
          <span className="legend-item data-earth"><span className="legend-line" />Earth angle (DTE)</span>
        </div>
      </div>

      <div className="horizon-chart" style={{ width: '100%', height: 320 }}>
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={chartData} margin={{ top: 12, right: 20, left: -8, bottom: 24 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#303235" />
            <XAxis dataKey="displayTime" stroke="#989b9f" fontSize={11} tickLine={false} angle={-30} textAnchor="end" />
            <YAxis
              stroke="#989b9f"
              fontSize={11}
              domain={[Math.floor(minEl - 1), Math.ceil(maxEl + 1)]}
              tickFormatter={(val) => `${val}°`}
              label={{ value: 'Elevation (°)', angle: -90, position: 'insideLeft', fill: '#989b9f', fontSize: 12, offset: 16 }}
            />
            <Tooltip
              contentStyle={{ backgroundColor: '#1b1d20', borderColor: '#3a3d41', borderRadius: 8, color: '#e6e7e9', fontSize: 12 }}
              formatter={(value: any, name: any) => {
                if (name === 'Sun elevation' || name === 'sun_elevation') return [`${value}°`, 'Sun elevation'];
                if (name === 'Earth elevation' || name === 'earth_elevation') return [`${value}°`, 'Earth elevation'];
                if (name === 'solar_flux_pct') return [`${value}%`, 'Solar flux efficiency'];
                return [value, name];
              }}
              labelFormatter={(label) => `Time: ${label}`}
            />
            <ReferenceLine y={0} stroke="#a4a6aa" strokeWidth={1} strokeDasharray="4 4"
              label={{ value: 'Horizon (0°)', position: 'insideTopRight', fill: '#a4a6aa', fontSize: 11, fontWeight: 400 }} />
            <Line type="monotone" dataKey="earth_elevation" name="Earth elevation" stroke="#82b4bd" strokeWidth={2} dot={false} activeDot={{ r: 4, fill: '#82b4bd' }} isAnimationActive={false} />
            <Area type="monotone" dataKey="sun_elevation" name="Sun elevation" stroke="#d3a65c" strokeWidth={2} fill="#d3a65c" fillOpacity={0.08} dot={false} activeDot={{ r: 4, fill: '#d3a65c' }} isAnimationActive={false} />
          </ComposedChart>
        </ResponsiveContainer>
      </div>

      <dl className="chart-stats">
        <div><dt>Min Sun angle</dt><dd className="data-sun">{signedAngle(Math.min(...sunElevations))}</dd></div>
        <div><dt>Max Sun angle</dt><dd className="data-sun">{signedAngle(Math.max(...sunElevations))}</dd></div>
        <div><dt>Min Earth angle</dt><dd className="data-earth">{signedAngle(Math.min(...earthElevations))}</dd></div>
        <div><dt>Max Earth angle</dt><dd className="data-earth">{signedAngle(Math.max(...earthElevations))}</dd></div>
      </dl>
    </section>
  );
};
