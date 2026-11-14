import React from 'react';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import SciencePanel from './SciencePanel';
import { DsnWindowsResponse, fetchDsnWindows } from '../services/api';
import { EphemerisPoint } from '../types';

jest.mock('../services/api', () => ({ fetchDsnWindows: jest.fn() }));

const mockWindows = fetchDsnWindows as jest.MockedFunction<typeof fetchDsnWindows>;
const originalFetch = global.fetch;
const site = { name: 'Test site', lat: -89, lon: 30 };
const moment: EphemerisPoint = {
  datetime: '2025-01-01T12:00:00', timestamp: 0,
  sun_elevation: 0, sun_azimuth: 0, earth_elevation: 0, earth_azimuth: 0,
  sun_visible: false, earth_visible: false, solar_flux_pct: 0,
};
const response: DsnWindowsResponse = {
  times_utc: ['2025-01-01T00:00:00.000Z', '2025-01-01T01:00:00.000Z'],
  step_seconds: 3600, elevation_mask_deg: 12.5, earth_moon_km: [384000, 384001],
  stations: [
    { name: 'Goldstone', lat: 35, lon: -116, height_m: 1000, moon_elevation_deg: [15, 16], above_mask: [true, true], sampled_windows: [{ start_index: 0, end_index: 1, start_utc: '2025-01-01T00:00:00.000Z', end_utc: '2025-01-01T01:00:00.000Z' }] },
    { name: 'Madrid', lat: 40, lon: -4, height_m: 700, moon_elevation_deg: [0, 1], above_mask: [false, false], sampled_windows: [] },
  ],
  provenance: { ephemeris: 'fixture', dsn_sha256: 'dsn-hash', earth_distance_sha256: 'distance-hash', dsn_coverage: { start_utc: '2025-01-01', end_utc: '2025-01-02' }, distance_coverage: { start_utc: '2025-01-01', end_utc: '2025-01-02' }, interpolated: false, sampling: 'hourly', frame: 'geocentric', limits: 'sampled geometry only' },
};

beforeEach(() => {
  jest.resetAllMocks();
  global.fetch = jest.fn().mockResolvedValue({ ok: true, json: async () => ({ source: 'single-time fixture' }) });
});
afterEach(() => { global.fetch = originalFetch; });

function fillInterval() {
  fireEvent.change(screen.getByLabelText('Start (UTC)'), { target: { value: '2025-01-01T00:00' } });
  fireEvent.change(screen.getByLabelText('End (UTC)'), { target: { value: '2025-01-01T01:00' } });
  fireEvent.change(screen.getByLabelText('Elevation mask (°)'), { target: { value: '12.5' } });
}

test('requests windows only on action, shows loading, sampled results and limitations while preserving single-time geometry', async () => {
  let resolve!: (value: DsnWindowsResponse) => void;
  mockWindows.mockReturnValue(new Promise<DsnWindowsResponse>(r => { resolve = r; }));
  render(<SciencePanel site={site} moment={moment} language="en" />);
  expect(mockWindows).not.toHaveBeenCalled();
  expect(screen.getByText(/Moon-centre geometry is sampled/)).toHaveTextContent('not exact crossing times');
  expect(screen.getByText(/This query samples one UTC instant/)).toBeInTheDocument();
  await waitFor(() => expect(global.fetch).toHaveBeenCalledWith(expect.stringContaining('/science/dsn?datetime=2025-01-01T12%3A00%3A00.000Z'), expect.any(Object)));
  fillInterval();
  expect(mockWindows).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole('button', { name: 'Get windows' }));
  expect(mockWindows).toHaveBeenCalledWith({ start_utc: '2025-01-01T00:00:00.000Z', end_utc: '2025-01-01T01:00:00.000Z', step_seconds: 3600, elevation_mask_deg: 12.5 });
  expect(screen.getByText('Loading…')).toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Get windows' })).toBeDisabled();
  await act(async () => resolve(response));
  expect(screen.getByText('2 samples · 3600 s · 12.5°')).toBeInTheDocument();
  expect(screen.getByText(/samples 0–1/)).toHaveTextContent('2025-01-01T00:00:00.000Z');
  expect(screen.getByText('No samples at or above mask.')).toBeInTheDocument();
  expect(screen.getByText('sampled geometry only')).toBeInTheDocument();
  expect(screen.getByText(/Selected sample \(UTC\):/)).toHaveTextContent('2025-01-01T12:00:00.000Z');
});

test('rejects invalid interval without calling service, then recovers from failure on retry', async () => {
  mockWindows.mockRejectedValueOnce(new Error('unavailable')).mockResolvedValueOnce(response);
  render(<SciencePanel site={site} language="en" />);
  fillInterval();
  fireEvent.change(screen.getByLabelText('End (UTC)'), { target: { value: '2024-12-31T23:00' } });
  fireEvent.click(screen.getByRole('button', { name: 'Get windows' }));
  expect(screen.getByRole('alert')).toHaveTextContent('Enter a valid interval');
  expect(mockWindows).not.toHaveBeenCalled();
  fillInterval();
  fireEvent.click(screen.getByRole('button', { name: 'Get windows' }));
  expect(await screen.findByRole('alert')).toHaveTextContent('Request failed');
  expect(screen.getByRole('button', { name: 'Get windows' })).toBeEnabled();
  fireEvent.click(screen.getByRole('button', { name: 'Get windows' }));
  expect(await screen.findByText('2 samples · 3600 s · 12.5°')).toBeInTheDocument();
  expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  expect(mockWindows).toHaveBeenCalledTimes(2);
});
