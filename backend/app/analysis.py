from typing import List, Dict, Any
from app.models import SiteSummary, EphemerisPoint

def calculate_site_summary(points: List[EphemerisPoint], step_hours: int = 1) -> SiteSummary:
    """
    Computes critical lunar mission parameters from ephemeris time-series:
    - Total illuminated vs dark hours
    - Earth line-of-sight communication windows
    - Maximum continuous blackout (darkness) duration (crucial for battery sizing)
    - Maximum communication blackout duration
    - Average elevation angles when visible
    """
    if not points:
        return SiteSummary(
            total_hours=0.0,
            sun_hours=0.0,
            dark_hours=0.0,
            earth_visible_hours=0.0,
            no_earth_hours=0.0,
            sun_percentage=0.0,
            earth_percentage=0.0,
            max_continuous_sun_hours=0.0,
            max_continuous_dark_hours=0.0,
            max_continuous_comm_hours=0.0,
            max_continuous_no_comm_hours=0.0,
            avg_sun_elevation_when_visible=0.0,
            avg_earth_elevation_when_visible=0.0,
        )

    # Samples represent left-held intervals; final endpoint has zero duration.
    durations = [max(0.0, (points[i + 1].timestamp - pt.timestamp) / 3600.0)
                 if i + 1 < len(points) else 0.0 for i, pt in enumerate(points)]
    total_hours = sum(durations)
    sun_count = 0
    earth_count = 0
    
    sun_elevations_visible = []
    earth_elevations_visible = []

    # Streak calculations
    curr_sun_streak = 0
    max_sun_streak = 0
    curr_dark_streak = 0
    max_dark_streak = 0

    curr_comm_streak = 0
    max_comm_streak = 0
    curr_no_comm_streak = 0
    max_no_comm_streak = 0

    for pt, duration in zip(points, durations):
        # Sunlight evaluation
        if pt.sun_visible:
            sun_count += 1
            sun_elevations_visible.append(pt.sun_elevation)
            curr_sun_streak += duration
            if curr_sun_streak > max_sun_streak:
                max_sun_streak = curr_sun_streak
            curr_dark_streak = 0
        else:
            curr_dark_streak += duration
            if curr_dark_streak > max_dark_streak:
                max_dark_streak = curr_dark_streak
            curr_sun_streak = 0

        # Earth communication evaluation
        if pt.earth_visible:
            earth_count += 1
            earth_elevations_visible.append(pt.earth_elevation)
            curr_comm_streak += duration
            if curr_comm_streak > max_comm_streak:
                max_comm_streak = curr_comm_streak
            curr_no_comm_streak = 0
        else:
            curr_no_comm_streak += duration
            if curr_no_comm_streak > max_no_comm_streak:
                max_no_comm_streak = curr_no_comm_streak
            curr_comm_streak = 0

    sun_hours = sum(d for pt, d in zip(points, durations) if pt.sun_visible)
    dark_hours = total_hours - sun_hours
    earth_hours = sum(d for pt, d in zip(points, durations) if pt.earth_visible)
    no_earth_hours = total_hours - earth_hours

    sun_pct = round((sun_hours / total_hours) * 100.0, 1) if total_hours > 0 else 0.0
    earth_pct = round((earth_hours / total_hours) * 100.0, 1) if total_hours > 0 else 0.0

    avg_sun_el = round(sum(sun_elevations_visible) / len(sun_elevations_visible), 2) if sun_elevations_visible else 0.0
    avg_earth_el = round(sum(earth_elevations_visible) / len(earth_elevations_visible), 2) if earth_elevations_visible else 0.0

    return SiteSummary(
        total_hours=float(total_hours),
        sun_hours=float(sun_hours),
        dark_hours=float(dark_hours),
        earth_visible_hours=float(earth_hours),
        no_earth_hours=float(no_earth_hours),
        sun_percentage=sun_pct,
        earth_percentage=earth_pct,
        max_continuous_sun_hours=float(max_sun_streak),
        max_continuous_dark_hours=float(max_dark_streak),
        max_continuous_comm_hours=float(max_comm_streak),
        max_continuous_no_comm_hours=float(max_no_comm_streak),
        avg_sun_elevation_when_visible=avg_sun_el,
        avg_earth_elevation_when_visible=avg_earth_el,
    )
