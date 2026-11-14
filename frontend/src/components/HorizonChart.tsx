import React from 'react';
import {
  ResponsiveContainer,
  ComposedChart,
  Line,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  ReferenceLine,
} from 'recharts';
import { EphemerisPoint } from '../types';
import { useI18n } from '../i18n';

interface HorizonChartProps {
  data: EphemerisPoint[];
  siteName: string;
}

export const HorizonChart: React.FC<HorizonChartProps> = ({ data, siteName }) => {
  const { t } = useI18n();
  if (!data || data.length === 0) {
    return (
      <section className="instrument-panel horizon-panel horizon-empty" aria-label={t('elevationChart')} role="status">
        <div className="panel-heading">
          <h3>{t('sunEarthElevation')}</h3>
          <p>{siteName || t('selectedLandingSite')}</p>
        </div>
        <div className="empty-state">
          <span className="empty-state-label">{t('noEphemeris')}</span>
          <p>{t('chooseSitePeriod')}</p>
          <p className="empty-state-note">{t('trajectoriesNote')}</p>
        </div>
      </section>
    );
  }

  const chartData = data.map((d) => ({
    ...d,
    displayTime: d.datetime,
  }));
  const sunElevations = data.map((d) => d.sun_elevation);
  const earthElevations = data.map((d) => d.earth_elevation);
  const minEl = Math.min(...sunElevations, ...earthElevations, -3.0);
  const maxEl = Math.max(...sunElevations, ...earthElevations, 3.0);
  const signedAngle = (value: number) => `${value > 0 ? '+' : ''}${value.toFixed(2)}°`;

  return (
    <section className="instrument-panel horizon-panel" aria-label={`${t('elevationChart')}: ${siteName}`}>
      <div className="panel-heading horizon-heading">
        <div>
          <h3>{t('elevationVsHorizon')}</h3>
          <p>{t('site')}: {siteName} · {t('horizonVisible')}</p>
        </div>
        <div className="chart-legend">
          <span className="legend-item data-sun"><span className="legend-line" />{t('sunAnglePower')}</span>
          <span className="legend-item data-earth"><span className="legend-line" />{t('earthAngleDte')}</span>
        </div>
      </div>

      <div className="horizon-chart" style={{ width: '100%', height: 320 }}>
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={chartData} margin={{ top: 12, right: 20, left: -8, bottom: 24 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#303235" />
            <XAxis dataKey="displayTime" stroke="#989b9f" fontSize={11} tickLine={false} angle={-30} textAnchor="end" />
            <YAxis
              stroke="#989b9f"
              fontSize={11}
              domain={[Math.floor(minEl - 1), Math.ceil(maxEl + 1)]}
              tickFormatter={(val) => `${val}°`}
              label={{ value: t('elevation'), angle: -90, position: 'insideLeft', fill: '#989b9f', fontSize: 12, offset: 16 }}
            />
            <Tooltip
              contentStyle={{ backgroundColor: '#1b1d20', borderColor: '#3a3d41', borderRadius: 8, color: '#e6e7e9', fontSize: 12 }}
              formatter={(value: any, name: any) => {
                if (name === t('sunElevation') || name === 'sun_elevation') return [`${value}°`, t('sunElevation')];
                if (name === t('earthElevation') || name === 'earth_elevation') return [`${value}°`, t('earthElevation')];
                if (name === 'solar_flux_pct') return [`${value}%`, t('relativeSolarFlux')];
                return [value, name];
              }}
              labelFormatter={(label) => `${t('time')} (UTC): ${label}`}
            />
            <ReferenceLine y={0} stroke="#a4a6aa" strokeWidth={1} strokeDasharray="4 4"
              label={{ value: t('horizon'), position: 'insideTopRight', fill: '#a4a6aa', fontSize: 11, fontWeight: 400 }} />
            <Line type="monotone" dataKey="earth_elevation" name={t('earthElevation')} stroke="#82b4bd" strokeWidth={2} dot={false} activeDot={{ r: 4, fill: '#82b4bd' }} isAnimationActive={false} />
            <Area type="monotone" dataKey="sun_elevation" name={t('sunElevation')} stroke="#d3a65c" strokeWidth={2} fill="#d3a65c" fillOpacity={0.08} dot={false} activeDot={{ r: 4, fill: '#d3a65c' }} isAnimationActive={false} />
          </ComposedChart>
        </ResponsiveContainer>
      </div>

      <dl className="chart-stats">
        <div><dt>{t('minSunAngle')}</dt><dd className="data-sun">{signedAngle(Math.min(...sunElevations))}</dd></div>
        <div><dt>{t('maxSunAngle')}</dt><dd className="data-sun">{signedAngle(Math.max(...sunElevations))}</dd></div>
        <div><dt>{t('minEarthAngle')}</dt><dd className="data-earth">{signedAngle(Math.min(...earthElevations))}</dd></div>
        <div><dt>{t('maxEarthAngle')}</dt><dd className="data-earth">{signedAngle(Math.max(...earthElevations))}</dd></div>
      </dl>
    </section>
  );
};
