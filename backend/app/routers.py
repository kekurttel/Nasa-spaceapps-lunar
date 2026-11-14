from math import ceil
from typing import List

from fastapi import APIRouter, HTTPException, Query
from app.models import EphemerisRequest, CompareResponse, SiteEphemeris, EphemerisPoint, PresetSite, SiteRequest
from app.reference_data import data_dir
from app.analysis import calculate_site_summary
from app.reference_data import catalog, status, reference_ephemeris, utc_datetime

router = APIRouter(prefix="/api", tags=["Lunar Ephemeris & Landing Sites"])


@router.get("/presets", response_model=List[PresetSite])
async def get_presets():
    """Reference coordinates, including explicitly labelled computed points."""
    return [PresetSite(**{k: v for k, v in site.items() if k != "profile"}) for site in catalog()]


@router.get("/data/status")
async def data_status():
    return status()


@router.get("/terrain/{site_id}")
async def terrain(site_id: str):
    site = next((site for site in catalog() if site["id"] == site_id), None)
    if site is None:
        raise HTTPException(404, "No local skyline for this site")
    return site["profile"]


def validate_window(start, end, step, site_count=1):
    try:
        first, last = utc_datetime(start), utc_datetime(end)
    except (ValueError, TypeError, OverflowError) as exc:
        raise HTTPException(422, "Dates must be ISO 8601") from exc
    hours = (last - first).total_seconds() / 3600
    if hours <= 0:
        raise HTTPException(422, "end_date must be after start_date")
    if (ceil(hours / step) + 1) * site_count > 100000:
        raise HTTPException(422, "Request exceeds 100000 samples; shorten range or increase step")
    return first, last


def build_site(site, start, end, step):
    first, last = validate_window(start, end, step)
    try:
        local = reference_ephemeris(site.lat, site.lon, first, last, step)
        if local is not None:
            raw, provenance = local
            source = provenance["engine"] + ("_INTERPOLATED" if provenance["interpolated"] else "")
        else:
            if not (data_dir() / "horizons.json").is_file() or not catalog():
                raise HTTPException(503, "Local LunaNav dataset unavailable; configure LUNANAV_DATA_DIR")
            raise HTTPException(422, "Unsupported coordinates or dates: exact /api/presets coordinates and in-range /api/data/status coverage required; no geometric fallback")
    except (ValueError, KeyError, OSError) as exc:
        raise HTTPException(503, f"Reference data unavailable or invalid: {exc}") from exc
    points = [EphemerisPoint(**point) for point in raw]
    return SiteEphemeris(site=site, data=points,
                         summary=calculate_site_summary(points, step_hours=step),
                         provenance=provenance), source


@router.post("/ephemeris", response_model=CompareResponse)
async def compute_ephemeris(req: EphemerisRequest):
    if not req.sites:
        raise HTTPException(400, "At least one site must be provided.")
    validate_window(req.start_date, req.end_date, req.step_hours, len(req.sites))
    results = [build_site(site, req.start_date, req.end_date, req.step_hours) for site in req.sites]
    return CompareResponse(sites=[result[0] for result in results], query_start=req.start_date,
                           query_end=req.end_date, step_hours=req.step_hours,
                           source=", ".join(sorted({result[1] for result in results})))


@router.get("/ephemeris/single", response_model=SiteEphemeris)
async def compute_single_site(
    lat: float = Query(..., ge=-90, le=90),
    lon: float = Query(..., ge=-180, le=360),
    name: str = Query("Target Site"),
    start_date: str = Query("2026-11-01T00:00:00Z"),
    end_date: str = Query("2026-11-02T00:00:00Z"),
    step_hours: float = Query(2, ge=0.25, le=24),
):
    result, _ = build_site(SiteRequest(name=name, lat=lat, lon=lon), start_date, end_date, step_hours)
    return result
