import logging
import uuid
from typing import Any, Optional
from urllib.parse import urlparse

import httpx

from app.config import Settings, get_settings
from app.models.db import db

logger = logging.getLogger(__name__)


class DograhService:
    """Server-side Dograh REST client. API keys never leave the backend."""

    async def _resolved_settings(self) -> dict[str, str]:
        settings = get_settings()
        overrides = {
            "dograh_base_url": await db.get_setting("dograh_base_url"),
            "dograh_api_key": await db.get_setting("dograh_api_key"),
            "dograh_agent_id": await db.get_setting("dograh_agent_id"),
            "dograh_embed_token": await db.get_setting("dograh_embed_token"),
        }
        return {
            "base_url": (overrides["dograh_base_url"] or settings.dograh_base_url).rstrip(
                "/"
            ),
            "api_key": overrides["dograh_api_key"] or settings.dograh_api_key,
            "agent_id": overrides["dograh_agent_id"] or settings.dograh_agent_id,
            "embed_token": overrides["dograh_embed_token"] or settings.dograh_embed_token,
        }

    def _headers(self, api_key: str) -> dict[str, str]:
        return {
            "X-API-Key": api_key,
            "Content-Type": "application/json",
            "Accept": "application/json",
        }

    async def status(self) -> dict[str, Any]:
        cfg = await self._resolved_settings()
        reachable: Optional[bool] = None
        message = "API key missing" if not cfg["api_key"] else "Configured"
        if cfg["api_key"]:
            try:
                async with httpx.AsyncClient(timeout=10.0) as client:
                    # Lightweight authenticated probe
                    resp = await client.get(
                        f"{cfg['base_url']}/api/v1/workflow/fetch",
                        headers=self._headers(cfg["api_key"]),
                    )
                    reachable = resp.status_code < 500
                    if resp.status_code in (200, 401, 403, 404):
                        message = (
                            "Reachable"
                            if resp.status_code == 200
                            else f"Reachable (HTTP {resp.status_code})"
                        )
                    else:
                        message = f"Unexpected HTTP {resp.status_code}"
            except httpx.HTTPError as exc:
                reachable = False
                message = f"Unreachable: {exc.__class__.__name__}"
                logger.warning("Dograh status check failed: %s", exc)
        return {
            "configured": bool(cfg["api_key"] and cfg["agent_id"]),
            "base_url": cfg["base_url"],
            "agent_id": cfg["agent_id"],
            "has_api_key": bool(cfg["api_key"]),
            "has_embed_token": bool(cfg["embed_token"]),
            "reachable": reachable,
            "message": message,
        }

    async def test_connection(self) -> dict[str, Any]:
        cfg = await self._resolved_settings()
        if not cfg["api_key"]:
            return {"ok": False, "message": "DOGRAH_API_KEY is not set", "details": {}}
        if not cfg["agent_id"]:
            return {"ok": False, "message": "DOGRAH_AGENT_ID is not set", "details": {}}

        async with httpx.AsyncClient(timeout=20.0) as client:
            try:
                # Verify workflow exists / API key works by creating nothing —
                # fetch workflows or get specific workflow if available.
                fetch = await client.get(
                    f"{cfg['base_url']}/api/v1/workflow/fetch",
                    headers=self._headers(cfg["api_key"]),
                )
                details: dict[str, Any] = {
                    "fetch_status": fetch.status_code,
                    "agent_id": cfg["agent_id"],
                    "base_url": cfg["base_url"],
                }
                if fetch.status_code == 200:
                    try:
                        body = fetch.json()
                        details["workflows_sample"] = (
                            body if isinstance(body, list) else body
                        )
                    except Exception:
                        details["body"] = fetch.text[:500]
                    return {
                        "ok": True,
                        "message": "Dograh API key accepted and endpoint reachable",
                        "details": details,
                    }
                if fetch.status_code in (401, 403):
                    return {
                        "ok": False,
                        "message": "Authentication failed — check DOGRAH_API_KEY",
                        "details": details,
                    }
                # Some deployments may not expose /workflow/fetch; try creating a dry probe differently
                return {
                    "ok": fetch.status_code < 500,
                    "message": f"Dograh responded with HTTP {fetch.status_code}",
                    "details": details,
                }
            except httpx.HTTPError as exc:
                return {
                    "ok": False,
                    "message": f"Connection error: {exc}",
                    "details": {},
                }

    def _ws_base(self, http_base: str) -> str:
        """WebSocket origin for Dograh signaling.

        Hosted UI is on app.dograh.com; WebSocket upgrades only work on
        api.dograh.com (Next.js on the app host returns HTTP 404).
        """
        parsed = urlparse(http_base)
        host = parsed.netloc.lower()
        if host == "app.dograh.com":
            host = "api.dograh.com"
        scheme = "wss" if parsed.scheme == "https" else "ws"
        return f"{scheme}://{host}"

    async def create_webrtc_session(self) -> dict[str, Any]:
        """
        Mint a SmallWebRTC run and return browser-safe signaling info.

        Prefer authenticated run creation with API key. Browser connects to
        /api/v1/ws/signaling/{workflowId}/{workflowRunId}?api_key=... via a
        short-lived proxy token pattern: we instead return a backend-proxied
        signaling ticket so the raw API key is not required in the UI.

        For Mac demo simplicity with hosted Dograh, the backend creates the run
        and returns a one-time signaling_token that our backend WebSocket proxy
        uses with the server-side API key.
        """
        cfg = await self._resolved_settings()
        if not cfg["api_key"]:
            raise RuntimeError("DOGRAH_API_KEY is not configured")
        if not cfg["agent_id"]:
            raise RuntimeError("DOGRAH_AGENT_ID is not configured")

        workflow_id = str(cfg["agent_id"])
        run_name = f"kiosk-{uuid.uuid4().hex[:10]}"

        async with httpx.AsyncClient(timeout=30.0) as client:
            # Path A: authenticated smallwebrtc run
            resp = await client.post(
                f"{cfg['base_url']}/api/v1/workflow/{workflow_id}/runs",
                headers=self._headers(cfg["api_key"]),
                json={"mode": "smallwebrtc", "name": run_name},
            )
            if resp.status_code >= 400:
                # Path B: public embed init if embed token configured
                if cfg["embed_token"]:
                    embed = await client.post(
                        f"{cfg['base_url']}/api/v1/public/embed/init",
                        json={
                            "token": cfg["embed_token"],
                            "context_variables": {"source": "kiosk"},
                        },
                    )
                    if embed.status_code >= 400:
                        raise RuntimeError(
                            f"Dograh run create failed ({resp.status_code}): {resp.text[:400]}; "
                            f"embed init failed ({embed.status_code}): {embed.text[:400]}"
                        )
                    embed_body = embed.json()
                    session_token = embed_body.get("session_token")
                    workflow_run_id = embed_body.get("workflow_run_id")
                    ice_servers = await self._fetch_embed_turn(
                        client, cfg["base_url"], session_token
                    )
                    return {
                        "workflow_id": workflow_id,
                        "workflow_run_id": int(workflow_run_id),
                        "signaling_url": (
                            f"{self._ws_base(cfg['base_url'])}/api/v1/ws/public/signaling/{session_token}"
                        ),
                        "ice_servers": ice_servers,
                        "force_turn_relay": False,
                        "auth_query": {},
                        "session_id": str(uuid.uuid4()),
                        "mode": "smallwebrtc",
                        "path": "embed",
                    }

                raise RuntimeError(
                    f"Dograh run create failed ({resp.status_code}): {resp.text[:500]}"
                )

            body = resp.json()
            workflow_run_id = int(body["id"])

        # Browser should NOT receive the API key. We expose a kiosk proxy WS URL
        # that the backend upgrades to Dograh with the server-side key.
        kiosk_session = str(uuid.uuid4())
        return {
            "workflow_id": workflow_id,
            "workflow_run_id": workflow_run_id,
            "signaling_url": f"/api/sessions/{kiosk_session}/dograh-signaling",
            "dograh_direct_signaling_url": (
                f"{self._ws_base(cfg['base_url'])}/api/v1/ws/signaling/"
                f"{workflow_id}/{workflow_run_id}"
            ),
            "ice_servers": [
                {"urls": ["stun:stun.l.google.com:19302"]},
            ],
            "force_turn_relay": False,
            # Used only by our backend proxy — never send api_key to browser.
            "auth_query": {},
            "session_id": kiosk_session,
            "mode": "smallwebrtc",
            "path": "authenticated",
            "_server_api_key": cfg["api_key"],  # stripped before HTTP response
            "base_url": cfg["base_url"],
        }

    async def _fetch_embed_turn(
        self, client: httpx.AsyncClient, base_url: str, session_token: str
    ) -> list[dict[str, Any]]:
        try:
            resp = await client.get(
                f"{base_url}/api/v1/public/embed/turn-credentials/{session_token}"
            )
            if resp.status_code == 200:
                data = resp.json()
                if isinstance(data, list):
                    return data
                if isinstance(data, dict) and "iceServers" in data:
                    return data["iceServers"]
                if isinstance(data, dict) and "ice_servers" in data:
                    return data["ice_servers"]
        except httpx.HTTPError:
            pass
        return [{"urls": ["stun:stun.l.google.com:19302"]}]


dograh_service = DograhService()
