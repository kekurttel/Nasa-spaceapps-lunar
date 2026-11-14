import React, { useMemo, useState } from 'react';
import { EphemerisPoint, SiteSummary } from '../types';
import { useI18n } from '../i18n';
import './AnalysisSummary.css';

export interface AnalysisSite { name?: string; data: EphemerisPoint[]; summary: SiteSummary; }
interface AnalysisSummaryProps { sites: AnalysisSite[]; initialLoadWatts?: number; }

export const AnalysisSummary: React.FC<AnalysisSummaryProps> = ({ sites, initialLoadWatts = 100 }) => {
  const { t, language } = useI18n();
  const [loadWatts, setLoadWatts] = useState(initialLoadWatts);
  const [displayMode, setDisplayMode] = useState('elevation');
  const number = (value: number, digits = 1) => new Intl.NumberFormat(language, { maximumFractionDigits: digits, minimumFractionDigits: digits }).format(value || 0);
  const hours = (value: number) => `${number(value)} ${t('hours')}`;
  const rows = useMemo(() => sites.map(site => ({
    ...site,
    darkWh: Math.max(0, site.summary.max_continuous_dark_hours) * loadWatts,
    boundaryDark: site.data.length > 0 && (!site.data[0].sun_visible || !site.data[site.data.length - 1].sun_visible),
  })), [sites, loadWatts]);
  const maxHours = Math.max(0, ...rows.map(row => row.summary.total_hours));
  return <section className="analysis-summary" aria-labelledby="analysis-summary-title">
    <header className="analysis-summary__header">
      <div><h2 id="analysis-summary-title">{t('powerAssessment')}</h2><p>{t('assessmentNote')}</p></div>
      <label className="analysis-summary__control">{t('loadAssumption')}
        <span><input type="number" min="0" step="10" value={loadWatts} onChange={event => setLoadWatts(Math.max(0, Number(event.target.value) || 0))} /> W</span>
      </label>
      <label className="analysis-summary__control">{t('angleDisplay')}
        <select value={displayMode} onChange={event => setDisplayMode(event.target.value)}>
          <option value="elevation">{t('elevationOnly')}</option><option value="clearance">{t('clearanceUnavailable')}</option>
        </select>
      </label>
    </header>
    <div className="analysis-summary__notice" role="note">{t(displayMode === 'clearance' ? 'clearanceNote' : 'energyNote')}</div>
    <div className="analysis-summary__chart" role="img" aria-label={t('visibilityComparison')}>
      {rows.map(({ name, summary }, index) => <div className="analysis-summary__bar-row" key={index}>
        <span className="analysis-summary__site">{name || `${t('site')} #${index + 1}`}</span>
        <div className="analysis-summary__bars">
          <div className="analysis-summary__bar analysis-summary__bar--sun" style={{ width: `${maxHours ? summary.sun_hours / maxHours * 100 : 0}%` }} title={`${t('sunVisible')} ${hours(summary.sun_hours)}`} />
          <div className="analysis-summary__bar analysis-summary__bar--earth" style={{ width: `${maxHours ? summary.earth_visible_hours / maxHours * 100 : 0}%` }} title={`${t('earthVisible')} ${hours(summary.earth_visible_hours)}`} />
        </div><span className="analysis-summary__chart-values">{hours(summary.sun_hours)} / {hours(summary.earth_visible_hours)}</span>
      </div>)}
      <div className="analysis-summary__legend"><span>{t('sunVisible')}</span><span>{t('earthVisible')}</span><small>{t('barScale')}</small></div>
    </div>
    <div className="analysis-summary__table-wrap"><table>
      <thead><tr>{(['site', 'sunVisible', 'earthVisible', 'longestDarkness', 'longestCommunicationGap', 'darkEnergy', 'meanVisibleElevation', 'earthClearance'] as const).map(key => <th scope="col" key={key}>{t(key)}</th>)}</tr></thead>
      <tbody>{rows.map(({ name, summary, darkWh, boundaryDark }, index) => <tr key={index}>
        <th scope="row">{name || `${t('site')} #${index + 1}`}</th>
        <td>{hours(summary.sun_hours)} <small>({number(summary.sun_percentage)}%)</small></td>
        <td>{hours(summary.earth_visible_hours)} <small>({number(summary.earth_percentage)}%)</small></td>
        <td>{hours(summary.max_continuous_dark_hours)}</td><td>{hours(summary.max_continuous_no_comm_hours)}</td>
        <td>{boundaryDark ? '≥ ' : ''}{number(darkWh, 0)} Wh <small>{t('loadAssumption')}: {number(loadWatts, 0)} W</small>{boundaryDark && <small>{t('lowerBound')}</small>}</td>
        <td>{t('sun')} {number(summary.avg_sun_elevation_when_visible)}° · {t('earth')} {number(summary.avg_earth_elevation_when_visible)}°</td>
        <td>{t('notProvided')}</td>
      </tr>)}</tbody>
    </table></div>
    <p className="analysis-summary__footnote">{t('energyFormula')} {t('energyNote')}</p>
  </section>;
};
export default AnalysisSummary;
