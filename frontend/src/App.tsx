import React, { useState, useEffect } from 'react';
import { MoonMap } from './components/MoonMap';
import { HorizonChart } from './components/HorizonChart';
import { TimelineBar } from './components/TimelineBar';
import { ComparePanel } from './components/ComparePanel';
import { getPresetSites, fetchEphemerisMulti } from './services/api';
import { PresetSite, SiteEphemeris, SiteRequest } from './types';

export const App: React.FC = () => {
  // Preset list
  const [presets, setPresets] = useState<PresetSite[]>([]);
  
  // Sites in comparison list
  const [selectedSites, setSelectedSites] = useState<SiteRequest[]>([
    { name: 'Shackleton Crater Rim', lat: -89.9, lon: 0.0 },
    { name: 'Nobile Rim / Ridge 1', lat: -85.2, lon: 35.5 },
  ]);

  // Current active site index being visualized in the chart/timeline
  const [activeSiteIdx, setActiveSiteIdx] = useState<number>(0);

  // Date range (Target Mission Window in 2026)
  const [startDate, setStartDate] = useState<string>('2026-06-01T00:00');
  const [endDate, setEndDate] = useState<string>('2026-06-30T00:00');
  const [stepHours, setStepHours] = useState<number>(2);

  // Results
  const [ephemerisData, setEphemerisData] = useState<SiteEphemeris[]>([]);
  const [dataSource, setDataSource] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Fetch presets on initial mount
  useEffect(() => {
    const loadPresets = async () => {
      try {
        const data = await getPresetSites();
        setPresets(data);
      } catch (err) {
        console.warn('Could not load presets from backend, using fallback list', err);
      }
    };
    loadPresets();
  }, []);

  // Fetch ephemeris simulation whenever sites or dates change
  const runSimulation = async () => {
    if (selectedSites.length === 0) return;
    setLoading(true);
    setErrorMsg(null);
    try {
      const res = await fetchEphemerisMulti(selectedSites, startDate, endDate, stepHours);
      setEphemerisData(res.sites);
      setDataSource(res.source);
      if (activeSiteIdx >= res.sites.length) {
        setActiveSiteIdx(0);
      }
    } catch (err: any) {
      console.error(err);
      setErrorMsg('Failed to fetch ephemeris data. Ensure backend is running.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    runSimulation();
  }, [selectedSites, startDate, endDate, stepHours]);

  // Handle click on map to set or add coordinate
  const handleSelectMapSite = (site: SiteRequest) => {
    // If site already in list, select it, else replace current active or add
    const existingIdx = selectedSites.findIndex(
      (s) => Math.abs(s.lat - site.lat) < 0.01 && Math.abs(s.lon - site.lon) < 0.01
    );
    if (existingIdx >= 0) {
      setActiveSiteIdx(existingIdx);
    } else {
      const updated = [...selectedSites];
      updated[activeSiteIdx] = site;
      setSelectedSites(updated);
    }
  };

  const handleAddSite = (preset: PresetSite) => {
    const exists = selectedSites.some(
      (s) => Math.abs(s.lat - preset.lat) < 0.01 && Math.abs(s.lon - preset.lon) < 0.01
    );
    if (!exists) {
      const newSites = [...selectedSites, { name: preset.name, lat: preset.lat, lon: preset.lon }];
      setSelectedSites(newSites);
      setActiveSiteIdx(newSites.length - 1);
    }
  };

  const handleRemoveSite = (index: number) => {
    if (selectedSites.length <= 1) return;
    const newSites = selectedSites.filter((_, i) => i !== index);
    setSelectedSites(newSites);
    if (activeSiteIdx >= newSites.length) {
      setActiveSiteIdx(newSites.length - 1);
    }
  };

  const activeEphemeris = ephemerisData[activeSiteIdx];
  const activeSite = selectedSites[activeSiteIdx] || selectedSites[0];

  // Export current simulation results as JSON
  const handleExportJSON = () => {
    if (!ephemerisData.length) return;
    const blob = new Blob([JSON.stringify(ephemerisData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `lunar_navigator_sim_${startDate.slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="min-h-screen bg-[#07090e] text-slate-100 flex flex-col font-sans">
      {/* Top Navigation Bar */}
      <header className="border-b border-slate-800/80 bg-slate-950/80 backdrop-blur-md sticky top-0 z-50 px-6 py-3.5 flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-gradient-to-tr from-cyan-500 to-amber-400 p-[1px] flex items-center justify-center shadow-[0_0_15px_rgba(6,182,212,0.5)]">
            <div className="w-full h-full bg-slate-950 rounded-lg flex items-center justify-center font-bold text-base text-cyan-400">
              ☾
            </div>
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-base font-extrabold tracking-wide text-white">
                LUNARSIGHT
              </h1>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-cyan-950 text-cyan-400 border border-cyan-800">
                v1.0 • NASA SPACE APPS 2026
              </span>
            </div>
            <p className="text-[11px] text-slate-400">
              Lunar Landing Site Navigator & Solar/Earth Geometry Feasibility Engine
            </p>
          </div>
        </div>

        {/* Live Ephemeris Engine Indicator */}
        <div className="flex items-center gap-3 text-xs font-mono">
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-slate-900 border border-slate-800">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
            <span className="text-slate-400">Engine:</span>
            <span className="text-emerald-300 font-semibold">{dataSource || 'CONNECTING...'}</span>
          </div>

          <button
            onClick={handleExportJSON}
            disabled={!ephemerisData.length}
            className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 transition flex items-center gap-1.5 disabled:opacity-50"
          >
            <span>📥</span> Export Sim Data
          </button>
        </div>
      </header>

      {/* Main Container */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-4 sm:p-6 space-y-6">
        {/* Mission Planning Control Bar */}
        <div className="bg-slate-900/80 backdrop-blur-md p-4 sm:p-5 rounded-xl border border-slate-800 shadow-xl flex flex-wrap items-end justify-between gap-4">
          <div className="flex flex-wrap items-center gap-4">
            {/* Start Date */}
            <div>
              <label className="block text-[11px] font-mono uppercase text-slate-400 mb-1">
                Mission Start Date (UTC)
              </label>
              <input
                type="datetime-local"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="bg-slate-950 border border-slate-700 rounded-lg px-3 py-1.5 text-xs text-white font-mono focus:border-cyan-400 focus:outline-none"
              />
            </div>

            {/* End Date */}
            <div>
              <label className="block text-[11px] font-mono uppercase text-slate-400 mb-1">
                Mission End Date (UTC)
              </label>
              <input
                type="datetime-local"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="bg-slate-950 border border-slate-700 rounded-lg px-3 py-1.5 text-xs text-white font-mono focus:border-cyan-400 focus:outline-none"
              />
            </div>

            {/* Step Size */}
            <div>
              <label className="block text-[11px] font-mono uppercase text-slate-400 mb-1">
                Resolution (Hours)
              </label>
              <select
                value={stepHours}
                onChange={(e) => setStepHours(Number(e.target.value))}
                className="bg-slate-950 border border-slate-700 rounded-lg px-3 py-1.5 text-xs text-white font-mono focus:border-cyan-400 focus:outline-none"
              >
                <option value={1}>1 Hour (High Res)</option>
                <option value={2}>2 Hours (Standard)</option>
                <option value={4}>4 Hours</option>
                <option value={6}>6 Hours</option>
                <option value={12}>12 Hours (Fast)</option>
              </select>
            </div>
          </div>

          {/* Quick Preset Sites Dropdown */}
          <div className="flex items-center gap-2">
            <select
              onChange={(e) => {
                const found = presets.find((p) => p.id === e.target.value);
                if (found) handleAddSite(found);
              }}
              defaultValue=""
              className="bg-slate-950 border border-cyan-800 text-cyan-300 rounded-lg px-3 py-1.5 text-xs font-medium focus:border-cyan-400 focus:outline-none"
            >
              <option value="" disabled>
                + Add Candidate Landing Site...
              </option>
              {presets.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name} ({p.lat}°, {p.lon}°)
                </option>
              ))}
            </select>

            <button
              onClick={runSimulation}
              disabled={loading}
              className="bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white font-bold px-4 py-1.5 rounded-lg text-xs shadow-lg shadow-cyan-900/30 transition flex items-center gap-1.5 disabled:opacity-50"
            >
              {loading ? (
                <>
                  <span className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin"></span>
                  Calculating...
                </>
              ) : (
                <>
                  <span>⚡</span> Run Analysis
                </>
              )}
            </button>
          </div>
        </div>

        {errorMsg && (
          <div className="p-3 rounded-lg bg-rose-950/60 border border-rose-800 text-rose-300 text-xs flex items-center gap-2">
            <span>⚠️</span> {errorMsg}
          </div>
        )}

        {/* Key Metrics Summary Cards for Active Site */}
        {activeEphemeris && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="bg-slate-900/70 border border-slate-800 p-4 rounded-xl">
              <span className="text-[11px] font-mono uppercase text-slate-400 block mb-1">
                ☀️ Solar Illumination
              </span>
              <div className="flex items-baseline gap-2">
                <span className="text-2xl font-black font-mono text-amber-400">
                  {activeEphemeris.summary.sun_percentage}%
                </span>
                <span className="text-xs text-slate-400 font-mono">
                  ({activeEphemeris.summary.sun_hours} hrs)
                </span>
              </div>
              <span className="text-[10px] text-slate-500 mt-1 block">
                Avg Elev when lit: {activeEphemeris.summary.avg_sun_elevation_when_visible}°
              </span>
            </div>

            <div className="bg-slate-900/70 border border-slate-800 p-4 rounded-xl">
              <span className="text-[11px] font-mono uppercase text-slate-400 block mb-1">
                📡 Direct-to-Earth Comm
              </span>
              <div className="flex items-baseline gap-2">
                <span className="text-2xl font-black font-mono text-cyan-400">
                  {activeEphemeris.summary.earth_percentage}%
                </span>
                <span className="text-xs text-slate-400 font-mono">
                  ({activeEphemeris.summary.earth_visible_hours} hrs)
                </span>
              </div>
              <span className="text-[10px] text-slate-500 mt-1 block">
                Avg Elev when visible: {activeEphemeris.summary.avg_earth_elevation_when_visible}°
              </span>
            </div>

            <div className="bg-slate-900/70 border border-slate-800 p-4 rounded-xl">
              <span className="text-[11px] font-mono uppercase text-slate-400 block mb-1">
                🌑 Max Continuous Night
              </span>
              <div className="flex items-baseline gap-2">
                <span className="text-2xl font-black font-mono text-rose-400">
                  {activeEphemeris.summary.max_continuous_dark_hours}h
                </span>
                <span className="text-xs text-slate-400 font-mono">
                  ({(activeEphemeris.summary.max_continuous_dark_hours / 24).toFixed(1)} days)
                </span>
              </div>
              <span className="text-[10px] text-slate-500 mt-1 block">
                Battery survival design requirement
              </span>
            </div>

            <div className="bg-slate-900/70 border border-slate-800 p-4 rounded-xl">
              <span className="text-[11px] font-mono uppercase text-slate-400 block mb-1">
                🚫 Max Comm Blackout
              </span>
              <div className="flex items-baseline gap-2">
                <span className="text-2xl font-black font-mono text-purple-400">
                  {activeEphemeris.summary.max_continuous_no_comm_hours}h
                </span>
                <span className="text-xs text-slate-400 font-mono">
                  ({(activeEphemeris.summary.max_continuous_no_comm_hours / 24).toFixed(1)} days)
                </span>
              </div>
              <span className="text-[10px] text-slate-500 mt-1 block">
                Autonomous rover storage duration
              </span>
            </div>
          </div>
        )}

        {/* Map & Horizon Chart Dual Layout */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
          {/* Lunar Map Section */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-bold uppercase tracking-wider text-slate-300 flex items-center gap-2">
                <span>🗺️</span> Lunar Basemap Selector
              </h2>
              <span className="text-xs font-mono text-slate-400">
                Selected: <span className="text-amber-400 font-bold">{activeSite.name}</span>
              </span>
            </div>
            <MoonMap
              selectedSite={activeSite}
              presetSites={presets}
              onSelectSite={handleSelectMapSite}
            />
          </div>

          {/* Elevation Horizon Chart Section */}
          <div className="space-y-3">
            <h2 className="text-sm font-bold uppercase tracking-wider text-slate-300 flex items-center gap-2">
              <span>📈</span> Horizon Elevation Angles
            </h2>
            <HorizonChart
              data={activeEphemeris ? activeEphemeris.data : []}
              siteName={activeSite.name || 'Selected Target'}
            />
          </div>
        </div>

        {/* Timeline Analysis Windows */}
        {activeEphemeris && (
          <TimelineBar data={activeEphemeris.data} />
        )}

        {/* Comparative Landing Site Matrix */}
        <ComparePanel
          sites={ephemerisData}
          activeSiteIndex={activeSiteIdx}
          onSelectActiveIndex={setActiveSiteIdx}
          onRemoveSite={handleRemoveSite}
        />
      </main>

      {/* Footer with Scientific Attribution */}
      <footer className="border-t border-slate-800 bg-slate-950 py-4 px-6 text-center text-xs text-slate-500 font-mono">
        <p>
          NASA Space Apps Challenge 2026 • Lunar Landing Site Navigator • Data: NASA JPL Horizons REST API, LRO LOLA DEM, Moon Trek
        </p>
      </footer>
    </div>
  );
};

export default App;
