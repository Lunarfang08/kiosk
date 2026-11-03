import asyncio
import json
import logging
from typing import Any
from urllib.parse import urlencode

from fastapi import APIRouter, WebSocket, WebSocketDisconnect
from starlette.websockets import WebSocketState

from app.schemas.common import SessionStartRequest, SessionStatusResponse
from app.services.session_manager import session_manager

logger = logging.getLogger(__name__)
router = APIRouter(tags=["sessions"])


@router.post("/api/sessions/start")
async def start_session(payload: SessionStartRequest) -> dict[str, Any]:
    try:
        return await session_manager.start(
            avatar_id=payload.avatar_id,
            engine_name=payload.engine.value if payload.engine else None,
        )
    except Exception as exc:
        logger.exception("Failed to start session")
        return {
            "session_id": None,
            "state": "error",
            "error": str(exc),
            "dograh": None,
            "engine_info": {},
            "metrics": {},
        }


@router.post("/api/sessions/stop")
async def stop_session(session_id: str) -> dict[str, Any]:
    try:
        return await session_manager.stop(session_id)
    except KeyError:
        return {"session_id": session_id, "state": "error", "error": "Session not found"}


@router.get("/api/sessions/{session_id}/status", response_model=SessionStatusResponse)
async def session_status(session_id: str) -> SessionStatusResponse:
    session = session_manager.get(session_id)
    if not session:
        from fastapi import HTTPException

        raise HTTPException(status_code=404, detail="Session not found")
    pub = session_manager._public(session)
    return SessionStatusResponse(
        session_id=pub["session_id"],
        state=pub["state"],
        avatar_id=pub.get("avatar_id"),
        engine=pub.get("engine") or "portrait",
        dograh_run_id=pub.get("dograh_run_id"),
        started_at=pub.get("started_at"),
        error=pub.get("error"),
        metrics=pub.get("metrics") or {},
    )


@router.websocket("/api/sessions/{session_id}/events")
async def session_events(websocket: WebSocket, session_id: str) -> None:
    await websocket.accept()
    try:
        while True:
            session = session_manager.get(session_id)
            if not session:
                await websocket.send_json({"type": "error", "message": "Session not found"})
                break
            await websocket.send_json(
                {"type": "session.status", "payload": session_manager._public(session)}
            )
            # Allow client metrics push
            try:
                message = await asyncio.wait_for(websocket.receive_text(), timeout=2.0)
                data = json.loads(message)
                if data.get("type") == "metrics":
                    await session_manager.update_metrics(session_id, data.get("payload") or {})
                elif data.get("type") == "state":
                    await session_manager.set_state(
                        session_id, data.get("state", "listening"), data.get("error")
                    )
            except asyncio.TimeoutError:
                continue
    except WebSocketDisconnect:
        logger.info("Session events disconnected: %s", session_id)
    except Exception as exc:
        logger.warning("Session events error: %s", exc)
    finally:
        if websocket.client_state == WebSocketState.CONNECTED:
            await websocket.close()


@router.websocket("/api/sessions/{session_id}/dograh-signaling")
async def dograh_signaling_proxy(websocket: WebSocket, session_id: str) -> None:
    """
    Proxy Dograh signaling so the browser never receives the API key.

    Browser <-> Kiosk backend <-> Dograh /api/v1/ws/signaling/{wf}/{run}?api_key=...
    """
    await websocket.accept()
    session = session_manager.get(session_id)
    if not session:
        await websocket.send_json({"type": "error", "message": "Session not found"})
        await websocket.close()
        return

    api_key = session.get("_server_api_key")
    direct = session.get("_dograh_direct_signaling_url")
    if not api_key or not direct:
        # Embed path already has a public signaling URL — tell client to use dograh.signaling_url
        await websocket.send_json(
            {
                "type": "error",
                "message": (
                    "No proxied signaling for this session. "
                    "Use the embed signaling_url from session start."
                ),
            }
        )
        await websocket.close()
        return

    import ssl

    import certifi
    import websockets

    qs = urlencode({"api_key": api_key})
    upstream_url = f"{direct}?{qs}"
    # Match httpx: python.org builds on macOS often lack system CAs.
    ssl_context = ssl.create_default_context(cafile=certifi.where())

    try:
        async with websockets.connect(
            upstream_url,
            max_size=8 * 1024 * 1024,
            ssl=ssl_context,
        ) as upstream:

            async def client_to_upstream() -> None:
                while True:
                    message = await websocket.receive_text()
                    await upstream.send(message)

            async def upstream_to_client() -> None:
                async for message in upstream:
                    if isinstance(message, bytes):
                        await websocket.send_bytes(message)
                    else:
                        await websocket.send_text(message)

            done, pending = await asyncio.wait(
                [
                    asyncio.create_task(client_to_upstream()),
                    asyncio.create_task(upstream_to_client()),
                ],
                return_when=asyncio.FIRST_EXCEPTION,
            )
            for task in pending:
                task.cancel()
            for task in done:
                exc = task.exception()
                if exc and not isinstance(exc, (WebSocketDisconnect, asyncio.CancelledError)):
                    logger.warning("Signaling proxy ended: %s", exc)
    except Exception as exc:
        logger.exception("Dograh signaling proxy failed")
        if websocket.client_state == WebSocketState.CONNECTED:
            await websocket.send_json({"type": "error", "message": str(exc)})
            await websocket.close()
