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

test('shows API coverage error without substitute result', async () => {
  (analyzeScenarios as jest.Mock).mockRejectedValue(new Error('outside bundled coverage'));
  fireEvent.click(await ready());
  expect(await screen.findByRole('alert')).toHaveTextContent(/coverage/);
  expect(screen.queryByText('Sun fraction')).not.toBeInTheDocument();
});

test('rejects blank custom coordinates instead of treating them as zero', async () => {
  await ready();
  fireEvent.click(screen.getByRole('button', { name: 'Add custom site' }));
  expect(await screen.findByRole('alert')).toHaveTextContent(/finite latitude/);
});
