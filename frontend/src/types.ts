export interface SiteRequest {
  name?: string;
  lat: number;
  lon: number;
}

export interface EphemerisPoint {
  datetime: string;
  timestamp: number;
  sun_elevation: number;
  sun_azimuth: number;
  earth_elevation: number;
  earth_azimuth: number;
  sun_visible: boolean;
  earth_visible: boolean;
  solar_flux_pct: number;
}

export interface SiteSummary {
  total_hours: number;
  sun_hours: number;
  dark_hours: number;
  earth_visible_hours: number;
  no_earth_hours: number;
  sun_percentage: number;
  earth_percentage: number;
  max_continuous_sun_hours: number;
  max_continuous_dark_hours: number;
  max_continuous_comm_hours: number;
  max_continuous_no_comm_hours: number;
  avg_sun_elevation_when_visible: number;
  avg_earth_elevation_when_visible: number;
}

export interface SiteEphemeris {
  site: SiteRequest;
  data: EphemerisPoint[];
  summary: SiteSummary;
}

export interface CompareResponse {
  sites: SiteEphemeris[];
  query_start: string;
  query_end: string;
  step_hours: number;
  source: string;
}

export interface PresetSite {
  id: string;
  name: string;
  lat: number;
  lon: number;
  description: string;
  feature_type: string;
  elevation_m?: number;
}
