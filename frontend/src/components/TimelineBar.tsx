import React from 'react';
import { EphemerisPoint } from '../types';

interface TimelineBarProps {
  data: EphemerisPoint[];
}

export const TimelineBar: React.FC<TimelineBarProps> = ({ data }) => {
  if (!data || data.length === 0) return null;

  return (
    <section className="instrument-panel timeline-panel" aria-label="Mission windows timeline">
      <div className="panel-heading">
        <h4>Mission windows timeline</h4>
        <p>Filled intervals are active · Dark intervals are inactive or blocked</p>
      </div>

      <div className="timeline-row">
        <div className="timeline-row-heading">
          <span>Solar power generation</span>
          <span className="interval-count">{data.filter((p) => p.sun_visible).length} / {data.length} intervals active</span>
        </div>
        <div className="timeline-track" aria-label="Solar power intervals">
          {data.map((pt, idx) => (
            <div key={idx}
              title={`${pt.datetime}\nSun El: ${pt.sun_elevation}°\nStatus: ${pt.sun_visible ? 'Sunlit' : 'Shadow'}`}
              className={`timeline-interval ${pt.sun_visible ? 'interval-sun' : 'interval-inactive'}`} />
          ))}
        </div>
      </div>

      <div className="timeline-row">
        <div className="timeline-row-heading">
          <span>Direct-to-Earth (DTE) line of sight</span>
          <span className="interval-count">{data.filter((p) => p.earth_visible).length} / {data.length} intervals active</span>
        </div>
        <div className="timeline-track" aria-label="Direct-to-Earth communication intervals">
          {data.map((pt, idx) => (
            <div key={idx}
              title={`${pt.datetime}\nEarth El: ${pt.earth_elevation}°\nStatus: ${pt.earth_visible ? 'Direct Comm Open' : 'Blocked'}`}
              className={`timeline-interval ${pt.earth_visible ? 'interval-earth' : 'interval-inactive'}`} />
          ))}
        </div>
      </div>

      <div className="timeline-row">
        <div className="timeline-row-heading">
          <span>Optimal operations · Power & communication</span>
          <span className="interval-count">{data.filter((p) => p.sun_visible && p.earth_visible).length} / {data.length} intervals optimal</span>
        </div>
        <div className="timeline-track" aria-label="Combined power and communication intervals">
          {data.map((pt, idx) => {
            const isOptimal = pt.sun_visible && pt.earth_visible;
            return (
              <div key={idx}
                title={`${pt.datetime}\nStatus: ${isOptimal ? 'Optimal Landing & EVA Window' : 'Constrained'}`}
                className={`timeline-interval ${isOptimal ? 'interval-optimal' : 'interval-inactive'}`} />
            );
          })}
        </div>
      </div>
    </section>
  );
};
