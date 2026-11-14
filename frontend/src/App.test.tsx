import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import App from './App';
import fixture from './test-fixtures/api.json';
import { getCatalog, getPortals, analyzeScenarios } from './services/api';

jest.mock('./services/api', () => ({ getCatalog: jest.fn(), getPortals: jest.fn(), analyzeScenarios: jest.fn() }));

beforeEach(() => {
  jest.resetAllMocks();
  (getCatalog as jest.Mock).mockResolvedValue(fixture.catalog);
  (getPortals as jest.Mock).mockResolvedValue([]);
  (analyzeScenarios as jest.Mock).mockResolvedValue(fixture.result);
});

async function ready() {
  render(<App />);
  const run = screen.getByRole('button', { name: 'Run comparison' });
  const catalog = await screen.findByLabelText('Add catalog location');
  await screen.findByRole('option', { name: fixture.catalog.sites[0].name });
  fireEvent.change(catalog, { target: { value: fixture.catalog.sites[0].id } });
  fireEvent.change(catalog, { target: { value: fixture.catalog.sites[1].id } });
  const consent = screen.queryByRole('checkbox');
  if (consent) fireEvent.click(consent);
  await waitFor(() => expect(run).toBeEnabled());
  return run;
}

test('renders bundled-coverage demo and honest limitations', async () => {
  await ready();
  expect(screen.getByRole('heading', { name: 'Lunar site assessment' })).toBeInTheDocument();
  expect(screen.getByText(/2026-01-01 — 2026-01-02/)).toBeInTheDocument();
  expect(screen.getByText(/No terrain, power, link-budget, or landing-safety guarantee/)).toBeInTheDocument();
});

test('renders saved HTTP result and sends explicit flat model with UTC', async () => {
  fireEvent.click(await ready());
  expect(await screen.findByText('Sun fraction')).toBeInTheDocument();
  expect(screen.getAllByText(/flat · 3600s/)).toHaveLength(2);
  expect(screen.getByRole('button', { name: 'Export CSV' })).toBeEnabled();
  const scenarios = (analyzeScenarios as jest.Mock).mock.calls[0][0];
  expect(scenarios).toHaveLength(2);
  expect(scenarios[0]).toMatchObject({ horizonModel: 'flat', startUtc: '2026-01-01T00:00:00Z', stepSeconds: 3600 });
});

test('terrain sends explicit model, DEM elevation and kernel-bounded dates without flat limits', async () => {
  const run = await ready();
  fireEvent.change(screen.getAllByLabelText(/Surface elevation \(m\)/)[0], { target: { value: '9999' } });
  screen.getAllByLabelText('Horizon model').forEach(select => fireEvent.change(select, { target: { value: 'terrain' } }));
  expect(screen.queryByText('I understand 0 m is an explicit reference-sphere assumption, not measured elevation.')).not.toBeInTheDocument();
  screen.getAllByRole('checkbox').forEach(checkbox => fireEvent.click(checkbox));
  expect(screen.queryByLabelText(/Surface elevation \(m\)/)).not.toBeInTheDocument();
  const start = screen.getAllByLabelText('Start (UTC)')[0];
  expect(start).not.toHaveAttribute('min');
  expect(start).not.toHaveAttribute('max');
  fireEvent.change(start, { target: { value: '2027-01-01T00:00' } });
  fireEvent.change(screen.getAllByLabelText('End (UTC)')[0], { target: { value: '2027-01-02T00:00' } });
  fireEvent.click(run);
  await screen.findByText('Sun fraction');
  const scenarios = (analyzeScenarios as jest.Mock).mock.calls[0][0];
  expect(scenarios[0]).toMatchObject({ horizonModel: 'terrain', coordinateFrame: 'MOON_ME_DE421', startUtc: '2027-01-01T00:00:00Z', site: { surfaceElevationM: null } });
  expect(scenarios[1].horizonModel).toBe('terrain');
});

test('requires explicit terrain coordinate-frame acknowledgment before API call', async () => {
  const run = await ready();
  fireEvent.change(screen.getAllByLabelText('Horizon model')[0], { target: { value: 'terrain' } });
  fireEvent.click(run);
  expect(await screen.findByRole('alert')).toHaveTextContent('Confirm MOON_ME_DE421 coordinate interpretation');
  expect(analyzeScenarios).not.toHaveBeenCalled();
});

test('renders terrain source hashes, registered frame and all returned quality', async () => {
  const terrain = { ...fixture.result, entries: fixture.result.entries.map(entry => ({
    ...entry,
    scenario: { ...entry.scenario, horizonModel: 'terrain', coordinateFrame: 'MOON_ME_DE421', site: { ...entry.scenario.site, surfaceElevationM: -123 } },
    sky: { ...entry.sky, quality: { ...entry.sky.quality, frame: 'ME_DE421_LOCAL_NORTH_EAST', model: 'MOON_ME_DE421', kernelSha256: { 'de421.bsp': 'abc123' } } },
    horizon: { ...entry.horizon, provenance: { sha256: 'verified-dem-hash', product: 'LDEM_4_FLOAT' } }
  })) };
  (analyzeScenarios as jest.Mock).mockResolvedValue(terrain);
  fireEvent.click(await ready());
  expect(await screen.findByText(/Horizon: registered DEM terrain/)).toHaveTextContent('ME_DE421_LOCAL_NORTH_EAST');
  const metadata = screen.getByText(/"skyQuality":/);
  expect(metadata).toHaveTextContent('verified-dem-hash');
  expect(metadata).toHaveTextContent('abc123');
  expect(metadata).toHaveTextContent('LDEM_4_FLOAT');
  expect(screen.getByText(/Surface elevation \(API result\):/)).toHaveTextContent('-123 m');
});

test('keeps four-scenario mixed-model comparison working', async () => {
  const run = await ready();
  const catalog = screen.getByLabelText('Add catalog location');
  [2, 3].forEach(i => fireEvent.change(catalog, { target: { value: fixture.catalog.sites[i].id } }));
  fireEvent.change(screen.getAllByLabelText('Horizon model')[1], { target: { value: 'terrain' } });
  fireEvent.click(screen.getByLabelText(/I declare these coordinates/));
  fireEvent.click(run);
  await screen.findByText('Sun fraction');
  const scenarios = (analyzeScenarios as jest.Mock).mock.calls[0][0];
  expect(scenarios).toHaveLength(4);
  expect(scenarios.map((s: { horizonModel: string }) => s.horizonModel)).toEqual(['flat', 'terrain', 'flat', 'flat']);
  expect(catalog).toBeDisabled();
});

test('shows API coverage error without substitute result', async () => {
  (analyzeScenarios as jest.Mock).mockRejectedValue(new Error('outside bundled coverage'));
  fireEvent.click(await ready());
  expect(await screen.findByRole('alert')).toHaveTextContent(/coverage/);
  expect(screen.queryByText('Sun fraction')).not.toBeInTheDocument();
});

test('editing scenario dates invalidates results and CSV', async () => {
  fireEvent.click(await ready());
  await screen.findByText('Sun fraction');
  fireEvent.change(screen.getAllByLabelText('End (UTC)')[0], { target: { value: '2026-01-01T12:00' } });
  expect(screen.queryByText('Sun fraction')).not.toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Export CSV' })).toBeDisabled();
});

test('failed recalculation never leaves previous export available', async () => {
  const run = await ready();
  fireEvent.click(run);
  await screen.findByText('Sun fraction');
  (analyzeScenarios as jest.Mock).mockRejectedValueOnce(new Error('coverage failure'));
  fireEvent.click(run);
  await screen.findByRole('alert');
  expect(screen.getByRole('button', { name: 'Export CSV' })).toBeDisabled();
  expect(screen.queryByText('Sun fraction')).not.toBeInTheDocument();
});

test('response for edited inputs cannot restore stale results', async () => {
  let resolveRequest: (value: typeof fixture.result) => void = () => {};
  (analyzeScenarios as jest.Mock).mockImplementationOnce(() => new Promise(resolve => { resolveRequest = resolve; }));
  fireEvent.click(await ready());
  fireEvent.change(screen.getAllByLabelText('End (UTC)')[0], { target: { value: '2026-01-01T12:00' } });
  resolveRequest(fixture.result);
  await waitFor(() => expect(screen.getByRole('button', { name: 'Run comparison' })).toBeEnabled());
  expect(screen.queryByText('Sun fraction')).not.toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Export CSV' })).toBeDisabled();
});

test('rejects blank custom coordinates instead of treating them as zero', async () => {
  await ready();
  fireEvent.click(screen.getByRole('button', { name: 'Add custom site' }));
  expect(await screen.findByRole('alert')).toHaveTextContent(/finite latitude/);
});
