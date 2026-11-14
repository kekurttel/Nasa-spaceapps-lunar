import React, { useEffect, useMemo, useState } from 'react';
import { EphemerisPoint } from '../types';
import { useI18n } from '../i18n';
import './VisibilityTimeline.css';

export interface VisibilityTimelineLabels {
  title: string; sun: string; earth: string; both: string; empty: string; selected: string;
  visible: string; notVisible: string; time: string; elevation: string; azimuth: string; solarFlux: string; pinHint: string;
}
interface VisibilityTimelineProps {
  data: EphemerisPoint[];
  onPinMoment: (point: EphemerisPoint) => void;
  /** Retained for caller compatibility; translations follow the shared language. */
  labels?: VisibilityTimelineLabels;
}

export const VisibilityTimeline: React.FC<VisibilityTimelineProps> = ({ data, onPinMoment }) => {
  const { t, language } = useI18n();
  const [activeIndex, setActiveIndex] = useState(0);
  const [pinnedIndex, setPinnedIndex] = useState<number | null>(null);
  const validData = useMemo(() => (data ?? []).filter(point => Number.isFinite(point.timestamp)), [data]);
  useEffect(() => { setActiveIndex(0); setPinnedIndex(null); }, [data]);
  const index = Math.min(pinnedIndex ?? activeIndex, Math.max(0, validData.length - 1));
  const active = validData[index];
  const format = (value: number) => new Intl.NumberFormat(language, { maximumFractionDigits: 2 }).format(value);
  const state = (visible: boolean) => t(visible ? 'visible' : 'notVisible');
  const preview = (next: number) => { if (pinnedIndex === null) setActiveIndex(next); };
  const navigate = (next: number) => {
    const bounded = Math.max(0, Math.min(validData.length - 1, next));
    setActiveIndex(bounded);
    if (pinnedIndex !== null) { setPinnedIndex(bounded); onPinMoment(validData[bounded]); }
  };
  if (!active) return <section className="visibility-timeline" aria-label={t('missionTimeline')}><h2>{t('missionTimeline')}</h2><p className="visibility-timeline__empty">{t('timelineEmpty')}</p></section>;
  const rows = [
    { key: 'sun', label: t('sunVisible'), visible: (point: EphemerisPoint) => point.sun_visible },
    { key: 'earth', label: t('earthVisible'), visible: (point: EphemerisPoint) => point.earth_visible },
    { key: 'both', label: t('timelineBoth'), visible: (point: EphemerisPoint) => point.sun_visible && point.earth_visible },
  ];
  return <section className="visibility-timeline" aria-label={t('missionTimeline')}>
    <h2 className="visibility-timeline__title">{t('missionTimeline')}</h2>
    <div className="visibility-timeline__rows">{rows.map(row => <div className="visibility-timeline__row" key={row.key}>
      <span className="visibility-timeline__row-label">{row.label}</span>
      <div className="visibility-timeline__track" role="group" aria-label={row.label}>
        {validData.map((point, pointIndex) => <button key={`${point.timestamp}-${pointIndex}`} type="button"
          className={`visibility-timeline__cell ${row.visible(point) ? `is-visible is-${row.key}` : ''} ${pointIndex === index ? 'is-selected' : ''}`}
          aria-label={`${row.label}, ${point.datetime} UTC, ${state(row.visible(point))}`}
          aria-pressed={pointIndex === pinnedIndex}
          title={`${point.datetime} UTC · ${state(row.visible(point))}`}
          onFocus={() => preview(pointIndex)} onMouseEnter={() => preview(pointIndex)}
          onClick={() => {
            setActiveIndex(pointIndex);
            if (pinnedIndex === pointIndex) setPinnedIndex(null);
            else { setPinnedIndex(pointIndex); onPinMoment(point); }
          }} />)}
      </div>
    </div>)}</div>
    <div className="visibility-timeline__detail" aria-live="polite" aria-atomic="true">
      <strong>{t('timelineSelected')}: {active.datetime}{pinnedIndex !== null ? ` · ${t('pinned')}` : ''}</strong>
      <span>{t('sun')}: {state(active.sun_visible)} · {t('elevationOnly')}: {format(active.sun_elevation)}° · {t('azimuth')}: {format(active.sun_azimuth)}°</span>
      <span>{t('earth')}: {state(active.earth_visible)} · {t('elevationOnly')}: {format(active.earth_elevation)}° · {t('azimuth')}: {format(active.earth_azimuth)}°</span>
      <span>{t('relativeSolarFlux')}: {format(active.solar_flux_pct)}%</span>
    </div>
    <div className="visibility-timeline__axis" aria-hidden="true"><span>{validData[0].datetime}</span><span>{validData[validData.length - 1].datetime}</span></div>
    <p className="visibility-timeline__hint">{t('timelinePinHint')}</p>
    <div className="visibility-timeline__keyboard" aria-label={t('time')}>
      <button type="button" onClick={() => navigate(index - 1)} disabled={index === 0}>{t('previous')}</button>
      <input type="range" min="0" max={validData.length - 1} value={index} aria-label={t('time')} onChange={event => navigate(Number(event.target.value))} />
      <button type="button" onClick={() => navigate(index + 1)} disabled={index === validData.length - 1}>{t('next')}</button>
      <button type="button" disabled={pinnedIndex === null} onClick={() => { setActiveIndex(index); setPinnedIndex(null); }}>{t('resetPin')}</button>
    </div>
  </section>;
};
export default VisibilityTimeline;
