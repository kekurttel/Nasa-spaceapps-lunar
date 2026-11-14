import React from 'react';
import { EphemerisPoint } from '../types';

interface TimelineBarProps {
  data: EphemerisPoint[];
}

export const TimelineBar: React.FC<TimelineBarProps> = ({ data }) => {
  if (!data || data.length === 0) return null;

  return (
    <div className="w-full bg-slate-900/80 backdrop-blur-md p-5 rounded-xl border border-slate-800 shadow-xl space-y-4">
      <div>
        <h4 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
          <span>⏱️</span> Mission Windows Timeline
        </h4>
        <p className="text-xs text-slate-400">
          Green / Gold = Active Window • Dark Red / Slate = Inactive / Blackout
        </p>
      </div>

      {/* Solar Power Window */}
      <div>
        <div className="flex justify-between text-xs mb-1.5">
          <span className="text-amber-400 font-semibold flex items-center gap-1.5">
            <span>☀️</span> Solar Power Generation Window
          </span>
          <span className="text-slate-400 font-mono text-[11px]">
            {data.filter((p) => p.sun_visible).length} / {data.length} intervals active
          </span>
        </div>
        <div className="h-6 w-full bg-slate-950 rounded-md overflow-hidden flex border border-slate-800 p-0.5 gap-[1px]">
          {data.map((pt, idx) => (
            <div
              key={idx}
              title={`${pt.datetime}\nSun El: ${pt.sun_elevation}°\nStatus: ${pt.sun_visible ? 'Sunlit' : 'Shadow'}`}
              className={`h-full flex-1 transition-all hover:opacity-100 ${
                pt.sun_visible
                  ? 'bg-amber-400 hover:bg-amber-300 shadow-[0_0_4px_#f59e0b]'
                  : 'bg-slate-900 hover:bg-slate-800 opacity-60'
              }`}
            />
          ))}
        </div>
      </div>

      {/* Earth Direct-to-Earth Communication Window */}
      <div>
        <div className="flex justify-between text-xs mb-1.5">
          <span className="text-cyan-400 font-semibold flex items-center gap-1.5">
            <span>📡</span> Direct-to-Earth (DTE) Line of Sight
          </span>
          <span className="text-slate-400 font-mono text-[11px]">
            {data.filter((p) => p.earth_visible).length} / {data.length} intervals active
          </span>
        </div>
        <div className="h-6 w-full bg-slate-950 rounded-md overflow-hidden flex border border-slate-800 p-0.5 gap-[1px]">
          {data.map((pt, idx) => (
            <div
              key={idx}
              title={`${pt.datetime}\nEarth El: ${pt.earth_elevation}°\nStatus: ${pt.earth_visible ? 'Direct Comm Open' : 'Blocked'}`}
              className={`h-full flex-1 transition-all hover:opacity-100 ${
                pt.earth_visible
                  ? 'bg-cyan-400 hover:bg-cyan-300 shadow-[0_0_4px_#38bdf8]'
                  : 'bg-rose-950/70 hover:bg-rose-900 opacity-60'
              }`}
            />
          ))}
        </div>
      </div>

      {/* Joint Go/No-Go Window (Power AND Comm both active) */}
      <div>
        <div className="flex justify-between text-xs mb-1.5">
          <span className="text-emerald-400 font-semibold flex items-center gap-1.5">
            <span>🚀</span> Optimal Operations Window (Power & Comm Both Open)
          </span>
          <span className="text-slate-400 font-mono text-[11px]">
            {data.filter((p) => p.sun_visible && p.earth_visible).length} / {data.length} intervals optimal
          </span>
        </div>
        <div className="h-6 w-full bg-slate-950 rounded-md overflow-hidden flex border border-slate-800 p-0.5 gap-[1px]">
          {data.map((pt, idx) => {
            const isOptimal = pt.sun_visible && pt.earth_visible;
            return (
              <div
                key={idx}
                title={`${pt.datetime}\nStatus: ${isOptimal ? 'Optimal Landing & EVA Window' : 'Constrained'}`}
                className={`h-full flex-1 transition-all hover:opacity-100 ${
                  isOptimal
                    ? 'bg-emerald-500 hover:bg-emerald-400 shadow-[0_0_6px_#10b981]'
                    : 'bg-slate-900 hover:bg-slate-800 opacity-60'
                }`}
              />
            );
          })}
        </div>
      </div>
    </div>
  );
};
