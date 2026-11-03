import logging
import uuid
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Optional

import aiofiles
from fastapi import HTTPException, UploadFile
from PIL import Image

from app.config import get_settings
from app.models.db import db

logger = logging.getLogger(__name__)

ALLOWED_IMAGE = {".png", ".jpg", ".jpeg", ".webp"}
ALLOWED_VIDEO = {".mp4", ".webm", ".mov"}
ALLOWED_MODEL = {".glb", ".gltf", ".vrm"}


class AvatarService:
    def ensure_dirs(self) -> None:
        settings = get_settings()
        for path in (
            settings.uploads_dir,
            settings.generated_dir,
            settings.configs_dir,
        ):
            path.mkdir(parents=True, exist_ok=True)

    async def list_avatars(self) -> list[dict[str, Any]]:
        return await db.list_avatars()

    async def get_avatar(self, avatar_id: str) -> dict[str, Any]:
        avatar = await db.get_avatar(avatar_id)
        if not avatar:
            raise HTTPException(status_code=404, detail="Avatar not found")
        return avatar

    async def create_avatar(self, payload: dict[str, Any]) -> dict[str, Any]:
        now = datetime.now(timezone.utc).isoformat()
        avatar = {
            "id": str(uuid.uuid4()),
            "created_at": now,
            "updated_at": now,
            **payload,
        }
        return await db.upsert_avatar(avatar)

    async def update_avatar(self, avatar_id: str, payload: dict[str, Any]) -> dict[str, Any]:
        existing = await self.get_avatar(avatar_id)
        existing.update({k: v for k, v in payload.items() if v is not None})
        existing["updated_at"] = datetime.now(timezone.utc).isoformat()
        return await db.upsert_avatar(existing)

    async def delete_avatar(self, avatar_id: str) -> None:
        ok = await db.delete_avatar(avatar_id)
        if not ok:
            raise HTTPException(status_code=404, detail="Avatar not found")

    async def save_upload(
        self,
        file: UploadFile,
        kind: str = "image",
        avatar_id: Optional[str] = None,
    ) -> dict[str, Any]:
        settings = get_settings()
        self.ensure_dirs()
        suffix = Path(file.filename or "upload.bin").suffix.lower()

        if kind == "image" and suffix not in ALLOWED_IMAGE:
            raise HTTPException(status_code=400, detail=f"Unsupported image type: {suffix}")
        if kind == "video" and suffix not in ALLOWED_VIDEO:
            raise HTTPException(status_code=400, detail=f"Unsupported video type: {suffix}")
        if kind == "model" and suffix not in ALLOWED_MODEL:
            raise HTTPException(status_code=400, detail=f"Unsupported model type: {suffix}")

        data = await file.read()
        if len(data) > settings.max_upload_bytes:
            raise HTTPException(
                status_code=400,
                detail=f"File exceeds {settings.max_upload_mb}MB limit",
            )

        file_id = avatar_id or str(uuid.uuid4())
        dest = settings.uploads_dir / f"{file_id}{suffix}"
        async with aiofiles.open(dest, "wb") as out:
            await out.write(data)

        meta: dict[str, Any] = {
            "path": str(dest.relative_to(settings.avatar_root.parent))
            if settings.avatar_root.parent in dest.parents
            else str(dest),
            "relative_url": f"/api/avatars/files/{dest.name}",
            "filename": dest.name,
            "size": len(data),
            "kind": kind,
        }

        if kind == "image":
            try:
                with Image.open(dest) as img:
                    img.verify()
                with Image.open(dest) as img:
                    w, h = img.size
                    meta["width"] = w
                    meta["height"] = h
                    meta["format"] = img.format
                    # Front-facing portrait heuristic — warn, don't block
                    meta["validation"] = {
                        "ok": True,
                        "warnings": [],
                    }
                    if w < 256 or h < 256:
                        meta["validation"]["warnings"].append(
                            "Portrait resolution is low; 512px+ recommended"
                        )
                    if abs(w - h) / max(w, h) > 0.35:
                        meta["validation"]["warnings"].append(
                            "Non-square portrait may need cropping for best lip-sync framing"
                        )
            except Exception as exc:
                dest.unlink(missing_ok=True)
                raise HTTPException(status_code=400, detail=f"Invalid image: {exc}") from exc

        return meta

    async def attach_upload_to_avatar(
        self, avatar_id: str, kind: str, meta: dict[str, Any]
    ) -> dict[str, Any]:
        avatar = await self.get_avatar(avatar_id)
        if kind == "image":
            avatar["image_path"] = meta["relative_url"]
        elif kind == "video":
            avatar["video_path"] = meta["relative_url"]
        elif kind == "model":
            avatar["model_path"] = meta["relative_url"]
        avatar["updated_at"] = datetime.now(timezone.utc).isoformat()
        return await db.upsert_avatar(avatar)


avatar_service = AvatarService()
