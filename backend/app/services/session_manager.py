import asyncio
import logging
import time
import uuid
from datetime import datetime, timezone
from typing import Any, Optional

from app.config import get_settings
from app.engines import create_engine
from app.models.db import db
from app.services.dograh_service import dograh_service

logger = logging.getLogger(__name__)


class SessionManager:
    def __init__(self) -> None:
        self._sessions: dict[str, dict[str, Any]] = {}
        self._started_at = time.time()
        self._lock = asyncio.Lock()

    @property
    def uptime_seconds(self) -> float:
        return time.time() - self._started_at

    @property
    def active_count(self) -> int:
        return sum(
            1
            for s in self._sessions.values()
            if s.get("state") not in ("idle", "error") and not s.get("ended_at")
        )

    def get(self, session_id: str) -> Optional[dict[str, Any]]:
        return self._sessions.get(session_id)

    async def start(
        self, avatar_id: Optional[str] = None, engine_name: Optional[str] = None
    ) -> dict[str, Any]:
        settings = get_settings()
        avatar = None
        if avatar_id:
            avatar = await db.get_avatar(avatar_id)
        engine_id = engine_name or (avatar or {}).get("engine") or settings.avatar_engine
        engine = create_engine(engine_id)
        await engine.initialize()
        if avatar:
            await engine.load_avatar(avatar)

        dograh = await dograh_service.create_webrtc_session()
        session_id = dograh["session_id"]
        server_api_key = dograh.pop("_server_api_key", None)
        base_url = dograh.pop("base_url", None)
        direct_url = dograh.get("dograh_direct_signaling_url")

        now = datetime.now(timezone.utc).isoformat()
        engine_info = await engine.start_session(session_id)

        record = {
            "id": session_id,
            "state": "connecting_to_dograh",
            "avatar_id": avatar_id,
            "engine": engine_id,
            "dograh_run_id": dograh["workflow_run_id"],
            "dograh": dograh,
            "engine_info": engine_info,
            "metrics": {
                "started_at_ms": int(time.time() * 1000),
                "time_to_first_audio_ms": None,
                "time_to_first_avatar_frame_ms": None,
                "av_offset_ms": None,
            },
            "error": None,
            "started_at": now,
            "ended_at": None,
            "created_at": now,
            "_engine": engine,
            "_server_api_key": server_api_key,
            "_dograh_direct_signaling_url": direct_url,
            "_dograh_base_url": base_url,
        }

        async with self._lock:
            self._sessions[session_id] = record

        await db.create_session(
            {
                "id": session_id,
                "state": record["state"],
                "avatar_id": avatar_id,
                "engine": engine_id,
                "dograh_run_id": dograh["workflow_run_id"],
                "metrics": record["metrics"],
                "started_at": now,
                "created_at": now,
            }
        )

        # Public payload — strip secrets
        return self._public(record)

    async def stop(self, session_id: str) -> dict[str, Any]:
        session = self._sessions.get(session_id)
        if not session:
            stored = await db.get_session(session_id)
            if not stored:
                raise KeyError(session_id)
            return stored

        engine = session.get("_engine")
        if engine:
            try:
                await engine.stop_session()
                await engine.dispose()
            except Exception as exc:
                logger.warning("Engine stop failed: %s", exc)

        now = datetime.now(timezone.utc).isoformat()
        session["state"] = "idle"
        session["ended_at"] = now
        await db.update_session(
            session_id, state="idle", ended_at=now, metrics=session.get("metrics")
        )
        return self._public(session)

    async def set_state(self, session_id: str, state: str, error: Optional[str] = None) -> None:
        session = self._sessions.get(session_id)
        if not session:
            return
        session["state"] = state
        if error is not None:
            session["error"] = error
        await db.update_session(session_id, state=state, error=error)

    async def update_metrics(self, session_id: str, metrics: dict[str, Any]) -> None:
        session = self._sessions.get(session_id)
        if not session:
            return
        session["metrics"].update(metrics)
        await db.update_session(session_id, metrics=session["metrics"])
        await db.add_diagnostic(session["metrics"], session_id=session_id)

    def _public(self, record: dict[str, Any]) -> dict[str, Any]:
        dograh = dict(record.get("dograh") or {})
        dograh.pop("_server_api_key", None)
        return {
            "session_id": record["id"],
            "state": record["state"],
            "avatar_id": record.get("avatar_id"),
            "engine": record.get("engine"),
            "dograh_run_id": record.get("dograh_run_id"),
            "started_at": record.get("started_at"),
            "error": record.get("error"),
            "metrics": record.get("metrics") or {},
            "dograh": dograh,
            "engine_info": record.get("engine_info") or {},
        }


session_manager = SessionManager()
