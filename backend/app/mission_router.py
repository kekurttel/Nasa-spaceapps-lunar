"""Mount with: from .mission_router import router; app.include_router(router)."""
from threading import BoundedSemaphore

from fastapi import APIRouter, HTTPException

from .mission_search import MissionSearchRequest, capabilities, search

router = APIRouter(prefix="/api/mission", tags=["mission"])
# Reject excess concurrent CPU searches instead of growing an unbounded queue.
_search_slot = BoundedSemaphore(1)


@router.get("/capabilities")
def mission_capabilities():
    try:
        return capabilities()
    except (OSError, ValueError, KeyError) as exc:
        raise HTTPException(status_code=503, detail="Mission atlas data unavailable or invalid") from exc


@router.post("/search")
def mission_search(request: MissionSearchRequest):
    if not _search_slot.acquire(blocking=False):
        raise HTTPException(status_code=429, detail="Mission search busy; retry later", headers={"Retry-After": "2"})
    try:
        try:
            # Separate bundle validation from user-window validation.
            capabilities()
        except (OSError, ValueError, KeyError) as exc:
            raise HTTPException(status_code=503, detail="Mission atlas data unavailable or invalid") from exc
        try:
            return search(request)
        except ValueError as exc:
            raise HTTPException(status_code=422, detail=str(exc)) from exc
    finally:
        _search_slot.release()
