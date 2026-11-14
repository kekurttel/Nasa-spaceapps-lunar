import React, { useState, useEffect, useCallback, useRef } from 'react';
import { MoonMap } from './components/MoonMap';
import { HorizonChart } from './components/HorizonChart';
import { ScenarioControls, ScenarioDuration } from './components/ScenarioControls';
import { ComparePanel } from './components/ComparePanel';
import LunarSurface3D from './components/LunarSurface3D';
import MeasuredTerrain from './components/MeasuredTerrain';
import { MeasuredHorizon } from './components/MeasuredHorizon';
import { DataStatus } from './components/DataStatus';
import { AppearanceSettings } from './components/AppearanceSettings';
import SciencePanel from './components/SciencePanel';
import MissionSearch from './components/MissionSearch';
import { DisplayOptions, DisplayPreset, DisplayLayer, DisplayAid } from './components/DisplayOptions';
import { useI18n, Language } from './i18n';
import { AnalysisSummary } from './components/AnalysisSummary';
import { VisibilityTimeline } from './components/VisibilityTimeline';
import { exportCsv } from './utils/exportCsv';
import { getPresetSites, fetchEphemerisMulti, fetchHorizon, HorizonProfile } from './services/api';
import { EphemerisPoint, PresetSite, SiteEphemeris, SiteRequest } from './types';

// Match the backend's catalog tolerance, including periodic longitude.
const matchesCatalogPoint = (a: SiteRequest, b: SiteRequest) =>
  Number.isFinite(a.lat) && Number.isFinite(a.lon) &&
  Math.abs(a.lat - b.lat) <= 1e-6 &&
  Math.abs(((a.lon - b.lon + 180) % 360 + 360) % 360 - 180) <= 1e-6;
const nativeStart = Date.parse('2026-11-01T00:00:00Z');
const nativeEnd = Date.parse('2028-12-31T23:00:00Z');

export const App: React.FC = () => {
  const [presets, setPresets] = useState<PresetSite[]>([]);
  const [selectedSites, setSelectedSites] = useState<SiteRequest[]>([
    { name: 'Shackleton – de Gerlache connecting ridge', lat: -89.4395, lon: -137.1934 },
    { name: 'Malapert Massif', lat: -86, lon: 0 },
  ]);
  const [activeSiteIdx, setActiveSiteIdx] = useState(0);
  const [stepHours, setStepHours] = useState(2);
  const [ephemerisData, setEphemerisData] = useState<SiteEphemeris[]>([]);
  const [dataSource, setDataSource] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [catalogError, setCatalogError] = useState(false);
  const [catalogLoading, setCatalogLoading] = useState(true);
  const { language, setLanguage, t } = useI18n();
  const text = (en: string, tr: string) => language === 'tr' ? tr : en;
  const [periods, setPeriods] = useState<[{ startDate: string; durationDays: ScenarioDuration }, { startDate: string; durationDays: ScenarioDuration }]>([{ startDate: '2027-01-01', durationDays: 30 }, { startDate: '2027-01-01', durationDays: 30 }]);
  const startDate = `${periods[0].startDate}T00:00`;
  const [pinnedMoment, setPinnedMoment] = useState<EphemerisPoint>();
  const [view3d, setView3d] = useState(true);
  const [measuredView, setMeasuredView] = useState(true);
  const [horizon, setHorizon] = useState<HorizonProfile>();
  const [displayPreset, setDisplayPreset] = useState<DisplayPreset>('survey');
  const [displayLayers, setDisplayLayers] = useState<Record<DisplayLayer, boolean>>({ lrocBrightness: false, lolaSkyline: false, yaleStars: false });
  const [displayAids, setDisplayAids] = useState<Record<DisplayAid, boolean>>({ liftShadows: true, fineGroundTexture: false, azimuthElevationGrid: true, rangeRings: false });
  const requestId = useRef(0);
  useEffect(() => { document.documentElement.lang = language; }, [language]);

  useEffect(() => {
    let mounted = true;
    getPresetSites().then(data => {
      if (mounted) {
        const valid = Array.isArray(data) ? data.filter(site => Number.isFinite(site.lat) && Number.isFinite(site.lon)) : [];
        setPresets(valid);
        setCatalogError(valid.length === 0);
      }
    }).catch(() => { if (mounted) setCatalogError(true); })
      .finally(() => { if (mounted) setCatalogLoading(false); });
    return () => { mounted = false; };
  }, []);

  const unsupportedScenarios = selectedSites.slice(0, 2)
    .map((site, index) => presets.some(preset => matchesCatalogPoint(site, preset)) ? '' : index === 0 ? 'A' : 'B')
    .filter(Boolean);
  const catalogReady = !catalogLoading && !catalogError && presets.length > 0;
  const locationsSupported = selectedSites.length >= 2 && unsupportedScenarios.length === 0;
  const outsideNativeRange = periods.some(period => {
    const start = Date.parse(`${period.startDate}T00:00:00Z`);
    return Number.isFinite(start) && (start < nativeStart || start + period.durationDays * 86400000 > nativeEnd);
  });
  const analysisBlocked = !catalogReady || !locationsSupported || outsideNativeRange;
  const catalogMessage = catalogLoading
    ? text('Catalog loading; scientific analysis is disabled.', 'Katalog yükleniyor; bilimsel analiz devre dışı.')
    : text('Catalog unavailable; scientific analysis is disabled. No fallback data.', 'Katalog kullanılamıyor; bilimsel analiz devre dışı. Yedek veri kullanılmaz.');
  const locationMessage = text(
    `Scenario ${unsupportedScenarios.join(', ')}: custom location is for visual inspection only. Scientific analysis is unsupported. Select exact catalog coordinates for both scenarios.`,
    `Senaryo ${unsupportedScenarios.join(', ')}: özel konum yalnızca görsel inceleme içindir. Bilimsel analiz desteklenmiyor. Her iki senaryo için tam katalog koordinatlarını seçin.`);
  const rangeMessage = text(
    'Entire mission window must fit native coverage: 2026-11-01T00:00Z through 2028-12-31T23:00Z. Individual catalog coverage may be narrower; backend validation is final.',
    'Görevin tamamı kaynak veri aralığında olmalı: 2026-11-01T00:00Z ile 2028-12-31T23:00Z. Katalog noktalarının kapsamı daha dar olabilir; son doğrulama sunucudadır.');

  const runSimulation = useCallback(async () => {
    const id = ++requestId.current;
    setEphemerisData([]);
    setDataSource('');
    setErrorMsg(null);
    // Defense in depth: disabled controls alone must never authorize a request.
    if (analysisBlocked) {
      setLoading(false);
      setErrorMsg(!catalogReady ? catalogMessage : !locationsSupported ? locationMessage : rangeMessage);
      return;
    }
    if (periods.some(period => !period.startDate || !Number.isFinite(Date.parse(`${period.startDate}T00:00:00Z`)))) {
      setLoading(false);
      setErrorMsg('Choose an end date after the start date');
      return;
    }
    setLoading(true);
    try {
      const responses = await Promise.all(selectedSites.slice(0, 2).map((site, index) => {
        const period = periods[index];
        const end = new Date(Date.parse(`${period.startDate}T00:00:00Z`) + period.durationDays * 86400000).toISOString();
        return fetchEphemerisMulti([site], `${period.startDate}T00:00:00Z`, end, stepHours);
      }));
      if (id !== requestId.current) return;
      const sites = responses.map(response => response.sites[0]);
      if (sites.some(site => !site || !site.summary || !Array.isArray(site.data))) throw new Error('Incomplete response');
      setEphemerisData(sites);
      setDataSource(Array.from(new Set(responses.map(response => response.source))).join(' / '));
    } catch (error: unknown) {
      const detail = (error as { response?: { data?: { detail?: unknown } } })?.response?.data?.detail;
      if (id === requestId.current) setErrorMsg(typeof detail === 'string' ? detail : 'service');
    } finally {
      if (id === requestId.current) setLoading(false);
    }
  }, [selectedSites, stepHours, periods, analysisBlocked, catalogReady, locationsSupported, catalogMessage, locationMessage, rangeMessage]);

  useEffect(() => {
    setEphemerisData([]); setDataSource(''); setLoading(false); setErrorMsg(null); setPinnedMoment(undefined);
    return () => { requestId.current += 1; };
  }, [runSimulation]);

  const handleSelectMapSite = (site: SiteRequest) => {
    const index = selectedSites.findIndex(s => matchesCatalogPoint(s, site));
    if (index >= 0) setActiveSiteIdx(index);
    else setSelectedSites(sites => sites.map((s, i) => i === activeSiteIdx ? site : s));
  };
  const handleAddSite = (preset: PresetSite) => {
    if (selectedSites.some(s => matchesCatalogPoint(s, preset))) return;
    setSelectedSites(current => current.map((site, index) => index === activeSiteIdx ? { name: preset.name, lat: preset.lat, lon: preset.lon } : site));
  };
  const handleRemoveSite = () => {};
  const activeSite = selectedSites[activeSiteIdx] || selectedSites[0];
  const activeEphemeris = ephemerisData[activeSiteIdx];
  const summary = activeEphemeris?.summary;
  const horizonId = activeEphemeris?.provenance?.site_id || presets.find(site => matchesCatalogPoint(site, activeSite))?.id;
  useEffect(() => {
    let cancelled = false;
    setHorizon(undefined);
    if (horizonId && typeof fetchHorizon === 'function') fetchHorizon(horizonId).then(profile => { if (!cancelled) setHorizon(profile); }).catch(() => {});
    return () => { cancelled = true; };
  }, [horizonId]);
  const downloadCsv = () => {
    const csv = ephemerisData.map((site, index) => exportCsv([site], dataSource, `${periods[index].startDate}T00:00Z`, new Date(Date.parse(`${periods[index].startDate}T00:00:00Z`) + periods[index].durationDays * 86400000).toISOString())).join('\r\n');
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
    const link = document.createElement('a'); link.href = url; link.download = `lunarsight-${startDate.slice(0, 10)}.csv`; link.click(); URL.revokeObjectURL(url);
  };
  const handleExportJSON = () => {
    const url = URL.createObjectURL(new Blob([JSON.stringify({ source: dataSource, periods, stepHours, sites: ephemerisData }, null, 2)], { type: 'application/json' }));
    const link = document.createElement('a');
    link.href = url;
    link.download = `lunarsight-${startDate.slice(0, 10)}.json`;
    link.click();
    URL.revokeObjectURL(url);
  };
  const metrics = [
    { label: t('solarIllumination'), value: summary ? `${summary.sun_percentage}%` : '—', detail: summary ? `${summary.sun_hours} ${t('illuminatedHours')}` : t('awaitingEphemeris'), tone: 'sun' },
    { label: t('earthVisibility'), value: summary ? `${summary.earth_percentage}%` : '—', detail: summary ? `${summary.earth_visible_hours} ${t('lineOfSightHours')}` : t('awaitingEphemeris'), tone: 'earth' },
    { label: t('longestDarkness'), value: summary ? `${summary.max_continuous_dark_hours} h` : '—', detail: t('continuousWithoutSunlight') },
    { label: t('longestCommunicationGap'), value: summary ? `${summary.max_continuous_no_comm_hours} h` : '—', detail: t('continuousWithoutEarth') },
  ];

  return (
    <div className="mission-shell">
      <a className="skip-link" href="#mission">{t('skipToControls')}</a>
      <header className="app-header">
        <a className="wordmark" href="#mission" aria-label="LunarSight mission console"><span className="lunar-mark" aria-hidden="true" />LunarSight</a>
        <span className="header-context">{t('appContext')}</span>
        <div className="header-actions"><span className={`connection-state ${errorMsg ? 'is-offline' : ''}`} role="status">{loading ? t('calculating') : errorMsg ? t('unavailable') : dataSource ? t('resultsAvailable') : t('notConnected')}</span><AppearanceSettings language={language} /><label className="language-picker">{t('language')}<select value={language} onChange={event => setLanguage(event.target.value as Language)} aria-label={t('language')}><option value="en">English</option><option value="tr">Türkçe</option></select></label><button className="button secondary" onClick={handleExportJSON} disabled={!ephemerisData.length}>{t('exportJson')}</button><button className="button secondary" onClick={downloadCsv} disabled={!ephemerisData.length}>CSV</button></div>
      </header>
      <main id="mission">
        <div className="page-intro"><div><p className="eyebrow">{t('workspaceSouthPole')}</p><h1>{t('assessment')}</h1></div><nav className="workspace-nav" aria-label="Workspace sections"><a href="#terrain">{text('Surface', 'Yüzey')}</a><a href="#geometry">{t('geometry')}</a><a href="#comparison">{t('comparison')}</a><a href="#method">{text('Data & method', 'Veri ve yöntem')}</a></nav></div>
        {!catalogReady && <p className="error-notice" role="status">{catalogMessage}</p>}
        {catalogReady && !locationsSupported && <p className="error-notice" role="alert">{locationMessage}</p>}
        {outsideNativeRange && <p className="error-notice" role="alert">{rangeMessage}</p>}
        <p className="sidebar-note">{text('Engine: local precomputed LunaNav data; not an IAU_MOON runtime calculation.', 'Motor: yerel, önceden hesaplanmış LunaNav verisi; çalışma anında IAU_MOON hesabı yapılmaz.')}</p>
        <div className="workspace-grid">
        <div className="observation-grid" id="terrain">
          <section className="map-section" aria-labelledby="map-title"><div className="section-heading"><div><h2 id="map-title">{text('Surface explorer', 'Yüzey keşfi')}</h2></div><span className="meta">{view3d ? measuredView ? text('Measured LOLA terrain', 'Ölçülmüş LOLA arazisi') : text('Illustrative 3D globe', 'Temsili 3D küre') : text('NASA 2D map', 'NASA 2D haritası')}</span></div>
            <div className="site-selector"><label htmlFor="candidate">{t('candidateSite')}</label><select id="candidate" value="" onChange={e => { const site = presets.find(p => p.id === e.target.value); if (site) handleAddSite(site); }}><option value="" disabled>{catalogError ? t('catalogUnavailable') : text('Choose region', 'Bölge seçin')}</option>{presets.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}</select></div>
            <div className="surface-toolbar"><div className="surface-switch" role="group" aria-label={text('Surface view', 'Yüzey görünümü')}><button type="button" aria-pressed={!view3d} onClick={() => setView3d(false)}>2D</button><button type="button" aria-pressed={view3d} onClick={() => setView3d(true)}>3D</button><button type="button" aria-pressed={view3d && measuredView} onClick={() => { setMeasuredView(true); setView3d(true); }}>{text('Measured terrain', 'Ölçülmüş arazi')}</button><button type="button" aria-pressed={view3d && !measuredView} onClick={() => { setMeasuredView(false); setView3d(true); }}>{text('Globe', 'Küre')}</button></div><details className="display-disclosure"><summary>{text('Display options', 'Görünüm seçenekleri')}</summary><DisplayOptions language={language} availableAids={{ liftShadows: view3d, fineGroundTexture: view3d, azimuthElevationGrid: view3d, rangeRings: view3d }} preset={displayPreset} onPresetChange={setDisplayPreset} layers={displayLayers} onLayerChange={(key, value) => setDisplayLayers(current => ({ ...current, [key]: value }))} aids={displayAids} onAidChange={(key, value) => setDisplayAids(current => ({ ...current, [key]: value }))} /></details></div>
            {view3d && measuredView ? <MeasuredTerrain site={activeSite} moment={pinnedMoment || activeEphemeris?.data[0]} language={language} /> : view3d ? <LunarSurface3D language={language} gridVisible={displayAids.azimuthElevationGrid} liftShadows={displayAids.liftShadows} fineTexture={displayAids.fineGroundTexture} rangeRings={displayAids.rangeRings} preset={displayPreset} moment={pinnedMoment} selectedSite={{ ...activeSite, name: activeSite.name || `Site ${activeSiteIdx + 1}`, id: String(activeSiteIdx), selected: true }} markers={presets.map(site => ({ ...site, id: site.id }))} onSelectSite={site => handleSelectMapSite(site)} /> : <MoonMap selectedSite={activeSite} presetSites={presets} onSelectSite={handleSelectMapSite} />}
            <div className="coordinate-readout"><span>{activeSite.name}</span><strong>{activeSite.lat.toFixed(3)}° <span>lat</span> / {activeSite.lon.toFixed(3)}° <span>lon</span></strong></div>
          </section>
          {activeEphemeris && <VisibilityTimeline key={activeSiteIdx} data={activeEphemeris.data} onPinMoment={point => { setPinnedMoment(point); setView3d(true); }} labels={{ title: t('missionTimeline'), sun: t('sunElevation'), earth: t('earthElevation'), both: text('Both visible', 'İkisi birlikte görünür'), empty: t('noEphemeris'), selected: t('selected'), visible: text('Visible', 'Görünür'), notVisible: text('Not visible', 'Görünmez'), time: t('time'), elevation: t('elevation'), azimuth: text('Azimuth', 'Azimut'), solarFlux: t('solarFluxEfficiency'), pinHint: text('Click to pin moment in 3D.', 'Anı 3D görünümde sabitlemek için tıklayın.') }} />}
        </div>
        <aside className="scenario-sidebar" aria-label={t('missionSetup')}>
        <details className="setup-disclosure" open>
        <summary className="sidebar-heading"><span>{t('missionSetup')}</span><span className="meta">UTC</span></summary>
        <section className="mission-controls" aria-label="Mission controls">
          <label>{t('samplingInterval')}<select value={stepHours} onChange={e => setStepHours(Number(e.target.value))}>{[0.25, 1, 2, 4, 6, 12].map(h => <option key={h} value={h}>{h === 0.25 ? text('15 min · interpolated', '15 dk · interpolasyon') : `${h} ${t('hours')}`}</option>)}</select></label>
          <div className="control-action"><button className="button primary" disabled={loading || analysisBlocked} onClick={runSimulation}>{loading ? t('calculating') : t('runAnalysis')}</button></div>
        </section>
        <div className="candidate-list"><h2>{t('comparedSites')} <span>{selectedSites.length}</span></h2>{selectedSites.map((site, index) => <button key={`${site.lat}-${site.lon}`} className={`candidate-item ${index === activeSiteIdx ? 'is-selected' : ''}`} aria-pressed={index === activeSiteIdx} onClick={() => { setActiveSiteIdx(index); setPinnedMoment(undefined); }}><span>{index === 0 ? 'A' : 'B'} · {site.name}</span><small>{site.lat.toFixed(3)}° / {site.lon.toFixed(3)}°</small></button>)}</div>
        <p className="sidebar-note">{t('selectSiteNote')}</p>
        <div className="coordinate-inputs"><label>{t('latitude')}<input aria-label={t('latitude')} type="number" min="-90" max="90" step="0.001" value={activeSite.lat} onChange={event => { if (event.target.value !== '') handleSelectMapSite({ ...activeSite, lat: Math.max(-90, Math.min(90, Number(event.target.value))) }); }} /></label><label>{t('longitude')}<input aria-label={t('longitude')} type="number" min="-180" max="180" step="0.001" value={activeSite.lon} onChange={event => { if (event.target.value !== '') handleSelectMapSite({ ...activeSite, lon: Math.max(-180, Math.min(180, Number(event.target.value))) }); }} /></label></div>
        </details>
        </aside>
        <aside className="site-inspector" aria-label={t('selectedLandingSite')}><p className="eyebrow">{t('selectedLandingSite')}</p><h2>{activeSite.name}</h2><div className="inspector-coordinates"><span>{t('latitude')}<strong>{activeSite.lat.toFixed(3)}°</strong></span><span>{t('longitude')}<strong>{activeSite.lon.toFixed(3)}°</strong></span></div><section className="metrics" aria-label={t('assessment')}>{metrics.map(metric => <div className="metric" key={metric.label}><span>{metric.label}</span><strong className={metric.tone}>{metric.value}</strong><small>{metric.detail}</small></div>)}</section>{errorMsg && <div className="error-notice" role="alert"><strong>{t('analysisUnavailable')}</strong><span>{errorMsg === 'service' ? t('serviceError') : errorMsg}</span><button className="button secondary" disabled={loading || analysisBlocked} onClick={runSimulation}>{t('retryAnalysis')}</button></div>}</aside>
        </div>
        {activeEphemeris && <AnalysisSummary sites={ephemerisData.map(item => ({ name: item.site.name, data: item.data, summary: item.summary }))} />}
        <section className="scenario-section" id="comparison"><h2>{text('Mission analysis', 'Görev analizi')}</h2><p>{text('Compare sunlight and geometric Earth visibility for two regions and independent periods.', 'İki bölgenin Güneş ve geometrik Dünya görünürlüğünü bağımsız dönemlerde karşılaştırın.')}</p><ScenarioControls scenarios={[{ site: selectedSites[0], ...periods[0] }, { site: selectedSites[1] || selectedSites[0], ...periods[1] }]} onStartDateChange={(i, value) => setPeriods(current => current.map((period, index) => index === i ? { ...period, startDate: value } : period) as typeof current)} onDurationChange={(i, value) => setPeriods(current => current.map((period, index) => index === i ? { ...period, durationDays: value } : period) as typeof current)} labels={{ title: t('missionSetup'), scenarioA: text('Scenario A', 'Senaryo A'), scenarioB: text('Scenario B', 'Senaryo B'), startDate: `${t('missionStart')} · UTC`, duration: text('Duration', 'Süre'), days: text('days', 'gün'), presets: { 7: '7', 30: '30', 90: '90', 365: '365' }, scenarioNames: [selectedSites[0].name || 'A', selectedSites[1]?.name || 'B'] }} /><div className="analysis-actions"><p>{text('Native data is hourly, November 2026–December 2028. 15-minute output interpolates hourly samples. Choose catalog points for terrain-aware analysis.', 'Kaynak saatliktir; Kasım 2026–Aralık 2028 kapsamlıdır. 15 dakikalık çıktı saatlik örneklerden interpolasyondur. Arazi ufuklu analiz için katalog noktalarını seçin.')}</p><button className="button primary" disabled={loading || analysisBlocked} onClick={runSimulation}>{loading ? t('calculating') : t('runAnalysis')}</button></div>{!ephemerisData.length && <div className="analysis-ready"><h3>{text('Your comparison starts here', 'Karşılaştırmanız burada başlıyor')}</h3><p>{text('Choose two regions, set each period, then run analysis. No example results are substituted.', 'İki bölgeyi seçin, dönemleri ayarlayın, analizi çalıştırın. Sonuç yerine örnek veri kullanılmaz.')}</p></div>}</section>
        {activeEphemeris && <section className="geometry-section" id="geometry" aria-labelledby="geometry-title"><div className="section-heading"><div><h2 id="geometry-title">{t('sunEarthGeometry')}</h2></div><span className="meta">{t('elevationTimeUtc')}</span></div><HorizonChart data={activeEphemeris.data} siteName={activeSite.name || t('site')} /></section>}
        {horizon && <MeasuredHorizon profile={horizon.azimuths_deg.map((azimuth, index) => ({ azimuth, elevation: horizon.elevations_deg[index] }))} data={activeEphemeris?.data || []} language={language} onPin={point => { setPinnedMoment(point); setMeasuredView(true); setView3d(true); }} />}
        <MissionSearch language={language} />
        <SciencePanel site={activeSite} moment={pinnedMoment || activeEphemeris?.data[0]} language={language} />
        <ComparePanel sites={ephemerisData} activeSiteIndex={activeSiteIdx} onSelectActiveIndex={setActiveSiteIdx} onRemoveSite={handleRemoveSite} />
        <section id="method" className="method-section"><h2>{text('Data & method', 'Veri ve yöntem')}</h2><details><summary>{text('Interpretation limits', 'Yorumlama sınırları')}</summary><p>{text('Local terrain uses measured 200 m LOLA elevations. The globe remains illustrative. Skyline profiles use a 2 m observer and 150 km ray distance; Apollo 11 assumes a flat horizon. Earth visibility is geometric, not guaranteed communications. No landing safety certification.', 'Yerel arazi ölçülmüş 200 m LOLA yüksekliklerini kullanır. Küre temsilidir. Ufuk profilleri 2 m gözlem yüksekliği ve 150 km tarama mesafesine dayanır; Apollo 11 düz ufuk varsayar. Dünya görünürlüğü geometriktir; iletişim garantisi değildir. İniş güvenliği sertifikasyonu sağlamaz.')}</p></details><DataStatus /></section>
        <section className="provenance"><span>{t('dataProvenance')}</span><p>{dataSource || t('noSource')}</p><span>{t('mapImagery')}</span></section>
      </main>
      <footer className="app-footer"><span>LunarSight · NASA Space Apps 2026</span><span>{t('certification')}</span></footer>
    </div>
  );
};
export default App;
