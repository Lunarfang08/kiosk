from typing import Any, Optional

from app.engines.base import AvatarEngine, EngineStatus


class PortraitLipSyncEngine(AvatarEngine):
    """
    Mac-demo engine metadata/control plane.

    Actual lip-sync rendering happens in the browser from the Dograh
    MediaStream. This backend engine tracks session/config state only.
    """

    name = "portrait"

    def __init__(self) -> None:
        self._status = EngineStatus.idle
        self._avatar: Optional[dict[str, Any]] = None
        self._session_id: Optional[str] = None

    async def initialize(self) -> None:
        self._status = EngineStatus.ready

    async def load_avatar(self, avatar_config: dict[str, Any]) -> None:
        if not avatar_config.get("image_path") and not avatar_config.get("model_path"):
            # Allowed: default placeholder portrait on frontend
            pass
        self._avatar = avatar_config
        self._status = EngineStatus.ready

    async def start_session(self, session_id: str) -> dict[str, Any]:
        self._session_id = session_id
        self._status = EngineStatus.ready
        return {
            "engine": self.name,
            "session_id": session_id,
            "render_mode": "browser_portrait_lipsync",
            "avatar": self._avatar,
        }

    async def process_audio(
        self, audio_bytes: bytes, mime_type: str = "audio/wav"
    ) -> dict[str, Any]:
        # Browser drives animation from live MediaStream; this is a no-op ack.
        self._status = EngineStatus.speaking
        return {
            "accepted": True,
            "bytes": len(audio_bytes),
            "mime_type": mime_type,
            "note": "Portrait lip-sync is client-rendered from Dograh audio",
        }

    async def stop_session(self) -> None:
        self._session_id = None
        self._status = EngineStatus.ready

    async def get_status(self) -> dict[str, Any]:
        return {
            "engine": self.name,
            "status": self._status.value,
            "session_id": self._session_id,
            "avatar_id": (self._avatar or {}).get("id"),
        }

    async def dispose(self) -> None:
        self._avatar = None
        self._session_id = None
        self._status = EngineStatus.disposed

    async def interrupt(self) -> None:
        if self._status == EngineStatus.speaking:
            self._status = EngineStatus.ready
