import axios from 'axios';
import { CompareResponse, PresetSite, SiteEphemeris, SiteRequest } from '../types';

import { API_BASE } from './config';

const api = axios.create({
  baseURL: API_BASE,
  timeout: 30000,
});

export interface DsnWindowsRequest {
  start_utc: string;
  end_utc: string;
  step_seconds: number;
  elevation_mask_deg: number;
}

export interface DsnWindowsResponse {
  times_utc: string[];
  step_seconds: number;
  elevation_mask_deg: number;
  earth_moon_km: number[];
  stations: Array<{ name: string; lat: number; lon: number; height_m: number; moon_elevation_deg: number[]; above_mask: boolean[]; sampled_windows: Array<{ start_index: number; end_index: number; start_utc: string; end_utc: string }> }>;
  provenance: { ephemeris: string; dsn_sha256: string; earth_distance_sha256: string; dsn_coverage: { start_utc: string; end_utc: string }; distance_coverage: { start_utc: string; end_utc: string }; interpolated: boolean; sampling: string; frame: string; limits: string };
}

export const fetchDsnWindows = async (request: DsnWindowsRequest, signal?: AbortSignal): Promise<DsnWindowsResponse> => {
  const response = await api.post<DsnWindowsResponse>('/science/dsn/windows', request, { signal });
  return response.data;
};

export interface HorizonProfile {
  site_id: string;
  azimuths_deg: number[];
  elevations_deg: number[];
  source: string;
  observer_height_m: number;
}

export const fetchHorizon = async (id: string): Promise<HorizonProfile> => {
  const response = await api.get<HorizonProfile>(`/terrain/${encodeURIComponent(id)}`);
  return response.data;
};

export const getPresetSites = async (): Promise<PresetSite[]> => {
  const res = await api.get<PresetSite[]>('/presets');
  return res.data;
};

export const fetchEphemerisMulti = async (
  sites: SiteRequest[],
  startDate: string,
  endDate: string,
  stepHours: number = 2
): Promise<CompareResponse> => {
  const res = await api.post<CompareResponse>('/ephemeris', {
    sites,
    start_date: startDate,
    end_date: endDate,
    step_hours: stepHours,
  });
  return res.data;
};

export const fetchSingleSite = async (
  lat: number,
  lon: number,
  name: string,
  startDate: string,
  endDate: string,
  stepHours: number = 2
): Promise<SiteEphemeris> => {
  const res = await api.get<SiteEphemeris>('/ephemeris/single', {
    params: {
      lat,
      lon,
      name,
      start_date: startDate,
      end_date: endDate,
      step_hours: stepHours,
    },
  });
  return res.data;
};
