import React from 'react';
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { setLanguage } from './i18n';
import App from './App';
import { getPresetSites, fetchEphemerisMulti, fetchHorizon } from './services/api';
import { SiteEphemeris, SiteRequest } from './types';

jest.mock('./components/ScenePanel', () => ({ ScenePanel: ({ children }: { children: React.ReactNode }) => <div>{children}</div> }));

jest.mock('./components/SciencePanel', () => ({ __esModule: true, default: () => <div>Science inspection</div> }));
jest.mock('./components/MoonMap', () => ({ MoonMap: ({ onSelectSite }: { onSelectSite: (site: SiteRequest) => void }) => <div aria-label="Moon site map"><button onClick={() => onSelectSite({ name: 'Custom map point', lat: -89.44, lon: -137.19 })}>Pick custom map point</button></div> }));
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
  (getPresetSites as jest.Mock).mockResolvedValue([
    { id: 'ridge', name: 'Catalog ridge', lat: -89.4395, lon: -137.1934 },
    { id: 'malapert', name: 'Malapert Massif', lat: -86, lon: 0 },
  ]);
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
  expect(screen.getByLabelText('3D Moon')).toBeInTheDocument();
  expect(screen.queryByLabelText('Measured terrain')).not.toBeInTheDocument();
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

test.each(['manual A', 'manual B', 'map'])('custom %s selection stays visual-only; direct handler cannot request science', async (mode) => {
  await renderApp();
  if (mode === 'manual B') fireEvent.click(screen.getByRole('button', { name: /B .* Malapert Massif/ }));
  if (mode === 'map') {
    fireEvent.click(screen.getByRole('button', { name: '2D' }));
    fireEvent.click(screen.getByRole('button', { name: 'Pick custom map point' }));
  } else fireEvent.change(screen.getByLabelText('Latitude'), { target: { value: '-88' } });
  expect(screen.getByRole('alert')).toHaveTextContent('visual inspection only');
  expect(screen.getByRole('alert')).toHaveTextContent('Scientific analysis is unsupported');
  expect(screen.getByLabelText('Latitude')).toHaveValue(mode === 'map' ? -89.44 : -88);
  const buttons = screen.getAllByRole('button', { name: 'Run analysis' });
  buttons.forEach(button => expect(button).toBeDisabled());
  // Invoke React's handler directly, bypassing the disabled DOM control.
  const button = buttons[0];
  const propsKey = Object.keys(button).find(key => key.startsWith('__reactProps$'))!;
  const props = (button as unknown as Record<string, { onClick: () => Promise<void> }>)[propsKey];
  await act(async () => { await props.onClick(); });
  expect(fetchEphemerisMulti).not.toHaveBeenCalled();
  expect(screen.getByRole('button', { name: 'Export JSON' })).toBeDisabled();
  fireEvent.change(screen.getByLabelText('Language'), { target: { value: 'tr' } });
  expect(screen.getByText(/özel konum yalnızca görsel inceleme içindir/)).toBeInTheDocument();
});

test.each(['loading', 'empty', 'rejected'])('catalog %s blocks both analysis controls without fallback', async (state) => {
  if (state === 'loading') (getPresetSites as jest.Mock).mockReturnValue(new Promise(() => {}));
  if (state === 'empty') (getPresetSites as jest.Mock).mockResolvedValue([]);
  if (state === 'rejected') (getPresetSites as jest.Mock).mockRejectedValue(new Error('offline'));
  await renderApp();
  expect(screen.getByText(state === 'loading' ? /Catalog loading;/ : /Catalog unavailable;/)).toBeInTheDocument();
  screen.getAllByRole('button', { name: 'Run analysis' }).forEach(button => {
    expect(button).toBeDisabled();
    fireEvent.click(button);
  });
  expect(fetchEphemerisMulti).not.toHaveBeenCalled();
});

test.each([0.0000005, 0.000002])('catalog tolerance %s degrees includes periodic longitude', async (offset) => {
  (getPresetSites as jest.Mock).mockResolvedValue([
    { id: 'ridge', name: 'Ridge', lat: -89.4395 + offset, lon: -137.1934 + 360 },
    { id: 'malapert', name: 'Malapert', lat: -86, lon: 360 },
  ]);
  await renderApp();
  if (offset < 1e-6) await runAnalysis();
  else {
    expect(screen.getByRole('alert')).toHaveTextContent('Scientific analysis is unsupported');
    expect(screen.getAllByRole('button', { name: 'Run analysis' })[0]).toBeDisabled();
    expect(fetchEphemerisMulti).not.toHaveBeenCalled();
  }
});

test.each(['2026-10-31', '2028-12-25'])('warns about whole-window native coverage for %s', async (date) => {
  await renderApp();
  fireEvent.change(screen.getAllByLabelText(/Mission start date/)[1], { target: { value: date } });
  expect(screen.getByRole('alert')).toHaveTextContent('2028-12-31T23:00Z');
  screen.getAllByRole('button', { name: 'Run analysis' }).forEach(button => expect(button).toBeDisabled());
  expect(fetchEphemerisMulti).not.toHaveBeenCalled();
});

test('states current engine provenance without claiming IAU_MOON execution', async () => {
  await renderApp();
  expect(screen.getByText(/Engine: local precomputed LunaNav data; not an IAU_MOON runtime calculation/)).toBeInTheDocument();
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
