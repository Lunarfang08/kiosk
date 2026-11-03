import httpx
from fastapi import APIRouter

from app.config import get_settings
from app.models.db import db
from app.schemas.common import DiagnosticsResponse
from app.services.dograh_service import dograh_service
from app.services.session_manager import session_manager

router = APIRouter(prefix="/api/diagnostics", tags=["diagnostics"])


@router.get("", response_model=DiagnosticsResponse)
async def diagnostics() -> DiagnosticsResponse:
    settings = get_settings()
    dograh = await dograh_service.status()
    lt_reachable = None
    if settings.livetalking_enabled:
        try:
            async with httpx.AsyncClient(timeout=3.0) as client:
                resp = await client.get(settings.livetalking_base_url)
                lt_reachable = resp.status_code < 500
        except httpx.HTTPError:
            lt_reachable = False

    return DiagnosticsResponse(
        uptime_seconds=session_manager.uptime_seconds,
        active_sessions=session_manager.active_count,
        avatar_count=await db.count_avatars(),
        dograh_configured=bool(dograh.get("configured")),
        livetalking_enabled=settings.livetalking_enabled,
        livetalking_reachable=lt_reachable,
        recent_metrics=await db.recent_diagnostics(30),
    )
