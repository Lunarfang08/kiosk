from typing import Any, Optional

from app.engines.base import AvatarEngine, EngineStatus


class ThreeDAvatarEngine(AvatarEngine):
    """
    Metadata/control for frontend Three.js / R3F avatar rendering.

    Lip-sync requires facial morph targets / blend shapes on the GLB/GLTF/VRM.
    Models without morphs cannot provide realistic lip-sync — the UI must say so.
    """

    name = "three_d"

    def __init__(self) -> None:
        self._status = EngineStatus.idle
        self._avatar: Optional[dict[str, Any]] = None
        self._session_id: Optional[str] = None

    async def initialize(self) -> None:
        self._status = EngineStatus.ready

    async def load_avatar(self, avatar_config: dict[str, Any]) -> None:
        if not avatar_config.get("model_path"):
            raise ValueError("3D avatar requires a GLB/GLTF/VRM model_path")
        self._avatar = avatar_config
        self._status = EngineStatus.ready

    async def start_session(self, session_id: str) -> dict[str, Any]:
        self._session_id = session_id
        return {
            "engine": self.name,
            "session_id": session_id,
            "render_mode": "browser_three_js",
            "model_path": (self._avatar or {}).get("model_path"),
            "requires_morph_targets": True,
            "note": (
                "If the model has no facial morph targets / blend shapes, "
                "realistic lip-sync is not available without additional animation support."
            ),
        }

    async def process_audio(
        self, audio_bytes: bytes, mime_type: str = "audio/wav"
    ) -> dict[str, Any]:
        self._status = EngineStatus.speaking
        return {
            "accepted": True,
            "bytes": len(audio_bytes),
            "note": "Viseme animation is applied client-side from Dograh audio",
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
