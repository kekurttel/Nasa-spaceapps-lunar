import React from 'react';
import { SiteRequest } from '../types';
import './ScenarioControls.css';

export type ScenarioDuration = 7 | 30 | 90 | 365;

export interface ScenarioValue {
  site: SiteRequest;
  startDate: string;
  durationDays: ScenarioDuration;
}

export interface ScenarioLabels {
  title: string;
  scenarioA: string;
  scenarioB: string;
  startDate: string;
  duration: string;
  days: string;
  presets: Record<ScenarioDuration, string>;
  scenarioNames: [string, string];
}

interface ScenarioControlsProps {
  scenarios: [ScenarioValue, ScenarioValue];
  labels: ScenarioLabels;
  onStartDateChange: (index: 0 | 1, date: string) => void;
  onDurationChange: (index: 0 | 1, duration: ScenarioDuration) => void;
}

const DURATIONS: ScenarioDuration[] = [7, 30, 90, 365];

export const ScenarioControls: React.FC<ScenarioControlsProps> = ({
  scenarios,
  labels,
  onStartDateChange,
  onDurationChange,
}) => (
  <section className="scenario-controls" aria-label={labels.title}>
    <header className="scenario-controls__header">
      <h2>{labels.title}</h2>
    </header>
    <div className="scenario-controls__grid">
      {scenarios.map((scenario, rawIndex) => {
        const index = rawIndex as 0 | 1;
        const title = index === 0 ? labels.scenarioA : labels.scenarioB;
        const dateId = `scenario-${index}-start-date`;
        const durationId = `scenario-${index}-duration`;
        return (
          <fieldset className={`scenario-card scenario-card--${index === 0 ? 'a' : 'b'}`} key={index}>
            <legend><span className="scenario-card__marker" aria-hidden="true">{index === 0 ? 'A' : 'B'}</span>{title}</legend>
            <p className="scenario-card__name">{labels.scenarioNames[index]}</p>
            <div className="scenario-card__field">
              <label htmlFor={dateId}>{labels.startDate}</label>
              <input id={dateId} type="date" value={scenario.startDate}
                onChange={(event) => onStartDateChange(index, event.target.value)} />
            </div>
            <div className="scenario-card__field">
              <span className="scenario-card__label" id={durationId}>{labels.duration}</span>
              <div className="scenario-card__presets" role="group" aria-labelledby={durationId}>
                {DURATIONS.map((duration) => (
                  <button key={duration} type="button"
                    className={scenario.durationDays === duration ? 'is-selected' : ''}
                    aria-pressed={scenario.durationDays === duration}
                    onClick={() => onDurationChange(index, duration)}>
                    {labels.presets[duration]} <span>{labels.days}</span>
                  </button>
                ))}
              </div>
            </div>
          </fieldset>
        );
      })}
    </div>
  </section>
);
