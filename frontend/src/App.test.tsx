import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import App from './App';
import { getPresetSites, fetchEphemerisMulti } from './services/api';
jest.mock('./components/MoonMap', () => ({ MoonMap: () => <div aria-label="Moon site map" /> }));
jest.mock('./components/HorizonChart', () => ({ HorizonChart: () => <div>Local horizon chart</div> }));
jest.mock('./components/TimelineBar', () => ({ TimelineBar: () => <div>Mission windows timeline</div> }));
jest.mock('./components/ComparePanel', () => ({ ComparePanel: () => <div>Site comparison</div> }));
jest.mock('./services/api', () => ({ getPresetSites: jest.fn(), fetchEphemerisMulti: jest.fn() }));
beforeEach(() => {
  (getPresetSites as jest.Mock).mockResolvedValue([]);
  (fetchEphemerisMulti as jest.Mock).mockResolvedValue({ sites: [], source: 'Test service' });
});
test('renders mission controls and honest result status', async () => {
  render(<App />);
  expect(screen.getByRole('heading', { name: 'Lunar site assessment' })).toBeInTheDocument();
  expect(screen.getByLabelText('Mission start date UTC')).toBeInTheDocument();
  await waitFor(() => expect(screen.getByText('Results available')).toBeInTheDocument());
  expect(screen.getByText('Test service')).toBeInTheDocument();
});
test('shows service failure without substitute results', async () => {
  (fetchEphemerisMulti as jest.Mock).mockRejectedValue(new Error('offline'));
  render(<App />);
  expect(await screen.findByRole('alert')).toHaveTextContent('No substitute data is shown');
  expect(screen.getByRole('button', { name: 'Export JSON' })).toBeDisabled();
});
