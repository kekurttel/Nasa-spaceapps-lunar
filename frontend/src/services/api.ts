import axios from 'axios';
import { CompareResponse, PresetSite, SiteEphemeris, SiteRequest } from '../types';

import { API_BASE } from './config';

const api = axios.create({
  baseURL: API_BASE,
  timeout: 30000,
});

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
