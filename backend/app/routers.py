from fastapi import APIRouter, HTTPException, Query
from typing import List
from app.models import (
    EphemerisRequest,
    CompareResponse,
    SiteEphemeris,
    EphemerisPoint,
    PresetSite,
    SiteRequest
)
from app.ephemeris import get_ephemeris_data
from app.analysis import calculate_site_summary

router = APIRouter(prefix="/api", tags=["Lunar Ephemeris & Landing Sites"])

# Verified NASA Artemis & CLPS South Pole Candidate Landing Sites
PRESET_SITES: List[PresetSite] = [
    PresetSite(
        id="shackleton-rim",
        name="Shackleton Crater Rim",
        lat=-89.90,
        lon=0.00,
        description="Peak of Eternal Light candidate on the rim of Shackleton; high illumination and near-constant direct Earth visibility.",
        feature_type="Crater Rim",
        elevation_m=4200.0
    ),
    PresetSite(
        id="nobile-ridge-1",
        name="Nobile Rim / Ridge 1",
        lat=-85.20,
        lon=35.50,
        description="Primary landing area for VIPER rover mission; favorable slope, near Permanently Shadowed Regions (PSRs).",
        feature_type="Ridge",
        elevation_m=2850.0
    ),
    PresetSite(
        id="de-gerlache-rim",
        name="de Gerlache Rim 2",
        lat=-88.30,
        lon=-68.80,
        description="Prominent Artemis III candidate site offering high solar illumination and long communication windows.",
        feature_type="Crater Rim",
        elevation_m=3400.0
    ),
    PresetSite(
        id="mons-mouton",
        name="Mons Mouton (Leibnitz Plateau)",
        lat=-84.50,
        lon=31.20,
        description="Flat elevated plateau with excellent line-of-sight to Earth and manageable slopes for lunar surface mobility.",
        feature_type="Plateau",
        elevation_m=6000.0
    ),
    PresetSite(
        id="faustini-rim",
        name="Faustini Rim A",
        lat=-87.10,
        lon=76.80,
        description="Rim adjacent to deep volatile-rich cold traps with periodic high solar visibility.",
        feature_type="Crater Rim",
        elevation_m=2100.0
    ),
    PresetSite(
        id="haworth-connecting-ridge",
        name="Connecting Ridge",
        lat=-89.44,
        lon=-137.30,
        description="Narrow ridge between Shackleton and de Gerlache; one of the highest cumulative illumination sites on the Moon.",
        feature_type="Ridge",
        elevation_m=3900.0
    ),
    PresetSite(
        id="malapert-mountain",
        name="Malapert Mountain (Peak)",
        lat=-86.04,
        lon=2.70,
        description="High altitude peak serving as ideal communications relay with uninterrupted view of Earth.",
        feature_type="Mountain Peak",
        elevation_m=5000.0
    ),
    PresetSite(
        id="amundsen-rim",
        name="Amundsen Rim",
        lat=-84.40,
        lon=82.80,
        description="Large crater rim providing extended communication coverage and science exploration targets.",
        feature_type="Crater Rim",
        elevation_m=3100.0
    )
]

@router.get("/presets", response_model=List[PresetSite])
async def get_presets():
    """Returns curated NASA candidate lunar landing sites."""
    return PRESET_SITES

@router.post("/ephemeris", response_model=CompareResponse)
async def compute_ephemeris(req: EphemerisRequest):
    """
    Computes Sun and Earth topocentric positions for one or more landing sites
    over the requested timeframe, returning full ephemeris time-series and
    mission feasibility summaries.
    """
    if not req.sites:
        raise HTTPException(status_code=400, detail="At least one site must be provided.")
    
    site_results: List[SiteEphemeris] = []
    engine_sources = set()

    for site in req.sites:
        raw_pts, source = get_ephemeris_data(
            lat=site.lat,
            lon=site.lon,
            start_str=req.start_date,
            stop_str=req.end_date,
            step_hours=req.step_hours
        )
        engine_sources.add(source)
        
        typed_pts = [EphemerisPoint(**pt) for pt in raw_pts]
        summary = calculate_site_summary(typed_pts, step_hours=req.step_hours)
        
        site_results.append(SiteEphemeris(
            site=site,
            data=typed_pts,
            summary=summary
        ))

    return CompareResponse(
        sites=site_results,
        query_start=req.start_date,
        query_end=req.end_date,
        step_hours=req.step_hours,
        source=", ".join(engine_sources)
    )

@router.get("/ephemeris/single", response_model=SiteEphemeris)
async def compute_single_site(
    lat: float = Query(..., ge=-90.0, le=90.0),
    lon: float = Query(..., ge=-180.0, le=360.0),
    name: str = Query("Target Site"),
    start_date: str = Query("2026-06-01T00:00:00"),
    end_date: str = Query("2026-06-30T00:00:00"),
    step_hours: int = Query(2, ge=1, le=24)
):
    """Convenience endpoint for single-site query."""
    raw_pts, _ = get_ephemeris_data(lat, lon, start_date, end_date, step_hours)
    typed_pts = [EphemerisPoint(**pt) for pt in raw_pts]
    summary = calculate_site_summary(typed_pts, step_hours=step_hours)
    
    return SiteEphemeris(
        site=SiteRequest(name=name, lat=lat, lon=lon),
        data=typed_pts,
        summary=summary
    )
