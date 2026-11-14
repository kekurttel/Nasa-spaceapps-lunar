from pydantic import BaseModel, Field
from typing import List, Optional

class SiteRequest(BaseModel):
    name: Optional[str] = "Selected Site"
    lat: float = Field(..., ge=-90.0, le=90.0, description="Latitude in degrees (-90 to 90)")
    lon: float = Field(..., ge=-180.0, le=360.0, description="Longitude in degrees")

class EphemerisRequest(BaseModel):
    sites: List[SiteRequest]
    start_date: str = Field(..., description="Start date/time in ISO or YYYY-MM-DD format")
    end_date: str = Field(..., description="End date/time in ISO or YYYY-MM-DD format")
    step_hours: float = Field(default=2, ge=0.25, le=24, description="Step hours; sub-hour local reference values are interpolated")

class EphemerisPoint(BaseModel):
    datetime: str
    timestamp: float
    sun_elevation: float
    sun_azimuth: float
    earth_elevation: float
    earth_azimuth: float
    sun_visible: bool
    earth_visible: bool
    solar_flux_pct: float  # Engine-specific; reference engine uses visible disk percent
    sun_visible_fraction: Optional[float] = None
    sun_horizon: Optional[float] = None
    earth_horizon: Optional[float] = None

class SiteSummary(BaseModel):
    total_hours: float
    sun_hours: float
    dark_hours: float
    earth_visible_hours: float
    no_earth_hours: float
    sun_percentage: float
    earth_percentage: float
    max_continuous_sun_hours: float
    max_continuous_dark_hours: float
    max_continuous_comm_hours: float
    max_continuous_no_comm_hours: float
    avg_sun_elevation_when_visible: float
    avg_earth_elevation_when_visible: float

class SiteEphemeris(BaseModel):
    site: SiteRequest
    data: List[EphemerisPoint]
    summary: SiteSummary
    provenance: Optional[dict] = None

class CompareResponse(BaseModel):
    sites: List[SiteEphemeris]
    query_start: str
    query_end: str
    step_hours: float
    source: str  # 'JPL_HORIZONS' or 'ORBITAL_FALLBACK'

class PresetSite(BaseModel):
    id: str
    name: str
    lat: float
    lon: float
    description: str
    feature_type: str
    elevation_m: Optional[float] = None
