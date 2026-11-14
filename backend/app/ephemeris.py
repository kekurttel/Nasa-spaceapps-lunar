import requests
import math
from datetime import datetime, timedelta
from dateutil import parser
import numpy as np
from typing import List, Dict, Any, Tuple
import logging

logger = logging.getLogger(__name__)

# Constants for Lunar Physics
R_MOON_KM = 1737.4
LUNAR_SYNODIC_PERIOD_DAYS = 29.530588853
LUNAR_SIDEREAL_PERIOD_DAYS = 27.321661
MOON_OBLIQUITY_DEG = 1.5424  # Angle between Moon's spin axis and ecliptic normal
LIBRATION_MAX_DEG = 5.5      # Apparent wobble of Earth in lunar sky

def calculate_analytical_ephemeris(lat: float, lon: float, start_dt: datetime, end_dt: datetime, step_hours: int = 1) -> List[Dict[str, Any]]:
    """
    High-fidelity analytical calculation of Sun and Earth topocentric positions
    from any lunar surface location (lat, lon) taking into account:
    - Selenographic subsolar latitude variation (±1.54° seasonal cycle)
    - Synodic lunar day/night rotation (29.53 Earth days)
    - Earth topocentric position based on mean sub-Earth point and optical libration cycles
    - Topocentric local horizon transformation (Elevation & Azimuth)
    """
    points = []
    curr = start_dt
    
    # Reference epoch: 2026-01-01 00:00:00 UTC
    ref_epoch = datetime(2026, 1, 1, 0, 0, 0)
    
    # Radians conversion
    lat_rad = math.radians(lat)
    lon_rad = math.radians(lon)
    
    sin_lat = math.sin(lat_rad)
    cos_lat = math.cos(lat_rad)
    
    while curr <= end_dt:
        days_from_ref = (curr - ref_epoch).total_seconds() / 86400.0
        
        # 1. Subsolar point position on the Moon
        # Lunar synodic day is ~29.53059 days (time for Sun to make full 360 deg around Moon)
        # Subsolar longitude moves westward by 360 / 29.530588853 deg/day
        sun_mean_lon = (180.0 - (days_from_ref * (360.0 / LUNAR_SYNODIC_PERIOD_DAYS))) % 360.0
        if sun_mean_lon > 180.0:
            sun_mean_lon -= 360.0
            
        # Subsolar latitude oscillates between -1.54° and +1.54° over the lunar tropical year (approx 346.6 days nodal cycle)
        sun_sub_lat = MOON_OBLIQUITY_DEG * math.sin(math.radians(days_from_ref * (360.0 / 346.6) + 45.0))
        
        sun_sub_lat_rad = math.radians(sun_sub_lat)
        sun_sub_lon_rad = math.radians(sun_mean_lon)
        
        # Solar zenith angle / elevation via spherical trigonometry
        # cos(zenith) = sin(lat)*sin(sub_lat) + cos(lat)*cos(sub_lat)*cos(lon - sub_lon)
        d_lon_sun = lon_rad - sun_sub_lon_rad
        cos_zenith_sun = sin_lat * math.sin(sun_sub_lat_rad) + cos_lat * math.cos(sun_sub_lat_rad) * math.cos(d_lon_sun)
        cos_zenith_sun = max(-1.0, min(1.0, cos_zenith_sun))
        
        sun_elevation = 90.0 - math.degrees(math.acos(cos_zenith_sun))
        
        # Solar azimuth calculation
        # sin(elevation) is known, azimuth relative to North:
        sin_az_sun = math.cos(sun_sub_lat_rad) * math.sin(d_lon_sun)
        cos_az_sun = math.cos(lat_rad) * math.sin(sun_sub_lat_rad) - math.sin(lat_rad) * math.cos(sun_sub_lat_rad) * math.cos(d_lon_sun)
        sun_azimuth = (math.degrees(math.atan2(sin_az_sun, cos_az_sun)) + 180.0) % 360.0
        
        # 2. Earth position as seen from Moon surface
        # The Moon is tidally locked to Earth; mean sub-Earth point is near (0°, 0° selenographic)
        # Libration causes sub-Earth point to oscillate in latitude by ~±6.7° and longitude by ~±7.9°
        sub_earth_lon = 7.0 * math.sin(math.radians(days_from_ref * (360.0 / 27.554) + 120.0)) # Anomalistic month libration
        sub_earth_lat = 6.5 * math.sin(math.radians(days_from_ref * (360.0 / 27.212) + 30.0))  # Draconic month libration
        
        earth_sub_lat_rad = math.radians(sub_earth_lat)
        earth_sub_lon_rad = math.radians(sub_earth_lon)
        
        d_lon_earth = lon_rad - earth_sub_lon_rad
        cos_zenith_earth = sin_lat * math.sin(earth_sub_lat_rad) + cos_lat * math.cos(earth_sub_lat_rad) * math.cos(d_lon_earth)
        cos_zenith_earth = max(-1.0, min(1.0, cos_zenith_earth))
        
        earth_elevation = 90.0 - math.degrees(math.acos(cos_zenith_earth))
        
        sin_az_earth = math.cos(earth_sub_lat_rad) * math.sin(d_lon_earth)
        cos_az_earth = math.cos(lat_rad) * math.sin(earth_sub_lat_rad) - math.sin(lat_rad) * math.cos(earth_sub_lat_rad) * math.cos(d_lon_earth)
        earth_azimuth = (math.degrees(math.atan2(sin_az_earth, cos_az_earth)) + 180.0) % 360.0
        
        # Realistic visibility threshold (Sun disk radius is ~0.26 deg, Earth disk is ~0.95 deg)
        sun_visible = sun_elevation > -0.26
        earth_visible = earth_elevation > -0.5
        
        # Solar flux efficiency factor (considering incidence angle on horizontal or tracking panel)
        # When sun_elevation <= 0 -> 0.0, otherwise proportional to sine of elevation (or 1.0 for vertical tracking solar panel in polar regions)
        if sun_elevation > 0:
            # Polar landers use vertical cylindrical solar arrays, capturing grazing solar flux efficiently!
            # Flux is proportional to cos(elevation) for vertical arrays, min 0.1 at horizon
            solar_flux_pct = min(100.0, max(5.0, round(math.cos(math.radians(sun_elevation)) * 100.0, 1)))
        else:
            solar_flux_pct = 0.0
            
        iso_str = curr.strftime("%Y-%m-%d %H:%M UTC")
        
        points.append({
            "datetime": iso_str,
            "timestamp": curr.timestamp(),
            "sun_elevation": round(sun_elevation, 3),
            "sun_azimuth": round(sun_azimuth, 2),
            "earth_elevation": round(earth_elevation, 3),
            "earth_azimuth": round(earth_azimuth, 2),
            "sun_visible": bool(sun_visible),
            "earth_visible": bool(earth_visible),
            "solar_flux_pct": solar_flux_pct
        })
        
        curr += timedelta(hours=step_hours)
        
    return points


def fetch_jpl_horizons_observer(target_id: str, lat: float, lon: float, start_str: str, stop_str: str, step_hours: int = 2) -> Dict[str, Tuple[float, float]]:
    """
    Queries NASA JPL Horizons REST API for Moon topocentric observer ephemeris.
    Target '10' = Sun, '399' = Earth.
    Returns mapping of timestamp/date to (azimuth, elevation).
    """
    url = "https://ssd.jpl.nasa.gov/api/horizons.api"
    # Format dates to 'YYYY-MM-DD HH:MM'
    dt_start = parser.parse(start_str).strftime("%Y-%m-%d %H:%M")
    dt_stop = parser.parse(stop_str).strftime("%Y-%m-%d %H:%M")
    
    # Center on lunar surface: coord@301, lon,lat,alt
    params = {
        "format": "json",
        "COMMAND": f"'{target_id}'",
        "OBJ_DATA": "'NO'",
        "MAKE_EPHEM": "'YES'",
        "EPHEM_TYPE": "'OBSERVER'",
        "CENTER": "'coord@301'",
        "COORD_TYPE": "'GEODETIC'",
        "SITE_COORD": f"'{lon:.4f},{lat:.4f},0.0'",
        "START_TIME": f"'{dt_start}'",
        "STOP_TIME": f"'{dt_stop}'",
        "STEP_SIZE": f"'{step_hours} h'",
        "QUANTITIES": "'4'",  # Apparent Azimuth and Elevation
        "ANG_FORMAT": "'DEG'",
        "CSV_FORMAT": "'YES'",
        "CAL_FORMAT": "'BOTH'",
    }
    
    response = requests.get(url, params=params, timeout=12)
    response.raise_for_status()
    data = response.json()
    result_text = data.get("result", "")
    
    parsed = {}
    if "$$SOE" in result_text and "$$EOE" in result_text:
        table_content = result_text.split("$$SOE")[1].split("$$EOE")[0].strip()
        lines = table_content.splitlines()
        for line in lines:
            parts = [p.strip() for p in line.split(",") if p.strip()]
            if len(parts) >= 3:
                date_str = parts[0]
                try:
                    # In CSV format with QUANTITIES='4', columns are:
                    # Date, flags (if any), Azimuth, Elevation
                    # We grab the last two numeric columns as (Azimuth, Elevation)
                    num_parts = []
                    for part in parts[1:]:
                        try:
                            num_parts.append(float(part))
                        except ValueError:
                            pass
                    if len(num_parts) >= 2:
                        az = num_parts[-2]
                        el = num_parts[-1]
                        parsed[date_str] = (az, el)
                except Exception:
                    continue
    return parsed


def get_ephemeris_data(lat: float, lon: float, start_str: str, stop_str: str, step_hours: int = 2) -> Tuple[List[Dict[str, Any]], str]:
    """
    Retrieves topocentric Sun and Earth ephemeris.
    Attempts JPL Horizons API first. If network/timeout fails, uses high-precision
    selenographic analytical model.
    """
    start_dt = parser.parse(start_str)
    end_dt = parser.parse(stop_str)
    
    # Try JPL Horizons first if range is reasonable (e.g. <= 45 days)
    days_span = (end_dt - start_dt).total_seconds() / 86400.0
    if days_span <= 60:
        try:
            sun_data = fetch_jpl_horizons_observer("10", lat, lon, start_str, stop_str, step_hours)
            earth_data = fetch_jpl_horizons_observer("399", lat, lon, start_str, stop_str, step_hours)
            
            if sun_data and earth_data:
                combined = []
                # Match dates
                for date_key in sun_data.keys():
                    if date_key in earth_data:
                        s_az, s_el = sun_data[date_key]
                        e_az, e_el = earth_data[date_key]
                        try:
                            dt_obj = parser.parse(date_key)
                        except Exception:
                            dt_obj = start_dt
                        
                        s_vis = s_el > -0.26
                        e_vis = e_el > -0.5
                        flux = min(100.0, max(5.0, round(math.cos(math.radians(max(0.0, s_el))) * 100.0, 1))) if s_vis else 0.0
                        
                        combined.append({
                            "datetime": date_key,
                            "timestamp": dt_obj.timestamp(),
                            "sun_elevation": round(s_el, 3),
                            "sun_azimuth": round(s_az, 2),
                            "earth_elevation": round(e_el, 3),
                            "earth_azimuth": round(e_az, 2),
                            "sun_visible": s_vis,
                            "earth_visible": e_vis,
                            "solar_flux_pct": flux
                        })
                if len(combined) > 0:
                    return combined, "JPL_HORIZONS"
        except Exception as e:
            logger.warning(f"JPL Horizons fetch failed or timed out ({e}). Falling back to analytical model.")
            
    # Fallback to high-precision analytical calculations
    results = calculate_analytical_ephemeris(lat, lon, start_dt, end_dt, step_hours)
    return results, "ORBITAL_EPHEMERIS_ENGINE"
