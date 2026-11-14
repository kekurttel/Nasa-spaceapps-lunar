import React from 'react';
import { SiteEphemeris } from '../types';
import { useI18n } from '../i18n';

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
  const { t } = useI18n();
  if (!sites || sites.length === 0) return null;

  return (
    <section className="instrument-panel compare-panel" aria-label={t('landingSiteComparison')}>
      <div className="panel-heading">
        <h3>{t('landingSiteComparison')}</h3>
        <p>{t('comparisonDescription')}</p>
      </div>
      <div className="table-scroll">
        <table className="comparison-table">
          <thead>
            <tr>
              {(['landingSite', 'coordinates', 'sunlight', 'earthComm', 'maxDarkBlackout', 'maxCommBlackout', 'action'] as const).map(key => <th scope="col" key={key}>{t(key)}</th>)}
            </tr>
          </thead>
          <tbody>
            {sites.map((item, idx) => {
              const summary = item.summary;
              const isActive = idx === activeSiteIndex;
              const siteName = item.site.name || `${t('site')} #${idx + 1}`;

              return (
                <tr key={idx} className={isActive ? 'comparison-row is-active' : 'comparison-row'} onClick={() => onSelectActiveIndex(idx)}>
                  <th scope="row">
                    <button type="button" className="site-select" aria-pressed={isActive}
                      onClick={(event) => { event.stopPropagation(); onSelectActiveIndex(idx); }}>
                      <span className="selection-indicator" aria-hidden="true" />
                      {siteName}
                      {isActive && <span className="active-site-label">{t('active')}</span>}
                    </button>
                  </th>
                  <td className="numeric muted">{item.site.lat.toFixed(2)}°, {item.site.lon.toFixed(2)}°</td>
                  <td className="numeric data-sun">{summary.sun_percentage}% <span className="muted">({summary.sun_hours} {t('hours')})</span></td>
                  <td className="numeric data-earth">{summary.earth_percentage}% <span className="muted">({summary.earth_visible_hours} {t('hours')})</span></td>
                  <td className="numeric">{summary.max_continuous_dark_hours} {t('hours')}</td>
                  <td className="numeric">{summary.max_continuous_no_comm_hours} {t('hours')}</td>
                  <td>
                    {sites.length > 1 && (
                      <button type="button" className="remove-site" aria-label={t('removeSite').replace('{site}', siteName)}
                        onClick={(event) => { event.stopPropagation(); onRemoveSite(idx); }}>
                        {t('remove')}
                      </button>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
};
