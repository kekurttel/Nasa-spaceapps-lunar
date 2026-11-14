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
    <section className="instrument-panel compare-panel" aria-label="Landing site comparison">
      <div className="panel-heading">
        <h3>Landing site comparison</h3>
        <p>Illumination, direct communication windows and blackout duration across candidate locations</p>
      </div>
      <div className="table-scroll">
        <table className="comparison-table">
          <thead>
            <tr>
              <th scope="col">Landing site</th>
              <th scope="col">Coords (lat, lon)</th>
              <th scope="col">Sunlight %</th>
              <th scope="col">Earth comm %</th>
              <th scope="col">Max dark blackout</th>
              <th scope="col">Max comm blackout</th>
              <th scope="col">Feasibility score</th>
              <th scope="col">Action</th>
            </tr>
          </thead>
          <tbody>
            {sites.map((item, idx) => {
              const summary = item.summary;
              // Preserve the existing composite score and blackout penalty.
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
              const siteName = item.site.name || `Site #${idx + 1}`;

              return (
                <tr key={idx} className={isActive ? 'comparison-row is-active' : 'comparison-row'} onClick={() => onSelectActiveIndex(idx)}>
                  <th scope="row">
                    <button type="button" className="site-select" aria-pressed={isActive}
                      onClick={(event) => { event.stopPropagation(); onSelectActiveIndex(idx); }}>
                      <span className="selection-indicator" aria-hidden="true" />
                      {siteName}
                      {isActive && <span className="active-site-label">Active</span>}
                    </button>
                  </th>
                  <td className="numeric muted">{item.site.lat.toFixed(2)}°, {item.site.lon.toFixed(2)}°</td>
                  <td className="numeric data-sun">{summary.sun_percentage}% <span className="muted">({summary.sun_hours}h)</span></td>
                  <td className="numeric data-earth">{summary.earth_percentage}% <span className="muted">({summary.earth_visible_hours}h)</span></td>
                  <td className="numeric">{summary.max_continuous_dark_hours} hrs</td>
                  <td className="numeric">{summary.max_continuous_no_comm_hours} hrs</td>
                  <td className="numeric"><span className="feasibility-score">{score} / 100</span></td>
                  <td>
                    {sites.length > 1 && (
                      <button type="button" className="remove-site" aria-label={`Remove ${siteName} from comparison`}
                        onClick={(event) => { event.stopPropagation(); onRemoveSite(idx); }}>
                        Remove
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
