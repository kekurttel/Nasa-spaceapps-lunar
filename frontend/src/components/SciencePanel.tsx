import React, { useEffect, useId, useState } from 'react';
import { EphemerisPoint, SiteRequest } from '../types';
import './SciencePanel.css';
import { API_BASE } from '../services/config';
import { DsnWindowsResponse, fetchDsnWindows } from '../services/api';

export interface SciencePanelProps {
  site: SiteRequest;
  moment?: EphemerisPoint;
  language: 'en' | 'tr';
}

type Resource = {
  key: string;
  status: 'loading' | 'ready' | 'error';
  data?: unknown;
  error?: string;
};

function useScienceResource(path: string | null) {
  const [attempt, setAttempt] = useState(0);
  const [resource, setResource] = useState<Resource>({ key: '', status: 'loading' });
  useEffect(() => {
    if (!path) return;
    const controller = new AbortController();
    let active = true;
    let timedOut = false;
    const timeout = window.setTimeout(() => {
      timedOut = true;
      controller.abort();
    }, 30000);
    setResource({ key: path, status: 'loading' });
    async function load() {
      try {
        const response = await fetch(`${API_BASE}${path}`, {
          signal: controller.signal,
          headers: { Accept: 'application/json' },
        });
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const data: unknown = await response.json();
        if (active) setResource({ key: path!, status: 'ready', data });
      } catch (error) {
        if (active) setResource({
          key: path!, status: 'error',
          error: timedOut ? 'timeout' : error instanceof Error && /^HTTP \d+$/.test(error.message)
            ? error.message : 'request',
        });
      } finally {
        window.clearTimeout(timeout);
      }
    }
    void load();
    return () => {
      active = false;
      window.clearTimeout(timeout);
      controller.abort();
    };
  }, [path, attempt]);
  return {
    resource: resource.key === path ? resource : { key: path || '', status: 'loading' as const },
    retry: () => setAttempt((value) => value + 1),
  };
}

const label = (key: string) => key.replace(/_/g, ' ').replace(/([a-z])([A-Z])/g, '$1 $2');

/** Unknown response schemas remain inspectable without asserting units or scientific meaning. */
function ScienceValue({ value, tr, name }: { value: unknown; tr: boolean; name: string }): React.ReactElement {
  if (value === null || value === undefined) return <span className="science-panel__missing">{tr ? 'Veri yok' : 'Not provided'}</span>;
  if (typeof value === 'boolean') return <span>{value ? (tr ? 'Evet' : 'Yes') : (tr ? 'Hayır' : 'No')}</span>;
  if (typeof value !== 'object') return <span>{String(value)}</span>;
  const entries = Array.isArray(value)
    ? value.map((item, index) => [String(index + 1), item] as const)
    : Object.entries(value);
  if (!entries.length) return <span className="science-panel__missing">{tr ? 'Kayıt yok' : 'No records'}</span>;
  return <table className="science-panel__table">
    <caption className="science-panel__sr-only">{name}</caption>
    <thead className="science-panel__sr-only"><tr><th scope="col">{tr ? 'Alan' : 'Field'}</th><th scope="col">{tr ? 'Değer' : 'Value'}</th></tr></thead>
    <tbody>{entries.map(([key, item]) => <tr key={key}>
      <th scope="row">{label(key)}</th>
      <td>{item !== null && typeof item === 'object'
        ? <details open={!Array.isArray(item)}><summary>{label(key)} · {Array.isArray(item) ? item.length : Object.keys(item).length} {tr ? 'kayıt' : 'entries'}</summary>
          <ScienceValue value={item} tr={tr} name={`${name}: ${label(key)}`} />
        </details>
        : <ScienceValue value={item} tr={tr} name={label(key)} />}</td>
    </tr>)}</tbody>
  </table>;
}

function ResourceView({ resource, retry, tr, name }: {
  resource: Resource; retry: () => void; tr: boolean; name: string;
}) {
  return <div aria-busy={resource.status === 'loading'}>
    {resource.status === 'loading' && <p role="status">{tr ? 'Bilim verileri yükleniyor…' : 'Loading science data…'}</p>}
    {resource.status === 'error' && <div role="status" className="science-panel__error">
      <p>{resource.error === 'timeout'
        ? (tr ? 'İstek zaman aşımına uğradı.' : 'Request timed out.')
        : (tr ? 'Veriler alınamadı.' : 'Data could not be loaded.')}
        {resource.error?.startsWith('HTTP') && ` (${resource.error})`}</p>
      <button type="button" onClick={retry} aria-label={`${tr ? 'Yeniden dene' : 'Retry'}: ${name}`}>{tr ? 'Yeniden dene' : 'Retry'}</button>
    </div>}
    {resource.status === 'ready' && <ScienceValue value={resource.data} tr={tr} name={name} />}
  </div>;
}

function DsnWindows({ tr }: { tr: boolean }) {
  const [start, setStart] = useState('');
  const [end, setEnd] = useState('');
  const [step, setStep] = useState('3600');
  const [mask, setMask] = useState('10');
  const [state, setState] = useState<'idle' | 'loading' | 'error' | 'ready'>('idle');
  const [result, setResult] = useState<DsnWindowsResponse | null>(null);
  const [error, setError] = useState('');
  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setResult(null);
    const startMs = Date.parse(`${start}Z`), endMs = Date.parse(`${end}Z`);
    const seconds = Number(step), degrees = Number(mask);
    if (!start || !end || !step || !mask || !Number.isFinite(startMs) || !Number.isFinite(endMs) || endMs < startMs || endMs - startMs > 31 * 86400000 || !Number.isInteger(seconds) || seconds < 60 || seconds > 86400 || Math.floor((endMs - startMs) / (seconds * 1000)) + 1 > 2000 || !Number.isFinite(degrees) || degrees < -90 || degrees > 90) {
      setError(tr ? 'Geçerli bir aralık, adım ve maske girin.' : 'Enter a valid interval, step, and mask.');
      setState('error'); return;
    }
    setState('loading');
    try {
      const data = await fetchDsnWindows({ start_utc: new Date(startMs).toISOString(), end_utc: new Date(endMs).toISOString(), step_seconds: seconds, elevation_mask_deg: degrees });
      setResult(data); setState('ready');
    } catch {
      setError(tr ? 'Sorgu başarısız. Tarihler veri kapsamı dışında olabilir veya servis kullanılamıyor olabilir.' : 'Request failed. Dates may be outside artifact coverage or the service may be unavailable.');
      setState('error');
    }
  }
  return <section>
    <h4>{tr ? 'Örneklenmiş DSN pencereleri' : 'Sampled DSN windows'}</h4>
    <p>{tr ? 'Ay merkezi geometrisi örneklenir; bu, doğrulanmış iletişim, anten kullanılabilirliği veya Ay arazi ufku değildir. Pencereler kesin geçiş zamanları değil, ardışık örneklerdir.' : 'Moon-centre geometry is sampled, not verified communications, antenna availability, or lunar terrain horizon. Windows are consecutive samples, not exact crossing times.'}</p>
    <p>{tr ? 'UTC; en fazla 31 gün ve 2000 örnek. Adım 60–86400 saniye; maske −90–90°.' : 'UTC; maximum 31 days and 2000 samples. Step 60–86400 seconds; mask −90–90°.'}</p>
    <form onSubmit={submit}>
      <label>{tr ? 'Başlangıç (UTC)' : 'Start (UTC)'} <input type="datetime-local" required value={start} onChange={e => setStart(e.target.value)} /></label>{' '}
      <label>{tr ? 'Bitiş (UTC)' : 'End (UTC)'} <input type="datetime-local" required value={end} onChange={e => setEnd(e.target.value)} /></label>{' '}
      <label>{tr ? 'Adım (saniye)' : 'Step (seconds)'} <input type="number" min="60" max="86400" required value={step} onChange={e => setStep(e.target.value)} /></label>{' '}
      <label>{tr ? 'Yükseklik maskesi (°)' : 'Elevation mask (°)'} <input type="number" min="-90" max="90" step="any" required value={mask} onChange={e => setMask(e.target.value)} /></label>{' '}
      <button type="submit" disabled={state === 'loading'}>{tr ? 'Pencereleri hesapla' : 'Get windows'}</button>
    </form>
    {state === 'loading' && <p role="status">{tr ? 'Yükleniyor…' : 'Loading…'}</p>}
    {state === 'error' && <p role="alert">{error}</p>}
    {state === 'ready' && result && <div><p>{result.times_utc.length} {tr ? 'örnek' : 'samples'} · {result.step_seconds} s · {result.elevation_mask_deg}°</p>
      {result.stations.map((station, index) => <section key={`${station.name}-${index}`}><h5>{station.name}</h5>{station.sampled_windows.length ? <ul>{station.sampled_windows.map(window => <li key={window.start_index}><time dateTime={window.start_utc}>{window.start_utc}</time> – <time dateTime={window.end_utc}>{window.end_utc}</time> ({tr ? 'örnekler' : 'samples'} {window.start_index}–{window.end_index})</li>)}</ul> : <p>{tr ? 'Maske üzerinde örnek yok.' : 'No samples at or above mask.'}</p>}</section>)}
      <details><summary>{tr ? 'Kaynak ve kapsam' : 'Provenance and coverage'}</summary><ScienceValue value={result.provenance} tr={tr} name="Provenance" /></details>
    </div>}
  </section>;
}

export default function SciencePanel({ site, moment, language }: SciencePanelProps) {
  const id = useId();
  const tr = language === 'tr';
  // Interpret zone-less ephemeris datetimes as UTC, never as browser-local time.
  const rawTime = moment?.datetime;
  const parsedTime = rawTime ? Date.parse(/(?:Z|[+-]\d{2}:?\d{2})$/i.test(rawTime)
    ? rawTime : `${rawTime}Z`) : NaN;
  const utc = Number.isFinite(parsedTime) ? new Date(parsedTime).toISOString() : null;
  const validSite = Number.isFinite(site.lat) && Number.isFinite(site.lon)
    && Math.abs(site.lat) <= 90 && Math.abs(site.lon) <= 180;
  const dsn = useScienceResource(utc ? `/science/dsn?${new URLSearchParams({ datetime: utc })}` : null);
  const layers = useScienceResource(validSite
    ? `/science/layers?${new URLSearchParams({ lat: String(site.lat), lon: String(site.lon) })}` : null);
  const dsnTitle = tr ? 'DSN geometrisi' : 'DSN geometry';
  const layersTitle = tr ? 'Termal ve buz katmanları' : 'Thermal and ice layers';

  return <section className="instrument-panel science-panel" lang={language} aria-labelledby={`${id}-title`}>
    <header className="science-panel__header">
      <h3 id={`${id}-title`}>{tr ? 'Bilimsel bağlam' : 'Science context'}</h3>
      <p>{tr ? 'Kaynak alanları ve birimleri aşağıda verildiği haliyle gösterilir. Eksik veriler tahmin edilmez.'
        : 'Source fields and units appear as supplied below. Missing data are not inferred.'}</p>
    </header>
    <div className="science-panel__sections">
      <section aria-labelledby={`${id}-dsn`}>
        <h4 id={`${id}-dsn`}>{dsnTitle}</h4>
        <p className="science-panel__note">{tr
          ? 'Geometri, anten kullanılabilirliği, zamanlama veya bağlantı garantisi değildir.'
          : 'Geometry is not antenna availability, scheduling, or a guaranteed communications link.'}</p>
        <p className="science-panel__sample">{tr ? 'Seçili örnek (UTC): ' : 'Selected sample (UTC): '}
          {utc ? <time dateTime={utc}>{utc}</time> : (tr ? 'Seçilmedi' : 'Not selected')}</p>
        <p className="science-panel__note">{tr
          ? 'Bu sorgu tek bir UTC anı içindir; zaman aralığı kapsamı veya kesintisiz görünürlük anlamına gelmez. Kaynağın örnekleme ve kapsam alanlarını kontrol edin.'
          : 'This query samples one UTC instant, not interval coverage or continuous visibility. Check source sampling and coverage fields.'}</p>
        {utc ? <ResourceView {...dsn} tr={tr} name={dsnTitle} />
          : <p role="status">{tr ? 'Geçerli bir efemeris örneği seçin.' : 'Select a valid ephemeris sample.'}</p>}
      </section>
      <DsnWindows tr={tr} />
      <section aria-labelledby={`${id}-layers`}>
        <h4 id={`${id}-layers`}>{layersTitle}</h4>
        <p className="science-panel__note">{tr
          ? 'Termal ve buz göstergeleri yorumlanmış tahminlerdir; doğrulanmış buz yatakları veya çıkarılabilir kaynaklar değildir.'
          : 'Thermal and ice indicators are interpreted estimates, not confirmed deposits or recoverable resources.'}</p>
        <p className="science-panel__sample">{tr ? 'Sorgu konumu' : 'Query location'}: {validSite ? `${site.lat}°, ${site.lon}°` : (tr ? 'Geçersiz koordinatlar' : 'Invalid coordinates')}</p>
        {validSite ? <ResourceView {...layers} tr={tr} name={layersTitle} />
          : <p role="status">{tr ? 'Geçerli enlem ve boylam gerekli.' : 'Valid latitude and longitude required.'}</p>}
      </section>
    </div>
  </section>;
}
