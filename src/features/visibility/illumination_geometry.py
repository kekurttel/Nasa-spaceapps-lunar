"""Spherical ECEF geometry and deterministic finite-Sun disk sampling."""
import math

import numpy as np


def ecef_position(latitude_deg, longitude_deg, elevation_m, radius_m):
    lat, lon = math.radians(latitude_deg), math.radians(longitude_deg)
    r = radius_m + elevation_m
    return np.array([r * math.cos(lat) * math.cos(lon), r * math.cos(lat) * math.sin(lon), r * math.sin(lat)])


def surface_normal(heights, row, col, spacing_m, radius_m):
    h = np.asarray(heights, dtype=float)
    if row < 1 or col < 1 or row >= h.shape[0] - 1 or col >= h.shape[1] - 1:
        raise ValueError("normal requires neighboring terrain samples")
    if not np.isfinite(h[row-1:row+2, col-1:col+2]).all():
        raise ValueError("normal intersects unknown terrain")
    # Local east/north finite differences, mapped to the local radial tangent frame.
    east = np.array([0., 1., 0.])
    north = np.array([0., 0., 1.])
    dx = (h[row, col+1] - h[row, col-1]) / (2 * spacing_m)
    dy = (h[row+1, col] - h[row-1, col]) / (2 * spacing_m)
    return np.array([-dx, -dy, 1.0]) / math.sqrt(dx*dx + dy*dy + 1)


def disk_directions(center, angular_radius_rad, count):
    center = np.asarray(center, dtype=float)
    center /= np.linalg.norm(center)
    if count not in (7, 19, 61) or not math.isfinite(angular_radius_rad) or angular_radius_rad <= 0:
        raise ValueError("disk sample count must be 7, 19, or 61; radius must be positive")
    ref = np.array([0., 0., 1.]) if abs(center[2]) < .9 else np.array([0., 1., 0.])
    u = np.cross(ref, center); u /= np.linalg.norm(u)
    v = np.cross(center, u)
    # Nested golden-angle disk points; first sample is the disk center.
    out = [center]
    for i in range(1, count):
        r = angular_radius_rad * math.sqrt((i - .5) / (count - .5))
        a = i * math.pi * (3 - math.sqrt(5))
        tangent = r * (math.cos(a) * u + math.sin(a) * v)
        out.append(math.cos(r) * center + math.sin(r) / r * tangent if r else center)
    out = np.asarray(out)
    return out / np.linalg.norm(out, axis=1)[:, None]
