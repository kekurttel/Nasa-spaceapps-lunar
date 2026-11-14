import React from 'react';
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { setLanguage } from './i18n';
import App from './App';
import { getPresetSites, fetchEphemerisMulti, fetchHorizon } from './services/api';
import { SiteEphemeris, SiteRequest } from './types';

jest.mock('./components/SciencePanel', () => ({ __esModule: true, default: () => <div>Science inspection</div> }));
jest.mock('./components/MoonMap', () => ({ MoonMap: () => <div aria-label="Moon site map" /> }));
jest.mock('./components/LunarSurface3D', () => ({ __esModule: true, default: () => <div aria-label="3D Moon" /> }));
jest.mock('./components/MeasuredTerrain', () => ({
  __esModule: true,
  default: () => <div aria-label="Measured terrain" />,
  MeasuredTerrain: () => <div aria-label="Measured terrain" />,
}), { virtual: true });
jest.mock('./components/HorizonChart', () => ({ HorizonChart: () => <div>Local horizon chart</div> }));
jest.mock('./components/TimelineBar', () => ({ TimelineBar: () => <div>Mission windows timeline</div> }));
jest.mock('./components/ComparePanel', () => ({ ComparePanel: () => <div>Site comparison</div> }));
jest.mock('./services/api', () => ({ getPresetSites: jest.fn(), fetchEphemerisMulti: jest.fn(), fetchHorizon: jest.fn() }));

const originalFetch = global.fetch;

afterEach(() => {
  global.fetch = originalFetch;
});

function result(site: SiteRequest, start: string): SiteEphemeris {
  const second = site.name === 'Malapert Massif';
  return {
    site,
    data: [0, 2].map((hour) => ({
      datetime: new Date(Date.parse(start) + hour * 3600000).toISOString(),
      timestamp: Date.parse(start) / 1000 + hour * 3600,
      sun_elevation: hour ? -5 : 12, sun_azimuth: 90,
      earth_elevation: 8, earth_azimuth: 180,
      sun_visible: hour === 0, earth_visible: true, solar_flux_pct: hour ? 0 : 21,
    })),
    summary: {
      total_hours: 4, sun_hours: second ? 3 : 2, dark_hours: second ? 1 : 2,
      earth_visible_hours: 4, no_earth_hours: 0, sun_percentage: second ? 75 : 50,
      earth_percentage: 100, max_continuous_sun_hours: 2, max_continuous_dark_hours: 2,
      max_continuous_comm_hours: 4, max_continuous_no_comm_hours: 0,
      avg_sun_elevation_when_visible: 12, avg_earth_elevation_when_visible: 8,
    },
  };
}

beforeEach(() => {
  jest.resetAllMocks();
  global.fetch = jest.fn().mockResolvedValue({
    ok: true,
    json: async () => ({ source: 'Test dataset inventory' }),
  });
  (fetchHorizon as jest.Mock).mockRejectedValue(new Error('No horizon fixture'));
  setLanguage('en');
  (getPresetSites as jest.Mock).mockResolvedValue([]);
  (fetchEphemerisMulti as jest.Mock).mockImplementation(async (sites: SiteRequest[], start: string, end: string, step: number) => ({
    sites: sites.map(site => result(site, start)), source: 'Test service',
    query_start: start, query_end: end, step_hours: step,
  }));
});

async function renderApp() {
  await act(async () => { render(<App />); });
}
async function runAnalysis() {
  fireEvent.click(screen.getAllByRole('button', { name: 'Run analysis' })[0]);
  await waitFor(() => expect(screen.getByRole('button', { name: 'Export JSON' })).toBeEnabled());
}

test('renders scenario controls without automatically requesting calculations', async () => {
  await renderApp();
  expect(screen.getByRole('heading', { name: 'Lunar site assessment' })).toBeInTheDocument();
  expect(screen.getAllByLabelText('Mission start date · UTC')).toHaveLength(2);
  expect(screen.getByLabelText('Measured terrain')).toBeInTheDocument();
  expect(screen.queryByLabelText('3D Moon')).not.toBeInTheDocument();
  expect(screen.getByText('Backend dataset inventory received. Details below.')).toBeInTheDocument();
  expect(global.fetch).toHaveBeenCalledWith(
    `${process.env.REACT_APP_API_URL || '/api'}/data/status`,
    { signal: expect.any(AbortSignal) },
  );
  expect(fetchEphemerisMulti).not.toHaveBeenCalled();
  expect(screen.getByRole('button', { name: 'Export JSON' })).toBeDisabled();
  expect(screen.getByRole('button', { name: 'CSV' })).toBeDisabled();
});

test('switches language in both directions without running analysis', async () => {
  await renderApp();
  fireEvent.change(screen.getByLabelText('Language'), { target: { value: 'tr' } });
  expect(screen.getByRole('heading', { name: 'Ay alanı değerlendirmesi' })).toBeInTheDocument();
  expect(document.documentElement.lang).toBe('tr');
  fireEvent.change(screen.getByRole('combobox', { name: 'Dil' }), { target: { value: 'en' } });
  expect(document.documentElement.lang).toBe('en');
  expect(screen.getByRole('heading', { name: 'Lunar site assessment' })).toBeInTheDocument();
  expect(fetchEphemerisMulti).not.toHaveBeenCalled();
});

test('requests two valid results with independent dates and durations', async () => {
  await renderApp();
  const dates = screen.getAllByLabelText('Mission start date · UTC');
  fireEvent.change(dates[1], { target: { value: '2027-03-01' } });
  fireEvent.click(within(screen.getByRole('group', { name: 'Scenario B' })).getByRole('button', { name: '7 days' }));
  await runAnalysis();
  expect(fetchEphemerisMulti).toHaveBeenCalledTimes(2);
  expect(fetchEphemerisMulti).toHaveBeenNthCalledWith(1,
    [{ name: 'Shackleton – de Gerlache connecting ridge', lat: -89.4395, lon: -137.1934 }], '2027-01-01T00:00:00Z', '2027-01-31T00:00:00.000Z', 2);
  expect(fetchEphemerisMulti).toHaveBeenNthCalledWith(2,
    [{ name: 'Malapert Massif', lat: -86, lon: 0 }], '2027-03-01T00:00:00Z', '2027-03-08T00:00:00.000Z', 2);
  expect(screen.getByText('50%')).toBeInTheDocument();
  expect(screen.getByText('Local horizon chart')).toBeInTheDocument();
  expect(screen.getByText('Test service')).toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'CSV' })).toBeEnabled();
  fireEvent.click(screen.getByRole('button', { name: /B · Malapert Massif/ }));
  expect(screen.getByText('75%')).toBeInTheDocument();
  expect(fetchEphemerisMulti).toHaveBeenCalledTimes(2);
});

test.each(['date', 'duration', 'sampling', 'coordinates'])('changing %s clears results without automatic calculation', async (control) => {
  await renderApp();
  await runAnalysis();
  if (control === 'date') fireEvent.change(screen.getAllByLabelText('Mission start date · UTC')[0], { target: { value: '2027-02-01' } });
  if (control === 'duration') fireEvent.click(within(screen.getByRole('group', { name: 'Scenario A' })).getByRole('button', { name: '7 days' }));
  if (control === 'sampling') fireEvent.change(screen.getByRole('combobox', { name: /Sampling interval/ }), { target: { value: '4' } });
  if (control === 'coordinates') fireEvent.change(screen.getByLabelText('Latitude'), { target: { value: '-88' } });
  expect(screen.getByRole('button', { name: 'Export JSON' })).toBeDisabled();
  expect(screen.getByRole('button', { name: 'CSV' })).toBeDisabled();
  expect(screen.queryByText('Local horizon chart')).not.toBeInTheDocument();
  expect(screen.queryByText('Test service')).not.toBeInTheDocument();
  expect(fetchEphemerisMulti).toHaveBeenCalledTimes(2);
});

test('rejects missing dates without making API requests', async () => {
  await renderApp();
  fireEvent.change(screen.getAllByLabelText('Mission start date · UTC')[1], { target: { value: '' } });
  fireEvent.click(screen.getAllByRole('button', { name: 'Run analysis' })[0]);
  expect(screen.getByRole('alert')).toBeInTheDocument();
  expect(fetchEphemerisMulti).not.toHaveBeenCalled();
  expect(screen.getByRole('button', { name: 'CSV' })).toBeDisabled();
});

test.each(['rejection', 'incomplete response'])('shows service failure for %s without substitute results', async (failure) => {
  if (failure === 'rejection') (fetchEphemerisMulti as jest.Mock).mockRejectedValue(new Error('offline'));
  else (fetchEphemerisMulti as jest.Mock).mockResolvedValue({ sites: [], source: 'Test service' });
  await renderApp();
  fireEvent.click(screen.getAllByRole('button', { name: 'Run analysis' })[0]);
  expect(await screen.findByRole('alert')).toHaveTextContent('No substitute data is shown');
  expect(screen.getByRole('button', { name: 'Export JSON' })).toBeDisabled();
  expect(screen.getByRole('button', { name: 'CSV' })).toBeDisabled();
  expect(screen.queryByText('Local horizon chart')).not.toBeInTheDocument();
});

test('ignores stale responses after scenario changes', async () => {
  const resolve: Array<(value: unknown) => void> = [];
  (fetchEphemerisMulti as jest.Mock).mockImplementation(() => new Promise(done => resolve.push(done)));
  await renderApp();
  fireEvent.click(screen.getAllByRole('button', { name: 'Run analysis' })[0]);
  fireEvent.change(screen.getAllByLabelText('Mission start date · UTC')[0], { target: { value: '2027-02-01' } });
  await act(async () => {
    resolve.forEach(done => done({ sites: [result({ name: 'Stale', lat: -89, lon: 0 }, '2027-01-01T00:00')], source: 'Stale service' }));
  });
  expect(screen.getByRole('button', { name: 'Export JSON' })).toBeDisabled();
  expect(screen.queryByText('Stale service')).not.toBeInTheDocument();
});
