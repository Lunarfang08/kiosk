from fastapi import APIRouter, Depends

from app.config import get_settings
from app.models.db import db
from app.schemas.common import SettingsPublicResponse, SettingsUpdateRequest
from app.utils.security import require_admin

router = APIRouter(prefix="/api/settings", tags=["settings"])


@router.get("", response_model=SettingsPublicResponse)
async def get_public_settings() -> SettingsPublicResponse:
    settings = get_settings()
    api_key = await db.get_setting("dograh_api_key") or settings.dograh_api_key
    embed = await db.get_setting("dograh_embed_token") or settings.dograh_embed_token
    return SettingsPublicResponse(
        dograh_base_url=await db.get_setting("dograh_base_url") or settings.dograh_base_url,
        dograh_agent_id=await db.get_setting("dograh_agent_id") or settings.dograh_agent_id,
        has_api_key=bool(api_key),
        has_embed_token=bool(embed),
        avatar_engine=await db.get_setting("avatar_engine") or settings.avatar_engine,
        livetalking_enabled=(
            (await db.get_setting("livetalking_enabled")) == "true"
            if await db.get_setting("livetalking_enabled") is not None
            else settings.livetalking_enabled
        ),
        livetalking_base_url=(
            await db.get_setting("livetalking_base_url") or settings.livetalking_base_url
        ),
    )


@router.put("", response_model=SettingsPublicResponse, dependencies=[Depends(require_admin)])
async def update_settings(payload: SettingsUpdateRequest) -> SettingsPublicResponse:
    mapping = payload.model_dump(exclude_unset=True)
    for key, value in mapping.items():
        if value is None:
            continue
        if key in {"dograh_api_key", "dograh_embed_token"} and value == "":
            continue
        await db.set_setting(key, str(value).lower() if isinstance(value, bool) else str(value))
    return await get_public_settings()
