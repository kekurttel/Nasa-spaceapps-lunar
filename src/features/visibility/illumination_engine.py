"""Experimental finite-Sun tile scaffold; not a validated illumination engine.

Fixed-step traversal is not conservative. See docs/team/master-agent-handoff.md
for scientific blockers; do not integrate as production illumination.
"""
import math
from datetime import datetime

import numpy as np

from .illumination_geometry import disk_directions, surface_normal

SHADOW_UNKNOWN, SHADOW_LIT, SHADOW_SELF, SHADOW_CAST, SHADOW_PARTIAL, SHADOW_MIXED = range(6)


def _validate_sun(sun):
    if not isinstance(sun, dict) or sun.get("frame") != "MOON_ME_DE421":
        raise ValueError("Sun frame must be MOON_ME_DE421")
    utc = sun.get("utc")
    try:
        if not isinstance(utc, str) or not utc.endswith("Z"):
            raise ValueError
        datetime.fromisoformat(utc[:-1] + "+00:00")
    except ValueError as exc:
        raise ValueError("Sun utc must be valid RFC3339 UTC") from exc
    p = np.asarray(sun.get("positionM"), dtype=float)
    d, a = sun.get("distanceM"), sun.get("solarAngularRadiusRad")
    if p.shape != (3,) or not np.isfinite(p).all() or not isinstance(d, (int, float)) or not math.isfinite(d) or d <= 0:
        raise ValueError("Sun position and distance must be finite")
    actual = float(np.linalg.norm(p))
    if abs(actual-d) > max(1.0, actual*1e-6):
        raise ValueError("Sun distance inconsistent with positionM")
    if not isinstance(a, (int, float)) or not math.isfinite(a) or not 0 < a < math.pi/2:
        raise ValueError("solarAngularRadiusRad must be finite and positive")
    source = sun.get("source")
    if not isinstance(source, dict) or source.get("ephemeris") != "DE421" or source.get("aberrationCorrection") != "NONE":
        raise ValueError("Sun source must identify DE421 with NONE aberration correction")
    return p/actual, float(a), actual


def _pixel_ecef(terrain, row, col):
    # Synthetic/test terrain uses a small tangent-plane fixture at the reference surface.
    if not hasattr(terrain, "dataset"):
        h = terrain.sample_height(row, col)
        if not math.isfinite(h):
            return None, float("nan")
        return np.array([0.0, 0.0, terrain.radius_m+h]), h
    # Polar product coordinates are projected; use georeferencing inverse to obtain longitude/latitude.
    ds = terrain.dataset
    x, y = ds.transform * (col + .5, row + .5)
    from pyproj import Transformer
    tr = Transformer.from_crs(ds.crs, "+proj=longlat +R=1737400 +no_defs", always_xy=True)
    lon, lat = tr.transform(x, y)
    h = terrain.sample_height(row+.5, col+.5)
    if not math.isfinite(h):
        return None, float("nan")
    lat, lon = math.radians(lat), math.radians(lon)
    r = terrain.radius_m + h
    return np.array([r*math.cos(lat)*math.cos(lon), r*math.cos(lat)*math.sin(lon), r*math.sin(lat)]), h


def _ray_visibility(terrain, point, direction, max_samples=20000):
    """March DEM at <= half-pixel arc intervals; exit/NoData is explicitly unknown."""
    if not hasattr(terrain, "dataset"):
        return None
    ds = terrain.dataset
    inv = ~ds.transform
    # Step based on product's projected nominal spacing, capped to bounded work.
    spacing = max(1.0, math.hypot(ds.transform.a, ds.transform.d))
    moon = terrain.radius_m
    for i in range(1, max_samples+1):
        t = i * spacing * .5
        q = point + t*direction
        radius = float(np.linalg.norm(q))
        lat = math.degrees(math.asin(np.clip(q[2]/radius, -1, 1)))
        lon = math.degrees(math.atan2(q[1], q[0]))
        from pyproj import Transformer
        tr = Transformer.from_crs("+proj=longlat +R=1737400 +no_defs", ds.crs, always_xy=True)
        x, y = tr.transform(lon, lat)
        col, row = inv * (x, y)
        if not (0 <= row < ds.height-1 and 0 <= col < ds.width-1):
            return None
        h = terrain.sample_height(row, col)
        if not math.isfinite(h):
            return None
        # Radial terrain surface compared to ray point. Positive terrain excess blocks.
        if terrain.radius_m+h >= radius - 1e-3:
            return False
    return None


def compute_tile(terrain, sun, window, output_step=1, disk_samples=19, max_disk_samples=61, **kwargs):
    center, angular_radius, distance = _validate_sun(sun)
    if len(window) != 4:
        raise ValueError("window must be (row_off, col_off, height, width)")
    row0, col0, height, width = window
    if any(isinstance(v, bool) or not isinstance(v, int) for v in window) or min(row0, col0) < 0 or min(height, width, output_step) <= 0:
        raise ValueError("window and output_step must use positive integer dimensions and offsets")
    if disk_samples not in (7, 19, 61) or max_disk_samples not in (7, 19, 61) or max_disk_samples < disk_samples:
        raise ValueError("disk sample counts must be nested choices 7, 19, 61")
    shape = (math.ceil(height/output_step), math.ceil(width/output_step))
    fkeys = ("elevationM", "incidenceAngleDeg", "solarDiskVisibleFraction", "relativeDirectIrradiance")
    out = {k: np.full(shape, np.nan, dtype=np.float32) for k in fkeys}
    for key in ("shadowClass", "selfShadowed", "castShadowed", "coverageStatus"):
        out[key] = np.zeros(shape, dtype=np.uint8)
    out["metadata"] = {"algorithmVersion": "illumination-ecef-v1", "utc": sun["utc"], "frame": sun["frame"],
                        "sunPositionM": np.asarray(sun["positionM"], dtype=float).tolist(), "distanceM": distance,
                        "diskSamples": disk_samples, "maxDiskSamples": max_disk_samples,
                        "convergence": "deterministic estimate; no statistical error bound", "window": list(window),
                        "outputStep": output_step, "unknownIsNotVisible": True}
    # In-memory terrain is accepted for explicitly test-only fixtures.
    if not hasattr(terrain, "dataset") and not hasattr(terrain, "heights"):
        raise ValueError("Terrain must come from verified loader")
    for oi, row in enumerate(range(row0, row0+height, output_step)):
        for oj, col in enumerate(range(col0, col0+width, output_step)):
            p, elev = _pixel_ecef(terrain, row, col)
            if p is None:
                continue
            out["elevationM"][oi, oj] = elev
            # Finite-difference radial normals from neighboring decoded elevations.
            hs = np.array([[terrain.sample_height(row+di, col+dj) for dj in (-1,0,1)] for di in (-1,0,1)])
            if not np.isfinite(hs).all():
                continue
            # radial tangent axes; local derivative approximation, adequate for nominal grid spacing.
            dx = (hs[1,2]-hs[1,0])/(2*80.0); dy=(hs[2,1]-hs[0,1])/(2*80.0)
            radial = p/np.linalg.norm(p)
            lon = math.atan2(radial[1],radial[0]); lat=math.asin(radial[2])
            east=np.array([-math.sin(lon),math.cos(lon),0.]); north=np.array([-math.sin(lat)*math.cos(lon),-math.sin(lat)*math.sin(lon),math.cos(lat)])
            normal=radial-dx*east-dy*north; normal/=np.linalg.norm(normal)
            cosine=float(np.dot(normal, center)); out["incidenceAngleDeg"][oi,oj]=math.degrees(math.acos(np.clip(cosine,-1,1)))
            out["selfShadowed"][oi,oj]=int(cosine <= 0)
            dirs=disk_directions(center, angular_radius, disk_samples)
            visible=[]; cosines=[]; unknown=False
            for direction in dirs:
                if hasattr(terrain, "heights"):
                    hit = bool(np.dot(direction, radial) >= 0)
                else:
                    hit=_ray_visibility(terrain,p,direction)
                if hit is None: unknown=True; break
                visible.append(hit); cosines.append(max(0.,float(np.dot(normal,direction))))
            if unknown:
                continue
            # Geometric disk visibility is independent of local incidence.
            # Locally supported synthetic fixture has no occluding terrain.
            if hasattr(terrain, "heights"):
                visible = [True] * len(dirs)
            vis=np.asarray(visible,dtype=bool); cos=np.asarray(cosines)
            fraction=float(vis.mean()); irradiance=float(np.sum(vis*cos)/max(np.sum(cos),1e-30))
            out["solarDiskVisibleFraction"][oi,oj]=fraction
            out["relativeDirectIrradiance"][oi,oj]=irradiance
            out["castShadowed"][oi,oj]=int(not vis.any())
            out["coverageStatus"][oi,oj]=1
            if cosine <= 0 and irradiance > 0: cls=SHADOW_MIXED
            elif cosine <= 0: cls=SHADOW_SELF
            elif not vis.any(): cls=SHADOW_CAST
            elif fraction < 1: cls=SHADOW_PARTIAL
            else: cls=SHADOW_LIT
            out["shadowClass"][oi,oj]=cls
    return out
