import React, { useEffect, useId, useRef, useState } from 'react';
import './MissionSearch.css';
import { API_BASE } from '../services/config';

interface MissionSearchProps { language: 'en' | 'tr'; }

const defaults = {
  start_date: '2026-11-01', duration_days: '14', max_dark_hours: '48',
  min_sun_pct: '70', min_earth_pct: '50', max_slope_deg: '15', limit: '20',
  n_starts: '1', stride_hours: '24', array_peak_w: '400', load_w: '150',
  battery_wh: '2000', initial_soc: '1', charge_eff: '0.95', discharge_eff: '0.95', min_soc: '0.2',
};
type Values = typeof defaults;
type NumericKey = Exclude<keyof Values, 'start_date'>;
interface SearchRow {
  index: number; lat: number; lon: number; elevation_m: number; slope_deg: number;
  score: number; go: boolean; reasons: string[]; go_count: number; best_start_index: number;
  start_utc: string; sun_pct: number; earth_pct: number; longest_dark_hours: number;
  longest_comm_gap_hours: number; min_soc: number; battery_survived: boolean;
}
interface SearchResponse {
  results: SearchRow[]; atlas_points: number; evaluated_points: number; evaluated_windows: number;
  feasible_points: number; feasible_windows: number; work_units: number; duration_hours: number;
  engine: string; step_hours: number; ranking: string; limits: string[]; license: string;
  score_weights: { sun: number; earth: number; battery_margin: number };
}
const copy = {
  en: {
    title: 'Mission site search', intro: 'Rank south-pole atlas sites against mission, terrain and battery constraints.',
    constraints: 'Mission constraints', start_date: 'First start date (UTC)', duration_days: 'Duration (days, whole days)',
    max_dark_hours: 'Maximum darkness (h)', min_sun_pct: 'Minimum sunlight (%)', min_earth_pct: 'Minimum Earth visibility (%)',
    max_slope_deg: 'Maximum slope (°)', limit: 'Result limit', n_starts: 'Candidate start dates', stride_hours: 'Start spacing (h)',
    array_peak_w: 'Solar array peak (W)', load_w: 'Constant load (W)', battery_wh: 'Battery capacity (Wh)',
    initial_soc: 'Initial charge (0–1)', charge_eff: 'Charge efficiency (0–1)', discharge_eff: 'Discharge efficiency (0–1)', min_soc: 'Minimum charge (0–<1)',
    advanced: 'Start windows and power model', battery: 'Battery constraints always apply; defaults use a simplified power model.',
    needDsn: 'Require geometric DSN visibility', include: 'Include threshold-failing candidates',
    search: 'Search atlas', loading: 'Searching atlas…', cancel: 'Cancel search', cancelled: 'Search cancelled. Adjust constraints or search again.',
    hint: 'Hourly UTC samples. Duration ≤30 days; start-date count ≤31; total span ≤1,440 hours. CPU limits may require fewer dates or a tighter slope filter.',
    error: 'Search failed. Check inputs and backend availability, then retry.', badResponse: 'Invalid search response.',
    noFeasible: 'No sites pass the selected model thresholds. Adjust thresholds or dates; this is not a safety decision.',
    empty: 'No candidates returned.', ready: 'Set constraints, then search. No search has run yet.', edited: 'Inputs changed. Run a new search for current constraints.',
    summary: 'Search summary', evaluated: 'sites evaluated', windows: 'windows evaluated', feasible: 'sites passing model thresholds', feasibleWindows: 'windows passing model thresholds',
    duration: 'Duration', hours: 'h', table: 'Ranked atlas candidates', rank: 'Rank / atlas ID', coordinates: 'Latitude / longitude',
    score: 'Heuristic / 100', status: 'Model thresholds', yes: 'Pass', no: 'Fail', start: 'Best start (UTC)', sun: 'Sunlight', earth: 'Earth visibility',
    dark: 'Longest darkness', gap: 'Longest contact gap', slope: 'Slope / elevation', soc: 'Minimum charge', survived: 'Battery survived', failed: 'Battery depleted below reserve',
    count: 'Threshold-passing starts', provenance: 'Model, provenance and limitations',
    warning: 'Exploratory heuristic only: not scientific feasibility, landing safety or GO/NO-GO. Pass means only selected user thresholds in this simplified model, including the slope filter.',
    integration: 'Current ephemeris/terrain UI uses local LunaNav artifacts, not teammate CLI engines or /api/contracts/local-analysis. NASA/USGS are upstream-declared data sources; MIT covers code, not scientific validation. SHA-256 checks byte integrity only.',
    catalog: 'Atlas coordinates are informational. These sites are not sent to the separate exact-catalog analysis API; arbitrary coordinates are unsupported there.',
    ranking: 'Heuristic score = 100 × (0.4 × sun fraction + 0.3 × Earth visibility fraction + 0.3 × battery margin), rounded to 1 decimal after a ×0.25 multiplier for threshold failures. Battery margin = clamp((minimum charge − reserve)/(1 − reserve), 0, 1). Rank: score descending, atlas ID ascending; earliest start wins score ties. Weights are fixed reference choices, not validated science.',
    limitations: 'Hourly sample counts, not continuous event times. Sunlight means ≥50% visible solar disk, not mean irradiance. Earth-center visibility is geometric: no relay or RF link budget. DSN visibility is not scheduling. Battery model omits temperature, panel orientation, degradation and thermal survival. Local precomputed artifacts; upstream provenance not independently revalidated. Not flight certification.',
    raw: 'Server model notes (original)', reasons: { sun: 'sunlight', earth: 'Earth visibility', shadow: 'darkness', battery: 'battery' },
  },
  tr: {
    title: 'Görev alanı arama', intro: 'Güney kutbu atlas noktalarını görev, arazi ve batarya kısıtlarına göre sıralayın.',
    constraints: 'Görev kısıtları', start_date: 'İlk başlangıç tarihi (UTC)', duration_days: 'Süre (gün, tam gün)',
    max_dark_hours: 'En uzun karanlık (sa)', min_sun_pct: 'En az güneş ışığı (%)', min_earth_pct: 'En az Dünya görünürlüğü (%)',
    max_slope_deg: 'En yüksek eğim (°)', limit: 'Sonuç sınırı', n_starts: 'Başlangıç tarihi sayısı', stride_hours: 'Başlangıç aralığı (sa)',
    array_peak_w: 'Güneş paneli tepe gücü (W)', load_w: 'Sabit tüketim (W)', battery_wh: 'Batarya kapasitesi (Wh)',
    initial_soc: 'İlk şarj oranı (0–1)', charge_eff: 'Şarj verimi (0–1)', discharge_eff: 'Deşarj verimi (0–1)', min_soc: 'En az şarj oranı (0–<1)',
    advanced: 'Başlangıç pencereleri ve güç modeli', battery: 'Batarya kısıtları her zaman uygulanır; varsayılanlar basitleştirilmiş güç modeli kullanır.',
    needDsn: 'Geometrik DSN görünürlüğü gerektir', include: 'Model eşiklerini geçemeyen adayları da göster',
    search: 'Atlası ara', loading: 'Atlas aranıyor…', cancel: 'Aramayı iptal et', cancelled: 'Arama iptal edildi. Kısıtları değiştirin veya yeniden arayın.',
    hint: 'Saatlik UTC örnekleri. Süre ≤30 gün; başlangıç sayısı ≤31; toplam aralık ≤1.440 saat. CPU sınırı için tarih sayısını veya eğim sınırını azaltmanız gerekebilir.',
    error: 'Arama başarısız. Girdileri ve sunucu bağlantısını kontrol edip yeniden deneyin.', badResponse: 'Geçersiz arama yanıtı.',
    noFeasible: 'Seçilen model eşiklerini geçen alan yok. Eşikleri veya tarihleri değiştirin; bu bir güvenlik kararı değildir.', empty: 'Aday döndürülmedi.',
    ready: 'Kısıtları belirleyip arayın. Henüz arama yapılmadı.', edited: 'Girdiler değişti. Güncel kısıtlar için yeniden arayın.',
    summary: 'Arama özeti', evaluated: 'alan değerlendirildi', windows: 'pencere değerlendirildi', feasible: 'model eşiklerini geçen alan', feasibleWindows: 'model eşiklerini geçen pencere',
    duration: 'Süre', hours: 'sa', table: 'Sıralı atlas adayları', rank: 'Sıra / atlas kimliği', coordinates: 'Enlem / boylam',
    score: 'Sezgisel puan / 100', status: 'Model eşikleri', yes: 'Geçti', no: 'Geçemedi', start: 'En iyi başlangıç (UTC)', sun: 'Güneş ışığı', earth: 'Dünya görünürlüğü',
    dark: 'En uzun karanlık', gap: 'En uzun iletişim kesintisi', slope: 'Eğim / yükseklik', soc: 'En düşük şarj', survived: 'Batarya yeterli', failed: 'Batarya rezervin altına düştü',
    count: 'Eşikleri geçen başlangıç', provenance: 'Model, kaynak ve sınırlamalar',
    warning: 'Yalnızca keşif amaçlı sezgisel sıralama: bilimsel fizibilite, iniş güvenliği veya GO/NO-GO kararı değildir. Geçti, eğim filtresi dahil bu basit modelde yalnızca kullanıcının seçtiği eşiklerin sağlandığını belirtir.',
    integration: 'Mevcut efemeris/arazi arayüzü yerel LunaNav verilerini kullanır; ekip CLI motorlarını veya /api/contracts/local-analysis uç noktasını çağırmaz. NASA/USGS, üst kaynağın beyan ettiği veri kaynaklarıdır; MIT kod lisansıdır, bilimsel doğrulama değildir. SHA-256 yalnızca bayt bütünlüğünü denetler.',
    catalog: 'Atlas koordinatları bilgi amaçlıdır. Bu alanlar ayrı kesin katalog analiz API’sine gönderilmez; bu API serbest koordinatları desteklemez.',
    ranking: 'Sezgisel puan = 100 × (0,4 × güneş oranı + 0,3 × Dünya görünürlük oranı + 0,3 × batarya marjı). Eşikleri geçemeyenler ×0,25 ile çarpılır; sonuç 1 ondalığa yuvarlanır. Batarya marjı = clamp((en düşük şarj − rezerv)/(1 − rezerv), 0, 1). Puan azalan, atlas kimliği artan sıralanır; eşit başlangıç puanında en erken tarih seçilir. Sabit referans ağırlıkları bilimsel olarak doğrulanmış değildir.',
    limitations: 'Saatlik örnek sayılarıdır; kesintisiz olay süreleri değildir. Güneş ışığı, ortalama ışınım değil, güneş diskinin en az %50 görünmesidir. Dünya merkezi görünürlüğü geometriktir; röle veya RF bağlantı bütçesi yoktur. DSN görünürlüğü anten tahsisi değildir. Batarya modeli sıcaklık, panel yönelimi, yaşlanma ve termal dayanımı içermez. Yerel önceden hesaplanmış veriler; üst kaynak iddiaları bağımsız doğrulanmadı. Uçuş sertifikasyonu değildir.',
    raw: 'Sunucu model notları (özgün dil)', reasons: { sun: 'güneş ışığı', earth: 'Dünya görünürlüğü', shadow: 'karanlık', battery: 'batarya' },
  },
};

// Bounds mirror MissionSearchRequest. Whole-day UI values guarantee whole-hour durations.
const bounds: Record<NumericKey, [number, number, number]> = {
  duration_days: [1, 30, 1], max_dark_hours: [0, 720, 1], min_sun_pct: [0, 100, 0.1],
  min_earth_pct: [0, 100, 0.1], max_slope_deg: [0, 90, 0.25], limit: [1, 100, 1],
  n_starts: [1, 31, 1], stride_hours: [1, 168, 1], array_peak_w: [0, 1000000, 1],
  load_w: [0, 1000000, 1], battery_wh: [1, 1000000000, 1], initial_soc: [0, 1, 0.01],
  charge_eff: [0.01, 1, 0.01], discharge_eff: [0.01, 1, 0.01], min_soc: [0, 0.99, 0.01],
};

export const MissionSearch: React.FC<MissionSearchProps> = ({ language }) => {
  const t = copy[language];
  const id = useId();
  const [values, setValues] = useState(defaults);
  const [needDsn, setNeedDsn] = useState(false);
  const [includeInfeasible, setIncludeInfeasible] = useState(false);
  const [result, setResult] = useState<SearchResponse | null>(null);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState<'ready' | 'edited' | 'cancelled'>('ready');
  const [loading, setLoading] = useState(false);
  const active = useRef<AbortController | null>(null);
  const generation = useRef(0);
  useEffect(() => () => { generation.current += 1; active.current?.abort(); }, []);

  const invalidate = (next: 'edited' | 'cancelled' = 'edited') => {
    generation.current += 1;
    active.current?.abort();
    active.current = null;
    setLoading(false); setResult(null); setError(''); setNotice(next);
  };
  const numeric = (key: NumericKey) => (
    <label className="mission-search__field" key={key} htmlFor={`${id}-${key}`}>
      <span>{t[key]}</span>
      <input id={`${id}-${key}`} type="number" required min={bounds[key][0]} max={bounds[key][1]}
        step={bounds[key][2]} value={values[key]} onChange={event => {
          invalidate(); setValues(previous => ({ ...previous, [key]: event.target.value }));
        }} />
    </label>
  );
  const submit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    active.current?.abort();
    const controller = new AbortController();
    active.current = controller;
    const run = ++generation.current;
    setLoading(true); setError(''); setResult(null);
    const payload: Record<string, string | number | boolean> = {
      start_date: values.start_date, need_dsn: needDsn, include_infeasible: includeInfeasible,
    };
    (Object.keys(bounds) as NumericKey[]).forEach(key => { payload[key] = Number(values[key]); });
    try {
      const response = await fetch(`${API_BASE}/mission/search`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload), signal: controller.signal,
      });
      const data = await response.json();
      if (!response.ok) {
        const detail = typeof data.detail === 'string' ? data.detail : Array.isArray(data.detail)
          ? data.detail.map((item: { loc?: unknown[]; msg?: string }) => `${item.loc?.join('.') || ''}: ${item.msg || ''}`).join('; ') : '';
        throw new Error(`HTTP ${response.status}${detail ? `: ${detail}` : ''}`);
      }
      if (!Array.isArray(data.results) || typeof data.feasible_points !== 'number' || !Array.isArray(data.limits)) {
        throw new Error(t.badResponse);
      }
      if (run === generation.current) setResult(data as SearchResponse);
    } catch (caught) {
      if (run === generation.current && !controller.signal.aborted) {
        setError(caught instanceof Error ? caught.message : '');
      }
    } finally {
      if (run === generation.current) { setLoading(false); active.current = null; }
    }
  };
  const number = (value: number, digits = 1) => value.toLocaleString(language === 'tr' ? 'tr-TR' : 'en-US', { maximumFractionDigits: digits });
  return (
    <section className="mission-search" aria-labelledby={`${id}-title`} lang={language}>
      <header><h2 id={`${id}-title`}>{t.title}</h2><p>{t.intro}</p></header>
      <p className="mission-search__hint">{t.warning}</p>
      <p className="mission-search__hint">{t.integration}</p>
      <form onSubmit={submit}>
        <fieldset><legend>{t.constraints}</legend><div className="mission-search__fields">
          <label className="mission-search__field" htmlFor={`${id}-date`}><span>{t.start_date}</span>
            <input id={`${id}-date`} type="date" required value={values.start_date} onChange={event => {
              invalidate(); setValues(previous => ({ ...previous, start_date: event.target.value }));
            }} /></label>
          {(['duration_days', 'min_sun_pct', 'min_earth_pct', 'max_dark_hours', 'max_slope_deg', 'limit'] as NumericKey[]).map(numeric)}
        </div></fieldset>
        <details className="mission-search__advanced"><summary>{t.advanced}</summary>
          <p>{t.battery}</p><div className="mission-search__fields">
            {(['n_starts', 'stride_hours', 'array_peak_w', 'load_w', 'battery_wh', 'initial_soc', 'min_soc', 'charge_eff', 'discharge_eff'] as NumericKey[]).map(numeric)}
          </div>
        </details>
        <div className="mission-search__checks">
          <label><input type="checkbox" checked={needDsn} onChange={event => { invalidate(); setNeedDsn(event.target.checked); }} />{t.needDsn}</label>
          <label><input type="checkbox" checked={includeInfeasible} onChange={event => { invalidate(); setIncludeInfeasible(event.target.checked); }} />{t.include}</label>
        </div>
        <p id={`${id}-hint`} className="mission-search__hint">{t.hint} {t.battery}</p>
        <div className="mission-search__actions">
          <button type="submit" disabled={loading} aria-describedby={`${id}-hint`}>{loading ? t.loading : t.search}</button>
          {loading && <button type="button" className="mission-search__cancel" onClick={() => invalidate('cancelled')}>{t.cancel}</button>}
        </div>
      </form>
      <div aria-live="polite" aria-atomic="true" className="mission-search__status">
        {loading ? t.loading : !result && !error ? t[notice] : null}
      </div>
      {error && <div role="alert" className="mission-search__error"><strong>{t.error}</strong><p>{error}</p></div>}
      {result && <div className="mission-search__results">
        <h3>{t.summary}</h3>
        <p>{number(result.evaluated_points, 0)} / {number(result.atlas_points, 0)} {t.evaluated} · {number(result.evaluated_windows, 0)} {t.windows} · <strong>{number(result.feasible_points, 0)} {t.feasible}</strong> · {number(result.feasible_windows, 0)} {t.feasibleWindows} · {t.duration}: {number(result.duration_hours, 0)} {t.hours}</p>
        {result.feasible_points === 0 && <p role="status" className="mission-search__empty">{t.noFeasible}</p>}
        {result.results.length === 0 ? <p>{t.empty}</p> : <div className="mission-search__table" role="region" aria-label={t.table} tabIndex={0}>
          <table><caption>{t.table}</caption><thead><tr>
            {[t.rank, t.coordinates, t.score, t.status, t.start, t.sun, t.earth, t.dark, t.gap, t.slope, t.soc, t.count].map(label => <th scope="col" key={label}>{label}</th>)}
          </tr></thead><tbody>{result.results.map((row, index) => <tr key={row.index}>
            <th scope="row">{index + 1}<small>#{row.index}</small></th>
            <td>{number(row.lat, 5)}°<small>{number(row.lon, 5)}°</small></td>
            <td>{number(row.score)}</td>
            <td><span className={row.go ? 'mission-search__go' : 'mission-search__no'}>{row.go ? t.yes : t.no}</span>
              {!row.go && <small>{row.reasons.map(reason => t.reasons[reason as keyof typeof t.reasons] || reason).join(', ')}</small>}</td>
            <td><time dateTime={row.start_utc}>{row.start_utc.replace('T', ' ').replace(':00:00Z', ':00Z')}</time><small>#{row.best_start_index + 1}</small></td>
            <td>{number(row.sun_pct)}%</td><td>{number(row.earth_pct)}%</td>
            <td>{row.longest_dark_hours} {t.hours}</td><td>{row.longest_comm_gap_hours} {t.hours}</td>
            <td>{number(row.slope_deg, 2)}°<small>{number(row.elevation_m, 0)} m</small></td>
            <td>{number(row.min_soc * 100)}%<small>{row.battery_survived ? t.survived : t.failed}</small></td>
            <td>{row.go_count}</td>
          </tr>)}</tbody></table>
        </div>}
        <p className="mission-search__hint">{t.catalog}</p>
      </div>}
      <details className="mission-search__provenance"><summary>{t.provenance}</summary>
        <p>{t.ranking}</p><p>{t.limitations}</p>
        <p><code>{result?.engine || 'LUNANAV_ATLAS_HOURLY'}</code> · {result?.step_hours || 1} {t.hours} · MIT; Copyright (c) 2026 yutuf</p>
        <p><code>lmNasa-main/web/src/engine.ts; model.ts</code></p>
        {result && <details><summary>{t.raw}</summary><p>{result.ranking}</p><ul>{result.limits.map(limit => <li key={limit}>{limit}</li>)}</ul><p>{result.license}</p></details>}
      </details>
    </section>
  );
};

export default MissionSearch;
