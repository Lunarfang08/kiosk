from pathlib import Path

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile
from fastapi.responses import FileResponse

from app.config import get_settings
from app.engines import describe_engines
from app.schemas.common import AvatarConfig, AvatarCreateRequest, AvatarUpdateRequest
from app.services.avatar_service import avatar_service
from app.utils.security import require_admin

router = APIRouter(prefix="/api/avatars", tags=["avatars"])


@router.get("/engines")
async def list_engines():
    return await describe_engines()


@router.get("", response_model=list[AvatarConfig])
async def list_avatars() -> list[AvatarConfig]:
    items = await avatar_service.list_avatars()
    return [AvatarConfig(**i) for i in items]


@router.post("", response_model=AvatarConfig, dependencies=[Depends(require_admin)])
async def create_avatar(payload: AvatarCreateRequest) -> AvatarConfig:
    created = await avatar_service.create_avatar(payload.model_dump())
    return AvatarConfig(**created)


@router.post("/upload", dependencies=[Depends(require_admin)])
async def upload_avatar_asset(
    file: UploadFile = File(...),
    kind: str = Form("image"),
    avatar_id: str | None = Form(None),
):
    meta = await avatar_service.save_upload(file, kind=kind, avatar_id=avatar_id)
    if avatar_id:
        avatar = await avatar_service.attach_upload_to_avatar(avatar_id, kind, meta)
        return {"upload": meta, "avatar": avatar}
    return {"upload": meta}


@router.post("/create", response_model=AvatarConfig, dependencies=[Depends(require_admin)])
async def create_with_optional_upload(
    payload: AvatarCreateRequest,
) -> AvatarConfig:
    created = await avatar_service.create_avatar(payload.model_dump())
    return AvatarConfig(**created)


@router.get("/files/{filename}")
async def get_avatar_file(filename: str):
    settings = get_settings()
    # Prevent path traversal
    safe = Path(filename).name
    path = settings.uploads_dir / safe
    if not path.exists():
        # also check generated
        path = settings.generated_dir / safe
    if not path.exists():
        raise HTTPException(status_code=404, detail="File not found")
    return FileResponse(path)


@router.get("/{avatar_id}", response_model=AvatarConfig)
async def get_avatar(avatar_id: str) -> AvatarConfig:
    return AvatarConfig(**await avatar_service.get_avatar(avatar_id))


@router.put(
    "/{avatar_id}",
    response_model=AvatarConfig,
    dependencies=[Depends(require_admin)],
)
async def update_avatar(avatar_id: str, payload: AvatarUpdateRequest) -> AvatarConfig:
    updated = await avatar_service.update_avatar(
        avatar_id, payload.model_dump(exclude_unset=True)
    )
    return AvatarConfig(**updated)


@router.delete("/{avatar_id}", dependencies=[Depends(require_admin)])
async def delete_avatar(avatar_id: str):
    await avatar_service.delete_avatar(avatar_id)
    return {"ok": True}
