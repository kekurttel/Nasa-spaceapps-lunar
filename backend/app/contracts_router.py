"""Explicit opt-in adapter. Mount separately; existing APIs remain unchanged."""
from fastapi import APIRouter, HTTPException

from app import routers
from app.contracts import LocalAnalysis, LocalSeries, Scenario, UNVERIFIED_FRAME
from app.models import SiteRequest
from app.reference_data import catalog, match_site

router = APIRouter(prefix="/api/contracts", tags=["Contract compatibility"])


@router.get("/capabilities")
async def capabilities():
    return {
        "contract": "local-analysis/v1",
        "scenarioTransportSupported": True,
        "skySeriesCompatible": False,
        "frame": UNVERIFIED_FRAME,
        "supportedRequestedFrames": [UNVERIFIED_FRAME],
        "rejectedRequestedFrames": ["IAU_MOON", "MOON_ME_DE421"],
        "frameTransformations": False,
        "observerHeightM": 2,
        "surfaceElevationM": None,
        "stepSeconds": {"min": 900, "max": 86400},
        "timestamps": "Full UTC timestamps ending Z; positive window",
        "coordinates": "Exact catalog coordinates AND matching profile id; no snapping",
        "sunRadiusDeg": None,
        "externalEnginesExecuted": False,
        "limits": [
            "Field mappings are not frame transformations",
            "Native frame metadata is unverified; not a compliant IAU_MOON SkySeries",
            "Independent CLI engines are not invoked or interchangeable with this local dataset",
            "Local coverage only; no extrapolation; intermediate values are interpolated",
            "No verified surface elevation or solar angular radius is available",
        ],
    }


@router.post("/local-analysis", response_model=LocalAnalysis)
async def local_analysis(scenario: Scenario):
    sites = catalog()
    if not sites:
        raise HTTPException(503, "Local LunaNav dataset unavailable")
    site = next((item for item in sites if item["id"] == scenario.site.id), None)
    if site is None:
        raise HTTPException(422, "Unknown local profile id; use /api/presets")
    # Do not accept the native coordinate tolerance here or silently reinterpret
    # another profile at the same coordinates through build_site's lookup.
    if scenario.site.latDeg != site["lat"] or scenario.site.lonDeg != site["lon"]:
        raise HTTPException(422, "Site coordinates must exactly match the requested profile id")
    resolved = match_site(scenario.site.latDeg, scenario.site.lonDeg)
    if resolved is None or resolved["id"] != site["id"]:
        raise HTTPException(422, "Coordinates resolve to a different native profile; ambiguous mapping rejected")
    if site["profile"].get("observer_height_m") != scenario.site.observerHeightM:
        raise HTTPException(422, "Profile observer height differs; no height transformation available")
    result, source = routers.build_site(
        SiteRequest(name=scenario.site.name, lat=scenario.site.latDeg, lon=scenario.site.lonDeg),
        scenario.startUtc, scenario.endUtc, scenario.stepSeconds / 3600,
    )
    provenance = dict(result.provenance or {})
    # Coordinate verification and file hashes are not verification of a frame.
    provenance.update({
        "frame": UNVERIFIED_FRAME,
        "frameVerified": False,
        "frameTransformationApplied": False,
        "source": source,
        "requestedSourceIds": scenario.site.sourceIds,
        "sourceIdsVerified": False,
        "externalEnginesExecuted": False,
        "surfaceElevationM": None,
    })
    points = result.data
    return LocalAnalysis(
        scenario=scenario,
        series=LocalSeries(
            timeUtc=[p.datetime for p in points],
            sunElevationDeg=[p.sun_elevation for p in points],
            sunAzimuthDeg=[p.sun_azimuth for p in points],
            earthElevationDeg=[p.earth_elevation for p in points],
            earthAzimuthDeg=[p.earth_azimuth for p in points],
            sunHorizonDeg=[p.sun_horizon for p in points],
            earthHorizonDeg=[p.earth_horizon for p in points],
            sunVisible=[p.sun_visible for p in points],
            earthVisible=[p.earth_visible for p in points],
            sunVisibleFraction=[p.sun_visible_fraction for p in points],
            sunRadiusDeg=[None for p in points],
        ),
        summary=result.summary.model_dump(),
        provenance=provenance,
        warnings=[
            "Transport field mapping only; not a frame transformation or compliant IAU_MOON SkySeries",
            "Upstream frame is unverified; IAU_MOON and MOON_ME_DE421 requests are rejected",
            "Solar angular radius unavailable: sunRadiusDeg is null, never inferred from disk fraction",
            "Surface elevation unverified; no elevation or observer-height correction applied",
            "Scenario kind, name and sourceIds are caller labels, not verified scientific provenance",
            "Independent CLI engines are not invoked; their outputs are not silently substituted",
            "Native disk fractions retained; intermediate samples are interpolated, not new geometry",
            "Summary preserves existing duration-weighted local analysis; solar disk percent is not power",
        ],
    )
