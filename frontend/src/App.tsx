import React, { useState, useEffect, useCallback, useRef } from 'react';
import { MoonMap } from './components/MoonMap';
import { HorizonChart } from './components/HorizonChart';
import { TimelineBar } from './components/TimelineBar';
import { ComparePanel } from './components/ComparePanel';
import { getPresetSites, fetchEphemerisMulti } from './services/api';
import { PresetSite, SiteEphemeris, SiteRequest } from './types';

export const App: React.FC = () => {
  const [presets, setPresets] = useState<PresetSite[]>([]);
  const [selectedSites, setSelectedSites] = useState<SiteRequest[]>([
    { name: 'Shackleton Crater Rim', lat: -89.9, lon: 0 },
    { name: 'Nobile Rim / Ridge 1', lat: -85.2, lon: 35.5 },
  ]);
  const [activeSiteIdx, setActiveSiteIdx] = useState(0);
  const [startDate, setStartDate] = useState('2026-06-01T00:00');
  const [endDate, setEndDate] = useState('2026-06-30T00:00');
  const [stepHours, setStepHours] = useState(2);
  const [ephemerisData, setEphemerisData] = useState<SiteEphemeris[]>([]);
  const [dataSource, setDataSource] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [catalogError, setCatalogError] = useState(false);
  const requestId = useRef(0);

  useEffect(() => {
    let mounted = true;
    getPresetSites().then(data => { if (mounted) setPresets(data); })
      .catch(() => { if (mounted) setCatalogError(true); });
    return () => { mounted = false; };
  }, []);

  const runSimulation = useCallback(async () => {
    const id = ++requestId.current;
    setEphemerisData([]);
    setDataSource('');
    setErrorMsg(null);
    if (!startDate || !endDate || startDate >= endDate) {
      setLoading(false);
      setErrorMsg('Choose an end date after the start date');
      return;
    }
    setLoading(true);
    try {
      const res = await fetchEphemerisMulti(selectedSites, startDate, endDate, stepHours);
      if (id !== requestId.current) return;
      setEphemerisData(res.sites);
      setDataSource(res.source);
    } catch {
      if (id === requestId.current) setErrorMsg('Ephemeris service unavailable. Check the backend connection, then retry. No substitute data is shown.');
    } finally {
      if (id === requestId.current) setLoading(false);
    }
  }, [selectedSites, startDate, endDate, stepHours]);

  useEffect(() => {
    runSimulation();
    return () => { requestId.current += 1; };
  }, [runSimulation]);

  const handleSelectMapSite = (site: SiteRequest) => {
    const index = selectedSites.findIndex(s => Math.abs(s.lat - site.lat) < 0.01 && Math.abs(s.lon - site.lon) < 0.01);
    if (index >= 0) setActiveSiteIdx(index);
    else setSelectedSites(sites => sites.map((s, i) => i === activeSiteIdx ? site : s));
  };
  const handleAddSite = (preset: PresetSite) => {
    if (selectedSites.some(s => Math.abs(s.lat - preset.lat) < 0.01 && Math.abs(s.lon - preset.lon) < 0.01)) return;
    setSelectedSites([...selectedSites, { name: preset.name, lat: preset.lat, lon: preset.lon }]);
    setActiveSiteIdx(selectedSites.length);
  };
  const handleRemoveSite = (index: number) => {
    if (selectedSites.length <= 1) return;
    setSelectedSites(selectedSites.filter((_, i) => i !== index));
    setActiveSiteIdx(current => current === index ? 0 : current > index ? current - 1 : current);
  };
  const activeSite = selectedSites[activeSiteIdx] || selectedSites[0];
  const activeEphemeris = ephemerisData[activeSiteIdx];
  const summary = activeEphemeris?.summary;
  const handleExportJSON = () => {
    const url = URL.createObjectURL(new Blob([JSON.stringify({ source: dataSource, startUtc: startDate, endUtc: endDate, stepHours, sites: ephemerisData }, null, 2)], { type: 'application/json' }));
    const link = document.createElement('a');
    link.href = url;
    link.download = `lunarsight-${startDate.slice(0, 10)}.json`;
    link.click();
    URL.revokeObjectURL(url);
  };
  const metrics = [
    { label: 'Solar illumination', value: summary ? `${summary.sun_percentage}%` : '—', detail: summary ? `${summary.sun_hours} h illuminated` : 'Awaiting ephemeris', tone: 'sun' },
    { label: 'Earth visibility', value: summary ? `${summary.earth_percentage}%` : '—', detail: summary ? `${summary.earth_visible_hours} h line of sight` : 'Awaiting ephemeris', tone: 'earth' },
    { label: 'Longest darkness', value: summary ? `${summary.max_continuous_dark_hours} h` : '—', detail: 'Continuous interval without sunlight' },
    { label: 'Longest communication gap', value: summary ? `${summary.max_continuous_no_comm_hours} h` : '—', detail: 'Continuous interval without Earth visibility' },
  ];

  return (
    <div className="mission-shell">
      <a className="skip-link" href="#mission">Skip to mission controls</a>
      <header className="app-header">
        <a className="wordmark" href="#mission" aria-label="LunarSight mission console"><span className="lunar-mark" aria-hidden="true" />LunarSight</a>
        <span className="header-context">Lunar landing site navigator</span>
        <div className="header-actions"><span className={`connection-state ${errorMsg ? 'is-offline' : ''}`} role="status">{loading ? 'Calculating' : errorMsg ? 'Service unavailable' : dataSource ? 'Results available' : 'Not connected'}</span><button className="button secondary" onClick={handleExportJSON} disabled={!ephemerisData.length}>Export JSON</button></div>
      </header>
      <main id="mission">
        <div className="page-intro"><div><p className="eyebrow">Mission workspace / South pole</p><h1>Lunar site assessment</h1></div><nav className="workspace-nav" aria-label="Workspace sections"><a href="#terrain">Terrain</a><a href="#geometry">Geometry</a><a href="#comparison">Comparison</a></nav></div>
        <div className="workspace-grid">
        <aside className="scenario-sidebar" aria-label="Scenario setup">
        <div className="sidebar-heading"><h2>Mission setup</h2><span className="meta">UTC</span></div>
        <section className="mission-controls" aria-label="Mission controls">
          <label>Mission start date <span>UTC</span><input aria-label="Mission start date UTC" type="datetime-local" value={startDate} onChange={e => setStartDate(e.target.value)} /></label>
          <label>Mission end date <span>UTC</span><input aria-label="Mission end date UTC" type="datetime-local" value={endDate} onChange={e => setEndDate(e.target.value)} /></label>
          <label>Sampling interval<select value={stepHours} onChange={e => setStepHours(Number(e.target.value))}>{[1, 2, 4, 6, 12].map(h => <option key={h} value={h}>{h} {h === 1 ? 'hour' : 'hours'}</option>)}</select></label>
          <div className="control-action"><button className="button primary" disabled={loading} onClick={runSimulation}>{loading ? 'Calculating…' : 'Run analysis'}</button></div>
        </section>
        <div className="candidate-list"><h2>Compared sites <span>{selectedSites.length}</span></h2>{selectedSites.map((site, index) => <button key={`${site.lat}-${site.lon}`} className={`candidate-item ${index === activeSiteIdx ? 'is-selected' : ''}`} aria-pressed={index === activeSiteIdx} onClick={() => setActiveSiteIdx(index)}><span>{site.name}</span><small>{site.lat.toFixed(3)}° / {site.lon.toFixed(3)}°</small></button>)}</div>
        <p className="sidebar-note">Select a site to inspect its terrain and visibility. All mission dates use UTC.</p>
        </aside>
        <div className="observation-grid" id="terrain">
          <section className="map-section" aria-labelledby="map-title"><div className="section-heading"><div><span className="section-index">01</span><h2 id="map-title">Landing region</h2></div><span className="meta">NASA Moon Trek</span></div>
            <div className="site-selector"><label htmlFor="candidate">Candidate site</label><select id="candidate" value="" onChange={e => { const site = presets.find(p => p.id === e.target.value); if (site) handleAddSite(site); }}><option value="" disabled>{catalogError ? 'Catalog unavailable' : 'Add a landing site'}</option>{presets.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}</select></div>
            <MoonMap selectedSite={activeSite} presetSites={presets} onSelectSite={handleSelectMapSite} />
            <div className="coordinate-readout"><span>{activeSite.name}</span><strong>{activeSite.lat.toFixed(3)}° <span>lat</span> / {activeSite.lon.toFixed(3)}° <span>lon</span></strong></div>
          </section>
        </div>
        <aside className="site-inspector" aria-label="Selected site details"><p className="eyebrow">Selected landing site</p><h2>{activeSite.name}</h2><div className="inspector-coordinates"><span>Latitude<strong>{activeSite.lat.toFixed(3)}°</strong></span><span>Longitude<strong>{activeSite.lon.toFixed(3)}°</strong></span></div><section className="metrics" aria-label="Selected site metrics">{metrics.map(metric => <div className="metric" key={metric.label}><span>{metric.label}</span><strong className={metric.tone}>{metric.value}</strong><small>{metric.detail}</small></div>)}</section>{errorMsg && <div className="error-notice" role="alert"><strong>Analysis unavailable</strong><span>{errorMsg}</span><button className="button secondary" onClick={runSimulation}>Retry analysis</button></div>}</aside>
        </div>
        <section className="geometry-section" id="geometry" aria-labelledby="geometry-title"><div className="section-heading"><div><h2 id="geometry-title">Sun & Earth geometry</h2></div><span className="meta">Elevation / time · UTC</span></div><HorizonChart data={activeEphemeris?.data || []} siteName={activeSite.name || 'Selected site'} /></section>
        {activeEphemeris && <TimelineBar data={activeEphemeris.data} />}
        <div id="comparison"><ComparePanel sites={ephemerisData} activeSiteIndex={activeSiteIdx} onSelectActiveIndex={setActiveSiteIdx} onRemoveSite={handleRemoveSite} /></div>
        <section className="provenance"><span>Data provenance</span><p>{dataSource || 'No calculation source received. Scientific results remain empty until the service responds.'}</p><span>Map imagery: NASA Moon Trek / LROC / USGS</span></section>
      </main>
      <footer className="app-footer"><span>LunarSight · NASA Space Apps 2026</span><span>Site assessment, not flight certification</span></footer>
    </div>
  );
};
export default App;
