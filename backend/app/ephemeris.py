"""Strict local reference ephemeris facade. No network/geometric fallback."""
from app.reference_data import reference_ephemeris, utc_datetime


def get_ephemeris_data(lat, lon, start_str, stop_str, step_hours=2):
    start, end = utc_datetime(start_str), utc_datetime(stop_str)
    if end <= start or not 0.25 <= step_hours <= 24:
        raise ValueError("Require end after start and step_hours between 0.25 and 24")
    result = reference_ephemeris(lat, lon, start, end, step_hours)
    if result is None:
        raise ValueError("Unsupported coordinates/date range; no geometric fallback")
    points, metadata = result
    return points, metadata['engine'] + ('_INTERPOLATED' if metadata['interpolated'] else '')
