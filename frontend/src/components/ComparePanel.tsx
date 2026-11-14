import React from 'react';
import { SiteEphemeris } from '../types';

interface ComparePanelProps {
  sites: SiteEphemeris[];
  activeSiteIndex: number;
  onSelectActiveIndex: (index: number) => void;
  onRemoveSite: (index: number) => void;
}

export const ComparePanel: React.FC<ComparePanelProps> = ({
  sites,
  activeSiteIndex,
  onSelectActiveIndex,
  onRemoveSite,
}) => {
  if (!sites || sites.length === 0) return null;

  return (
    <div className="w-full bg-slate-900/80 backdrop-blur-md p-5 rounded-xl border border-slate-800 shadow-xl space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h3 className="text-base font-bold text-white flex items-center gap-2">
            <span>⚖️</span> Comparative Landing Sites Matrix
          </h3>
          <p className="text-xs text-slate-400">
            Compare illumination fractions, direct communication windows and blackout risks across candidate locations
          </p>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-left text-xs border-collapse">
          <thead>
            <tr className="border-b border-slate-700 bg-slate-950/60 text-slate-300 font-mono">
              <th className="p-3">Landing Site</th>
              <th className="p-3">Coords (Lat, Lon)</th>
              <th className="p-3 text-amber-400">Sunlight %</th>
              <th className="p-3 text-cyan-400">Earth Comm %</th>
              <th className="p-3 text-rose-400">Max Dark Blackout</th>
              <th className="p-3 text-purple-400">Max Comm Blackout</th>
              <th className="p-3 text-emerald-400">Feasibility Score</th>
              <th className="p-3 text-center">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800">
            {sites.map((item, idx) => {
              const summary = item.summary;
              // Simple composite feasibility score (0-100)
              // Highly rewarded for sun and earth availability, penalized for long continuous blackouts
              const score = Math.max(
                5,
                Math.min(
                  99,
                  Math.round(
                    summary.sun_percentage * 0.45 +
                      summary.earth_percentage * 0.45 -
                      Math.min(30, (summary.max_continuous_dark_hours / (summary.total_hours || 1)) * 30)
                  )
                )
              );

              const isActive = idx === activeSiteIndex;

              return (
                <tr
                  key={idx}
                  onClick={() => onSelectActiveIndex(idx)}
                  className={`cursor-pointer transition-colors ${
                    isActive
                      ? 'bg-cyan-950/40 border-l-4 border-l-cyan-400'
                      : 'hover:bg-slate-800/40'
                  }`}
                >
                  <td className="p-3 font-semibold text-white flex items-center gap-2">
                    <span
                      className={`w-2 h-2 rounded-full ${
                        isActive ? 'bg-cyan-400 animate-ping' : 'bg-slate-600'
                      }`}
                    ></span>
                    {item.site.name || `Site #${idx + 1}`}
                  </td>
                  <td className="p-3 font-mono text-slate-400">
                    {item.site.lat.toFixed(2)}°, {item.site.lon.toFixed(2)}°
                  </td>
                  <td className="p-3 font-mono font-bold text-amber-400">
                    {summary.sun_percentage}%
                    <span className="text-[10px] text-slate-500 font-normal ml-1">
                      ({summary.sun_hours}h)
                    </span>
                  </td>
                  <td className="p-3 font-mono font-bold text-cyan-400">
                    {summary.earth_percentage}%
                    <span className="text-[10px] text-slate-500 font-normal ml-1">
                      ({summary.earth_visible_hours}h)
                    </span>
                  </td>
                  <td className="p-3 font-mono text-rose-400">
                    {summary.max_continuous_dark_hours} hrs
                  </td>
                  <td className="p-3 font-mono text-purple-400">
                    {summary.max_continuous_no_comm_hours} hrs
                  </td>
                  <td className="p-3 font-mono">
                    <span
                      className={`px-2 py-0.5 rounded text-[11px] font-bold ${
                        score >= 70
                          ? 'bg-emerald-950 text-emerald-300 border border-emerald-800'
                          : score >= 45
                          ? 'bg-amber-950 text-amber-300 border border-amber-800'
                          : 'bg-rose-950 text-rose-300 border border-rose-800'
                      }`}
                    >
                      {score} / 100
                    </span>
                  </td>
                  <td className="p-3 text-center">
                    {sites.length > 1 && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onRemoveSite(idx);
                        }}
                        className="px-2 py-1 text-slate-400 hover:text-rose-400 hover:bg-rose-950/30 rounded text-xs transition"
                        title="Remove site from comparison"
                      >
                        ✕
                      </button>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
};
