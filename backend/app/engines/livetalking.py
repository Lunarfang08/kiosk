from typing import Any, Optional

import httpx

from app.config import get_settings
from app.engines.base import AvatarEngine, EngineStatus


class LiveTalkingEngine(AvatarEngine):
    """
    Adapter around LiveTalking's documented HTTP/WebRTC API.

    Confirmed endpoints (https://github.com/lipku/LiveTalking/blob/main/docs/api.md):
    - POST /offer  — WebRTC SDP exchange → sessionid
    - POST /humanaudio — multipart sessionid + audio file
    - POST /human — text echo/chat
    - POST /interrupt_talk
    - POST /is_speaking
    - GET /sse?sessionid=

    Open-source LiveTalking does not expose WebSocket PCM ingress.
    """

    name = "livetalking"

    def __init__(self) -> None:
        self._status = EngineStatus.idle
        self._avatar: Optional[dict[str, Any]] = None
        self._session_id: Optional[str] = None
        self._lt_session_id: Optional[str] = None
        settings = get_settings()
        self._base_url = settings.livetalking_base_url.rstrip("/")

    async def initialize(self) -> None:
        settings = get_settings()
        if not settings.livetalking_enabled:
            self._status = EngineStatus.error
            raise RuntimeError(
                "LiveTalking is disabled. Set LIVETALKING_ENABLED=true and run the gpu-avatar profile."
            )
        async with httpx.AsyncClient(timeout=5.0) as client:
            try:
                # LiveTalking serves a web UI at /; treat any response as reachable.
                resp = await client.get(f"{self._base_url}/")
                if resp.status_code >= 500:
                    raise RuntimeError(f"LiveTalking unhealthy: HTTP {resp.status_code}")
            except httpx.HTTPError as exc:
                self._status = EngineStatus.error
                raise RuntimeError(f"Cannot reach LiveTalking at {self._base_url}: {exc}") from exc
        self._status = EngineStatus.ready

    async def load_avatar(self, avatar_config: dict[str, Any]) -> None:
        self._avatar = avatar_config
        self._status = EngineStatus.ready

    async def start_session(self, session_id: str) -> dict[str, Any]:
        self._session_id = session_id
        return {
            "engine": self.name,
            "session_id": session_id,
            "livetalking_base_url": self._base_url,
            "offer_url": f"{self._base_url}/offer",
            "humanaudio_url": f"{self._base_url}/humanaudio",
            "interrupt_url": f"{self._base_url}/interrupt_talk",
            "is_speaking_url": f"{self._base_url}/is_speaking",
            "sse_url_template": f"{self._base_url}/sse?sessionid={{sessionid}}",
            "avatar_id": (self._avatar or {}).get("id"),
            "note": (
                "Browser should POST SDP to /offer, then feed Dograh TTS WAV chunks "
                "to /humanaudio with the returned sessionid."
            ),
        }

    async def process_audio(
        self, audio_bytes: bytes, mime_type: str = "audio/wav"
    ) -> dict[str, Any]:
        if not self._lt_session_id:
            return {
                "accepted": False,
                "error": "No LiveTalking sessionid. Complete WebRTC /offer first.",
            }
        files = {"file": ("speech.wav", audio_bytes, mime_type or "audio/wav")}
        data = {"sessionid": self._lt_session_id}
        async with httpx.AsyncClient(timeout=60.0) as client:
            resp = await client.post(
                f"{self._base_url}/humanaudio", data=data, files=files
            )
            resp.raise_for_status()
            self._status = EngineStatus.speaking
            try:
                body = resp.json()
            except Exception:
                body = {"raw": resp.text}
            return {"accepted": True, "response": body}

    async def set_livetalking_session(self, lt_session_id: str) -> None:
        self._lt_session_id = lt_session_id

    async def interrupt(self) -> None:
        if not self._lt_session_id:
            return
        async with httpx.AsyncClient(timeout=10.0) as client:
            await client.post(
                f"{self._base_url}/interrupt_talk",
                json={"sessionid": self._lt_session_id},
            )
        self._status = EngineStatus.ready

    async def stop_session(self) -> None:
        await self.interrupt()
        self._lt_session_id = None
        self._session_id = None
        self._status = EngineStatus.ready

    async def get_status(self) -> dict[str, Any]:
        speaking = None
        if self._lt_session_id:
            try:
                async with httpx.AsyncClient(timeout=5.0) as client:
                    resp = await client.post(
                        f"{self._base_url}/is_speaking",
                        json={"sessionid": self._lt_session_id},
                    )
                    if resp.status_code < 400:
                        speaking = resp.json()
            except httpx.HTTPError:
                speaking = None
        return {
            "engine": self.name,
            "status": self._status.value,
            "session_id": self._session_id,
            "livetalking_session_id": self._lt_session_id,
            "is_speaking": speaking,
            "base_url": self._base_url,
        }

    async def dispose(self) -> None:
        await self.stop_session()
        self._avatar = None
        self._status = EngineStatus.disposed


class MuseTalkViaLiveTalkingEngine(LiveTalkingEngine):
    """
    MuseTalk as a LiveTalking model flag (--model musetalk), not a separate streamer.
    Standalone MuseTalk is offline/file-based and is not used as a network service here.
    """

    name = "musetalk"
