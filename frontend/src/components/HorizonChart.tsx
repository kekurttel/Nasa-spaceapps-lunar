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
  Legend
} from 'recharts';
import { EphemerisPoint } from '../types';

interface HorizonChartProps {
  data: EphemerisPoint[];
  siteName: string;
}

export const HorizonChart: React.FC<HorizonChartProps> = ({ data, siteName }) => {
  if (!data || data.length === 0) {
    return (
      <div className="flex items-center justify-center h-80 bg-slate-900/50 rounded-xl border border-slate-800 text-slate-400">
        No ephemeris data available. Run simulation to display trajectory.
      </div>
    );
  }

  // Format short date for X-Axis tick
  const chartData = data.map((d) => ({
    ...d,
    displayTime: d.datetime.replace('2026-', '').replace(':00', ''),
  }));

  // Min and max elevation calculation for Y-Axis bounds
  const sunElevations = data.map((d) => d.sun_elevation);
  const earthElevations = data.map((d) => d.earth_elevation);
  const minEl = Math.min(...sunElevations, ...earthElevations, -3.0);
  const maxEl = Math.max(...sunElevations, ...earthElevations, 3.0);

  return (
    <div className="w-full bg-slate-900/80 backdrop-blur-md p-5 rounded-xl border border-slate-800 shadow-xl">
      <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
        <div>
          <h3 className="text-lg font-bold text-white flex items-center gap-2">
            <span className="w-3 h-3 rounded-full bg-amber-400 shadow-[0_0_8px_#f59e0b]"></span>
            Sun & Earth Elevation vs Local Horizon
          </h3>
          <p className="text-xs text-slate-400">
            Site: <span className="text-cyan-400 font-medium">{siteName}</span> • Horizon threshold at 0° (Elevation &gt; 0 = Visible)
          </p>
        </div>

        <div className="flex items-center gap-4 text-xs font-mono">
          <div className="flex items-center gap-1.5 text-amber-400">
            <span className="inline-block w-3 h-0.5 bg-amber-400"></span>
            <span>Sun Angle (Power)</span>
          </div>
          <div className="flex items-center gap-1.5 text-cyan-400">
            <span className="inline-block w-3 h-0.5 bg-cyan-400"></span>
            <span>Earth Angle (Comm DTE)</span>
          </div>
        </div>
      </div>

      <div className="w-full h-[320px]">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={chartData} margin={{ top: 10, right: 20, left: -10, bottom: 25 }}>
            <defs>
              <linearGradient id="sunArea" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#f59e0b" stopOpacity={0.25} />
                <stop offset="95%" stopColor="#f59e0b" stopOpacity={0.0} />
              </linearGradient>
              <linearGradient id="earthArea" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#38bdf8" stopOpacity={0.25} />
                <stop offset="95%" stopColor="#38bdf8" stopOpacity={0.0} />
              </linearGradient>
            </defs>

            <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
            
            <XAxis
              dataKey="displayTime"
              stroke="#64748b"
              fontSize={11}
              tickLine={false}
              angle={-30}
              textAnchor="end"
            />
            
            <YAxis
              stroke="#64748b"
              fontSize={11}
              domain={[Math.floor(minEl - 1), Math.ceil(maxEl + 1)]}
              tickFormatter={(val) => `${val}°`}
              label={{
                value: 'Elevation (°)',
                angle: -90,
                position: 'insideLeft',
                fill: '#94a3b8',
                fontSize: 12,
                offset: 15
              }}
            />

            <Tooltip
              contentStyle={{
                backgroundColor: '#0f172a',
                borderColor: '#334155',
                borderRadius: '8px',
                color: '#f8fafc',
                fontSize: '12px',
                boxShadow: '0 10px 25px -5px rgba(0,0,0,0.5)'
              }}
              formatter={(value: any, name: any) => {
                if (name === 'sun_elevation') return [`${value}°`, '☀️ Sun Elevation'];
                if (name === 'earth_elevation') return [`${value}°`, '🌍 Earth Elevation'];
                if (name === 'solar_flux_pct') return [`${value}%`, '⚡ Solar Flux Eff.'];
                return [value, name];
              }}
              labelFormatter={(label) => `Time: ${label}`}
            />

            <Legend verticalAlign="top" height={36} wrapperStyle={{ fontSize: '12px' }} />

            {/* Zero Horizon Reference Line */}
            <ReferenceLine
              y={0}
              stroke="#ef4444"
              strokeWidth={1.5}
              strokeDasharray="4 4"
              label={{
                value: 'HORIZON (0°)',
                position: 'right',
                fill: '#f87171',
                fontSize: 10,
                fontWeight: 'bold'
              }}
            />

            {/* Earth Elevation Line */}
            <Line
              type="monotone"
              dataKey="earth_elevation"
              name="Earth Elevation"
              stroke="#38bdf8"
              strokeWidth={2.5}
              dot={false}
              activeDot={{ r: 5, fill: '#38bdf8' }}
            />

            {/* Sun Elevation Line & Area */}
            <Area
              type="monotone"
              dataKey="sun_elevation"
              name="Sun Elevation"
              stroke="#f59e0b"
              strokeWidth={2.5}
              fill="url(#sunArea)"
              dot={false}
              activeDot={{ r: 5, fill: '#f59e0b' }}
            />
          </ComposedChart>
        </ResponsiveContainer>
      </div>

      <div className="mt-3 grid grid-cols-2 sm:grid-cols-4 gap-2 pt-3 border-t border-slate-800/80 text-xs text-slate-300">
        <div className="p-2 rounded bg-slate-800/40 border border-slate-800">
          <span className="text-slate-400 block text-[10px] uppercase">Min Sun Angle</span>
          <span className="font-mono font-bold text-amber-400">{Math.min(...sunElevations).toFixed(2)}°</span>
        </div>
        <div className="p-2 rounded bg-slate-800/40 border border-slate-800">
          <span className="text-slate-400 block text-[10px] uppercase">Max Sun Angle</span>
          <span className="font-mono font-bold text-amber-400">+{Math.max(...sunElevations).toFixed(2)}°</span>
        </div>
        <div className="p-2 rounded bg-slate-800/40 border border-slate-800">
          <span className="text-slate-400 block text-[10px] uppercase">Min Earth Angle</span>
          <span className="font-mono font-bold text-cyan-400">{Math.min(...earthElevations).toFixed(2)}°</span>
        </div>
        <div className="p-2 rounded bg-slate-800/40 border border-slate-800">
          <span className="text-slate-400 block text-[10px] uppercase">Max Earth Angle</span>
          <span className="font-mono font-bold text-cyan-400">+{Math.max(...earthElevations).toFixed(2)}°</span>
        </div>
      </div>
    </div>
  );
};
